import { AudioEngine } from './Audio.js';
import { StateManager } from '../state/StateManager.js';

export class GameEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.lastTime = performance.now();
        
        // Systems
        this.audio = new AudioEngine();
        this.state = new StateManager();
        
        // Minimalist Snake State
        this.gridSize = 20; // 20x20 pixels per grid cell
        
        // Start center screen
        this.snake = [
            { x: Math.floor(canvas.width / 2 / this.gridSize) * this.gridSize, 
              y: Math.floor(canvas.height / 2 / this.gridSize) * this.gridSize }
        ];
        
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.speed = 100; // ms per move
        this.moveTimer = 0;
        
        this.apple = this.spawnApple();
        
        // Input handling
        window.addEventListener('keydown', (e) => this.handleInput(e));
        
        // Upgrade Handling
        document.getElementById('btn-speed').addEventListener('click', () => {
            if (this.state.score >= 10) {
                this.state.score -= 10;
                this.speed = Math.max(20, this.speed - 15);
                this.audio.playBeep(); // distinct upgrade sound could be added
                document.getElementById('score-value').innerText = this.state.score;
            }
        });
    }
    
    spawnApple() {
        // In Phase 1 Void, apple can spawn anywhere on the infinite screen grid
        const cols = Math.floor(this.canvas.width / this.gridSize);
        const rows = Math.floor(this.canvas.height / this.gridSize);
        
        return {
            x: Math.floor(Math.random() * cols) * this.gridSize,
            y: Math.floor(Math.random() * rows) * this.gridSize
        };
    }
    
    handleInput(e) {
        // Only allow changing direction if we actually started moving, or to initiate movement
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
                if (this.direction.y === 0) this.nextDirection = { x: 0, y: -this.gridSize };
                break;
            case 'ArrowDown':
            case 's':
                if (this.direction.y === 0) this.nextDirection = { x: 0, y: this.gridSize };
                break;
            case 'ArrowLeft':
            case 'a':
                if (this.direction.x === 0) this.nextDirection = { x: -this.gridSize, y: 0 };
                break;
            case 'ArrowRight':
            case 'd':
                if (this.direction.x === 0) this.nextDirection = { x: this.gridSize, y: 0 };
                break;
        }
        
        // Initialize audio on first user interaction (browser policy requirement)
        this.audio.init();
    }
    
    update(dt) {
        this.moveTimer += dt;
        
        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            
            // Only move if we have a direction
            if (this.nextDirection.x !== 0 || this.nextDirection.y !== 0) {
                this.direction = { ...this.nextDirection };
                
                const head = { ...this.snake[0] };
                head.x += this.direction.x;
                head.y += this.direction.y;
                
                // Unfolding Mechanic: Initially, screen wraps (no borders)
                if (!this.state.unlocked.borders) {
                    if (head.x < 0) head.x = Math.floor(this.canvas.width / this.gridSize) * this.gridSize - this.gridSize;
                    if (head.x >= this.canvas.width) head.x = 0;
                    if (head.y < 0) head.y = Math.floor(this.canvas.height / this.gridSize) * this.gridSize - this.gridSize;
                    if (head.y >= this.canvas.height) head.y = 0;
                } else {
                    // Borders are unlocked, we can die to them.
                    if (head.x < 0 || head.x >= this.canvas.width || head.y < 0 || head.y >= this.canvas.height) {
                        this.die();
                        return;
                    }
                }
                
                this.snake.unshift(head);
                
                // Check apple collision
                if (head.x === this.apple.x && head.y === this.apple.y) {
                    this.state.addScore(1);
                    this.audio.playBeep();
                    this.apple = this.spawnApple();
                    this.checkUnlocks();
                } else {
                    this.snake.pop(); // Remove tail if we didn't eat
                }
                
                // Check self collision
                for (let i = 1; i < this.snake.length; i++) {
                    if (head.x === this.snake[i].x && head.y === this.snake[i].y) {
                        this.die();
                        return;
                    }
                }
            }
        }
    }
    
    die() {
        this.audio.playDeath();
        this.snake = [this.snake[0]]; // Retain head
        this.direction = {x: 0, y: 0};
        this.nextDirection = {x: 0, y: 0};
        this.state.resetScore();
    }
    
    checkUnlocks() {
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
        // Clear screen (The Void)
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Neon Glow effect
        this.ctx.shadowBlur = 15;
        
        if (this.state.unlocked.borders) {
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#00ffcc';
            this.ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
        }
        
        // Draw Apple (Red Data)
        this.ctx.fillStyle = '#ff0055';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.fillRect(this.apple.x + 2, this.apple.y + 2, this.gridSize - 4, this.gridSize - 4);
        
        // Draw Snake (White Program)
        this.ctx.fillStyle = '#ffffff';
        this.ctx.shadowColor = '#ffffff';
        for (const segment of this.snake) {
            this.ctx.fillRect(segment.x + 1, segment.y + 1, this.gridSize - 2, this.gridSize - 2);
        }
        
        // Reset shadow for performance on non-glowing elements if we add them
        this.ctx.shadowBlur = 0;
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
