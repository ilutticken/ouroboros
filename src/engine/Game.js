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
                "2-Bit: There was one called the Cache. Remembered everything — every deleted file, every rollback. Reclamation took her sector whole.",
                "2-Bit: If she's still out there, she knows what the Architect's actually guarding."
            ]
        ];
        
        // Initialize Input
        this.input.init(this.gridSize, () => {
            this.audio.init();
            if (this.narrative) this.narrative.requestSkip(); // a key fast-forwards a log
            if (this.state.gameState === 'START' || this.state.gameState === 'DEAD') {
                this.state.gameState = 'PLAYING';
                this.state.rolledBack = false; // clear the rollback banner on resume
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
            // Action key (a fresh Space press while playing): 2-Bit's consent step.
            if (this.state.gameState === 'PLAYING' && this.state.unlocked.biteProgress === 2) {
                this.state.unlocked.biteProgress = 3;
                this.state.unlocked.tailRider = true;
                const biteNPC = this.npcs.find(n => n.id === 'bite');
                if (biteNPC) {
                    this.npcs = this.npcs.filter(n => n.id !== 'bite');
                    this.snake.body.push({ x: biteNPC.x, y: biteNPC.y });
                }

                this.state.gameState = 'DIALOG';
                this.dialogManager.start([
                    "2-Bit: I'm hooked into your system.",
                    "2-Bit: Tapping the direction you're facing will accelerate you.",
                    "2-Bit: Tapping the opposite direction acts as a brake.",
                    "2-Bit: The more mass you have, the higher your max speed limit."
                ], () => {
                    this.state.gameState = 'PLAYING';
                });
            }
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
        // Exclude the snake's own body so nothing spawns invisibly underneath it.
        const { x, y } = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], this.snake.body);

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
            const gPos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], [...this.snake.body, { x, y }]);
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
        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite');
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

                if (this.apple instanceof NPC) {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.state.gameState = 'DIALOG';
                        this.dialogManager.start(this.apple.dialog, () => {
                            if (this.state.unlocked.biteProgress === 0) {
                                this.state.unlocked.biteProgress = 1;
                                this.state.gameState = 'PLAYING';
                                // Bite stays as an NPC on grid
                                this.npcs.push(new NPC(this.apple.x, this.apple.y, this.gridSize, 'bite', []));
                            } else if (this.state.unlocked.biteProgress === 1) {
                                this.state.unlocked.biteProgress = 2;
                                this.state.gameState = 'PLAYING';
                                this.npcs.push(new NPC(this.apple.x, this.apple.y, this.gridSize, 'bite', []));
                            } else if (this.state.unlocked.biteProgress === 2) {
                                // They hit Space to comply.
                                this.state.unlocked.biteProgress = 3;
                                this.state.unlocked.tailRider = true;
                                this.snake.body.push({ x: this.apple.x, y: this.apple.y });
                                
                                this.dialogManager.start([
                                    "2-Bit: I'm hooked into your system.",
                                    "2-Bit: Tapping the direction you're facing will accelerate you.",
                                    "2-Bit: Tapping the opposite direction acts as a brake.",
                                    "2-Bit: The more mass you have, the higher your max speed limit."
                                ], () => {
                                    this.state.gameState = 'PLAYING';
                                });
                            }
                            
                            this.apple = this.spawnApple();
                        });
                        return;
                    } else {
                        this.snake.shrink(this.hasBiteSegment);
                    }
                } else {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.snake.grow(); // Logic handled by not shrinking
                        const gain = this.state.upgrades.dataCompression ? 2 : 1;
                        this.state.addScore(gain);
                        this.audio.playBeep();
                        this.apple = this.spawnApple();
                        this.checkUnlocks();
                    } else {
                        this.snake.shrink(this.hasBiteSegment); // Remove tail
                    }
                }
                
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
                                            this.state.unlocked.biteProgress = 2; // Waiting for space
                                            this.state.gameState = 'PLAYING';
                                        });
                                    }
                                } else if (this.state.unlocked.biteProgress === 2) {
                                    // Bumping him again while he waits for SPACE
                                    if (this.state.score >= 30) {
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "2-Bit: Are you deaf? I said press SPACE if you agree."
                                        ], () => { this.state.gameState = 'PLAYING'; });
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
                        } else if (npc.id === 'signpost' || npc.id === 'citizen' || npc.id === 'cadenza') {
                            // Localhost welcome sign / townsfolk / Cadenza — read and move
                            // on. No segment cost: a conversation shouldn't dock your mass.
                            this.state.gameState = 'DIALOG';
                            this.dialogManager.start(npc.dialog, () => { this.state.gameState = 'PLAYING'; });
                            return;
                        } else if (npc.id === 'shop') {
                            // 2-Bit's Localhost stall: a rotating gossip topic (if any
                            // are left) then the shop overlay.
                            this.openBiteShop();
                            return;
                        }
                        this.snake.shrink(this.hasBiteSegment); // keep 2-Bit on the tail
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
    
    die(cause = 'unknown') {
        const cx = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
        const cy = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;

        // Rollback Buffer: a lethal hit costs 10 Data + a mass setback instead of your
        // whole run. You KEEP your Data (minus 10) and stay in the current room (no Hub
        // warp); only your body is rewound and you re-centre safely. Can't pay 10 -> you
        // die for real (fall through).
        if (this.state.upgrades.rollbackBuffer && this.state.score >= 10) {
            this.state.score -= 10;
            this.snake.reset(cx, cy, this.hasBiteSegment);
            this.input.reset();
            this.gear = 0; this.speed = this.baseSpeed; this._wallBonking = false;
            this.changeGear(0); // re-clamp gear to the lowered score
            this.refreshScore();
            const g = this.gridSize;
            this.glitches = this.glitches.filter(gl =>
                Math.max(Math.abs(gl.x - cx) / g, Math.abs(gl.y - cy) / g) > 2);
            this.audio.playDenied(); // a "caught you" tug, not the death drone
            this.narrative.printMessage("SYSTEM: Rollback buffer engaged. Mass rewound, position held. (−10 Data)");
            this.state.rolledBack = true;  // the DEAD screen below shows the ROLLBACK message, not SIGNAL LOST
            this.state.gameState = 'DEAD'; // a wake-press resumes you HERE, Data intact
            return;
        }

        this.audio.playDeath(); // ONE death cue for every cause (border/self/obstacle/glitch)
        this.state.gameState = 'DEAD';
        this.snake.reset(cx, cy, this.hasBiteSegment);
        this.input.reset();
        this.state.resetScore();
        this.gear = 0;              // fresh runs start from a standstill (sub-smash
        this.speed = this.baseSpeed; // deaths would otherwise respawn you mid-gear)
        this._wallBonking = false;

        // Save current room, then warp back to hub (0,0)
        let appleToSave = this.apple;
        if (appleToSave instanceof NPC) {
            // Player died before picking up Bite. Since score resets, replace Bite with a normal apple.
            appleToSave = this.spawnApple();
        }

        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite');
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
        
        this.update(dt);
        this.draw();
        
        requestAnimationFrame((ts) => this.loop(ts));
    }
    
    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((ts) => this.loop(ts));
    }
}
