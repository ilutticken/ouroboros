/**
 * @vitest-environment happy-dom
 */
// Diegetic ambient audio: the system reacting to where your body is.
// These tests pin the *trigger logic* (when playWub / playGlide fire) rather
// than the Web Audio synthesis, which needs a real AudioContext + user gesture.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { AudioEngine } from '../src/engine/Audio.js';
import { Glitch } from '../src/entities/Glitch.js';
import { NPC } from '../src/entities/NPC.js';
import { SaveManager } from '../src/systems/SaveManager.js';
import { NarrativeManager } from '../src/systems/NarrativeManager.js';
import { THEME_CHANNELS, LOOP_BEATS, noteFreq } from '../src/content/music.js';

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
}

function newGame(width = 400, height = 400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;   // default 20 cols
    canvas.height = height; // default 20 rows
    const game = new GameEngine(canvas);
    // Spy on the diegetic sounds so we can assert triggers without Web Audio.
    game.audio.playWub = vi.fn();
    game.audio.playGlide = vi.fn();
    game.state.gameState = 'PLAYING';
    return game;
}

/** Drive exactly one grid step in a given direction. */
function step(game, dir) {
    game.input.nextDirection = { ...dir };
    game.update(1000); // exceed any speed threshold -> one guaranteed move
}

describe('AudioEngine diegetic sounds', () => {
    it('exposes wub and glide, and no-ops safely before init', () => {
        const audio = new AudioEngine();
        expect(typeof audio.playWub).toBe('function');
        expect(typeof audio.playGlide).toBe('function');
        // Uninitialized (no user gesture yet): must not throw.
        expect(() => audio.playWub(1)).not.toThrow();
        expect(() => audio.playGlide(0.5)).not.toThrow();
    });

    it('exposes Cadenza\'s song and no-ops safely before init', () => {
        const audio = new AudioEngine();
        expect(typeof audio.playCadenzaSong).toBe('function');
        expect(() => audio.playCadenzaSong(1)).not.toThrow();
        expect(() => audio.playCadenzaSong()).not.toThrow(); // default proximity
    });
});

describe('Corruption proximity wubs', () => {
    beforeEach(mountDom);

    it('wubs when a body segment slithers within 3 tiles of a Glitch', () => {
        const game = newGame();
        game.state.unlocked.borders = false; // isolate: no wall glide
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 100, y: 100 }];
        game.glitches = [new Glitch(140, 100, 20)]; // head lands 1 tile away

        step(game, { x: 20, y: 0 }); // head -> (120,100), Chebyshev dist 1 to glitch

        expect(game.audio.playWub).toHaveBeenCalledTimes(1);
        // 1 tile away is maximum dread.
        expect(game.audio.playWub.mock.calls[0][0]).toBeCloseTo(1, 5);
    });

    it('intensity falls off with distance', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 100, y: 100 }];
        game.glitches = [new Glitch(160, 100, 20)]; // head lands 2 tiles away

        step(game, { x: 20, y: 0 }); // head -> (120,100), dist 2

        expect(game.audio.playWub).toHaveBeenCalledTimes(1);
        expect(game.audio.playWub.mock.calls[0][0]).toBeCloseTo(2 / 3, 5);
    });

    it('stays silent when all Glitches are beyond the dread radius', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 100, y: 100 }];
        game.glitches = [new Glitch(300, 100, 20)]; // 9 tiles away

        step(game, { x: 20, y: 0 });

        expect(game.audio.playWub).not.toHaveBeenCalled();
    });

    it('wubs off a TRAILING body segment even when the head is out of range', () => {
        // Pins the headline "any body segment" contract: a head-only implementation
        // would go silent here because the head lands 6 tiles from the Glitch.
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [new Glitch(100, 100, 20)];
        game.snake.body = [{ x: 200, y: 100 }, { x: 160, y: 100 }];

        step(game, { x: 20, y: 0 }); // head -> (220,100) dist 6; segment (160,100) dist 3

        expect(game.audio.playWub).toHaveBeenCalledTimes(1);
        expect(game.audio.playWub.mock.calls[0][0]).toBeCloseTo(1 / 3, 5);
    });

    it('fires at exactly the edge of the dread radius (3 tiles)', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 100, y: 100 }];
        game.glitches = [new Glitch(180, 100, 20)]; // head lands exactly 3 tiles away

        step(game, { x: 20, y: 0 }); // head -> (120,100), dist 3

        expect(game.audio.playWub).toHaveBeenCalledTimes(1);
        expect(game.audio.playWub.mock.calls[0][0]).toBeCloseTo(1 / 3, 5);
    });

    it('is silent one tile past the dread radius (4 tiles)', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 100, y: 100 }];
        game.glitches = [new Glitch(200, 100, 20)]; // head lands 4 tiles away

        step(game, { x: 20, y: 0 }); // head -> (120,100), dist 4

        expect(game.audio.playWub).not.toHaveBeenCalled();
    });

    it('never exceeds intensity 1, even when the head overlaps a Glitch (dist 0)', () => {
        // dist-0 (segment on the Glitch) is excluded; intensity comes from the
        // nearest *non-overlapping* segment, so it must clamp to <= 1, not 4/3.
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        // Length 6 so it survives the glitch-contact damage without dying.
        game.snake.body = [
            { x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 },
            { x: 40, y: 100 }, { x: 20, y: 100 }, { x: 0, y: 100 },
        ];
        game.glitches = [new Glitch(120, 100, 20)];

        step(game, { x: 20, y: 0 }); // head -> (120,100) ON glitch; prev head now dist 1

        expect(game.audio.playWub).toHaveBeenCalledTimes(1);
        expect(game.audio.playWub.mock.calls[0][0]).toBeCloseTo(1, 5);
        expect(game.audio.playWub.mock.calls[0][0]).toBeLessThanOrEqual(1);
    });
});

describe('Wall-friction glide', () => {
    beforeEach(mountDom);

    it('scrapes when the head travels parallel and adjacent to a border', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 20, y: 100 }]; // col 1 — the interior cell against the left wall

        step(game, { x: 0, y: -20 }); // glide up along the left wall -> (20,80)

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('is silent mid-field, away from any wall', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 200, y: 200 }];

        step(game, { x: 20, y: 0 }); // (220,200), nowhere near an edge

        expect(game.audio.playGlide).not.toHaveBeenCalled();
    });

    it('does not scrape before the walls exist (borders still locked)', () => {
        const game = newGame();
        game.state.unlocked.borders = false; // The Void: wrap-around, no walls
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 0, y: 100 }];

        step(game, { x: 0, y: -20 });

        expect(game.audio.playGlide).not.toHaveBeenCalled();
    });

    it('scrapes along the RIGHT wall too', () => {
        const game = newGame(); // 400x400: the interior cell against the right wall is col 18 = x360
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: game.ringRight - 20, y: 100 }];

        step(game, { x: 0, y: -20 }); // glide up along the right wall

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('scrapes along the TOP edge moving horizontally', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 100, y: 20 }]; // row 1 — against the top wall

        step(game, { x: 20, y: 0 }); // glide right along the top edge

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('detects a far-wall glide on a canvas NOT aligned to the grid', () => {
        // 410px wide: the interior cell against the right wall is derived from the ring.
        const game = newGame(410, 410);
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: game.ringRight - 20, y: 100 }];

        step(game, { x: 0, y: -20 });

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('scales glide intensity with gear (pitch rises with speed)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 20, y: 100 }];
        game.gear = 2; // not clobbered: changeGear only fires from an input callback

        step(game, { x: 0, y: -20 });

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
        expect(game.audio.playGlide.mock.calls[0][0]).toBeCloseTo(0.3 + 2 * 0.22, 5); // 0.74
    });

    it('scrapes off a TRAILING segment pinned to the wall even when the head is off it', () => {
        // Whole-body parity with the wub: head has peeled inward (x=40) but the
        // tail still hugs x=0, so the friction must keep sounding. Head-only fails.
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [
            { x: 40, y: 100 }, { x: 20, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 80 },
        ];

        step(game, { x: 0, y: 20 }); // moving vertically; tail segments at x=0 scrape

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('keeps scraping after you turn OFF the wall while the body is still on it', () => {
        // The reported bug: gliding down the left wall, then turning right (head
        // moves perpendicular, off the wall) must not cut the sound while the body
        // is still draped along x=0. Direction no longer gates the scrape.
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 0, y: 100 }, { x: 0, y: 80 }, { x: 0, y: 60 }];

        step(game, { x: 20, y: 0 }); // head turns right OFF the wall; body still at x=0

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });
});

describe('Smashing weak-point walls', () => {
    beforeEach(mountDom);

    // Places the head on the ACTUAL (hashed) weak point of the [1,0] right wall.
    function atWildsRightWall() {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 1; // in the Wilds
        game.worldManager.currentRoomY = 0;
        game.worldManager.rooms['2,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };
        const wp = game.worldManager.getWeakPoint(1, 0, 'right');
        game.snake.body = [{ x: 380, y: wp.start + 40 }]; // centre cell of the weak point
        return game;
    }

    it('walks through an already-broken doorway', () => {
        const game = atWildsRightWall();
        game.worldManager.breakWall(1, 0, 'right'); // pre-smashed

        step(game, { x: 20, y: 0 });

        expect(game.worldManager.currentRoomX).toBe(2);
        expect(game.state.gameState).not.toBe('DEAD');
    });

    it('a broken wall is passable ONLY at the doorway — off-gap stays lethal', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.worldManager.breakWall(1, 0, 'right'); // smashed open at the centre
        game.worldManager.rooms['2,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };
        game.gear = 3;
        game.snake.body = [{ x: 380, y: 0 }]; // right wall, top corner — always OFF the gap (start >= 20)

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).toBe('DEAD'); // solid part is lethal even when the wall is broken
        expect(game.worldManager.currentRoomX).toBe(0);
    });

    it('a max-gear ram smashes a fresh weak point open and crosses in one hit', () => {
        const game = atWildsRightWall();
        game.gear = 3;

        step(game, { x: 20, y: 0 });

        expect(game.worldManager.isWallBroken(1, 0, 'right')).toBe(true);
        expect(game.worldManager.currentRoomX).toBe(2);
    });

    it('sub-smashing cracks the wall but RESTARTS you; only max gear breaches', () => {
        const game = atWildsRightWall();
        game.gear = 2; // sub-max

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).toBe('DEAD'); // the impact destroys you
        const dmg = game.worldManager.getWallDamage(1, 0, 'right');
        expect(dmg).toBeGreaterThan(0); // kept SOME crack
        expect(dmg).toBeLessThan(3);    // but never enough to break on its own
        expect(game.worldManager.isWallBroken(1, 0, 'right')).toBe(false);
        expect(game.state.unlocked.subSmashRevealed).toBe(true); // Architect gloats the reveal
        expect(game.gear).toBe(0);                 // respawn starts from a standstill
        expect(game.speed).toBe(game.baseSpeed);   // no ghost momentum carried through death
    });

    it('a base-speed ram does nothing — no damage, no crossing, no death', () => {
        const game = atWildsRightWall();
        game.gear = 0;

        step(game, { x: 20, y: 0 });

        expect(game.worldManager.getWallDamage(1, 0, 'right')).toBe(0);
        expect(game.worldManager.currentRoomX).toBe(1);
        expect(game.state.gameState).not.toBe('DEAD');
    });

    it('still kills you on the solid part of a wall (outside the doorway)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.snake.body = [{ x: 380, y: 0 }]; // right wall, top corner — always off the gap
        game.gear = 3; // even at max speed, solid wall is lethal

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).toBe('DEAD');
        expect(game.worldManager.currentRoomX).toBe(0); // died -> warped back to hub
    });

    it('the hub breaches at max gear (the one Beat-4 escape)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.rooms['1,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };
        game.snake.body = [{ x: 380, y: 200 }];
        game.gear = 3;

        step(game, { x: 20, y: 0 });

        expect(game.worldManager.isWallBroken(0, 0, 'right')).toBe(true);
        expect(game.state.unlocked.wallBroken).toBe(true);
        expect(game.worldManager.currentRoomX).toBe(1);
    });

    it('a low-gear ram on the hub bonks without dying or crossing', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.gear = 0; // hub is (0,0) by default
        game.snake.body = [{ x: 380, y: 200 }];

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).not.toBe('DEAD'); // no momentum -> bonk, not death
        expect(game.worldManager.currentRoomX).toBe(0); // did not cross
    });

    it('the hub side walls stay lethal even at max gear (sealed quarantine)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.gear = 3;
        game.snake.body = [{ x: 200, y: 0 }]; // top wall, dead center — a weak point, but sealed

        step(game, { x: 0, y: -20 });

        expect(game.state.gameState).toBe('DEAD');
    });
});

