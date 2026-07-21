/**
 * @vitest-environment happy-dom
 */
// Act I build-out: the finite Wilds (the Kernel's coil), Motion Carried, HUSH,
// Nibble's Glitch Shunt, Heur's Purge Cycle, and the Ascent to Cold Storage
// (Beat 7 trap, Denny's Fall-Through, Gate's Override, Cache's checkpoint,
// the Port 0 rigidity funnel + the 16-bit reboot).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { Glitch } from '../src/entities/Glitch.js';
import { NPC } from '../src/entities/NPC.js';
import { HEUR, GATE_FINALE } from '../src/content/dialogue.js';

function mountDom() {
    document.body.innerHTML = `
        <div id="ui-layer" class="hidden">
            <div id="score-value">0</div>
            <button id="btn-playtest">dev</button>
        </div>
        <div id="game-wrapper">
            <div id="shop-overlay" class="hidden">
                <button id="btn-buy-pivot">Buy</button>
                <button id="btn-buy-compression">Buy</button>
                <button id="btn-buy-armor">Buy</button>
                <button id="btn-buy-scanner">Buy</button>
                <button id="btn-buy-crumple">Buy</button>
                <button id="btn-close-shop">Leave</button>
            </div>
        </div>
        <div id="ui-layer-bottom" class="hidden">
            <div id="narrative-terminal"></div>
        </div>
    `;
    window.localStorage.clear();
}

function newGame(width = 400, height = 400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const game = new GameEngine(canvas);
    for (const fn of ['playWub', 'playGlide', 'playDenied', 'playCorruptHit', 'playCrack',
        'playCrash', 'playBeep', 'playDeath', 'playMaterialize', 'playDoot', 'playBump', 'setDuck', 'setMusicLayer']) {
        game.audio[fn] = vi.fn();
    }
    game.state.gameState = 'PLAYING';
    return game;
}

/** Drive exactly one grid step in a given direction. */
function step(game, dir) {
    game.input.nextDirection = { ...dir };
    game.update(1000);
}

/** Advance every queued dialog (chained onCompletes included) to the end. */
function finishDialog(game) {
    let guard = 0;
    while (game.dialogManager.currentDialog && guard++ < 200) game.dialogManager.advance();
}

