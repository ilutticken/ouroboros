// THE CAST & THE ECONOMY — every NPC bump handler, both shops, and the two currencies.
// Mixed onto GameEngine.prototype (see Game.js): `this` is the engine, every call
// surface is unchanged. Handlers are registered by npc.id in the constructor's
// npcHandlers registry — adding a character is one line there plus a method here.
//
// LAW: bumps are MASS-NEUTRAL (talking never docks length) and every handler resolves
// one bump then stops the tick.

import { NPC } from '../entities/NPC.js';
import { TWO_BIT, GATE, DENNY, CACHE, CADENZA_ENCORE, CADENZA_SCENE, NIBBLE, CACHE_CHECKPOINT, UI_MODULES, QUANTCY, REFUGEE_ATTACH, REFUGEE_BUSY, INTAKE, LOCALHOST_CITIZENS, HYDRATIA_STALL } from '../content/dialogue.js';

export const NpcMethods = {

    // Bumping 2-Bit's stall. Before the shop opens he drip-feeds ONE gossip topic
    // (biteTopics — clustered around the missing villagers) so the exposition is
    // paced across visits instead of dumped. Once he's out of stories it's straight
    // to shopping. state.biteTopicsHeard persists across deaths (it's knowledge).
    openBiteShop() {
        const openShop = () => {
            this.state.gameState = 'SHOP';
            this.shopManager.open('bite', () => { this.state.gameState = 'PLAYING'; });
        };
        const heard = this.state.biteTopicsHeard || 0;
        if (heard < this.biteTopics.length) {
            this.state.biteTopicsHeard = heard + 1;
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(this.biteTopics[heard], openShop);
        } else {
            openShop();
        }
    },

    // Nibble's black-market stall. Like 2-Bit's, a real shop overlay — her lineup lives
    // in ShopManager.vendors.nibble. First bump plays her intro, then opens the store;
    // afterwards it's straight to browsing (with the occasional idle line).
    openNibbleShop() {
        const hadShunt = this.state.upgrades.corruptHandler;
        const openShop = () => {
            this.state.gameState = 'SHOP';
            this.shopManager.open('nibble', () => {
                // Just bought the Glitch Shunt? She warns you about the sweeper daemon
                // on your way out — the diegetic telegraph for Heur's intercept (which
                // keys on corruptHandler the next open sector you enter).
                if (!hadShunt && this.state.upgrades.corruptHandler && !this.state.unlocked.purgeComplete) {
                    this.state.gameState = 'DIALOG';
                    this.dialogManager.start(NIBBLE.buy, () => { this.state.gameState = 'PLAYING'; });
                } else {
                    this.state.gameState = 'PLAYING';
                }
            });
        };
        if (!this.state.unlocked.nibbleMet) {
            this.state.unlocked.nibbleMet = true;
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(NIBBLE.intro, openShop);
        } else {
            openShop();
        }
    },

    // Spelling CACHE across death screens summons the archivist. She coalesces in the
    // Hub you always respawn into (a real death always warps you there). She is tied to
    // the CODE, not a permanent latch: she is present only while deathCode still reads
    // CACHE (see refreshDynamicRoomContent) and vanishes once the next death shifts the
    // window — re-spell CACHE (or visit Cold Storage {5,-4}) to see her again.
    summonCache() {
        if (this.state.unlocked.cacheStage >= 3) return; // she's said her piece; never again
        // A code completed OUTSIDE the Hub (a bounce out in the Wilds, or a checkpoint
        // respawn) can't manifest her here — her apparition is Hub-only. LATCH it: the
        // next Hub entry consumes cachePending and she appears (refreshDynamicRoomContent).
        if (this.worldManager.currentRoomX !== 0 || this.worldManager.currentRoomY !== 0) {
            this.state.unlocked.cachePending = true;
            return;
        }
        const already = this.npcs.some(n => n.id === 'cache');
        this.state.unlocked.cacheFound = true; // mark discovered (clue-gating / records)
        this.spawnCacheNpc();
        if (!already) this.audio.playMaterialize(); // she coalesces out of the noise
    },

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
    },

    // Resolve a head-on-NPC bump via the registry (this.npcHandlers). Returns true if a
    // (non-leaving) NPC occupied the head cell — the move-tick stops there this frame.
    handleNpcCollisions() {
        for (const npc of this.npcs) {
            if (this.snake.head.x === npc.x && this.snake.head.y === npc.y) {
                if (npc.leaving) continue; // a fleeing NPC is non-interactive
                const handler = this.npcHandlers[npc.id];
                if (handler) {
                    // Two processes touching exchange a little handshake chirp — unless
                    // this contact already has its own sound (clamps, scuffles, pickups).
                    if (!this._silentBumps.has(npc.id)) this.audio.playBump();
                    handler(npc);
                }
                return true;
            }
        }
        return false;
    },

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
                    // §2.6: driving is LETHAL and gear was invisible until you happened to
                    // find the {2,2} module out in the Wilds. 2-Bit hooks into your system
                    // here, so he fits the tach at the same moment he hands you the gearbox
                    // — the gauge now always exists wherever the danger does.
                    this.state.unlocked.gearMeter = true;
                    this.npcs = this.npcs.filter(n => n.id !== 'bite');
                    this.snake.body.push({ x: npc.x, y: npc.y });
                    this.state.gameState = 'DIALOG';
                    this.dialogManager.start(TWO_BIT.tutorial, () => { this.state.gameState = 'PLAYING'; });
                });
            }
        }
    },

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
    },

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
    },

    // Pick up Denny's map: it rides your tail as a Module (unlocks the Module Slot).
    npcMapItem(_npc) {
        this.npcs = this.npcs.filter(n => n.id !== 'mapitem');
        this.carriedModule = 'map';
        this.state.unlocked.moduleSlot = true;
        this.audio.playBeep();
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(TWO_BIT.mapPickup, () => { this.state.gameState = 'PLAYING'; });
    },

    // Localhost welcome sign / townsfolk / Cadenza: read their lines and move on, no cost.
    npcSign(npc) {
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(npc.dialog, () => { this.state.gameState = 'PLAYING'; });
    },

    npcCadenza(npc) {
        // ORDER: 1) show's over  ->  2) FIRST CONTACT  ->  3) RETURN visits.
        // 1) The encore is done: she holds court, no more performances.
        if (this.state.unlocked.encoreComplete) { this.npcSign(npc); return; }
        this.state.gameState = 'DIALOG';
        // 2) FIRST CONTACT — the written meeting scene, THEN the performance. Both encore
        //    intros open on "You came BACK", so without this a first-time visitor was
        //    greeted as a returnee, and CADENZA_SCENE (already written, and the dialog her
        //    NPC actually carries) was dead code that could never play. Her scene ends on
        //    "you found me — that was always the hard part" and a hum, which leads straight
        //    into the encore.
        if (!this.state.unlocked.cadenzaMet) {
            this.state.unlocked.cadenzaMet = true;
            this.dialogManager.start(CADENZA_SCENE, () => this.startEncore());
            return;
        }
        // 3) RETURN visit — the encore intro, with or without the healed dead note.
        const intro = this.state.unlocked.lostVerseFound ? CADENZA_ENCORE.intro : CADENZA_ENCORE.introHole;
        this.dialogManager.start(intro, () => this.startEncore());
    },

    // --- Nibble's black market ({11,-4}) --------------------------------------------
    // A real stall like 2-Bit's — her lineup lives in ShopManager.vendors.nibble.
    npcNibble(_npc) {
        this.openNibbleShop();
    },

    // Nibble's SALVAGE CLAWS: half (capped) of the mass corruption tears off you drops
    // as re-collectible Data motes at its shed cells — scoop your own spill back up
    // before you leave the room (motes clear on room change). Data = segments holds:
    // re-eating a mote regrows +1 and scores +1 (collectData handles motes anywhere).
    dropSalvage(cells, cap = Infinity) {
        if (!this.state.upgrades.salvage || !cells || !cells.length) return;
        const want = Math.min(cap, Math.ceil(cells.length / 2));
        const occ = new Set();
        for (const o of [...this.snake.body, this.apple, ...(this.glitches || []),
                         ...(this.obstacles || []), ...this.npcs, ...(this.dataMotes || [])]) {
            if (o) occ.add(`${o.x},${o.y}`);
        }
        let dropped = 0;
        for (const c of cells) {
            if (dropped >= want) break;
            if (c.x < 0 || c.y < 0 || c.x >= this.canvas.width || c.y >= this.canvas.height) continue;
            const key = `${c.x},${c.y}`;
            if (occ.has(key)) continue;
            occ.add(key);
            this.dataMotes.push({ x: c.x, y: c.y, salvage: true });
            dropped++;
        }
    },

    // A growth cache: one bite, +4 Data and +4 length (coupled) — the Wilds' reason
    // to explore. Consumed permanently (the room remembers).
    npcDataCache(npc) {
        this.npcs = this.npcs.filter(n => n !== npc);
        this.state.addScore(4);
        this.growSnake(4);
        this.audio.playBeep();
        this.checkUnlocks();
        this.refreshScore();
    },

    // A found Wilds UI/diagnostic module (gear meter, sector readout, map-pins tool,
    // extra pin shapes). Grants its effect, records the room so it never respawns, and
    // reads out the pickup line. Mass-neutral (picking up a tool never docks length).
    npcUiModule(npc) {
        const u = this.state.unlocked;
        const key = npc.roomKey || `${this.worldManager.currentRoomX},${this.worldManager.currentRoomY}`;
        // A duplicate pin-shape pickup (shouldn't happen — suppressed by modulesFound —
        // but guard anyway) shouldn't over-count.
        if ((u.modulesFound || []).includes(key)) { this.npcs = this.npcs.filter(n => n !== npc); return; }
        let lines = UI_MODULES.gearMeter;
        if (npc.grant === 'gearMeter') { u.gearMeter = true; lines = UI_MODULES.gearMeter; }
        else if (npc.grant === 'coordReadout') { u.coordReadout = true; lines = UI_MODULES.coordReadout; }
        else if (npc.grant === 'mapPins') { u.mapPinsTool = true; u.pinShapes = (u.pinShapes || 0) + 1; lines = UI_MODULES.mapPins; }
        else if (npc.grant === 'pinShape') { u.pinShapes = (u.pinShapes || 0) + 1; lines = UI_MODULES.pinShape; }
        else if (npc.grant === 'redline') { u.redline = true; lines = UI_MODULES.redline; }
        else if (npc.grant === 'crumple2') {
            // The ROM Vault's prize: Crumple tier 2 (shed 6, not 10). Never DOWNGRADES a
            // player who somehow reaches tier 2+ first.
            this.state.upgrades.crumpleLevel = Math.max(this.state.upgrades.crumpleLevel, 2);
            lines = UI_MODULES.crumple2;
        }
        if (!u.modulesFound) u.modulesFound = [];
        u.modulesFound.push(key);
        this.npcs = this.npcs.filter(n => n !== npc);
        this.audio.playMaterialize();
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
    },

    // Map Pins: cycle the CURRENT room's annotation through {none, shape0..shapeN-1}.
    // Called from the Pause menu ([M]) once the annotation tool is found. Persisted.
    cycleMapPin() {
        if (!this.state.unlocked.mapPinsTool) return;
        const shapes = Math.max(1, this.state.unlocked.pinShapes || 1);
        const key = `${this.worldManager.currentRoomX},${this.worldManager.currentRoomY}`;
        const cur = this.mapPins[key];
        // none -> 0 -> 1 -> ... -> shapes-1 -> none
        if (cur === undefined) this.mapPins[key] = 0;
        else if (cur + 1 >= shapes) delete this.mapPins[key];
        else this.mapPins[key] = cur + 1;
        this.audio.playBeep();
    },

    npcRefugee(npc) {
        this.state.gameState = 'DIALOG';
        if (this.carriedRefugee) {
            this.dialogManager.start(REFUGEE_BUSY, () => { this.state.gameState = 'PLAYING'; });
            return;
        }
        const key = npc.roomKey || `${this.worldManager.currentRoomX},${this.worldManager.currentRoomY}`;
        this.dialogManager.start([...(npc.dialog || []), ...REFUGEE_ATTACH], () => {
            this.carriedRefugee = key;
            this.npcs = this.npcs.filter(n => n !== npc);
            this.snake.body.push({ x: npc.x, y: npc.y }); // aboard — same ride as 2-Bit's
            this.audio.playBeep();
            this.state.gameState = 'PLAYING';
        });
    },

    npcCommons(npc) {
        this.state.gameState = 'DIALOG';
        if (!this.carriedRefugee) {
            this.dialogManager.start(npc.dialog, () => { this.state.gameState = 'PLAYING'; });
            return;
        }
        this._deliverRefugee(false);
    },

    npcMinegate(npc) {
        this.state.gameState = 'DIALOG';
        if (!this.carriedRefugee) {
            // The gate reads out the operation: miners, stockpile, next unlock. Strings
            // assembled here (per the file's assembly rule) from live numbers.
            const u = this.state.unlocked;
            const cap = 20 * (u.refugeesMined >= 2 ? 2 : 1);
            const status = u.refugeesMined > 0
                ? [`MINE LEDGER: ${u.refugeesMined} miner(s). Ore buffer: ${Math.floor(u.mineStockpile)}/${cap}. Output collects here — walk the motes.`]
                : npc.dialog;
            this.dialogManager.start(status, () => { this.state.gameState = 'PLAYING'; });
            return;
        }
        this._deliverRefugee(true);
    },

    // Resolve a delivery (the head-end of the moral engine). The refugee's origin room is
    // marked delivered (they never respawn there); their passenger segment leaves with
    // them (mass-neutral round trip: +1 aboard, -1 here).
    _deliverRefugee(mined) {
        const u = this.state.unlocked;
        if (!u.refugeesDelivered) u.refugeesDelivered = [];
        u.refugeesDelivered.push(this.carriedRefugee);
        this.carriedRefugee = null;
        if (this.snake.body.length > 1) this.snake.body.pop(); // their seat leaves with them
        let lines;
        if (mined) {
            u.refugeesMined = (u.refugeesMined || 0) + 1;
            lines = [...INTAKE.mine];
            // 2-Bit's one-time unease, and Hydratia's one-time insistence (post-catch).
            if (!u.mineFirst2BitDone) { u.mineFirst2BitDone = true; lines.push(...INTAKE.mineFirst2Bit); }
            if (u.hydratiaFound && !u.mineInsistDone) { u.mineInsistDone = true; lines.push(...INTAKE.mineInsistHydratia); }
        } else {
            u.refugeesFreed = (u.refugeesFreed || 0) + 1;
            lines = INTAKE.free;
            // They settle in NOW (a validated free cell; the room's canonical regeneration
            // seats them at their proper home from the refugeesFreed count on later runs).
            const voices = [LOCALHOST_CITIZENS.newFace, LOCALHOST_CITIZENS.cadenzaHint, LOCALHOST_CITIZENS.nibbleHint,
                            LOCALHOST_CITIZENS.cacheClue1, LOCALHOST_CITIZENS.cacheClue2];
            const pos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || [], [...this.snake.body, ...(this.dataMotes || [])]);
            this.npcs.push(new NPC(pos.x, pos.y, this.gridSize, 'citizen', voices[(u.refugeesFreed - 1) % voices.length]));
        }
        this.audio.playMaterialize();
        this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
    },

    npcQuantcy(npc) {
        if (!this.state.unlocked.quantcyMet) {
            this.state.unlocked.quantcyMet = true;
            this.state.gameState = 'DIALOG';
            const intro = (npc.dialog && npc.dialog.length) ? npc.dialog : QUANTCY.intro;
            this.dialogManager.start(intro, () => this.openQuantcyBank());
            return;
        }
        this.openQuantcyBank();
    },

    openQuantcyBank() {
        this.state.gameState = 'SHOP';
        this.shopManager.open('quantcy', () => { this.state.gameState = 'PLAYING'; });
    },

    // A withdrawal: the whole vault (principal + accrued yield, floored) converts to a
    // pending payout that materializes as motes in his room — each worth EXACTLY 1 Data
    // (no Compression multiplier; see collectData). Uncollected payout persists (durable)
    // and re-seeds on every visit until it's all been carried off.
    quantcyWithdraw() {
        const u = this.state.unlocked;
        const total = Math.floor((u.quantcyPrincipal || 0) + (u.quantcyYield || 0));
        if (total < 1) return;
        u.quantcyPrincipal = 0;
        u.quantcyYield = 0;
        u.quantcyPayout = (u.quantcyPayout || 0) + total;
        this.shopManager.close(); // back to the room — the motes are waiting
        // Sweep any vault motes already on the floor before re-seeding: the payout
        // counter represents ALL uncollected value, so stale motes + a fresh full seed
        // would put more Data on the floor than the counter backs (a mint).
        this.dataMotes = (this.dataMotes || []).filter(m => !m.vault);
        this._seedReserveMotes();
        this.audio.playMaterialize();
    },

    // Seed pending reserve motes (Quantcy's payout at his vault; the Mine's stockpile by
    // the minegate). Clustered around an anchor, capped per entry (the counters persist,
    // so the rest re-seeds next visit). Tagged so collectData drains the right counter.
    _seedReserveMotes() {
        const u = this.state.unlocked;
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const g = this.gridSize;
        const lm = this.worldManager.landmarks;
        if (lm.quantcy && rx === lm.quantcy.x && ry === lm.quantcy.y && (u.quantcyPayout || 0) >= 1) {
            const cx = Math.floor(this.canvas.width / 2 / g) * g;
            const cy = Math.floor(this.canvas.height / 2 / g) * g;
            this._seedMotesAround(cx, cy + 3 * g, Math.min(Math.floor(u.quantcyPayout), 12), 'vault');
        }
        if (rx === 5 && ry === 0 && (u.mineStockpile || 0) >= 1) {
            const ax = (this._cols - 6) * g, ay = (this._rows - 6) * g; // by the minegate
            this._seedMotesAround(ax, ay, Math.min(Math.floor(u.mineStockpile), 12), 'mine');
        }
    },

    // Cluster `count` tagged motes around an anchor cell (±2), skipping anything occupied.
    _seedMotesAround(ax, ay, count, tag) {
        const g = this.gridSize;
        const occupied = new Set(this.snake.body.map(s => `${s.x},${s.y}`));
        if (this.apple) occupied.add(`${this.apple.x},${this.apple.y}`);
        for (const n of this.npcs) occupied.add(`${n.x},${n.y}`);
        for (const o of (this.obstacles || [])) occupied.add(`${o.x},${o.y}`);
        for (const gl of (this.glitches || [])) occupied.add(`${gl.x},${gl.y}`);
        for (const m of (this.dataMotes || [])) occupied.add(`${m.x},${m.y}`);
        let placed = 0, guard = 0;
        while (placed < count && guard < 300) {
            guard++;
            const dx = Math.floor(Math.random() * 5) - 2, dy = Math.floor(Math.random() * 5) - 2;
            const x = ax + dx * g, y = ay + dy * g;
            if (x < this.ringLeft || y < this.ringTop || x >= this.ringRight || y >= this.ringBottom) continue;
            const key = `${x},${y}`;
            if (occupied.has(key)) continue;
            occupied.add(key);
            const mote = { x, y };
            mote[tag] = true;
            this.dataMotes.push(mote);
            placed++;
        }
    },

    // --- HYDRATIA'S STALL (Localhost, post-catch): the autosave machinery --------------
    openHydratiaShop() {
        const open = () => {
            this.state.gameState = 'SHOP';
            this.shopManager.open('hydratia', () => { this.state.gameState = 'PLAYING'; });
        };
        if (!this.state.unlocked.hydratiaStallMet) {
            this.state.unlocked.hydratiaStallMet = true;
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(HYDRATIA_STALL.intro, open);
        } else {
            open();
        }
    },

    // Hydratia's silent shadow copy: serialize() to the per-file AUTO buffer (never the
    // manual file — Cache's named commit stays sacred). serialize() structurally cannot
    // contain score, so an autosave can never bank carried Data past a death (decision 1).
    autoCommit() {
        if (!this.state.unlocked.saveFunction) return;
        this.saveManager.saveAuto(this.activeSlot, this.serialize());
    },

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
    },

    // Cache at home in Cold Storage — reachable via her map marker OR by wandering north
    // before ever doing the Hub CACHE puzzle. Meeting her here retires the Hub apparition
    // (cacheStage 3) and, if you never got the Save Function, she installs it now (given a
    // Pause Menu to file it into). Coherent regardless of the puzzle. New lines are DRAFTS.
    talkToCacheHome(_npc) {
        const u = this.state.unlocked;
        let lines;

        // ORDER MATTERS — the branches below are numbered in the sequence a player meets
        // them. Teaching Save (2) MUST outrank the contamination refusal (3a): she is the
        // only source of the Save Function, so nothing may stand between a first-time
        // visitor and learning to save.

        // 1+2) NO SAVE YET — the first meeting. She is the ONLY source of the Save
        //    Function, so this whole block outranks the contamination refusal below.
        if (!u.saveFunction) {
            // 1) No Pause Menu -> nowhere to file a Save. Turn you away and change NOTHING
            //    (the Hub puzzle stays intact); come back with a Diagnostic Module.
            if (!u.pauseMenu) {
                this.dialogManager.start(CACHE.home.brushOff, () => { this.state.gameState = 'PLAYING'; });
                return;
            }
            // 2) She installs the Save Function on the spot. NEVER blocked: not by
            //    corruption, not by anything. (This used to sit BELOW the needPurge
            //    refusal, so a contaminated player who reached her by the fight-free x=4
            //    bypass was bounced to Heur's Bay and could never be taught to save at
            //    all.) Settles her questline (stage 3). If the purge is already done she
            //    rolls straight on into the checkpoint demand, exactly as before.
            u.saveFunction = true;
            u.startScreenUnlocked = true;
            u.cacheFound = true;
            u.cacheStage = 3;
            lines = u.purgeComplete
                ? [...CACHE.home.install, ...CACHE_CHECKPOINT.demand]
                : CACHE.home.install;
            this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
            return;
        }

        // 3) She has already taught you to save — from here the CHECKPOINT rules apply.
        //    (Reachable with or without a Pause Menu: Save can also come from the Hub
        //    CACHE puzzle, and that player still deserves the warm chat, not a brush-off.)
        u.cacheFound = true;
        if (u.cacheStage < 3) u.cacheStage = 3;

        // 3a) CONTAMINATED (carrying the Shunt, not yet decontaminated): she refuses to
        //     file a dirty copy and points you at Heur's Bay. This is what keeps the finale
        //     behind the mandatory decontamination even via the bypass. saveGame()
        //     independently re-checks purgeComplete, so a dirty player who now HAS Save
        //     still cannot commit the checkpoint — the finale gate holds either way.
        if (this.state.upgrades.corruptHandler && !u.purgeComplete) {
            this.dialogManager.start(CACHE_CHECKPOINT.needPurge, () => { this.state.gameState = 'PLAYING'; });
            return;
        }

        // 3b) THE CHECKPOINT (armed once the purge is survived): Cold Storage is read-only
        //     — sanctuary — and Cache will not open the one-way door north until you're
        //     FILED. The reboot beyond flushes volatile memory; only a ROM save carries you
        //     across. Committing the save (Pause -> S, in this room) breaches the door.
        if (u.purgeComplete) {
            if (u.checkpointOpen) {
                lines = this._diedSinceCheckpoint ? CACHE_CHECKPOINT.reopen : CACHE_CHECKPOINT.open;
                this._diedSinceCheckpoint = false;
            } else {
                lines = CACHE_CHECKPOINT.demand;
            }
        } else {
            // 3c) Clean and pre-purge: a calmer at-home chat.
            lines = CACHE.home.haveSave;
        }
        this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
    },

    // Start Cache's fade-out after she speaks. `leaving` makes her non-interactive during
    // the dissolve; updateCacheFade removes her at alpha 0.
    dismissCache(npc) {
        npc.appearing = false;
        npc.fading = true;
        npc.leaving = true;
        if (npc.alpha === undefined) npc.alpha = 1;
    },

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
    },

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
    },

    // Place a room's dynamic (never-saved) occupants after its entities load: Cache's Hub
    // apparition and her spare-data motes. Motes are her gift "when you spawn", so they are
    // only (re)seeded on a respawn/load (seedMotes=true) — NOT on an ordinary walk-in, so
    // pacing in and out of the Hub can't farm a fresh pile. Any entry clears stale motes.
    refreshDynamicRoomContent(seedMotes = false) {
        const inHub = this.worldManager.currentRoomX === 0 && this.worldManager.currentRoomY === 0;
        if (inHub && this.state.unlocked.cacheStage < 3
            && (this.deathCode === 'CACHE' || this.state.unlocked.cachePending)) {
            // A pending summons (the code completed away from the Hub — a Wilds bounce or
            // a checkpoint respawn) is consumed on the next Hub entry.
            this.state.unlocked.cachePending = false;
            this.spawnCacheNpc();
        }
        this.dataMotes = [];
        if (inHub && seedMotes && this.state.unlocked.spareDataUnlocked) this.seedHubData();
        // Reserve motes (Quantcy's pending payout at his vault; the Mine's stockpile by
        // the minegate) re-seed on EVERY entry to their room — they're your own stored
        // Data awaiting embodiment, capped at the counters, so there's nothing to farm.
        this._seedReserveMotes();
    },
};