describe('Gate is a live antagonist', () => {
    beforeEach(mountDom);

    it('tracks the player along the Y axis while unresolved', () => {
        const game = newGame();
        game.apple = { x: 300, y: 300 }; game.obstacles = []; // keep the tracked cell clear
        game.npcs = [new NPC(200, 200, 20, 'gate', ['HALT!'])];
        game.snake.body = [{ x: 40, y: 100 }]; // head y=100, gate y=200

        game.updateGate();

        expect(game.npcs[0].y).toBe(180); // one cell toward the player row
    });

    it('does not overshoot the player row', () => {
        const game = newGame();
        game.apple = { x: 300, y: 300 }; game.obstacles = [];
        game.npcs = [new NPC(200, 110, 20, 'gate', ['x'])];
        game.snake.body = [{ x: 40, y: 100 }]; // gap smaller than a cell

        game.updateGate();

        expect(game.npcs[0].y).toBe(100); // clamps, no overshoot
    });

    it('when leaving, reaches the doorway, smashes it open, and vanishes', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 3;
        game.worldManager.currentRoomY = 0;
        const gate = new NPC(360, 200, 20, 'gate', ['x']);
        gate.leaving = true;
        gate.exitDir = 'right';
        gate.exitX = 380;
        gate.exitY = 200;
        game.npcs = [gate];
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }];

        game.updateGate(); // 360 -> 380 (exitX), y already at exitY -> arrives

        expect(game.worldManager.isWallBroken(3, 0, 'right')).toBe(true);
        expect(game.npcs.some(n => n.id === 'gate')).toBe(false);
    });

    it('a fleeing Gate converges and breaches even on a non-grid-aligned canvas', () => {
        const g = 20;
        const game = newGame(410, 410); // width NOT a multiple of gridSize
        game.worldManager.currentRoomX = 3;
        game.worldManager.currentRoomY = 0;
        const gate = new NPC(200, 200, g, 'gate', ['x']);
        gate.leaving = true;
        gate.exitDir = 'right';
        gate.exitX = Math.floor((410 - g) / g) * g; // grid-aligned exit, as the code now computes
        gate.exitY = Math.floor(410 / 2 / g) * g;
        game.npcs = [gate];
        game.apple = { x: 100, y: 100 };
        game.glitches = [];
        game.snake.body = [{ x: 40, y: 40 }];

        // Must terminate (not orbit the target forever) and open the breach.
        for (let i = 0; i < 50 && game.npcs.some(n => n.id === 'gate'); i++) game.updateGate();

        expect(game.worldManager.isWallBroken(3, 0, 'right')).toBe(true);
        expect(game.npcs.some(n => n.id === 'gate')).toBe(false);
    });
});

describe('Denny — the route-around checkpoint', () => {
    beforeEach(mountDom);

    it('spawns in the first Wilds room [1,0]', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'denny')).toBe(true);
    });

    it('bumping Denny opens dialog, never death, and marks him met', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'denny', ['Denny: HALT.'])];
        game.snake.body = [{ x: 100, y: 100 }];
        game.dialogManager.start = (lines, cb) => cb(); // auto-complete dialog

        step(game, { x: 20, y: 0 }); // head -> (120,100) onto Denny

        expect(game.state.gameState).toBe('PLAYING'); // dialog callback resumed play
        expect(game.npcs[0].met).toBe(true);
    });
});

describe('Narrative monitor boots at 5 Data', () => {
    beforeEach(mountDom);

    it('stays dark and silent on the first Data (no phantom doots)', () => {
        const game = newGame();
        game.state.score = 1;

        game.checkUnlocks();

        expect(game.narrative.online).toBe(false);
        expect(game.narrative.terminal.children.length).toBe(0); // nothing printed
    });

    it('boots and prints the reveal message once UI unlocks at 5', () => {
        const game = newGame();
        game.state.score = 5;

        game.checkUnlocks();

        expect(game.narrative.online).toBe(true);
        expect(game.narrative.terminal.children.length).toBe(1); // the score-5 line
    });
});

describe('2-Bit survives respawn', () => {
    beforeEach(mountDom);

    it('is re-placed in the hub when you die after meeting him (no soft-lock)', () => {
        const game = newGame();
        game.state.unlocked.biteProgress = 1; // met, riding the grid (not the tail)
        game.state.unlocked.tailRider = false;
        game.npcs.push(new NPC(40, 40, 20, 'bite', []));
        game.apple = { x: 200, y: 200 }; // a normal apple, not the Bite-apple

        game.die('self');

        expect(game.state.gameState).toBe('DEAD');
        expect(game.npcs.some(n => n.id === 'bite')).toBe(true);
    });
});

describe('Ambient audio cross-cutting behavior', () => {
    beforeEach(mountDom);

    it('a wub AND a scrape can both fire on the same grid step', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 20, y: 100 }]; // col 1 — against the left wall
        game.glitches = [new Glitch(20, 40, 20)]; // 2 tiles from the head's landing

        step(game, { x: 0, y: -20 }); // head -> (20,80): left-wall glide + glitch nearby

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
        expect(game.audio.playWub).toHaveBeenCalledTimes(1);
    });

    it('is silent while the simulation is frozen (PAUSED)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 0, y: 100 }];
        game.glitches = [new Glitch(0, 60, 20)];
        game.state.gameState = 'PAUSED';

        step(game, { x: 0, y: -20 });

        expect(game.audio.playWub).not.toHaveBeenCalled();
        expect(game.audio.playGlide).not.toHaveBeenCalled();
    });

    it('is silent while a DIALOG is open', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 0, y: 100 }];
        game.glitches = [new Glitch(0, 60, 20)];
        game.state.gameState = 'DIALOG';

        step(game, { x: 0, y: -20 });

        expect(game.audio.playWub).not.toHaveBeenCalled();
        expect(game.audio.playGlide).not.toHaveBeenCalled();
    });

    it('playAmbientAudio() itself is guarded against non-PLAYING states (TRANSITION leak)', () => {
        // Directly pins the guard: even if reached mid-tick during a room crossing
        // (gameState already TRANSITION), no ambient sound leaks out.
        const game = newGame();
        game.state.unlocked.borders = true;
        game.snake.body = [{ x: 0, y: 80 }];
        game.glitches = [new Glitch(0, 60, 20)]; // adjacent -> would wub if unguarded
        game.state.gameState = 'TRANSITION';

        game.playAmbientAudio();

        expect(game.audio.playWub).not.toHaveBeenCalled();
        expect(game.audio.playGlide).not.toHaveBeenCalled();
    });
});

describe('Diegetic audio vocabulary (no death drone for non-deaths)', () => {
    beforeEach(mountDom);

    it('walls MATERIALIZE (not a death drone) when borders unlock at 10 Data', () => {
        const game = newGame();
        game.audio.playMaterialize = vi.fn();
        game.audio.playDeath = vi.fn();
        game.state.score = 10;

        game.checkUnlocks();

        expect(game.state.unlocked.borders).toBe(true);
        expect(game.audio.playMaterialize).toHaveBeenCalledTimes(1);
        expect(game.audio.playDeath).not.toHaveBeenCalled();
    });

    it('a SURVIVABLE Glitch hit plays the corruption bite, not the death drone', () => {
        const game = newGame();
        game.audio.playCorruptHit = vi.fn();
        game.audio.playDeath = vi.fn();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        // Length 5 -> 6 after the move, survives 3 points of glitch damage.
        game.snake.body = [
            { x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 },
            { x: 40, y: 100 }, { x: 20, y: 100 },
        ];
        game.glitches = [new Glitch(120, 100, 20)];

        step(game, { x: 20, y: 0 }); // head lands on the Glitch, but the snake lives

        expect(game.audio.playCorruptHit).toHaveBeenCalledTimes(1);
        expect(game.audio.playDeath).not.toHaveBeenCalled();
    });
});

describe('Weak points vary per wall', () => {
    beforeEach(mountDom);

    it('the Hub has a central weak point on its right wall ONLY', () => {
        const wm = newGame().worldManager; // 400x400
        expect(wm.getWeakPoint(0, 0, 'right')).toEqual({ start: 160, end: 240 });
        expect(wm.getWeakPoint(0, 0, 'up')).toBeNull();
        expect(wm.getWeakPoint(0, 0, 'left')).toBeNull();
        expect(wm.getWeakPoint(0, 0, 'down')).toBeNull();
    });

    it('is deterministic and symmetric per boundary', () => {
        const wm = newGame().worldManager;
        const a = wm.getWeakPoint(2, 3, 'right'); // boundary 2,3 <-> 3,3
        const b = wm.getWeakPoint(3, 3, 'left');  // same boundary, other side
        expect(a).toEqual(b);
        expect(wm.getWeakPoint(2, 3, 'right')).toEqual(a); // stable across calls
    });

    it('always has a weak point along the guided main path', () => {
        const wm = newGame().worldManager;
        for (const x of [1, 2, 3, 4]) {
            expect(wm.getWeakPoint(x, 0, 'right')).not.toBeNull();
        }
    });

    it('leaves some non-path walls solid, and varies their position', () => {
        const wm = newGame().worldManager;
        const samples = [];
        for (let y = 1; y <= 30; y++) samples.push(wm.getWeakPoint(7, y, 'right'));
        const solid = samples.filter(s => s === null).length;
        const starts = new Set(samples.filter(Boolean).map(s => s.start));
        expect(solid).toBeGreaterThan(0);      // some walls are impassable
        expect(starts.size).toBeGreaterThan(1); // weak points are NOT all at one spot
    });
});

describe('Guaranteed corridors to landmark sectors', () => {
    beforeEach(mountDom);

    it('still guarantees the Hub -> Localhost spine', () => {
        const wm = newGame().worldManager;
        for (const x of [1, 2, 3, 4]) {
            expect(wm.getWeakPoint(x, 0, 'right')).not.toBeNull();
        }
    });

    it('carves an unbroken weak-point corridor from Localhost to Cadenza', () => {
        const wm = newGame().worldManager;
        expect(wm.landmarks.cadenza).toEqual({ x: 8, y: 3 });
        // Horizontal leg [5,0] -> [8,0]
        for (const x of [5, 6, 7]) {
            expect(wm.getWeakPoint(x, 0, 'right')).not.toBeNull();
        }
        // Vertical leg [8,0] -> [8,3]
        for (const y of [0, 1, 2]) {
            expect(wm.getWeakPoint(8, y, 'down')).not.toBeNull();
        }
    });

    it('registers every carved boundary as a forced main-path key', () => {
        const wm = newGame().worldManager;
        expect(wm.mainPath.has('7,0-8,0')).toBe(true); // a horizontal-leg boundary
        expect(wm.mainPath.has('8,2-8,3')).toBe(true); // a vertical-leg boundary
    });

    it('does NOT flatten the whole Wilds — walls off the routes still vary/seal', () => {
        const wm = newGame().worldManager;
        const samples = [];
        for (let y = 5; y <= 30; y++) samples.push(wm.getWeakPoint(12, y, 'right'));
        expect(samples.some(s => s === null)).toBe(true); // some remain solid
    });
});

describe('Denny slow-tracks and remembers the encounter', () => {
    beforeEach(mountDom);

    it('moves toward the player only on even ticks (half speed)', () => {
        const game = newGame();
        game.apple = { x: 300, y: 300 }; game.obstacles = []; // keep the tracked cell clear
        game.npcs = [new NPC(200, 40, 20, 'denny', ['x'])];
        game.snake.body = [{ x: 100, y: 200 }]; // head y=200, denny y=40

        game._tick = 1; game.updateDenny(); // odd -> no move
        expect(game.npcs[0].y).toBe(40);
        game._tick = 2; game.updateDenny(); // even -> one step toward the player
        expect(game.npcs[0].y).toBe(60);
    });

    it('flags "slipped past" when you leave [1,0] without meeting Denny', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.worldManager.rooms['2,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };

        game.shiftScreen(1, 0);

        expect(game.state.unlocked.dennySlipped).toBe(true);
    });

    it('does NOT flag slipped if you met Denny first', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.state.unlocked.dennyMet = true;
        game.worldManager.rooms['2,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };

        game.shiftScreen(1, 0);

        expect(game.state.unlocked.dennySlipped).toBeFalsy();
    });

    it('Gate calls out that you slipped past the Last Line', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.state.unlocked.dennySlipped = true;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'gate', ['HALT!'])];
        game.snake.body = [{ x: 100, y: 100 }];
        let captured = null;
        game.dialogManager.start = (lines) => { captured = lines; };

        step(game, { x: 20, y: 0 }); // bump Gate

        expect(captured[0]).toContain('slipped past');
    });

    it('does NOT flag slipped when you retreat WEST out of [1,0]', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.worldManager.rooms['0,0'] = { apple: { x: 100, y: 100 }, glitches: [], npcs: [], obstacles: [] };

        game.shiftScreen(-1, 0); // retreat back toward the Hub, un-met

        expect(game.state.unlocked.dennySlipped).toBeFalsy();
    });

    it('Gate prioritizes the "met" line over "slipped" when both are set', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.state.unlocked.dennySlipped = true;
        game.state.unlocked.dennyMet = true;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'gate', ['HALT!'])];
        game.snake.body = [{ x: 100, y: 100 }];
        let captured = null;
        game.dialogManager.start = (lines) => { captured = lines; };

        step(game, { x: 20, y: 0 });

        expect(captured[0]).toContain('DENIED'); // the met line wins
    });
});

describe('Localhost — the first Safe Zone', () => {
    beforeEach(mountDom);

    it('[5,0] is a hazard-free room with a welcome sign', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = 0;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'signpost')).toBe(true);
        expect(room.glitches.length).toBe(0);
    });
});