// ---------------------------------------------------------------------------------
describe('The finite Wilds — the Kernel\'s coil', () => {
    beforeEach(mountDom);

    it('walls facing outside the interior are coil: solid, no weak point ever', () => {
        const wm = newGame().worldManager;
        expect(wm.isCoilWall(11, 0, 'right')).toBe(true);
        expect(wm.isCoilWall(5, -5, 'up')).toBe(true);
        expect(wm.isCoilWall(5, 0, 'right')).toBe(false);
        expect(wm.getWeakPoint(11, 0, 'right')).toBeNull();
        expect(wm.getWeakPoint(3, 5, 'down')).toBeNull();
    });

    it('driving into the coil is lethal (no crumple: a real death)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 11;
        game.worldManager.currentRoomY = 0;
        game.apple = { x: 100, y: 100 };
        game.glitches = []; game.npcs = []; game.obstacles = [];
        const g = game.gridSize;
        const rightmost = Math.floor((game.canvas.width - 1) / g) * g;
        game.snake.body = [{ x: rightmost, y: 200 }];
        step(game, { x: g, y: 0 });
        expect(game.state.gameState).toBe('DEAD');
        expect(game.audio.playDeath).toHaveBeenCalled();
    });

    it('nearing the coil ducks the whole soundscape and raises the deaf-legible twin', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 11;
        game.worldManager.currentRoomY = 0;
        game.apple = { x: 100, y: 100 };
        game.glitches = []; game.npcs = []; game.obstacles = [];
        const g = game.gridSize;
        game.snake.body = [{ x: 360, y: 200 }]; // 1 cell from the east coil
        step(game, { x: 0, y: g });
        expect(game._coilNear).toBeTruthy();
        expect(game._coilNear.dirs).toContain('right');
        expect(game._coilNear.proximity).toBeGreaterThan(0.5);
        const duck = game.audio.setDuck.mock.calls.at(-1)[0];
        expect(duck).toBeLessThan(0.5);
    });

    it('the Hub is exempt from the coil presentation', () => {
        const game = newGame();
        game.state.unlocked.borders = true; // hub, borders on
        game.apple = { x: 300, y: 300 };
        game.glitches = []; game.npcs = []; game.obstacles = [];
        game.snake.body = [{ x: 20, y: 200 }]; // hugging the west wall
        step(game, { x: 0, y: 20 });
        expect(game._coilNear).toBeNull();
    });

    it('the Deep-Sleep pocket only opens through HUSH\'s post', () => {
        const wm = newGame().worldManager;
        expect(wm.getWeakPoint(10, 5, 'left')).toBeNull();   // forced solid
        expect(wm.getWeakPoint(10, 5, 'right')).toBeNull();  // forced solid
        expect(wm.getWeakPoint(10, 4, 'up')).toBeNull();     // forced solid
        expect(wm.getWeakPoint(9, 4, 'right')).toBeTruthy(); // the corridor door
        expect(wm.getWeakPoint(10, 4, 'down')).toBeTruthy(); // the Booth door
    });

    it('ordinary doors are always visible; only the registered Scanner doors hide', () => {
        const wm = newGame().worldManager;
        // ordinary doors — spine and landmark corridors alike — draw without any tool
        expect(wm.isWeakPointRevealed(1, 0, 'right')).toBe(true);
        expect(wm.getWeakPoint(6, 0, 'right')).toBeTruthy();
        expect(wm.isWeakPointRevealed(6, 0, 'right')).toBe(true);
        expect(wm.isWeakPointRevealed(5, 0, 'up')).toBe(true);
        // the Scanner doors: the finale door, the Booth pocket, the Vault
        expect(wm.isWeakPointRevealed(5, -4, 'up')).toBe(false);
        expect(wm.isWeakPointRevealed(9, 4, 'right')).toBe(false);
        expect(wm.isWeakPointRevealed(10, 4, 'down')).toBe(false);
        expect(wm.isWeakPointRevealed(1, -5, 'down')).toBe(false);
        // a sweep lights one up
        wm.revealWeakPoint(9, 4, 'right', 1000);
        expect(wm.isWeakPointRevealed(9, 4, 'right')).toBe(true);
    });

    it('Cache has a guaranteed fight-free bypass (x=4 dogleg) AND the climbable x=5 gauntlet', () => {
        const wm = newGame().worldManager;
        // (a) the x=4 bypass: Localhost -> {4,0} -> up the x=4 column -> east into {5,-4},
        //     touching no rematch room — the "just let me save" route.
        expect(wm.mainPath.has(wm.boundaryKey(5, 0, 'left'))).toBe(true);
        for (let y = 0; y > -4; y--) {
            expect(wm.getWeakPoint(4, y, 'up')).toBeTruthy();
        }
        expect(wm.getWeakPoint(4, -4, 'right')).toBeTruthy();
        // and its rooms are NOT the fight posts (x=4, not x=5)
        expect(wm.mainPath.has(wm.boundaryKey(4, -2, 'up'))).toBe(true);

        // (b) the fight gauntlet straight up x=5 is fully climbable (every rung guaranteed),
        //     so the intended Denny/Gate rematches always happen on the direct line.
        for (let y = 0; y > -4; y--) {
            expect(wm.getWeakPoint(5, y, 'up')).toBeTruthy();
            expect(wm.isWeakPointRevealed(5, y, 'up')).toBe(true); // visible ordinary doors
        }
        // but the finale seam past Cache is NOT auto-guaranteed-visible (a Scanner door)
        expect(wm.isWeakPointRevealed(5, -4, 'up')).toBe(false);
    });

    it('the checkpoint seam stays CENTRED and present across unseal (no teleport/vanish)', () => {
        for (const [w, h] of [[400, 400], [420, 380], [640, 480], [300, 300]]) {
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const wm = new GameEngine(canvas).worldManager;
            const g = wm.gridSize;
            const mid = Math.floor(w / 2 / g) * g;
            const sealed = wm.getWeakPoint(5, -4, 'up');
            expect(sealed).toEqual({ start: mid - 2 * g, end: mid + 2 * g }); // centred
            wm.unsealRomDoor(5, -4, 'up');
            const unsealed = wm.getWeakPoint(5, -4, 'up');
            expect(unsealed).toEqual(sealed); // unchanged — the seam is where the player saw it
        }
    });

    it('the ROM Vault opens only through its hidden south door', () => {
        const wm = newGame().worldManager;
        expect(wm.getWeakPoint(1, -5, 'left')).toBeNull();
        expect(wm.getWeakPoint(1, -5, 'right')).toBeNull();
        expect(wm.getWeakPoint(1, -5, 'down')).toBeTruthy();  // exists...
        expect(wm.isWeakPointRevealed(1, -5, 'down')).toBe(false); // ...but hidden
    });

    it('Cache\'s ROM door refuses ramming — a bonk, never a crack, never a death', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.gear = 3;
        const wp = game.worldManager.getWeakPoint(5, -4, 'up');
        const r = game.crossBorder(wp.start, -20);
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING');
        expect(game.audio.playDenied).toHaveBeenCalled();
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(false);
        expect(game.worldManager.getWallDamage(5, -4, 'up')).toBe(0);
    });
});

