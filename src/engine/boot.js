// BOOT, MENUS & PERSISTENCE — the layer that runs before (and around) the simulation.
// Mixed onto GameEngine.prototype (see Game.js): `this` is the engine, every call
// surface is unchanged.
//
//   * start() and the title cameos (Cache's walk-on, Cadenza's, Hydratia's catch)
//   * the boot file-select menu (New Game / Load / Warm Restore / erase)
//   * the Accessibility Options overlay
//   * serialize / applySave / saveGame / loadGame — what persists across a death and
//     across a session (the durable `unlocked` set; never score)

import { StateManager } from '../state/StateManager.js';
import { CACHE, CADENZA_TITLE, CACHE_CHECKPOINT, HYDRATIA_CATCH } from '../content/dialogue.js';

export const BootMethods = {

    start() {
        // No auto-load: the boot screen presents a file-select menu (New Game / Load) when
        // any save file exists; a brand-new player gets the bare "press any key" cold open.
        // Default the cursor to the first occupied file so ENTER continues your progress.
        const slots = this.saveManager.slots();
        const firstFilled = slots.findIndex(s => s.exists);
        this.startMenuIndex = firstFilled >= 0 ? firstFilled : 0;
        this.maybeStartTitleCameo();
        this.maybeStartHydratiaCatch();
        this.lastTime = performance.now();
        requestAnimationFrame((ts) => this.loop(ts));
    },

    // HYDRATIA'S CATCH — the shy persistence daemon, glimpsed at the screen edge on boot.
    // Reload the page within ~10s and she starts CLOSER; four quick reloads in a row and
    // she holds still long enough to reach ([SPACE] on the file menu). Diegetically: a
    // process restart catches her mid-round; do it again before she's re-hidden and she
    // has less time to hide. Global (cross-file), like the title cameos. The '11,2' lore
    // fragment is the planted clue. Silent (decision 3: no boot audio) and motion-free
    // (she's a static mote per boot — nothing animates, so reduce-motion needs no branch).
    maybeStartHydratiaCatch() {
        const sm = this.saveManager;
        if (sm.hasHydratiaCaught()) { this._hydratia = null; return; }
        const now = Date.now();
        const last = sm.hydratiaBoot();
        let approach = sm.hydratiaApproach();
        // THE HIDE TIMER (owner: keep it): a QUICK reload (<= ~10s) catches her mid-round
        // and she starts closer; a slow, deliberate boot lets her re-hide — except once
        // she's already reachable (stage 4 persists: no lost chance, ever).
        if (last && now - last <= 10000) approach = Math.min(4, approach + 1);
        else if (approach < 4) approach = 0;
        sm.setHydratiaBoot(now);
        sm.setHydratiaApproach(approach);
        // She haunts EVERY boot screen — the bare "press any key" cold open included
        // (owner: she must load even before the Start Screen exists). Only a title
        // cameo owning the screen suppresses her for that boot.
        if (this.titleCameo) { this._hydratia = null; return; }
        this._hydratia = { stage: approach, catchable: approach >= 4 };
    },

    // Her catch dialog (shared by the file menu AND the bare cold open): the modal
    // cameo path owns the keyboard while she talks; catching her is global.
    _startHydratiaCatchDialog() {
        this._hydratia = null;
        this.startCameoActive = true;
        this.dialogManager.start(HYDRATIA_CATCH, () => {
            this.startCameoActive = false;
            this.saveManager.markHydratiaCaught();
            this.state.unlocked.hydratiaFound = true;
            // Her stall seats itself in Localhost on the next room build; if a cached
            // Localhost exists this session, rebuild it with her in it.
            delete this.worldManager.rooms[this.worldManager.getRoomKey(5, 0)];
        });
    },

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
    },

    // Once the Encore is done, the Void Ambient (Cadenza's somber piece) loops under the title
    // menu. Started on the first menu key (Web Audio needs the gesture); stopped when a run begins.
    maybeStartVoidAmbient() {
        if (this.startMenuActive() && this.saveManager.hasEncoreUnlocked()) this.audio.startVoidAmbient();
    },

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
    },

    // Apply the audio settings (mute wins over volume). Reduce-motion is read by the Renderer.
    applySettings() {
        this.audio.setVolume(this.settings.muted ? 0 : this.settings.volume);
    },

    // Toggle the Options overlay (freezes the sim while open; persists settings on close).
    toggleOptions() {
        this.optionsOpen = !this.optionsOpen;
        if (this.optionsOpen) { this.audio.init(); this.optionsIndex = 0; }
        else { this.saveManager.saveSettings(this.settings); }
    },

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
    },

    // The menu is live only on the START screen and only once at least one file exists;
    // a brand-new player gets the bare "press any key" cold open instead.
    startMenuActive() {
        return this.state.gameState === 'START' && this.saveManager.anySave();
    },

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
        } else if (key === 'r' || key === 'R') {
            // WARM RESTORE — load Hydratia's auto-buffer instead of the manual file, when
            // hers is newer. Opt-in only: the manual file is never auto-clobbered; you
            // choose her copy or Cache's, per boot.
            const sel = slots[this.startMenuIndex];
            if (sel.autoSavedAt && sel.autoSavedAt > (sel.savedAt || 0)) {
                this.startMenuConfirmErase = null;
                this.loadAutoSlot(sel.slot);
            }
        } else if (key === 'Delete' || key === 'Backspace' || key === 'x' || key === 'X') {
            const sel = slots[this.startMenuIndex];
            if (!sel.exists) return;
            if (this.startMenuConfirmErase === sel.slot) {
                this.saveManager.clear(sel.slot);
                this.startMenuConfirmErase = null;
                this.audio.playCrack();
                // Erasing the LAST file restores the fresh-start contract: the one-time
                // title cameos and Hydratia's chase come back for the next new player.
                // (Without this they were burned forever by the first newGame/load — the
                // playtest report "I no longer get the Cache or Cadenza cutscenes".)
                if (!this.saveManager.anySave()) {
                    this.saveManager.resetIntroFlags();
                    this.state.unlocked.hydratiaFound = false;
                    this.maybeStartTitleCameo();
                    this.maybeStartHydratiaCatch();
                }
            } else {
                this.startMenuConfirmErase = sel.slot; // arm; a second DEL confirms
            }
        }
    },

    // Start a fresh run bound to a save file. Does NOT erase the file's stored data — it
    // only starts a new game; the slot is overwritten when you next save into it.
    newGame(slot) {
        this.activeSlot = slot;
        this.saveManager.markCameoSeen(); // reaching the menu counts as seeing the cameo
        if (this.titleCameo && this.titleCameo.who === 'cadenza') this.saveManager.markCadenzaCameoSeen();
        this.audio.stopVoidAmbient(); // the title piece ends when a run begins
        this.resetToNewGame();
        this.state.gameState = 'PLAYING';
    },

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
    },

    // Warm Restore: identical to loadSlot but sourcing Hydratia's auto-buffer.
    loadAutoSlot(slot) {
        const d = this.saveManager.loadAuto(slot);
        if (d && this.applySave(d)) {
            this.activeSlot = slot;
            this.saveManager.markCameoSeen();
            if (this.titleCameo && this.titleCameo.who === 'cadenza') this.saveManager.markCadenzaCameoSeen();
            this.audio.stopVoidAmbient();
            this.state.gameState = 'PLAYING';
            return true;
        }
        return false;
    },

    // Reset every run/world/progress field to a pristine "new worm in the Void" state,
    // WITHOUT touching localStorage (the file is only written when you save). Subsystems
    // (shopManager, narrative) hold this.state, so we reset its fields in place rather than
    // replacing the object.
    resetToNewGame() {
        this.audio.stopMusic(); // a fresh run starts from silence (Layer 0)
        const fresh = new StateManager();
        Object.assign(this.state.unlocked, fresh.unlocked);
        Object.assign(this.state.upgrades, fresh.upgrades);
        // Hydratia's catch is GLOBAL (cross-file, like the title cameos): a fresh run
        // must re-mirror it or her stall silently vanishes from every New Game.
        this.state.unlocked.hydratiaFound = this.saveManager.hasHydratiaCaught();
        this.state.score = 0;
        this.state.biteTopicsHeard = 0;
        this.state.isSuspended = false;
        this.deathCode = '';
        this.mapPins = {};

        // Fresh, unopened world.
        this.worldManager.rooms = {};
        this.worldManager.brokenWalls = new Set();
        this.worldManager.wallDamage = {};
        this.worldManager.scannerReveals = {};
        this.worldManager.scannerBeyond = {};
        this.worldManager.resetRomSeals(); // a fresh run's checkpoint door is write-protected again
        this.worldManager.currentRoomX = 0;
        this.worldManager.currentRoomY = 0;
        this._auditionLayer = null;

        const cx = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
        const cy = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
        this.snake.reset(cx, cy, false);
        this.input.reset();
        this.gear = 0; this.speed = this.baseSpeed; this.moveTimer = 0; this.pendingUnfold = 0;
        this.carriedModule = null; this.moduleLoad = null; this.bursts = []; this.dataMotes = [];
        this.onUnpauseCallback = null; this._guided = new Set(); this._tick = 0;
        this._wallBonking = false; this._beaconTimer = 0; this._saveFlash = 0;
        this.stamps = []; this._tailPrev = null; this._stampStun = 0; this._ovr = null;
        this.heur = null; this._coilNear = null; this._diedSinceCheckpoint = false;
        this._argListenMs = 0; this.carriedRefugee = null;
        this.audio.setDuck(1);

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
    },

    // Short display summary written into a save file for the file-select screen: how far
    // you got + how many mods you own. (Score/length aren't restored, so we don't show them.)
    saveMeta() {
        const u = this.state.unlocked;
        let place = 'The Void';
        if (u.borders) place = 'The Wilds';
        if (u.pauseMenu) place = 'The Firewall';
        if (u.biteDroppedOff) place = 'Localhost';
        if (u.cadenzaFound) place = 'Cadenza';
        if (u.cacheStage >= 3) place = 'Cold Storage';
        if (u.purgeComplete) place = 'The Ascent';
        if (u.checkpointOpen) place = 'The Checkpoint';
        if (u.finaleDone) place = 'Act II - 16-bit';
        return { place, mods: this.countMods() };
    },

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
            mapPins: { ...this.mapPins }, // Map-Pins annotations (durable)
            carriedModule: this.carriedModule, // a picked-up-but-uninstalled module must survive a load
            world: {
                brokenWalls: [...this.worldManager.brokenWalls],
                wallDamage: { ...this.worldManager.wallDamage },
            },
            meta: this.saveMeta(), // display summary for the file-select screen
        };
    },

    applySave(d) {
        if (!d) return false;
        // Reset to fresh defaults BEFORE merging the save: a load is a fresh run, and a save
        // written before a progression flag existed omits that key — a bare merge would then
        // leave the live-true flag set, leaking post-save progress into the loaded run.
        const fresh = new StateManager();
        Object.assign(this.state.unlocked, fresh.unlocked, d.unlocked || {});
        Object.assign(this.state.upgrades, fresh.upgrades, d.upgrades || {});
        // RETCON MIGRATION: {2,2} used to grant the gear meter (now default-on with
        // driving) and holds the Redline module instead. A pre-sprint save that already
        // collected that room ('2,2' in modulesFound) gets the replacement grant — the
        // room stays suppressed, so without this the module would be unobtainable.
        if ((this.state.unlocked.modulesFound || []).includes('2,2')) this.state.unlocked.redline = true;
        this.state.biteTopicsHeard = d.biteTopicsHeard || 0;
        this.deathCode = d.deathCode || '';
        this.mapPins = d.mapPins ? { ...d.mapPins } : {};
        if (d.world) {
            this.worldManager.brokenWalls = new Set(d.world.brokenWalls || []);
            this.worldManager.wallDamage = d.world.wallDamage || {};
        }
        // A load starts a fresh run in the Hub with the restored progress. Wipe cached
        // rooms so they regenerate from the restored flags, and clear the previous run's
        // Scanner reveals and Architect-guidance memory so their one-shots can replay.
        this.worldManager.rooms = {};
        this.worldManager.scannerReveals = {};
        this.worldManager.scannerBeyond = {};
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
        this.stamps = []; this._tailPrev = null; this._stampStun = 0; this._ovr = null;
        this.heur = null; this._coilNear = null; this._diedSinceCheckpoint = false;
        this._auditionLayer = null; this._wardUsedThisRoom = false;
        this._argListenMs = 0; this.carriedRefugee = null;
        this.audio.setDuck(1);
        // Hydratia's catch is a GLOBAL (cross-file) discovery: mirror it into this run's
        // flags so RoomGenerator can seat her stall in Localhost.
        this.state.unlocked.hydratiaFound = this.saveManager.hasHydratiaCaught();
        // The checkpoint door's state is derived from flags, not stored: reset the ROM
        // seals to baseline, then re-derive — committed = unsealed; once-breached =
        // standing open (a load must never demand a gear-3 re-ram from a fresh worm).
        this.worldManager.resetRomSeals();
        if (this.state.unlocked.checkpointOpen) {
            this.worldManager.unsealRomDoor(5, -4, 'up');
            if (this.state.unlocked.finaleDoorFound) {
                this.worldManager.brokenWalls.add(this.worldManager.boundaryKey(5, -4, 'up'));
            }
        }
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
        this.audio.setMusicLayer(this.state.unlocked.musicLayer || 0); // sync the soundtrack to the loaded layer (0 = silence)
        return true;
    },

    saveGame() {
        const ok = this.saveManager.save(this.activeSlot, this.serialize());
        this.flashSave(ok ? `SAVED - FILE ${this.activeSlot}` : 'SAVE FAILED');
        // Cold Storage: a committed save while the Ascent is armed is exactly what Cache
        // demanded. The moment you're FILED she breaches the one-way door north — and the
        // committed checkpoint becomes the finale's respawn. (Re-save immediately so the
        // file itself carries the opened-checkpoint state.)
        if (ok && !this.state.unlocked.checkpointOpen && this.state.unlocked.purgeComplete
            && this.worldManager.currentRoomX === 5 && this.worldManager.currentRoomY === -4) {
            this.state.unlocked.checkpointOpen = true;
            // Committing here settles her whole questline: the Hub apparition retires
            // (she IS here, filing you) — consistent with the demand branch.
            if (this.state.unlocked.cacheStage < 3) this.state.unlocked.cacheStage = 3;
            this.state.unlocked.cacheFound = true;
            // She lifts the WRITE-PROTECTION — she doesn't open the door. The seam
            // stays a hidden Scanner door: sweep the north wall to light it, then
            // breach it at max gear. (ROM doesn't do doors.)
            this.worldManager.unsealRomDoor(5, -4, 'up');
            this.saveManager.save(this.activeSlot, this.serialize());
            this.audio.playMaterialize(); // something older than the Architect lets go
            this.onUnpauseCallback = () => {
                this.state.gameState = 'DIALOG';
                this.dialogManager.start(CACHE_CHECKPOINT.breach, () => { this.state.gameState = 'PLAYING'; });
            };
        }
    },

    loadGame() {
        const d = this.saveManager.load(this.activeSlot);
        if (d && this.applySave(d)) {
            this.state.gameState = 'PLAYING';
            this.flashSave(`LOADED - FILE ${this.activeSlot}`);
        } else {
            this.flashSave('NO SAVE');
        }
    },

    flashSave(msg) { this._saveFlashMsg = msg; this._saveFlash = 1400; },
};
