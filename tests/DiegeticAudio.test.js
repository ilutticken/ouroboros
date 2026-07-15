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

describe('Room transitions: hub quarantine vs Wilds doorways', () => {
    beforeEach(mountDom);

    it('lets you cross from one Wilds room to the next through the weak point', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 1; // in the Wilds, not the hub
        game.worldManager.currentRoomY = 0;
        // Pre-author the destination so no random obstacle blocks the entry cell.
        game.worldManager.rooms['2,0'] = { apple: { x: 300, y: 300 }, glitches: [], npcs: [], obstacles: [] };
        game.snake.body = [{ x: 380, y: 200 }]; // right wall, centered on the weak point

        step(game, { x: 20, y: 0 }); // ram right through the doorway

        expect(game.worldManager.currentRoomX).toBe(2);
        expect(game.state.gameState).not.toBe('DEAD');
    });

    it('still kills you on the solid part of a Wilds wall (outside the doorway)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 1;
        game.worldManager.currentRoomY = 0;
        game.snake.body = [{ x: 380, y: 20 }]; // right wall, far from the center gap

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).toBe('DEAD');
        expect(game.worldManager.currentRoomX).toBe(0); // died -> warped back to hub
    });

    it('keeps the hub sealed: its wall cannot be passed without max gear', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        // hub is (0,0) by default; wall not yet broken
        game.gear = 0;
        game.snake.body = [{ x: 380, y: 200 }]; // hub right wall, on the weak point

        step(game, { x: 20, y: 0 });

        expect(game.state.gameState).toBe('DEAD'); // no momentum -> can't breach
        expect(game.worldManager.currentRoomX).toBe(0);
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