describe('2-Bit drops off in Localhost and sets up shop', () => {
    beforeEach(mountDom);

    it('drops off as a shopkeeper on first reaching Localhost (and detaches from the tail)', () => {
        const game = newGame();
        game.state.unlocked.tailRider = true;
        game.worldManager.rooms['5,0'] = { apple: { x: 200, y: 200 }, glitches: [], npcs: [], obstacles: [] };
        game.worldManager.currentRoomX = 4; // one sector west of Localhost
        game.worldManager.currentRoomY = 0;
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }]; // head + 2-Bit
        game.dialogManager.start = () => {}; // hold the dialogue open

        game.shiftScreen(1, 0); // east into Localhost [5,0]

        expect(game.worldManager.currentRoomX).toBe(5);
        expect(game.state.unlocked.biteDroppedOff).toBe(true);
        expect(game.snake.body.length).toBe(1);               // his segment detached
        expect(game.npcs.some(n => n.id === 'shop')).toBe(true);
        expect(game.state.gameState).toBe('DIALOG');
        expect(game.state.unlocked.tailRider).toBe(true);     // gear/drive stays yours
    });

    it('does NOT drop him off in a Wilds room', () => {
        const game = newGame();
        game.state.unlocked.tailRider = true;
        game.worldManager.rooms['2,0'] = { apple: { x: 200, y: 200 }, glitches: [], npcs: [], obstacles: [] };
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];

        game.shiftScreen(1, 0); // into [2,0]

        expect(game.state.unlocked.biteDroppedOff).toBeFalsy();
        expect(game.npcs.some(n => n.id === 'shop')).toBe(false);
    });

    it('bumping the shopkeeper shares a gossip topic, then opens the shop', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'shop', [])];
        game.snake.body = [{ x: 100, y: 100 }];
        let topicShown = null;
        game.dialogManager.start = (lines, cb) => { topicShown = lines; if (cb) cb(); };

        step(game, { x: 20, y: 0 }); // bump 2-Bit's shop

        expect(topicShown).not.toBeNull();          // he gossips first...
        expect(game.state.biteTopicsHeard).toBe(1);
        expect(game.state.gameState).toBe('SHOP');  // ...then the stall opens
    });
});

describe('Terminal type-out hang & skip', () => {
    beforeEach(mountDom);

    it('the sim hangs while the terminal is printing, and resumes after', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }];

        game.narrative.isPrinting = true;
        game.input.nextDirection = { x: 20, y: 0 };
        game.update(1000);
        expect(game.snake.head).toEqual({ x: 100, y: 100 }); // frozen mid-log

        game.narrative.isPrinting = false;
        game.update(1000);
        expect(game.snake.head).not.toEqual({ x: 100, y: 100 }); // resumes
    });

    it('requestSkip only flags while a log is actually printing', () => {
        const game = newGame();
        game.narrative.isPrinting = false;
        game.narrative.requestSkip();
        expect(game.narrative.skipRequested).toBe(false);

        game.narrative.isPrinting = true;
        game.narrative.requestSkip();
        expect(game.narrative.skipRequested).toBe(true);
    });
});

describe('Denny\'s map & the Module Slot', () => {
    beforeEach(mountDom);

    it('Denny drops a map item the first time you talk to him', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'denny', ['Denny: hi'])];
        game.snake.body = [{ x: 100, y: 100 }];
        game.dialogManager.start = (lines, cb) => cb(); // auto-complete

        step(game, { x: 20, y: 0 }); // bump Denny

        expect(game.state.unlocked.dennyMet).toBe(true);
        expect(game.npcs.some(n => n.id === 'mapitem')).toBe(true);
    });

    it('picking up the map makes it a carried module and opens the slot', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'mapitem', [])];
        game.snake.body = [{ x: 100, y: 100 }];
        game.dialogManager.start = (lines, cb) => cb();

        step(game, { x: 20, y: 0 }); // head onto the map item

        expect(game.carriedModule).toBe('map');
        expect(game.state.unlocked.moduleSlot).toBe(true);
        expect(game.npcs.some(n => n.id === 'mapitem')).toBe(false); // consumed, not left behind
    });

    it('dragging the module tail into the 3x3 slot installs it via the load animation', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.carriedModule = 'map';
        game.state.unlocked.moduleSlot = true;
        game.state.unlocked.tailRider = false; // mapCell = tail tip

        // Tail away from the slot: no load. (Length 2 so mapCell has a real tail cell;
        // a length-1 snake now hides the module rather than riding it on the head.)
        game.snake.body = [{ x: 200, y: 200 }, { x: 200, y: 220 }];
        expect(game.mapInSlot()).toBe(false);

        // Tail tip inside the 3x3 slot region: a load can start, but the map is NOT
        // online until both animation beats finish.
        game.snake.body = [{ x: 200, y: 200 }, { x: game.moduleSlotX, y: game.moduleSlotY }];
        expect(game.mapInSlot()).toBe(true);
        game.startModuleLoad();
        expect(game.moduleLoad).not.toBeNull();
        expect(game.state.unlocked.mapModule).toBeFalsy();

        game.dialogManager.start = (lines, cb) => cb();
        game.updateModuleLoad(600); // beat 1 -> beat 2 (suck into socket)
        game.updateModuleLoad(700); // beat 2 -> done (fly to HUD, map online)

        expect(game.state.unlocked.mapModule).toBe(true);
        expect(game.carriedModule).toBeNull();
        expect(game.moduleLoad).toBeNull();
    });
});

describe('Carried module rides the tail tip (installs with 2-Bit still aboard)', () => {
    beforeEach(mountDom);

    it('mapCell is the true tail tip; 2-Bit rides one segment ahead', () => {
        const game = newGame();
        game.carriedModule = 'map';
        game.state.unlocked.tailRider = true;       // 2-Bit aboard
        game.state.unlocked.biteDroppedOff = false;
        game.snake.body = [
            { x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 },
        ];

        expect(game.mapCell()).toEqual({ x: 60, y: 100 }); // module on the tail tip
        expect(game.biteIndex).toBe(1);                    // 2-Bit at length-2, never sharing the cell
    });

    it('installs while 2-Bit is aboard — no waiting for the Localhost drop-off', () => {
        // The reported bug: the map merged with 2-Bit and could not be dropped into
        // the slot until he left. Now the module is the literal tail tip, so parking
        // the tail in the slot loads it with him still riding.
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.carriedModule = 'map';
        game.state.unlocked.moduleSlot = true;
        game.state.unlocked.tailRider = true;       // <- the bug's trigger
        game.state.unlocked.biteDroppedOff = false;

        game.snake.body = [
            { x: 200, y: 200 },
            { x: 200, y: 220 },
            { x: game.moduleSlotX, y: game.moduleSlotY }, // tail tip parked in the slot
        ];
        expect(game.mapInSlot()).toBe(true); // was false when the map rode length-2

        game.dialogManager.start = (lines, cb) => cb();
        game.startModuleLoad();
        game.updateModuleLoad(600);
        game.updateModuleLoad(700);

        expect(game.state.unlocked.mapModule).toBe(true);
        expect(game.carriedModule).toBeNull();
    });

    it('hides 2-Bit (biteIndex -1) only while too short to seat him AND the module', () => {
        const game = newGame();
        game.carriedModule = 'map';
        game.state.unlocked.tailRider = true;
        game.state.unlocked.biteDroppedOff = false;
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }]; // length 2 — transient

        expect(game.biteIndex).toBe(-1);                    // his face hidden until re-grown
        expect(game.mapCell()).toEqual({ x: 80, y: 100 });  // module still shown on the tip
    });

    it('with no module carried, 2-Bit is the tail tip as before', () => {
        const game = newGame();
        game.carriedModule = null;
        game.state.unlocked.tailRider = true;
        game.state.unlocked.biteDroppedOff = false;
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }];

        expect(game.biteIndex).toBe(2); // unchanged: he IS the tail tip when nothing rides it
    });

    it('never paints 2-Bit on the head — a length-1 snake hides his face (biteIndex -1)', () => {
        // Reachable via arg-less shrink() in the glitch-damage loop: a length-2 snake
        // taking a survivable hit drops to length 1 while tailRider is still set.
        const game = newGame();
        game.carriedModule = null;
        game.state.unlocked.tailRider = true;
        game.state.unlocked.biteDroppedOff = false;
        game.snake.body = [{ x: 100, y: 100 }]; // just the head

        expect(game.biteIndex).toBe(-1); // NOT 0 — the worm's head is never 2-Bit
    });
});

describe('Cadenza — the homing beacon', () => {
    beforeEach(mountDom);

    it('is silent until 2-Bit points you toward her (biteDroppedOff)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; // stood in her sector...
        game.worldManager.currentRoomY = 3;
        expect(game.state.unlocked.biteDroppedOff).toBeFalsy();
        expect(game.cadenzaProximity()).toBe(0); // ...but the lead hasn't been given yet
    });

    it('peaks in her sector and falls off with (euclidean) room distance', () => {
        const game = newGame();
        game.state.unlocked.biteDroppedOff = true;

        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 3;
        expect(game.cadenzaProximity()).toBeCloseTo(1, 5);   // in her sector (dist 0)

        game.worldManager.currentRoomX = 6; game.worldManager.currentRoomY = 0;
        const near = game.cadenzaProximity();                // hypot(2,3)=3.61 -> ~0.549

        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        const far = game.cadenzaProximity();                 // hypot(3,3)=4.24 -> ~0.470

        expect(near).toBeGreaterThan(far);                   // closer room reads hotter
        expect(far).toBeCloseTo(0.4697, 3);

        game.worldManager.currentRoomX = 0; game.worldManager.currentRoomY = 0;
        expect(game.cadenzaProximity()).toBe(0);             // Hub: hypot(8,3)=8.54 > range 8
    });

    it('gives hotter feedback on a SINGLE-axis room step (the Chebyshev-flat bug)', () => {
        // Both a purely-east and a purely-south step from Localhost toward {8,3} must
        // raise proximity. Chebyshev returned the SAME value for both, so the beacon
        // gave no homing signal until BOTH axes closed — making her unfindable.
        const game = newGame();
        game.state.unlocked.biteDroppedOff = true;

        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        const base = game.cadenzaProximity();
        game.worldManager.currentRoomX = 6; game.worldManager.currentRoomY = 0;
        const east = game.cadenzaProximity();
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 1;
        const south = game.cadenzaProximity();

        expect(east).toBeGreaterThan(base);
        expect(south).toBeGreaterThan(base);
    });

    it('goes quiet for good once she is found (cadenzaFound)', () => {
        const game = newGame();
        game.state.unlocked.biteDroppedOff = true;
        game.state.unlocked.cadenzaFound = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 3;
        expect(game.cadenzaProximity()).toBe(0);
    });

    it('pings on a tightening interval as you approach (hotter = faster)', () => {
        const game = newGame();
        game.audio.playCadenzaSong = vi.fn();
        game.state.unlocked.biteDroppedOff = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 3; // prox 1 -> ~500ms

        game.updateCadenzaBeacon(400); // below interval
        expect(game.audio.playCadenzaSong).not.toHaveBeenCalled();
        game.updateCadenzaBeacon(200); // 600ms >= ~500ms -> ping
        expect(game.audio.playCadenzaSong).toHaveBeenCalledTimes(1);
        expect(game.audio.playCadenzaSong.mock.calls[0][0]).toBeCloseTo(1, 5);
    });

    it('does not ping out of earshot, and holds its timer reset', () => {
        const game = newGame();
        game.audio.playCadenzaSong = vi.fn();
        game.state.unlocked.biteDroppedOff = true;
        game.worldManager.currentRoomX = 0; game.worldManager.currentRoomY = 0; // out of range
        game._beaconTimer = 999;

        game.updateCadenzaBeacon(1000);

        expect(game.audio.playCadenzaSong).not.toHaveBeenCalled();
        expect(game._beaconTimer).toBe(0);
    });
});

describe('2-Bit drip-feeds gossip topics at his stall', () => {
    beforeEach(mountDom);

    function bumpShop(game) {
        game.npcs = [new NPC(120, 100, 20, 'shop', [])];
        game.snake.body = [{ x: 100, y: 100 }];
        game.state.gameState = 'PLAYING';
        step(game, { x: 20, y: 0 });
    }

    it('shares one unheard topic per visit, then goes straight to shopping', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        const shown = [];
        game.dialogManager.start = (lines, cb) => { shown.push(lines); if (cb) cb(); };

        const total = game.biteTopics.length;
        for (let i = 0; i < total; i++) {
            bumpShop(game);
            expect(game.state.biteTopicsHeard).toBe(i + 1);
            expect(game.state.gameState).toBe('SHOP');
        }
        expect(shown.length).toBe(total); // one per visit, no repeats

        // Topics exhausted: bumping now opens the shop with no preamble.
        shown.length = 0;
        bumpShop(game);
        expect(shown.length).toBe(0);
        expect(game.state.gameState).toBe('SHOP');
    });

    it('topics heard persist across a death (knowledge, not score)', () => {
        const game = newGame();
        game.state.biteTopicsHeard = 2;
        game.apple = { x: 200, y: 200 };

        game.die('self');

        expect(game.state.biteTopicsHeard).toBe(2);
    });
});

