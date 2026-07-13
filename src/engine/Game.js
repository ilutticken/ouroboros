import { AudioEngine } from './Audio.js';
import { StateManager } from '../state/StateManager.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { Snake } from '../entities/Snake.js';
import { NarrativeManager } from '../systems/NarrativeManager.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gridSize = 20; // 20x20 pixels per grid cell
        
        // Systems
        this.audio = new AudioEngine();
        this.state = new StateManager();
        this.renderer = new Renderer(canvas, this.gridSize);
        this.input = new InputHandler();
        this.narrative = new NarrativeManager();
        
        // Entites
        this.snake = new Snake(
            Math.floor(canvas.width / 2 / this.gridSize) * this.gridSize,
            Math.floor(canvas.height / 2 / this.gridSize) * this.gridSize,
            this.gridSize
        );
        this.apple = this.spawnApple();
        
        // Game State Variables
        this.lastTime = performance.now();
        this.speed = 100; // ms per move
        this.moveTimer = 0;
        
        // Initialize Input
        this.input.init(this.gridSize, () => this.audio.init());
        
        // Upgrade Handling
        document.getElementById('btn-speed').addEventListener('click', () => {
            if (this.state.score >= 10) {
                this.state.score -= 10;
                this.speed = Math.max(20, this.speed - 15);
                this.audio.playBeep(); 
                document.getElementById('score-value').innerText = this.state.score;
            }
        });
    }
    
    spawnApple() {
        const cols = Math.floor(this.canvas.width / this.gridSize);
        const rows = Math.floor(this.canvas.height / this.gridSize);
        return {
            x: Math.floor(Math.random() * cols) * this.gridSize,
            y: Math.floor(Math.random() * rows) * this.gridSize
        };
    }
    
    update(dt) {
        this.moveTimer += dt;
        
        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            
            const changedDirection = this.input.updateDirection();
            
            if (this.input.direction.x !== 0 || this.input.direction.y !== 0) {
                
                const alive = this.snake.move(
                    this.input.direction,
                    this.canvas.width,
                    this.canvas.height,
                    this.state.unlocked.borders
                );
                
                if (!alive) {
                    this.die();
                    return;
                }
                
                if (this.snake.checkAppleCollision(this.apple)) {
                    this.snake.grow(); // Logic handled by not shrinking
                    this.state.addScore(1);
                    this.audio.playBeep();
                    this.apple = this.spawnApple();
                    this.checkUnlocks();
                } else {
                    this.snake.shrink(); // Remove tail
                }
                
                if (this.snake.checkSelfCollision()) {
                    this.die();
                    return;
                }
            }
        }
    }
    
    die() {
        this.audio.playDeath();
        this.snake.reset(
            Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize,
            Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize
        );
        this.input.reset();
        this.state.resetScore();
        this.narrative.onDeath();
    }
    
    checkUnlocks() {
        this.narrative.onScoreUnlock(this.state.score);
        
        if (this.state.score >= 5 && !this.state.unlocked.ui) {
            document.getElementById('ui-layer').classList.remove('hidden');
            this.state.unlocked.ui = true;
        }
        
        if (this.state.score >= 10 && !this.state.unlocked.borders) {
            this.state.unlocked.borders = true;
            this.audio.playDeath(); // Dramatic sound for rule change
        }

        if (this.state.score >= 15 && !this.state.unlocked.upgrades) {
            document.getElementById('upgrade-panel').classList.remove('hidden');
            this.state.unlocked.upgrades = true;
        }
        
        // Update score display if UI is revealed
        if (this.state.unlocked.ui) {
            document.getElementById('score-value').innerText = this.state.score;
        }
    }
    
    draw() {
        this.renderer.draw(this.state, this.snake, this.apple);
    }
    
    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        this.update(dt);
        this.draw();
        
        requestAnimationFrame((ts) => this.loop(ts));
    }
    
    start() {
        this.lastTime = performance.now();
        requestAnimationFrame((ts) => this.loop(ts));
    }
}
