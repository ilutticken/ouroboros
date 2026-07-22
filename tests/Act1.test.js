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
                <h2 id="shop-title"></h2>
                <div class="shop-items" id="shop-items"></div>
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
describe('The wall ring actually blocks (playtest fix)', () => {
    beforeEach(mountDom);

    it('a solid wall stops the worm ONE CELL OUT — it never enters the wall ring', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        // find a solid (no-weak-point) stretch of the left wall
        const wp = game.worldManager.getWeakPoint(4, 2, 'left');
        const solidY = wp ? (wp.start === 20 ? wp.end + 40 : 20) : 100;
        game.snake.body = [{ x: 20, y: solidY }]; // col 1, against the left wall, off any door
        step(game, { x: -20, y: 0 }); // drive into the wall
        expect(game.state.gameState).toBe('DEAD'); // died at the wall, not inside it
        // the head never occupied the wall-ring cell (x=0)
        expect(game.snake.body.every(s => s.x >= 20)).toBe(true);
    });

    it('a doorway lets the worm step INTO the ring (then cross), not die', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        const wp = game.worldManager.getWeakPoint(4, 2, 'left');
        if (!wp) return; // (defensive: this room's left wall is solid — skip)
        game.snake.body = [{ x: 20, y: wp.start }]; // col 1, aligned with the door
        step(game, { x: -20, y: 0 }); // step toward the door
        expect(game.state.gameState).not.toBe('DEAD'); // stepped into the doorway, alive
    });

    it('spawns never land in the outer wall ring', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        const cols = rg.cols, rows = rg.rows, g = game.gridSize;
        for (let i = 0; i < 50; i++) {
            const p = rg.spawnValidApple([], [], []);
            const c = p.x / g, r = p.y / g;
            expect(c >= 1 && c <= cols - 2 && r >= 1 && r <= rows - 2).toBe(true);
        }
    });

    it('autonomous movers are blocked from the wall ring', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        expect(game._moverBlocked(0, 100)).toBe(true);              // left ring
        expect(game._moverBlocked(game.ringRight, 100)).toBe(true); // right ring
        expect(game._moverBlocked(100, 0)).toBe(true);              // top ring
        expect(game._moverBlocked(40, 100)).toBe(false);            // interior (nothing there)
    });

    it('ramming a solid wall while ferrying 2-Bit TUGS BACK (non-lethal) — the ring guard delegates', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.tailRider = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.obstacles = [];
        game.npcs = [new NPC(300, 300, 20, 'bite', [])]; // 2-Bit still aboard (on the grid)
        const wp = game.worldManager.getWeakPoint(4, 2, 'left');
        const solidY = wp ? (wp.start === 20 ? wp.end + 40 : 20) : 100; // off any door
        game.snake.body = [{ x: 20, y: solidY }, { x: 40, y: solidY }];
        game.state.score = 12;
        game.input.direction = { x: -20, y: 0 };
        step(game, { x: -20, y: 0 }); // drive into the solid wall
        expect(game.state.gameState).toBe('PLAYING'); // NOT dead — 2-Bit tugged you back
        expect(game.state.score).toBe(12);            // no reset
        expect(game.input.direction.x).toBe(20);      // reversed
    });

    it('driving into Port 0\'s aperture is a BONK, not a death, via the ring guard', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -5;
        game.apple = { x: 40, y: 340 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        const g = game.gridSize;
        const mid = Math.floor(game.canvas.width / 2 / g) * g; // aperture centre column
        game.snake.body = [{ x: mid, y: 20 }]; // row 1, aligned with the aperture, facing north
        game.input.direction = { x: 0, y: -20 };
        step(game, { x: 0, y: -20 }); // drive up into the sealed port
        expect(game.state.gameState).toBe('PLAYING'); // a bonk, never a death
        expect(game.audio.playDenied).toHaveBeenCalled();
        expect(game.snake.head.y).toBe(20); // didn't move into the ring
    });

    it('crossing a broken door still transitions to the next room (2-step doorway walk)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        // guarantee a broken left door and align the head with it
        const wp = game.worldManager.getWeakPoint(4, 2, 'left') || { start: 100 };
        game.worldManager.breakWall(4, 2, 'left');
        game.snake.body = [{ x: 20, y: wp.start }]; // col 1, at the door
        step(game, { x: -20, y: 0 }); // step into the doorway (col 0)
        expect(game.worldManager.currentRoomX).toBe(4); // not crossed yet — in the doorway
        step(game, { x: -20, y: 0 }); // off-canvas -> transition to {3,2}
        expect(game.worldManager.currentRoomX).toBe(3);
        expect(game.worldManager.currentRoomY).toBe(2);
        expect(game.state.gameState).not.toBe('DEAD');
    });
});

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

    it('first bump plays her intro, then opens her REAL shop (like 2-Bit)', () => {
        const game = newGame();
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcs = [nib];
        game.npcNibble(nib);
        expect(game.state.unlocked.nibbleMet).toBe(true);
        expect(game.state.gameState).toBe('DIALOG'); // intro first
        finishDialog(game); // intro's onComplete opens the shop
        expect(game.state.gameState).toBe('SHOP');
        expect(game.shopManager.activeVendor).toBe('nibble');
        expect(game.shopManager.items.some(i => i.name === 'Glitch Shunt')).toBe(true);
    });

    it('buying the Glitch Shunt spends Data off the body; price = 20', () => {
        const game = newGame();
        game.state.unlocked.nibbleMet = true;
        game.state.score = 25;
        game.growSnake(25); // Data = segments: 26 cells incl. head
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcs = [nib];
        game.npcNibble(nib); // straight to shop (already met)
        expect(game.state.gameState).toBe('SHOP');
        const shunt = game.shopManager.items.find(i => i.name === 'Glitch Shunt');
        game.shopManager.purchase(shunt);
        expect(game.state.upgrades.corruptHandler).toBe(true);
        expect(game.state.score).toBe(5);
        expect(game.snake.body.length).toBe(6); // 26 - 20 spent (Data = segments)
    });

    it('under 20 Data the Shunt button is disabled, and nothing is spent', () => {
        const game = newGame();
        game.state.unlocked.nibbleMet = true;
        game.state.score = 10;
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcNibble(nib);
        const shunt = game.shopManager.items.find(i => i.name === 'Glitch Shunt');
        game.shopManager.purchase(shunt); // refused: can't afford
        expect(game.state.upgrades.corruptHandler).toBe(false);
        expect(game.state.score).toBe(10);
    });

    it('Scale Mods absorb the first Glitch bite per room, then it bites again', () => {
        const game = newGame();
        game.state.upgrades.glitchWard = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 }; game.npcs = []; game.obstacles = [];
        game.state.score = 10; game.growSnake(10); // 11 cells
        game._wardUsedThisRoom = false;
        game.glitches = [new Glitch(120, 100, 20)];
        game.snake.body = [{ x: 100, y: 100 }, ...Array.from({ length: 10 }, (_, i) => ({ x: 80 - i * 20, y: 100 }))];
        step(game, { x: 20, y: 0 }); // first bite: absorbed
        expect(game.state.score).toBe(10); // no drain
        expect(game._wardUsedThisRoom).toBe(true);
        game.glitches = [new Glitch(140, 100, 20)];
        step(game, { x: 20, y: 0 }); // second bite: real
        expect(game.state.score).toBeLessThan(10);
    });

    it('Salvage Claws drop re-collectible Data when corruption sheds you', () => {
        const game = newGame();
        game.state.upgrades.salvage = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 }; game.npcs = []; game.obstacles = [];
        game.state.score = 10; game.growSnake(10);
        // tail trails DOWN the screen (on-canvas) so shed cells are valid drop sites
        game.snake.body = [{ x: 100, y: 100 }, ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: 120 + i * 20 }))];
        game.glitches = [new Glitch(120, 100, 20)];
        step(game, { x: 20, y: 0 }); // 3-segment bite -> salvage drops ~2 motes
        expect(game.dataMotes.some(m => m.salvage)).toBe(true);
    });

    it('Salvage Claws also drop on a Crumple bounce (post-fold, so the shed cells are free)', () => {
        const game = newGame();
        game.state.upgrades.salvage = true;
        game.state.upgrades.crumpleLevel = 1;
        game.state.unlocked.borders = false;
        game.apple = { x: 340, y: 20 }; game.npcs = []; game.obstacles = [];
        game.state.score = 20; game.growSnake(20);
        // a long on-canvas body so shedAmount(10) has room and the shed cells are valid
        game.snake.body = [{ x: 200, y: 20 }, ...Array.from({ length: 18 }, (_, i) => ({ x: 200, y: 40 + i * 20 }))];
        game.input.direction = { x: 20, y: 0 };
        game.bounce();
        expect(game.dataMotes.some(m => m.salvage)).toBe(true); // motes dropped at vacated cells
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
describe('Heur\'s Decontamination — in-room Breakout', () => {
    beforeEach(mountDom);

    it('fires only in the DEDICATED Bay {5,-1}, entered while flagged; you stay in PLAYING', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = 0; // Localhost
        game.shiftScreen(0, -1); // heading NORTH up the spine into the Bay {5,-1}
        expect(game.state.gameState).toBe('DIALOG');
        expect(game.dialogManager.currentDialog).toBe(HEUR.intercept);
        finishDialog(game);
        expect(game.state.gameState).toBe('PLAYING'); // the fight is played IN the room
        expect(game.heur).toBeTruthy();
        expect(game.heur.far).toBe('up'); // you were heading north
        expect(game.state.unlocked.bayRoom).toEqual({ x: 5, y: -1 });
        expect(game.glitches.length).toBe(0); // the bay is swept clean
        expect(game.obstacles.length).toBe(0);
    });

    it('the daemon never ambushes elsewhere — only the Bay triggers it', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        expect(game._heurInterceptHere(1, 0)).toBe(false); // a random open sector
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        expect(game._heurInterceptHere(0, -1)).toBe(false); // Localhost
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -1;
        expect(game._heurInterceptHere(0, -1)).toBe(true);  // the Bay
        // and never again once decontaminated
        game.state.unlocked.purgeComplete = true;
        expect(game._heurInterceptHere(0, -1)).toBe(false);
    });

    it('the ping ADVANCES on a wall-bonk tick (no free pressure by parking on a wall)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.tailRider = true; // gear system on
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far=right, retreat=left
        // hold into the FAR (sealed, non-retreat) wall — a bonk every tick
        game.snake.body = [{ x: game.ringRight - 20, y: 200 }];
        game.input.direction = { x: 20, y: 0 };
        game.input.nextDirection = { x: 20, y: 0 };
        const before = { c: game.heur.ping.c, r: game.heur.ping.r };
        game.update(1000); // one move-tick: the head bonks, but the ping must still step
        expect(game.heur).toBeTruthy(); // NOT a retreat — the fight is still live
        const after = { c: game.heur.ping.c, r: game.heur.ping.r };
        expect(after.c === before.c && after.r === before.r).toBe(false); // ping moved
    });

    it('the Bay {5,-1} is an interior spine room — its far door (up) is never coil', () => {
        const wm = newGame().worldManager;
        expect(wm.isCoilWall(5, -1, 'up')).toBe(false);   // north to the rematches
        expect(wm.isCoilWall(5, -1, 'down')).toBe(false); // south back to Localhost (retreat)
    });

    it('the room is SEALED (a bonk, not a death) except the retreat door', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far=right, retreat=left
        game.gear = 3;
        const r = game.crossBorder(400, 200); // ram the far (right) wall — sealed
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING'); // no death
        expect(game.heur).toBeTruthy();               // fight still live
        expect(game.audio.playDenied).toHaveBeenCalled();
        // but the retreat (left, the way you came) is NOT sealed — the fight ENDS
        // (the seal lifts) and the crossing falls through to the normal boundary logic.
        game.crossBorder(-20, 200);
        expect(game.heur).toBeNull(); // retreated: fight over, no restart, no penalty
    });

    it('the ping reads the HEAD for 2 segments + 2 Data (coupled), and deflects off the body', () => {
        const game = newGame();
        game.state.score = 10; game.growSnake(10);
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        game.heur.bricks = []; // isolate: no accidental win
        const g = game.gridSize;
        // a length-5 body so the head-read can shed the full 2
        game.snake.body = [{ x: 5 * g, y: 5 * g }, { x: 6 * g, y: 5 * g }, { x: 7 * g, y: 5 * g }, { x: 8 * g, y: 5 * g }, { x: 9 * g, y: 5 * g }];
        game.heur.ping = { c: 4, r: 5, dc: 1, dr: 0 }; // about to step onto the head cell
        game._heurPingStep();
        expect(game.state.score).toBe(8); // -2 (coupled)
        expect(game.snake.body.length).toBe(3); // 5 -> 3
        expect(game.audio.playCorruptHit).toHaveBeenCalled();
    });

    it('Heur\'s own signature is unbreakable until every other brick is gone', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        const heur = game.heur.bricks.find(b => b.heur);
        game.snake.body = [{ x: 0, y: 0 }]; // keep the body out of the way
        // aim the ping into the heur brick from the left
        game.heur.ping = { c: heur.c - 1, r: heur.r, dc: 1, dr: 0 };
        game._heurPingStep();
        expect(game.heur.bricks.some(b => b.heur)).toBe(true); // still there
    });

    it('the ping is CONTAINED — it bounces off every wall (no pass, no restart)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far=right, retreat=left
        game.snake.body = [{ x: 0, y: 0 }]; // body out of the way
        game.heur.bricks = [game.heur.bricks.find(b => b.heur)]; // isolate: no accidental win
        // drive the ping into the LEFT wall (the retreat side) — it must reflect, not leave
        game.heur.ping = { c: 0, r: 5, dc: -1, dr: 0 };
        game._heurPingStep();
        expect(game.heur).toBeTruthy();          // still fighting (no reseal, no restart)
        expect(game.heur.ping.dc).toBe(1);       // reflected back into the room
        expect(game.heur.ping.c).toBeGreaterThanOrEqual(0); // never left the bay
    });

    it('breaking the whole database WINS: the far door opens, the seal lifts, the Ascent arms', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far = right door
        game.snake.body = [{ x: 0, y: 0 }];
        const heur = game.heur.bricks.find(b => b.heur);
        game.heur.bricks = [heur]; // only his signature remains
        game.heur.ping = { c: heur.c - 1, r: heur.r, dc: 1, dr: 0 };
        game._heurPingStep();
        expect(game.heur).toBeNull(); // seal lifted
        expect(game.state.unlocked.purgeComplete).toBe(true);
        expect(game.worldManager.isWallBroken(8, 1, 'right')).toBe(true); // far door opened
        expect(game.state.gameState).toBe('DIALOG');
        finishDialog(game);
        expect(game.state.gameState).toBe('PLAYING');
        // and now you can actually leave through the far door
        expect(game.worldManager.getWeakPoint(8, 1, 'right')).toBeTruthy();
    });

    it('the ping never freezes in a corner against the locked signature', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        game.snake.body = [{ x: 0, y: 0 }];
        const positions = new Set();
        for (let i = 0; i < 40; i++) {
            if (!game.heur) break;
            game._heurPingStep();
            if (game.heur) positions.add(game.heur.ping.c + ',' + game.heur.ping.r);
        }
        expect(positions.size).toBeGreaterThan(3); // it keeps travelling
    });

    it('for EVERY far direction the ping stays in-bounds, keeps moving, never tunnels bricks', () => {
        for (const far of ['right', 'left', 'up', 'down']) {
            const game = newGame();
            game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
            game.startHeurFight(far);
            game.snake.body = [{ x: 0, y: 0 }]; // body out of the way
            const H = game.heur;
            const seen = new Set();
            let steps = 0;
            const goal = H.goal;
            while (game.heur && steps < 600) {
                const p = game.heur.ping;
                // the ping must never sit inside a NON-goal out-of-bounds cell (a leak)
                const oobBad =
                    (p.c < 0 && goal !== 'left') || (p.c >= H.cols && goal !== 'right') ||
                    (p.r < 0 && goal !== 'up') || (p.r >= H.rows && goal !== 'down');
                expect(oobBad).toBe(false);
                seen.add(p.c + ',' + p.r);
                game._heurPingStep();
                steps++;
            }
            // it should have visited many cells (not frozen) and terminated (win or a
            // reseal opening a dialog) within the budget — never an infinite loop.
            expect(seen.size).toBeGreaterThan(8);
        }
    });

    it('a win on a far wall the hash left SOLID still opens a usable door (no soft-lock)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        // pick a room+dir where getWeakPoint is null pre-win
        let room = null;
        outer:
        for (let x = 2; x <= 10; x++) for (let y = -4; y <= 4; y++) {
            for (const dir of ['right', 'left', 'up', 'down']) {
                if (!game.worldManager.isCoilWall(x, y, dir) && !game.worldManager.getWeakPoint(x, y, dir)) { room = { x, y, dir }; break outer; }
            }
        }
        expect(room).toBeTruthy();
        game.worldManager.currentRoomX = room.x; game.worldManager.currentRoomY = room.y;
        game.startHeurFight(room.dir);
        game.snake.body = [{ x: 0, y: 0 }];
        game.heur.bricks = [game.heur.bricks.find(b => b.heur)];
        const hb = game.heur.bricks[0];
        // deliver the ping onto the last brick
        game.heur.ping = { c: hb.c - 1, r: hb.r, dc: 1, dr: 0 };
        // some far dirs need a different approach vector; brute-force a hit
        for (let i = 0; i < 400 && game.heur; i++) {
            game.snake.body = [{ x: 0, y: 0 }];
            game._heurPingStep();
        }
        expect(game.heur).toBeNull();
        expect(game.worldManager.getWeakPoint(room.x, room.y, room.dir)).toBeTruthy(); // door forced into being
        expect(game.worldManager.isWallBroken(room.x, room.y, room.dir)).toBe(true);   // and opened
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

    it("the finale's corrupted cell cannot be eaten, bitten, OR shunt-SHOVED away", () => {
        const game = finaleGame();
        game.npcs = []; game.stamps = [];
        game.state.upgrades.corruptHandler = true; // the Shunt would normally shove it
        game.obstacles = [];
        game.glitches = [new Glitch(220, 100, 20)];
        game.snake.body = [{ x: 200, y: 100 }, { x: 180, y: 100 }];
        game.state.score = 1;
        step(game, { x: 20, y: 0 }); // head onto the glitch — the finale guard runs BEFORE the shove
        expect(game.glitches.length).toBe(1);       // still there
        expect(game.glitches[0].x).toBe(220);       // and NOT shoved off position
        expect(game.state.score).toBe(1);           // a harmless bonk
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

    it('Wilds UI modules are found by bump, grant their tool, and never respawn', () => {
        const game = newGame();
        const gm = new NPC(80, 80, 20, 'uimodule', []);
        gm.grant = 'gearMeter'; gm.roomKey = '2,2';
        game.npcs = [gm];
        game.npcUiModule(gm);
        expect(game.state.unlocked.gearMeter).toBe(true);
        expect(game.state.unlocked.modulesFound).toContain('2,2');
        expect(game.npcs.length).toBe(0);
        // RoomGenerator suppresses an already-found module room
        const room = game.worldManager.roomGenerator.generateRoom(2, 2, game.state.unlocked, game.worldManager);
        expect(room.npcs.some(n => n.id === 'uimodule')).toBe(false);
    });

    it('the map-pins tool grants a shape and cycles the current room pin (persisted)', () => {
        const game = newGame();
        const tool = new NPC(80, 80, 20, 'uimodule', []);
        tool.grant = 'mapPins'; tool.roomKey = '3,-3';
        game.npcUiModule(tool);
        expect(game.state.unlocked.mapPinsTool).toBe(true);
        expect(game.state.unlocked.pinShapes).toBe(1);
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 1;
        game.cycleMapPin();
        expect(game.mapPins['4,1']).toBe(0); // first shape
        game.cycleMapPin();
        expect(game.mapPins['4,1']).toBeUndefined(); // one shape -> cycles straight back to none
        // an extra shape module raises the cycle length
        const extra = new NPC(80, 80, 20, 'uimodule', []);
        extra.grant = 'pinShape'; extra.roomKey = '2,-4';
        game.npcUiModule(extra);
        expect(game.state.unlocked.pinShapes).toBe(2);
        game.cycleMapPin(); expect(game.mapPins['4,1']).toBe(0);
        game.cycleMapPin(); expect(game.mapPins['4,1']).toBe(1);
        game.cycleMapPin(); expect(game.mapPins['4,1']).toBeUndefined();
    });

    it('pin-shape count is order-independent: extras-first then the tool = 2 shapes', () => {
        const game = newGame();
        const extra = new NPC(0, 0, 20, 'uimodule', []); extra.grant = 'pinShape'; extra.roomKey = '2,-4';
        game.npcUiModule(extra); finishDialog(game);
        expect(game.state.unlocked.pinShapes).toBe(1); // the extra
        const tool = new NPC(0, 0, 20, 'uimodule', []); tool.grant = 'mapPins'; tool.roomKey = '3,-3';
        game.npcUiModule(tool); finishDialog(game);
        expect(game.state.unlocked.mapPinsTool).toBe(true);
        expect(game.state.unlocked.pinShapes).toBe(2); // the tool ADDS its own shape (not clamped to 1)
    });

    it('found UI modules and pins survive a save/load round-trip', () => {
        const game = newGame();
        game.state.unlocked.gearMeter = true;
        game.state.unlocked.coordReadout = true;
        game.state.unlocked.mapPinsTool = true;
        game.state.unlocked.pinShapes = 2;
        game.state.unlocked.modulesFound = ['2,2', '8,2'];
        game.mapPins = { '5,0': 1, '8,3': 0 };
        const d = game.serialize();
        const g2 = newGame();
        expect(g2.applySave(d)).toBe(true);
        expect(g2.state.unlocked.gearMeter).toBe(true);
        expect(g2.state.unlocked.pinShapes).toBe(2);
        expect(g2.state.unlocked.modulesFound).toEqual(['2,2', '8,2']);
        expect(g2.mapPins).toEqual({ '5,0': 1, '8,3': 0 });
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
