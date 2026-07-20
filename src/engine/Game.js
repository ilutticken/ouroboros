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
import { TWO_BIT, GATE, DENNY, CACHE, ARCHITECT, CADENZA_ENCORE, LOST_VERSE, CADENZA_TITLE } from '../content/dialogue.js';

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
        // The Options overlay (accessibility) key handler is registered FIRST — before
        // ShopManager and every other window keydown listener — so, while open, it is truly
        // modal (stopImmediatePropagation blocks the rest) and 'O' reaches it in ANY state,
        // INCLUDING the SHOP overlay (whose own listener otherwise swallows every key).
        // optionsOpen/index/settings are initialised further down, before any key can fire.
        window.addEventListener('keydown', (e) => {
            if (e.key === 'o' || e.key === 'O') { this.toggleOptions(); e.stopImmediatePropagation(); return; }
            if (!this.optionsOpen) return;
            this.optionsHandleKey(e.key);
            e.stopImmediatePropagation();
        });
        this.encore = null; // Cadenza's DA CAPO Encore state object — non-null only while performing
        // ENCORE (Cadenza's music puzzle) modal key: ESC leaves the performance back to normal
        // play (go grow / find her lost verse, then return). Arrows fall through to InputHandler
        // for steering; gear taps are already gated to PLAYING, so the tempo stays locked.
        window.addEventListener('keydown', (e) => {
            if (this.state.gameState !== 'ENCORE') return;
            if (e.key === 'Escape') { this.exitEncore('left'); e.stopImmediatePropagation(); }
        });
        this.shopManager = new ShopManager(this.state, this.audio);
        this.shopManager.onSpend = (price) => this.spendData(price); // Data = segments: buying shrinks you
        this.worldManager = new WorldManager(canvas, this.gridSize);
        this.saveManager = new SaveManager();
        this._saveFlash = 0; // ms remaining on a "SAVED"/"LOADED" pause-menu toast
        this._saveFlashMsg = '';
        this.activeSlot = 1;               // which of the 3 save FILES the current run reads/writes
        this.startMenuIndex = 0;           // highlighted file on the boot file-select menu
        this.startMenuConfirmErase = null; // slot armed for erase (a second DEL confirms)
        this.startCameoActive = false;     // Cache's one-time title cameo (a dialog over the menu)
        this.titleCameo = null;            // scripted walk-on/fade sprite state during that cameo

        // Accessibility / player settings (volume, mute, reduce-motion) + the Options overlay.
        // reduceMotion defaults to the OS 'prefers-reduced-motion'; a saved value overrides it.
        this.optionsOpen = false;
        this.optionsIndex = 0;
        const prefersReduce = (typeof window !== 'undefined' && window.matchMedia
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || false;
        this.settings = Object.assign(
            { volume: 0.4, muted: false, reduceMotion: prefersReduce },
            this.saveManager.loadSettings() || {}
        );
        this.applySettings();

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
                this.growSnake(10); // Data = segments: the cheat grows you too
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
            this.maybeStartVoidAmbient(); // Cadenza's title piece loops once the Encore's done
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
        this.biteTopics = TWO_BIT.gossip;

        // NPC-interaction registry: maps an NPC's id to the handler run when the head bumps
        // it (see handleNpcCollisions). Adding a character is a line here + its handler,
        // instead of another branch in the move-tick. Every handler is length-neutral
        // (talking never docks mass); the collision loop resolves one bump then stops.
        this.npcHandlers = {
            bite: (npc) => this.npcBite(npc),
            gate: (npc) => this.npcGate(npc),
            denny: (npc) => this.npcDenny(npc),
            mapitem: (npc) => this.npcMapItem(npc),
            cache: (npc) => { this.state.gameState = 'DIALOG'; this.talkToCache(npc); },
            cachehome: (npc) => { this.state.gameState = 'DIALOG'; this.talkToCacheHome(npc); },
            signpost: (npc) => this.npcSign(npc),
            citizen: (npc) => this.npcSign(npc),
            cadenza: (npc) => this.npcCadenza(npc),
            shop: () => this.openBiteShop(),
        };
        
        // Initialize Input
        this.input.init(this.gridSize, () => {
            this.audio.init();
            if (this.state.unlocked.musicLayer >= 1) this.audio.startMusicLayer1(); // resume the Locked Groove after a load
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
        }, () => (this.state.gameState === 'PLAYING' || this.state.gameState === 'ENCORE') && !this.moduleLoad);
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
            return new NPC(x, y, this.gridSize, 'bite', TWO_BIT.spawnIntro);
        }

        // Randomly spawn a glitch once corruption exists — but NEVER inside a Safe Zone
        // (Localhost is hazard-free by contract; the town's own signpost promises it).
        const inSafeZone = this.worldManager.isSafeZone(this.worldManager.currentRoomX, this.worldManager.currentRoomY);
        if (this.state.unlocked.biteProgress > 0 && !inSafeZone && Math.random() < 0.2) {
            if (!this.state.unlocked.glitchesTelegraphed) {
                this.narrative.printMessage(ARCHITECT.seedGlitches);
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
        this.dialogManager.start(TWO_BIT.dropOff, () => { this.state.gameState = 'PLAYING'; });
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
                this.narrative.printMessage(GATE.breachIntercept);
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
        const lines = ARCHITECT.guide;
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
            this.dialogManager.start(TWO_BIT.moduleInstalled, () => { this.state.gameState = 'PLAYING'; });
        }
    }

    // Head trying to cross the room boundary (borders on, new head off-screen). Resolves the
    // 2-Bit-not-dropped tug-back, walking a smashed-open doorway, the wall-smash mechanic
    // (bonk / sub-smash death / max-gear breach), or a lethal solid wall. Returns:
    //   { stop: true }                    -> the move-tick must return (blocked / died)
    //   { stop: false, shifted, dx, dy }  -> proceed (shifted=true means a room change happened)
    crossBorder(newHeadX, newHeadY) {
        // 2-Bit isn't dropped off yet -> he tugs you back; nothing dies.
        if (this.state.unlocked.tailRider && this.npcs.find(n => n.id === 'bite')) {
            const complaints = TWO_BIT.leaveComplaints;
            this.narrative.printMessage(complaints[Math.floor(Math.random() * complaints.length)]);
            this.audio.playDenied();
            this.input.direction.x *= -1;
            this.input.direction.y *= -1;
            this.input.nextDirection = { ...this.input.direction };
            this.gear = -1; // lose all momentum
            return { stop: true };
        }

        let dx = 0, dy = 0, directionStr = '';
        if (newHeadX < 0) { directionStr = 'left'; dx = -1; }
        else if (newHeadX >= this.canvas.width) { directionStr = 'right'; dx = 1; }
        else if (newHeadY < 0) { directionStr = 'up'; dy = -1; }
        else if (newHeadY >= this.canvas.height) { directionStr = 'down'; dy = 1; }

        const rx = this.worldManager.currentRoomX;
        const ry = this.worldManager.currentRoomY;
        const inHub = (rx === 0 && ry === 0);
        const isBroken = this.worldManager.isWallBroken(rx, ry, directionStr);
        // Weak points vary per wall in both existence AND position; solid walls have none
        // (and getWeakPoint seals the Hub itself).
        const wp = this.worldManager.getWeakPoint(rx, ry, directionStr);
        const horizontalWall = (directionStr === 'up' || directionStr === 'down');
        const cross = horizontalWall ? newHeadX : newHeadY;
        const isWeakPoint = !!wp && cross >= wp.start && cross <= wp.end;

        if (isBroken && isWeakPoint) {
            // Walk through the smashed-open doorway — only at the central gap; the solid wall
            // either side of it stays lethal.
            this.shiftScreen(dx, dy);
            return { stop: false, shifted: true, dx, dy };
        }
        if (isWeakPoint) {
            // Smash mechanic: base speed does nothing (non-lethal bonk); sub-max cracks the wall
            // but the impact RESTARTS you (keeping some crack); ONLY a max-gear (gear 3) hit
            // breaches cleanly.
            const dmg = Math.max(0, Math.min(3, this.gear));
            if (dmg <= 0) {
                if (!this._wallBonking) this.audio.playDenied();
                this._wallBonking = true;
                this.gear = 0;
                this.speed = this.baseSpeed;
                return { stop: true }; // do not move
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
                return { stop: false, shifted: true, dx, dy };
            }
            // SUB-SMASH: crack it (capped below the break point) — but the impact destroys you.
            // The Architect, gloating in his log, reveals that max speed is the trick.
            this.worldManager.damageWall(rx, ry, directionStr, dmg, this.worldManager.wallBreakThreshold - 1);
            this.audio.playCrack();
            this.narrative.onSubSmash(inHub, this.state.unlocked);
            this.die('border');
            return { stop: true };
        }
        // Solid wall (non-weak-point, or a sealed Hub wall): lethal.
        this.die('border');
        return { stop: true };
    }

    // Apple / spare-data-mote collection + tail handling for this move. Returns true if it
    // opened a dialog (2-Bit's first-encounter apple) — the move-tick should stop this frame.
    collectData() {
        let grew = false;

        // The Lost Verse — a Wilds pickup that heals Cadenza's dead note. Collected like Data:
        // returning true here skips the tail-pop, so it ADDS TO YOUR TAIL (grows you), and it
        // grants Data too, then opens its dialog. Handled before NPC bumps so it never blocks.
        const lv = this.npcs && this.npcs.find(n => n.id === 'lostverse'
            && this.snake.head.x === n.x && this.snake.head.y === n.y);
        if (lv) {
            this.npcs = this.npcs.filter(n => n !== lv);
            const gain = this.state.upgrades.dataCompression ? 2 : 1;
            this.state.addScore(gain);
            if (gain > 1) this.growSnake(gain - 1); // Data = segments (the pickup already gave +1)
            this.state.unlocked.lostVerseFound = true;
            this.audio.playCadenzaSong(1); // a shard of her fanfare
            this.checkUnlocks();
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(LOST_VERSE, () => { this.state.gameState = 'PLAYING'; });
            return true; // grew (no tail-pop) + opened a dialog -> stop the tick
        }

        if (this.apple instanceof NPC) {
            if (this.snake.checkAppleCollision(this.apple)) {
                this.state.gameState = 'DIALOG';
                this.dialogManager.start(this.apple.dialog, () => {
                    if (this.state.unlocked.biteProgress === 0) {
                        this.state.unlocked.biteProgress = 1;
                        this.state.gameState = 'PLAYING';
                        // Bite stays a grid NPC; the DEAL happens when you bump him (npcBite).
                        this.npcs.push(new NPC(this.apple.x, this.apple.y, this.gridSize, 'bite', []));
                    }
                    this.apple = this.spawnApple();
                });
                return true;
            }
        } else if (this.snake.checkAppleCollision(this.apple)) {
            this.snake.grow(); // growth = not shrinking this tick
            const gain = this.state.upgrades.dataCompression ? 2 : 1;
            this.state.addScore(gain);
            if (gain > 1) this.growSnake(gain - 1); // Data = segments (the eat already gave +1)
            this.audio.playBeep();
            this.apple = this.spawnApple();
            this.checkUnlocks();
            grew = true;
        }

        // Cache's spare-data motes (Hub only): each is Data — grows + scores like an apple,
        // it just doesn't respawn when eaten.
        if (this.dataMotes && this.dataMotes.length) {
            const mi = this.dataMotes.findIndex(m => this.snake.head.x === m.x && this.snake.head.y === m.y);
            if (mi !== -1) {
                this.dataMotes.splice(mi, 1);
                this.snake.grow();
                const gain = this.state.upgrades.dataCompression ? 2 : 1;
                this.state.addScore(gain);
                if (gain > 1) this.growSnake(gain - 1); // Data = segments (the eat already gave +1)
                this.audio.playBeep();
                this.checkUnlocks();
                grew = true;
            }
        }

        // No Data eaten -> normal tail handling (shrink, or extrude a folded block while
        // un-folding after a bounce).
        if (!grew) this.shrinkOrUnfold();
        return false;
    }

    // Corruption (Glitch) collision: drains segments + Data, or kills you if it drains you to
    // nothing. Returns true if it killed you (the move-tick must return).
    hitGlitch() {
        for (let i = 0; i < this.glitches.length; i++) {
            const g = this.glitches[i];
            if (this.snake.head.x === g.x && this.snake.head.y === g.y) {
                const damage = this.state.upgrades.reinforcedSegments ? 1 : 3;
                for (let d = 0; d < damage; d++) {
                    if (this.snake.body.length > 1) {
                        this.snake.shrink(this.hasBiteSegment); // never eat 2-Bit's protected segment
                    } else {
                        // Drained to nothing: consume the killer FIRST so die()'s saveRoom
                        // doesn't bake it into the cell to camp respawns.
                        this.glitches.splice(i, 1);
                        this.die();
                        return true;
                    }
                }
                this.state.score = Math.max(0, this.state.score - damage);
                this.refreshScore();  // HUD must reflect the drain now, not at the next apple
                this.changeGear(0);   // re-clamp gear to the lowered score's cap (no ghost max speed)
                this.audio.playCorruptHit(); // corruption bites in — not a death
                this.glitches.splice(i, 1);
                break;
            }
        }
        return false;
    }

    update(dt) {
        this.updateBursts(dt); // shed-segment particles animate in every state
        this.updateCacheFade(dt); // Cache materialises / dissolves independent of sim state
        this.updateTitleCameo(dt); // Cache's scripted title-screen walk-on / fade sequence

        if (this.optionsOpen) return; // the Options overlay freezes the sim while open

        if (this.state.gameState === 'DIALOG' || this.state.gameState === 'SHOP' || this.state.gameState === 'PAUSED' || this.state.gameState === 'TRANSITION') return;

        // Cadenza's DA CAPO Encore runs its own constrained move-tick (no room-crossing, no
        // hazards, no growth) — quantized to the same move clock as the rest of the world.
        if (this.state.gameState === 'ENCORE') { this.updateEncore(dt); return; }

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

            this.input.updateDirection();

            if (this.input.direction.x !== 0 || this.input.direction.y !== 0) {
                
                let shifted = false;
                let dx = 0, dy = 0;
                const newHeadX = this.snake.head.x + this.input.direction.x;
                const newHeadY = this.snake.head.y + this.input.direction.y;
                
                if (this.state.unlocked.borders
                    && (newHeadX < 0 || newHeadX >= this.canvas.width || newHeadY < 0 || newHeadY >= this.canvas.height)) {
                    // Crossing a room boundary: tug-back / doorway / wall-smash / lethal wall.
                    const r = this.crossBorder(newHeadX, newHeadY);
                    if (r.stop) return;
                    shifted = r.shifted; dx = r.dx; dy = r.dy;
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

                if (this.collectData()) return; // apple / spare-data motes + tail handling
                
                if (this.hitGlitch()) return; // corruption drain (may kill)
                
                // Persistent NPC collisions — dispatched via the per-character registry
                // (this.npcHandlers / handleNpcCollisions). A bump resolves and stops the
                // tick; talking is length-neutral, so nothing shrinks again here.
                if (this.handleNpcCollisions()) return;

                if (this.snake.checkSelfCollision()) { this.die('self'); return; }
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

    // Data = segments. Gaining Data grows your body; spending/losing it shrinks you. These
    // couple the two counters so any change to one changes the other. (The head and 2-Bit's
    // ridden segment are NOT Data — they're you and him — so they're never counted here.)
    growSnake(n = 1) {
        for (let i = 0; i < n; i++) {
            const tail = this.snake.body[this.snake.body.length - 1] || this.snake.head;
            this.snake.body.push({ ...tail });
        }
    }
    // Spend n Data by shedding n segments off the tail (they burst off — the mass spent on
    // the upgrade). Never sheds below the min length / 2-Bit's protected segment.
    spendData(n) {
        const shed = [];
        const floor = this.hasBiteSegment ? 2 : 1;
        for (let i = 0; i < n && this.snake.body.length > floor; i++) {
            shed.push({ ...this.snake.body[this.snake.body.length - 1] });
            this.snake.shrink(this.hasBiteSegment);
        }
        if (shed.length) this.spawnBurst(shed);
        this.changeGear(0); // re-clamp gear to the lowered Data cap (no ghost max speed)
        this.refreshScore();
    }

    // Record one "continue" key on the death screen into the rolling last-5 buffer, and
    // summon Cache if it now spells her name. (Named keys — Space/arrows — record as '·'
    // so they can't spell it.)
    recordDeathKey(key) {
        const ch = key.length === 1 ? key.toUpperCase() : '·';
        this.deathCode = (this.deathCode + ch).slice(-5);
        if (this.deathCode === 'CACHE') this.summonCache();
    }

    // Spelling CACHE across death screens summons the archivist. She coalesces in the
    // Hub you always respawn into (a real death always warps you there). She is tied to
    // the CODE, not a permanent latch: she is present only while deathCode still reads
    // CACHE (see refreshDynamicRoomContent) and vanishes once the next death shifts the
    // window — re-spell CACHE (or visit Cold Storage {5,-4}) to see her again.
    summonCache() {
        if (this.state.unlocked.cacheStage >= 3) return; // she's said her piece; never again
        const already = this.npcs.some(n => n.id === 'cache');
        this.state.unlocked.cacheFound = true; // mark discovered (clue-gating / records)
        this.spawnCacheNpc();
        if (!already) this.audio.playMaterialize(); // she coalesces out of the noise
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

    // Resolve a head-on-NPC bump via the registry (this.npcHandlers). Returns true if a
    // (non-leaving) NPC occupied the head cell — the move-tick stops there this frame.
    handleNpcCollisions() {
        for (const npc of this.npcs) {
            if (this.snake.head.x === npc.x && this.snake.head.y === npc.y) {
                if (npc.leaving) continue; // a fleeing NPC is non-interactive
                const handler = this.npcHandlers[npc.id];
                if (handler) handler(npc);
                return true;
            }
        }
        return false;
    }

    // --- NPC bump handlers (registered in this.npcHandlers) -----------------------------

    // 2-Bit on the grid: re-attach him instantly once he's your tail-rider, otherwise run
    // the offer/tutorial progression (finishing the offer dialog with SPACE IS agreeing).
    npcBite(npc) {
        if (this.state.unlocked.tailRider) {
            this.npcs = this.npcs.filter(n => n.id !== 'bite'); // instantly pick him back up
            this.snake.body.push({ x: npc.x, y: npc.y });
            this.audio.playBeep();
        } else if (this.state.unlocked.biteProgress === 1) {
            if (this.state.score < 30) {
                this.state.gameState = 'DIALOG';
                this.dialogManager.start(TWO_BIT.needMoreMass, () => { this.state.gameState = 'PLAYING'; });
            } else {
                this.state.gameState = 'DIALOG';
                this.dialogManager.start(TWO_BIT.offer, () => {
                    // THE GAG: the only way through a dialog is SPACE, so FINISHING this one
                    // is complying. No separate confirm.
                    this.state.unlocked.biteProgress = 3;
                    this.state.unlocked.tailRider = true;
                    this.npcs = this.npcs.filter(n => n.id !== 'bite');
                    this.snake.body.push({ x: npc.x, y: npc.y });
                    this.state.gameState = 'DIALOG';
                    this.dialogManager.start(TWO_BIT.tutorial, () => { this.state.gameState = 'PLAYING'; });
                });
            }
        }
    }

    // Gate: a context line (how you passed Denny) prepended to his intro, then the Thread
    // Suspension cutscene — 2-Bit grants the Pause Menu, you break the hold, and Gate flees,
    // smashing the east doorway open on his way out.
    npcGate(npc) {
        this.state.gameState = 'DIALOG';
        let gateLines = npc.dialog;
        const gotMap = this.carriedModule === 'map' || this.state.unlocked.mapModule;
        if (gotMap) {
            gateLines = [GATE.contextGotMap, ...npc.dialog];
        } else if (this.state.unlocked.dennyMet) {
            gateLines = [GATE.contextDennyMet, ...npc.dialog];
        } else if (this.state.unlocked.dennySlipped) {
            gateLines = [GATE.contextDennySlipped, ...npc.dialog];
        }
        this.dialogManager.start(gateLines, () => {
            this.state.isSuspended = true; // Thread Suspension
            this.dialogManager.start(TWO_BIT.gateRescue, () => {
                this.state.unlocked.pauseMenu = true;
                this.state.gameState = 'PAUSED';
                this.onUnpauseCallback = () => {
                    this.state.isSuspended = false;
                    this.state.gameState = 'DIALOG';
                    this.dialogManager.start(GATE.override, () => {
                        this.state.gameState = 'PLAYING';
                        // Gate flees on-screen to the right doorway, smashes it, and exits.
                        const gate = this.npcs.find(n => n.id === 'gate');
                        if (gate) {
                            gate.leaving = true;
                            gate.exitDir = 'right';
                            // Grid-align the exit cell (canvas size need not be a multiple of
                            // gridSize) and aim for the real weak point so the breach he opens
                            // is the one you can follow through.
                            gate.exitX = Math.floor((this.canvas.width - 1) / this.gridSize) * this.gridSize;
                            const rwp = this.worldManager.getWeakPoint(this.worldManager.currentRoomX, this.worldManager.currentRoomY, 'right');
                            gate.exitY = rwp ? rwp.start + 2 * this.gridSize : Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
                        }
                    });
                };
            });
        });
    }

    // Denny: apologetic, non-blocking. First meet drops his Sector Map beside him (2-Bit
    // chimes in); after that he just waves you through.
    npcDenny(npc) {
        this.state.gameState = 'DIALOG';
        this.state.unlocked.dennyMet = true;
        const firstMeet = !npc.met;
        npc.met = true;
        const lines = firstMeet ? npc.dialog : DENNY.whisper;
        const dropMap = firstMeet && !this.state.unlocked.dennyMapDropped && !this.state.unlocked.mapModule;
        this.dialogManager.start(lines, () => {
            this.state.gameState = 'PLAYING';
            if (dropMap) {
                this.state.unlocked.dennyMapDropped = true;
                // Keep the drop ON-screen: if Denny tracked to the bottom row, npc.y + g
                // would be off-canvas — invisible/unreachable — stranding the whole map chain.
                let mapY = npc.y + this.gridSize;
                if (mapY >= this.canvas.height) mapY = npc.y - this.gridSize;
                this.npcs.push(new NPC(npc.x, Math.max(0, mapY), this.gridSize, 'mapitem', []));
                this.state.gameState = 'DIALOG';
                this.dialogManager.start(TWO_BIT.dennyMapChime, () => { this.state.gameState = 'PLAYING'; });
            }
        });
    }

    // Pick up Denny's map: it rides your tail as a Module (unlocks the Module Slot).
    npcMapItem(npc) {
        this.npcs = this.npcs.filter(n => n.id !== 'mapitem');
        this.carriedModule = 'map';
        this.state.unlocked.moduleSlot = true;
        this.audio.playBeep();
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(TWO_BIT.mapPickup, () => { this.state.gameState = 'PLAYING'; });
    }

    // Localhost welcome sign / townsfolk / Cadenza: read their lines and move on, no cost.
    npcSign(npc) {
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(npc.dialog, () => { this.state.gameState = 'PLAYING'; });
    }

    // --- Cadenza's DA CAPO Encore (the music puzzle) -------------------------------------
    // Bump Cadenza to begin. She sings; you trace a ring of 8 nodes, striking each light IN
    // ORDER with your head (each a tuned square-wave note) while your BODY stays draped over
    // the ones you've struck so the chord sustains. Hold all eight ringing at once and she
    // seals it into Music Layer 1. One node is a "dead note" that can't sound until you bring
    // her the Lost Verse from out in the Wilds — so the finale is gated on a real find.

    npcCadenza(npc) {
        if (this.state.unlocked.encoreComplete) { this.npcSign(npc); return; } // show's over; she holds court
        const intro = this.state.unlocked.lostVerseFound ? CADENZA_ENCORE.intro : CADENZA_ENCORE.introHole;
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(intro, () => this.startEncore());
    }

    // Lay out the 8-node ring (a rectangle centred in the room) and enter ENCORE. The ring
    // size (hw x hh cells) sets the emergent length gate: your body must drape the whole
    // perimeter to hold the full chord — a longer worm can, a short one can't (no length
    // check anywhere). Node index 5 (bottom-centre) is the dead note.
    startEncore() {
        // She begins to sing — the corruption can't hold a note in here. Any Glitches in her
        // room dissolve (a little shimmer) so the stage is clean for the performance.
        if (this.glitches && this.glitches.length) {
            this.spawnBurst(this.glitches);
            this.glitches = [];
        }
        const g = this.gridSize;
        const cols = Math.floor(this.canvas.width / g), rows = Math.floor(this.canvas.height / g);
        const ccx = Math.floor(cols / 2), ccy = Math.floor(rows / 2);
        const hw = Math.max(2, Math.min(6, ccx - 1));
        const hh = Math.max(2, Math.min(4, ccy - 1));
        const cells = [
            [ccx - hw, ccy - hh], [ccx, ccy - hh], [ccx + hw, ccy - hh], // top edge:  0,1,2
            [ccx + hw, ccy],                                             // right:      3
            [ccx + hw, ccy + hh], [ccx, ccy + hh], [ccx - hw, ccy + hh], // bottom:     4,5(dead),6
            [ccx - hw, ccy],                                             // left:       7
        ];
        const DEAD = 5;
        const nodes = cells.map(([cx, cy], i) => ({ index: i, x: cx * g, y: cy * g, dead: i === DEAD, sounding: false }));
        this._encorePrevSpeed = this.speed;
        this.speed = 110;   // a steady tempo; gear is locked out during the performance
        this.moveTimer = 0;
        this.encore = { nodes, nextIndex: 0, eaten: {}, phase: 1, crackFlash: 0, msg: '' };
        this.state.gameState = 'ENCORE';
    }

    // ENCORE move-tick: steer the head one cell per beat, clamped to the room (walls soft-
    // block — never kill, never cross). Length-neutral (no growth). Then resolve the nodes.
    updateEncore(dt) {
        if (!this.encore) { this.state.gameState = 'PLAYING'; return; }
        if (this.encore.crackFlash > 0) this.encore.crackFlash = Math.max(0, this.encore.crackFlash - dt);
        this.moveTimer += dt;
        if (this.moveTimer < this.speed) return;
        this.moveTimer = 0;
        this._tick++;
        this.input.updateDirection();
        const d = this.input.direction;
        if (d.x === 0 && d.y === 0) return;
        const nx = this.snake.head.x + d.x, ny = this.snake.head.y + d.y;
        if (nx < 0 || nx >= this.canvas.width || ny < 0 || ny >= this.canvas.height) return; // wall: hold position
        this.snake.move(d, this.canvas.width, this.canvas.height, false);
        this.shrinkOrUnfold(); // pop the tail — a performance never grows you
        this._encoreProcess();
    }

    // Resolve the ring after a step: which nodes are sounding (a body segment covers them),
    // did the head strike the next note (or break the take), did the chord finally hold.
    _encoreProcess() {
        const e = this.encore;
        if (!e) return;
        const verse = !!this.state.unlocked.lostVerseFound;
        const covers = (n) => this.snake.body.some(s => s.x === n.x && s.y === n.y);
        for (const n of e.nodes) n.sounding = !!e.eaten[n.index] && covers(n);

        const head = this.snake.head;
        const hn = e.nodes.find(n => n.x === head.x && n.y === head.y);
        if (hn) {
            if (hn.index === e.nextIndex) {
                if (hn.dead && !verse) { this.exitEncore('needverse'); return; } // the hole in the song
                e.eaten[hn.index] = true;
                hn.sounding = true; // the head is on it
                this.audio.playEncoreNote(hn.index);
                e.nextIndex++;
                if (e.nextIndex === 3) e.phase = 2;
                else if (e.nextIndex === 5) e.phase = 3;
                if (e.nextIndex >= e.nodes.length) {
                    // the take completes only if the WHOLE chord is still ringing at once
                    if (e.nodes.every(n => n.sounding)) { this._encoreFinale(); return; }
                    this._encoreCrack('sustain'); return;
                }
            } else if (hn.index > e.nextIndex) {
                this._encoreCrack('order'); return; // struck a note out of turn
            }
            // hn.index < nextIndex: re-touching an already-sung note — harmless
        }
        // Dropped sustain: any note you've already sung has fallen silent (body slid off it).
        for (const n of e.nodes) {
            if (e.eaten[n.index] && !n.sounding) { this._encoreCrack('sustain'); return; }
        }
    }

    // A broken take — non-lethal. Reset the sequence; she re-sings from the top (da capo).
    _encoreCrack(reason) {
        const e = this.encore;
        e.nextIndex = 0;
        e.eaten = {};
        for (const n of e.nodes) n.sounding = false;
        e.crackFlash = 500;
        e.phase = 1;
        e.msg = reason === 'sustain' ? 'THE CHORD DROPPED — DA CAPO' : 'OUT OF ORDER — DA CAPO';
        this.audio.playCrack();
    }

    // The whole chord held at once: Cadenza seals the Locked Groove — Music Layer 1 is live.
    _encoreFinale() {
        this.encore = null;
        this.speed = this._encorePrevSpeed || 100;
        this.state.unlocked.encoreComplete = true;
        this.state.unlocked.cadenzaFound = true;
        this.saveManager.markEncoreUnlocked(); // global: unlocks her title-screen cameo + the Void Ambient
        if ((this.state.unlocked.musicLayer || 0) < 1) this.state.unlocked.musicLayer = 1;
        this.audio.startMusicLayer1();
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(CADENZA_ENCORE.success, () => { this.state.gameState = 'PLAYING'; });
    }

    // Leave the performance without finishing: 'needverse' points you to the Wilds; 'left'
    // (ESC) just drops back to play so you can grow a longer body and return.
    exitEncore(reason) {
        this.encore = null;
        this.speed = this._encorePrevSpeed || 100;
        if (reason === 'needverse') {
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(CADENZA_ENCORE.needVerse, () => { this.state.gameState = 'PLAYING'; });
        } else {
            this.state.gameState = 'PLAYING';
        }
    }

    // Snapshot for the Renderer's encore overlay (nodes + progress + a broken-take flash).
    getEncoreRenderState() {
        const e = this.encore;
        return {
            nodes: e.nodes.map(n => ({ x: n.x, y: n.y, index: n.index, dead: n.dead, sounding: n.sounding, eaten: !!e.eaten[n.index] })),
            nextIndex: e.nextIndex,
            total: e.nodes.length,
            phase: e.phase,
            crackFlash: e.crackFlash,
            msg: e.msg,
            verse: !!this.state.unlocked.lostVerseFound,
        };
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
            this.dialogManager.start(CACHE.brushOffNoPause, done());
            return;
        }

        if (u.cacheStage === 0) {
            // FIRST help: grant the Save Function (and she "builds" the title screen).
            u.cacheStage = 1;
            u.saveFunction = true;
            u.startScreenUnlocked = true;
            this.dialogManager.start(CACHE.grant, done());
        } else if (u.cacheStage === 1) {
            // SECOND call: the spare-data gift. From now on the Hub seeds Data on respawn.
            // spareDataUnlocked is its OWN flag (not cacheStage>=2) so retiring the questline
            // elsewhere — e.g. meeting her at Cold Storage — can't silently switch it on.
            u.cacheStage = 2;
            u.spareDataUnlocked = true;
            this.dialogManager.start(CACHE.spareData, done(() => this.seedHubData())); // drop the first pile now; later piles come on respawn
        } else if (u.cacheStage === 2) {
            // THIRD call: directions. Her sector goes on your map; she leaves the Hub. The
            // map marker only draws once the Topology Map is installed, so DON'T promise
            // "it's on your map" if you don't have one — lean on the verbal directions (which
            // both variants also give, so the sector is findable regardless).
            u.cacheStage = 3;
            const d = CACHE.directions;
            // Only promise "it's on your map" if you actually have the Topology Map installed;
            // both variants also give verbal directions (d.location), so it's findable regardless.
            const directionsLine = this.state.unlocked.mapModule ? d.withMap : d.noMap;
            this.dialogManager.start([d.intro, directionsLine, d.location, d.outro], done());
        } else {
            // stage >= 3: she no longer manifests here — defensive echo only.
            this.dialogManager.start(CACHE.defensiveEcho, done());
        }
    }

    // Cache at home in Cold Storage — reachable via her map marker OR by wandering north
    // before ever doing the Hub CACHE puzzle. Meeting her here retires the Hub apparition
    // (cacheStage 3) and, if you never got the Save Function, she installs it now (given a
    // Pause Menu to file it into). Coherent regardless of the puzzle. New lines are DRAFTS.
    talkToCacheHome(npc) {
        const u = this.state.unlocked;
        let lines;
        if (u.saveFunction) {
            // Already saved-enabled (Hub grant or a prior visit): a calmer at-home chat.
            u.cacheFound = true;
            if (u.cacheStage < 3) u.cacheStage = 3;
            lines = CACHE.home.haveSave;
        } else if (u.pauseMenu) {
            // Reached her without ever getting Save (skipped/never solved the Hub puzzle) —
            // she installs it right here. This also settles her whole questline (stage 3).
            u.saveFunction = true;
            u.startScreenUnlocked = true;
            u.cacheFound = true;
            u.cacheStage = 3;
            lines = CACHE.home.install;
        } else {
            // No Pause Menu -> nowhere to file a Save. Turn you away, change NOTHING (the
            // Hub puzzle stays intact); come back with a Diagnostic Module.
            lines = CACHE.home.brushOff;
        }
        this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
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
        if (inHub && this.deathCode === 'CACHE' && this.state.unlocked.cacheStage < 3) {
            this.spawnCacheNpc();
        }
        this.dataMotes = [];
        if (inHub && seedMotes && this.state.unlocked.spareDataUnlocked) this.seedHubData();
    }

    // --- Boot file-select menu (New Game / Load across 3 save files) -------------------

    // --- Accessibility / Options overlay ------------------------------------------------

    // Apply the audio settings (mute wins over volume). Reduce-motion is read by the Renderer.
    applySettings() {
        this.audio.setVolume(this.settings.muted ? 0 : this.settings.volume);
    }

    // Toggle the Options overlay (freezes the sim while open; persists settings on close).
    toggleOptions() {
        this.optionsOpen = !this.optionsOpen;
        if (this.optionsOpen) { this.audio.init(); this.optionsIndex = 0; }
        else { this.saveManager.saveSettings(this.settings); }
    }

    // One key while the Options overlay is open: up/down pick a row (Volume / Mute / Reduce
    // Motion), left/right (or Enter/Space) adjust it, Escape closes.
    optionsHandleKey(key) {
        const ROWS = 3;
        if (key === 'ArrowUp' || key === 'w' || key === 'W') { this.optionsIndex = (this.optionsIndex - 1 + ROWS) % ROWS; this.audio.playBeep(); return; }
        if (key === 'ArrowDown' || key === 's' || key === 'S') { this.optionsIndex = (this.optionsIndex + 1) % ROWS; this.audio.playBeep(); return; }
        if (key === 'Escape') { this.toggleOptions(); return; }
        const left = (key === 'ArrowLeft' || key === 'a' || key === 'A');
        const right = (key === 'ArrowRight' || key === 'd' || key === 'D');
        const toggle = (key === 'Enter' || key === ' ');
        if (this.optionsIndex === 0) {          // Volume
            if (left) this.settings.volume = Math.max(0, Math.round((this.settings.volume - 0.1) * 10) / 10);
            else if (right) this.settings.volume = Math.min(1, Math.round((this.settings.volume + 0.1) * 10) / 10);
            else return;
            if (this.settings.volume > 0) this.settings.muted = false;
            this.applySettings();
            this.audio.playBeep();
        } else if (this.optionsIndex === 1) {   // Mute
            if (!(left || right || toggle)) return;
            this.settings.muted = !this.settings.muted;
            this.applySettings();
            if (!this.settings.muted) this.audio.playBeep();
        } else {                                 // Reduce Motion
            if (!(left || right || toggle)) return;
            this.settings.reduceMotion = !this.settings.reduceMotion;
            this.audio.playBeep();
        }
        this.saveManager.saveSettings(this.settings);
    }

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
        if (this.titleCameo && this.titleCameo.who === 'cadenza') this.saveManager.markCadenzaCameoSeen();
        this.audio.stopVoidAmbient(); // the title piece ends when a run begins
        this.resetToNewGame();
        this.state.gameState = 'PLAYING';
    }

    // Load a save file into a fresh run (Hub), binding it as the active file.
    loadSlot(slot) {
        const d = this.saveManager.load(slot);
        if (d && this.applySave(d)) {
            this.activeSlot = slot;
            this.saveManager.markCameoSeen();
            if (this.titleCameo && this.titleCameo.who === 'cadenza') this.saveManager.markCadenzaCameoSeen();
            this.audio.stopVoidAmbient(); // the title piece ends when a run begins
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
        if (this.titleCameo) {
            const g = this.gridSize;
            this.state.titleCameoSprite = { x: this.titleCameo.x, y: Math.floor(this.canvas.height * 0.72 / g) * g, alpha: this.titleCameo.alpha, who: this.titleCameo.who };
        } else {
            this.state.titleCameoSprite = null;
        }
        this.state.reduceMotion = this.settings.reduceMotion; // Renderer dampens pulses/blinks
        this.state.options = this.optionsOpen ? { index: this.optionsIndex, settings: this.settings } : null;
        this.state.encore = (this.state.gameState === 'ENCORE' && this.encore) ? this.getEncoreRenderState() : null;
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

    // The first time the file-select menu is shown, Cache's title cameo plays: her sprite
    // WALKS ON, she delivers her lines in the Act-1 dialog window (dismissed with SPACE),
    // starts to fade, then POPS back to complain about her own typo, then fades for good.
    // One-time (global flag). The scripted animation runs in updateTitleCameo().
    maybeStartTitleCameo() {
        if (!this.saveManager.anySave()) return;
        if (!this.saveManager.hasCameoSeen()) {
            // Cache's first cameo (she "builds" the title screen), entering from the LEFT.
            this.startCameoActive = true;
            this.titleCameo = { who: 'cache', phase: 'walkin', t: 0, alpha: 1, x: -this.gridSize * 2 };
            return;
        }
        // After Cache's cameo, once the DA CAPO Encore is done, Cadenza appears ONCE from the
        // opposite side to give you her somber title piece (the Void Ambient plays from then on).
        if (this.saveManager.hasEncoreUnlocked() && !this.saveManager.hasCadenzaCameoSeen()) {
            this.startCameoActive = true;
            this.titleCameo = { who: 'cadenza', phase: 'walkin', t: 0, alpha: 1, x: this.canvas.width + this.gridSize * 2 };
        }
    }

    // Once the Encore is done, the Void Ambient (Cadenza's somber piece) loops under the title
    // menu. Started on the first menu key (Web Audio needs the gesture); stopped when a run begins.
    maybeStartVoidAmbient() {
        if (this.startMenuActive() && this.saveManager.hasEncoreUnlocked()) this.audio.startVoidAmbient();
    }

    // Drives Cache's title-cameo sprite through its beats. Dialog windows open at the phase
    // boundaries (walk-on done -> lines; pop-back done -> the typo gag), and each dialog's
    // completion advances the next phase. SPACE routes to the dialog via the boot-menu
    // listener while startCameoActive is true.
    updateTitleCameo(dt) {
        const c = this.titleCameo;
        if (!c) return;
        const g = this.gridSize, W = this.canvas.width, H = this.canvas.height;

        if (c.who === 'cadenza') {
            // She enters from the RIGHT (Cache came from the left), says her piece, then fades.
            const rX = Math.floor(W * 0.66 / g) * g;
            const sX = W + g * 2;
            const WALK = 1100, FADE = 900;
            c.t += dt;
            if (c.phase === 'walkin') {
                const p = Math.min(1, c.t / WALK);
                c.x = sX + (rX - sX) * (p * (2 - p)); // easeOut slide-on
                c.alpha = 1;
                if (p >= 1) {
                    c.phase = 'holdA'; c.t = 0; c.x = rX;
                    this.dialogManager.start(CADENZA_TITLE, () => { const cc = this.titleCameo; if (cc) { cc.phase = 'fadeout'; cc.t = 0; } });
                }
            } else if (c.phase === 'holdA') {
                c.x = rX; c.alpha = 1;
            } else if (c.phase === 'fadeout') {
                c.alpha = 1 - Math.min(1, c.t / FADE);
                if (c.t >= FADE) { this.titleCameo = null; this.startCameoActive = false; this.saveManager.markCadenzaCameoSeen(); }
            }
            return;
        }

        const restX = Math.floor(W * 0.30 / g) * g; // rest lower-left of the title/files
        const startX = -g * 2;
        const WALK_MS = 1100, FADE1_MS = 460, POP_MS = 240, FADE2_MS = 700, FADE1_TARGET = 0.22;
        c.t += dt;

        if (c.phase === 'walkin') {
            const p = Math.min(1, c.t / WALK_MS);
            c.x = startX + (restX - startX) * (p * (2 - p)); // easeOut slide-on
            c.alpha = 1;
            if (p >= 1) {
                c.phase = 'holdA'; c.t = 0; c.x = restX;
                this.dialogManager.start(CACHE.titleCameo, () => { const cc = this.titleCameo; if (cc) { cc.phase = 'fade1'; cc.t = 0; } });
            }
        } else if (c.phase === 'holdA') {
            c.x = restX; c.alpha = 1; // waiting on the player to read her lines
        } else if (c.phase === 'fade1') {
            c.alpha = 1 - (1 - FADE1_TARGET) * Math.min(1, c.t / FADE1_MS);
            if (c.t >= FADE1_MS) { c.phase = 'pop'; c.t = 0; }
        } else if (c.phase === 'pop') {
            c.alpha = FADE1_TARGET + (1 - FADE1_TARGET) * Math.min(1, c.t / POP_MS);
            if (c.t >= POP_MS) {
                c.phase = 'holdB'; c.t = 0; c.alpha = 1;
                this.dialogManager.start(CACHE.titleTypoGag, () => { const cc = this.titleCameo; if (cc) { cc.phase = 'fade2'; cc.t = 0; } });
            }
        } else if (c.phase === 'holdB') {
            c.alpha = 1;
        } else if (c.phase === 'fade2') {
            c.alpha = 1 - Math.min(1, c.t / FADE2_MS);
            if (c.t >= FADE2_MS) {
                this.titleCameo = null;
                this.startCameoActive = false;
                this.saveManager.markCameoSeen();
            }
        }
    }
}
