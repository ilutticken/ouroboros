/**
 * @vitest-environment happy-dom
 */
// BOOT + DRAW SMOKE TEST. The unit suite never calls Renderer.draw(), so a typo in a
// draw path (which runs every frame in real play) would ship a black screen with a
// green test suite. This drives the FULL frame loop — update() + draw() — through every
// game state with a Proxy canvas context that accepts any call, so ReferenceErrors and
// TypeErrors in draw code surface here.
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { NPC } from '../src/entities/NPC.js';
import { mountDom, makeGame, frames } from './helpers.js';

// Smoke needs EVERY audio method stubbed and the swallow-everything canvas ctx
// (happy-dom's getContext returns null, so this is the only way to run draw()).
const bootGame = (width = 400, height = 400) =>
    makeGame({ width, height, audio: 'all', ctx: true, playing: false });


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