describe('Night-audit regression fixes', () => {
    beforeEach(mountDom);

    it('never spawns a Glitch inside the Localhost safe zone (F04)', () => {
        const game = newGame();
        game.state.unlocked.biteProgress = 3;
        const rnd = vi.spyOn(Math, 'random').mockReturnValue(0); // force the 20% glitch roll
        try {
            game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0; // Localhost
            game.glitches = [];
            game.spawnApple();
            expect(game.glitches.length).toBe(0); // safe zone stays hazard-free

            game.worldManager.currentRoomX = 7; game.worldManager.currentRoomY = 7; // Wilds
            game.glitches = [];
            game.spawnApple();
            expect(game.glitches.length).toBe(1); // corruption spawns out in the Wilds
        } finally {
            rnd.mockRestore();
        }
    });

    it('a Glitch never eats 2-Bit\'s protected tail segment (F06)', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.state.unlocked.tailRider = true; // 2-Bit aboard -> minLength 2 on shrink
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 80, y: 100 }, { x: 60, y: 100 }]; // head + 2-Bit
        game.glitches = [{ x: 100, y: 100 }];

        step(game, { x: 20, y: 0 }); // head -> (100,100) onto the glitch

        expect(game.state.gameState).not.toBe('DEAD'); // survives (unguarded shrink would kill)
        expect(game.snake.body.length).toBe(2);        // 2-Bit still aboard
    });

    it('re-clamps gear when a Glitch drain drops you below the mass gate (F20)', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.state.unlocked.tailRider = true;
        game.state.score = 30;                 // gear-3 eligible...
        game.gear = 3; game.speed = 30;        // ...and currently at max speed
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 80, y: 100 }, { x: 60, y: 100 }, { x: 40, y: 100 }];
        game.glitches = [{ x: 100, y: 100 }];

        step(game, { x: 20, y: 0 }); // drain 3 -> score 27, below the gear-3 gate

        expect(game.gear).toBeLessThan(3);          // no ghost max speed
        expect(game.speed).toBeGreaterThan(30);
    });

    it('lines the trailing body off-screen after a room cross — no phantom chunk (F10)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.worldManager.breakWall(1, 0, 'right');
        game.worldManager.rooms['2,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };
        const wp = game.worldManager.getWeakPoint(1, 0, 'right');
        game.snake.body = [
            { x: 380, y: wp.start + 40 }, { x: 360, y: wp.start + 40 }, { x: 340, y: wp.start + 40 },
        ];

        step(game, { x: 20, y: 0 }); // cross east through the doorway

        expect(game.worldManager.currentRoomX).toBe(2);
        expect(game.snake.head.x).toBe(0);          // entered from the left edge
        for (let i = 1; i < game.snake.body.length; i++) {
            expect(game.snake.body[i].x).toBeLessThan(0); // trail is off-screen, not a right-side chunk
        }
    });

    it('Cadenza actually exists at her sector, and arriving silences the beacon (F01)', () => {
        const game = newGame();
        const cad = game.worldManager.landmarks.cadenza;
        game.worldManager.currentRoomX = cad.x; game.worldManager.currentRoomY = cad.y;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'cadenza')).toBe(true); // she's THERE, not an empty room

        const g2 = newGame();
        g2.state.unlocked.biteDroppedOff = true;
        g2.worldManager.currentRoomX = cad.x - 1; g2.worldManager.currentRoomY = cad.y;
        g2.worldManager.rooms[`${cad.x},${cad.y}`] = { apple: { x: 100, y: 100 }, glitches: [], npcs: [], obstacles: [] };
        expect(g2.cadenzaProximity()).toBeGreaterThan(0); // beacon live on approach

        g2.shiftScreen(1, 0); // east into her sector
        expect(g2.state.unlocked.cadenzaFound).toBe(true);
        expect(g2.cadenzaProximity()).toBe(0);            // ...silenced for good
    });

    // Both encore intros open on "You came BACK" — so a first-time visitor must get her
    // written meeting scene instead, or she greets a stranger as a returnee (and
    // CADENZA_SCENE, the dialog her NPC actually carries, never plays at all).
    it('greets a FIRST-time visitor with the meeting scene, not "you came back"', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        let captured = null;
        game.dialogManager.start = (lines) => { captured = lines; };
        game.startEncore = () => {};                       // don't launch the minigame here

        expect(game.state.unlocked.cadenzaMet).toBe(false);
        game.npcCadenza({ id: 'cadenza', x: 100, y: 100 });
        expect(game.state.unlocked.cadenzaMet).toBe(true);
        expect(captured.join(' ')).not.toMatch(/came BACK/i);
        expect(captured.join(' ')).toContain('An audience');  // CADENZA_SCENE's opener

        // ...and a RETURN visit gets the encore intro as before.
        captured = null;
        game.npcCadenza({ id: 'cadenza', x: 100, y: 100 });
        expect(captured.join(' ')).toMatch(/came BACK/i);
    });

    it('Denny\'s map drops in-bounds even when he\'s on the bottom row (F05)', () => {
        const game = newGame(); // 400x400
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        const bottomY = game.canvas.height - game.gridSize;
        game.npcs = [new NPC(120, bottomY, 20, 'denny', ['Denny: hi'])];
        game.snake.body = [{ x: 100, y: bottomY }];
        game.dialogManager.start = (lines, cb) => cb();

        step(game, { x: 20, y: 0 }); // bump Denny on the bottom row

        const map = game.npcs.find(n => n.id === 'mapitem');
        expect(map).toBeTruthy();
        expect(map.y).toBeGreaterThanOrEqual(0);
        expect(map.y).toBeLessThan(game.canvas.height); // NOT dropped off the bottom edge
    });

    it('a goalie will not step onto an obstacle in its path (G5/G7)', () => {
        const game = newGame();
        game.apple = { x: 300, y: 300 };
        game.obstacles = [{ x: 200, y: 180 }]; // between Gate and the player's row
        game.npcs = [new NPC(200, 200, 20, 'gate', ['x'])];
        game.snake.body = [{ x: 40, y: 100 }];

        game.updateGate(); // its next cell (200,180) is blocked

        expect(game.npcs[0].y).toBe(200); // stays put rather than ghosting through
    });

    it('lets the wake-press steer while a death log is still printing (verify-pass regression)', () => {
        // canSteer must allow steering during a printing log, so the first key after a
        // death sets the respawn direction (buffered) instead of being dropped — but
        // still block steering during an install and during conversations.
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.narrative.isPrinting = true;
        expect(game.input.canSteer()).toBe(true);   // <- was false: the wake press got dropped

        game.narrative.isPrinting = false;
        game.moduleLoad = { phase: 1, t: 0 };
        expect(game.input.canSteer()).toBe(false);  // module install still freezes steering
        game.moduleLoad = null;

        game.state.gameState = 'DIALOG';
        expect(game.input.canSteer()).toBe(false);  // a conversation still blocks buffered turns
    });

    it('buffers a turn pressed during a printing log (fires on resume, not dropped)', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.narrative.isPrinting = true;
        game.input.nextDirection = { x: 0, y: 0 };
        // Feed ArrowUp straight into the handler with stub callbacks; canSteer is the
        // game's real predicate, so this exercises the actual gate.
        game.input.handleKeyDown({ key: 'ArrowUp' }, () => {}, () => false, () => {}, () => {});
        expect(game.input.nextDirection).toEqual({ x: 0, y: -game.gridSize });
    });

    it('consumes the Glitch that kills you so it can\'t camp the death cell (G1)', () => {
        const game = newGame();
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 80, y: 100 }]; // length 1 -> a glitch hit is lethal
        game.glitches = [{ x: 100, y: 100 }];

        step(game, { x: 20, y: 0 }); // head -> (100,100), drained to death

        expect(game.state.gameState).toBe('DEAD');
        // The killer was spliced before die() saved the room, so the hub you respawn
        // into doesn't carry a glitch parked on your face.
        expect(game.glitches.some(gl => gl.x === 100 && gl.y === 100)).toBe(false);
    });
});

describe('Topology Scanner — hidden doors revealed by sweeping', () => {
    beforeEach(mountDom);

    // Only registered SCANNER DOORS are hidden now (ordinary doors are always visible).
    // The Booth-corridor door at {9,4}->{10,4} is the canonical hidden specimen.
    function findHiddenWeakPoint(wm, dir) {
        if (dir !== 'right') return null;
        const wp = wm.getWeakPoint(9, 4, 'right');
        return wp ? { rx: 9, ry: 4, wp } : null;
    }

    it('off-path weak points are hidden until revealed; the guided route is always shown', () => {
        const wm = newGame().worldManager;
        expect(wm.isWeakPointRevealed(1, 0, 'right')).toBe(true); // Hub->Localhost spine: visible

        const hit = findHiddenWeakPoint(wm, 'right');
        expect(hit).toBeTruthy();
        expect(wm.isWeakPointRevealed(hit.rx, hit.ry, 'right')).toBe(false); // hidden by default
        wm.revealWeakPoint(hit.rx, hit.ry, 'right', 1000);
        expect(wm.isWeakPointRevealed(hit.rx, hit.ry, 'right')).toBe(true);  // scanner-lit
        wm.tickReveals(1200);
        expect(wm.isWeakPointRevealed(hit.rx, hit.ry, 'right')).toBe(false); // fades out
    });

    it('sweeping the body along a wall over a hidden door reveals it and pings once', () => {
        const game = newGame();
        game.audio.playScannerPing = vi.fn();
        game.state.unlocked.borders = true;
        game.state.upgrades.scanner = true;
        game.apple = { x: 200, y: 200 }; game.glitches = [];

        const hit = findHiddenWeakPoint(game.worldManager, 'right');
        game.worldManager.currentRoomX = hit.rx; game.worldManager.currentRoomY = hit.ry;
        const g = game.gridSize, right = game.ringRight - g; // col 18 — the interior cell against the right wall
        game.snake.body = [
            { x: right, y: hit.wp.start },
            { x: right, y: hit.wp.start + g },
            { x: right, y: hit.wp.start + 2 * g }, // 3 segments draped over the door
        ];

        expect(game.worldManager.isWeakPointRevealed(hit.rx, hit.ry, 'right')).toBe(false);
        game.detectScannerSweep();
        expect(game.worldManager.isWeakPointRevealed(hit.rx, hit.ry, 'right')).toBe(true);
        expect(game.audio.playScannerPing).toHaveBeenCalledTimes(1);
        // Geometric with sweep length: 3 segments light it noticeably longer than the base.
        expect(game.worldManager.scannerRevealRemaining(hit.rx, hit.ry, 'right')).toBeGreaterThan(350);

        // Re-sweeping the same door does NOT re-ping (only fresh finds ping).
        game.detectScannerSweep();
        expect(game.audio.playScannerPing).toHaveBeenCalledTimes(1);
    });

    it('does nothing without the Scanner upgrade', () => {
        const game = newGame();
        game.audio.playScannerPing = vi.fn();
        game.state.unlocked.borders = true;
        game.state.upgrades.scanner = false; // not owned
        const hit = findHiddenWeakPoint(game.worldManager, 'right');
        game.worldManager.currentRoomX = hit.rx; game.worldManager.currentRoomY = hit.ry;
        const g = game.gridSize, right = game.canvas.width - g;
        game.snake.body = [{ x: right, y: hit.wp.start }];

        game.detectScannerSweep();

        expect(game.worldManager.isWeakPointRevealed(hit.rx, hit.ry, 'right')).toBe(false);
        expect(game.audio.playScannerPing).not.toHaveBeenCalled();
    });
});

describe('Pivot Override — safe 180', () => {
    beforeEach(mountDom);

    it('reverses the body and faces it back the way you came', () => {
        const game = newGame();
        game.state.upgrades.pivot = true;
        game.state.gameState = 'PLAYING';
        game.snake.body = [
            { x: 100, y: 100 }, // head (moving right)
            { x: 80, y: 100 },
            { x: 60, y: 100 },  // tail
        ];
        game.input.direction = { x: 20, y: 0 };

        game.pivot();

        expect(game.snake.head).toEqual({ x: 60, y: 100 }); // old tail is the new head
        expect(game.input.direction).toEqual({ x: -20, y: 0 }); // now heading back
    });

    it('the pivot does not cause an immediate self-collision death', () => {
        const game = newGame();
        game.state.upgrades.pivot = true;
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }];
        game.input.direction = { x: 20, y: 0 };

        game.pivot();
        step(game, { x: -20, y: 0 }); // continue in the reversed direction

        expect(game.state.gameState).not.toBe('DEAD');
    });

    it('REFUSES (no death) when the snake is coiled around its own tail (verify-pass fix)', () => {
        const game = newGame();
        game.state.upgrades.pivot = true;
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = true;
        game.apple = { x: 300, y: 300 };
        // A 3x3 spiral with the tail at the centre — the reversed heading points into
        // an interior segment, so the old code self-killed.
        game.snake.body = [
            { x: 20, y: 20 }, { x: 40, y: 20 }, { x: 60, y: 20 },
            { x: 60, y: 40 }, { x: 60, y: 60 }, { x: 40, y: 60 },
            { x: 20, y: 60 }, { x: 20, y: 40 }, { x: 40, y: 40 }, // tail at centre
        ];
        const before = game.snake.body.map(s => ({ ...s }));

        game.pivot();

        expect(game.snake.body).toEqual(before);      // refused → body unchanged
        expect(game.state.gameState).not.toBe('DEAD'); // and definitely not a death
    });

    it('REFUSES when the reversed head would be off-screen (post-room-cross tail)', () => {
        const game = newGame();
        game.state.upgrades.pivot = true;
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = true;
        game.apple = { x: 300, y: 300 };
        // Head on the west edge, trail parked off-screen as a room crossing leaves it.
        game.snake.body = [
            { x: 0, y: 100 }, { x: -20, y: 100 }, { x: -40, y: 100 },
        ];
        const before = game.snake.body.map(s => ({ ...s }));

        game.pivot();

        expect(game.snake.body).toEqual(before);       // refused, not reversed off-screen
        expect(game.state.gameState).not.toBe('DEAD');
    });
});