// ---------------------------------------------------------------------------------
describe('Motion Carried — the world moves on your tick', () => {
    beforeEach(mountDom);

    function motionGame() {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4;
        game.worldManager.currentRoomY = 2;
        game.apple = { x: 300, y: 300 };
        game.npcs = []; game.obstacles = [];
        return game;
    }

    it('Glitches hold still before the flip and drift after it', () => {
        const game = motionGame();
        game.glitches = [new Glitch(200, 100, 20)];
        game.snake.body = [{ x: 40, y: 300 }];
        step(game, { x: 20, y: 0 });
        expect(game.glitches[0].x).toBe(200);
        expect(game.glitches[0].y).toBe(100);

        game.state.unlocked.motionCarried = true;
        const before = { x: game.glitches[0].x, y: game.glitches[0].y };
        step(game, { x: 20, y: 0 });
        const moved = Math.abs(game.glitches[0].x - before.x) + Math.abs(game.glitches[0].y - before.y);
        expect(moved).toBe(20); // exactly one cell per move-tick
        expect(game.glitches[0]._m).toBeTruthy(); // and it wears its drift pattern (the notch)
    });

    it('drift patterns are deterministic per room and index', () => {
        const g1 = motionGame();
        const g2 = motionGame();
        expect(g1._glitchMotionFor(0, 4, 2)).toEqual(g2._glitchMotionFor(0, 4, 2));
        expect(g1._glitchMotionFor(1, 4, 2)).not.toEqual(g1._glitchMotionFor(0, 4, 2));
    });

    it('a mover never steps onto the worm — it bounces instead', () => {
        const game = motionGame();
        game.state.unlocked.motionCarried = true;
        game.glitches = [new Glitch(200, 100, 20)];
        // wall the glitch's whole row with worm so any horizontal step is blocked
        game.snake.body = [
            { x: 180, y: 100 }, { x: 220, y: 100 }, { x: 200, y: 80 }, { x: 200, y: 120 },
        ];
        const before = { x: game.glitches[0].x, y: game.glitches[0].y };
        game.update(1000); // no direction: the world still ticks
        game.update(1000); // include an even tick (movers step on evens)
        expect(game.glitches[0]).toMatchObject(before); // fully boxed: it can only bounce in place
    });

    it('villagers wiggle in place — never more than one cell from home', () => {
        const game = motionGame();
        game.state.unlocked.motionCarried = true;
        const home = { x: 200, y: 200 };
        game.npcs = [new NPC(home.x, home.y, 20, 'citizen', ['hi'])];
        game.snake.body = [{ x: 40, y: 300 }];
        for (let i = 0; i < 80; i++) game.update(1000);
        const npc = game.npcs[0];
        expect(Math.abs(npc.x - home.x)).toBeLessThanOrEqual(20);
        expect(Math.abs(npc.y - home.y)).toBeLessThanOrEqual(20);
    });

    it('the flip fires on the SECOND Gate run-in (clearing the Override)', () => {
        const game = motionGame();
        game.state.unlocked.purgeComplete = true;
        expect(game.state.unlocked.motionCarried).toBe(false);
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.shiftScreen(0, -1); // breach north out of the Override
        expect(game.state.unlocked.gateRematchDone).toBe(true);
        expect(game.state.unlocked.motionCarried).toBe(true);
    });

    it('bumping a talkative NPC chirps; combat contacts keep their own sounds', () => {
        const game = motionGame();
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'citizen', ['hi'])];
        game.snake.body = [{ x: 100, y: 100 }];
        step(game, { x: 20, y: 0 }); // head onto the citizen
        expect(game.audio.playBump).toHaveBeenCalledTimes(1);
        // HUSH's clamp is not a handshake
        game.dialogManager.end();
        game.state.gameState = 'PLAYING';
        game.npcs = [new NPC(160, 100, 20, 'hush', [])];
        game.snake.body = [{ x: 140, y: 100 }];
        step(game, { x: 20, y: 0 });
        expect(game.audio.playBump).toHaveBeenCalledTimes(1); // unchanged
    });
});

// ---------------------------------------------------------------------------------
describe('HUSH — the House Silence', () => {
    beforeEach(mountDom);

    function hushGame(layer = 0) {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.musicLayer = layer;
        game.worldManager.currentRoomX = 9;
        game.worldManager.currentRoomY = 4;
        game.apple = { x: 40, y: 40 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 200, 20, 'hush', [])];
        return game;
    }

    it('awake, it homes one cell per move-tick toward your head', () => {
        const game = hushGame(0);
        game.snake.body = [{ x: 300, y: 200 }];
        game.update(1000);
        expect(game.npcs[0].x).toBe(220); // one step toward the head
        expect(game.npcs[0].dormant).toBe(false);
    });

    it('the clamp bites two segments and two Data, then stalls — never a kill', () => {
        const game = hushGame(0);
        game.state.score = 5;
        game.snake.body = [{ x: 300, y: 200 }, { x: 280, y: 200 }, { x: 260, y: 200 }, { x: 240, y: 200 }];
        const hush = game.npcs[0];
        hush.x = 280; hush.y = 200; // on a body segment
        game._hushClamp(hush);
        expect(game.snake.body.length).toBe(2);
        expect(game.state.score).toBe(3);
        expect(game.audio.playCorruptHit).toHaveBeenCalledTimes(1);
        game._hushClamp(hush); // stunned: no chain-clamp
        expect(game.audio.playCorruptHit).toHaveBeenCalledTimes(1);
    });

    it('a length-1 worm cannot be clamped below existence', () => {
        const game = hushGame(0);
        game.state.score = 5;
        game.snake.body = [{ x: 280, y: 200 }];
        const hush = game.npcs[0];
        hush.x = 280; hush.y = 200;
        game._hushClamp(hush);
        expect(game.snake.body.length).toBe(1);
        expect(game.state.score).toBe(5); // nothing clamped, nothing drained
        expect(game.audio.playCorruptHit).not.toHaveBeenCalled();
    });

    it('Music Layer 1 puts it on STANDING BY — a state flag, not audible output', () => {
        const game = hushGame(1);
        game.snake.body = [{ x: 300, y: 200 }];
        game.update(1000);
        expect(game.npcs[0].dormant).toBe(true);
        expect(game.npcs[0].x).toBe(200); // perfectly still
    });
});

