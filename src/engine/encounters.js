// THE SET-PIECE ENCOUNTERS — lifted off GameEngine so the engine core stays legible.
// These are mixed onto GameEngine.prototype (see Game.js), so `this` is the engine and
// every method keeps its exact call surface; nothing here changed behaviourally.
//
//   * Cadenza's DA CAPO Encore — the body-as-instrument music puzzle
//   * HUSH — the Encore-gated pursuit hazard at {9,4}
//   * Heur's Decontamination — in-room Breakout with your real body at {5,-1}
//   * The Ascent: Denny's Fall-Through {5,-2}, Gate's Override {5,-3}, Port 0 {5,-5}

import { NPC } from '../entities/NPC.js';
import { ARCHITECT, CADENZA_ENCORE, HEUR, DENNY_REMATCH, GATE_OVERRIDE, GATE_FINALE } from '../content/dialogue.js';

export const EncounterMethods = {

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
        this.pendingUnfold = 0; // a mid-bounce Crumple unfold would otherwise grow you during the lap
        this.encore = { nodes, nextIndex: 0, eaten: {}, phase: 1, crackFlash: 0, msg: '' };
        this.state.gameState = 'ENCORE';
    },

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
    },

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
    },

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
    },

    // The whole chord held at once: Cadenza seals the Locked Groove — Music Layer 1 is live.
    _encoreFinale() {
        this.encore = null;
        this.speed = this._encorePrevSpeed || 100;
        this.state.unlocked.encoreComplete = true;
        this.state.unlocked.cadenzaFound = true;
        this.saveManager.markEncoreUnlocked(); // global: unlocks her title-screen cameo + the Void Ambient
        if ((this.state.unlocked.musicLayer || 0) < 1) this.state.unlocked.musicLayer = 1;
        this.audio.setMusicLayer(this.state.unlocked.musicLayer); // Cadenza's Locked Groove — Layer 1
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(CADENZA_ENCORE.success, () => { this.state.gameState = 'PLAYING'; });
    },

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
    },

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
    },

    updateHush() {
        const lm = this.worldManager.landmarks.hush;
        if (this.worldManager.currentRoomX !== lm.x || this.worldManager.currentRoomY !== lm.y) return;
        const hush = this.npcs.find(n => n.id === 'hush');
        if (!hush) return;
        if ((this.state.unlocked.musicLayer || 0) >= 1) { hush.dormant = true; return; }
        hush.dormant = false;
        if (hush.stun > 0) { hush.stun--; return; }
        const g = this.gridSize;
        const head = this.snake.head;
        const dx = Math.sign(head.x - hush.x) * g;
        const dy = Math.sign(head.y - hush.y) * g;
        const tries = Math.abs(head.x - hush.x) >= Math.abs(head.y - hush.y)
            ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
        for (const [mx, my] of tries) {
            if (mx === 0 && my === 0) continue;
            const nx = hush.x + mx, ny = hush.y + my;
            if (nx < 0 || ny < 0 || nx >= this.canvas.width || ny >= this.canvas.height) continue;
            if ((this.obstacles || []).some(o => o.x === nx && o.y === ny)) continue;
            if ((this.glitches || []).some(gl => gl.x === nx && gl.y === ny)) continue; // never COVER corruption (a hidden hazard)
            if (this.apple && this.apple.x === nx && this.apple.y === ny) continue;
            if (this.npcs.some(n => n !== hush && n.x === nx && n.y === ny)) continue;
            if (this.snake.head.x === nx && this.snake.head.y === ny) continue; // never ON the head
            hush.notch = { dx: Math.sign(mx), dy: Math.sign(my) };
            hush.x = nx; hush.y = ny;
            break;
        }
        this._hushClamp(hush);
    },

    // The CLAMP: HUSH overlapping any body segment bites two segments (and two Data —
    // coupled) off the tail, then stalls two ticks so it can't chain-clamp every step.
    _hushClamp(hush) {
        if (hush.dormant || hush.stun > 0) return;
        const onBody = this.snake.body.some(s => s.x === hush.x && s.y === hush.y);
        if (!onBody) return;
        let clamped = 0;
        for (let d = 0; d < 2; d++) {
            if (this.snake.shrink(this.riderCount)) clamped++;
        }
        if (clamped > 0) {
            this.state.score = Math.max(0, this.state.score - clamped);
            this.refreshScore();
            this.changeGear(0);
            this.audio.playCorruptHit(); // reused: corruption's bite (no new sound, no new cause)
        }
        hush.stun = 2;
    },

    // Head-on into HUSH: dormant, it's a soft bump (a coil at rest); awake, walking
    // into the clamp is a clamp.
    npcHush(npc) {
        if ((this.state.unlocked.musicLayer || 0) >= 1 || npc.dormant) {
            this.audio.playDenied();
            return;
        }
        this._hushClamp(npc);
    },

    startHeurFight(entryDir) {
        const g = this.gridSize;
        const cols = Math.floor(this.canvas.width / g), rows = Math.floor(this.canvas.height / g);
        this.state.unlocked.bayRoom = { x: this.worldManager.currentRoomX, y: this.worldManager.currentRoomY };
        // Decontamination: the bay is swept clean of the room's own hazards so the arena
        // is just you, the ping, and Heur's database.
        this.glitches = [];
        this.obstacles = [];
        // Orientation: you were heading `entryDir`; the FAR wall (bricks + the far door
        // that opens on a win) is that way, and `goal` is the ENTRY wall you came in
        // through — the one door you may always retreat back out of (see crossBorder).
        const far = entryDir || 'right';
        const goal = { up: 'down', down: 'up', left: 'right', right: 'left' }[far];
        this.speed = this.baseSpeed;
        this.moveTimer = 0;
        this.gear = 0;
        this.heur = {
            cols, rows, far, goal,
            bricks: this._heurBuildBricks(cols, rows, far),
            ping: { c: 0, r: 0, dc: 0, dr: 0 },
            brickHits: 0, tick: 0, warnHead: false,
        };
        this._heurLaunchPing();
        // Keep the player in play (PLAYING); the seal (crossBorder) + the ping run in the
        // normal move-tick. Speak the intercept if it hasn't played yet (called from the
        // intercept dialog's onComplete, so it already has).
    },

    // Build Heur's signature database: a sparse brick band a couple cells in from the far
    // wall, spanning the cross-axis, plus ONE Heur-signature brick at the band's centre
    // (unbreakable until every other entry is gone). Bricks are individual cells
    // {c,r,hp,heur} — orientation-agnostic.
    _heurBuildBricks(cols, rows, far) {
        const bricks = [];
        const horizontal = (far === 'left' || far === 'right');
        // the two "depth" lines just inside the far wall
        const depth = far === 'right' ? [cols - 3, cols - 4]
                    : far === 'left'  ? [2, 3]
                    : far === 'down'  ? [rows - 3, rows - 4]
                    :                   [2, 3]; // up
        const crossLo = 2, crossHi = (horizontal ? rows : cols) - 3;
        const crossMid = Math.floor((horizontal ? rows : cols) / 2);
        for (const d of depth) {
            for (let x = crossLo; x <= crossHi; x += 2) {
                const c = horizontal ? d : x;
                const r = horizontal ? x : d;
                bricks.push({ c, r, hp: 1, heur: false });
            }
        }
        // Heur's own signature — front-and-centre of the band.
        const frontDepth = depth[0];
        const hc = horizontal ? frontDepth : crossMid;
        const hr = horizontal ? crossMid : frontDepth;
        // ensure it isn't a duplicate of a normal brick cell
        const existing = bricks.find(b => b.c === hc && b.r === hr);
        if (existing) existing.heur = true;
        else bricks.push({ c: hc, r: hr, hp: 1, heur: true });
        return bricks;
    },

    // Launch the ping from just in front of the bricks, heading toward the player (the
    // goal wall) on a diagonal.
    _heurLaunchPing() {
        const h = this.heur;
        const horizontal = (h.far === 'left' || h.far === 'right');
        const toGoalC = h.goal === 'left' ? -1 : h.goal === 'right' ? 1 : 0;
        const toGoalR = h.goal === 'up' ? -1 : h.goal === 'down' ? 1 : 0;
        if (horizontal) {
            h.ping.c = h.far === 'right' ? h.cols - 6 : 5;
            h.ping.r = Math.floor(h.rows / 2);
            h.ping.dc = toGoalC; h.ping.dr = 1;
        } else {
            h.ping.r = h.far === 'down' ? h.rows - 6 : 5;
            h.ping.c = Math.floor(h.cols / 2);
            h.ping.dr = toGoalR; h.ping.dc = 1;
        }
    },

    // Advance the ping each move-tick (1 cell, 2 after it's warmed up). Runs during
    // PLAYING while a Heur fight is active — independent of whether the snake moved.
    _heurTick() {
        const h = this.heur;
        if (!h) return;
        h.tick++;
        const steps = (h.brickHits >= 6 || h.tick >= 40) ? 2 : 1;
        for (let s = 0; s < steps; s++) {
            if (this._heurPingStep()) return; // the win consumed the fight
        }
        // read-head proximity warning (deaf-legible outline flash on the head cell)
        const g = this.gridSize;
        const hc = this.snake.head.x / g, hr = this.snake.head.y / g;
        h.warnHead = Math.max(Math.abs(h.ping.c - hc), Math.abs(h.ping.r - hr)) <= 2;
    },

    // Classify a cell for the ping: null = free, or a reflector {wall} | {brick} | {head}
    // | {body}. The ping is CONTAINED — every wall (all four) reflects it. It cannot leave
    // the sealed bay; only breaking the whole database opens the far door. So there is no
    // "lose" — if you can't break through you simply don't progress, and can retreat the
    // way you came (see crossBorder's Heur seal).
    _heurClassify(c, r) {
        const h = this.heur, g = this.gridSize;
        if (c < 0 || c >= h.cols || r < 0 || r >= h.rows) return { wall: true };
        const brick = h.bricks.find(b => b.c === c && b.r === r);
        // a body segment SHIELDS a brick on the same cell (deflect off you, no break)
        const px = c * g, py = r * g;
        if (this.snake.head.x === px && this.snake.head.y === py) return { head: true };
        if (this.snake.body.some((s, i) => i > 0 && s.x === px && s.y === py)) return { body: true };
        if (brick) return { brick };
        return null;
    },

    _heurPingStep() {
        const h = this.heur;
        const c = h.ping.c, r = h.ping.r, dc = h.ping.dc, dr = h.ping.dr;
        const hCell = dc !== 0 ? this._heurClassify(c + dc, r) : null;
        const vCell = dr !== 0 ? this._heurClassify(c, r + dr) : null;
        const dCell = this._heurClassify(c + dc, r + dr);

        // Reflect off any solid neighbour (wall / brick / body), applying its effect.
        let ndc = dc, ndr = dr, reflected = false;
        if (hCell) { ndc = -dc; this._heurApplyHit(hCell); reflected = true; }
        if (vCell) { ndr = -dr; this._heurApplyHit(vCell); reflected = true; }
        if (!hCell && !vCell && dCell) { ndc = -dc; ndr = -dr; this._heurApplyHit(dCell); reflected = true; }
        // a win may have fired inside _heurApplyHit
        if (!this.heur) return true;
        h.ping.dc = ndc; h.ping.dr = ndr;
        h.ping.c = c + ndc; h.ping.r = r + ndr; // reflected dir points away from the block — safe to advance
        return false;
    },

    _heurApplyHit(cell) {
        const h = this.heur;
        if (cell.brick) {
            const b = cell.brick;
            const othersExist = h.bricks.some(x => !x.heur);
            if (b.heur && othersExist) { this.audio.playDoot(); return; } // locked until last
            h.bricks = h.bricks.filter(x => x !== b);
            h.brickHits++;
            this.audio.playCrack();
            if (!h.bricks.length) { this._heurWin(); }
            return;
        }
        if (cell.head) {
            // the ping reads your flagged read-head: 2 segments + 2 Data (coupled),
            // floored at head + passenger seats (enforced by shrink itself).
            let docked = 0;
            for (let i = 0; i < 2; i++) { if (this.snake.shrink(this.riderCount)) docked++; }
            if (docked) {
                this.state.score = Math.max(0, this.state.score - docked);
                this.refreshScore();
                this.changeGear(0);
            }
            this.audio.playCorruptHit();
            return;
        }
        if (cell.body) { this.audio.playDoot(); return; } // clean deflect off your body
        // wall: a soft tick (no effect)
    },

    _heurWin() {
        const u = this.state.unlocked;
        const rx = this.worldManager.currentRoomX, ry = this.worldManager.currentRoomY;
        const far = this.heur.far;
        this.heur = null; // seal lifts
        u.purgeComplete = true;
        // Open the FAR DOOR — the wall you were heading toward — as a real, breached
        // doorway you walk straight out of.
        this.worldManager.openScriptedDoor(rx, ry, far);
        // The Architect escalates: the north-spine rematch posts arm (their cached rooms
        // regenerate with the enforcers deployed).
        for (const key of ['5,-2', '5,-3']) delete this.worldManager.rooms[key];
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(HEUR.win, () => {
            this.state.gameState = 'PLAYING';
            this.narrative.printMessage(ARCHITECT.purgeAudit);
        });
    },

    getHeurRenderState() {
        const h = this.heur;
        return {
            cols: h.cols, rows: h.rows, far: h.far, goal: h.goal,
            ping: { c: h.ping.c, r: h.ping.r, dc: h.ping.dc, dr: h.ping.dr },
            bricks: h.bricks.map(b => ({ c: b.c, r: b.r, heur: b.heur })),
            bricksLeft: h.bricks.length, warnHead: h.warnHead,
        };
    },

    // A shared axis-priority pursuit step (Gate's interchange chase). Blocked by the
    // worm, furniture, stamps, other NPCs — and optionally corruption.
    _pursueHead(npc, opts = {}) {
        const g = this.gridSize;
        const head = this.snake.head;
        const dx = Math.sign(head.x - npc.x) * g;
        const dy = Math.sign(head.y - npc.y) * g;
        const tries = Math.abs(head.x - npc.x) >= Math.abs(head.y - npc.y)
            ? [[dx, 0], [0, dy]] : [[0, dy], [dx, 0]];
        for (const [mx, my] of tries) {
            if (mx === 0 && my === 0) continue;
            const nx = npc.x + mx, ny = npc.y + my;
            if (nx < 0 || ny < 0 || nx >= this.canvas.width || ny >= this.canvas.height) continue;
            if (this._cellBlocked(nx, ny)) continue;
            if (opts.avoidGlitches && (this.glitches || []).some(gl => gl.x === nx && gl.y === ny)) continue;
            if (this.npcs.some(n => n !== npc && n.x === nx && n.y === ny)) continue;
            npc.notch = { dx: Math.sign(mx), dy: Math.sign(my) };
            npc.x = nx; npc.y = ny;
            return;
        }
    },

    // Bumping a pursuing/guarding Gate: a SCUFFLE, not an arrest — three segments and
    // three Data (coupled), he's knocked back along your heading and stalls a beat.
    // The pressure valve: you can always fight through him, at a price.
    // PORT 0's win condition: reaching Gate ENDS the fight. (It used to run the generic
    // scuffle, which would have charged you 3 segments for winning.) Elsewhere — the
    // Override's ring — a bump is still a scuffle.
    npcGateFinal(npc) {
        if (this.worldManager.currentRoomX === 5 && this.worldManager.currentRoomY === -5
            && !this.state.unlocked.finaleDone) {
            this._finaleParadox(npc);
            return;
        }
        this.npcGateScuffle(npc);
    },

    npcGateScuffle(npc) {
        let shed = 0;
        for (let i = 0; i < 3; i++) { if (this.snake.shrink(this.riderCount)) shed++; }
        this.state.score = Math.max(0, this.state.score - shed);
        this.refreshScore();
        this.changeGear(0);
        this.audio.playCrash();
        const d = this.input.direction;
        const g = this.gridSize;
        // Grid-aligned clamp (the canvas need not be a grid multiple — a raw width-g
        // clamp would park him OFF-grid where every cell-equality check misses him).
        const maxX = Math.floor((this.canvas.width - 1) / g) * g;
        const maxY = Math.floor((this.canvas.height - 1) / g) * g;
        const nx = Math.max(0, Math.min(maxX, npc.x + Math.sign(d.x) * 3 * g));
        const ny = Math.max(0, Math.min(maxY, npc.y + Math.sign(d.y) * 3 * g));
        // Never knock him ONTO anything — furniture, corruption, the worm, the apple, a
        // stamp, or another NPC. A blocked knockback just leaves him where he stands.
        // (The old warning here — that shoving Gate onto a Glitch could fire the finale
        // by accident — is obsolete: the finale keys on you REACHING him, not on
        // corruption. Kept blocked anyway; a boss inside the scenery is still a bug.)
        const blocked = this._moverBlocked(nx, ny)
            || this.npcs.some(n => n !== npc && n.x === nx && n.y === ny);
        if (!blocked) { npc.x = nx; npc.y = ny; }
        npc.stun = 3;
    },

    // The Fall-Through — Denny's rematch ({5,-2}), v3 per playtest:
    //  * He chases in REAL TIME — one cell per DENNY2_STEP_MS, independent of your gear.
    //    At 40ms/cell he's faster than gear 2 (50ms) and slower than gear 3 (30ms): you
    //    can outrun him at TOP speed and only top speed. (A scripted boss keeps its own
    //    clock, like Heur's ping — the Motion Carried turn-lock is for world hazards.)
    //  * His DENIED stamps follow your TAIL: every cell your body clears is stamped and
    //    STAYS stamped until you leave the room — your own path hardens behind you
    //    (Tron rules), so the fight is driving lines you can live with.
    //  * The CATCH (adjacent to your head): he hurls you back toward the door you came
    //    in through — a DENIED to your whole visit, never a death — voiding the stamps
    //    around you so the throw itself can't be lethal (fairness by construction).
    get DENNY2_STEP_MS() { return 40; },

    _denny2Live() {
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== -2) return null;
        if (this.state.unlocked.dennyRematchDone) return null;
        return this.npcs.find(n => n.id === 'denny2') || null;
    },

    // The real-time chase — driven by dt from update(), not the move-tick.
    updateDenny2Chase(dt) {
        const denny = this._denny2Live();
        if (!denny) { this._denny2Timer = 0; return; }
        if (denny.stunMs > 0) { denny.stunMs = Math.max(0, denny.stunMs - dt); return; }
        this._denny2Timer = (this._denny2Timer || 0) + dt;
        while (this._denny2Timer >= this.DENNY2_STEP_MS) {
            this._denny2Timer -= this.DENNY2_STEP_MS;
            this._pursueHead(denny);
            if (this._denny2Catch(denny)) break;
        }
    },

    // The move-tick half: stamp the cell your TAIL just vacated (permanent for the
    // room), and re-check the catch on YOUR movement too.
    updateDenny2() {
        const denny = this._denny2Live();
        if (!denny) { this._tailPrev = null; return; }
        if (this._stampStun > 0) {
            this._stampStun--;
        } else if (this._tailPrev) {
            const t = this._tailPrev;
            const vacated = !this.snake.body.some(s => s.x === t.x && s.y === t.y);
            const occupied = (this.apple && this.apple.x === t.x && this.apple.y === t.y)
                || this.npcs.some(n => n.x === t.x && n.y === t.y)
                || (this.dataMotes || []).some(m => m.x === t.x && m.y === t.y)
                || this.stamps.some(s => s.x === t.x && s.y === t.y);
            if (vacated && !occupied) this.stamps.push({ x: t.x, y: t.y, ttl: 9999 }); // until you leave the room
        }
        const tail = this.snake.body[this.snake.body.length - 1];
        this._tailPrev = tail ? { x: tail.x, y: tail.y } : null;
        this._denny2Catch(denny);
    },

    // Adjacent to your head = CAUGHT: thrown back toward the door you entered through
    // (your whole visit is DENIED), momentum gone, local stamps voided so the throw is
    // always survivable. Returns true when a catch fired.
    _denny2Catch(denny) {
        if (denny.stunMs > 0) return false;
        const g = this.gridSize;
        const adj = Math.abs(denny.x - this.snake.head.x) + Math.abs(denny.y - this.snake.head.y) === g;
        if (!adj) return false;
        const entry = this._roomEntryDir || { x: 0, y: 0 };
        let throwDir;
        if (entry.x !== 0 || entry.y !== 0) {
            throwDir = { x: (-entry.x || 0) * g, y: (-entry.y || 0) * g }; // back toward the entry door (|| 0 kills a stray -0)
        } else {
            const d = this.input.direction;
            throwDir = (d.x || d.y) ? { x: -d.x || 0, y: -d.y || 0 } : { x: 0, y: g };
        }
        this.input.direction = { ...throwDir };
        this.input.nextDirection = { ...throwDir };
        this.gear = 0; this.speed = this.baseSpeed;
        this.audio.playDenied();
        const hx = this.snake.head.x, hy = this.snake.head.y;
        this.stamps = this.stamps.filter(s => Math.max(Math.abs(s.x - hx), Math.abs(s.y - hy)) > 2 * g);
        this._stampStun = 6;
        this._tailPrev = null;
        denny.stunMs = 900; // satisfied for a beat — you get a running start
        return true;
    },

    // Bumping the Fall-Through Denny head-on: apologetic, and the emitter is flustered.
    npcDenny2(npc) {
        this.state.gameState = 'DIALOG';
        this._stampStun = 6;
        npc.stunMs = 900; // the bump also resets his pursuit, so talking isn't a trap
        this.dialogManager.start(DENNY_REMATCH.bump, () => { this.state.gameState = 'PLAYING'; });
    },

    // The Override — Gate's rematch ({5,-3}), v2 per playtest. He holds exactly ONE
    // override at a time: SEAL (north egress revoked, 5 ticks) -> CAP (gearbox held at
    // 1, 5 ticks) -> RECALIBRATING (8 ticks — the WINDOW: seal down, gears free). The
    // forced 180 is GONE (it undid the player's own approach and made the fight read as
    // impossible); the fight is now positioning: bait his goalie line off the door
    // during CAP, then build to gear 3 and breach north inside the window.
    // THE GATE (v3 — the owner's design). He stops citing and becomes what he is: a gate.
    // A ring of Gate-blue blocks wraps the room's inner perimeter with ONE aperture a
    // little wider than a doorway, and the whole ring ROTATES. Touching it is exactly a
    // wall hit. To leave you must read the rotation, slip the aperture, and breach north
    // at gear 3 — so the fight is timing on top of the breach you already know.
    //
    // Emergent length gate (no `length >= N` check anywhere, as ever): a longer worm needs
    // the aperture to stay aligned for more ticks, so mass raises the difficulty of the
    // threading exactly as it lowers the difficulty of the ram.
    //
    // The ring can never seal the room: the aperture always exists and always comes back
    // around, so retreat is permanent and "the world is always traversable" holds.
    get GATE3_APERTURE() { return 7; },   // cells of gap (a door is 5)
    get GATE3_TURN_TICKS() { return 2; }, // move-ticks per one cell of rotation

    // The ring path: every cell of the inner perimeter, clockwise from the top-left.
    _gate3Ring() {
        const g = this.gridSize;
        const cols = this._cols, rows = this._rows;
        const lo = 1, hiC = cols - 2, hiR = rows - 2; // just inside the wall ring
        const path = [];
        for (let c = lo; c <= hiC; c++) path.push([c, lo]);          // top, L->R
        for (let r = lo + 1; r <= hiR; r++) path.push([hiC, r]);     // right, T->B
        for (let c = hiC - 1; c >= lo; c--) path.push([c, hiR]);     // bottom, R->L
        for (let r = hiR - 1; r > lo; r--) path.push([lo, r]);       // left, B->T
        return path.map(([c, r]) => ({ x: c * g, y: r * g }));
    },

    updateGate3() {
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== -3) return;
        if (this.state.unlocked.gateRematchDone) { this._ovr = null; return; }
        const gate = this.npcs.find(n => n.id === 'gate3');
        if (!gate) { this._ovr = null; return; }
        const ring = this._gate3Ring();
        if (!this._ovr) this._ovr = { gap: 0, t: 0, len: ring.length };
        const o = this._ovr;
        o.len = ring.length;
        o.t++;
        if (o.t >= this.GATE3_TURN_TICKS) { o.t = 0; o.gap = (o.gap + 1) % ring.length; }

        // The blocks: every ring cell outside the aperture run.
        const inGap = (i) => {
            const d = (i - o.gap + ring.length) % ring.length;
            return d < this.GATE3_APERTURE;
        };
        this._gate3Blocks = ring.filter((_, i) => !inGap(i));

        // Gate himself rides the leading edge of his own aperture — he IS the gatepost.
        const post = ring[(o.gap + this.GATE3_APERTURE) % ring.length];
        gate.x = post.x; gate.y = post.y;
    },

    // Head into a Gate block = a wall hit (owner: "the same penalty as touching a wall"),
    // so the Crumple Buffer still saves you and death is a border death. Checked from the
    // move-tick after the head has moved.
    _gate3Collide() {
        const blocks = this._gate3Blocks;
        if (!blocks || !blocks.length) return false;
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== -3) return false;
        const h = this.snake.head;
        if (!blocks.some(b => b.x === h.x && b.y === h.y)) return false;
        this.die('border');
        return true;
    },

    // Encounter status -> the BOTTOM RIBBON (owner: no boss-room overlay on the play
    // space). Gate's live citation, or Heur's remaining signatures. DOM writes only on
    // change; hidden when no encounter owns it.
    refreshBossStatus() {
        const el = document.getElementById('boss-status');
        if (!el) return;
        let txt = '', heur = false;
        if (this.heur) {
            txt = `DECONTAMINATION\nSIGNATURES LEFT: ${this.heur.bricks.length}`;
            heur = true;
        } else {
            const c = this._citationLabel();
            if (c) txt = c;
        }
        const key = `${txt}|${heur}`;
        if (key === this._bossHudKey) return;
        this._bossHudKey = key;
        el.classList.toggle('hidden', !txt);
        el.classList.toggle('heur', heur);
        el.textContent = txt;
    },

    // The active citation, for the ribbon status (never the terminal — a printing log
    // would hang the fight).
    // The ribbon readout during THE GATE: it flips to ALIGNED while the aperture actually
    // overlaps the north weak point — the tell that this is the tick to run.
    _citationLabel() {
        if (!this._ovr || !this._gate3Blocks) return null;
        const wp = this.worldManager.getWeakPoint(5, -3, 'up');
        if (wp) {
            const g = this.gridSize;
            const topRow = g; // the ring's top run
            const open = [];
            for (let x = wp.start; x <= wp.end; x += g) open.push(x);
            const blocked = this._gate3Blocks.some(b => b.y === topRow && open.includes(b.x));
            if (!blocked) return GATE_OVERRIDE.citations.aligned;
        }
        return GATE_OVERRIDE.citations.loop;
    },

    // --- PORT 0: the Act I finale ({5,-5}) — the rigidity funnel ------------------------
    // Gate has LEARNED: he refuses Glitch cells. His mandate: hold the door (the post
    // south of the aperture), shadowing your head. Drape your body over his legal
    // moves until only the corrupted cell remains; when he's down to ONE clean escape,
    // Denny issues the only genuine deny of his eleven thousand cycles — and the
    // firewall's own rulebook walks him onto the paradox. NO self-bite, NO encircle.
    // PORT 0 — THE SQUEEZE (v2, the owner's design; the Glitch funnel is CUT).
    // The old finale keyed on a corrupted cell held still — which Motion Carried later
    // made impossible, since Glitches drift on your tick. Nothing here touches corruption.
    //
    // Gate rewrites SPACE: walls with one or two holes extrude from the north wall and
    // march south, toward the door you came in by. Denny comes up from the south, slow,
    // stamping DENIED as he goes, so the floor behind you closes. You are squeezed toward
    // Gate. REACH HIM and the rulebook does the rest: he panics backwards onto one of
    // Denny's own stamps.
    //
    // Both characters use the verb they already own — Gate rewrites the room, Denny
    // stamps — and the kill is Denny's, exactly as before, but staged where you can see it.
    get FINALE_WALL_TICKS() { return 6; },   // move-ticks per row of advance
    get FINALE_SPAWN_TICKS() { return 22; }, // move-ticks between new walls
    get FINALE_DENNY_TICKS() { return 4; },  // move-ticks per step of Denny's sweep

    updateGateFinal() {
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== -5) return;
        if (this.state.unlocked.finaleDone) { this._finale = null; return; }
        const gate = this.npcs.find(n => n.id === 'gatefinal');
        if (!gate) return;
        const g = this.gridSize;
        const cols = this._cols, rows = this._rows;
        if (!this._finale) this._finale = { rows: [], t: 0, spawn: this.FINALE_SPAWN_TICKS - 4 };
        const f = this._finale;

        // 1) Gate extrudes a new wall at the north edge, with one or two holes. The holes
        //    are what keep the squeeze survivable — the room never fully closes.
        f.spawn++;
        if (f.spawn >= this.FINALE_SPAWN_TICKS) {
            f.spawn = 0;
            const holeCount = 1 + Math.floor(Math.random() * 2);
            const holes = [];
            for (let i = 0; i < holeCount; i++) {
                holes.push(2 + Math.floor(Math.random() * Math.max(1, cols - 5)));
            }
            f.rows.push({ r: 2, holes });
            this.audio.playMaterialize(); // the room grows another rule
        }

        // 2) The walls march south. Any that reach the entry wall dissolve (they've done
        //    their pushing) so the south end can't silt up permanently.
        f.t++;
        if (f.t >= this.FINALE_WALL_TICKS) {
            f.t = 0;
            for (const w of f.rows) w.r++;
            f.rows = f.rows.filter(w => w.r < rows - 2);
        }

        // 3) Denny SNAKES the floor. He sweeps boustrophedon — left to right, up a row,
        //    right to left, up a row — laying a DENIED behind every step, so the room
        //    fills from the south edge northward. Deliberately SLOW (one step per
        //    FINALE_DENNY_TICKS): a full sweep is minutes of stalling, so the squeeze is
        //    real pressure without ever being a hidden timer. Stamps do NOT expire — the
        //    slowness is the safety, not a TTL.
        const denny = this.npcs.find(n => n.id === 'dennyfinal');
        if (denny && this._tick % this.FINALE_DENNY_TICKS === 0) {
            if (denny.sweep === undefined) denny.sweep = 1; // +1 = rightward
            const prev = { x: denny.x, y: denny.y };
            const loC = 1, hiC = cols - 2;
            const nx = denny.x + denny.sweep * g;
            const nc = nx / g;
            if (nc >= loC && nc <= hiC) {
                denny.x = nx;
                denny.notch = { dx: denny.sweep, dy: 0 };
            } else {
                // end of the row: climb one and reverse (he stops under Gate's post)
                const ny = denny.y - g;
                if (ny > 2 * g) { denny.y = ny; denny.notch = { dx: 0, dy: -1 }; }
                denny.sweep *= -1;
            }
            // Stamp the cell he just left — never under the worm, the apple, or a boss.
            const taken = this.stamps.some(s => s.x === prev.x && s.y === prev.y)
                || this.snake.body.some(s => s.x === prev.x && s.y === prev.y)
                || (this.apple && this.apple.x === prev.x && this.apple.y === prev.y)
                || this.npcs.some(n => n !== denny && n.x === prev.x && n.y === prev.y);
            if (!taken) this.stamps.push({ x: prev.x, y: prev.y, ttl: 9999, denied: true });
        }

        // 4) Gate holds the door, shadowing your column — the thing you're being pushed at.
        if (gate.stun > 0) { gate.stun--; return; }
        const midX = Math.floor(this.canvas.width / 2 / g) * g;
        const hx = Math.max(midX - 4 * g, Math.min(midX + 4 * g, this.snake.head.x));
        if (gate.x !== hx) {
            const nx = gate.x + Math.sign(hx - gate.x) * g;
            if (!this._cellBlocked(nx, gate.y)) { gate.notch = { dx: Math.sign(hx - gate.x), dy: 0 }; gate.x = nx; }
        }
    },

    // The live cells of Gate's advancing walls (collision + render).
    _finaleWallCells() {
        if (!this._finale) return [];
        const g = this.gridSize, cols = this._cols;
        const out = [];
        for (const w of this._finale.rows) {
            for (let c = 1; c <= cols - 2; c++) {
                if (w.holes.some(h => c >= h && c <= h + 2)) continue; // a 3-cell hole
                out.push({ x: c * g, y: w.r * g });
            }
        }
        return out;
    },

    // Head into an advancing wall = a wall hit (Crumple still saves you).
    _finaleCollide() {
        if (!this._finale) return false;
        if (this.worldManager.currentRoomX !== 5 || this.worldManager.currentRoomY !== -5) return false;
        const h = this.snake.head;
        if (!this._finaleWallCells().some(c => c.x === h.x && c.y === h.y)) return false;
        this.die('border');
        return true;
    },

    // The paradox fires: Gate steps onto the corrupted cell his own rule forbade.
    // The sector crashes, and the crash IS the upgrade: era 16 snaps on mid-frame,
    // Cadenza's second channel wakes, and Act I is over.
    _finaleParadox(gate) {
        const u = this.state.unlocked;
        this._finale = null; // the walls stop the moment he does
        // He panics BACKWARDS onto one of Denny's own stamps — the visible kill. If none
        // is adjacent (you cornered him early), one lands under him: Denny has been
        // stamping this whole room, and the rulebook always finds you eventually.
        const g = this.gridSize;
        const back = [{ x: gate.x, y: gate.y + g }, { x: gate.x - g, y: gate.y }, { x: gate.x + g, y: gate.y }]
            .find(c => this.stamps.some(s => s.x === c.x && s.y === c.y));
        if (back) { gate.x = back.x; gate.y = back.y; }
        else this.stamps.push({ x: gate.x, y: gate.y, ttl: 9999, denied: true });
        this.spawnBurst([{ x: gate.x, y: gate.y }]);
        this.npcs = this.npcs.filter(n => n !== gate);
        this.audio.playCrash();
        this.audio.playDeath(); // reserved for a true termination — and this is one
        this.state.gameState = 'DIALOG';
        this.dialogManager.start(GATE_FINALE.forced, () => {
            u.finaleDone = true;
            u.era16 = true;
            u.dennyRematchDone = true; u.gateRematchDone = true; // the spine stands down
            // Fallback: if the rematches were routed around, the world starts moving
            // HERE at the latest — the Kernel releasing its tail is motion nobody holds.
            if (!u.motionCarried) {
                u.motionCarried = true;
                this.narrative.printMessage(ARCHITECT.motionCarried);
            }
            if ((u.musicLayer || 0) < 2) u.musicLayer = 2;
            this.audio.setMusicLayer(u.musicLayer); // the bassline has an owner
            // The Architect's last word — a half-line the era-16 snap cuts off. Explains
            // his absence from his own act's climax (Gate stopped forwarding; the reboot
            // takes his channel).
            this.narrative.printMessage(ARCHITECT.finaleCut);
            // The way home re-opens — the stacks heard the crash.
            this.worldManager.brokenWalls.add(this.worldManager.boundaryKey(5, -5, 'down'));
            const denny = this.npcs.find(n => n.id === 'dennyfinal');
            if (denny) { denny.id = 'dennyafter'; denny.dialog = GATE_FINALE.after; }
            this.state.gameState = 'DIALOG';
            this.dialogManager.start(GATE_FINALE.reboot, () => { this.state.gameState = 'PLAYING'; });
        });
    },

    // Denny at Port 0: mid-fight he is officially a clipboard; after, he keeps the vigil.
    npcDennyFinal(npc) {
        this.state.gameState = 'DIALOG';
        const lines = this.state.unlocked.finaleDone ? GATE_FINALE.after : GATE_FINALE.dennyBusy;
        this.dialogManager.start(lines, () => { this.state.gameState = 'PLAYING'; });
    },
};
