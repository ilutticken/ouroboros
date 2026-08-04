/**
 * @vitest-environment happy-dom
 */
// BOOT + DRAW SMOKE TEST. The unit suite never calls Renderer.draw(), so a typo in a
// draw path (which runs every frame in real play) would ship a black screen with a
// green test suite. This drives the FULL frame loop — update() + draw() — through every
// game state with a Proxy canvas context that accepts any call, so ReferenceErrors and
// TypeErrors in draw code surface here.
import { describe, it, expect, beforeEach } from 'vitest';
import { NPC } from '../src/entities/NPC.js';
import {
    LOGICAL_W, LOGICAL_H, COLS, ROWS,
    CABINET_W, CABINET_H, CHROME_TOP, CHROME_BOTTOM, computeFit,
} from '../src/config.js';
import { DialogManager } from '../src/systems/DialogManager.js';
import { mountDom, makeGame, frames, recordingCtx, badGeometry, fontSizes } from './helpers.js';

// Smoke needs EVERY audio method stubbed and the swallow-everything canvas ctx
// (happy-dom's getContext returns null, so this is the only way to run draw()).
const bootGame = (width = 400, height = 400) =>
    makeGame({ width, height, audio: 'all', ctx: true, playing: false });


// THE SIZE PLAYERS ACTUALLY SEE. Every other suite builds its own small canvas, so until
// this existed the one resolution the game ships at was the one resolution nothing
// exercised. The board is fixed now (src/config.js) precisely so this is testable at all.
describe('The shipping resolution', () => {
    beforeEach(mountDom);

    const real = (opts = {}) => makeGame({ width: LOGICAL_W, height: LOGICAL_H, audio: 'all', ...opts });

    it('the logical board is exactly the configured grid', () => {
        const game = real();
        expect(game._cols).toBe(COLS);
        expect(game._rows).toBe(ROWS);
        expect(LOGICAL_W % game.gridSize).toBe(0); // whole cells, no half-cell at the edge
        expect(LOGICAL_H % game.gridSize).toBe(0);
    });

    // Integer multiples only, nearest-neighbour — the emulator rule. A fractional scale
    // makes some pixels 2 screen-px wide and their neighbours 3, which is the shimmer that
    // makes upscaled pixel art look cheap. Calls the REAL computeFit (main.js calls the
    // same one); the first version of this test re-implemented the formula, which pins a
    // copy of the maths rather than the maths.
    it('scales by whole numbers on real displays, and never crops on small ones', () => {
        for (const [w, h] of [[1366, 720], [1920, 1000], [2560, 1400], [3840, 2100]]) {
            const { scale, uiScale, width, height } = computeFit(w, h);
            expect(Number.isInteger(scale), `${w}x${h} -> ${scale}`).toBe(true);
            expect(Number.isInteger(uiScale)).toBe(true);
            expect(scale).toBeGreaterThanOrEqual(1);
            expect(uiScale).toBeGreaterThanOrEqual(1);    // never under the §2.6 floor
            expect(uiScale).toBeLessThanOrEqual(scale);   // chrome never outgrows its machine
            expect(width).toBeLessThanOrEqual(w);         // fits, never cropped
            // The WHOLE cabinet has to fit, not just the board — sizing the canvas alone
            // is exactly the bug that pushed the HUD off the play field.
            expect(height + (CHROME_TOP + CHROME_BOTTOM) * uiScale).toBeLessThanOrEqual(h);
        }
    });

    // The board is maximised against 1x chrome BEFORE the chrome is allowed to grow.
    // Locking them together looks tidier and measurably costs a windowed 1440p display
    // its 2x board — a regression with no symptom in any other test.
    it('the board never loses a whole step to make room for bigger chrome', () => {
        const chrome = CHROME_TOP + CHROME_BOTTOM;
        for (const [w, h] of [[2560, 1310], [3840, 2030], [1920, 950], [2560, 1440]]) {
            const { scale, uiScale, height } = computeFit(w, h);
            const best = Math.floor(Math.min(w / LOGICAL_W, (h - chrome) / LOGICAL_H));
            expect(scale, `${w}x${h}`).toBe(best);
            // ...and the chrome took every step that still fit, but no more.
            expect(height + chrome * (uiScale + 1) > h || uiScale === scale, `${w}x${h}`).toBe(true);
        }
        expect(computeFit(2560, 1310).scale).toBe(2);   // the case that regressed
        expect(computeFit(2560, 1310).uiScale).toBe(1);
    });

    it('below 1x the board softens but the chrome holds its §2.6 floor', () => {
        // A soft picture beats a cropped one — a wall you cannot see is a wall that kills
        // you — but shrinking the HUD text below 16px is never the trade we make.
        const { scale, uiScale, width, height } = computeFit(800, 480);
        expect(scale).toBeLessThan(1);
        expect(uiScale).toBe(1);
        expect(width).toBeLessThanOrEqual(800);
        expect(height).toBeLessThanOrEqual(480 - CHROME_TOP - CHROME_BOTTOM);
        expect(scale).toBeGreaterThan(0);                 // never zero/negative
        expect(computeFit(320, 100).scale).toBeGreaterThan(0); // absurdly short window
    });

    // THE CABINET. The regression this exists for: the canvas was bound to the logical
    // board while every ribbon and overlay still measured the WINDOW, so on a 1920-wide
    // display Data sat ~430px left of the play field and the dialog box overhung it.
    // Layout isn't computed in happy-dom, so what's pinned here is the CONTAINMENT that
    // makes the CSS percentages mean the board — which is where the bug actually lived.
    it('every visible element hangs off the cabinet, and dialog hangs off the board', () => {
        const cabinet = document.getElementById('cabinet');
        const wrapper = document.getElementById('game-wrapper');
        expect(cabinet, 'no #cabinet — the chrome would measure the window again').toBeTruthy();
        for (const id of ['ui-layer', 'game-wrapper', 'ui-layer-bottom', 'shop-overlay']) {
            expect(cabinet.contains(document.getElementById(id)), id).toBe(true);
        }
        // Parented to <body> these percentages resolve against the viewport, not the game.
        const dm = new DialogManager();
        expect(wrapper.contains(dm.container)).toBe(true);
        expect(dm.container.parentElement).not.toBe(document.body);
    });

    it('the cabinet reserves exactly the chrome the stylesheet spends', () => {
        // config.js budgets CHROME_TOP/BOTTOM vertically; style.css sizes the ribbons to
        // the same numbers. If they drift, the board is fitted against a height nobody
        // actually has and the bottom ribbon clips — which is how the terminal spent its
        // whole life overflowing a 100px ribbon with a 114px box.
        expect(CABINET_W).toBe(LOGICAL_W);
        expect(CABINET_H).toBe(LOGICAL_H + CHROME_TOP + CHROME_BOTTOM);
        expect(CABINET_H).toBe(720);
    });

    it('every state draws clean at the shipping size', () => {
        for (const s of ['START', 'PLAYING', 'DIALOG', 'PAUSED', 'TRANSITION', 'DEAD']) {
            const game = real({ ctx: true });
            Object.assign(game.state.unlocked, {
                ui: true, borders: true, tailRider: true, gearMeter: true, redline: true,
                coordReadout: true, pauseMenu: true, saveFunction: true, mapPinsTool: true,
                mapModule: true,
            });
            game.state.score = 40; game.growSnake(40);
            if (s === 'START') game.saveManager.save(1, { unlocked: {} });
            game.state.gameState = s;
            const ctx = recordingCtx();
            game.renderer.ctx = ctx;
            for (let i = 0; i < 3; i++) { game.update(40); game.draw(); }
            expect(badGeometry(ctx.__ops), s).toEqual([]);
            expect(ctx.__ops.filter(o => o.op === 'save').length, s)
                .toBe(ctx.__ops.filter(o => o.op === 'restore').length);
        }
    });

    it('holds the §2.6 text floor on the prose surfaces at the shipping size', () => {
        for (const s of ['START', 'DEAD']) {
            const game = real({ ctx: true });
            game.state.unlocked.ui = true;
            if (s === 'START') game.saveManager.save(1, { unlocked: {} });
            game.state.gameState = s;
            const ctx = recordingCtx();
            game.renderer.ctx = ctx;
            for (let i = 0; i < 2; i++) { game.update(40); game.draw(); }
            const sizes = fontSizes(ctx.__ops);
            expect(sizes.length, `${s} drew no text`).toBeGreaterThan(0);
            expect(Math.min(...sizes), s).toBeGreaterThanOrEqual(16);
        }
    });
});

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
        // a wandered-off apple (null) must render a full frame without throwing
        game.apple = null;
        frames(game, 3);
        game.apple = game.spawnApple();
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

    it("Gate's two fights render — the rotating ring and the advancing walls", () => {
        // THE GATE {5,-3}: the ring must paint (blocks + hatch) and the ribbon must read.
        const game = bootGame();
        game.state.gameState = 'PLAYING';
        game.state.unlocked.ui = true;
        game.state.unlocked.ascentArmed = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -3;
        game.apple = { x: 300, y: 300 }; game.glitches = []; game.obstacles = [];
        game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
        for (let i = 0; i < 12; i++) { game.updateGate3(); game.draw(); }
        expect(game.state.gateBlocks.length).toBeGreaterThan(0);

        // PORT 0 {5,-5}: the advancing walls + Denny's stamps.
        const g2 = bootGame();
        g2.state.gameState = 'PLAYING';
        g2.state.unlocked.ui = true;
        g2.worldManager.currentRoomX = 5; g2.worldManager.currentRoomY = -5;
        g2.apple = { x: 300, y: 300 }; g2.glitches = []; g2.obstacles = []; g2.stamps = [];
        g2.npcs = [new NPC(200, 40, 20, 'gatefinal', []), new NPC(200, 340, 20, 'dennyfinal', [])];
        for (let i = 0; i < 40; i++) { g2._tick++; g2.updateGateFinal(); g2.draw(); }
        expect(g2.state.finaleWalls.length).toBeGreaterThan(0);
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