// ---------------------------------------------------------------------------------
describe('Nibble\'s black market & the Glitch Shunt', () => {
    beforeEach(mountDom);

    it('intro on first bump; the pitch IS the purchase (house consent gag); price comes off the body', () => {
        const game = newGame();
        game.state.score = 25;
        game.growSnake(25); // Data = segments: 26 cells incl. head
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcs = [nib];
        game.npcNibble(nib);
        expect(game.state.unlocked.nibbleMet).toBe(true);
        finishDialog(game);
        expect(game.state.upgrades.corruptHandler).toBe(false); // intro only
        game.npcNibble(nib);
        finishDialog(game); // finishing the pitch buys it, then her buy patter plays out
        expect(game.state.upgrades.corruptHandler).toBe(true);
        expect(game.state.score).toBe(5);
        expect(game.snake.body.length).toBe(6); // 26 - 20 spent
    });

    it('under 20 Data she sends you away heavier-hearted, not lighter', () => {
        const game = newGame();
        game.state.score = 10;
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.state.unlocked.nibbleMet = true;
        game.npcNibble(nib);
        finishDialog(game);
        expect(game.state.upgrades.corruptHandler).toBe(false);
        expect(game.state.score).toBe(10);
    });

    it('the Shunt pushes a Glitch along your heading instead of biting', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.npcs = []; game.obstacles = [];
        game.glitches = [new Glitch(120, 100, 20)];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        game.state.score = 1;
        step(game, { x: 20, y: 0 }); // head onto the glitch cell
        expect(game.glitches[0].x).toBe(140); // shoved one cell on
        expect(game.snake.body.length).toBe(2); // no bite
        expect(game.state.score).toBe(1);
        expect(game.audio.playDenied).toHaveBeenCalled();
    });

    it('a blocked push falls back to the old bite', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.npcs = [];
        game.obstacles = [{ x: 140, y: 100 }]; // the push destination is walled
        game.glitches = [new Glitch(120, 100, 20)];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }, { x: 40, y: 100 }, { x: 40, y: 120 }];
        game.state.score = 4;
        step(game, { x: 20, y: 0 });
        expect(game.state.score).toBe(1); // -3: corruption bit in
        expect(game.audio.playCorruptHit).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------------
