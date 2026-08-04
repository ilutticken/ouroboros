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
// Only what the CORE still speaks. The cast's lines left with them when the bump
// handlers moved to npcs.js and the set-pieces to encounters.js.
import { TWO_BIT, GATE, ARCHITECT, LOST_VERSE, HEUR, HUSH_INTERCEPT, DENNY_REMATCH,
         GATE_OVERRIDE, GATE_FINALE, ROM_DOOR_BONK, PORT0_COMPILING,
         HYDRATIA_DEATH, INVENTORY_NAMES } from '../content/dialogue.js';
import { classifyRoomBeyond } from '../systems/RoomGenerator.js';
import { EncounterMethods } from './encounters.js';
import { BootMethods } from './boot.js';
import { NpcMethods } from './npcs.js';

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
        // DEV audition: 'M' cycles the AUDIBLE music layer 1->2->3->1 in play (the real
        // boots are at the Encore = 1, Beat 8 = 2, Beat 16 = 3). Audition-only: it never
        // writes unlocked.musicLayer — that flag now gates real content (HUSH's dormancy,
        // save files), so the preview must not fake progression. Cleared whenever the
        // game re-syncs audio to the true layer (load / new game / the real boots).
        this._auditionLayer = null;
        window.addEventListener('keydown', (e) => {
            if ((e.key === 'm' || e.key === 'M') && (this.state.gameState === 'PLAYING' || this.state.gameState === 'ENCORE')) {
                this.audio.init();
                const cur = this._auditionLayer ?? (this.state.unlocked.musicLayer || 0);
                this._auditionLayer = (cur % 3) + 1;
                this.audio.setMusicLayer(this._auditionLayer);
                e.stopImmediatePropagation();
            }
        });
        this.shopManager = new ShopManager(this.state, this.audio);
        this.shopManager.onSpend = (price) => this.spendData(price); // Data = segments: buying shrinks you
        this.shopManager.onQuantcyWithdraw = () => this.quantcyWithdraw(); // the vault empties into his room as motes
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
        
        // DEV CHEAT (+10 Data) — playtest tool, SHIPS-REMOVED. The on-screen [DEV] button
        // is gone (it was the last non-diegetic control on the ribbon); the 'P' hotkey
        // stays so the owner can fast-forward a run. Registered OUTSIDE any element guard
        // on purpose: the listener used to live inside `if (btnPlaytest)`, so deleting the
        // button would have silently killed 'P' along with it. At release, delete this
        // whole block — nothing else references devAction.
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
        window.addEventListener('keydown', (e) => {
            // Gated on the states where the cheat can actually fire, and swallowed there
            // — so a 'P' during the bounce ARG window can't ALSO be recorded into the
            // CACHE code buffer by the listener registered below.
            if ((e.key === 'p' || e.key === 'P')
                && (this.state.gameState === 'PLAYING' || this.state.gameState === 'SHOP')) {
                devAction();
                e.stopImmediatePropagation();
            }
        });
        
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
        // BOUNCE EXTENSION: a Crumple bounce skips the DEAD screen — which used to close
        // the ARG for every Buffer owner. A bounce is a "little death": it opens a short
        // listen window (_argListenMs) during which letter keys feed the same buffer.
        // ADVANCE-ONLY in the window: WASD are also STEERING keys here (unlike the death
        // screen), so the daemon only writes a letter that continues the word — the next
        // letter of CACHE from your current progress, or a fresh 'C'. Steering noise
        // ('w'/'s'/'d', an off-word 'a') passes through untouched; a partial code can
        // never be wrecked mid-drive. Named keys are ignored entirely.
        window.addEventListener('keydown', (e) => {
            if (this.state.gameState === 'DEAD') { this.recordContinueKey(e.key); return; }
            if (this._argListenMs > 0 && this.state.gameState === 'PLAYING'
                && e.key.length === 1 && /[a-z]/i.test(e.key)) {
                const ch = e.key.toUpperCase();
                const WORD = 'CACHE';
                // longest k where the buffer already ends with CACHE's first k letters
                let prog = 0;
                for (let k = Math.min(4, this.deathCode.length); k > 0; k--) {
                    if (this.deathCode.endsWith(WORD.slice(0, k))) { prog = k; break; }
                }
                if (ch === WORD[prog] || ch === 'C') this.recordContinueKey(ch);
            }
        });

        // Cache's Save Function: from the PAUSE menu, S saves and L loads. Gated on the
        // function being granted, on actually being paused (so S/L don't collide with
        // 'down' movement in play), and NOT during the Gate Thread-Suspension cutscene
        // (also a PAUSED state) — loading out of that left isSuspended stuck true.
        window.addEventListener('keydown', (e) => {
            if (this.state.gameState !== 'PAUSED' || this.state.isSuspended) return;
            if (this.state.unlocked.saveFunction && (e.key === 's' || e.key === 'S')) this.saveGame();
            else if (this.state.unlocked.saveFunction && (e.key === 'l' || e.key === 'L')) this.loadGame();
            // Map Pins: [M] marks/cycles the current room's annotation (paused, looking at
            // the map). Gated on the tool so 'M' stays free before it's found.
            else if (this.state.unlocked.mapPinsTool && (e.key === 'm' || e.key === 'M')) this.cycleMapPin();
        });

        // Boot file-select menu (New Game / Load across 3 files). Only live when the START
        // screen is showing the menu (i.e. at least one save file exists). Registered
        // BEFORE input.init; stopImmediatePropagation keeps the wake-press (input.init's
        // onFirstInput) from ALSO firing on a menu key — critically, erasing the LAST file
        // makes startMenuActive() flip false mid-event, which would otherwise let the same
        // keypress fall through and auto-start a run.
        window.addEventListener('keydown', (e) => {
            // THE BARE COLD OPEN (no file menu yet): Hydratia haunts this screen too —
            // she must be catchable before the Start Screen ever exists (owner).
            if (this.state.gameState === 'START' && !this.startMenuActive()) {
                if (this.startCameoActive) {
                    // her catch dialog is up over the bare void: SPACE advances it,
                    // everything else is swallowed (a stray key must not start the run
                    // mid-conversation).
                    if (e.key === ' ' || e.key === 'Enter') this.dialogManager.advance();
                    e.stopImmediatePropagation();
                    return;
                }
                if (this._hydratia && this._hydratia.catchable) {
                    if (e.key === ' ' || e.key === 'Enter') {
                        this.audio.init();
                        this._startHydratiaCatchDialog();
                        e.stopImmediatePropagation();
                        return;
                    }
                    this._hydratia = null; // she bolts; the wake-press still starts the run
                }
                return; // input.init's wake-press handles the bare cold open
            }
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
            // HYDRATIA, REACHABLE: Space reaches out (her catch dialog takes the screen,
            // riding the cameo modal path); any other menu key and she bolts — but the
            // approach counter holds at 4, so she's reachable again next boot.
            if (this._hydratia && this._hydratia.catchable) {
                if (e.key === ' ' || e.key === 'Enter') {
                    this._startHydratiaCatchDialog();
                    e.stopImmediatePropagation();
                    return;
                }
                this._hydratia = null; // she bolts (stage stays 4 in storage)
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
        this._gearTick = -1;       // last move-tick a gear step landed (one step per tick)
        this._guided = new Set();  // sectors the Architect has already "guided" you to
        this.carriedModule = null; // a picked-up module riding your tail (e.g. 'map')
        this.moduleLoad = null;    // active install animation ({phase, t, fromX, fromY})
        this.bursts = [];          // short-lived particles from segments shed on a survivable hit
        this.dataMotes = [];       // Cache's spare-data gift: collectible Data seeded in the Hub (stage 2+)
        this.pendingUnfold = 0;    // blocks still folded under you after a bounce (extrude 1/move)
        this.deathCode = '';       // rolling last-5 keys pressed to "continue" on the death screen (spell CACHE)
        this._beaconTimer = 0;     // accumulates dt to pace Cadenza's proximity ping
        this.stamps = [];          // Denny's lagged DENIED stamps (room-local; head contact kills)
        this._wardUsedThisRoom = false; // Scale Mods' free Glitch absorb, spent once per room
        this._tailPrev = null;    // the cell the TAIL occupied last move-tick (the Fall-Through's stamp target)
        this._stampStun = 0;       // ticks Denny's stamp emitter is flustered after a bump/catch
        this._denny2Timer = 0;     // the Fall-Through's real-time chase clock (ms accumulator)
        this._roomEntryDir = { x: 0, y: 0 }; // which way you moved to ENTER this room (the catch throws you back)
        this._coilNear = null;     // { proximity, dirs } — the Kernel-coil approach (audio duck + deaf twin)
        this.mapPins = {};         // Map-Pins annotations: 'x,y' room key -> pin shape index (persisted)
        this._ovr = null;          // THE GATE's rotating ring state in {5,-3} ({gap, t, len})
        this._gate3Blocks = null;  // the ring's live block cells (collision + render)
        this._shakeMs = 0;         // screen-shake remaining (impacts; reduce-motion-exempt)
        this._worldTimer = 0;      // ms accumulated toward the next ambient world step
        this._worldStep = 0;       // ambient world steps taken (drives drift cadence + shove cooldowns)
        this._textHold = false;    // post-text: the worm holds until the next steering input
        this._wasTextFrozen = false; // edge detector for the hold (see update())
        this.gearInstall = null;   // 2-Bit fitting the gearbox ({phase,t,x,y,pips}) — see startGearInstall
        this._finale = null;       // Port 0's advancing walls ({rows:[{r,holes}], t})
        this.heur = null;          // Heur's in-room Breakout state — non-null only during the fight
        this._diedSinceCheckpoint = false; // first post-death Cache bump plays her reopen line
        this._argListenMs = 0;     // ms left on the bounce "listening" window (the ARG's little death)
        this.carriedRefugee = null; // origin room key of the refugee riding your tail (null = none)
        this._deathReceipt = null;  // Hydratia's DEAD-overlay receipt (computed per death)
        this._hydratia = null;      // her boot-screen glimpse state ({stage, catchable})

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
            // Act I build-out: the Wilds' discoveries and the Ascent's cast.
            nibble: (npc) => this.npcNibble(npc),
            hush: (npc) => this.npcHush(npc),
            datacache: (npc) => this.npcDataCache(npc),
            uimodule: (npc) => this.npcUiModule(npc),
            lorefrag: (npc) => this.npcSign(npc),
            denny2: (npc) => this.npcDenny2(npc),
            gate3: (npc) => this.npcGateScuffle(npc),
            gatefinal: (npc) => this.npcGateFinal(npc),
            dennyfinal: (npc) => this.npcDennyFinal(npc),
            dennyafter: (npc) => this.npcDennyFinal(npc),
            // The refugee economy + the two Localhost intake stations.
            refugee: (npc) => this.npcRefugee(npc),
            commons: (npc) => this.npcCommons(npc),
            minegate: (npc) => this.npcMinegate(npc),
            // The Wilds bank and Hydratia's save-upgrade stall.
            quantcy: (npc) => this.npcQuantcy(npc),
            hydratia: () => this.openHydratiaShop(),
        };
        // NPC bumps that already carry their own contact sound (a clamp, a scuffle, a
        // pickup beep) skip the generic handshake chirp.
        this._silentBumps = new Set(['hush', 'datacache', 'gate3', 'gatefinal', 'mapitem', 'lostverse']);
        
        // Initialize Input
        this.input.init(this.gridSize, (consumed) => {
            this.audio.init();
            this.audio.setMusicLayer(this.state.unlocked.musicLayer || 0); // sync the soundtrack to the current layer (0 halts it)
            // A key fast-forwards a TYPING log — unless this very press just released the
            // latch (consumed): releasing pumps the queue, and the same Space must not
            // also insta-complete the NEXT log it just started (a one-press skip-through).
            if (this.narrative && !consumed) this.narrative.requestSkip();
            if (this.state.gameState === 'DEAD') {
                // 'PRESS ANY KEY TO CONTINUE' means ANY key: the wake-press also clears a
                // pending release latch (the death gloat), or the respawn would land in an
                // invisibly frozen sim that only Space could thaw. release() no-ops when
                // there's nothing latched.
                if (this.narrative && this.narrative.awaitingRelease) this.narrative.release();
                this.state.gameState = 'PLAYING'; // respawn wake-press
            } else if (this.state.gameState === 'START' && !this.startMenuActive()) {
                // Bare-void cold open (no save files yet): any key starts the first run.
                // When the file-select menu IS up, its own listener handles selection.
                this.audio.stopVoidAmbient(); // don't let the title piece leak into the run
                this.state.gameState = 'PLAYING';
            }
        }, () => {
            // Advance a dialog. Returns true when it handled one, so InputHandler knows
            // to CONSUME the keypress and not also fire the action below on the same press.
            // ORDER IS LOAD-BEARING: an OPEN DIALOG BOX wins over the terminal latch. The
            // typewriter keeps typing during DIALOG, so at the Override clear / Port 0
            // (a dialog on screen AND queued logs) the latch would otherwise eat every
            // Space and the visible dialog would read as unresponsive. The latch only
            // claims Space when nothing modal is above it.
            if (this.state.gameState === 'DIALOG') {
                this.dialogManager.advance();
                return true;
            }
            if (this.narrative && this.narrative.awaitingRelease) {
                this.narrative.release();
                return true;
            }
            return false;
        }, () => {
            // Space has no free-play action. 2-Bit's consent is THE GAG: the only way
            // through a dialog is the Space bar, so finishing his offer dialog IS
            // agreeing (handled in the offer's onComplete) — never a separate Space press
            // in the world. Keep it that way.
        }, (delta) => {
            // While the TEXT HOLD is on, a tap along your facing axis is a RESUME, not a
            // shift: the player means "go", and silently upshifting on the go-press would
            // hand them an unseen speed change at the exact moment holds exist to protect.
            if (this._textHold && this.state.gameState === 'PLAYING') {
                this._textHold = false;
                return;
            }
            // Gear taps are additionally blocked while the sim is frozen (a printing
            // log / module install) — otherwise tapping your facing direction while
            // reading a log would silently accumulate max speed (the F15 bug).
            if (this.state.gameState === 'PLAYING' && this.state.unlocked.tailRider
                && !(this.narrative && this.narrative.isPrinting) && !this.moduleLoad) {
                // ONE gear step per move-tick. Every "tap the way you're already facing"
                // is an upshift, so a habitual Snake double-tap could apply two steps in a
                // single frame and jump 0->2 before the meter ever drew a pip — an unseen
                // change to a state that kills you. Braking shares the gate on purpose.
                if (this._tick === this._gearTick) return;
                this.changeGear(delta);
                this._gearTick = this._tick;
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

    // THE WALL RING. Once borders exist, the outer 1-cell ring is solid wall — the
    // playable interior is cells [1, cols-2] x [1, rows-2]. These are the pixel bounds of
    // the ring (a head top-left at/under them is entering the wall). `right`/`bottom` are
    // the ring cell's top-left, so `>=` means the head is in the ring.
    get _cols() { return Math.floor(this.canvas.width / this.gridSize); }
    get _rows() { return Math.floor(this.canvas.height / this.gridSize); }
    get ringLeft() { return this.gridSize; }
    get ringRight() { return (this._cols - 1) * this.gridSize; }
    get ringTop() { return this.gridSize; }
    get ringBottom() { return (this._rows - 1) * this.gridSize; }

    // 2-Bit physically rides the tail only until he sets up shop in Localhost. The
    // driving/gear module (tailRider) stays yours; the packet gets off.
    get hasBiteSegment() { return this.state.unlocked.tailRider && !this.state.unlocked.biteDroppedOff; }

    // Everyone currently riding the tail (2-Bit mid-ferry, a carried refugee). Their
    // segments are PASSENGERS, not Data — shrinks and spends must never eat them, so
    // every mass-loss path protects the tail while anyone is aboard and the spend floor
    // rises by one per rider.
    get riderCount() { return (this.hasBiteSegment ? 1 : 0) + (this.carriedRefugee ? 1 : 0); }
    get hasRiderSegment() { return this.riderCount > 0; }

    // One source of truth for what an apple/mote is worth (Data Compression tiers).
    // Vault/mine motes are EXEMPT (always exactly 1): they are stored Data being
    // re-embodied, and letting Compression multiply a withdrawal would mint free Data
    // out of a deposit loop.
    get appleGain() { return this.state.upgrades.dataCompression2 ? 3 : this.state.upgrades.dataCompression ? 2 : 1; }

    changeGear(delta) {
        // Max gear scales with score:
        // 0-9 data: gear 0
        // 10-19 data: max gear 1
        // 20-29 data: max gear 2
        // 30+ data: max gear 3
        const maxGear = Math.min(3, Math.floor(this.state.score / 10));
        // (Gate's old VELOCITY CAP citation is gone with the Override rewrite — THE GATE
        // is a rotating perimeter loop now, so the fight constrains your ROUTE, not your
        // gearbox. You need full speed to thread it, so capping it would fight the design.)

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
            // The whole body scrapes while ANY segment is in the interior cell adjacent
            // to the WALL RING (col 1 / row 1 and their far-side twins).
            const scraping = this.snake.body.some(s =>
                s.x <= this.ringLeft || s.x >= this.ringRight - g || s.y <= this.ringTop || s.y >= this.ringBottom - g
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
        // The reversed head would drive into the WALL RING (not just off-canvas).
        const wallAhead = this.state.unlocked.borders
            && (nx < this.ringLeft || nx >= this.ringRight || ny < this.ringTop || ny >= this.ringBottom);
        const bodyAhead = b.some((s, i) => i !== 0 && i !== b.length - 1 && s.x === nx && s.y === ny);
        // Denny's DENIED stamps harden the trail the reversed head would drive into —
        // the "truly safe 180" promise holds in the Fall-Through too.
        const stampAhead = this.stamps && this.stamps.some(s => s.x === nx && s.y === ny);
        if (headOff || wallAhead || bodyAhead || stampAhead) {
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
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const body = this.snake.body;

        const walls = [
            { dir: 'left',  adj: s => s.x <= this.ringLeft,       cross: s => s.y },
            { dir: 'right', adj: s => s.x >= this.ringRight - g,  cross: s => s.y },
            { dir: 'up',    adj: s => s.y <= this.ringTop,        cross: s => s.x },
            { dir: 'down',  adj: s => s.y >= this.ringBottom - g, cross: s => s.x },
        ];

        for (const wall of walls) {
            const draped = body.filter(wall.adj);
            if (!draped.length) continue;
            // Geometric growth with sweep length (segments draped on this wall).
            const ms = Math.min(6000, 350 * Math.pow(1.35, draped.length));

            // (a) Hidden-door reveal — needs a live weak point under the sweep.
            const wp = this.worldManager.getWeakPoint(rx, ry, wall.dir);
            if (wp && !this.worldManager.isWallBroken(rx, ry, wall.dir)) {
                const overDoor = draped.some(s => { const c = wall.cross(s); return c >= wp.start && c <= wp.end; });
                if (overDoor) {
                    const alreadyKnown = this.worldManager.isWeakPointRevealed(rx, ry, wall.dir);
                    this.worldManager.revealWeakPoint(rx, ry, wall.dir, ms);
                    if (!alreadyKnown) this.audio.playScannerPing(); // ping only on a FRESH find
                }
            }

            // (b) The BEYOND read — the sweep verb works on EVERY wall, solid or not: a
            // category-only echo of what the neighbouring sector holds (module / cache /
            // lore / someone / landmark), so the Scanner is an exploration tool in all
            // ~130 rooms, not a key for four doors. Never fires into the coil.
            const nx = rx + (wall.dir === 'left' ? -1 : wall.dir === 'right' ? 1 : 0);
            const ny = ry + (wall.dir === 'up' ? -1 : wall.dir === 'down' ? 1 : 0);
            if (!this.worldManager.isCoilWall(rx, ry, wall.dir)) {
                const kind = classifyRoomBeyond(nx, ny, this.worldManager, this.state.unlocked, this.carriedRefugee);
                if (kind) this.worldManager.revealBeyond(rx, ry, wall.dir, kind, ms);
            }
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
        // (Localhost is hazard-free by contract) NOR during Heur's decontamination (the
        // sealed bay is swept clean; an apple respawn must not sneak corruption back in).
        const inSafeZone = this.worldManager.isSafeZone(this.worldManager.currentRoomX, this.worldManager.currentRoomY);
        if (this.state.unlocked.biteProgress > 0 && !inSafeZone && !this.heur && Math.random() < 0.2) {
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
        const fromX = this.worldManager.currentRoomX;
        const fromY = this.worldManager.currentRoomY;

        // Advancing EAST out of Denny's room without ever meeting him? You slipped
        // past the Last Line (retreating West back to the Hub doesn't count) —
        // remembered and paid off later (Gate's dialogue).
        if (dx === 1 && fromX === 1 && fromY === 0
            && !this.state.unlocked.dennyMet && !this.state.unlocked.dennySlipped) {
            this.state.unlocked.dennySlipped = true;
        }

        // The Ascent's clears: breaching NORTH out of an armed rematch room resolves it.
        let clearedDialog = null;
        if (dy === -1 && this.state.unlocked.ascentArmed) {
            if (fromX === 5 && fromY === -2 && !this.state.unlocked.dennyRematchDone) {
                this.state.unlocked.dennyRematchDone = true;
                clearedDialog = DENNY_REMATCH.cleared;
            } else if (fromX === 5 && fromY === -3 && !this.state.unlocked.gateRematchDone) {
                // FALLBACK ONLY. The staged path is crossBorder -> gate3Defeat (you beat
                // him in the room and watch him go). This catches leaving {5,-3} north by
                // any other route — e.g. the door was already broken by a prior attempt.
                this.state.unlocked.gateRematchDone = true;
                clearedDialog = GATE_OVERRIDE.cleared;
                this.fireMotionCarried();
            }
        }
        // ...and if you walk out on him mid-run, the sector still shook loose behind you.
        if (fromX === 5 && fromY === -3 && this.state.unlocked.gateRematchDone) {
            this.fireMotionCarried();
        }

        // Leaving a room resets its transient battle state: Denny's stamps, Gate's
        // override (and its gear cap), the stamp-trail memory, and Scale Mods' per-room
        // free absorb.
        this.stamps = [];
        this._tailPrev = null;
        this._stampStun = 0;
        this._ovr = null;
        this._wardUsedThisRoom = false;

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

        // Scripted set-piece rooms regenerate FRESH each entry until their beat is done —
        // a clean retry every time (obstacle layouts, enforcer positions, the finale's
        // corrupted cell), instead of a half-resolved cached husk.
        this._maybeRegenerateScriptedRoom();

        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        // A room whose apple wandered off re-arms on entry (the food came back).
        if (!this.apple) this.apple = this.spawnApple();
        // Remember which way you came IN (the Fall-Through's catch throws you back
        // toward the door you entered through).
        this._roomEntryDir = { x: dx, y: dy };

        // ONE-WAY: stepping through Cache's checkpoint door re-seals it behind you.
        // The reboot beyond flushes volatile memory; doors out of her stacks are one-way.
        // (Death in the finale reopens it — the checkpoint respawn, see die().) ONLY
        // while the finale is unresolved: after the paradox the way home is permanently
        // open (_finaleParadox re-breaks it), and resealing on a post-finale visit to
        // Denny's vigil would trap the player in Port 0 with no exit.
        if (this.worldManager.currentRoomX === 5 && this.worldManager.currentRoomY === -5 && dy === -1) {
            this.state.unlocked.finaleDoorFound = true; // the Scanner door has been breached once
            if (!this.state.unlocked.finaleDone) {
                this.worldManager.brokenWalls.delete(this.worldManager.boundaryKey(5, -5, 'down'));
            }
        }

        // THE EARLY CLIMB ARMS. Reaching Localhost having already been arrested by Gate
        // (pauseMenu is his Thread Suspension rescue, so it can't arm before you've met
        // him) mans the two rematch posts north of town. That makes the SECOND Gate run-in
        // — and Motion Carried with it — reachable straight out of Localhost, at the act
        // MIDPOINT, instead of being chained behind the Nibble/Heur detour.
        if (!this.state.unlocked.ascentArmed
            && this.state.unlocked.pauseMenu
            && this.worldManager.currentRoomX === 5
            && this.worldManager.currentRoomY === 0) {
            this.state.unlocked.ascentArmed = true;
        }

        // Reaching Cadenza's sealed sector resolves her homing beacon — you've located
        // her. Her NPC (RoomGenerator) delivers the actual scene on contact.
        if (!this.state.unlocked.cadenzaFound
            && this.worldManager.currentRoomX === this.cadenzaRoom.x
            && this.worldManager.currentRoomY === this.cadenzaRoom.y) {
            this.state.unlocked.cadenzaFound = true;
        }

        // QUANTCY'S COMPOUNDING — the vault grows per sector CROSSED (banking is paced by
        // active play, not wall-clock). Yield accrues on principal+yield at 3%/sector
        // (+0.5pp per freed refugee — the freed boost the light-side economy) and halts
        // when yield matches principal: a full vault forces a withdrawal run.
        {
            const uq = this.state.unlocked;
            if ((uq.quantcyPrincipal || 0) > 0 && (uq.quantcyYield || 0) < uq.quantcyPrincipal) {
                const rate = 0.03 + 0.005 * (uq.refugeesFreed || 0);
                uq.quantcyYield = Math.min(uq.quantcyPrincipal,
                    (uq.quantcyYield || 0) + ((uq.quantcyPrincipal + (uq.quantcyYield || 0)) * rate));
            }
        }

        // HYDRATIA'S AUTO-COMMIT — her bought autosaves fire on the room grain: every
        // cross (Frequent Commit) or on entering a safe zone (Auto-Commit). Writes the
        // shadow buffer only; never the manual file.
        if (this.state.unlocked.autosaveEvery) this.autoCommit();
        else if (this.state.unlocked.autosaveSafe
            && this.worldManager.isSafeZone(this.worldManager.currentRoomX, this.worldManager.currentRoomY)) this.autoCommit();

        // Place the room's dynamic (never-saved) occupants: Cache's Hub apparition and
        // her spare-data motes. Also clears any motes when leaving the Hub.
        this.refreshDynamicRoomContent();

        this.architectGuide(); // the Architect accidentally narrates your route

        // The coil's proximity presentation resets with the room (recomputed next tick).
        this._coilNear = null;
        this.audio.setDuck(1);

        // First time the anomaly reaches a perimeter sector: the Architect files the
        // outer wall under GEOLOGY. Long fuse — no further explanation for acts.
        if (this._inBoundaryRoom() && !this.state.unlocked.coilSeen) {
            this.state.unlocked.coilSeen = true;
            this.narrative.printMessage(ARCHITECT.coilFirst);
        }

        // HUSH's post, entered while it's still ON DUTY: a one-time SYSTEM intercept
        // (rule 1 — the clamp is telegraphed before it can bite).
        if (this.worldManager.currentRoomX === this.worldManager.landmarks.hush.x
            && this.worldManager.currentRoomY === this.worldManager.landmarks.hush.y
            && (this.state.unlocked.musicLayer || 0) < 1
            && !this.state.unlocked.hushTelegraphed) {
            this.state.unlocked.hushTelegraphed = true;
            this.narrative.printMessage(HUSH_INTERCEPT);
        }

        // 2-Bit sets up shop the first time you reach Localhost; its dialogue takes
        // over from the room-entry transition pause.
        if (this.checkBiteDropOff()) return;

        // HEUR'S INTERCEPT — the mandatory decontamination. Owning Nibble's Glitch Shunt
        // flags you as an infection vector; the sweeper daemon seals the next open sector
        // you enter and plays Breakout with your body. The far door (the way you were
        // heading) opens when you win.
        if (this._heurInterceptHere(dx, dy)) return;

        // An Ascent rematch resolved on the way in: its cast calls after you — and then
        // the NEW room's own intro still gets its turn (clearing the Fall-Through lands
        // you straight in the Override; skipping Gate's intro would skip its telegraph).
        if (clearedDialog) {
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(clearedDialog, () => {
                if (!this._scriptedRoomIntro()) this.state.gameState = 'PLAYING';
            });
            return;
        }

        // Armed set-piece rooms open on their intro scene (once each).
        if (this._scriptedRoomIntro()) return;

        this.state.gameState = 'TRANSITION';
        setTimeout(() => {
            if (this.state.gameState === 'TRANSITION') {
                this.state.gameState = 'PLAYING';
            }
        }, 500);
    }

    // Denny's first post stands down once his map is INSTALLED and Localhost is open —
    // his job at {1,0} is done (he's next seen manning the Fall-Through up the spine).
    // Wipes the cached room so the next visit regenerates without him; RoomGenerator
    // gates his spawn on the same pair of flags for fresh sessions/loads.
    _maybeRetireDenny() {
        if (this.state.unlocked.mapModule && this.state.unlocked.biteDroppedOff) {
            delete this.worldManager.rooms['1,0'];
        }
    }

    // Is the current room on the finite interior's edge (any wall is the Kernel's
    // coil)? The Hub is exempt — the Architect's own quarantine masks the coil there.
    _inBoundaryRoom() {
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        if (rx === 0 && ry === 0) return false;
        return ['up', 'down', 'left', 'right'].some(d => this.worldManager.isCoilWall(rx, ry, d));
    }

    // Wipe the cached copy of a scripted set-piece room when entering it unresolved, so
    // it regenerates fresh (clean retries). Port 0 regenerates until the finale is done.
    _maybeRegenerateScriptedRoom() {
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const u = this.state.unlocked;
        if (rx !== 5) return;
        const stale =
            (ry === -2 && u.ascentArmed && !u.dennyRematchDone) ||
            (ry === -3 && u.ascentArmed && !u.gateRematchDone) ||
            (ry === -5 && !u.finaleDone);
        if (stale) delete this.worldManager.rooms[this.worldManager.getRoomKey(rx, ry)];
    }

    // Fire Heur's decontamination when you ENTER THE BAY — a DEDICATED, fixed room the
    // story funnels you through: {5,-1}, the first sector up the north spine on the way
    // to the Ascent. Only while flagged (you carry the Glitch Shunt) and not yet
    // decontaminated. Returns true if it took over the transition.
    get heurBay() { return { x: 5, y: -1 }; }
    // (dx/dy are the crossing vector — kept in the signature because every other
    // crossBorder hook takes it, and the rematch will need it to orient horizontally.)
    _heurInterceptHere(_dx, _dy) {
        const u = this.state.unlocked;
        if (!this.state.upgrades.corruptHandler || u.purgeComplete) return false;
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        if (rx !== this.heurBay.x || ry !== this.heurBay.y) return false;
        // THE FIRST BAY IS ALWAYS VERTICAL (owner: first encounter vertical, the Act II
        // rematch horizontal). Pinned rather than inferred from your heading, because the
        // orientation decides the whole shape of the fight — a vertical band spans the
        // room's WIDTH (a wide, shallow database) where a horizontal one spans its HEIGHT
        // (narrower, but a longer tunnel to him). Inferring it meant approaching from the
        // north built the fight backwards, with the far door pointing back at Localhost.
        // startHeurFight stays general so the rematch can be handed 'left'/'right'.
        const far = 'up';
        this.state.gameState = 'DIALOG';
        // He only performs the full protocol once. Retreat and come back and the whole
        // scene compresses to one word.
        const lines = u.heurMet ? HEUR.reentry : HEUR.intercept;
        u.heurMet = true;
        this.dialogManager.start(lines, () => { this.startHeurFight(far); this.state.gameState = 'PLAYING'; });
        return true;
    }

    // Armed set-piece rooms open on a one-time intro dialog. Returns true if one played.
    _scriptedRoomIntro() {
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const u = this.state.unlocked;
        if (rx !== 5) return false;
        let lines = null, flag = null;
        if (ry === -2 && u.ascentArmed && !u.dennyRematchDone && !u.dennyRematchIntroSeen) { lines = DENNY_REMATCH.enter; flag = 'dennyRematchIntroSeen'; }
        else if (ry === -3 && u.ascentArmed && !u.gateRematchDone && !u.gateOverrideIntroSeen) { lines = GATE_OVERRIDE.enter; flag = 'gateOverrideIntroSeen'; }
        else if (ry === -5 && !u.finaleDone && !u.finaleIntroSeen) { lines = GATE_FINALE.enter; flag = 'finaleIntroSeen'; }
        if (!lines) return false;
        u[flag] = true;
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
        return true;
    }

    // On first reaching Localhost, 2-Bit hops off your tail to set up shop. This beat
    // is JUST the drop-off + shop hook — the world-building/villager leads are held
    // back for when you actually return to the stall to buy (see openBiteShop).
    // Returns true if it opened a dialogue.
    checkBiteDropOff() {
        if (this.state.unlocked.biteDroppedOff || !this.state.unlocked.tailRider) return false;
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== 0) return false;

        this.state.unlocked.biteDroppedOff = true;
        this._maybeRetireDenny();
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
        if (this.stamps && this.stamps.some(s => s.x === x && s.y === y)) return true;
        if (this.apple && this.apple.x === x && this.apple.y === y) return true;
        if (this.snake.body.some(s => s.x === x && s.y === y)) return true;
        return false;
    }

    // Full occupancy test for autonomous movers (Glitch drifters, wanderers, listing
    // obstacles, pursuit hazards): everything solid or precious blocks a step. The outer
    // WALL RING blocks too, so movers stay in the interior (never drift into the wall).
    _moverBlocked(x, y, opts = {}) {
        if (x < 0 || y < 0 || x >= this.canvas.width || y >= this.canvas.height) return true;
        if (this.state.unlocked.borders
            && (x < this.ringLeft || x >= this.ringRight || y < this.ringTop || y >= this.ringBottom)) return true;
        if (this._cellBlocked(x, y)) return true;
        if ((this.dataMotes || []).some(m => m.x === x && m.y === y)) return true;
        if (!opts.ignoreGlitches && (this.glitches || []).some(gl => gl.x === x && gl.y === y)) return true;
        if (!opts.ignoreNpcs && this.npcs.some(n => n.x === x && n.y === y)) return true;
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

    // Which body index wears the carried REFUGEE's face (they ride like 2-Bit: a real
    // passenger on a real segment — no HUD label). Stacking from the tail tip: the
    // module holds the tip, 2-Bit one forward, the refugee next. -1 = don't draw
    // (nobody aboard, or the worm is momentarily too short; reappears on regrowth).
    get refugeeIndex() {
        if (!this.carriedRefugee) return -1;
        const n = this.snake.body.length;
        const back = (this.carriedModule ? 1 : 0) + (this.hasBiteSegment ? 1 : 0);
        const idx = n - 1 - back;
        return idx >= 1 ? idx : -1;
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
            this._maybeRetireDenny();
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(TWO_BIT.moduleInstalled, () => { this.state.gameState = 'PLAYING'; });
        }
    }

    // Head trying to cross the room boundary (borders on, new head off-screen). Resolves the
    // 2-Bit-not-dropped tug-back, walking a smashed-open doorway, the wall-smash mechanic
    // (bonk / sub-smash death / max-gear breach), or a lethal solid wall. Returns:
    //   { stop: true }                    -> the move-tick must return (blocked / died)
    //   { stop: false, shifted, dx, dy }  -> proceed (shifted=true means a room change happened)
    // Guard the head against entering the outer WALL RING from the interior. A doorway
    // (weak point at the cross position) lets the head step into the ring — return false
    // (proceed), and the off-canvas crossBorder handles the actual crossing next. A solid
    // wall stops you: return true after a bonk (Heur seal — non-lethal) or a death.
    _ringGuard(nx, ny) {
        const g = this.gridSize;
        let dir, cross;
        if (nx < this.ringLeft) { dir = 'left'; cross = ny; }
        else if (nx >= this.ringRight) { dir = 'right'; cross = ny; }
        else if (ny < this.ringTop) { dir = 'up'; cross = nx; }
        else { dir = 'down'; cross = nx; }
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const wp = this.worldManager.getWeakPoint(rx, ry, dir);
        const isDoor = !!wp && cross >= wp.start && cross <= wp.end;
        // Heur's sealed bay: the ring is a non-lethal bonk except the retreat (entry)
        // doorway, which you may always step back out through (see crossBorder's seal).
        if (this.heur) {
            if (isDoor && dir === this.heur.goal) return false; // retreat: step into the entry doorway
            if (!this._wallBonking) this.audio.playDenied();
            this._wallBonking = true;
            this.gear = 0; this.speed = this.baseSpeed;
            return true;
        }
        if (isDoor) return false; // step into the doorway; crossBorder finishes the crossing
        // A solid wall (or a special NON-lethal case: the 2-Bit tug-back, Port 0's sealed
        // aperture, ...). Delegate to crossBorder with the off-canvas coordinates so EVERY
        // boundary outcome lives in one place — the head doesn't move (we're pre-move), so
        // a lethal wall dies one cell out, and the non-lethal cases bonk/tug as documented.
        const ocx = dir === 'left' ? -g : dir === 'right' ? this.canvas.width : nx;
        const ocy = dir === 'up' ? -g : dir === 'down' ? this.canvas.height : ny;
        return !!this.crossBorder(ocx, ocy).stop;
    }

    crossBorder(newHeadX, newHeadY) {
        // HEUR'S SEAL — during the decontamination the room is locked: every wall is a
        // non-lethal bonk EXCEPT the entry (goal) doorway, which you may always retreat
        // through. The far door opens only on the win.
        if (this.heur) {
            let dir = '';
            if (newHeadX < 0) dir = 'left';
            else if (newHeadX >= this.canvas.width) dir = 'right';
            else if (newHeadY < 0) dir = 'up';
            else if (newHeadY >= this.canvas.height) dir = 'down';
            if (dir === this.heur.goal) {
                // RETREAT the way you came — the fight ends UNWON (no restart, no penalty),
                // and you leave through the (already-open) entry door. Re-entering the bay
                // restarts the decontamination fresh.
                this.heur = null;
                // fall through to the normal crossing below (the entry door is broken).
            } else {
                if (!this._wallBonking) this.audio.playDenied();
                this._wallBonking = true;
                this.gear = 0;
                this.speed = this.baseSpeed;
                return { stop: true };
            }
        }
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
        // ROM-sealed scripted doors (Cache's checkpoint door north out of Cold Storage):
        // a real doorway that ramming can NEVER crack — a harmless bonk, whatever your
        // gear. Only Cache's script opens it. Non-lethal: it's her door, not a trap.
        if (isWeakPoint && this.worldManager.isRomSealed(rx, ry, directionStr)) {
            if (!this._wallBonking) {
                this.audio.playDenied();
                this.narrative.printMessage(ROM_DOOR_BONK);
            }
            this._wallBonking = true;
            this.gear = 0;
            this.speed = this.baseSpeed;
            return { stop: true };
        }
        // (Gate's old SEAL citation is gone too — the north egress is no longer
        // administratively revoked. THE GATE's ring is the only thing between you and the
        // wall, and it is a physical obstacle you time rather than a rule you wait out.)
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
                // THE GATE FALLS — breaking his north wall ends the Override HERE, so his
                // defeat and his run happen in front of you. We deliberately do NOT shift:
                // the door now stands open and you walk out under your own power, after
                // watching him go.
                if (rx === 5 && ry === -3 && directionStr === 'up'
                    && this.state.unlocked.ascentArmed && !this.state.unlocked.gateRematchDone) {
                    this.gate3Defeat();
                    return { stop: true };
                }
                this.shiftScreen(dx, dy);
                return { stop: false, shifted: true, dx, dy };
            }
            // SUB-SMASH: crack it (capped below the break point) — but the impact destroys you.
            // The Architect, gloating in his log, reveals that max speed is the trick.
            this.worldManager.damageWall(rx, ry, directionStr, dmg, this.worldManager.wallBreakThreshold - 1);
            this.audio.playCrack();
            // `heavy` = it HAD the mass to breach and blew the approach; `light` = it could
            // never have made it. Two different gloats, and the mass threshold is the same
            // one the gearbox uses (30 Data licenses gear 3).
            this.narrative.onSubSmash(inHub, this.state.unlocked, this.state.score >= 30);
            // A WEAK POINT missed for want of speed — a different failure from walking
            // into a solid wall, and the Architect's best gloat, so it gets its own cause.
            this.die('weak');
            return { stop: true };
        }
        // PORT 0 — the aperture in the top coil out of {5,-5}. The central span is the
        // Kernel's own port: sealed, but a bonk, never a death (a door, not a wall).
        // After the finale it names itself; the deep sectors are still compiling.
        if (rx === 5 && ry === -5 && directionStr === 'up') {
            const dim = this.canvas.width;
            const g = this.gridSize;
            const mid = Math.floor(dim / 2 / g) * g;
            if (newHeadX >= mid - 2 * g && newHeadX <= mid + 2 * g) {
                if (!this._wallBonking) {
                    this.audio.playDenied();
                    if (this.state.unlocked.finaleDone) this.narrative.printMessage(PORT0_COMPILING);
                }
                this._wallBonking = true;
                this.gear = 0;
                this.speed = this.baseSpeed;
                return { stop: true };
            }
        }
        // Solid wall (non-weak-point, a sealed Hub wall, or the Kernel's coil): lethal.
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
            const gain = this.appleGain;
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
        } else if (this.apple && this.snake.checkAppleCollision(this.apple)) {
            this.snake.grow(); // growth = not shrinking this tick
            const gain = this.appleGain;
            this.state.addScore(gain);
            if (gain > 1) this.growSnake(gain - 1); // Data = segments (the eat already gave +1)
            this.audio.playBeep();
            // THE WANDER (owner direction, exploration pressure): outside the Hub, an
            // eaten apple has a 20% chance of NOT respawning here — the food skittered
            // into another sector; the room re-arms when you come back (shiftScreen).
            // The Hub keeps its tutorial economy; Heur's sealed bay stays stable.
            const inHub = this.worldManager.currentRoomX === 0 && this.worldManager.currentRoomY === 0;
            if (!inHub && !this.heur && Math.random() < 0.2) {
                this.apple = null;
                this.audio.playDoot(); // the skitter — something small got away
            } else {
                this.apple = this.spawnApple();
            }
            this.checkUnlocks();
            grew = true;
        }

        // Data motes: Cache's spare pile, Salvage drops, Quantcy's vault payout, and the
        // Mine's stockpile — each grows + scores like an apple, none respawn when eaten.
        // VAULT/MINE motes are exactly 1 Data (no Compression multiplier): they are stored
        // Data being re-embodied, and multiplying a withdrawal would mint free Data out of
        // a deposit-withdraw loop. Their counters decrement here so the reserve drains
        // exactly as fast as it lands on your body.
        if (this.dataMotes && this.dataMotes.length) {
            const mi = this.dataMotes.findIndex(m => this.snake.head.x === m.x && this.snake.head.y === m.y);
            if (mi !== -1) {
                const mote = this.dataMotes[mi];
                this.dataMotes.splice(mi, 1);
                this.snake.grow();
                let gain = this.appleGain;
                if (mote.vault) { gain = 1; this.state.unlocked.quantcyPayout = Math.max(0, (this.state.unlocked.quantcyPayout || 0) - 1); }
                else if (mote.mine) { gain = 1; this.state.unlocked.mineStockpile = Math.max(0, (this.state.unlocked.mineStockpile || 0) - 1); }
                // Salvage motes are ALSO your own shed Data being re-embodied — letting
                // Compression multiply them minted Data out of thin air (crumple -6, drop
                // 3 salvage, re-eat at x3 = +9: a +3/bounce perpetual-motion machine).
                else if (mote.salvage) { gain = 1; }
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
    // With Nibble's GLITCH SHUNT installed, the head PUSHES corruption instead: the
    // Glitch slides one cell along your heading (a shove, playDenied) — no bite — and
    // only bites as before when the push is blocked. Corruption becomes a thing you
    // herd, stack, and park somewhere load-bearing.
    hitGlitch() {
        for (let i = 0; i < this.glitches.length; i++) {
            const g = this.glitches[i];
            if (this.snake.head.x === g.x && this.snake.head.y === g.y) {
                // The finale's corrupted cell is INDESTRUCTIBLE and IMMOVABLE while the
                // fight is live — the funnel's one lever can never be shoved OR eaten by
                // accident (checked before the shove, or a Shunt could push it off).
                const inLiveFinale = this.worldManager.currentRoomX === 5 && this.worldManager.currentRoomY === -5
                    && !this.state.unlocked.finaleDone;
                if (inLiveFinale) {
                    this.audio.playDenied();
                    break;
                }
                if (this.state.upgrades.corruptHandler) {
                    const d = this.input.direction;
                    const px = g.x + d.x, py = g.y + d.y;
                    if (!this._moverBlocked(px, py)) {
                        g.x = px; g.y = py;
                        delete g._m; // a shoved Glitch re-seeds its drift from the new cell
                        this.audio.playDenied(); // the shove — corruption bent, not bitten
                        break;
                    }
                }
                // Nibble's SCALE MODS: the cursed plating eats the FIRST Glitch bite in
                // each room for free (then it's hungry again). One free absorb per room.
                if (this.state.upgrades.glitchWard && !this._wardUsedThisRoom) {
                    this._wardUsedThisRoom = true;
                    this.audio.playCorruptHit(); // the plating takes the bite in your stead
                    this.glitches.splice(i, 1);
                    break;
                }
                const damage = this.state.upgrades.reinforcedSegments ? 1 : 3;
                const shed = []; // cells the corruption tears off (for Salvage Claws)
                for (let d = 0; d < damage; d++) {
                    const tail = this.snake.body[this.snake.body.length - 1];
                    if (this.snake.shrink(this.riderCount)) {
                        shed.push({ ...tail }); // a real pop — never a passenger's seat
                    } else if (this.snake.body.length <= 1) {
                        // Drained to nothing: consume the killer FIRST so die()'s saveRoom
                        // doesn't bake it into the cell to camp respawns.
                        this.glitches.splice(i, 1);
                        this.die('glitch');
                        return true;
                    } else {
                        break; // the floor is passengers, not Data — the bite stops there
                    }
                }
                // Data docks by what ACTUALLY popped (score and length can't desync at
                // the rider floor — a bite that only found passenger seats costs nothing).
                this.state.score = Math.max(0, this.state.score - shed.length);
                this.refreshScore();  // HUD must reflect the drain now, not at the next apple
                this.changeGear(0);   // re-clamp gear to the lowered score's cap (no ghost max speed)
                this.audio.playCorruptHit(); // corruption bites in — not a death
                this.dropSalvage(shed); // Nibble's Salvage Claws: spilled mass becomes re-collectible Data
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

        // THE TEXT HOLD (owner: "a systemic way to keep players from hitting walls and
        // dying after exiting a text box"). Decision 5 says text stops the game — but it
        // never stopped the WORM: every dialog, shop, pause, options screen and terminal
        // latch resumed you at full momentum, pointed wherever you were pointed, and if
        // that was one cell from a wall no reaction time could save you. So the freeze's
        // other half: when ANY text surface closes back into play, the worm HOLDS — still
        // facing, not moving — until your next steering input, exactly the contract every
        // spawn and respawn already taught. Detected here as a state TRANSITION so every
        // text source, current and future, gets it without per-dialog wiring. TRANSITION
        // (room slides) and DEAD are deliberately not "text": crossings keep momentum,
        // and the respawn wake-press machinery already owns the death screen.
        const textFrozen = this.optionsOpen
            || this.state.gameState === 'DIALOG'
            || this.state.gameState === 'SHOP'
            || this.state.gameState === 'PAUSED'
            || !!this.moduleLoad
            || !!this.gearInstall
            || !!(this.narrative && (this.narrative.isPrinting || this.narrative.awaitingRelease));
        if (this._wasTextFrozen && !textFrozen && this.state.gameState === 'PLAYING') {
            // NOTE: a turn already queued in input.nextDirection is deliberately NOT
            // cleared — it releases the hold on the first tick. That preserves both the
            // respawn contract (the wake-press direction buffers while the death log
            // types) and deliberate pre-steering during a printing log.
            this._textHold = true;
        }
        this._wasTextFrozen = textFrozen;

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

        // 2-Bit fitting the gearbox — a scripted beat, same freeze contract as an install.
        if (this.gearInstall) { this.updateGearInstall(dt); return; }

        // Module install: dragging the carried module into the 3x3 slot triggers a
        // two-beat animation that freezes the sim while it plays.
        if (this.moduleLoad) { this.updateModuleLoad(dt); return; }
        if (this.mapInSlot()) { this.startModuleLoad(); return; }

        // Cadenza's homing beacon — time-based (dt), so its pulse is independent of
        // how fast you're actually slithering.
        this.updateCadenzaBeacon(dt);
        this.worldManager.tickReveals(dt); // fade out expiring Scanner reveals
        this.updateDenny2Chase(dt);        // the Fall-Through runs on his own clock
        this.updateWorldMotion(dt);        // ...and so does the world (WORLD_STEP ms/cell)
        if (this.heur) this._heurTick(dt); // ...and so does Heur's scan-ping (HEUR_PING_MS)

        this.moveTimer += dt;

        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            this._tick++;
            // The move-tick body is a helper so its many early exits (die, room-cross,
            // obstacle, apple, glitch, NPC bump, wall-bonk) return from the HELPER, not
            // update().
            this._moveTick();
        }
    }

    // One move-tick's world + snake logic. Returns true if the tick ENDED the run/tick
    // hard (a death) so the caller can skip trailing per-tick work. Its internal returns
    // simply stop this tick (the sim resumes next frame).
    _moveTick() {
        // THE DATA MINES' DRIP — miners produce while you play (per move-tick, so idling
        // in a menu earns nothing). Capped: a full ore buffer waits for collection at the
        // minegate. >=2 miners double the buffer (Deep Vein); >=5 run 50% hotter (Refinery).
        {
            const um = this.state.unlocked;
            if ((um.refugeesMined || 0) > 0) {
                const rate = 0.01 * um.refugeesMined * (um.refugeesMined >= 5 ? 1.5 : 1);
                const cap = 20 * (um.refugeesMined >= 2 ? 2 : 1);
                um.mineStockpile = Math.min(cap, (um.mineStockpile || 0) + rate);
            }
        }
        this.updateGate();
        this.updateDenny();
        this.updateHush();          // the feedback-suppressor's turn-locked pursuit (its room only)
        // NOTE: updateWorldMotion is NOT here. Ambient drift runs on the WORLD's own
        // wall-clock (see update()), not on your move-tick — going faster must not make
        // the world faster.
        this.updateDenny2();        // the Fall-Through — lagged DENIED stamps on your trail
        this.updateGate3();         // the Override — one permission rewrite at a time
        this.updateGateFinal();     // Port 0 — the rigidity funnel

        // A committed fresh turn releases the text hold (the facing-axis taps release it
        // via the gear callback). While held, the WORLD keeps its clocks — bosses turn,
        // drift drifts, the ping flies — but the worm stands, exactly like the pre-first-
        // input state at spawn. Facing is preserved, so reversal stays illegal and a
        // disoriented post-text press cannot 180 into your own neck.
        const steered = this.input.updateDirection();
        if (this._textHold && steered) this._textHold = false;

        if (!this._textHold && (this.input.direction.x !== 0 || this.input.direction.y !== 0)) {

            let shifted = false;
            let dx = 0, dy = 0;
            const newHeadX = this.snake.head.x + this.input.direction.x;
            const newHeadY = this.snake.head.y + this.input.direction.y;

            if (this.state.unlocked.borders) {
                const offCanvas = newHeadX < 0 || newHeadX >= this.canvas.width || newHeadY < 0 || newHeadY >= this.canvas.height;
                if (offCanvas) {
                    // Passing OUT of a doorway (the head is already in a door ring cell):
                    // the room-boundary logic — doorway / wall-smash / lethal wall / seal.
                    const r = this.crossBorder(newHeadX, newHeadY);
                    if (r.stop) return false;
                    shifted = r.shifted; dx = r.dx; dy = r.dy;
                } else if (newHeadX < this.ringLeft || newHeadX >= this.ringRight
                        || newHeadY < this.ringTop || newHeadY >= this.ringBottom) {
                    // Entering the outer WALL RING from the interior: a solid wall stops you
                    // one cell out (die/bonk, head doesn't move); a doorway lets you step
                    // into it (then the off-canvas crossBorder above handles the crossing).
                    if (this._ringGuard(newHeadX, newHeadY)) return false;
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
                return true;
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
                this.snake.shrink(this.riderCount);
                return false;
            }

            if (this.obstacles) {
                for (const obs of this.obstacles) {
                    if (this.snake.head.x === obs.x && this.snake.head.y === obs.y) {
                        this.die('obstacle');
                        return true;
                    }
                }
            }

            // Denny's lagged DENIED stamps harden your own trail behind you — head
            // contact is an obstacle-death (only doubling back can hit one).
            if (this.stamps.length) {
                for (const s of this.stamps) {
                    if (this.snake.head.x === s.x && this.snake.head.y === s.y) {
                        this.die('stamp');
                        return true;
                    }
                }
            }

            // THE GATE's rotating ring ({5,-3}) and Port 0's advancing walls ({5,-5}) are
            // both wall-grade hazards — a hit is a border death (so the Crumple Buffer
            // still catches it), checked right beside the room's own furniture.
            if (this._gate3Collide()) return true;
            if (this._finaleCollide()) return true;
            // Heur's signature database is the same grade of hazard (owner: "touching Heur
            // or the bricks should act like a wall touch"), which is what stops you simply
            // swimming through his barrier to the far door.
            if (this._heurCollide()) return true;

            // Diegetic ambient audio: the system's own signals bleeding into your
            // senses as you move through it (corruption proximity, wall friction).
            this.playAmbientAudio();
            this.updateCoilProximity(); // the world holds its breath near the Kernel's coil
            this.detectScannerSweep(); // Topology Scanner: sweeping a wall reveals hidden doors

            if (this.collectData()) return false; // apple / spare-data motes + tail handling

            if (this.hitGlitch()) return true; // corruption drain (may kill)

            // Persistent NPC collisions — dispatched via the per-character registry
            // (this.npcHandlers / handleNpcCollisions). A bump resolves and stops the
            // tick; talking is length-neutral, so nothing shrinks again here.
            if (this.handleNpcCollisions()) return false;

            if (this.snake.checkSelfCollision()) { this.die('self'); return true; }
        }
        return false;
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
        // (Self-overlap is deliberately NOT in this list: the fold below collapses the
        // body to [head] anyway, vacating the collided cell before the reversed step —
        // and because die('self') fires AFTER collectData has already settled the tail,
        // shifting here removed a fully PAID segment, leaving score one higher than the
        // body forever: +1 phantom Data per self-bounce. Obstacle/stamp hits fire BEFORE
        // collectData, so their shift removes the transient unpaid head and balances.)
        const h = this.snake.head;
        const onHazard = (this.obstacles && this.obstacles.some(o => o.x === h.x && o.y === h.y))
            || (this.stamps && this.stamps.some(s => s.x === h.x && s.y === h.y));
        if (onHazard && this.snake.body.length > 1) this.snake.body.shift();

        // Shed `shedAmount`, in BOTH length and Data — from the LOGICAL body, which
        // includes any mass still folded from a PREVIOUS bounce. Assigning pendingUnfold
        // from the physical body alone discarded that fold while its Data stayed on the
        // score: two quick bounces minted permanent, spendable phantom Data. And the dock
        // is by what was ACTUALLY shed, never the flat shedAmount — a short worm used to
        // pay more Data than mass (a straight Data = Segments violation, both directions).
        // PASSENGER seats are never shed (they aren't Data): the fold keeps 1 + riders.
        const total = this.snake.body.length + this.pendingUnfold;
        const shed = Math.max(0, Math.min(this.shedAmount, total - 1 - this.riderCount));
        // Burst/salvage only the physically available portion (folded mass has no cells).
        const physAvail = Math.max(0, this.snake.body.length - 1 - this.riderCount);
        const burstN = Math.min(shed, physAvail);
        const shedCells = burstN > 0 ? this.snake.body.slice(this.snake.body.length - burstN) : [];
        if (burstN > 0) this.spawnBurst(shedCells);
        this.state.score = Math.max(0, this.state.score - shed);
        this.refreshScore();

        // FOLD: collapse the surviving body (total - shed) under the head. 2-Bit / the
        // module are positional (the tail), so they simply re-appear as the body
        // un-folds; nothing to protect.
        const head = { ...this.snake.head };
        this.snake.body = [head];
        this.pendingUnfold = Math.max(0, total - shed - 1);

        // Salvage Claws: NOW that the body has folded to [head], the shed cells are
        // vacated — drop a little of the crumpled mass there as re-collectible Data
        // (dropSalvage skips any cell still occupied, which is why it must run post-fold).
        this.dropSalvage(shedCells, 3);

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
        // A bounce is a "little death" — Cache's back-up daemon leans in for a moment.
        // Letter keys pressed in this window feed the death-code buffer (the ARG stays
        // solvable for Crumple owners). §2.6: the Renderer shows a text cue while open;
        // playCrack above is its audio twin.
        this._argListenMs = 2000;
    }

    // Locomotion tail handling: while the body is UN-FOLDING after a bounce, each move
    // extrudes one stored block (keep the tail) instead of the usual shrink.
    shrinkOrUnfold() {
        if (this.pendingUnfold > 0) { this.pendingUnfold--; return; }
        this.snake.shrink(this.riderCount);
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
        const shed = []; // (the floor — head + every passenger seat — is enforced by shrink)
        let remaining = n;
        // Spend any folded (post-bounce, not-yet-unfolded) mass FIRST — it's Data you own,
        // just collapsed — so the paid amount always comes off the LOGICAL length and can't
        // desync from Data if you buy mid-unfold.
        if (this.pendingUnfold > 0) {
            const fromFold = Math.min(remaining, this.pendingUnfold);
            this.pendingUnfold -= fromFold;
            remaining -= fromFold;
        }
        for (let i = 0; i < remaining; i++) {
            const tail = this.snake.body[this.snake.body.length - 1];
            if (!this.snake.shrink(this.riderCount)) break;
            shed.push({ ...tail });
        }
        if (shed.length) this.spawnBurst(shed);
        this.changeGear(0); // re-clamp gear to the lowered Data cap (no ghost max speed)
        this.refreshScore();
    }

    // Record one "continue" key (a death-screen continue OR a bounce-window letter) into
    // the rolling last-5 buffer, and summon Cache if it now spells her name. (Named keys
    // — Space/arrows — record as '·' on the death screen so they can't spell it; the
    // bounce window filters to letters before calling.)
    recordContinueKey(key) {
        const ch = key.length === 1 ? key.toUpperCase() : '·';
        this.deathCode = (this.deathCode + ch).slice(-5);
        if (this.deathCode === 'CACHE') this.summonCache();
    }




    // --- NPC bump handlers (registered in this.npcHandlers) -----------------------------






    // --- Cadenza's DA CAPO Encore (the music puzzle) -------------------------------------
    // Bump Cadenza to begin. She sings; you trace a ring of 8 nodes, striking each light IN
    // ORDER with your head (each a tuned square-wave note) while your BODY stays draped over
    // the ones you've struck so the chord sustains. Hold all eight ringing at once and she
    // seals it into Music Layer 1. One node is a "dead note" that can't sound until you bring
    // her the Lost Verse from out in the Wilds — so the finale is gated on a real find.









    // --- The Finite Wilds: the Kernel's coil (boundary sectors) -------------------------

    // How close is the head to the coil, in the current room? Sets the audio duck (the
    // world holds its breath) and the Renderer's deaf-legible twin (the room dims toward
    // the wall + a proximity readout). Runs once per grid step; the Hub is exempt.
    updateCoilProximity() {
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        if (rx === 0 && ry === 0) {
            if (this._coilNear) { this._coilNear = null; this.audio.setDuck(1); }
            return;
        }
        const g = this.gridSize, W = this.canvas.width, H = this.canvas.height;
        const head = this.snake.head;
        const felt = 6; // cells out at which the hush begins
        let best = 0;
        const dirs = [];
        const checks = [
            ['left', head.x / g],
            ['right', (W - g - head.x) / g],
            ['up', head.y / g],
            ['down', (H - g - head.y) / g],
        ];
        for (const [dir, dist] of checks) {
            if (!this.worldManager.isCoilWall(rx, ry, dir)) continue;
            dirs.push(dir);
            const p = Math.max(0, Math.min(1, (felt - dist) / felt));
            if (p > best) best = p;
        }
        if (!dirs.length) {
            if (this._coilNear) { this._coilNear = null; this.audio.setDuck(1); }
            return;
        }
        this._coilNear = { proximity: best, dirs };
        this.audio.setDuck(1 - 0.95 * best); // near-silence pressed against the sleeper
    }

    // --- MOTION CARRIED: the world moves on ITS OWN clock ------------------------------
    // One-way world-state flip (set when Gate smashes his way out of the Override):
    // Glitches drift on deterministic patterns, villagers wander, room furniture lists.
    // Everything is turn-locked to the WORLD step (WORLD_STEP ms/cell), not to yours —
    // shifting up must not make the world faster — and telegraphed by a static directional
    // notch (a11y: motion is coded by shape + position, never colour).

    _glitchMotionFor(i, rx, ry) {
        const h = (Math.imul((rx * 73856093) ^ (ry * 19349663) ^ ((i + 1) * 83492791), 2654435761)) >>> 0;
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const [dx, dy] = dirs[h % 4];
        return { kind: (h >>> 4) % 2 === 0 ? 'drift' : 'patrol', dx, dy, step: 0 };
    }

    // Is this cell inside a doorway lane (the cleared corridor aligned with any of the
    // room's weak points)? Listing furniture must never seal a door.
    _inDoorLane(x, y) {
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        for (const dir of ['up', 'down', 'left', 'right']) {
            const wp = this.worldManager.getWeakPoint(rx, ry, dir);
            if (!wp) continue;
            const c = (dir === 'up' || dir === 'down') ? x : y;
            if (c >= wp.start && c <= wp.end) return true;
        }
        return false;
    }

    // THE WORLD'S OWN CLOCK. Ambient drift used to ride the player's move-tick, which
    // meant shifting up made the whole world faster — at gear 3 (30ms/cell) a drifting
    // Glitch stepped every 60ms, well under human reaction time, so nothing that moved
    // could ever fairly touch you. Decoupling it fixes that at the root and pays the gear
    // system a dividend it never had: SPEED IS NOW EVASION. Cruise and you outpace the
    // world; brake to 200ms and the world outpaces YOU.
    //
    // Precedent: Denny's Fall-Through already chases on his own 40ms clock, and it's the
    // fight that reads best. Ambient drift is the slow half of the same idea; PURSUERS
    // (HUSH, Denny) keep their own faster clocks, because being chased is the point.
    get WORLD_STEP() { return 180; }        // ms per cell of ambient drift — just slower than gear 0
    get ENCROACH_COST() { return 1; }       // segments shed when the world runs into you
    get ENCROACH_COOLDOWN() { return 3; }   // world steps before the SAME mover can hit again

    _snakeAt(x, y) { return this.snake.body.some(s => s.x === x && s.y === y); }

    // ENCROACHMENT — something in the moving world ran into YOU.
    //
    // THE ASYMMETRY LAW: you moved into it, it can cost you; it moved into you, it costs
    // you no MORE, it never clears the hazard, and it may never end your run. A head-first
    // bite is 3 segments (1 with Reinforced Segments) AND splices the Glitch out of the
    // room for good; a shove is a flat 1 and leaves the drifter alive to come back after
    // the cooldown. So with Reinforced the two costs are equal in segments — what you buy
    // by charging corruption deliberately is that it stays dead.
    //
    // The cooldown is what stops a drifter pinned against a long body from machine-gunning
    // it one segment per step.
    _encroach(mover, { salvage = true } = {}) {
        // THE WORLD MAY BRUISE YOU, BUT IT MAY NOT REVOKE YOUR GEARBOX.
        // changeGear(0) below re-clamps to floor(score/10). A shove that crosses a 10-Data
        // boundary silently drops you out of gear 3 — and gear 3 is the ONLY clean wall
        // breach, so crossBorder then reads a ram you had already committed to as a
        // SUB-MAX SMASH, which IS die('border'). "Encroachment never kills" would have
        // held only in the letter: an ambient drifter could end a run with zero player
        // agency, and 29 Data cannot re-buy the gear to recover. Refuse those shoves.
        // (Verified by probe: at 30 Data in gear 3, charging a doorway, EVERY world-clock
        // phase offset ended in death before this guard.)
        const after = Math.max(0, this.state.score - this.ENCROACH_COST);
        if (Math.floor(after / 10) < Math.max(0, this.gear)) return false;
        if (mover._hitAt !== undefined && this._worldStep - mover._hitAt < this.ENCROACH_COOLDOWN) return false;
        mover._hitAt = this._worldStep;
        const shed = [];
        for (let i = 0; i < this.ENCROACH_COST; i++) {
            const tail = this.snake.body[this.snake.body.length - 1];
            if (this.snake.shrink(this.riderCount)) shed.push({ ...tail });
            else break; // the floor is passengers — the shove stops there, it never kills
        }
        if (!shed.length) return false;
        this.state.score = Math.max(0, this.state.score - shed.length); // Data = segments
        this.refreshScore();
        this.changeGear(0);          // re-clamp: no ghost max speed on lowered mass
        this.audio.playCorruptHit(); // §2.6: the shove is audible as well as visible
        // Nibble's Claws catch what corruption tears off — but HALF-RATE AND FLOORED, so a
        // shove is never refunded 1-for-1. dropSalvage pays ceil(n/2), which at
        // ENCROACH_COST 1 would hand the whole segment straight back and make the shove
        // free for any Claws owner. (A head-first bite still pays its 2-of-3.)
        if (salvage) this.dropSalvage(shed, Math.floor(shed.length / 2));
        return true;
    }

    updateWorldMotion(dt = 0) {
        if (!this.state.unlocked.motionCarried) return;
        // One step per frame at most, matching how moveTimer is driven — no burst-stepping
        // after a long frame, which would teleport hazards past the telegraph.
        this._worldTimer += dt;
        if (this._worldTimer < this.WORLD_STEP) return;
        this._worldTimer = 0;
        this._worldStep++;
        const g = this.gridSize;
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const cx = Math.floor(this.canvas.width / 2 / g) * g;
        const cy = Math.floor(this.canvas.height / 2 / g) * g;
        const inHub = rx === 0 && ry === 0;
        const finaleRoom = rx === 5 && ry === -5;

        // 1) Glitches drift — deterministic per room+index (they telegraph and stay
        // stable across deaths), blocked by everything, bouncing when they hit it.
        // The finale's corrupted cell is exempt: the funnel needs it to hold still.
        // Keep-out anchors: the Hub respawn, and the checkpoint spawn cell in {5,-4}.
        const chkRoom = rx === 5 && ry === -4 && this.state.unlocked.checkpointOpen;
        const spawnAnchorY = chkRoom ? Math.min(cy + 3 * g, this.canvas.height - g) : cy;
        const guardSpawn = inHub || chkRoom;
        if (!finaleRoom && this.glitches && this.glitches.length) {
            // Every world step — the drift menaces on its own clock, never on yours.
            for (let i = 0; i < this.glitches.length; i++) {
                const gl = this.glitches[i];
                if (!gl._m) gl._m = this._glitchMotionFor(i, rx, ry);
                const m = gl._m;
                const nx = gl.x + m.dx * g, ny = gl.y + m.dy * g;
                const nearSpawn = guardSpawn && Math.max(Math.abs(nx - cx), Math.abs(ny - spawnAnchorY)) <= 2 * g;
                // CORRUPTION RUNNING INTO YOU. It bites and recoils — it does not pass
                // through, and it does not enter your cell. Note this fires with the
                // Glitch Shunt installed too: the Shunt is a MOUTH, not armour. You eat
                // corruption by driving into it on purpose; corruption that blindsides
                // you is biting you.
                if (!nearSpawn && this._snakeAt(nx, ny)) {
                    this._encroach(gl);
                    m.dx = -m.dx; m.dy = -m.dy; m.step = 0;
                } else if (nearSpawn || this._moverBlocked(nx, ny)) {
                    m.dx = -m.dx; m.dy = -m.dy; m.step = 0; // bounce; step next tick
                } else {
                    gl.x = nx; gl.y = ny; m.step++;
                    // A patrol turns around AFTER its 3rd step — flip now so the stored
                    // vector (and its rendered notch) always shows the NEXT step.
                    if (m.kind === 'patrol' && m.step >= 3) { m.dx = -m.dx; m.dy = -m.dy; m.step = 0; }
                }
            }
        }

        // 2) Villagers WIGGLE — mostly still, an occasional single-cell shuffle around
        // home (radius 1, home-biased so they oscillate in place rather than roam).
        // Every 2nd world step. NO encroachment: they are people, and a neighbour
        // shuffling into you is not an attack. They simply don't take your cell.
        if (this._worldStep % 2 === 0) {
            for (const npc of this.npcs) {
                if (npc.id !== 'citizen' || npc.leaving) continue;
                if (!npc._home) npc._home = { x: npc.x, y: npc.y };
                if (Math.random() >= 0.25) continue;
                const away = npc.x !== npc._home.x || npc.y !== npc._home.y;
                let dx = 0, dy = 0;
                if (away) {
                    dx = Math.sign(npc._home.x - npc.x) * g;
                    dy = Math.sign(npc._home.y - npc.y) * g;
                    if (dx !== 0 && dy !== 0) dy = 0; // one axis per shuffle
                } else {
                    const dirs = [[g, 0], [-g, 0], [0, g], [0, -g]];
                    [dx, dy] = dirs[Math.floor(Math.random() * 4)];
                }
                const nx = npc.x + dx, ny = npc.y + dy;
                if (Math.max(Math.abs(nx - npc._home.x), Math.abs(ny - npc._home.y)) > g) continue;
                if (this._moverBlocked(nx, ny)) continue;
                npc.x = nx; npc.y = ny;
            }
        }

        // 3) Room furniture LISTS — every 4th world step one obstacle shifts a cell, never
        // into a doorway lane and never beside the head, so layouts drift without ever
        // sealing a route or ambushing anyone.
        //
        // The head keep-out STAYS, and it is doing something the shove rule cannot: head
        // contact with an obstacle is `die('obstacle')` on your next move-tick, so letting
        // furniture reach the head would be an unavoidable death rather than a shove.
        // Against your FLANK it just shunts you — it costs a segment and holds position.
        if (this.obstacles && this.obstacles.length && this._worldStep % 4 === 0) {
            const idx = Math.floor(this._worldStep / 4) % this.obstacles.length;
            const o = this.obstacles[idx];
            const h = ((o.x * 31 + o.y * 17 + rx * 7 + ry * 3) >>> 0);
            const dirs = [[g, 0], [-g, 0], [0, g], [0, -g]];
            const [dx, dy] = dirs[h % 4];
            const nx = o.x + dx, ny = o.y + dy;
            const hx = this.snake.head.x, hy = this.snake.head.y, d = this.input.direction;
            const nearHead = Math.abs(nx - hx) + Math.abs(ny - hy) <= g;
            // ...AND NEVER INTO THE LANE YOU ARE ALREADY DRIVING DOWN, at any distance.
            // The Manhattan keep-out above still left head+2 open, and at gear 3 that is
            // 60ms of warning for something that kills on contact (die('obstacle')) and —
            // unlike a Glitch — carries NO directional notch, so it is drawn identically
            // whether it is about to move or not. A block may drift across the room all it
            // likes; it may not step into your path ahead of you.
            const inLane = (d.x !== 0 && ny === hy && Math.sign(nx - hx) === Math.sign(d.x))
                        || (d.y !== 0 && nx === hx && Math.sign(ny - hy) === Math.sign(d.y));
            if (nearHead || inLane) {
                // stay put — never crowd the head, never enter its lane
            } else if (this._snakeAt(nx, ny)) {
                this._encroach(o, { salvage: false }); // furniture isn't corruption; no Claws
            } else if (!this._moverBlocked(nx, ny) && !this._inDoorLane(nx, ny)) {
                o.x = nx; o.y = ny;
            }
        }
    }

    // --- HUSH: the House Silence (Encore-gated guardian at {9,4}) -----------------------
    // Awake (Music Layer 0): a turn-locked pursuit hazard in the GC's idiom — one cell
    // per your step, homing on your head, CLAMPING segments off anything it reaches.
    // Survivable attrition, never a kill. The instant Cadenza's Locked Groove boots
    // (Layer 1 — a STATE flag, not audible output, so muted/Deaf play reads identically),
    // her tone is the one authorized waveform: HUSH logs itself redundant and collapses
    // into a static standby coil you simply walk past.









    // --- HEUR'S DECONTAMINATION: BREAKOUT WITH YOUR BODY (in-room, dedicated Bay {5,-1}) ---
    // NOT a modal minigame — you play as your normal snake in the SEALED bay. Heur's
    // scan-ping (the ball) ricochets off its signature-database BRICKS, YOUR BODY, and
    // EVERY wall. The ping is fully CONTAINED — it can never be lost past you (owner:
    // the goal wall stays shut), so the tension is not "don't miss".
    //
    // WHAT MAKES YOU PLAY, then, is the ARMING RULE: a seal on Heur only breaks while the
    // ping is still carrying YOUR contact (HEUR_HOT steps since it last touched your
    // body). You cannot win by standing back and letting it rattle. Your body's job is to
    // ARM and AIM, not to save — and the aim is real: the struck segment's index sets the
    // ping's angle (_heurSpin), so catching it nearer the head throws it flatter.
    //
    // THE STAKES ARE LETHAL (owner). The ping reading your HEAD is a wall touch, and so is
    // driving your head into any brick — the database is solid, you cannot swim through
    // it. Both route through die('border'), so the Crumple Buffer still catches them. The
    // ping steps on its OWN 150ms clock, never your gearbox, which is what keeps a lethal
    // head fair at any speed.
    //
    // Losing is therefore possible, but never mandatory: you may always RETREAT back out
    // the way you came (crossBorder's seal lets the entry door through, ending the fight
    // with no penalty) and re-enter — he says "Encore." and rebuilds it.










    // --- THE ASCENT: Beat 7 and the rematches up the north spine ------------------------















    // --- THE REFUGEE ECONOMY: carry the scattered home; choose their fate ---------------
    // Localhost starts empty. Refugees wait in fixed Wilds rooms; bumping one takes them
    // aboard (they ride your tail exactly as 2-Bit did — a passenger segment, protected
    // from every shrink). At Localhost, bump THE COMMONS to free them (they repopulate
    // the town and boost Quantcy) or THE DATA MINE to put them to work (passive income,
    // the dark tally). The Freed/Mined counters are durable and feed the Act II ending.





    // --- QUANTCY'S TRUST: the Wilds bank (active compounding investment) ----------------
    // Deposits run through the normal shop spend (Data = segments: you SHRINK by what you
    // bank, and your gear cap drops with you). The vault is off-body and death-proof; a
    // withdrawal materializes motes HERE, in his Wilds room — the carry home is the risk.














    // --- Boot file-select menu (New Game / Load across 3 save files) -------------------

    // --- Accessibility / Options overlay ------------------------------------------------










    // The Pause-Menu inventory: every owned upgrade and module by display name (the
    // convention-standard equipment screen). Built only while PAUSED.
    _buildInventory() {
        const u = this.state.unlocked, up = this.state.upgrades;
        const N = INVENTORY_NAMES;
        const upgrades = Object.keys(N.upgrades).filter(k => up[k]).map(k => N.upgrades[k]);
        if (up.crumpleLevel > 0) upgrades.push(N.crumple[Math.min(up.crumpleLevel, N.crumple.length) - 1]);
        upgrades.push(...Object.keys(N.saves).filter(k => u[k]).map(k => N.saves[k]));
        const modules = Object.keys(N.modules).filter(k => u[k]).map(k => N.modules[k]);
        if ((u.pinShapes || 0) > 1) modules.push(`Pin Shapes x${u.pinShapes}`);
        return { upgrades, modules };
    }

    // The durable-upgrade count, shared by the file-select summary and Hydratia's
    // death-screen receipt (one computation — the two can never drift).
    countMods() {
        const up = this.state.upgrades, u = this.state.unlocked;
        return ['dataCompression', 'dataCompression2', 'reinforcedSegments', 'pivot', 'scanner',
                'corruptHandler', 'salvage', 'glitchWard'].filter(k => up[k]).length
            + (up.crumpleLevel > 0 ? 1 : 0)
            + ['autosaveSafe', 'autosaveDeath', 'autosaveEvery'].filter(k => u[k]).length;
    }







    // EVERY per-fight / per-run hazard transient, cleared in ONE place. die(), applySave()
    // and resetToNewGame() used to each hand-maintain this list, and the three copies
    // diverged twice — most recently _finale/_gate3Blocks were on none of them, so dying
    // to Gate's ring painted ghost hazards over the respawn room and re-entering Port 0
    // resumed the previous attempt's walls mid-room. New fight state gets added HERE or
    // nowhere.
    resetBattleTransients() {
        this.stamps = [];
        this._tailPrev = null;
        this._stampStun = 0;
        this._ovr = null;           // Gate's ring state (incl. its entry hold)
        this._gate3Blocks = null;   // ...and the ring's live block cells
        this._finale = null;        // Port 0's advancing walls (clean retry by contract)
        this.heur = null;           // the decontamination fight
        this._coilNear = null;      // the coil's held breath
        this._wardUsedThisRoom = false; // Scale Mods' per-room absorb
        this._argListenMs = 0;      // the bounce ARG window
        this._shakeMs = 0;          // no impact rattle survives its impact
        this._auditionLayer = null; // the M-key music preview re-syncs on any reset
        this._textHold = false;     // the post-text hold (input.reset covers the rest)
        this.gearInstall = null;    // 2-Bit's gearbox beat must never outlive its scene
        this.audio.setDuck(1);
    }

    die(cause = 'unknown') {
        // Callers that mean "a wall-grade hit" historically pass 'border'; the death
        // tally, the Architect's gloat and Hydratia's coaching all speak 'wall'.
        // Normalize at the ONE entry point so no caller can fall through to the
        // unknown-cause counter (which is reserved for genuinely uncaused deaths).
        if (cause === 'border') cause = 'wall';
        // NEW DEATH MODEL. With the Crumple Buffer upgrade you survive a hit (shed + fold
        // + bounce) instead of dying — but you need mass to shed. No buffer, or nothing
        // left to shed -> back to the beginning (full reset to the Hub).
        if (this.state.upgrades.crumpleLevel > 0 && this.snake.body.length > 1) {
            this.bounce();
            return;
        }

        // HYDRATIA'S LAST BREATH — snapshot the durable set the instant before the wipe.
        // serialize() cannot contain score, so this saves PROGRESS, never carried Data.
        if (this.state.unlocked.autosaveDeath) this.autoCommit();

        const cx = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
        const cy = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;

        // THE CHECKPOINT RESPAWN: once Cache has committed you (checkpointOpen), death
        // returns you to Cold Storage {5,-4} — not the Hub — and her one-way door
        // re-opens (the whole reason the Save gate exists). Seated a few cells south
        // of centre so you never re-materialize on top of the archivist.
        const toCheckpoint = !!this.state.unlocked.checkpointOpen;
        const spawnY = toCheckpoint ? Math.min(cy + 3 * this.gridSize, this.canvas.height - this.gridSize) : cy;

        this.audio.playDeath(); // ONE death cue for every cause (border/self/obstacle/glitch)
        this.state.gameState = 'DEAD';
        this.snake.reset(cx, spawnY, this.hasBiteSegment);
        this.input.reset();
        this.state.resetScore();
        this.pendingUnfold = 0;     // a fresh run isn't mid-unfold
        this.gear = 0;              // fresh runs start from a standstill (sub-smash
        this.speed = this.baseSpeed; // deaths would otherwise respawn you mid-gear)
        this._wallBonking = false;
        this.resetBattleTransients();
        // A carried refugee is LOST with the run — but never gone: their origin room was
        // never marked delivered, so they respawn back home, shaken, carryable again
        // (the wholesale room wipe below regenerates their home WITH them in it).
        this.carriedRefugee = null;
        if (toCheckpoint) {
            this._diedSinceCheckpoint = true;
            // The seam re-opens only once you've breached it before (finale retries must
            // never demand a gear-3 re-ram from a score-0 respawn — that would soft-lock).
            if (this.state.unlocked.finaleDoorFound) {
                this.worldManager.brokenWalls.add(this.worldManager.boundaryKey(5, -4, 'up'));
            }
        }

        // CORRUPTION REGROWS WITH THE RUN (owner, from playtest). Room state was cached
        // for the whole session, so every Glitch you cleared stayed cleared through death
        // after death — the world quietly got safer the more you failed, which is exactly
        // backwards for an incremental. Dropping the room cache re-seeds corruption from
        // the generator. It is safe to drop wholesale because a room's CONTENT is derived
        // from the durable `unlocked` set: broken walls live in worldManager.brokenWalls,
        // landmarks/questlines/refugee homes regenerate from their flags, and anything you
        // permanently took is recorded as an unlock — so nothing you EARNED comes back,
        // only what the world grows on its own (which includes the growth caches: owner
        // ruling, they regenerate with the run). (The old pre-wipe saveRoom + per-refugee
        // cache invalidation that stood here were no-ops behind this line and were removed
        // — if this wipe is ever narrowed, that logic has to come back.)
        this.worldManager.rooms = {};

        // ...with ONE exception the wipe would strand: Denny's dropped-but-unclaimed map.
        // The mapitem NPC exists only in the room cache (never regenerated), while the
        // one-shot `dennyMapDropped` is durable — so a death between drop and pickup left
        // the flag pointing at a map that no longer exists, and Denny refused to re-drop
        // forever. Same rescue the load path already performs (applySave).
        const u2 = this.state.unlocked;
        if (u2.dennyMapDropped && this.carriedModule !== 'map' && !u2.mapModule) {
            u2.dennyMapDropped = false;
        }

        this.worldManager.currentRoomX = toCheckpoint ? 5 : 0;
        this.worldManager.currentRoomY = toCheckpoint ? -4 : 0;

        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        if (!this.apple) this.apple = this.spawnApple(); // a wandered-off apple re-arms
        this._roomEntryDir = { x: 0, y: 0 }; // a respawn has no entry door

        // Don't respawn on/next to durable Glitches that drifted into the hub (you can
        // farm apples here with biteProgress>0, and glitches persist) — that would
        // chain-death spawn-camp you. Clear any within 2 cells of the spawn point and
        // write the cleaned set back into the cached room so it stays clear.
        const g = this.gridSize;
        // Anchor the clearing ring on the ACTUAL spawn cell (spawnY — offset 3 south of
        // centre at the checkpoint), not the room centre, so nothing camps the respawn.
        this.glitches = this.glitches.filter(gl =>
            Math.max(Math.abs(gl.x - cx) / g, Math.abs(gl.y - spawnY) / g) > 2
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

        // The Architect's gloat — with a special observation when you die having MET
        // 2-Bit but never hooked him aboard (relieved the two of you haven't figured
        // out cooperation; fires once per run).
        this.narrative.onDeath(cause, {
            nearBite: this.state.unlocked.biteProgress >= 1 && !this.state.unlocked.tailRider,
            unlocked: this.state.unlocked, // so he can gloat about the leads you haven't found
        });

        // HYDRATIA'S RECEIPT — the DEAD overlay's second voice (the Architect keeps his
        // gloat in the terminal). Slot A reassures with what PERSISTED (the durable set —
        // making decision 1's kept-half visible at the exact moment the loss stings);
        // Slot B coaches on the cause, escalating (tier 2) once a cause has killed you 3+
        // times. Computed AFTER onDeath so the per-cause tally includes this death.
        const tally = this.narrative.deathByCause;
        const causeKey = HYDRATIA_DEATH.hint[cause] ? cause : 'unknown';
        const tier = (tally[causeKey] || 1) >= 3 ? 1 : 0;
        this._deathReceipt = {
            // Her NAME only appears once you've caught her (owner) — before that the
            // receipt is an unattributed system line (the mystery does the work).
            line: this.state.unlocked.hydratiaFound ? HYDRATIA_DEATH.receipt : HYDRATIA_DEATH.receiptUnmet,
            hint: HYDRATIA_DEATH.hint[causeKey][tier],
            walls: this.worldManager.brokenWalls.size,
            modules: ((this.state.unlocked.modulesFound || []).length) + (this.state.unlocked.mapModule ? 1 : 0),
            mods: this.countMods(),
        };
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

    // The gear gauge in the TOP RIBBON, beside your Data (game convention: the HUD stats
    // live together). 2-Bit installs it with the gearbox. Label + three pips (+ Redline's
    // numeric limit); brake reads BRK. DOM writes only when the reading changes.
    refreshGearDisplay() {
        const el = document.getElementById('gear-display');
        if (!el) return;
        const show = this.state.unlocked.ui && this.state.unlocked.gearMeter;
        const gear = this.gear;
        const lim = Math.min(3, Math.floor(this.state.score / 10));
        const key = `${show}|${gear}|${this.state.unlocked.redline ? lim : '-'}`;
        if (key === this._gearHudKey) return;
        this._gearHudKey = key;
        el.classList.toggle('hidden', !show);
        if (!show) return;
        let html = `<span class="gear-label${gear < 0 ? ' brake' : ''}">${gear < 0 ? 'BRK' : 'GEAR'}</span>`;
        for (let i = 1; i <= 3; i++) {
            // REDLINE greys out the gears your mass can't license (simpler than a
            // numeric readout — the gauge itself says what's reachable).
            const locked = this.state.unlocked.redline && i > lim;
            html += `<span class="gear-pip${gear >= i ? ' on' : ''}${gear >= i && i === 3 ? ' top' : ''}${locked ? ' locked' : ''}"></span>`;
        }
        el.innerHTML = html;
    }
    
    draw() {
        this.refreshGearDisplay(); // the ribbon gauge (cheap: writes only on change)
        this.refreshBossStatus();  // encounter status lives in the bottom ribbon, not on the canvas
        this.state.gear = this.gear;
        this.state.carriedModule = this.carriedModule;
        this.state.moduleSlotX = this.moduleSlotX;
        this.state.moduleSlotY = this.moduleSlotY;
        this.state.moduleLoad = this.moduleLoad;
        this.state.gearInstall = this.gearInstall; // 2-Bit fitting the gearbox
        this.state.mapCell = this.carriedModule ? this.mapCell() : null;
        this.state.biteIndex = this.biteIndex; // which segment wears 2-Bit's face
        this.state.refugeeIndex = this.refugeeIndex; // which segment wears the refugee's
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
        // Hydratia's boot-screen glimpse (START only): stage 0 = a sliver at the right
        // edge, each quick reload ~8% further in; stage 4 = reachable.
        // Stage 0 sits just INSIDE the right edge (she peeks; the sprite clips) and each
        // stage pulls her ~9% further in. She used to start a hair off-canvas at a 6px
        // radius, which read as nothing at all.
        this.state.hydratia = (this.state.gameState === 'START' && this._hydratia)
            ? { stage: this._hydratia.stage, catchable: this._hydratia.catchable,
                x: Math.round(this.canvas.width - this.canvas.width * (0.03 + 0.09 * this._hydratia.stage)) }
            : null;
        this.state.argListenMs = this._argListenMs;      // the bounce ARG's listening cue
        // The listening cue only draws once the ARG is PRIMED (2-Bit's Cache gossip is
        // topic one) — before that, a wall-bounce flashing 'listening' is just confusing
        // noise that spoils the secret. The window itself always works.
        this.state.argCuePrimed = (this.state.biteTopicsHeard || 0) >= 1 || this.state.unlocked.cacheFound;
        this.state.carriedRefugee = this.carriedRefugee; // passenger readout (HUD)
        this.state.deathReceipt = this.state.gameState === 'DEAD' ? this._deathReceipt : null;
        // The Pause-Menu inventory (Zelda-style: what you own, by name).
        this.state.inventory = this.state.gameState === 'PAUSED' ? this._buildInventory() : null;
        this.state.reduceMotion = this.settings.reduceMotion; // Renderer dampens pulses/blinks
        this.state.options = this.optionsOpen ? { index: this.optionsIndex, settings: this.settings } : null;
        this.state.encore = (this.state.gameState === 'ENCORE' && this.encore) ? this.getEncoreRenderState() : null;
        this.state.heur = this.heur ? this.getHeurRenderState() : null;
        this.state.headCell = { x: this.snake.head.x, y: this.snake.head.y }; // Heur read-head warning outline
        this.state.stamps = this.stamps;           // Denny's DENIED stamps
        this.state.coilNear = this._coilNear;      // the coil approach (deaf-legible dim + readout)
        this.state.citation = this._citationLabel(); // THE GATE's ribbon readout ({5,-3})
        this.state.shake = this.settings.reduceMotion ? 0 : this._shakeMs; // impact rattle
        // Gate's two space-rewriting hazards, for the Renderer: the Override's rotating
        // ring and Port 0's advancing walls. Both draw in his firewall blue.
        this.state.gateBlocks = this._gate3Blocks;
        this.state.finaleWalls = this._finale ? this._finaleWallCells() : null;
        this.state.mapPins = this.mapPins;         // Map-Pins annotations for the minimap
        this.state.roomX = this.worldManager.currentRoomX; // sector readout + pin-on-current-room
        this.state.roomY = this.worldManager.currentRoomY;
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
        if (this._argListenMs > 0) this._argListenMs = Math.max(0, this._argListenMs - dt); // close the bounce listen window
        if (this._shakeMs > 0) this._shakeMs = Math.max(0, this._shakeMs - dt);             // settle the screen shake

        this.update(dt);
        this.draw();

        requestAnimationFrame((ts) => this.loop(ts));
    }






}

// --- MIXINS ------------------------------------------------------------------------
// GameEngine was a 4,137-line god object, which is why every new feature reached into
// the same file and every bug landed in the same blast radius. Three cohesive layers
// now live in their own modules and are grafted back onto the prototype here:
//
//   encounters.js — the set-pieces (the Encore, HUSH, Heur's Bay, the Ascent, Port 0)
//   boot.js       — start(), the title cameos, the file menu, Options, save/load
//   npcs.js       — every bump handler, both shops, Cache's questline, the economy
//
// defineProperties + getOwnPropertyDescriptors (rather than Object.assign) is
// deliberate: it preserves GETTERS as getters instead of copying their evaluated
// values. `this` is still the engine inside every method, so NO call site changes —
// not in src, not in the 331 tests. Verified: the prototype exposes the same 153
// members, of the same kinds, as it did before the split.
//
// Adding a method to one of these layers means adding it to that module's object
// literal (comma-separated — object syntax, not class syntax).
Object.defineProperties(GameEngine.prototype, Object.getOwnPropertyDescriptors(EncounterMethods));
Object.defineProperties(GameEngine.prototype, Object.getOwnPropertyDescriptors(BootMethods));
Object.defineProperties(GameEngine.prototype, Object.getOwnPropertyDescriptors(NpcMethods));
