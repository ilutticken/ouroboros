/**
 * @vitest-environment happy-dom
 */
// BOOT + DRAW SMOKE TEST. The unit suite never calls Renderer.draw(), so a typo in a
// draw path (which runs every frame in real play) would ship a black screen with a
// green test suite. This drives the FULL frame loop — update() + draw() — through every
// game state with a Proxy canvas context that accepts any call, so ReferenceErrors and
// TypeErrors in draw code surface here.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { NPC } from '../src/entities/NPC.js';

function mountDom() {
    document.body.innerHTML = `
        <div id="ui-layer" class="hidden"><div id="score-value">0</div></div>
        <div id="game-wrapper">
            <div id="shop-overlay" class="hidden">
                <h2 id="shop-title"></h2>
                <div class="shop-items" id="shop-items"></div>
                <button id="btn-close-shop">Leave</button>
            </div>
        </div>
        <div id="ui-layer-bottom" class="hidden"><div id="narrative-terminal"></div></div>
    `;
    window.localStorage.clear();
}

// A 2D context that absorbs every method call and property write — so draw code runs
// for real (its own logic, string building, state reads) without a rasterizer.
function stubCtx() {
    const noop = () => stub; // chainable-ish
    const stub = new Proxy({}, {
        get: (t, prop) => {
            if (prop === 'measureText') return () => ({ width: 42 });
            if (prop === 'canvas') return undefined;
            return noop;
        },
        set: () => true,
    });
    return stub;
}

function bootGame(width = 400, height = 400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const game = new GameEngine(canvas);
    for (const k of Object.getOwnPropertyNames(Object.getPrototypeOf(game.audio))) {
        if (k !== 'constructor' && typeof game.audio[k] === 'function') game.audio[k] = vi.fn();
    }
    game.renderer.ctx = stubCtx(); // absorb rasterization; keep all draw logic live
    return game;
}

function frames(game, n, dt = 40) {
    for (let i = 0; i < n; i++) { game.update(dt); game.draw(); }
}

describe('Boot + draw smoke (every state renders without throwing)', () => {
    beforeEach(mountDom);

    it('cold open: START (bare) renders', () => {
        const game = bootGame();
        expect(game.state.gameState).toBe('START');
        frames(game, 5);
    });

    it('START with the file menu + Hydratia glimpse renders', () => {
        const game = bootGame();
        game.saveManager.save(1, { unlocked: {} });
        game.saveManager.saveAuto(2, { unlocked: {} }); // auto-only slot row
        game.maybeStartHydratiaCatch();
        frames(game, 5);
    });

    it('PLAYING renders across rooms, HUD states, and the scanner beyond tags', () => {
        const game = bootGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.ui = true;
        game.state.unlocked.borders = true;
        game.state.unlocked.tailRider = true;
        game.state.unlocked.gearMeter = true;
        game.state.unlocked.redline = true;
        game.state.unlocked.coordReadout = true;
        game.state.upgrades.scanner = true;
        game.state.score = 25;
        game.growSnake(25);
        game.carriedRefugee = '4,2';
        game._argListenMs = 1000;
        game.worldManager.revealBeyond(0, 0, 'right', 'module', 3000);
        frames(game, 10);
        // walk a few real rooms (content rooms exercise NPC drawing)
        for (const [x, y] of [[5, 0], [1, -5], [8, -5], [7, -2], [4, 2]]) {
            game.worldManager.currentRoomX = x;
            game.worldManager.currentRoomY = y;
            const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
            game.apple = room.apple; game.glitches = room.glitches;
            game.npcs = room.npcs; game.obstacles = room.obstacles || [];
            frames(game, 3);
        }
    });

    it('DEAD renders the receipt; PAUSED renders RETAINED; TRANSITION renders', () => {
        const game = bootGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.ui = true;
        game.die('self');
        expect(game.state.gameState).toBe('DEAD');
        frames(game, 5);
        game.state.gameState = 'PAUSED';
        game.state.unlocked.pauseMenu = true;
        game.state.unlocked.saveFunction = true;
        game.state.unlocked.mapPinsTool = true;
        frames(game, 5);
        game.state.gameState = 'TRANSITION';
        frames(game, 3);
    });

    it('the Heur fight and the Encore render', () => {
        const game = bootGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -1;
        game.apple = { x: 300, y: 300 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        game.startHeurFight('up');
        frames(game, 10);
        const g2 = bootGame();
        g2.state.gameState = 'PLAYING';
        g2.npcs = []; g2.glitches = []; g2.obstacles = []; g2.apple = { x: 300, y: 300 };
        g2.growSnake(30);
        g2.startEncore();
        expect(g2.state.gameState).toBe('ENCORE');
        frames(g2, 10);
    });
});