describe('Heur\'s Purge Cycle — the Body-Breakout', () => {
    beforeEach(mountDom);

    it('the intercept seizes the next open sector once you carry the module', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 7;
        game.worldManager.currentRoomY = 1;
        game.shiftScreen(1, 0); // into open Wilds {8,1}
        expect(game.state.gameState).toBe('DIALOG');
        expect(game.dialogManager.currentDialog).toBe(HEUR.intercept);
        finishDialog(game);
        expect(game.state.gameState).toBe('PURGE');
        expect(game.state.unlocked.bayRoom).toEqual({ x: 8, y: 1 });
    });

    it('never inside a Safe Zone, the Hub, or a story room', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        expect(game._purgeInterceptHere()).toBe(false); // Localhost
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 3;
        expect(game._purgeInterceptHere()).toBe(false); // Cadenza
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -2;
        expect(game._purgeInterceptHere()).toBe(false); // the Ascent
    });

    it('paddle width is your length, with the hard 3-cell floor', () => {
        const game = newGame();
        game.growSnake(9); // 10 cells
        game.startPurge();
        expect(game.paddleLen).toBe(10);
        game.purge.virtual = 1;
        expect(game.paddleLen).toBe(3);
    });

    it('a ping to the READ-HEAD docks 2 segments and 2 Data; the shield blocks clean', () => {
        const game = newGame();
        game.state.score = 10;
        game.growSnake(10);
        game.startPurge();
        const p = game.purge;
        // aim the ping to land on the head cell (paddle left end)
        p.paddle.row = 0;
        const padY = p.bandTop + 0;
        p.ping = { c: p.paddle.c, r: padY - 1, dc: 0, dr: 1, speed: 1 };
        game._purgePingStep();
        expect(p.virtual).toBe(9);  // 11 - 2
        expect(game.state.score).toBe(8);
        expect(game.audio.playCorruptHit).toHaveBeenCalled();
        // now the shield
        p.ping = { c: p.paddle.c + 2, r: padY - 1, dc: 0, dr: 1, speed: 1 };
        game._purgePingStep();
        expect(p.virtual).toBe(9); // unchanged
        expect(game.audio.playDoot).toHaveBeenCalled();
    });

    it('the three band rows are three discrete rebound angles', () => {
        const game = newGame();
        game.growSnake(6);
        game.startPurge();
        const p = game.purge;
        // middle row: straight up
        p.paddle.row = 1;
        p.ping = { c: p.paddle.c + 1, r: p.bandTop + 1 - 1, dc: 1, dr: 1, speed: 1 };
        game._purgePingStep();
        expect(p.ping.dc).toBe(0);
        expect(p.ping.dr).toBe(-1);
        // bottom row: reversed
        p.paddle.row = 2;
        p.ping = { c: p.paddle.c + 1, r: p.bandTop + 2 - 1, dc: 1, dr: 1, speed: 1 };
        game._purgePingStep();
        expect(p.ping.dc).toBe(-1);
    });

    it('Heur\'s own signature stays clean until every other entry is breached', () => {
        const game = newGame();
        game.growSnake(6);
        game.startPurge();
        const p = game.purge;
        const heur = p.bricks.find(b => b.heur);
        p.ping = { c: heur.c, r: heur.r + 1, dc: 0, dr: -1, speed: 1 };
        game._purgePingStep();
        expect(p.bricks.find(b => b.heur).hp).toBe(1); // untouched: it reflected
        expect(game.audio.playCrack).not.toHaveBeenCalled();
    });

    it('losing all clearances reseals: entry length + banked motes, and the cycle restarts', () => {
        const game = newGame();
        game.state.score = 8;
        game.growSnake(8); // 9 cells
        game.startPurge();
        const p = game.purge;
        p.motesEaten = 2;
        p.clearances = 1;
        p.ping = { c: 5, r: p.rows - 1, dc: 0, dr: 1, speed: 1 };
        game._purgePingStep(); // past the band: the last clearance goes
        expect(game.state.gameState).toBe('DIALOG');
        expect(game.state.score).toBe(10); // entry 8 + 2 banked
        finishDialog(game);
        expect(game.state.gameState).toBe('PURGE'); // encore. (again.)
        expect(game.purge.virtual).toBe(11); // 9 body + 2 banked
    });

    it('a mote caught at the right wall grows the paddle without pushing it out of the room', () => {
        const game = newGame();
        game.growSnake(6);
        game.startPurge();
        const p = game.purge;
        p.paddle.c = p.cols - game.paddleLen; // flush right
        p.paddle.row = 1;
        p.tick = 1; // odd tick: no drift this cycle — the mote sits on the row already
        p.motes = [{ c: p.cols - 1, r: p.bandTop + 1 }];
        game.updatePurge(1000);
        expect(p.paddle.c + game.paddleLen).toBeLessThanOrEqual(p.cols); // never past the wall
    });

    it('the ping can never freeze between the ceiling and Heur\'s clean signature', () => {
        const game = newGame();
        game.growSnake(6);
        game.startPurge();
        const p = game.purge;
        const heur = p.bricks.find(b => b.heur);
        // park the ping at row 0 heading down into the clean signature — the old freeze
        p.ping = { c: heur.c, r: 0, dc: 0, dr: 1, speed: 1 };
        const positions = new Set();
        for (let i = 0; i < 12; i++) {
            game._purgePingStep();
            positions.add(p.ping.c + ',' + p.ping.r + ',' + p.ping.dc + ',' + p.ping.dr);
        }
        expect(positions.size).toBeGreaterThan(1); // it moved on — no perpetual corner
    });

    it('a from-above brick hit reflects the ping up instead of grinding through', () => {
        const game = newGame();
        game.growSnake(6);
        game.startPurge();
        const p = game.purge;
        const brick = p.bricks.find(b => !b.heur);
        p.ping = { c: brick.c, r: brick.r - 1, dc: 0, dr: 1, speed: 1 }; // above it, descending
        game._purgePingStep();
        expect(brick.hp).toBe(1);
        expect(p.ping.dr).toBe(-1); // bounced back up — no tunnel
    });

    it('paddle mode steers reversals directly (no snake 180-guard, no gear routing)', () => {
        const game = newGame();
        game.state.gameState = 'PURGE';
        game.input.direction = { x: 20, y: 0 }; // sliding right
        game.input.handleKeyDown({ key: 'ArrowLeft' }, null, null, null, () => { throw new Error('gear routed'); });
        expect(game.input.nextDirection).toEqual({ x: -20, y: 0 }); // the reversal took
    });

    it('breaching the whole database wins: fold-out return, the Ascent arms', () => {
        const game = newGame();
        game.state.score = 6;
        game.growSnake(6);
        game.startPurge();
        const p = game.purge;
        p.bricks = [p.bricks.find(b => b.heur)]; // only his own signature left
        const heur = p.bricks[0];
        p.ping = { c: heur.c, r: heur.r + 1, dc: 0, dr: -1, speed: 1 };
        game._purgePingStep();
        expect(game.state.unlocked.purgeComplete).toBe(true);
        expect(game.state.gameState).toBe('DIALOG');
        expect(game.snake.body.length).toBe(1); // folded at the entry cell
        expect(game.pendingUnfold).toBe(6);     // 7-cell worm extrudes as you drive off
        expect(game.worldManager.isWeakPointRevealed(5, 0, 'up')).toBe(true); // the spine lit
        finishDialog(game);
        expect(game.state.gameState).toBe('PLAYING');
    });
});

