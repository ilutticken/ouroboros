/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { NPC } from '../src/entities/NPC.js';
import { Glitch } from '../src/entities/Glitch.js';

describe('GameEngine - NPC Encounters', () => {
    let game;
    let mockCanvas;
    
    beforeEach(() => {
        // Setup minimal DOM for GameEngine
        document.body.innerHTML = `
            <div id="ui-layer">
                <div id="score-value"></div>
            </div>
            <div id="game-wrapper">
                <div id="shop-overlay" class="hidden">
                <button id="btn-buy-brake">Buy</button>
                <button id="btn-buy-compression">Buy</button>
                <button id="btn-buy-armor">Buy</button>
                <button id="btn-buy-speed">Buy</button>
                <button id="btn-close-shop">Leave</button>
            </div>
            </div>
            <div id="ui-layer-bottom">
                <div id="narrative-terminal"></div>
            </div>
            <div id="dialog-overlay"></div>
        `;
        
        mockCanvas = document.createElement('canvas');
        mockCanvas.width = 400;
        mockCanvas.height = 400;
        
        game = new GameEngine(mockCanvas);
    });
    
    it('spawns Bite NPC when score is 20 and encounter not triggered', () => {
        game.state.score = 20;
        game.state.unlocked.firstEncounter = false;
        
        const spawned = game.spawnApple();
        expect(spawned).toBeInstanceOf(NPC);
        expect(spawned.id).toBe('bite');
    });
    
    it('spawns a regular apple once 2-Bit has already been met (biteProgress > 0)', () => {
        game.state.score = 20;
        game.state.unlocked.biteProgress = 1; // the 2-Bit intro already happened

        const spawned = game.spawnApple();
        expect(spawned).not.toBeInstanceOf(NPC);
    });

    it('transitions to DIALOG on the Bite apple and advances 2-Bit\'s quest', () => {
        game.state.gameState = 'PLAYING';
        game.state.score = 20;
        game.apple = game.spawnApple(); // spawns Bite (biteProgress 0)

        game.snake.reset(game.apple.x - 20, game.apple.y);
        game.input.direction = { x: 20, y: 0 };

        // Mock dialog manager to instantly run callback
        const originalStart = game.dialogManager.start;
        game.dialogManager.start = (dialog, cb) => { cb(); };

        game.update(500); // trigger move onto the Bite apple

        expect(game.state.gameState).toBe('PLAYING'); // the callback resumes play
        expect(game.state.unlocked.biteProgress).toBe(1); // quest advanced (firstEncounter is gone)
        expect(game.snake.body.length).toBe(2);

        game.dialogManager.start = originalStart;
    });

    it('reinforced segments reduce glitch damage from 3 segments to 1', () => {
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.state.upgrades.reinforcedSegments = true;
        game.apple = { x: 300, y: 300 };
        // Length 4; head at (80,100) about to step onto the glitch at (100,100).
        game.snake.body = [
            { x: 80, y: 100 }, { x: 60, y: 100 }, { x: 40, y: 100 }, { x: 20, y: 100 },
        ];
        game.glitches = [{ x: 100, y: 100 }];
        game.input.direction = { x: 20, y: 0 };

        game.update(500); // head -> (100,100), onto the glitch

        // Move grows to 5, the non-eating shrink trims 1 (->4), then the glitch removes
        // just 1 more (reinforced) instead of 3 -> length 3. Unarmored it would be 1.
        expect(game.snake.body.length).toBe(3);
        expect(game.state.gameState).not.toBe('DEAD');
    });

    it('running the head into your own body is a self-collision death', () => {
        // The old "bite your own tail to open the shop" mechanic is gone — the tail is
        // now 2-Bit's seat, and a self-hit is a normal Snake death.
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.snake.body = [
            { x: 100, y: 120 }, // head
            { x: 100, y: 100 }, // moving up drives the head onto THIS cell
            { x: 80, y: 100 },
            { x: 80, y: 120 },
        ];
        game.input.direction = { x: 0, y: -20 };

        game.update(500);

        expect(game.state.gameState).toBe('DEAD');
    });
    
    it('persists hub room state upon death', () => {
        game.state.gameState = 'PLAYING';
        game.state.unlocked.firstEncounter = true;
        game.worldManager.currentRoomX = 1; // move away from hub
        
        game.die('obstacle');
        
        expect(game.state.gameState).toBe('DEAD');
        expect(game.worldManager.currentRoomX).toBe(0); // returned to hub
    });
});