describe('Cache — the CACHE death-screen secret', () => {
    beforeEach(mountDom);

    it('spelling CACHE across death screens summons her in the Hub', () => {
        const game = newGame();
        game.apple = { x: 200, y: 200 };

        for (const k of ['c', 'a', 'c', 'h', 'e']) game.recordDeathKey(k); // one key per respawn

        expect(game.deathCode).toBe('CACHE');
        expect(game.state.unlocked.cacheFound).toBe(true);
        expect(game.npcs.some(n => n.id === 'cache')).toBe(true); // manifested in the Hub
    });

    it('is a ROLLING last-5 window — junk before the code still catches it', () => {
        const game = newGame();
        game.apple = { x: 200, y: 200 };

        for (const k of ['x', 'z', 'c', 'a', 'c', 'h', 'e']) game.recordDeathKey(k); // last 5 = CACHE

        expect(game.state.unlocked.cacheFound).toBe(true);
    });

    it('non-CACHE inputs (and named keys) do not summon her', () => {
        const game = newGame();
        game.apple = { x: 200, y: 200 };

        for (const k of ['w', 'a', 's', 'd', ' ', 'ArrowUp']) game.recordDeathKey(k);

        expect(game.state.unlocked.cacheFound).toBe(false);
        expect(game.npcs.some(n => n.id === 'cache')).toBe(false);
    });

    it('is CODE-gated, not latched — she leaves the Hub once the code shifts off CACHE', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 0;
        game.worldManager.currentRoomY = 0;
        game.state.unlocked.cacheStage = 0;
        game.apple = { x: 200, y: 200 };

        for (const k of ['c', 'a', 'c', 'h', 'e']) game.recordDeathKey(k);
        expect(game.npcs.some(n => n.id === 'cache')).toBe(true); // present while code == CACHE

        game.npcs = [];                    // she fades after a chat / you leave the room
        game.recordDeathKey('x');          // the next death shifts the window -> 'ACHEX'
        game.refreshDynamicRoomContent();  // walk back into the Hub
        expect(game.deathCode).not.toBe('CACHE');
        expect(game.npcs.some(n => n.id === 'cache')).toBe(false); // no longer camped in the Hub
    });

    it('bumping Cache opens dialogue at no segment cost', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.unlocked.saveFunction = true; // already set up -> normal chat, no re-grant
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'cache', ['Cache: hi'])];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }];
        game.dialogManager.start = () => {};

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).toBe('DIALOG');
        expect(game.snake.body.length).toBe(3); // a chat is free
    });
});

describe("Save / Load — Cache's Save Function", () => {
    beforeEach(mountDom);

    function bumpCache(game, pauseMenu) {
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.unlocked.pauseMenu = pauseMenu;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'cache', ['Cache: hi'])];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        let captured = null;
        game.dialogManager.start = (lines) => { captured = lines; };
        step(game, { x: 20, y: 0 });
        return captured;
    }

    it('Cache GRANTS the Save Function when you have the pause menu', () => {
        const game = newGame();
        const lines = bumpCache(game, true);
        expect(game.state.unlocked.saveFunction).toBe(true);
        expect(lines.join(' ')).toContain('Save Function');
    });

    it('Cache brushes you off WITHOUT the pause menu (no Save Function)', () => {
        const game = newGame();
        bumpCache(game, false);
        expect(game.state.unlocked.saveFunction).toBe(false);
    });

    it('serialize -> applySave restores durable progress into a fresh game (in the Hub)', () => {
        const a = newGame();
        a.state.unlocked.tailRider = true;
        a.state.unlocked.cadenzaFound = true;
        a.state.upgrades.scanner = true;
        a.state.upgrades.crumpleLevel = 1;
        a.state.biteTopicsHeard = 2;
        a.deathCode = 'CAC';
        a.worldManager.breakWall(0, 0, 'right');
        a.worldManager.damageWall(1, 0, 'right', 2, 2);
        const snap = a.serialize();

        const b = newGame();
        b.applySave(snap);

        expect(b.state.unlocked.tailRider).toBe(true);
        expect(b.state.unlocked.cadenzaFound).toBe(true);
        expect(b.state.upgrades.scanner).toBe(true);
        expect(b.state.upgrades.crumpleLevel).toBe(1);
        expect(b.state.biteTopicsHeard).toBe(2);
        expect(b.deathCode).toBe('CAC');
        expect(b.worldManager.isWallBroken(0, 0, 'right')).toBe(true);
        expect(b.worldManager.getWallDamage(1, 0, 'right')).toBe(2);
        expect(b.worldManager.currentRoomX).toBe(0);   // a load drops you in the Hub
        expect(b.state.score).toBe(0);                 // fresh run (ephemeral score not saved)
    });

    it('re-manifests Cache on load only while the death-code still reads CACHE', () => {
        const a = newGame();
        a.state.unlocked.cacheFound = true;
        a.deathCode = 'CACHE';
        const b = newGame();
        b.applySave(a.serialize());
        expect(b.npcs.some(n => n.id === 'cache')).toBe(true);

        // found once, but the rolling code has since shifted -> she is NOT camped in the Hub
        const c = newGame();
        c.state.unlocked.cacheFound = true;
        c.deathCode = 'XACHE';
        const d = newGame();
        d.applySave(c.serialize());
        expect(d.npcs.some(n => n.id === 'cache')).toBe(false);
    });

    it('round-trips through localStorage (save then load a fresh game)', () => {
        const game = newGame();
        game.saveManager.clearAll();
        game.state.unlocked.tailRider = true;
        game.state.upgrades.crumpleLevel = 1;
        game.saveGame();
        expect(game.saveManager.anySave()).toBe(true);

        const g2 = newGame();
        g2.loadGame();
        expect(g2.state.unlocked.tailRider).toBe(true);
        expect(g2.state.upgrades.crumpleLevel).toBe(1);
        expect(g2.state.gameState).toBe('PLAYING'); // loadGame resumes play

        game.saveManager.clearAll(); // don't leak the save to other tests
    });

    it('loading clears a Gate Thread-Suspension state — no stuck overlay (verify-pass fix)', () => {
        const a = newGame();
        a.saveManager.clearAll();
        a.saveGame();

        const b = newGame();
        b.state.isSuspended = true;      // as if paused mid Gate cutscene
        b.onUnpauseCallback = () => {};
        b.loadGame();

        expect(b.state.isSuspended).toBe(false);
        expect(b.onUnpauseCallback).toBe(null);
        a.saveManager.clearAll();
    });

    it('a save/load preserves an un-installed carried module — the map (verify-pass fix)', () => {
        const a = newGame();
        a.carriedModule = 'map';
        a.state.unlocked.moduleSlot = true;

        const b = newGame();
        b.applySave(a.serialize());

        expect(b.carriedModule).toBe('map'); // not nulled -> the map survives, still installable
        expect(b.state.unlocked.moduleSlot).toBe(true);
    });

    it('a load re-enables Denny\'s map drop if it was dropped but never obtained (no soft-lock)', () => {
        const a = newGame();
        a.state.unlocked.dennyMapDropped = true; // Denny dropped it...
        // ...but it was never picked up (no carriedModule) nor installed (no mapModule).
        const b = newGame();
        b.applySave(a.serialize());
        expect(b.state.unlocked.dennyMapDropped).toBe(false); // cleared -> Denny can drop it again

        // But if you DO have it (installed), the flag stays set (no duplicate drop).
        const c = newGame();
        c.state.unlocked.dennyMapDropped = true;
        c.state.unlocked.mapModule = true;
        const d = newGame();
        d.applySave(c.serialize());
        expect(d.state.unlocked.dennyMapDropped).toBe(true);
    });
});

describe('NPC bumps are mass-neutral (no double-shrink)', () => {
    beforeEach(mountDom);

    it('bumping 2-Bit to talk does not eat a segment', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.unlocked.biteProgress = 1;
        game.state.score = 5; // < 30 -> the "come back with 30" line
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'bite', [])];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }]; // length 3
        game.dialogManager.start = () => {}; // hold the dialog open

        step(game, { x: 20, y: 0 }); // bump 2-Bit

        expect(game.state.gameState).toBe('DIALOG');
        expect(game.snake.body.length).toBe(3); // unchanged — a chat is mass-neutral (was 2 with the bug)
    });

    it('bumping Denny does not eat a segment either', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'denny', ['Denny: hi'])];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }];
        game.dialogManager.start = () => {};

        step(game, { x: 20, y: 0 });

        expect(game.snake.body.length).toBe(3);
    });
});

describe('Death redo — Crumple Buffer: die vs shed-fold-bounce', () => {
    beforeEach(mountDom);

    // A body long enough that shedding 10 leaves some to fold.
    function longBody(n = 14) {
        const b = [];
        for (let i = 0; i < n; i++) b.push({ x: 100 - i * 20, y: 100 });
        return b;
    }

    it('WITHOUT the Crumple Buffer, a hit kills you back to the beginning (Data doesn\'t matter)', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 0;
        game.state.score = 50; // plenty of Data — irrelevant without the upgrade
        game.worldManager.currentRoomX = 3;
        game.apple = { x: 200, y: 200 };
        game.snake.body = longBody();

        game.die('self');

        expect(game.state.gameState).toBe('DEAD');
        expect(game.state.score).toBe(0);               // full reset
        expect(game.worldManager.currentRoomX).toBe(0); // back to the hub
    });

    it('WITH the Crumple Buffer, a hit is SURVIVED: shed 10 (length + Data), fold, bounce', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1; // shed 10
        game.state.unlocked.tailRider = true;
        game.state.score = 30;
        game.worldManager.currentRoomX = 3; game.worldManager.currentRoomY = 0;
        game.apple = { x: 200, y: 200 };
        game.snake.body = longBody(14);
        game.input.direction = { x: 20, y: 0 }; // moving right

        game.die('self');

        expect(game.state.gameState).toBe('PLAYING');            // survived
        expect(game.worldManager.currentRoomX).toBe(3);          // stayed in the room
        expect(game.state.score).toBe(30 - game.shedAmount);     // -10 Data
        expect(game.snake.body.length).toBe(1);                  // FOLDED to a single block
        expect(game.pendingUnfold).toBe(14 - game.shedAmount - 1); // 3 blocks left to un-fold
        expect(game.input.direction).toEqual({ x: -20, y: 0 });  // bounced (reversed)
        expect(game.bursts.length).toBeGreaterThan(0);           // shed data burst out
    });

    it('the folded data un-folds one block per move as you drive away', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }]; // folded
        game.pendingUnfold = 3;

        step(game, { x: 20, y: 0 });
        expect(game.snake.body.length).toBe(2); // extruded one block
        expect(game.pendingUnfold).toBe(2);
        step(game, { x: 20, y: 0 });
        expect(game.snake.body.length).toBe(3);
        step(game, { x: 20, y: 0 });
        expect(game.snake.body.length).toBe(4);
        expect(game.pendingUnfold).toBe(0);
        step(game, { x: 20, y: 0 }); // fully un-folded -> normal locomotion (no growth)
        expect(game.snake.body.length).toBe(4);
    });

    it('after a bounce you can drive the REVERSED direction without hitting your tail (the fold fix)', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.upgrades.crumpleLevel = 1;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.snake.body = longBody(14);
        game.input.direction = { x: 20, y: 0 };

        game.die('self'); // fold + reverse to {-20,0}
        expect(game.snake.body.length).toBe(1);
        for (let i = 0; i < 4; i++) step(game, { x: -20, y: 0 }); // drive back the way we came
        expect(game.state.gameState).toBe('PLAYING'); // no self-collision death
    });

    it('bounces OFF an obstacle (recoils), not through it', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.upgrades.crumpleLevel = 1;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.obstacles = [{ x: 120, y: 100 }];
        game.snake.body = longBody(14);
        game.input.direction = { x: 20, y: 0 };

        step(game, { x: 20, y: 0 }); // head -> (120,100) onto the obstacle

        expect(game.state.gameState).toBe('PLAYING'); // survived (crumple)
        expect(game.snake.head.x === 120 && game.snake.head.y === 100).toBe(false); // recoiled OFF it
        expect(game.obstacles.some(o => o.x === 120 && o.y === 100)).toBe(true);    // still a barrier
    });

    it('a bounce before 2-Bit keeps normal speed (no gear system to re-accelerate)', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1;
        game.state.unlocked.tailRider = false; // pre-2-Bit
        game.state.score = 30;
        game.apple = { x: 200, y: 200 };
        game.snake.body = longBody(14);

        game.die('self');

        expect(game.gear).toBe(0);
        expect(game.speed).toBe(game.baseSpeed);
    });

    it('burst particles fly out and fade away', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1;
        game.state.score = 30;
        game.apple = { x: 200, y: 200 };
        game.snake.body = longBody(14);

        game.die('self');
        expect(game.bursts.length).toBeGreaterThan(0);

        game.updateBursts(600);
        expect(game.bursts.length).toBe(0);
    });
});