// ---------------------------------------------------------------------------------
describe('The Ascent — Beat 7, the Fall-Through, the Override', () => {
    beforeEach(mountDom);

    it('the fight ladder is intro -> one rematch each -> finale: {5,-1} stays a normal room', () => {
        const game = newGame();
        const room = game.worldManager.roomGenerator.generateRoom(5, -1, { purgeComplete: true, biteProgress: 1 }, game.worldManager);
        expect(room.npcs.some(n => String(n.id).startsWith('gate'))).toBe(false);
        expect(room.npcs.some(n => String(n.id).startsWith('denny'))).toBe(false);
    });

    it('a Gate scuffle: three segments, three Data, knockback, stall', () => {
        const game = newGame();
        game.state.score = 5;
        game.growSnake(5);
        game.npcs = []; game.obstacles = []; game.glitches = [];
        game.apple = { x: 40, y: 40 }; // keep the landing cell deterministic
        const gate = new NPC(200, 200, 20, 'gate3', []);
        game.snake.body = [{ x: 180, y: 200 }, ...game.snake.body.slice(1)];
        game.input.direction = { x: 20, y: 0 };
        game.npcGateScuffle(gate);
        expect(game.snake.body.length).toBe(3);
        expect(game.state.score).toBe(2);
        expect(gate.x).toBe(260); // knocked 3 cells along your heading
        expect(gate.stun).toBe(3);
        expect(game.audio.playCrash).toHaveBeenCalled();
    });

    it('the Fall-Through stamps land one beat late — never on the cell you occupy', () => {
        const game = newGame();
        game.state.unlocked.purgeComplete = true;
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 340, 20, 'denny2', [])];
        game.snake.body = [{ x: 100, y: 100 }];
        step(game, { x: 20, y: 0 }); // head 100->120; trail memory primes at 100
        expect(game.stamps.length).toBe(0);
        step(game, { x: 20, y: 0 }); // head 120->140; the DENIED lands at 100
        expect(game.stamps).toContainEqual(expect.objectContaining({ x: 100, y: 100 }));
        // the stamp is never under the current head
        for (const s of game.stamps) {
            expect(s.x === game.snake.head.x && s.y === game.snake.head.y).toBe(false);
        }
    });

    it('doubling back into a stamp is an obstacle-death', () => {
        const game = newGame();
        game.state.unlocked.purgeComplete = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 340, 20, 'denny2', [])];
        game.stamps = [{ x: 160, y: 100, ttl: 12 }];
        game.snake.body = [{ x: 140, y: 100 }];
        step(game, { x: 20, y: 0 });
        expect(game.state.gameState).toBe('DEAD');
    });

    it('stamps decay, so the room can never fully seal', () => {
        const game = newGame();
        game.state.unlocked.purgeComplete = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 340, 20, 'denny2', [])];
        game.stamps = [{ x: 60, y: 60, ttl: 2 }];
        game.snake.body = [{ x: 100, y: 100 }];
        step(game, { x: 20, y: 0 });
        step(game, { x: 20, y: 0 });
        expect(game.stamps.some(s => s.x === 60 && s.y === 60)).toBe(false);
    });

    it('the Override holds exactly one citation at a time and always leaves a window', () => {
        const game = newGame();
        game.state.unlocked.purgeComplete = true;
        game.state.unlocked.borders = true;
        game.state.score = 40; // gear 3 available on paper
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
        game.snake.body = [{ x: 100, y: 200 }];

        for (let i = 0; i < 1; i++) game.updateGate3();
        expect(game._ovr.mode).toBe('seal');
        // sealed: the north weak point bonks instead of breaching
        const wp = game.worldManager.getWeakPoint(5, -3, 'up');
        game.gear = 3;
        const r = game.crossBorder(wp.start, -20);
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING'); // a citation, not a death

        for (let i = 0; i < 5; i++) game.updateGate3();
        expect(game._ovr.mode).toBe('cap');
        game.gear = 3;
        game.changeGear(0);
        expect(game.gear).toBeLessThanOrEqual(1); // the gearbox is administratively capped

        for (let i = 0; i < 5; i++) game.updateGate3();
        expect(game._ovr.mode).toBe('recal'); // the window: north open, gears free
    });
});

