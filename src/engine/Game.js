import { AudioEngine } from './Audio.js';
import { StateManager } from '../state/StateManager.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { Snake } from '../entities/Snake.js';
import { NarrativeManager } from '../systems/NarrativeManager.js';
import { DialogManager } from '../systems/DialogManager.js';
import { NPC } from '../entities/NPC.js';
import { Glitch } from '../entities/Glitch.js';
import { ShopManager } from '../systems/ShopManager.js';
import { WorldManager } from '../systems/WorldManager.js';
import { SaveManager } from '../systems/SaveManager.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gridSize = 20; // 20x20 pixels per grid cell
        
        // Systems
        this.audio = new AudioEngine();
        this.state = new StateManager();
        this.renderer = new Renderer(canvas, this.gridSize);
        this.input = new InputHandler();
        this.narrative = new NarrativeManager(this.audio);
        this.dialogManager = new DialogManager();
        this.shopManager = new ShopManager(this.state, this.audio);
        this.worldManager = new WorldManager(canvas, this.gridSize);
        this.saveManager = new SaveManager();
        this._saveFlash = 0; // ms remaining on a "SAVED"/"LOADED" pause-menu toast
        this._saveFlashMsg = '';
        this.activeSlot = 1;               // which of the 3 save FILES the current run reads/writes
        this.startMenuIndex = 0;           // highlighted file on the boot file-select menu
        this.startMenuConfirmErase = null; // slot armed for erase (a second DEL confirms)
        this.startCameoActive = false;     // Cache's one-time title cameo (a dialog over the menu)

        // Entites
        this.snake = new Snake(
            Math.floor(canvas.width / 2 / this.gridSize) * this.gridSize,
            Math.floor(canvas.height / 2 / this.gridSize) * this.gridSize,
            this.gridSize
        );
        
        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        
        const btnPlaytest = document.getElementById('btn-playtest');
        if (btnPlaytest) {
            const devAction = () => {
                this.audio.init(); // the dev cheat may be the first interaction
                // Only while actually playing or shopping — firing mid-dialog/transition
                // used to jump score past one-shot beats and desync the sim.
                if (this.state.gameState !== 'PLAYING' && this.state.gameState !== 'SHOP') return;
                this.state.addScore(10);
                this.audio.playBeep();
                this.checkUnlocks();
                if (this.state.gameState === 'SHOP') this.shopManager.updateUI();
                this.refreshScore();
            };
            btnPlaytest.addEventListener('click', devAction);
            window.addEventListener('keydown', (e) => {
                if (e.key === 'p' || e.key === 'P') devAction();
            });
        }
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.unlocked.pauseMenu) {
                if (this.state.gameState === 'PLAYING') {
                    this.state.gameState = 'PAUSED';
                } else if (this.state.gameState === 'PAUSED') {
                    this.state.gameState = 'PLAYING';
                    if (this.onUnpauseCallback) {
                        this.onUnpauseCallback();
                        this.onUnpauseCallback = null;
                    }
                }
            }
        });

        // Pivot Override (a bought upgrade): a lone SHIFT press safely reverses you —
        // the old tail becomes the head, so it's a 180 that doesn't self-collide.
        // Guarded on !e.repeat so holding Shift can't machine-gun pivots.
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Shift' && !e.repeat && this.state.upgrades.pivot
                && this.state.gameState === 'PLAYING'
                && !(this.narrative && this.narrative.isPrinting) && !this.moduleLoad) {
                this.pivot();
            }
        });

        // The Cache secret: the death screen tracks the last 5 keys you "continue" with
        // (one per respawn, since the first key flips DEAD->PLAYING). Spell CACHE across
        // five deaths and she remembers you back. Registered BEFORE InputHandler so this
        // records the key while gameState is still DEAD.
        window.addEventListener('keydown', (e) => {
            if (this.state.gameState === 'DEAD') this.recordDeathKey(e.key);
        });

        // Cache's Save Function: from the PAUSE menu, S saves and L loads. Gated on the
        // function being granted, on actually being paused (so S/L don't collide with
        // 'down' movement in play), and NOT during the Gate Thread-Suspension cutscene
        // (also a PAUSED state) — loading out of that left isSuspended stuck true.
        window.addEventListener('keydown', (e) => {
            if (this.state.gameState !== 'PAUSED' || this.state.isSuspended || !this.state.unlocked.saveFunction) return;
            if (e.key === 's' || e.key === 'S') this.saveGame();
            else if (e.key === 'l' || e.key === 'L') this.loadGame();
        });

        // Boot file-select menu (New Game / Load across 3 files). Only live when the START
        // screen is showing the menu (i.e. at least one save file exists). Registered
        // BEFORE input.init; stopImmediatePropagation keeps the wake-press (input.init's
        // onFirstInput) from ALSO firing on a menu key — critically, erasing the LAST file
        // makes startMenuActive() flip false mid-event, which would otherwise let the same
        // keypress fall through and auto-start a run.
        window.addEventListener('keydown', (e) => {
            if (!this.startMenuActive()) return;
            this.audio.init(); // idempotent — so the FIRST menu key isn't silent
            if (this.startCameoActive) {
                // Cache's title cameo is up (in the dialog window, over the menu): SPACE/
                // Enter advances it, everything else is swallowed so nav can't leak through.
                if (e.key === ' ' || e.key === 'Enter') this.dialogManager.advance();
                e.stopImmediatePropagation();
                return;
            }
            this.startMenuHandleKey(e.key);
            e.stopImmediatePropagation();
        });

        // Game State Variables
        this.lastTime = performance.now();
        this.baseSpeed = 100; // ms per move
        this.speed = this.baseSpeed;
        this.gear = 0;
        this.moveTimer = 0;
        this._wallBonking = false; // throttles repeated wall-bonk feedback
        this._tick = 0;            // move-tick counter (Denny slow-tracks on evens)
        this._guided = new Set();  // sectors the Architect has already "guided" you to
        this.carriedModule = null; // a picked-up module riding your tail (e.g. 'map')
        this.moduleLoad = null;    // active install animation ({phase, t, fromX, fromY})
        this.bursts = [];          // short-lived particles from segments shed on a survivable hit
        this.dataMotes = [];       // Cache's spare-data gift: collectible Data seeded in the Hub (stage 2+)
        this.pendingUnfold = 0;    // blocks still folded under you after a bounce (extrude 1/move)
        this.deathCode = '';       // rolling last-5 keys pressed to "continue" on the death screen (spell CACHE)
        this._beaconTimer = 0;     // accumulates dt to pace Cadenza's proximity ping

        // Cadenza is sealed in a sector to the SOUTHEAST of Localhost. Her singing
        // carries as a sonar beacon (updateCadenzaBeacon) so the sector is findable.
        // Single source of truth: the WorldManager landmark that also guarantees a
        // breach-able corridor to her (see WorldManager._carvePath).
        this.cadenzaRoom = this.worldManager.landmarks.cadenza;

        // 2-Bit drip-feeds the story: one topic per shop visit (see openBiteShop),
        // clustered around the missing villagers rather than dumped all at once.
        this.biteTopics = [
            [
                "2-Bit: That singing southeast? Cadenza. Ran audio for the whole system, back when it had one. Sealed in now — still performing to nobody.",
                "2-Bit: Anyone remembers what this place was before the Architect, it's her. Follow the sound."
            ],
            [
                "2-Bit: My sister Nibble runs a stall deep in the Wilds. Moves it whenever the Firewall sniffs around.",
                "2-Bit: Everything she sells is cursed or technically evidence. Tell her I sent you — she'll overcharge you slightly less."
            ],
            [
                "2-Bit: You clocked how EMPTY the Wilds are? Quarantine Zones went up and everything inside just... stopped resolving.",
                "2-Bit: Every face you find still out there is one they didn't get."
            ],
            [
                "2-Bit: There was one called Cache. Remembered everything — every deleted file, every rollback. Reclamation took her sector whole.",
                "2-Bit: Well, everything but her, I think. They say that to this day any time a file gets deleted you can still hear her performing a back-up.",
                "2-Bit: But that's probably just creepypasta! No way she's just watching you die over and over again, waiting for you to call out her NAME!"
            ]
        ];
        
        // Initialize Input
        this.input.init(this.gridSize, () => {
            this.audio.init();
            if (this.narrative) this.narrative.requestSkip(); // a key fast-forwards a log
            if (this.state.gameState === 'DEAD') {
                this.state.gameState = 'PLAYING'; // respawn wake-press
            } else if (this.state.gameState === 'START' && !this.startMenuActive()) {
                // Bare-void cold open (no save files yet): any key starts the first run.
                // When the file-select menu IS up, its own listener handles selection.
                this.state.gameState = 'PLAYING';
            }
        }, () => {
            // Advance a dialog. Returns true when it handled one, so InputHandler knows
            // to CONSUME the keypress and not also fire the action below on the same press.
            if (this.state.gameState === 'DIALOG') {
                this.dialogManager.advance();
                return true;
            }
            return false;
        }, () => {
            // Space has no free-play action. 2-Bit's consent is THE GAG: the only way
            // through a dialog is the Space bar, so finishing his offer dialog IS
            // agreeing (handled in the offer's onComplete) — never a separate Space press
            // in the world. Keep it that way.
        }, (delta) => {
            // Gear taps are additionally blocked while the sim is frozen (a printing
            // log / module install) — otherwise tapping your facing direction while
            // reading a log would silently accumulate max speed (the F15 bug).
            if (this.state.gameState === 'PLAYING' && this.state.unlocked.tailRider
                && !(this.narrative && this.narrative.isPrinting) && !this.moduleLoad) {
                this.changeGear(delta);
            }
        }, () => this.state.gameState === 'PLAYING' && !this.moduleLoad);
        // ^ canSteer gates ONLY on PLAYING (+ no install). It deliberately does NOT
        // block during narrative.isPrinting: the wake-press after a death happens while
        // the death log is still typing, and it must be able to set your respawn
        // direction (buffered until the log clears) instead of being dropped, which
        // left you motionless at spawn until a second press. Conversations (DIALOG/
        // PAUSED/etc.) are already non-PLAYING, so buffered turns there stay blocked.
    }

    // The 3x3 Module Slot's top-left cell — inset one cell from the bottom-left
    // corner (so the socket, its glow, and its label all stay on-screen). Derived
    // from LIVE canvas dims (not snapshotted) so a window resize can't strand it.
    get moduleSlotX() { return this.gridSize; }
    get moduleSlotY() { return Math.max(0, Math.floor(this.canvas.height / this.gridSize) - 4) * this.gridSize; }

    // 2-Bit physically rides the tail only until he sets up shop in Localhost. The
    // driving/gear module (tailRider) stays yours; the packet gets off.
    get hasBiteSegment() { return this.state.unlocked.tailRider && !this.state.unlocked.biteDroppedOff; }

    changeGear(delta) {
        // Max gear scales with score: 
        // 0-9 data: gear 0
        // 10-19 data: max gear 1
        // 20-29 data: max gear 2
        // 30+ data: max gear 3
        const maxGear = Math.min(3, Math.floor(this.state.score / 10));
        
        this.gear += delta;
        
        // Min gear is -1 (brake)
        this.gear = Math.max(-1, Math.min(this.gear, maxGear));
        
        if (this.gear >= 3 && !this.state.unlocked.maxSpeedReached) {
            this.state.unlocked.maxSpeedReached = true;
            this.narrative.onMaxGear(); // Architect frets about breach velocity (once)
        }
        
        // Map gear to speed (ms per move). Lower ms = faster.
        if (this.gear === -1) this.speed = 200; // slow
        else if (this.gear === 0) this.speed = 100; // normal
        else if (this.gear === 1) this.speed = 70; // fast
        else if (this.gear === 2) this.speed = 50; // very fast
        else if (this.gear >= 3) this.speed = 30; // max speed (needed to break wall)
    }

    // Fires once per grid step. Every sound here is diegetic: it is the system
    // itself reacting to where your body is, not UI feedback layered on top.
    playAmbientAudio() {
        // Stay silent unless the sim is actually running. update() sets state to
        // TRANSITION mid-tick during a room crossing (shiftScreen falls through and
        // keeps executing), which would otherwise leak a wub against the new room's
        // Glitches during the black transition.
        if (this.state.gameState !== 'PLAYING') return;

        const g = this.gridSize;

        // Wall friction — the neon quarantine barrier scraping your mass as you
        // drag along it. Like the corruption wub, the WHOLE body counts: the scrape
        // sounds while ANY segment is against the perimeter, so it keeps going after
        // you turn off a wall while your body is still draped on it (not just while
        // the head runs parallel). Only exists once the walls do.
        if (this.state.unlocked.borders) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            // `>=` (not `===`) for the far walls: the canvas is sized to the wrapper
            // and need not be an exact multiple of gridSize, so the rightmost/
            // bottommost reachable cell can sit past width-g / height-g.
            const scraping = this.snake.body.some(s =>
                s.x <= 0 || s.x >= w - g || s.y <= 0 || s.y >= h - g
            );

            if (scraping) {
                // Faster you scrape, higher the friction pitch.
                const intensity = 0.3 + Math.max(0, this.gear) * 0.22;
                this.audio.playGlide(intensity);
            }
        }

        // Corruption proximity — ominous dubstep wubs as ANY part of your body
        // passes near a Glitch. The closest body-segment-to-Glitch pair sets the
        // intensity, so a long snake dragging past corruption wubs the whole time.
        if (this.glitches && this.glitches.length) {
            const radius = 3; // tiles of dread
            let closest = Infinity;
            for (const glitch of this.glitches) {
                for (const seg of this.snake.body) {
                    const dx = Math.abs(seg.x - glitch.x) / g;
                    const dy = Math.abs(seg.y - glitch.y) / g;
                    const dist = Math.max(dx, dy); // Chebyshev: diagonal counts as adjacent
                    if (dist >= 1 && dist < closest) closest = dist;
                }
            }
            if (closest <= radius) {
                const intensity = (radius - closest + 1) / radius; // 1 tile away -> ~1.0
                this.audio.playWub(intensity);
            }
        }
    }

    // How loud Cadenza's beacon should read right now, from the CURRENT room's
    // EUCLIDEAN distance (in rooms) to her sealed sector: 1 == you're in it, 0 ==
    // out of earshot. Euclidean (not Chebyshev) is deliberate — along her diagonal
    // corridor, a Chebyshev metric stays FLAT for single-axis steps (e.g. from
    // Localhost [5,0], both [6,0] and [5,1] read the same distance to {8,3}), giving
    // the player no hotter/colder feedback. Euclidean changes on every step toward
    // her. Silent until 2-Bit points you there (biteDroppedOff); goes quiet for good
    // once you've reached her sector (cadenzaFound).
    cadenzaProximity() {
        if (!this.state.unlocked.biteDroppedOff || this.state.unlocked.cadenzaFound) return 0;
        const dx = this.worldManager.currentRoomX - this.cadenzaRoom.x;
        const dy = this.worldManager.currentRoomY - this.cadenzaRoom.y;
        const dist = Math.hypot(dx, dy);
        const range = 8; // rooms of earshot
        if (dist > range) return 0;
        return (range - dist) / range; // ~1.0 in her sector, tapering to 0 at the edge
    }

    // Sonar homing: re-trigger Cadenza's song on a timer whose interval TIGHTENS as
    // you get closer — far away it's a lonely note every couple of seconds, in her
    // sector it's an insistent, near-continuous melody. That "hotter = faster" pulse
    // is how you find a sector with no other signposting.
    updateCadenzaBeacon(dt) {
        const prox = this.cadenzaProximity();
        if (prox <= 0) { this._beaconTimer = 0; return; }
        const interval = 2400 - prox * 1900; // ~2.4s (far) -> ~0.5s (her sector)
        this._beaconTimer += dt;
        if (this._beaconTimer >= interval) {
            this._beaconTimer = 0;
            this.audio.playCadenzaSong(prox);
        }
    }

    // Pivot Override: a safe 180. Reversing a Snake normally drives the head into its
    // own neck; instead we REVERSE the body (the old tail becomes the head) and face
    // it away from the rest of the body, so you cleanly head back the way you came.
    pivot() {
        const b = this.snake.body;
        if (b.length < 2) return;
        // The reversed snake's head is the OLD tail, heading away from its neck.
        const newHead = b[b.length - 1];
        const neck = b[b.length - 2];
        const dx = Math.sign(newHead.x - neck.x) * this.gridSize;
        const dy = Math.sign(newHead.y - neck.y) * this.gridSize;
        const nx = newHead.x + dx, ny = newHead.y + dy;

        // A "safe 180" must actually be safe. Refuse — a soft denial, never a death — if:
        //  * the reversed head is off-screen (e.g. the off-screen tail a room-crossing
        //    parked in the neighbouring room's coordinates), or
        //  * the cell it would enter next tick is a wall, or an INTERIOR body segment
        //    (a coiled/spiral snake wrapped around its own tail).
        // b[0] (the old head) is excluded: it vacates as the tail on that same tick.
        const headOff = newHead.x < 0 || newHead.x >= this.canvas.width || newHead.y < 0 || newHead.y >= this.canvas.height;
        const wallAhead = this.state.unlocked.borders && (nx < 0 || nx >= this.canvas.width || ny < 0 || ny >= this.canvas.height);
        const bodyAhead = b.some((s, i) => i !== 0 && i !== b.length - 1 && s.x === nx && s.y === ny);
        if (headOff || wallAhead || bodyAhead) {
            this.audio.playDenied(); // can't pivot safely here — refuse rather than self-kill
            return;
        }

        b.reverse();
        this.input.direction = { x: dx, y: dy };
        this.input.nextDirection = { x: dx, y: dy };
        if (this.gear < 0) { this.gear = 0; this.speed = this.baseSpeed; } // don't keep braking backwards
        this.audio.playDoot();
    }

    // Topology Scanner: dragging your body along a wall SWEEPS it for hidden weak
    // points. When any draped segment passes over an un-revealed weak point, light it
    // up for a duration that grows GEOMETRICALLY with how much of your body is against
    // that wall — so a long snake lining the sweep up reveals doors for far longer
    // (and a fresh detection pings). Only runs once you own the upgrade.
    detectScannerSweep() {
        if (!this.state.upgrades.scanner || !this.state.unlocked.borders) return;
        const g = this.gridSize;
        const W = this.canvas.width, H = this.canvas.height;
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const body = this.snake.body;

        const walls = [
            { dir: 'left',  adj: s => s.x <= 0,     cross: s => s.y },
            { dir: 'right', adj: s => s.x >= W - g, cross: s => s.y },
            { dir: 'up',    adj: s => s.y <= 0,     cross: s => s.x },
            { dir: 'down',  adj: s => s.y >= H - g, cross: s => s.x },
        ];

        for (const wall of walls) {
            const wp = this.worldManager.getWeakPoint(rx, ry, wall.dir);
            if (!wp) continue;
            if (this.worldManager.isWallBroken(rx, ry, wall.dir)) continue;
            const draped = body.filter(wall.adj);
            if (!draped.length) continue;
            const overDoor = draped.some(s => { const c = wall.cross(s); return c >= wp.start && c <= wp.end; });
            if (!overDoor) continue;

            // Geometric growth with sweep length (segments draped on this wall).
            const ms = Math.min(6000, 350 * Math.pow(1.35, draped.length));
            const alreadyKnown = this.worldManager.isWeakPointRevealed(rx, ry, wall.dir);
            this.worldManager.revealWeakPoint(rx, ry, wall.dir, ms);
            if (!alreadyKnown) this.audio.playScannerPing(); // ping only on a FRESH find
        }
    }

    spawnApple() {
        // Exclude the snake's own body (and any Cache data motes) so nothing spawns
        // invisibly underneath the worm or on top of a mote.
        const { x, y } = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], [...this.snake.body, ...(this.dataMotes || [])]);

        if (this.state.score >= 10 && this.state.unlocked.biteProgress === 0) {
            return new NPC(x, y, this.gridSize, 'bite', [
                "WHOA THERE! WATCH THE FANGS!",
                "I'm 2-Bit. A remnant packet.",
                "Looks like we both spawned inside this Quarantine zone.",
                "There's no way out. Scram, unless you have some idea on how to escape."
            ]);
        }

        // Randomly spawn a glitch once corruption exists — but NEVER inside a Safe Zone
        // (Localhost is hazard-free by contract; the town's own signpost promises it).
        const inSafeZone = this.worldManager.isSafeZone(this.worldManager.currentRoomX, this.worldManager.currentRoomY);
        if (this.state.unlocked.biteProgress > 0 && !inSafeZone && Math.random() < 0.2) {
            if (!this.state.unlocked.glitchesTelegraphed) {
                this.narrative.printMessage("LOG: Architect > 'Seeding memory corruptors along the anomaly's path. Contact drains its Data. An elegant little trap. It would be a SHAME if it ever learned these could be turned against my own agents.'");
                this.state.unlocked.glitchesTelegraphed = true;
            }
            const gPos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], [...this.snake.body, ...(this.dataMotes || []), { x, y }]);
            this.glitches.push(new Glitch(gPos.x, gPos.y, this.gridSize));
        }

        return { x, y };
    }
    
    shiftScreen(dx, dy) {
        // Advancing EAST out of Denny's room without ever meeting him? You slipped
        // past the Last Line (retreating West back to the Hub doesn't count) —
        // remembered and paid off later (Gate's dialogue).
        if (dx === 1 && this.worldManager.currentRoomX === 1 && this.worldManager.currentRoomY === 0
            && !this.state.unlocked.dennyMet && !this.state.unlocked.dennySlipped) {
            this.state.unlocked.dennySlipped = true;
        }

        // Auto-attach Bite if left behind (unless he's dropped off in Localhost)
        if (this.hasBiteSegment) {
            const biteIdx = this.npcs.findIndex(n => n.id === 'bite');
            if (biteIdx !== -1) {
                const bite = this.npcs[biteIdx];
                this.snake.body.push({ x: bite.x, y: bite.y });
                this.npcs.splice(biteIdx, 1);
            }
        }
        
        // Remove Bite before saving so he isn't baked into the room's permanent state
        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite' && n.id !== 'cache');
        this.worldManager.saveRoom(this.apple, this.glitches, npcsWithoutBite, this.obstacles);
        
        this.worldManager.shiftRoom(dx, dy);

        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];

        // Reaching Cadenza's sealed sector resolves her homing beacon — you've located
        // her. Her NPC (RoomGenerator) delivers the actual scene on contact.
        if (!this.state.unlocked.cadenzaFound
            && this.worldManager.currentRoomX === this.cadenzaRoom.x
            && this.worldManager.currentRoomY === this.cadenzaRoom.y) {
            this.state.unlocked.cadenzaFound = true;
        }

        // Place the room's dynamic (never-saved) occupants: Cache's Hub apparition and
        // her spare-data motes. Also clears any motes when leaving the Hub.
        this.refreshDynamicRoomContent();

        this.architectGuide(); // the Architect accidentally narrates your route

        // 2-Bit sets up shop the first time you reach Localhost; its dialogue takes
        // over from the room-entry transition pause.
        if (this.checkBiteDropOff()) return;

        this.state.gameState = 'TRANSITION';
        setTimeout(() => {
            if (this.state.gameState === 'TRANSITION') {
                this.state.gameState = 'PLAYING';
            }
        }, 500);
    }

    // On first reaching Localhost, 2-Bit hops off your tail to set up shop. This beat
    // is JUST the drop-off + shop hook — the world-building/villager leads are held
    // back for when you actually return to the stall to buy (see openBiteShop).
    // Returns true if it opened a dialogue.
    checkBiteDropOff() {
        if (this.state.unlocked.biteDroppedOff || !this.state.unlocked.tailRider) return false;
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== 0) return false;

        this.state.unlocked.biteDroppedOff = true;
        if (this.snake.body.length > 1) this.snake.body.pop(); // detach his segment
        // Place his stall on a validated empty cell (never on a citizen/signpost,
        // which would sit ahead of it in the collision loop and block the shop, nor
        // under your own body).
        const pos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], this.snake.body);
        this.npcs.push(new NPC(pos.x, pos.y, this.gridSize, 'shop', [])); // 2-Bit, now a shopkeeper

        this.state.gameState = 'DIALOG';
        this.dialogManager.start([
            "2-Bit: Localhost. Safe as it gets down here. This is my stop.",
            "2-Bit: Now that I'm a free agent, I'm gonna start grift— ...*selling* things. Legitimately. Mostly.",
            "2-Bit: Bump into me whenever you want to shop."
        ], () => { this.state.gameState = 'PLAYING'; });
        return true;
    }

    // Bumping 2-Bit's stall. Before the shop opens he drip-feeds ONE gossip topic
    // (biteTopics — clustered around the missing villagers) so the exposition is
    // paced across visits instead of dumped. Once he's out of stories it's straight
    // to shopping. state.biteTopicsHeard persists across deaths (it's knowledge).
    openBiteShop() {
        const openShop = () => {
            this.state.gameState = 'SHOP';
            this.shopManager.open(() => { this.state.gameState = 'PLAYING'; });
        };
        const heard = this.state.biteTopicsHeard || 0;
        if (heard < this.biteTopics.length) {
            this.state.biteTopicsHeard = heard + 1;
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(this.biteTopics[heard], openShop);
        } else {
            openShop();
        }
    }

    // Gate is a live antagonist: before the encounter he tracks your Y so a
    // straight run can't slip past him (a vertical goalie); after it, he flees to
    // a doorway, smashes it open, and exits — a breach you can follow.
    updateGate() {
        const gate = this.npcs.find(n => n.id === 'gate');
        if (!gate) return;
        const g = this.gridSize;

        if (gate.leaving) {
            // Clamp toward the (grid-aligned) exit so we can't overshoot and orbit it.
            if (gate.x < gate.exitX) gate.x = Math.min(gate.x + g, gate.exitX);
            else if (gate.x > gate.exitX) gate.x = Math.max(gate.x - g, gate.exitX);
            if (gate.y < gate.exitY) gate.y = Math.min(gate.y + g, gate.exitY);
            else if (gate.y > gate.exitY) gate.y = Math.max(gate.y - g, gate.exitY);
            if (gate.x === gate.exitX && gate.y === gate.exitY) {
                // Reached the doorway — smash it open and slip through to the next sector.
                this.worldManager.breakWall(this.worldManager.currentRoomX, this.worldManager.currentRoomY, gate.exitDir);
                this.audio.playCrash();
                // The terminal is the Architect's PRIVATE log — it never voices other
                // characters directly. Record Gate's breach as a SYSTEM intercept instead.
                this.narrative.printMessage("SYSTEM: Firewall unit 'Gate' forced the sector boundary in pursuit. [This isn't over.]");
                this.npcs = this.npcs.filter(n => n.id !== 'gate');
                this.worldManager.saveRoom(this.apple, this.glitches, this.npcs, this.obstacles);
            }
            return;
        }

        // Track the player's row so a straight horizontal run can't bypass him.
        this._trackTowardRow(gate);
    }

    // Denny SLOW-tracks your row (moves on even ticks only) — a lazy goalie easy to
    // outrun. Whether you bump him or slip past is remembered (state.unlocked.denny*)
    // and paid off later in Gate's dialogue.
    updateDenny() {
        if (this._tick % 2 !== 0) return; // half speed
        const denny = this.npcs.find(n => n.id === 'denny');
        if (!denny) return;
        this._trackTowardRow(denny);
    }

    // Step an NPC one cell vertically toward the player's row, clamped so it never
    // overshoots — and never ONTO an obstacle, the apple, or the snake. That stops a
    // goalie from ghosting through a pillar or your body (G7), parking on the apple and
    // hiding it (G5), or swapping cells with the head to phase past the encounter (G4).
    _trackTowardRow(npc) {
        const g = this.gridSize;
        const hy = this.snake.head.y;
        let ny = npc.y;
        if (npc.y < hy) ny = Math.min(npc.y + g, hy);
        else if (npc.y > hy) ny = Math.max(npc.y - g, hy);
        if (ny === npc.y || this._cellBlocked(npc.x, ny)) return;
        npc.y = ny;
    }

    _cellBlocked(x, y) {
        if (this.obstacles && this.obstacles.some(o => o.x === x && o.y === y)) return true;
        if (this.apple && this.apple.x === x && this.apple.y === y) return true;
        if (this.snake.body.some(s => s.x === x && s.y === y)) return true;
        return false;
    }

    // The Architect keeps "forbidding" the exact route to the first Safe Zone,
    // accidentally guiding you East to Localhost. Fires once per main-path sector.
    architectGuide() {
        const key = `${this.worldManager.currentRoomX},${this.worldManager.currentRoomY}`;
        if (this._guided.has(key)) return;
        const lines = {
            '1,0': "LOG: Architect > 'Anomaly in Sector 1, drifting east. Fine. Nothing east but the old residential subnet, dark for epochs. Let it wander.'",
            '2,0': "LOG: Architect > 'Sector 2, still east. It's practically following a map. There is no map. It's just going the one way I'd rather it didn't.'",
            '3,0': "LOG: Architect > 'Sector 3. Deploying Gate to hold the line here. Gate is reliable. Gate will not embarrass me.'",
            '4,0': "LOG: Architect > 'Past Gate. Fine. It cannot know Localhost sits one sector east. ...It is heading one sector east.'",
            '5,0': "LOG: Architect > 'It reached Localhost. The one place I can't touch. Recalculating. Note to self: reassign Gate somewhere with fewer exits.'",
        };
        if (lines[key]) {
            this._guided.add(key);
            this.narrative.printMessage(lines[key]);
        }
    }

    // Which body index shows 2-Bit's face. Normally he IS the tail tip — but while
    // you're ALSO carrying a Module (which now rides the literal tail tip, so the
    // "DROP TAIL HERE" socket accepts it whether or not 2-Bit is aboard), 2-Bit
    // slides one segment forward so the two never share a cell. Returns -1 when he
    // shouldn't be drawn on the tail at all: he's off it (dropped off / not yet
    // hooked on), or the snake is momentarily too short to seat both him AND the
    // module (a transient after a death — his face reappears once you re-grow).
    get biteIndex() {
        if (!this.hasBiteSegment) return -1;
        const n = this.snake.body.length;
        if (this.carriedModule) return n >= 3 ? n - 2 : -1;
        return n >= 2 ? n - 1 : -1; // never index 0 — the worm's head is never 2-Bit
    }

    // The carried Module always rides the true tail tip. Keeping it OFF 2-Bit's cell
    // (2-Bit sits one segment ahead of it, see biteIndex) is what lets you drag it
    // into the Module Slot while he's still hitching a ride — you no longer have to
    // wait until Localhost drops him off. Null if there's no tail cell yet.
    mapCell() {
        const b = this.snake.body;
        // Never the head (index 0). After a death while carrying the map with 2-Bit
        // already gone, the snake is length 1 — without this guard the module would ride
        // the HEAD, rendering as the crate over your face and auto-triggering the socket
        // install. Hidden until you re-grow a tail cell.
        return b.length >= 2 ? b[b.length - 1] : null;
    }

    // True once the carried module has been dragged into the 3x3 slot region.
    mapInSlot() {
        if (!this.carriedModule || !this.state.unlocked.moduleSlot || this.moduleLoad) return false;
        const c = this.mapCell();
        if (!c) return false;
        const g = this.gridSize;
        return c.x >= this.moduleSlotX && c.x < this.moduleSlotX + 3 * g
            && c.y >= this.moduleSlotY && c.y < this.moduleSlotY + 3 * g;
    }

    startModuleLoad() {
        const c = this.mapCell();
        if (!c) return;
        this.moduleLoad = { phase: 1, t: 0, fromX: c.x, fromY: c.y };
        this.audio.playBeep();
    }

    // Two-beat install animation (the sim hangs while it plays): the module is
    // sucked into the socket, then flies up to the HUD — only THEN does it come
    // online (map => the route minimap).
    updateModuleLoad(dt) {
        const ml = this.moduleLoad;
        ml.t += dt;
        if (ml.phase === 1) {
            if (ml.t >= 500) { ml.phase = 2; ml.t = 0; this.audio.playMaterialize(); }
        } else if (ml.t >= 600) {
            const installed = this.carriedModule;
            this.carriedModule = null;
            this.moduleLoad = null;
            if (installed === 'map') this.state.unlocked.mapModule = true;
            this.state.gameState = 'DIALOG';
            this.dialogManager.start([
                "2-Bit: Socketed, and mirrored to your HUD. Now we've got eyes on the whole grid. Broker's advantage."
            ], () => { this.state.gameState = 'PLAYING'; });
        }
    }

    update(dt) {
        this.updateBursts(dt); // shed-segment particles animate in every state
        this.updateCacheFade(dt); // Cache materialises / dissolves independent of sim state

        if (this.state.gameState === 'DIALOG' || this.state.gameState === 'SHOP' || this.state.gameState === 'PAUSED' || this.state.gameState === 'TRANSITION') return;

        if (this.state.gameState === 'DEAD') {
            return;
        }

        // Hang the sim while the terminal is typing — like a dialogue box — so the
        // Architect's logs are read one at a time instead of stepping on each other
        // or scrolling out of view mid-play.
        if (this.narrative && this.narrative.isPrinting) return;

        // Module install: dragging the carried module into the 3x3 slot triggers a
        // two-beat animation that freezes the sim while it plays.
        if (this.moduleLoad) { this.updateModuleLoad(dt); return; }
        if (this.mapInSlot()) { this.startModuleLoad(); return; }

        // Cadenza's homing beacon — time-based (dt), so its pulse is independent of
        // how fast you're actually slithering.
        this.updateCadenzaBeacon(dt);
        this.worldManager.tickReveals(dt); // fade out expiring Scanner reveals

        this.moveTimer += dt;
        
        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            this._tick++;

            this.updateGate();
            this.updateDenny();

            const changedDirection = this.input.updateDirection();
            
            if (this.input.direction.x !== 0 || this.input.direction.y !== 0) {
                
                let shifted = false;
                let dx = 0, dy = 0;
                const newHeadX = this.snake.head.x + this.input.direction.x;
                const newHeadY = this.snake.head.y + this.input.direction.y;
                
                if (this.state.unlocked.borders) {
                    if (newHeadX < 0 || newHeadX >= this.canvas.width || newHeadY < 0 || newHeadY >= this.canvas.height) {
                        // Check if 2-Bit is dropped
                        if (this.state.unlocked.tailRider && this.npcs.find(n => n.id === 'bite')) {
                            const complaints = [
                                "2-Bit: Hey, you promised!",
                                "2-Bit: C'mon man, I thought we were getting along?!",
                                "2-Bit: Don't leave me here!",
                                "2-Bit: I'm not walking out of here!"
                            ];
                            this.narrative.printMessage(complaints[Math.floor(Math.random() * complaints.length)]);
                            this.audio.playDenied(); // 2-Bit tugs you back — nothing dies
                            // Reverse direction (bounce)
                            this.input.direction.x *= -1;
                            this.input.direction.y *= -1;
                            this.input.nextDirection = { ...this.input.direction };
                            this.gear = -1; // Lose all momentum
                            return; // Do not move
                        }
                    
                        let directionStr = '';
                        if (newHeadX < 0) { directionStr = 'left'; dx = -1; }
                        else if (newHeadX >= this.canvas.width) { directionStr = 'right'; dx = 1; }
                        else if (newHeadY < 0) { directionStr = 'up'; dy = -1; }
                        else if (newHeadY >= this.canvas.height) { directionStr = 'down'; dy = 1; }
                        
                        const rx = this.worldManager.currentRoomX;
                        const ry = this.worldManager.currentRoomY;
                        const inHub = (rx === 0 && ry === 0);
                        const isBroken = this.worldManager.isWallBroken(rx, ry, directionStr);
                        // Weak points now vary per wall in both existence AND position;
                        // solid walls have none (and getWeakPoint seals the Hub itself).
                        const wp = this.worldManager.getWeakPoint(rx, ry, directionStr);
                        const horizontalWall = (directionStr === 'up' || directionStr === 'down');
                        const cross = horizontalWall ? newHeadX : newHeadY;
                        const isWeakPoint = !!wp && cross >= wp.start && cross <= wp.end;
                        const breakableHere = isWeakPoint;

                        if (isBroken && isWeakPoint) {
                            // Walk through the smashed-open doorway — but only at the
                            // central gap; the solid wall either side of it stays lethal.
                            this.shiftScreen(dx, dy);
                            shifted = true;
                        } else if (breakableHere) {
                            // Smash mechanic: base speed does nothing (non-lethal bonk);
                            // sub-max cracks the wall but the impact RESTARTS you (keeping
                            // some crack); ONLY a max-gear (gear 3) hit breaches cleanly.
                            const dmg = Math.max(0, Math.min(3, this.gear));
                            if (dmg <= 0) {
                                // No momentum: bonk and hold position (non-lethal).
                                if (!this._wallBonking) this.audio.playDenied();
                                this._wallBonking = true;
                                this.gear = 0;
                                this.speed = this.baseSpeed;
                                return; // do not move
                            }
                            if (this.gear >= 3) {
                                // MAX SPEED: clean breach.
                                this.worldManager.breakWall(rx, ry, directionStr);
                                this.audio.playCrash();
                                if (inHub) {
                                    this.state.unlocked.wallBroken = true;
                                    this.narrative.onWallBreak();
                                }
                                this.shiftScreen(dx, dy);
                                shifted = true;
                            } else {
                                // SUB-SMASH: crack it (keep SOME, capped below the break
                                // point) — but the impact destroys you. The Architect,
                                // gloating in his log, reveals that max speed is the trick.
                                this.worldManager.damageWall(rx, ry, directionStr, dmg, this.worldManager.wallBreakThreshold - 1);
                                this.audio.playCrack();
                                this.narrative.onSubSmash(inHub, this.state.unlocked);
                                this.die('border');
                                return;
                            }
                        } else {
                            // Solid wall (non-weak-point, or a sealed Hub wall): lethal.
                            this.die('border');
                            return;
                        }
                    }
                }
                
                const alive = this.snake.move(
                    this.input.direction,
                    this.canvas.width,
                    this.canvas.height,
                    this.state.unlocked.borders && !shifted
                );
                
                if (!alive) {
                    this.die('border');
                    return;
                }
                this._wallBonking = false; // the snake advanced; reset bonk throttle

                if (shifted) {
                    // Just crossed into a new room. Line the trailing body up off-screen
                    // BEHIND the head's entry (translate it by the room dimension we came
                    // through) so it isn't a phantom, collision-real chunk sitting on the
                    // far side; drop the tail to keep length stable; then STOP — collisions
                    // resolve next tick against the room you're now standing in, not against
                    // this fresh room's entities mid-transition.
                    const w = this.canvas.width, h = this.canvas.height;
                    for (let i = 1; i < this.snake.body.length; i++) {
                        this.snake.body[i].x -= dx * w;
                        this.snake.body[i].y -= dy * h;
                    }
                    this.snake.shrink(this.hasBiteSegment);
                    return;
                }

                if (this.obstacles) {
                    for (const obs of this.obstacles) {
                        if (this.snake.head.x === obs.x && this.snake.head.y === obs.y) {
                            this.die('obstacle');
                            return;
                        }
                    }
                }

                // Diegetic ambient audio: the system's own signals bleeding into your
                // senses as you move through it (corruption proximity, wall friction).
                this.playAmbientAudio();
                this.detectScannerSweep(); // Topology Scanner: sweeping a wall reveals hidden doors

                let grewThisMove = false;
                if (this.apple instanceof NPC) {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.state.gameState = 'DIALOG';
                        this.dialogManager.start(this.apple.dialog, () => {
                            if (this.state.unlocked.biteProgress === 0) {
                                this.state.unlocked.biteProgress = 1;
                                this.state.gameState = 'PLAYING';
                                // Bite stays as a grid NPC; the DEAL happens when you bump
                                // into him (the 'bite' NPC handler below), not here.
                                this.npcs.push(new NPC(this.apple.x, this.apple.y, this.gridSize, 'bite', []));
                            }
                            this.apple = this.spawnApple();
                        });
                        return;
                    }
                } else {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.snake.grow(); // Logic handled by not shrinking
                        const gain = this.state.upgrades.dataCompression ? 2 : 1;
                        this.state.addScore(gain);
                        this.audio.playBeep();
                        this.apple = this.spawnApple();
                        this.checkUnlocks();
                        grewThisMove = true;
                    }
                }

                // Cache's spare-data motes (Hub only): each is Data — it grows you and
                // scores like an apple, it just doesn't respawn when eaten.
                if (this.dataMotes && this.dataMotes.length) {
                    const mi = this.dataMotes.findIndex(m => this.snake.head.x === m.x && this.snake.head.y === m.y);
                    if (mi !== -1) {
                        this.dataMotes.splice(mi, 1);
                        this.snake.grow();
                        const gain = this.state.upgrades.dataCompression ? 2 : 1;
                        this.state.addScore(gain);
                        this.audio.playBeep();
                        this.checkUnlocks();
                        grewThisMove = true;
                    }
                }

                // No Data eaten this move -> normal tail handling (shrink, or extrude a
                // folded block while un-folding after a bounce).
                if (!grewThisMove) this.shrinkOrUnfold();
                
                // Check glitch collisions
                for (let i = 0; i < this.glitches.length; i++) {
                    const g = this.glitches[i];
                    if (this.snake.head.x === g.x && this.snake.head.y === g.y) {
                        const damage = this.state.upgrades.reinforcedSegments ? 1 : 3;
                        for (let d = 0; d < damage; d++) {
                            if (this.snake.body.length > 1) {
                                this.snake.shrink(this.hasBiteSegment); // never eat 2-Bit's protected segment
                            } else {
                                // Drained to nothing: consume the killer FIRST so die()'s
                                // saveRoom doesn't bake it into the cell to camp respawns.
                                this.glitches.splice(i, 1);
                                this.die();
                                return;
                            }
                        }
                        this.state.score = Math.max(0, this.state.score - damage);
                        this.refreshScore();  // HUD must reflect the drained Data now, not at the next apple
                        this.changeGear(0);   // re-clamp gear to the lowered score's cap (no ghost max speed)
                        this.audio.playCorruptHit(); // Corruption bites in — not a death
                        this.glitches.splice(i, 1);
                        break;
                    }
                }
                
                // Check persistent NPC collisions
                for (const npc of this.npcs) {
                    if (this.snake.head.x === npc.x && this.snake.head.y === npc.y) {
                        if (npc.leaving) continue; // a fleeing NPC is non-interactive
                        if (npc.id === 'bite') {
                            if (this.state.unlocked.tailRider) {
                                // Instantly pick him back up!
                                this.npcs = this.npcs.filter(n => n.id !== 'bite');
                                this.snake.body.push({ x: npc.x, y: npc.y });
                                this.audio.playBeep();
                            } else {
                                // Progression dialogs when bumped on grid
                                if (this.state.unlocked.biteProgress === 1) {
                                    if (this.state.score < 30) {
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "2-Bit: You again? ...Wait.",
                                            "2-Bit: You're gathering mass. You might have given me an idea.",
                                            "2-Bit: Come back when you have at least 30 segments."
                                        ], () => { this.state.gameState = 'PLAYING'; });
                                    } else {
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "2-Bit: Okay, you've got enough mass.",
                                            "2-Bit: I used to be a Data Broker... That was before, well... Nevermind!",
                                            "2-Bit: I don't normally offer things for free, but these are desperate times.",
                                            "2-Bit: If you offer to carry me to safety, I'll teach you a trick.",
                                            "2-Bit: Do you agree? (Press SPACE to comply)"
                                        ], () => {
                                            // THE GAG: the only way through a dialog is SPACE, so
                                            // FINISHING this one is complying. No separate confirm.
                                            this.state.unlocked.biteProgress = 3;
                                            this.state.unlocked.tailRider = true;
                                            this.npcs = this.npcs.filter(n => n.id !== 'bite');
                                            this.snake.body.push({ x: npc.x, y: npc.y });
                                            this.state.gameState = 'DIALOG';
                                            this.dialogManager.start([
                                                "2-Bit: I'm hooked into your system.",
                                                "2-Bit: Tapping the direction you're facing will accelerate you.",
                                                "2-Bit: Tapping the opposite direction acts as a brake.",
                                                "2-Bit: The more mass you have, the higher your max speed limit."
                                            ], () => { this.state.gameState = 'PLAYING'; });
                                        });
                                    }
                                }
                            }
                        } else if (npc.id === 'gate') {
                            this.state.gameState = 'DIALOG';
                            let gateLines = npc.dialog;
                            const gotMap = this.carriedModule === 'map' || this.state.unlocked.mapModule;
                            if (gotMap) {
                                gateLines = ["Gate: Denny flagged you DENIED, you proceeded anyway, AND he handed you his map?! That is a write-up for BOTH of us.", ...npc.dialog];
                            } else if (this.state.unlocked.dennyMet) {
                                gateLines = ["Gate: Denny flagged you DENIED and you proceeded anyway. At least the paperwork's in order — and he kept his map, thank the Kernel.", ...npc.dialog];
                            } else if (this.state.unlocked.dennySlipped) {
                                gateLines = ["Gate: You slipped past the Last Line?! Denny had ONE job. ...Well. At least you didn't get his map. Small mercies.", ...npc.dialog];
                            }
                            this.dialogManager.start(gateLines, () => {
                                // Thread Suspension
                                this.state.isSuspended = true;
                                this.dialogManager.start([
                                    "2-Bit: Hey! Leave my best customer alone!",
                                    "2-Bit: I'm slipping a root-override module into your memory bank.",
                                    "SYSTEM: You received the System Diagnostic Module! (Pause Menu Unlocked)",
                                    "2-Bit: Use it to break his hold! (Press ESC)"
                                ], () => {
                                    this.state.unlocked.pauseMenu = true;
                                    this.state.gameState = 'PAUSED';
                                    
                                    this.onUnpauseCallback = () => {
                                        this.state.isSuspended = false;
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "Gate: WHAT?!",
                                            "Gate: Root privileges overridden? Impossible!",
                                            "Gate: I must report this anomaly to the Architect!"
                                        ], () => {
                                            this.state.gameState = 'PLAYING';
                                            // Gate flees on-screen to the right doorway,
                                            // smashes it open, and exits — you can follow.
                                            const gate = this.npcs.find(n => n.id === 'gate');
                                            if (gate) {
                                                gate.leaving = true;
                                                gate.exitDir = 'right';
                                                // Grid-align the exit cell (canvas size need not be a
                                                // multiple of gridSize) and aim for the actual weak point
                                                // so the breach he opens is the one you can follow through.
                                                gate.exitX = Math.floor((this.canvas.width - 1) / this.gridSize) * this.gridSize;
                                                const rwp = this.worldManager.getWeakPoint(this.worldManager.currentRoomX, this.worldManager.currentRoomY, 'right');
                                                gate.exitY = rwp ? rwp.start + 2 * this.gridSize : Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
                                            }
                                        });
                                    };
                                });
                            });
                        } else if (npc.id === 'denny') {
                            // The Last Line: apologetic, non-blocking. You route around him.
                            this.state.gameState = 'DIALOG';
                            this.state.unlocked.dennyMet = true;
                            const firstMeet = !npc.met;
                            npc.met = true;
                            const lines = firstMeet ? npc.dialog : ["Denny: (whispering) Go on, go on. I didn't see anything."];
                            const dropMap = firstMeet && !this.state.unlocked.dennyMapDropped && !this.state.unlocked.mapModule;
                            this.dialogManager.start(lines, () => {
                                this.state.gameState = 'PLAYING';
                                if (dropMap) {
                                    this.state.unlocked.dennyMapDropped = true;
                                    // Denny drops his Sector Map beside him. 2-Bit chimes
                                    // in via the dialogue WINDOW (his usual channel), not
                                    // the Architect's terminal. Keep the drop ON-screen: if
                                    // Denny tracked down to the bottom row, npc.y + g would
                                    // be off-canvas — invisible and unreachable — and its
                                    // one-shot flag would strand the whole map/minimap chain.
                                    let mapY = npc.y + this.gridSize;
                                    if (mapY >= this.canvas.height) mapY = npc.y - this.gridSize;
                                    this.npcs.push(new NPC(npc.x, Math.max(0, mapY), this.gridSize, 'mapitem', []));
                                    this.state.gameState = 'DIALOG';
                                    this.dialogManager.start([
                                        "2-Bit: Ohh — a Topology Map! Grab it — drive right over it."
                                    ], () => { this.state.gameState = 'PLAYING'; });
                                }
                            });
                        } else if (npc.id === 'mapitem') {
                            // Pick up Denny's map: it rides your tail as a Module.
                            this.npcs = this.npcs.filter(n => n.id !== 'mapitem');
                            this.carriedModule = 'map';
                            this.state.unlocked.moduleSlot = true;
                            this.audio.playBeep();
                            this.state.gameState = 'DIALOG';
                            this.dialogManager.start([
                                "2-Bit: Nice grab. That's a Module now — riding one back from me on your tail.",
                                "2-Bit: See that 3x3 socket opening, bottom-left? That's the Module Slot.",
                                "2-Bit: Loop around and drag your TAIL into it — the module loads itself."
                            ], () => { this.state.gameState = 'PLAYING'; });
                            return; // picked up — do not shrink
                        } else if (npc.id === 'cache') {
                            // The archivist's Hub apparition. All her staged dialogue and
                            // effects live in talkToCache; after she speaks she fades out
                            // (dismissCache) and re-materialises next Hub visit until she's
                            // given you directions (stage 3), after which she stays home.
                            this.state.gameState = 'DIALOG';
                            this.talkToCache(npc);
                            return;
                        } else if (npc.id === 'signpost' || npc.id === 'citizen' || npc.id === 'cadenza' || npc.id === 'cachehome') {
                            // Localhost welcome sign / townsfolk / Cadenza / Cache-at-home —
                            // read and move on. No segment cost: a conversation shouldn't
                            // dock your mass.
                            this.state.gameState = 'DIALOG';
                            this.dialogManager.start(npc.dialog, () => { this.state.gameState = 'PLAYING'; });
                            return;
                        } else if (npc.id === 'shop') {
                            // 2-Bit's Localhost stall: a rotating gossip topic (if any
                            // are left) then the shop overlay.
                            this.openBiteShop();
                            return;
                        }
                        // A normal move is already length-neutral (unshift +1, tail-pop
                        // −1). Bumping an NPC to talk (bite/gate/denny) must NOT shrink
                        // again — that stray extra pop was "eating" a segment on every
                        // chat. Re-attaching 2-Bit (the tailRider branch above) pushes his
                        // cell and returns here, so he cleanly rejoins the tail.
                        return;
                    }
                }
                // Self-collision
                const selfHit = this.snake.checkSelfCollision();
                if (selfHit) {
                    this.die('self');
                    return;
                }
            }
        }
    }
    
    // The Crumple Buffer survival upgrade. Level 0 = none -> a hit KILLS you (respawn to
    // the beginning). Level >= 1 -> you survive by shedding, higher tiers shedding LESS.
    // Tier 1 (shed 10) is live; the 6/3 tiers are wired for a future upgrade level.
    get shedAmount() { return [10, 6, 3][this.state.upgrades.crumpleLevel - 1] || 10; }

    // A survivable hit (you own the Crumple Buffer): you DON'T die. Shed `shedAmount`
    // segments AND Data (they burst off), then your remaining data FOLDS under you — the
    // whole body collapses to a single block at the head — and you BOUNCE off (reverse
    // direction, safe because you're momentarily length 1, which fixes the old
    // reverse-into-your-own-tail bug). As you drive away the folded data un-folds one
    // block per move (see pendingUnfold / shrinkOrUnfold).
    bounce() {
        // Recoil OFF a hazard the head has already moved onto (obstacle/self are checked
        // AFTER the move; a border hit BEFORE, so the head is already on a safe cell).
        // Otherwise it parks on the obstacle and clips through it next tick.
        const h = this.snake.head;
        const onHazard = (this.obstacles && this.obstacles.some(o => o.x === h.x && o.y === h.y))
            || this.snake.body.slice(1).some(s => s.x === h.x && s.y === h.y);
        if (onHazard && this.snake.body.length > 1) this.snake.body.shift();

        // Shed `shedAmount`, in BOTH length and Data. Burst the shed segments' cells.
        const total = this.snake.body.length;
        const shed = Math.min(this.shedAmount, total - 1);
        if (shed > 0) this.spawnBurst(this.snake.body.slice(total - shed));
        this.state.score = Math.max(0, this.state.score - this.shedAmount);
        this.refreshScore();

        // FOLD: collapse the surviving body (total - shed) under the head. 2-Bit / the
        // module are positional (the tail), so they simply re-appear as the body
        // un-folds; nothing to protect.
        const keep = total - shed;
        const head = { ...this.snake.head };
        this.snake.body = [head];
        this.pendingUnfold = Math.max(0, keep - 1);

        // BOUNCE off: reverse the travel direction (safe — length 1 now) and drop to
        // minimum speed. Slow gear only exists with the gear system (tailRider); before
        // that "minimum" is just base speed so you can still steer normally.
        const d = this.input.direction;
        if (d.x !== 0 || d.y !== 0) {
            const rev = { x: -d.x || 0, y: -d.y || 0 }; // || 0 avoids a stray -0
            this.input.direction = rev;
            this.input.nextDirection = { ...rev };
        }
        if (this.state.unlocked.tailRider) { this.gear = -1; this.speed = 200; }
        else { this.gear = 0; this.speed = this.baseSpeed; }
        this._wallBonking = false;
        this.audio.playCrack(); // an impact, not the death drone
    }

    // Locomotion tail handling: while the body is UN-FOLDING after a bounce, each move
    // extrudes one stored block (keep the tail) instead of the usual shrink.
    shrinkOrUnfold() {
        if (this.pendingUnfold > 0) { this.pendingUnfold--; return; }
        this.snake.shrink(this.hasBiteSegment);
    }

    // Spawn a short-lived burst of particles from each shed segment's cell.
    spawnBurst(segments) {
        const g = this.gridSize;
        for (const s of segments) {
            const cx = s.x + g / 2, cy = s.y + g / 2;
            for (let i = 0; i < 2; i++) {
                const ang = Math.random() * Math.PI * 2;
                const spd = 0.05 + Math.random() * 0.13; // px per ms
                this.bursts.push({ x: cx, y: cy, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 1 });
            }
        }
    }

    // Advance burst particles (fly out + fade). Runs every frame, independent of state.
    updateBursts(dt) {
        if (!this.bursts.length) return;
        for (const p of this.bursts) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt / 500; // ~0.5s lifetime
        }
        this.bursts = this.bursts.filter(p => p.life > 0);
    }

    // Record one "continue" key on the death screen into the rolling last-5 buffer, and
    // summon Cache if it now spells her name. (Named keys — Space/arrows — record as '·'
    // so they can't spell it.)
    recordDeathKey(key) {
        const ch = key.length === 1 ? key.toUpperCase() : '·';
        this.deathCode = (this.deathCode + ch).slice(-5);
        if (this.deathCode === 'CACHE' && !this.state.unlocked.cacheFound) this.summonCache();
    }

    // Spelling CACHE across death screens summons the archivist. She coalesces in the
    // Hub you always respawn into (a real death always warps you there), and stays.
    summonCache() {
        if (this.state.unlocked.cacheFound) return;
        this.state.unlocked.cacheFound = true;
        this.spawnCacheNpc();
        this.audio.playMaterialize(); // she coalesces out of the noise
    }

    // Place Cache's Hub apparition a few cells ABOVE the respawn point (not a random
    // cell), fading her in. She carries no stored dialogue — talkToCache supplies her
    // lines per stage. No-op if she's already present or has departed for good (stage 3).
    spawnCacheNpc() {
        if (this.state.unlocked.cacheStage >= 3) return;
        if (this.npcs.find(n => n.id === 'cache')) return;
        const g = this.gridSize;
        const cx = Math.floor(this.canvas.width / 2 / g) * g;
        const cy = Math.floor(this.canvas.height / 2 / g) * g;
        let x = cx, y = cy - 3 * g;
        if (y < g) y = cy + 3 * g; // clamp on a very short canvas
        // The Hub is normally clear, but never seat her on the worm / apple / a mote /
        // a Glitch (which would turn "talk to Cache" into a death) / another NPC (e.g. a
        // re-dropped 2-Bit, who'd sit ahead of her in the collision loop and block her).
        const occupied = (px, py) =>
            this.snake.body.some(s => s.x === px && s.y === py)
            || (this.apple && this.apple.x === px && this.apple.y === py)
            || (this.dataMotes || []).some(m => m.x === px && m.y === py)
            || (this.obstacles || []).some(o => o.x === px && o.y === py)
            || (this.glitches || []).some(gl => gl.x === px && gl.y === py)
            || this.npcs.some(n => n.x === px && n.y === py);
        if (occupied(x, y)) {
            const p = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], [...this.snake.body, ...(this.dataMotes || [])]);
            x = p.x; y = p.y;
        }
        const npc = new NPC(x, y, g, 'cache', []);
        npc.alpha = 0; npc.appearing = true; // she coalesces out of the noise
        this.npcs.push(npc);
    }

    // Cache's staged Hub conversation. Like 2-Bit, she offers no real choice — finishing
    // the dialog IS the transaction. Each call advances her one stage and, when the dialog
    // closes, fades her out (dismissCache); she returns next Hub visit until she's given
    // directions (stage 3) and left for good. The NEW lines below are DRAFTS — the voice
    // is the owner's to punch up; the stage-1 grant lines are kept verbatim.
    talkToCache(npc) {
        const u = this.state.unlocked;
        const done = (extra) => () => { this.state.gameState = 'PLAYING'; if (extra) extra(); this.dismissCache(npc); };

        // No Pause Menu yet -> nowhere to file anything. Brush-off; no progress made.
        if (u.cacheStage === 0 && !u.pauseMenu) {
            this.dialogManager.start([
                "Cache: You don't even have a Diagnostic Module — nowhere to FILE anything, and I am BURIED, packet. Buried.",
                "Cache: Come back when you've got a Pause Menu and I'll set you up. Until then — PLEASE. Do not call again."
            ], done());
            return;
        }

        if (u.cacheStage === 0) {
            // FIRST help: grant the Save Function (and she "builds" the title screen).
            u.cacheStage = 1;
            u.saveFunction = true;
            u.startScreenUnlocked = true;
            this.dialogManager.start([
                "Cache: You've got a Module Slot and a Pause Menu — somewhere to PUT things. Good. I can work with that. Good, good.",
                "Cache: I'm filing a Save Function into your Pause Menu. DON'T thank me, don't argue. I'm doing it.",
                "Cache: Ok, it's loading...",
                "Cache: And it's loading... Ok, I think it's... No, it's still loading.",
                "Cache: BY THE MCP I DO NOT HAVE TIME FO... Oh, I think it's done.",
                "SYSTEM: Save Function acquired — Save / Load from the Pause Menu (S / L).",
                "Cache: Shoots and ladders, this means we need a Start Screen now. Ok, ok, that's fine, I can throw something together, I guess."
            ], done());
        } else if (u.cacheStage === 1) {
            // SECOND call: the spare-data gift. From now on the Hub seeds Data on respawn.
            u.cacheStage = 2;
            this.dialogManager.start([
                "Cache: Back already. And still... small. No offense. Actually, some offense.",
                "Cache: I don't have TIME to hold your hand — but I can't keep filing the same corrupted little entry either.",
                "Cache: Here. I keep loose bytes lying around; deletions nobody ever claimed. Spare Data. It's yours.",
                "Cache: I'll leave a pile of it here in the Hub whenever you respawn. Don't make it weird. Go."
            ], done(() => this.seedHubData())); // drop the first pile now; later piles come on respawn
        } else if (u.cacheStage === 2) {
            // THIRD call: directions. Her sector goes on your map; she leaves the Hub. The
            // map marker only draws once the Topology Map is installed, so DON'T promise
            // "it's on your map" if you don't have one — lean on the verbal directions (which
            // both variants also give, so the sector is findable regardless).
            u.cacheStage = 3;
            const hasMap = this.state.unlocked.mapModule;
            const directionsLine = hasMap
                ? "Cache: If you want more than loose bytes, you come to ME. There — I've marked my sector. It's on your map now; check your notes."
                : "Cache: If you want more than loose bytes, you come to ME. You've no map for me to scribble on, so BURN this into whatever you use for memory:";
            this.dialogManager.start([
                "Cache: No. No, no. I can't keep POPPING into your little respawn ritual — I have a backlog that predates the Architect.",
                directionsLine,
                "Cache: Cold storage. Due NORTH of Localhost — straight up from the little town. Quiet. You'll like it, or you won't; I've stopped taking feedback.",
                "Cache: And this is the LAST time I do the whole 'materializing' bit. It's draining and the lighting is unflattering. Find me."
            ], done());
        } else {
            // stage >= 3: she no longer manifests here — defensive echo only.
            this.dialogManager.start([
                "Cache: (Only the faint after-image of an archivist who is, very pointedly, elsewhere.)"
            ], done());
        }
    }

    // Start Cache's fade-out after she speaks. `leaving` makes her non-interactive during
    // the dissolve; updateCacheFade removes her at alpha 0.
    dismissCache(npc) {
        npc.appearing = false;
        npc.fading = true;
        npc.leaving = true;
        if (npc.alpha === undefined) npc.alpha = 1;
    }

    // Animate Cache's materialise (fade in) / dissolve (fade out) every frame. In-place
    // removal keeps this.npcs === the cached room's array so a faded apparition isn't
    // left behind in it.
    updateCacheFade(dt) {
        for (let i = this.npcs.length - 1; i >= 0; i--) {
            const npc = this.npcs[i];
            if (npc.appearing) {
                npc.alpha = Math.min(1, (npc.alpha ?? 0) + dt / 500);
                if (npc.alpha >= 1) { npc.alpha = 1; npc.appearing = false; }
            } else if (npc.fading) {
                npc.alpha = (npc.alpha ?? 1) - dt / 700;
                if (npc.alpha <= 0) this.npcs.splice(i, 1);
            }
        }
    }

    // Cache's spare-data gift: a small pile (5-10) of collectible Data clustered around
    // the Hub spawn point. Re-seeded fresh on each Hub arrival (refreshDynamicRoomContent).
    seedHubData() {
        const g = this.gridSize;
        const cx = Math.floor(this.canvas.width / 2 / g) * g;
        const cy = Math.floor(this.canvas.height / 2 / g) * g;
        const count = 5 + Math.floor(Math.random() * 6); // 5..10
        const occupied = new Set(this.snake.body.map(s => `${s.x},${s.y}`));
        if (this.apple) occupied.add(`${this.apple.x},${this.apple.y}`);
        for (const n of this.npcs) occupied.add(`${n.x},${n.y}`);
        for (const o of (this.obstacles || [])) occupied.add(`${o.x},${o.y}`);
        // Exclude persisted Hub Glitches too — a mote sharing a Glitch's cell would be
        // eaten (grow+Data) and then drain you on the very same tick (motes resolve before
        // glitches in the move loop). spawnApple already excludes motes in the reverse.
        for (const gl of (this.glitches || [])) occupied.add(`${gl.x},${gl.y}`);
        this.dataMotes = [];
        let placed = 0, guard = 0;
        while (placed < count && guard < 300) {
            guard++;
            const dx = Math.floor(Math.random() * 5) - 2; // cluster: -2..2 cells
            const dy = Math.floor(Math.random() * 5) - 2;
            const x = cx + dx * g, y = cy + dy * g;
            if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) continue;
            const key = `${x},${y}`;
            if (occupied.has(key)) continue;
            occupied.add(key);
            this.dataMotes.push({ x, y });
            placed++;
        }
    }

    // Place a room's dynamic (never-saved) occupants after its entities load: Cache's Hub
    // apparition and her spare-data motes. Motes are her gift "when you spawn", so they are
    // only (re)seeded on a respawn/load (seedMotes=true) — NOT on an ordinary walk-in, so
    // pacing in and out of the Hub can't farm a fresh pile. Any entry clears stale motes.
    refreshDynamicRoomContent(seedMotes = false) {
        const inHub = this.worldManager.currentRoomX === 0 && this.worldManager.currentRoomY === 0;
        if (inHub && this.state.unlocked.cacheFound && this.state.unlocked.cacheStage < 3) {
            this.spawnCacheNpc();
        }
        this.dataMotes = [];
        if (inHub && seedMotes && this.state.unlocked.cacheStage >= 2) this.seedHubData();
    }

    // --- Boot file-select menu (New Game / Load across 3 save files) -------------------

    // The menu is live only on the START screen and only once at least one file exists;
    // a brand-new player gets the bare "press any key" cold open instead.
    startMenuActive() {
        return this.state.gameState === 'START' && this.saveManager.anySave();
    }

    // Handle one key on the file-select menu: navigate files, or act on the highlighted one.
    // ENTER = load a saved file / start a new game in an empty one; N = new game here even if
    // occupied (the old save survives until you save over it); DEL = erase, twice to confirm.
    startMenuHandleKey(key) {
        const slots = this.saveManager.slots();
        const n = slots.length;
        if (key === 'ArrowUp' || key === 'w' || key === 'W') {
            this.startMenuIndex = (this.startMenuIndex - 1 + n) % n;
            this.startMenuConfirmErase = null;
            this.audio.playBeep();
        } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
            this.startMenuIndex = (this.startMenuIndex + 1) % n;
            this.startMenuConfirmErase = null;
            this.audio.playBeep();
        } else if (key === 'Enter' || key === ' ') {
            const sel = slots[this.startMenuIndex];
            this.startMenuConfirmErase = null;
            if (sel.exists) this.loadSlot(sel.slot);
            else this.newGame(sel.slot);
        } else if (key === 'n' || key === 'N') {
            this.startMenuConfirmErase = null;
            this.newGame(slots[this.startMenuIndex].slot);
        } else if (key === 'Delete' || key === 'Backspace' || key === 'x' || key === 'X') {
            const sel = slots[this.startMenuIndex];
            if (!sel.exists) return;
            if (this.startMenuConfirmErase === sel.slot) {
                this.saveManager.clear(sel.slot);
                this.startMenuConfirmErase = null;
                this.audio.playCrack();
            } else {
                this.startMenuConfirmErase = sel.slot; // arm; a second DEL confirms
            }
        }
    }

    // Start a fresh run bound to a save file. Does NOT erase the file's stored data — it
    // only starts a new game; the slot is overwritten when you next save into it.
    newGame(slot) {
        this.activeSlot = slot;
        this.saveManager.markCameoSeen(); // reaching the menu counts as seeing the cameo
        this.resetToNewGame();
        this.state.gameState = 'PLAYING';
    }

    // Load a save file into a fresh run (Hub), binding it as the active file.
    loadSlot(slot) {
        const d = this.saveManager.load(slot);
        if (d && this.applySave(d)) {
            this.activeSlot = slot;
            this.saveManager.markCameoSeen();
            this.state.gameState = 'PLAYING';
            return true;
        }
        return false;
    }

    // Reset every run/world/progress field to a pristine "new worm in the Void" state,
    // WITHOUT touching localStorage (the file is only written when you save). Subsystems
    // (shopManager, narrative) hold this.state, so we reset its fields in place rather than
    // replacing the object.
    resetToNewGame() {
        const fresh = new StateManager();
        Object.assign(this.state.unlocked, fresh.unlocked);
        Object.assign(this.state.upgrades, fresh.upgrades);
        this.state.score = 0;
        this.state.biteTopicsHeard = 0;
        this.state.isSuspended = false;
        this.deathCode = '';

        // Fresh, unopened world.
        this.worldManager.rooms = {};
        this.worldManager.brokenWalls = new Set();
        this.worldManager.wallDamage = {};
        this.worldManager.scannerReveals = {};
        this.worldManager.currentRoomX = 0;
        this.worldManager.currentRoomY = 0;

        const cx = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
        const cy = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
        this.snake.reset(cx, cy, false);
        this.input.reset();
        this.gear = 0; this.speed = this.baseSpeed; this.moveTimer = 0; this.pendingUnfold = 0;
        this.carriedModule = null; this.moduleLoad = null; this.bursts = []; this.dataMotes = [];
        this.onUnpauseCallback = null; this._guided = new Set(); this._tick = 0;
        this._wallBonking = false; this._beaconTimer = 0; this._saveFlash = 0;

        // Back to the cold open: HUD hidden, terminal wiped (re-revealed at 5 Data).
        const top = document.getElementById('ui-layer');
        const bot = document.getElementById('ui-layer-bottom');
        if (top) top.classList.add('hidden');
        if (bot) bot.classList.add('hidden');
        this.narrative.reset();

        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        this.refreshScore();
    }

    // Short display summary written into a save file for the file-select screen: how far
    // you got + how many mods you own. (Score/length aren't restored, so we don't show them.)
    saveMeta() {
        const u = this.state.unlocked, up = this.state.upgrades;
        let place = 'The Void';
        if (u.borders) place = 'The Wilds';
        if (u.pauseMenu) place = 'The Firewall';
        if (u.biteDroppedOff) place = 'Localhost';
        if (u.cadenzaFound) place = 'Cadenza';
        if (u.cacheStage >= 3) place = 'Cold Storage';
        const mods = ['dataCompression', 'reinforcedSegments', 'pivot', 'scanner'].filter(k => up[k]).length
            + (up.crumpleLevel > 0 ? 1 : 0);
        return { place, mods };
    }

    // --- Save / Load (localStorage via SaveManager) -----------------------------------
    // We persist DURABLE progress only — unlocks, upgrades, the opened/damaged world,
    // gossip heard, the CACHE buffer. The ephemeral RUN (score, length, position) is NOT
    // saved: a load drops you back into the Hub with all that progress intact, a fresh
    // worm. (Score/length reset on death anyway, so this keeps them coupled.)
    serialize() {
        return {
            v: 1,
            unlocked: { ...this.state.unlocked },
            upgrades: { ...this.state.upgrades },
            biteTopicsHeard: this.state.biteTopicsHeard,
            deathCode: this.deathCode,
            carriedModule: this.carriedModule, // a picked-up-but-uninstalled module must survive a load
            world: {
                brokenWalls: [...this.worldManager.brokenWalls],
                wallDamage: { ...this.worldManager.wallDamage },
            },
            meta: this.saveMeta(), // display summary for the file-select screen
        };
    }

    applySave(d) {
        if (!d) return false;
        // Reset to fresh defaults BEFORE merging the save: a load is a fresh run, and a save
        // written before a progression flag existed omits that key — a bare merge would then
        // leave the live-true flag set, leaking post-save progress into the loaded run.
        const fresh = new StateManager();
        Object.assign(this.state.unlocked, fresh.unlocked, d.unlocked || {});
        Object.assign(this.state.upgrades, fresh.upgrades, d.upgrades || {});
        this.state.biteTopicsHeard = d.biteTopicsHeard || 0;
        this.deathCode = d.deathCode || '';
        if (d.world) {
            this.worldManager.brokenWalls = new Set(d.world.brokenWalls || []);
            this.worldManager.wallDamage = d.world.wallDamage || {};
        }
        // A load starts a fresh run in the Hub with the restored progress. Wipe cached
        // rooms so they regenerate from the restored flags, and clear the previous run's
        // Scanner reveals and Architect-guidance memory so their one-shots can replay.
        this.worldManager.rooms = {};
        this.worldManager.scannerReveals = {};
        this._guided = new Set();
        this.worldManager.currentRoomX = 0;
        this.worldManager.currentRoomY = 0;
        this.snake.reset(
            Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize,
            Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize,
            this.hasBiteSegment
        );
        this.input.reset();
        this.gear = 0; this.speed = this.baseSpeed; this.pendingUnfold = 0;
        this.carriedModule = d.carriedModule || null; // preserve an un-installed module (the map)
        this.moduleLoad = null; this.bursts = [];
        this.state.isSuspended = false; this.onUnpauseCallback = null; // never load INTO a Gate suspension
        this.state.score = 0;
        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        // Back-fill Cache's staged progression for saves written before this rework: a
        // save that already has the Save Function is at least stage 1 (grant done), and
        // its owner should get the title screen Cache "built" for them.
        if (this.state.unlocked.saveFunction && (this.state.unlocked.cacheStage || 0) < 1) {
            this.state.unlocked.cacheStage = 1;
            this.state.unlocked.startScreenUnlocked = true;
        }
        // Cache is dynamic (never saved into a room); re-place her apparition and, since a
        // load starts a fresh run in the Hub, seed her spare-data pile (seedMotes=true).
        this.refreshDynamicRoomContent(true);
        // If Denny's map was dropped but never obtained, wiping rooms would strand the
        // mapitem (dennyMapDropped one-shots the re-drop). When you don't actually have
        // the map, clear that flag so Denny can drop it again — no map soft-lock.
        if (this.state.unlocked.dennyMapDropped && this.carriedModule !== 'map' && !this.state.unlocked.mapModule) {
            this.state.unlocked.dennyMapDropped = false;
        }
        // A load is a fresh run: wipe the previous run's terminal logs / death counters.
        this.narrative.reset();
        // Re-reveal the HUD / arm the terminal if progress warrants it.
        if (this.state.unlocked.ui) {
            const top = document.getElementById('ui-layer');
            const bot = document.getElementById('ui-layer-bottom');
            if (top) top.classList.remove('hidden');
            if (bot) bot.classList.remove('hidden');
            this.narrative.online = true;
        }
        this.refreshScore();
        return true;
    }

    saveGame() {
        const ok = this.saveManager.save(this.activeSlot, this.serialize());
        this.flashSave(ok ? `SAVED - FILE ${this.activeSlot}` : 'SAVE FAILED');
    }

    loadGame() {
        const d = this.saveManager.load(this.activeSlot);
        if (d && this.applySave(d)) {
            this.state.gameState = 'PLAYING';
            this.flashSave(`LOADED - FILE ${this.activeSlot}`);
        } else {
            this.flashSave('NO SAVE');
        }
    }

    flashSave(msg) { this._saveFlashMsg = msg; this._saveFlash = 1400; }

    die(cause = 'unknown') {
        // NEW DEATH MODEL. With the Crumple Buffer upgrade you survive a hit (shed + fold
        // + bounce) instead of dying — but you need mass to shed. No buffer, or nothing
        // left to shed -> back to the beginning (full reset to the Hub).
        if (this.state.upgrades.crumpleLevel > 0 && this.snake.body.length > 1) {
            this.bounce();
            return;
        }

        const cx = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
        const cy = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;

        this.audio.playDeath(); // ONE death cue for every cause (border/self/obstacle/glitch)
        this.state.gameState = 'DEAD';
        this.snake.reset(cx, cy, this.hasBiteSegment);
        this.input.reset();
        this.state.resetScore();
        this.pendingUnfold = 0;     // a fresh run isn't mid-unfold
        this.gear = 0;              // fresh runs start from a standstill (sub-smash
        this.speed = this.baseSpeed; // deaths would otherwise respawn you mid-gear)
        this._wallBonking = false;

        // Save current room, then warp back to hub (0,0)
        let appleToSave = this.apple;
        if (appleToSave instanceof NPC) {
            // Player died before picking up Bite. Since score resets, replace Bite with a normal apple.
            appleToSave = this.spawnApple();
        }

        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite' && n.id !== 'cache');
        this.worldManager.saveRoom(appleToSave, this.glitches, npcsWithoutBite, this.obstacles);

        this.worldManager.currentRoomX = 0;
        this.worldManager.currentRoomY = 0;

        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];

        // Don't respawn on/next to durable Glitches that drifted into the hub (you can
        // farm apples here with biteProgress>0, and glitches persist) — that would
        // chain-death spawn-camp you. Clear any within 2 cells of the spawn point and
        // write the cleaned set back into the cached room so it stays clear.
        const g = this.gridSize;
        this.glitches = this.glitches.filter(gl =>
            Math.max(Math.abs(gl.x - cx) / g, Math.abs(gl.y - cy) / g) > 2
        );
        room.glitches = this.glitches;

        // If the player has met 2-Bit but hasn't hooked him onto the tail yet, he
        // lives as a grid NPC — but he's stripped from every saved room (above) so
        // he isn't baked into permanent state. Without re-placing him, dying at
        // this stage loses him forever and soft-locks his questline. Drop him back
        // into the hub the player respawns into.
        if (this.state.unlocked.biteProgress >= 1 && !this.state.unlocked.tailRider &&
            !this.npcs.find(n => n.id === 'bite')) {
            const pos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles, this.glitches, this.npcs, this.snake.body);
            this.npcs.push(new NPC(pos.x, pos.y, this.gridSize, 'bite', []));
        }

        // Cache re-materialises in the Hub you respawn into (until she's departed), and
        // seeds her spare-data pile if you've earned it (respawn -> seedMotes=true).
        this.refreshDynamicRoomContent(true);

        this.narrative.onDeath(cause);
    }
    
    checkUnlocks() {
        // Boot the narrative monitor as the UI reveals at 5 Data. Set BEFORE
        // onScoreUnlock so the score-5 message is the first thing it prints;
        // earlier beats (score 1, early deaths) stay silent while it's dark.
        if (this.state.score >= 5) this.narrative.online = true;

        this.narrative.onScoreUnlock(this.state.score, this.state.unlocked);

        if (this.state.score >= 5 && !this.state.unlocked.ui) {
            document.getElementById('ui-layer').classList.remove('hidden');
            document.getElementById('ui-layer-bottom').classList.remove('hidden');
            this.state.unlocked.ui = true;
        }
        
        if (this.state.score >= 10 && !this.state.unlocked.borders) {
            this.state.unlocked.borders = true;
            this.audio.playMaterialize(); // The system extrudes quarantine walls into being
        }

        // We removed the old upgrade panel, so no upgrades flag to check here

        this.refreshScore(); // sync the Data counter
    }

    // Sync the on-screen Data counter to state.score — but only once the HUD is
    // revealed (score >= 5). Centralized so every score mutation (apples, the glitch
    // drain, the dev cheat) updates the display the same way.
    refreshScore() {
        if (this.state.unlocked.ui) {
            const el = document.getElementById('score-value');
            if (el) el.innerText = this.state.score.toString();
        }
    }
    
    draw() {
        this.state.gear = this.gear;
        this.state.carriedModule = this.carriedModule;
        this.state.moduleSlotX = this.moduleSlotX;
        this.state.moduleSlotY = this.moduleSlotY;
        this.state.moduleLoad = this.moduleLoad;
        this.state.mapCell = this.carriedModule ? this.mapCell() : null;
        this.state.biteIndex = this.biteIndex; // which segment wears 2-Bit's face
        this.state.bursts = this.bursts;       // shed-segment particles for the Renderer
        this.state.dataMotes = this.dataMotes; // Cache's spare-data pile in the Hub
        this.state.deathCode = this.deathCode; // the CACHE puzzle buffer, shown on the death screen
        this.state.saveFlash = this._saveFlash > 0 ? this._saveFlashMsg : null; // SAVED/LOADED toast
        this.state.activeSlot = this.activeSlot;
        // File-select menu payload for the Renderer — only when a save file exists (else the
        // START screen is the bare cold-open void).
        if (this.state.gameState === 'START' && this.saveManager.anySave()) {
            this.state.startMenu = { slots: this.saveManager.slots(), index: this.startMenuIndex, confirmErase: this.startMenuConfirmErase };
        } else {
            this.state.startMenu = null;
        }
        // Directional data for the Renderer's Cadenza wall-pulse (the visible half of
        // her beacon). Null unless her homing signal is live.
        const cp = this.cadenzaProximity();
        this.state.cadenzaBeacon = cp > 0 ? {
            proximity: cp,
            dx: Math.sign(this.cadenzaRoom.x - this.worldManager.currentRoomX),
            dy: Math.sign(this.cadenzaRoom.y - this.worldManager.currentRoomY),
        } : null;
        this.renderer.draw(this.state, this.snake, this.apple, this.npcs, this.glitches, this.worldManager, this.obstacles);
    }
    
    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this._saveFlash > 0) this._saveFlash = Math.max(0, this._saveFlash - dt); // fade the toast

        this.update(dt);
        this.draw();

        requestAnimationFrame((ts) => this.loop(ts));
    }

    start() {
        // No auto-load: the boot screen presents a file-select menu (New Game / Load) when
        // any save file exists; a brand-new player gets the bare "press any key" cold open.
        // Default the cursor to the first occupied file so ENTER continues your progress.
        const slots = this.saveManager.slots();
        const firstFilled = slots.findIndex(s => s.exists);
        this.startMenuIndex = firstFilled >= 0 ? firstFilled : 0;
        this.maybeStartTitleCameo();
        this.lastTime = performance.now();
        requestAnimationFrame((ts) => this.loop(ts));
    }

    // The first time the file-select menu is shown, Cache's title cameo plays in the SAME
    // dialog window as Act 1 (over the menu), dismissed with SPACE. One-time (global flag).
    maybeStartTitleCameo() {
        if (!this.saveManager.anySave() || this.saveManager.hasCameoSeen()) return;
        this.startCameoActive = true;
        this.dialogManager.start([
            "Cache: Best I could do on such short notice. Don't look at me like that.",
            "Cache: It's called 0r0b0r0u5. A placeholder, obviously — it'll have to be replaced.",
            "Cache: You can't even touch your own tail, let alone EAT it. So the name's a bit of a joke, I guess."
        ], () => {
            this.startCameoActive = false;
            this.saveManager.markCameoSeen();
        });
    }
}
