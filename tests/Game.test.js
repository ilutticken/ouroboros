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
    
    it('spawns regular apple when score is 20 but encounter already triggered', () => {
        game.state.score = 20;
        game.state.unlocked.firstEncounter = true;
        
        const spawned = game.spawnApple();
        expect(spawned).not.toBeInstanceOf(NPC);
    });
    
    it('transitions to DIALOG state on NPC collision and updates firstEncounter inside dialog manager', () => {
        game.state.gameState = 'PLAYING';
        game.state.score = 20;
        game.apple = game.spawnApple(); // spawns Bite
        
        game.snake.reset(game.apple.x - 20, game.apple.y);
        game.input.direction = { x: 20, y: 0 };
        
        // Mock dialog manager to instantly run callback
        const originalStart = game.dialogManager.start;
        game.dialogManager.start = (dialog, cb) => { cb(); };
        
        game.update(500); // trigger move
        
        expect(game.state.gameState).toBe('PLAYING'); // The callback sets it back to playing
        expect(game.state.unlocked.firstEncounter).toBe(true);
        expect(game.snake.body.length).toBe(2); // Bite attached
        
        game.dialogManager.start = originalStart;
    });
    
    it('shop upgrades reduce glitch damage', () => {
        game.state.gameState = 'PLAYING';
        game.state.upgrades.dataCompression = true;
        game.state.score = 10;
        
        const glitch = { x: 100, y: 100, type: 1, damage: 2, size: 20 };
        game.glitches.push(glitch);
        
        game.snake.reset(80, 100);
        game.input.direction = { x: 20, y: 0 };
        
        game.update(500);
        
        expect(game.state.score).toBe(9); // 10 - (2-1) = 9
    });
    
    it('opens shop when hitting Bite on tail', () => {
        game.state.gameState = 'PLAYING';
        game.state.unlocked.firstEncounter = true;
        game.snake.reset(100, 100, true);
        game.snake.body = [
            { x: 100, y: 120 }, // Head will move to 100, 100
            { x: 100, y: 80 },
            { x: 80, y: 80 },
            { x: 80, y: 100 },
            { x: 100, y: 100 } // Bite segment being hit
        ];
        
        game.input.direction = { x: 0, y: -20 };
        
        game.update(500);
        
        expect(game.state.gameState).toBe('SHOP');
        expect(game.snake.body.length).toBe(2); // Shrunk to head + Bite
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