// ---------------------------------------------------------------------------------
describe('Cold Storage — the checkpoint', () => {
    beforeEach(mountDom);

    it('armed, Cache demands a committed save; committing UNSEALS the Scanner door (no auto-breach)', () => {
        const game = newGame();
        const u = game.state.unlocked;
        u.purgeComplete = true;
        u.pauseMenu = true;
        u.saveFunction = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        const home = new NPC(200, 200, 20, 'cachehome', []);
        game.state.gameState = 'DIALOG';
        game.talkToCacheHome(home);
        finishDialog(game);
        expect(u.checkpointOpen).toBe(false); // demanded, not granted
        expect(game.worldManager.isRomSealed(5, -4, 'up')).toBe(true);

        game.saveGame();
        expect(u.checkpointOpen).toBe(true);
        expect(game.worldManager.isRomSealed(5, -4, 'up')).toBe(false); // write-protection lifted...
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(false); // ...but the seam is YOURS to breach
        expect(game.onUnpauseCallback).toBeTruthy(); // her unseal scene waits on the unpause
        const saved = game.saveManager.load(game.activeSlot);
        expect(saved.unlocked.checkpointOpen).toBe(true); // the file carries the opened state

        // and now a max-gear ram breaches the (hidden, unsealed) seam like any weak point
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = true;
        game.gear = 3;
        const wp = game.worldManager.getWeakPoint(5, -4, 'up');
        game.npcs = []; game.glitches = []; game.obstacles = []; game.apple = { x: 40, y: 340 };
        const r = game.crossBorder(wp.start, -20);
        expect(r.shifted).toBe(true); // clean breach into Port 0
        expect(game.state.unlocked.finaleDoorFound).toBe(true);
    });

    it('death after the checkpoint respawns you at Cold Storage; the seam re-opens only once found', () => {
        const game = newGame();
        game.state.unlocked.checkpointOpen = true;
        game.npcs = []; game.glitches = []; game.obstacles = [];
        game.apple = { x: 300, y: 300 };
        game.die('border');
        expect(game.worldManager.currentRoomX).toBe(5);
        expect(game.worldManager.currentRoomY).toBe(-4);
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(false); // never breached: stays a seam
        expect(game._diedSinceCheckpoint).toBe(true);

        game.state.unlocked.finaleDoorFound = true;
        game.state.gameState = 'PLAYING';
        game.die('border');
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(true); // finale retries walk right back in
    });

    it('stepping through the door re-seals it behind you (one-way, pre-finale)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.breakWall(5, -4, 'up');
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.shiftScreen(0, -1);
        expect(game.worldManager.currentRoomY).toBe(-5);
        expect(game.worldManager.isWallBroken(5, -5, 'down')).toBe(false);
        expect(game.state.unlocked.finaleDoorFound).toBe(true);
    });

    it('a load re-derives the checkpoint door from flags', () => {
        const game = newGame();
        game.state.unlocked.purgeComplete = true;
        game.state.unlocked.checkpointOpen = true;
        const committedOnly = game.serialize();
        game.state.unlocked.finaleDoorFound = true;
        const foundToo = game.serialize();

        const game2 = newGame();
        expect(game2.applySave(committedOnly)).toBe(true);
        expect(game2.worldManager.isRomSealed(5, -4, 'up')).toBe(false); // unsealed
        expect(game2.worldManager.isWallBroken(5, -4, 'up')).toBe(false); // but not breached

        expect(game2.applySave(foundToo)).toBe(true);
        expect(game2.worldManager.isWallBroken(5, -4, 'up')).toBe(true); // once found, it stands open
    });

    it('a pre-checkpoint load re-arms the write-protection', () => {
        const game = newGame();
        const preSave = game.serialize(); // nothing earned yet
        game.worldManager.unsealRomDoor(5, -4, 'up'); // a later run unsealed it
        expect(game.applySave(preSave)).toBe(true);
        expect(game.worldManager.isRomSealed(5, -4, 'up')).toBe(true);
    });

    it('checkpoint respawn clears glitches around the ACTUAL spawn cell, not the room centre', () => {
        const game = newGame();
        game.state.unlocked.checkpointOpen = true;
        game.npcs = []; game.obstacles = [];
        game.apple = { x: 300, y: 60 };
        const g = game.gridSize;
        const cx = Math.floor(game.canvas.width / 2 / g) * g;
        const cy = Math.floor(game.canvas.height / 2 / g) * g;
        // adjacent to the offset spawn (cx, cy+3g) but 3 cells from the centre
        game.glitches = [new Glitch(cx + g, cy + 3 * g, g)];
        game.die('border');
        expect(game.glitches.length).toBe(0);
    });

    it('the CACHE ARG never manifests the Hub apparition inside Cold Storage', () => {
        const game = newGame();
        game.state.unlocked.checkpointOpen = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.npcs = [];
        game.deathCode = 'CACH';
        game.recordDeathKey('E'); // spells CACHE at the checkpoint respawn
        expect(game.npcs.some(n => n.id === 'cache')).toBe(false);
    });
});

