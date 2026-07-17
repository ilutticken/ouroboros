/**
 * @vitest-environment happy-dom
 */
// Diegetic ambient audio: the system reacting to where your body is.
// These tests pin the *trigger logic* (when playWub / playGlide fire) rather
// than the Web Audio synthesis, which needs a real AudioContext + user gesture.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { AudioEngine } from '../src/engine/Audio.js';
import { Glitch } from '../src/entities/Glitch.js';
import { NPC } from '../src/entities/NPC.js';

function mountDom() {
    document.body.innerHTML = `
        <div id="ui-layer" class="hidden">
            <div id="score-value">0</div>
            <button id="btn-playtest">dev</button>
        </div>
        <div id="game-wrapper">
            <div id="shop-overlay" class="hidden">
                <button id="btn-buy-brake">Buy</button>
                <div id="item-buy-hitchhiker" class="hidden">
                    <button id="btn-buy-hitchhiker">Buy</button>
                </div>
                <button id="btn-buy-compression">Buy</button>
                <button id="btn-buy-armor">Buy</button>
                <button id="btn-buy-speed">Buy</button>
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
        game.snake.body = [{ x: 0, y: 100 }]; // pinned to the left wall

        step(game, { x: 0, y: -20 }); // glide up along the left wall -> (0,80)

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
        const game = newGame(); // 400x400, rightmost cell = 380 = width - g
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 380, y: 100 }];

        step(game, { x: 0, y: -20 }); // glide up along the right wall

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('scrapes along the TOP edge moving horizontally', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 100, y: 0 }];

        step(game, { x: 20, y: 0 }); // glide right along the top edge

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('detects a far-wall glide on a canvas NOT aligned to the grid (pins >= vs ===)', () => {
        // 410px wide: rightmost reachable cell is x=400, but width - g = 390.
        // `atRight === head.x === width - g` would MISS this; `>=` catches it.
        const game = newGame(410, 410);
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 400, y: 100 }];

        step(game, { x: 0, y: -20 }); // (400,80): 400 >= 410 - 20

        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    it('scales glide intensity with gear (pitch rises with speed)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        game.apple = { x: 200, y: 200 };
        game.snake.body = [{ x: 0, y: 100 }];
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
        game.snake.body = [{ x: 0, y: 100 }];
        game.glitches = [new Glitch(0, 40, 20)]; // 2 tiles from the head's landing

        step(game, { x: 0, y: -20 }); // head -> (0,80): left-wall glide + glitch nearby

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