describe('Cache — staged Hub questline', () => {
    beforeEach(mountDom);

    // A game with Cache found, in the Hub, and dialog that completes instantly so we can
    // observe a whole staged conversation (grant / gift / directions) in one call.
    function cacheGame() {
        const game = newGame();
        game.dialogManager.start = (lines, onComplete) => { game._lastLines = lines; if (onComplete) onComplete(); };
        game.worldManager.currentRoomX = 0;
        game.worldManager.currentRoomY = 0;
        game.state.unlocked.cacheFound = true;
        game.state.unlocked.cacheStage = 0;
        return game;
    }
    function freshCacheNpc(game) {
        const npc = new NPC(200, 140, 20, 'cache', []);
        game.npcs = [npc];
        return npc;
    }

    it('stage 0 WITH a Pause Menu grants Save + unlocks the Start Screen (-> stage 1)', () => {
        const game = cacheGame();
        game.state.unlocked.pauseMenu = true;
        game.talkToCache(freshCacheNpc(game));
        expect(game.state.unlocked.saveFunction).toBe(true);
        expect(game.state.unlocked.startScreenUnlocked).toBe(true);
        expect(game.state.unlocked.cacheStage).toBe(1);
    });

    it('stage 0 with NO Pause Menu brushes off and does NOT advance', () => {
        const game = cacheGame();
        game.state.unlocked.pauseMenu = false;
        game.talkToCache(freshCacheNpc(game));
        expect(game.state.unlocked.saveFunction).toBe(false);
        expect(game.state.unlocked.cacheStage).toBe(0);
    });

    it('second call gifts spare data — seeds 5-10 motes clustered in the Hub (-> stage 2)', () => {
        const game = cacheGame();
        game.state.unlocked.pauseMenu = true;
        game.state.unlocked.cacheStage = 1;
        game.talkToCache(freshCacheNpc(game));
        expect(game.state.unlocked.cacheStage).toBe(2);
        expect(game.state.unlocked.spareDataUnlocked).toBe(true); // the gift is its own flag
        expect(game.dataMotes.length).toBeGreaterThanOrEqual(5);
        expect(game.dataMotes.length).toBeLessThanOrEqual(10);
    });

    it('third call marks her sector and she departs for good (-> stage 3, no re-manifest)', () => {
        const game = cacheGame();
        game.state.unlocked.cacheStage = 2;
        game.talkToCache(freshCacheNpc(game));
        expect(game.state.unlocked.cacheStage).toBe(3);
        game.npcs = [];
        game.spawnCacheNpc();
        expect(game.npcs.some(n => n.id === 'cache')).toBe(false); // stays home now
    });

    it('stage-3 directions adapt to whether you have a map (no hollow "on your map")', () => {
        const withMap = cacheGame();
        withMap.state.unlocked.cacheStage = 2;
        withMap.state.unlocked.mapModule = true;
        withMap.talkToCache(freshCacheNpc(withMap));
        expect(withMap._lastLines.join(' ')).toContain('on your map');

        const noMap = cacheGame();
        noMap.state.unlocked.cacheStage = 2;
        noMap.state.unlocked.mapModule = false;
        noMap.talkToCache(freshCacheNpc(noMap));
        expect(noMap._lastLines.join(' ')).not.toContain('on your map'); // no hollow promise
        expect(noMap._lastLines.join(' ').toLowerCase()).toContain('north of localhost'); // verbal fallback
    });

    it('after speaking she fades out and is removed from the room', () => {
        const game = cacheGame();
        game.state.unlocked.pauseMenu = true;
        const npc = freshCacheNpc(game);
        game.talkToCache(npc);
        expect(npc.fading).toBe(true);
        expect(npc.leaving).toBe(true);           // non-interactive while dissolving
        for (let i = 0; i < 20; i++) game.updateCacheFade(100);
        expect(game.npcs.some(n => n === npc)).toBe(false);
    });

    it('materialises a few cells ABOVE the spawn point (not a random cell)', () => {
        const game = newGame(400, 400);
        game.state.unlocked.cacheFound = true;
        game.state.unlocked.cacheStage = 0;
        game.npcs = [];
        game.snake.body = [{ x: 200, y: 200 }];
        game.apple = { x: 0, y: 0 };
        game.spawnCacheNpc();
        const cache = game.npcs.find(n => n.id === 'cache');
        const cy = Math.floor(400 / 2 / 20) * 20;
        expect(cache).toBeTruthy();
        expect(cache.x).toBe(200);
        expect(cache.y).toBeLessThan(cy);
    });

    it('respawning in the Hub re-manifests Cache (code still CACHE) and re-seeds her data (stage 2)', () => {
        const game = newGame();
        game.state.unlocked.cacheFound = true;
        game.deathCode = 'CACHE';               // she is present only while the code reads CACHE
        game.state.unlocked.cacheStage = 2;
        game.state.unlocked.spareDataUnlocked = true;
        game.state.upgrades.crumpleLevel = 0;   // a real death -> full Hub reset
        game.snake.body = [{ x: 100, y: 100 }];
        game.die('test');
        expect(game.npcs.some(n => n.id === 'cache')).toBe(true);
        expect(game.dataMotes.length).toBeGreaterThanOrEqual(5);
    });

    it('eating a spare-data mote grants Data AND grows you', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.ui = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 380, y: 380 };
        game.glitches = [];
        game.npcs = [];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        game.dataMotes = [{ x: 120, y: 100 }];
        step(game, { x: 20, y: 0 });
        expect(game.dataMotes.length).toBe(0);
        expect(game.state.score).toBe(1);
        expect(game.snake.body.length).toBe(3);
    });

    it('applySave back-fills stage/Start-Screen for pre-rework saves that already had Save', () => {
        const a = newGame();
        a.state.unlocked.saveFunction = true;
        const snap = a.serialize();
        delete snap.unlocked.cacheStage;          // simulate a save from before this rework
        delete snap.unlocked.startScreenUnlocked;
        const b = newGame();
        b.applySave(snap);
        expect(b.state.unlocked.cacheStage).toBe(1);
        expect(b.state.unlocked.startScreenUnlocked).toBe(true);
    });

    it('serialize/applySave round-trips cacheStage + startScreenUnlocked', () => {
        const a = newGame();
        a.state.unlocked.cacheStage = 2;
        a.state.unlocked.startScreenUnlocked = true;
        const b = newGame();
        b.applySave(a.serialize());
        expect(b.state.unlocked.cacheStage).toBe(2);
        expect(b.state.unlocked.startScreenUnlocked).toBe(true);
    });

    it('the Cache sector generates a distinct at-home NPC (a real destination)', () => {
        const game = newGame();
        const lm = game.worldManager.landmarks.cache;
        expect(lm).toBeTruthy();
        const room = game.worldManager.roomGenerator.generateRoom(lm.x, lm.y, game.state.unlocked, game.worldManager);
        expect(room.npcs.some(n => n.id === 'cachehome')).toBe(true);
        expect(room.npcs.some(n => n.id === 'cache')).toBe(false); // NOT the Hub apparition
    });

    // --- verification-pass fixes ---

    it('seedHubData never places a mote on a Hub glitch (eat+drain on one tick)', () => {
        const game = newGame(400, 400);
        game.snake.body = [{ x: 200, y: 200 }];
        game.apple = { x: 0, y: 0 };
        game.npcs = [];
        game.glitches = [new Glitch(220, 200, 20), new Glitch(180, 220, 20), new Glitch(200, 180, 20)];
        game.seedHubData();
        expect(game.dataMotes.length).toBeGreaterThanOrEqual(5);
        for (const m of game.dataMotes) {
            expect(game.glitches.some(gl => gl.x === m.x && gl.y === m.y)).toBe(false);
        }
    });

    it('Cache never materialises on a Hub glitch (talking to her stays safe)', () => {
        const game = newGame(400, 400);
        game.state.unlocked.cacheFound = true;
        game.state.unlocked.cacheStage = 0;
        game.npcs = [];
        game.snake.body = [{ x: 200, y: 200 }];
        game.apple = { x: 0, y: 0 };
        game.glitches = [new Glitch(200, 200 - 3 * 20, 20)]; // exactly her primary cell (200,140)
        game.spawnCacheNpc();
        const cache = game.npcs.find(n => n.id === 'cache');
        expect(cache).toBeTruthy();
        expect(game.glitches.some(gl => gl.x === cache.x && gl.y === cache.y)).toBe(false);
    });

    it('motes seed only on respawn/load, NOT on an ordinary walk-in (no farm)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 0;
        game.worldManager.currentRoomY = 0;
        game.state.unlocked.cacheStage = 2;
        game.state.unlocked.spareDataUnlocked = true;
        game.dataMotes = [{ x: 40, y: 40 }];       // stale motes from a prior life
        game.refreshDynamicRoomContent();          // walk-in: clears, does NOT reseed
        expect(game.dataMotes.length).toBe(0);
        game.refreshDynamicRoomContent(true);      // respawn/load: seeds a fresh pile
        expect(game.dataMotes.length).toBeGreaterThanOrEqual(5);
    });

    it('the title cameo is a global one-time flag, set when you pick a file', () => {
        const game = newGame();
        game.saveManager.clearAll();
        expect(game.saveManager.hasCameoSeen()).toBe(false);
        game.newGame(2);                             // choosing a file counts as seeing it
        expect(game.saveManager.hasCameoSeen()).toBe(true);
        game.saveManager.clearAll();
    });
});

describe('Save files — 3 slots, New Game / Load', () => {
    beforeEach(mountDom);

    it('saves/loads are bound to the active file (slot)', () => {
        const a = newGame();
        a.saveManager.clearAll();
        a.activeSlot = 2;
        a.state.unlocked.tailRider = true;
        a.saveGame();
        expect(a.saveManager.hasSave(2)).toBe(true);
        expect(a.saveManager.hasSave(1)).toBe(false); // only file 2 written

        const b = newGame();
        b.loadSlot(2);
        expect(b.activeSlot).toBe(2);
        expect(b.state.unlocked.tailRider).toBe(true);
        expect(b.state.gameState).toBe('PLAYING');
        a.saveManager.clearAll();
    });

    it('New Game starts a fresh run bound to a slot without erasing its stored file', () => {
        const a = newGame();
        a.saveManager.clearAll();
        a.activeSlot = 1;
        a.state.unlocked.tailRider = true;
        a.state.unlocked.borders = true;
        a.saveGame();                                // file 1 now holds real progress

        a.newGame(1);                                // start over in file 1
        expect(a.state.unlocked.tailRider).toBe(false); // run is pristine...
        expect(a.state.score).toBe(0);
        expect(a.saveManager.hasSave(1)).toBe(true);    // ...but the stored file is untouched
        expect(a.saveManager.load(1).unlocked.tailRider).toBe(true);
        a.saveManager.clearAll();
    });

    it('the file-select menu is only active on START when a save exists', () => {
        const game = newGame();
        game.saveManager.clearAll();
        game.state.gameState = 'START';
        expect(game.startMenuActive()).toBe(false);  // brand-new player -> bare cold open
        game.activeSlot = 3;
        game.saveGame();
        expect(game.startMenuActive()).toBe(true);   // a file exists -> menu
        game.saveManager.clearAll();
    });

    it('menu keys navigate files and ENTER acts on the highlighted one', () => {
        const game = newGame();
        game.saveManager.clearAll();
        game.activeSlot = 1;
        game.saveGame();                             // file 1 filled; 2 & 3 empty
        game.state.gameState = 'START';
        game.startMenuIndex = 0;

        game.startMenuHandleKey('ArrowDown');        // -> file 2 (empty)
        expect(game.startMenuIndex).toBe(1);
        game.startMenuHandleKey('Enter');            // empty slot -> new game there
        expect(game.activeSlot).toBe(2);
        expect(game.state.gameState).toBe('PLAYING');
        game.saveManager.clearAll();
    });

    it('DEL erases a file only after a confirming second DEL', () => {
        const game = newGame();
        game.saveManager.clearAll();
        game.activeSlot = 1;
        game.saveGame();
        game.state.gameState = 'START';
        game.startMenuIndex = 0;

        game.startMenuHandleKey('Delete');           // arms, does not erase
        expect(game.saveManager.hasSave(1)).toBe(true);
        expect(game.startMenuConfirmErase).toBe(1);
        game.startMenuHandleKey('Delete');           // confirms
        expect(game.saveManager.hasSave(1)).toBe(false);
        game.saveManager.clearAll();
    });

    it('migrates a legacy single-key save into file 1', () => {
        window.localStorage.setItem('ouroboros-save-v1', JSON.stringify({ v: 1, unlocked: { tailRider: true } }));
        const sm = new SaveManager();
        expect(sm.hasSave(1)).toBe(true);
        expect(window.localStorage.getItem('ouroboros-save-v1')).toBe(null); // moved, not copied
        expect(sm.load(1).unlocked.tailRider).toBe(true);
        sm.clearAll();
    });

    // --- verify-pass fixes for the slot system ---

    it('a Load resets progression flags absent from the save (no post-save leak)', () => {
        const b = newGame();
        b.state.unlocked.mapModule = true;        // live in-session progress...
        b.state.unlocked.biteDroppedOff = true;
        b._guided.add('8,3');                     // ...and a fired guidance one-shot
        // An older save blob that predates those flags (they aren't present).
        b.applySave({ v: 1, unlocked: { tailRider: true } });
        expect(b.state.unlocked.mapModule).toBe(false);      // reset to default
        expect(b.state.unlocked.biteDroppedOff).toBe(false);
        expect(b.state.unlocked.tailRider).toBe(true);       // the saved value IS applied
        expect(b._guided.has('8,3')).toBe(false);            // guidance memory cleared
    });

    it('Cache title cameo: walk-on -> dialog window -> pop-back typo gag -> one-time', () => {
        const game = newGame();
        game.saveManager.clearAll();
        const shows = [];
        let cb = null;
        game.dialogManager.start = (lines, onComplete) => { shows.push(lines); cb = onComplete; };
        game.activeSlot = 1;
        game.saveGame();                       // a file exists -> the menu (and cameo) would show
        game.maybeStartTitleCameo();
        expect(game.startCameoActive).toBe(true);
        expect(game.titleCameo.phase).toBe('walkin');

        game.updateTitleCameo(2000);           // walk-on completes -> dialog A opens
        expect(shows.length).toBe(1);
        expect(shows[0].join(' ')).toContain('0r0b0r0u5');
        expect(game.titleCameo.phase).toBe('holdA');

        cb();                                  // read dialog A -> she starts to fade
        expect(game.titleCameo.phase).toBe('fade1');
        game.updateTitleCameo(2000);           // fade1 -> pop
        game.updateTitleCameo(2000);           // pop completes -> dialog B (the typo gag)
        expect(shows.length).toBe(2);
        expect(shows[1].join(' ')).toContain('BYTE MY BITS');

        cb();                                  // read dialog B -> final fade
        game.updateTitleCameo(2000);           // fade2 completes -> done
        expect(game.titleCameo).toBe(null);
        expect(game.startCameoActive).toBe(false);
        expect(game.saveManager.hasCameoSeen()).toBe(true);

        game.maybeStartTitleCameo();           // a later boot does NOT replay it
        expect(game.startCameoActive).toBe(false);
        expect(game.titleCameo).toBe(null);
        game.saveManager.clearAll();
    });
});