// ---------------------------------------------------------------------------------
describe('Port 0 — the rigidity funnel and the reboot', () => {
    beforeEach(mountDom);

    function finaleGame() {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -5;
        game.apple = { x: 40, y: 340 };
        game.obstacles = []; game.stamps = [];
        return game;
    }

    it('the finale room is armed with Gate, one corrupted cell, and Denny', () => {
        const game = newGame();
        const room = game.worldManager.roomGenerator.generateRoom(5, -5, { finaleDone: false, biteProgress: 1 }, game.worldManager);
        expect(room.npcs.some(n => n.id === 'gatefinal')).toBe(true);
        expect(room.npcs.some(n => n.id === 'dennyfinal')).toBe(true);
        expect(room.glitches.length).toBe(1);
        const after = game.worldManager.roomGenerator.generateRoom(5, -5, { finaleDone: true, biteProgress: 1 }, game.worldManager);
        expect(after.npcs.some(n => n.id === 'dennyafter')).toBe(true);
        expect(after.glitches.length).toBe(0);
    });

    it('down to ONE clean escape, Denny issues his only genuine deny', () => {
        const game = finaleGame();
        const gate = new NPC(200, 20, 20, 'gatefinal', []);
        const denny = new NPC(120, 340, 20, 'dennyfinal', []);
        game.npcs = [gate, denny];
        game.glitches = [new Glitch(220, 20, 20)]; // east neighbour is corrupted
        // body blocks north and west; south (200,40) stays clean and free
        game.snake.body = [{ x: 200, y: 0 }, { x: 180, y: 20 }, { x: 100, y: 100 }];
        game.updateGateFinal();
        expect(denny.acted).toBe(true);
        expect(game.stamps.some(s => s.denied && s.x === 200 && s.y === 40)).toBe(true);
        expect(game.state.gameState).toBe('PLAYING'); // not yet — next tick the audit finds him cornered
    });

    it('cornered against the corrupted cell, the paradox fires: reboot, era 16, Layer 2', () => {
        const game = finaleGame();
        const gate = new NPC(200, 20, 20, 'gatefinal', []);
        const denny = new NPC(120, 340, 20, 'dennyfinal', []);
        game.npcs = [gate, denny];
        game.glitches = [new Glitch(220, 20, 20)];
        game.snake.body = [{ x: 200, y: 0 }, { x: 180, y: 20 }, { x: 200, y: 40 }, { x: 100, y: 100 }];
        game.updateGateFinal();
        expect(game.state.gameState).toBe('DIALOG'); // the last citation
        finishDialog(game); // forced -> reboot chain
        const u = game.state.unlocked;
        expect(u.finaleDone).toBe(true);
        expect(u.era16).toBe(true);
        expect(u.musicLayer).toBe(2);
        expect(game.audio.setMusicLayer).toHaveBeenCalledWith(2);
        expect(game.npcs.some(n => n.id === 'gatefinal')).toBe(false); // terminated
        expect(game.audio.playDeath).toHaveBeenCalled(); // a true termination
        expect(game.worldManager.isWallBroken(5, -5, 'down')).toBe(true); // the way home re-opens
        expect(game.state.gameState).toBe('PLAYING');
    });

    it('the PORT 0 aperture is a bonk, not a death', () => {
        const game = finaleGame();
        game.npcs = []; game.glitches = [];
        const g = game.gridSize;
        const mid = Math.floor(game.canvas.width / 2 / g) * g;
        const r = game.crossBorder(mid, -20);
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING');
        expect(game.audio.playDenied).toHaveBeenCalled();
    });

    it('post-finale, re-entering Port 0 does NOT reseal the way home', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.finaleDone = true;
        game.state.unlocked.era16 = true;
        game.worldManager.brokenWalls.add(game.worldManager.boundaryKey(5, -4, 'up'));
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.shiftScreen(0, -1); // visit Denny's vigil
        expect(game.worldManager.currentRoomY).toBe(-5);
        expect(game.worldManager.isWallBroken(5, -5, 'down')).toBe(true); // still open
    });

    it("the finale's corrupted cell cannot be eaten or shunt-bitten away", () => {
        const game = finaleGame();
        game.npcs = []; game.stamps = [];
        game.state.upgrades.corruptHandler = true;
        game.obstacles = [{ x: 240, y: 100 }]; // block the push
        game.glitches = [new Glitch(220, 100, 20)];
        game.snake.body = [{ x: 200, y: 100 }, { x: 180, y: 100 }];
        game.state.score = 1;
        step(game, { x: 20, y: 0 }); // head onto the glitch, push blocked
        expect(game.glitches.length).toBe(1); // indestructible while the fight is live
        expect(game.state.score).toBe(1);     // and it doesn't bite either — a bonk
        expect(game.snake.body.length).toBe(2);
    });
});

// ---------------------------------------------------------------------------------
describe('Wilds discovery', () => {
    beforeEach(mountDom);

    it('a growth cache is +4 Data and +4 length in one bite', () => {
        const game = newGame();
        game.state.score = 0;
        const cache = new NPC(200, 200, 20, 'datacache', []);
        game.npcs = [cache];
        game.npcDataCache(cache);
        expect(game.state.score).toBe(4);
        expect(game.snake.body.length).toBe(5); // head + 4
        expect(game.npcs.length).toBe(0);
    });

    it('every interior room is reachable (the connectivity pass stitches hash-sealed pockets)', () => {
        const wm = newGame().worldManager;
        const b = wm.bounds;
        const dirs = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];
        const reached = new Set(['0,0']);
        const queue = [[0, 0]];
        while (queue.length) {
            const [x, y] = queue.pop();
            for (const [dir, dx, dy] of dirs) {
                const nx = x + dx, ny = y + dy;
                if (nx < b.minX || nx > b.maxX || ny < b.minY || ny > b.maxY) continue;
                const k = `${nx},${ny}`;
                if (reached.has(k) || !wm.getWeakPoint(x, y, dir)) continue;
                reached.add(k);
                queue.push([nx, ny]);
            }
        }
        const total = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
        expect(reached.size).toBe(total); // no room is sealed out of every playthrough
    });

    it('the discovery rooms exist where the Topology Scan says they do', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        const u = { biteProgress: 1 };
        expect(rg.generateRoom(7, -3, u, game.worldManager).npcs.some(n => n.id === 'datacache')).toBe(true);
        expect(rg.generateRoom(11, 2, u, game.worldManager).npcs.some(n => n.id === 'lorefrag')).toBe(true);
        expect(rg.generateRoom(6, 2, u, game.worldManager).npcs.some(n => n.id === 'citizen')).toBe(true);
        expect(rg.generateRoom(11, -4, u, game.worldManager).npcs.some(n => n.id === 'nibble')).toBe(true);
        expect(rg.generateRoom(9, 4, u, game.worldManager).npcs.some(n => n.id === 'hush')).toBe(true);
        const booth = rg.generateRoom(10, 5, u, game.worldManager).npcs;
        expect(booth.some(n => n.id === 'lorefrag')).toBe(true);
        expect(booth.some(n => n.id === 'datacache')).toBe(true);
    });
});