describe('Cache at home in Cold Storage', () => {
    beforeEach(mountDom);

    function reachHome(game) {
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'cachehome', ['placeholder'])];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        let captured = null;
        game.dialogManager.start = (lines) => { captured = lines; };
        step(game, { x: 20, y: 0 });          // bump her
        return captured;
    }

    it('installs the Save Function at home if you never got it (have Pause Menu)', () => {
        const game = newGame();
        game.state.unlocked.pauseMenu = true;   // but no saveFunction, no CACHE puzzle done
        const lines = reachHome(game);
        expect(game.state.unlocked.saveFunction).toBe(true);
        expect(lines.join(' ')).toContain('Save Function');
        expect(game.state.unlocked.cacheStage).toBe(3); // her questline is settled; Hub echo retired
        expect(game.state.unlocked.spareDataUnlocked).toBe(false); // Cold Storage grants ONLY Save
    });

    it('a warm chat (no re-grant) if you already have Save', () => {
        const game = newGame();
        game.state.unlocked.saveFunction = true;
        game.state.unlocked.cacheStage = 1;
        const lines = reachHome(game);
        expect(lines.join(' ')).not.toContain('Save Function acquired');
        expect(game.state.unlocked.cacheStage).toBe(3);
    });

    // NOTHING may stand between a first-time visitor and learning to Save. Arriving dirty
    // (Shunt bought, not yet decontaminated) via the fight-free x=4 bypass used to hit the
    // needPurge refusal FIRST, which bounced you to Heur's Bay with no Save Function — and
    // since she is its only source, the finale's mandatory save was unreachable.
    it('still teaches Save on a FIRST meeting even while contaminated', () => {
        const game = newGame();
        game.state.unlocked.pauseMenu = true;
        game.state.unlocked.saveFunction = false;
        game.state.upgrades.corruptHandler = true;  // carrying Nibble's Glitch Shunt
        game.state.unlocked.purgeComplete = false;  // never went through Heur's Bay
        const lines = reachHome(game);
        expect(game.state.unlocked.saveFunction).toBe(true);
        expect(lines.join(' ')).toContain('Save Function');
    });

    // ...but the finale gate still holds: once she HAS taught you, a dirty copy is refused.
    it('refuses to file a contaminated copy once you already have Save', () => {
        const game = newGame();
        game.state.unlocked.pauseMenu = true;
        game.state.unlocked.saveFunction = true;    // she taught you on an earlier visit
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.purgeComplete = false;
        const lines = reachHome(game);
        expect(game.state.unlocked.checkpointOpen).toBe(false);
        expect(lines.join(' ').toLowerCase()).toMatch(/heur|bay|clean|contamin|purge|scrub/);
    });

    it('brushes you off with NO state change if you lack a Pause Menu (puzzle stays intact)', () => {
        const game = newGame();
        game.state.unlocked.pauseMenu = false;
        const lines = reachHome(game);
        expect(game.state.unlocked.saveFunction).toBe(false);
        expect(game.state.unlocked.cacheFound).toBe(false); // Hub CACHE puzzle untouched
        expect(game.state.unlocked.cacheStage).toBe(0);
        expect(lines.join(' ')).toContain('Diagnostic Module');
    });

    it('meeting her at home is free (no segment cost)', () => {
        const game = newGame();
        game.state.unlocked.saveFunction = true;
        const before = 2;
        reachHome(game);
        expect(game.snake.body.length).toBe(before); // a chat never docks mass
    });
});

describe('NarrativeManager.reset() — clean run boundary', () => {
    beforeEach(mountDom);

    it('clears logs/counters and bumps the generation (orphans an in-flight typewriter)', () => {
        const n = new NarrativeManager({ playDoot: () => {} });
        n.terminal = document.getElementById('narrative-terminal');
        n.deathCount = 4;
        n.unknownDeathCount = 2;
        n.messageQueue = ['queued'];
        n.isPrinting = true;
        n.terminal.innerHTML = '<div>old log</div>';
        const g0 = n._generation;

        n.reset();

        expect(n._generation).not.toBe(g0);       // stale loops will bail
        expect(n.isPrinting).toBe(false);
        expect(n.deathCount).toBe(0);
        expect(n.unknownDeathCount).toBe(0);
        expect(n.messageQueue.length).toBe(0);
        expect(n.online).toBe(false);
        expect(n.terminal.innerHTML).toBe('');
    });
});

describe('Accessibility — Options overlay & settings', () => {
    beforeEach(() => { mountDom(); try { window.localStorage.removeItem('ouroboros-settings'); } catch (e) {} });

    it('O toggles the overlay, which freezes the sim while open', () => {
        const game = newGame();
        game.audio.init = () => {}; // avoid AudioContext in happy-dom
        expect(game.optionsOpen).toBe(false);
        game.toggleOptions();
        expect(game.optionsOpen).toBe(true);
        game.state.gameState = 'PLAYING';
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        step(game, { x: 20, y: 0 });
        expect(game.snake.head.x).toBe(100); // frozen: no move
        game.toggleOptions();
        expect(game.optionsOpen).toBe(false);
    });

    it('adjusts volume / mute / reduce-motion and persists each change', () => {
        const game = newGame();
        game.audio.setVolume = vi.fn();
        game.saveManager.saveSettings = vi.fn();
        game.settings.volume = 0.4; game.settings.muted = false; game.settings.reduceMotion = false;
        game.optionsOpen = true;

        game.optionsIndex = 0; // Volume
        game.optionsHandleKey('ArrowRight');
        expect(game.settings.volume).toBeCloseTo(0.5);
        expect(game.audio.setVolume).toHaveBeenCalled();
        expect(game.saveManager.saveSettings).toHaveBeenCalled();

        game.optionsIndex = 1; // Mute
        game.optionsHandleKey('Enter');
        expect(game.settings.muted).toBe(true);

        game.optionsIndex = 2; // Reduce Motion
        game.optionsHandleKey(' ');
        expect(game.settings.reduceMotion).toBe(true);
    });

    it('mute sends volume 0 to the audio engine; unmute restores it', () => {
        const game = newGame();
        game.audio.setVolume = vi.fn();
        game.settings.volume = 0.5; game.settings.muted = true;
        game.applySettings();
        expect(game.audio.setVolume).toHaveBeenLastCalledWith(0);
        game.settings.muted = false;
        game.applySettings();
        expect(game.audio.setVolume).toHaveBeenLastCalledWith(0.5);
    });

    it('settings persist independently of save slots and survive clearAll', () => {
        const game = newGame();
        game.saveManager.saveSettings({ volume: 0.7, muted: true, reduceMotion: true });
        const g2 = newGame();
        expect(g2.saveManager.loadSettings()).toEqual({ volume: 0.7, muted: true, reduceMotion: true });
        g2.saveManager.clearAll();                       // wipes save files...
        expect(g2.saveManager.loadSettings()).not.toBe(null); // ...but NOT preferences
        window.localStorage.removeItem('ouroboros-settings');
    });

    it('a new game loads persisted settings and applies them (mute honored)', () => {
        const g0 = newGame();
        g0.saveManager.saveSettings({ volume: 0.3, muted: true, reduceMotion: false });
        const game = newGame(); // constructor loads + applies settings
        expect(game.settings.volume).toBe(0.3);
        expect(game.settings.muted).toBe(true);
        window.localStorage.removeItem('ouroboros-settings');
    });
});

describe('Cadenza — the DA CAPO Encore (the music puzzle)', () => {
    beforeEach(mountDom);

    // Enter the performance: mock the dialog so the intro's onComplete (startEncore) fires now.
    function enterEncore(game) {
        game.dialogManager.start = (lines, onComplete) => { if (onComplete) onComplete(); };
        game.npcCadenza(new NPC(200, 200, 20, 'cadenza', []));
        return game.encore;
    }
    // Put the head on node[i] with the body draped back over nodes [i-1..0] so they sustain.
    function drapeThrough(game, i) {
        const e = game.encore;
        const body = [];
        for (let k = i; k >= 0; k--) body.push({ x: e.nodes[k].x, y: e.nodes[k].y });
        game.snake.body = body;
    }

    it('AudioEngine exposes the tuned note + Locked Groove, and no-ops before init', () => {
        const audio = new AudioEngine();
        expect(typeof audio.playEncoreNote).toBe('function');
        expect(typeof audio.setMusicLayer).toBe('function');
        expect(typeof audio.stopMusic).toBe('function');
        expect(() => audio.playEncoreNote(0)).not.toThrow();
        expect(() => audio.setMusicLayer(3)).not.toThrow(); // no-op before init
        expect(() => audio.stopMusic()).not.toThrow();
        expect(() => audio.startMusicLayer1()).not.toThrow(); // back-compat alias
    });

    it('bumping Cadenza starts the Encore: an 8-node ring with one dead note', () => {
        const game = newGame();
        const e = enterEncore(game);
        expect(game.state.gameState).toBe('ENCORE');
        expect(e.nodes.length).toBe(8);
        expect(e.nodes.filter(n => n.dead).length).toBe(1);
        expect(e.nodes[5].dead).toBe(true);
        expect(e.nextIndex).toBe(0);
    });

    it('Cadenza starting to sing clears the Glitches from her room', () => {
        const game = newGame();
        game.glitches = [{ x: 60, y: 60 }, { x: 80, y: 80 }];
        enterEncore(game); // the intro completes -> startEncore -> she sings
        expect(game.glitches.length).toBe(0);
        expect(game.state.gameState).toBe('ENCORE');
    });

    it('starting the Encore resets a pending Crumple unfold (no growth mid-lap)', () => {
        const game = newGame();
        game.dialogManager.start = (lines, onComplete) => { if (onComplete) onComplete(); };
        game.pendingUnfold = 6;
        game.npcCadenza(new NPC(200, 200, 20, 'cadenza', []));
        expect(game.pendingUnfold).toBe(0);
    });

    it('striking nodes IN ORDER (body draped) advances the phrase', () => {
        const game = newGame();
        const e = enterEncore(game);
        drapeThrough(game, 0); game._encoreProcess();
        expect(e.eaten[0]).toBe(true); expect(e.nextIndex).toBe(1);
        drapeThrough(game, 1); game._encoreProcess();
        expect(e.eaten[1]).toBe(true); expect(e.nextIndex).toBe(2);
        drapeThrough(game, 2); game._encoreProcess();
        expect(e.nextIndex).toBe(3); expect(e.phase).toBe(2); // phrase checkpoint at 3
    });

    it('update() drives the Encore move-tick and strikes a node', () => {
        const game = newGame();
        const e = enterEncore(game);
        const n0 = e.nodes[0];
        game.snake.body = [{ x: n0.x - 20, y: n0.y }]; // one cell left of node 0
        game.input.nextDirection = { x: 20, y: 0 };    // step right, onto node 0
        game.update(1000);
        expect(e.eaten[0]).toBe(true);
        expect(e.nextIndex).toBe(1);
    });

    it('striking a note OUT OF ORDER breaks the take (da capo — resets to 0)', () => {
        const game = newGame();
        const e = enterEncore(game);
        drapeThrough(game, 0); game._encoreProcess();
        expect(e.nextIndex).toBe(1);
        // jump to node 2, skipping node 1 (node 0 still covered behind the head)
        game.snake.body = [{ x: e.nodes[2].x, y: e.nodes[2].y }, { x: e.nodes[0].x, y: e.nodes[0].y }];
        game._encoreProcess();
        expect(e.nextIndex).toBe(0);
        expect(e.eaten[2]).toBeFalsy();
    });

    it('DROPPING a sustained note (body slides off it) breaks the take', () => {
        const game = newGame();
        const e = enterEncore(game);
        drapeThrough(game, 0); game._encoreProcess();
        expect(e.nextIndex).toBe(1);
        game.snake.body = [{ x: 20, y: 20 }]; // whole body off node 0
        game._encoreProcess();
        expect(e.nextIndex).toBe(0);
    });

    it('the DEAD NOTE stops the finale WITHOUT the Wilds verse — points you to the Wilds', () => {
        const game = newGame();
        const e = enterEncore(game);
        game.state.unlocked.lostVerseFound = false;
        e.nextIndex = 5;
        e.eaten = { 0: true, 1: true, 2: true, 3: true, 4: true };
        game.snake.body = [5, 4, 3, 2, 1, 0].map(k => ({ x: e.nodes[k].x, y: e.nodes[k].y }));
        game._encoreProcess();
        expect(game.encore).toBeNull();
        expect(game.state.unlocked.encoreComplete).toBe(false);
        expect(game.state.gameState).toBe('PLAYING'); // exited via 'needverse' (dialog mock completes)
    });

    it('WITH the Wilds verse the dead note sounds and the take continues', () => {
        const game = newGame();
        const e = enterEncore(game);
        game.state.unlocked.lostVerseFound = true;
        e.nextIndex = 5;
        e.eaten = { 0: true, 1: true, 2: true, 3: true, 4: true };
        game.snake.body = [5, 4, 3, 2, 1, 0].map(k => ({ x: e.nodes[k].x, y: e.nodes[k].y }));
        game._encoreProcess();
        expect(e.eaten[5]).toBe(true);
        expect(e.nextIndex).toBe(6);
        expect(game.state.gameState).toBe('ENCORE');
    });

    it('holding the WHOLE chord at once boots Music Layer 1 (the finale)', () => {
        const game = newGame();
        const e = enterEncore(game);
        game.state.unlocked.lostVerseFound = true;
        e.nextIndex = 7;
        e.eaten = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
        game.snake.body = [7, 6, 5, 4, 3, 2, 1, 0].map(k => ({ x: e.nodes[k].x, y: e.nodes[k].y }));
        game._encoreProcess();
        expect(game.encore).toBeNull();
        expect(game.state.unlocked.encoreComplete).toBe(true);
        expect(game.state.unlocked.musicLayer).toBe(1);
        expect(game.state.unlocked.cadenzaFound).toBe(true);
        expect(game.state.gameState).toBe('PLAYING');
    });

    it('completing the lap but a note DROPS on the last beat still breaks it (length gate)', () => {
        const game = newGame();
        const e = enterEncore(game);
        game.state.unlocked.lostVerseFound = true;
        e.nextIndex = 7;
        e.eaten = { 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true };
        // head on node 7, but the body is too short to still cover node 0 -> chord not whole
        game.snake.body = [7, 6, 5, 4, 3, 2, 1].map(k => ({ x: e.nodes[k].x, y: e.nodes[k].y }));
        game._encoreProcess();
        expect(game.state.unlocked.encoreComplete).toBe(false);
        expect(e.nextIndex).toBe(0);
    });

    it('ESC leaves the performance back to normal play', () => {
        const game = newGame();
        enterEncore(game);
        expect(game.state.gameState).toBe('ENCORE');
        game.exitEncore('left');
        expect(game.state.gameState).toBe('PLAYING');
        expect(game.encore).toBeNull();
    });

    it('picking up the Lost Verse is collected like Data — it grows the tail + gives Data', () => {
        const game = newGame();
        game.dialogManager.start = (lines, onComplete) => { if (onComplete) onComplete(); };
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'lostverse', [])];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        const len0 = game.snake.body.length, score0 = game.state.score;
        step(game, { x: 20, y: 0 }); // step right, onto the Lost Verse at (120,100)
        expect(game.state.unlocked.lostVerseFound).toBe(true);
        expect(game.npcs.some(n => n.id === 'lostverse')).toBe(false);
        expect(game.snake.body.length).toBe(len0 + 1); // it ADDED TO YOUR TAIL, like Data
        expect(game.state.score).toBeGreaterThan(score0);
    });

    it('the Lost Verse spawns in its Wilds landmark room until collected', () => {
        const game = newGame();
        const lv = game.worldManager.landmarks.lostverse;
        expect(lv).toBeTruthy();
        const room = game.worldManager.roomGenerator.generateRoom(lv.x, lv.y, game.state.unlocked, game.worldManager);
        expect(room.npcs.some(n => n.id === 'lostverse')).toBe(true);
        game.state.unlocked.lostVerseFound = true;
        const room2 = game.worldManager.roomGenerator.generateRoom(lv.x, lv.y, game.state.unlocked, game.worldManager);
        expect(room2.npcs.some(n => n.id === 'lostverse')).toBe(false);
    });

    it('the Encore flags round-trip through save/load', () => {
        const a = newGame();
        a.state.unlocked.lostVerseFound = true;
        a.state.unlocked.encoreComplete = true;
        a.state.unlocked.musicLayer = 1;
        const b = newGame();
        b.applySave(a.serialize());
        expect(b.state.unlocked.lostVerseFound).toBe(true);
        expect(b.state.unlocked.encoreComplete).toBe(true);
        expect(b.state.unlocked.musicLayer).toBe(1);
    });
});

describe('Data = segments (economy coupling)', () => {
    beforeEach(mountDom);

    it('eating an apple gives +1 Data AND +1 segment (the base coupling)', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        game.apple = { x: 120, y: 100 };
        const len0 = game.snake.body.length, score0 = game.state.score;
        step(game, { x: 20, y: 0 });
        expect(game.state.score).toBe(score0 + 1);
        expect(game.snake.body.length).toBe(len0 + 1);
    });

    it('eating with Data Compression gives +2 Data AND +2 segments', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.upgrades.dataCompression = true;
        game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        game.apple = { x: 120, y: 100 };
        const len0 = game.snake.body.length, score0 = game.state.score;
        step(game, { x: 20, y: 0 });
        expect(game.state.score).toBe(score0 + 2);
        expect(game.snake.body.length).toBe(len0 + 2);
    });

    it('spending Data at the shop shrinks your body by the price', () => {
        const game = newGame();
        game.state.score = 100;
        game.snake.body = [];
        for (let i = 0; i < 40; i++) game.snake.body.push({ x: 20 + i * 10, y: 20 });
        const pivot = game.shopManager.items[0]; // pivot, price 10
        const len0 = game.snake.body.length, score0 = game.state.score;
        game.shopManager.purchase(pivot);
        expect(game.state.upgrades.pivot).toBe(true);
        expect(game.state.score).toBe(score0 - pivot.price);
        expect(game.snake.body.length).toBe(len0 - pivot.price); // spending shrank you
    });

    it('spending Data sheds folded (post-bounce) mass first, keeping length coupled', () => {
        const game = newGame();
        game.pendingUnfold = 8;
        game.snake.body = [];
        for (let i = 0; i < 10; i++) game.snake.body.push({ x: 20 + i * 20, y: 20 });
        game.spendData(5);                 // 5 <= 8 folded -> all off the fold
        expect(game.pendingUnfold).toBe(3);
        expect(game.snake.body.length).toBe(10);
        game.spendData(5);                 // 3 off the fold, then 2 real segments
        expect(game.pendingUnfold).toBe(0);
        expect(game.snake.body.length).toBe(8);
    });

    it('a Glitch bite drains segments AND Data together', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.score = 20;
        game.snake.body = [];
        for (let i = 0; i < 12; i++) game.snake.body.push({ x: 100 - i * 20, y: 100 });
        game.apple = { x: 300, y: 300 };
        game.glitches = [new Glitch(120, 100, 20)]; // one cell right of the head
        const len0 = game.snake.body.length, score0 = game.state.score;
        step(game, { x: 20, y: 0 }); // steer into the Glitch
        expect(game.snake.body.length).toBeLessThan(len0); // lost segments
        expect(game.state.score).toBeLessThan(score0);      // ...and Data, together
    });
});

describe("Cadenza's title-screen cameo (after the Encore)", () => {
    beforeEach(() => {
        mountDom();
        for (const k of ['ouroboros-cameo-seen', 'ouroboros-encore-unlocked', 'ouroboros-cadenza-cameo-seen']) window.localStorage.removeItem(k);
    });
    afterEach(() => {
        new SaveManager().clearAll();
        for (const k of ['ouroboros-cameo-seen', 'ouroboros-encore-unlocked', 'ouroboros-cadenza-cameo-seen']) window.localStorage.removeItem(k);
    });

    function titleGame({ cacheSeen = false, encore = false, cadenzaSeen = false } = {}) {
        const game = newGame();
        game.saveManager.clearAll();
        game.saveManager.save(1, { v: 1, unlocked: {}, upgrades: {}, meta: { place: 'Test' } }); // a save exists
        if (cacheSeen) game.saveManager.markCameoSeen();
        if (encore) game.saveManager.markEncoreUnlocked();
        if (cadenzaSeen) game.saveManager.markCadenzaCameoSeen();
        game.titleCameo = null; game.startCameoActive = false;
        return game;
    }

    it('AudioEngine exposes the Void Ambient and no-ops before init', () => {
        const audio = new AudioEngine();
        expect(typeof audio.startVoidAmbient).toBe('function');
        expect(typeof audio.stopVoidAmbient).toBe('function');
        expect(() => audio.startVoidAmbient()).not.toThrow();
        expect(() => audio.stopVoidAmbient()).not.toThrow();
    });

    it('first boot with a save -> the CACHE cameo (enters from the left)', () => {
        const game = titleGame({ cacheSeen: false });
        game.maybeStartTitleCameo();
        expect(game.titleCameo).toBeTruthy();
        expect(game.titleCameo.who).toBe('cache');
        expect(game.titleCameo.x).toBeLessThan(0);
    });

    it('after Cache but WITHOUT the Encore -> no Cadenza cameo', () => {
        const game = titleGame({ cacheSeen: true, encore: false });
        game.maybeStartTitleCameo();
        expect(game.titleCameo).toBeNull();
    });

    it('after Cache AND the Encore -> the CADENZA cameo (enters from the opposite side)', () => {
        const game = titleGame({ cacheSeen: true, encore: true });
        game.maybeStartTitleCameo();
        expect(game.titleCameo).toBeTruthy();
        expect(game.titleCameo.who).toBe('cadenza');
        expect(game.titleCameo.x).toBeGreaterThan(game.canvas.width);
    });

    it('the Cadenza cameo is one-time (already seen -> no cameo)', () => {
        const game = titleGame({ cacheSeen: true, encore: true, cadenzaSeen: true });
        game.maybeStartTitleCameo();
        expect(game.titleCameo).toBeNull();
    });

    it('completing the Encore sets the global "encore unlocked" flag', () => {
        const game = newGame();
        game.dialogManager.start = (lines, onComplete) => { if (onComplete) onComplete(); };
        game.state.unlocked.lostVerseFound = true;
        game.npcCadenza(new NPC(200, 200, 20, 'cadenza', []));
        const e = game.encore;
        e.nextIndex = 7;
        e.eaten = { 0: 1, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };
        game.snake.body = [7, 6, 5, 4, 3, 2, 1, 0].map(k => ({ x: e.nodes[k].x, y: e.nodes[k].y }));
        game._encoreProcess();
        expect(game.saveManager.hasEncoreUnlocked()).toBe(true);
    });
});

describe('the layered soundtrack (shared composition)', () => {
    beforeEach(mountDom);

    it('loading a save syncs the soundtrack to its layer (0 halts a playing theme)', () => {
        const a = newGame();
        a.state.unlocked.musicLayer = 0;
        const b = newGame();
        b.audio.setMusicLayer = vi.fn();
        b.applySave(a.serialize());
        expect(b.audio.setMusicLayer).toHaveBeenCalledWith(0); // stops a stale theme
        a.state.unlocked.musicLayer = 2;
        b.audio.setMusicLayer.mockClear();
        b.applySave(a.serialize());
        expect(b.audio.setMusicLayer).toHaveBeenCalledWith(2);
    });

    it('every theme channel is exactly one loop long (stays in sync)', () => {
        for (const ch of THEME_CHANNELS) {
            const beats = ch.seq.reduce((s, ev) => s + ev[1], 0);
            expect(beats).toBe(LOOP_BEATS);
        }
    });

    it('channels stack by layer (bass 1, arp 2, melody + perc 3)', () => {
        const byId = Object.fromEntries(THEME_CHANNELS.map(c => [c.id, c.layer]));
        expect(byId.bass).toBe(1);
        expect(byId.arp).toBe(2);
        expect(byId.melody).toBe(3);
        expect(byId.perc).toBe(3);
    });

    it('noteFreq is standard equal temperament (A4 = 440)', () => {
        expect(Math.round(noteFreq('A4'))).toBe(440);
        expect(Math.round(noteFreq('A5'))).toBe(880);
        expect(Math.round(noteFreq('C5'))).toBe(523);
    });
});
