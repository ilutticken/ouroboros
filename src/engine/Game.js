import { AudioEngine } from './Audio.js';
import { StateManager } from '../state/StateManager.js';
import { Renderer } from './Renderer.js';
import { InputHandler } from './InputHandler.js';
import { Snake } from '../entities/Snake.js';
import { NarrativeManager } from '../systems/NarrativeManager.js';
import { DialogManager } from '../systems/DialogManager.js';
import { NPC } from '../entities/NPC.js';
import { Glitch } from '../entities/Glitch.js';
import { ShopManager } from '../systems/ShopManager.js';
import { WorldManager } from '../systems/WorldManager.js';

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
        this.dialogManager = new DialogManager();
        this.shopManager = new ShopManager(this.state, this.audio);
        this.worldManager = new WorldManager(canvas.width, canvas.height, this.gridSize);
        
        // Shop callbacks
        this.shopManager.onSpeedUpgradeBought = (level) => {
            this.narrative.onSpeedUpgrade(level);
            this.state.gameState = 'DIALOG';
            let lines = [];
            if (level === 1 && !this.state.unlocked.speed1) {
                lines = ["I'm working on an idea...", "Keep gathering data."];
                this.state.unlocked.speed1 = true;
            } else if (level === 2 && !this.state.unlocked.speed2) {
                lines = ["Almost there.", "If you get a bit faster, we might be able to escape!"];
                this.state.unlocked.speed2 = true;
            } else if (level === 3 && !this.state.unlocked.speed3) {
                lines = ["That's it! Max speed!", "If you find a weak point, RAM THE WALL!", "It's our only way out!"];
                this.state.unlocked.speed3 = true;
            } else {
                this.state.gameState = 'PLAYING';
                return;
            }
            this.dialogManager.start(lines, () => {
                this.state.gameState = 'PLAYING';
            });
        };
        
        // Entites
        this.snake = new Snake(
            Math.floor(canvas.width / 2 / this.gridSize) * this.gridSize,
            Math.floor(canvas.height / 2 / this.gridSize) * this.gridSize,
            this.gridSize
        );
        
        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        
        const btnPlaytest = document.getElementById('btn-playtest');
        if (btnPlaytest) {
            const devAction = () => {
                this.state.addScore(10);
                this.audio.playBeep();
                this.checkUnlocks();
                if (this.state.gameState === 'SHOP') this.shopManager.updateUI();
                document.getElementById('score-value').innerText = this.state.score.toString();
            };
            btnPlaytest.addEventListener('click', devAction);
            window.addEventListener('keydown', (e) => {
                if (e.key === 'p' || e.key === 'P') devAction();
            });
        }
        
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.state.unlocked.pauseMenu) {
                if (this.state.gameState === 'PLAYING') {
                    this.state.gameState = 'PAUSED';
                } else if (this.state.gameState === 'PAUSED') {
                    this.state.gameState = 'PLAYING';
                    if (this.onUnpauseCallback) {
                        this.onUnpauseCallback();
                        this.onUnpauseCallback = null;
                    }
                }
            }
        });
        
        // Game State Variables
        this.lastTime = performance.now();
        this.speed = 100; // ms per move
        this.moveTimer = 0;
        
        // Initialize Input
        this.input.init(this.gridSize, () => this.audio.init(), () => {
            if (this.state.gameState === 'DIALOG') {
                this.dialogManager.advance();
            }
        });
        

    }
    
    spawnApple() {
        const { x, y } = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || []);
        
        if (this.state.score >= 20 && !this.state.unlocked.firstEncounter) {
            return new NPC(x, y, this.gridSize, 'bite', [
                "WHOA THERE! WATCH THE FANGS!",
                "I'm Bite. A remnant packet. I figured out how to hoard Data instead of being eaten.",
                "The Architect put these walls up to keep us in. He's terrified of something.",
                "Let me hitch a ride on your tail! I can sell you some upgrades.",
                "Collect enough Data to grow, then bite my tail block to open my shop!"
            ]);
        }
        
        // Randomly spawn a glitch if Bite has been encountered
        if (this.state.unlocked.firstEncounter && Math.random() < 0.2) {
            if (!this.state.unlocked.glitchesTelegraphed) {
                this.narrative.printMessage("Architect: Deploying memory corruptors. Touch them and you will bleed Data.");
                this.state.unlocked.glitchesTelegraphed = true;
            }
            const gPos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || []);
            this.glitches.push(new Glitch(gPos.x, gPos.y, this.gridSize));
        }
        
        return { x, y };
    }
    
    shiftScreen(dx, dy) {
        // Remove Bite before saving so he isn't baked into the room's permanent state
        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite');
        this.worldManager.saveRoom(this.apple, this.glitches, npcsWithoutBite, this.obstacles);
        
        this.worldManager.shiftRoom(dx, dy);
        this.worldManager.moveBiteTowards(this.worldManager.currentRoomX, this.worldManager.currentRoomY);
        
        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        
        // Inject Bite if he is in this room
        if (this.state.unlocked.firstEncounter && this.worldManager.currentRoomX === this.worldManager.biteRoomX && this.worldManager.currentRoomY === this.worldManager.biteRoomY) {
            let bx = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
            let by = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
            // Temporary fix: Offset Bite slightly inward so he doesn't instantly trigger
            if (dx === 1) { bx = this.gridSize * 4; by = this.snake.head.y; }
            else if (dx === -1) { bx = this.canvas.width - this.gridSize * 5; by = this.snake.head.y; }
            else if (dy === 1) { bx = this.snake.head.x; by = this.gridSize * 4; }
            else if (dy === -1) { bx = this.snake.head.x; by = this.canvas.height - this.gridSize * 5; }
            
            for (const n of this.npcs) {
                if (n.x === bx && n.y === by) {
                    if (dx !== 0) by -= this.gridSize;
                    else bx -= this.gridSize;
                }
            }
            this.npcs.push(new NPC(bx, by, this.gridSize, 'bite', []));
        }
        
        this.state.gameState = 'TRANSITION';
        setTimeout(() => {
            if (this.state.gameState === 'TRANSITION') {
                this.state.gameState = 'PLAYING';
            }
        }, 500);
    }
    
    update(dt) {
        if (this.state.gameState === 'DIALOG' || this.state.gameState === 'SHOP' || this.state.gameState === 'PAUSED' || this.state.gameState === 'TRANSITION') return;
        
        if (this.state.gameState === 'DEAD') {
            return;
        }
        
        this.moveTimer += dt;
        
        const speedTable = [100, 80, 60, 40];
        let currentSpeed = speedTable[this.state.upgrades.speedLevel];
        if (this.state.upgrades.manualBrake && this.input.brakePressed) {
            currentSpeed = Math.max(100, currentSpeed * 2);
        }
        
        if (this.moveTimer >= currentSpeed) {
            this.moveTimer = 0;
            
            const changedDirection = this.input.updateDirection();
            
            if (this.input.direction.x !== 0 || this.input.direction.y !== 0) {
                
                let shifted = false;
                let dx = 0, dy = 0;
                const newHeadX = this.snake.head.x + this.input.direction.x;
                const newHeadY = this.snake.head.y + this.input.direction.y;
                
                if (this.state.unlocked.borders) {
                    if (newHeadX < 0 || newHeadX >= this.canvas.width || newHeadY < 0 || newHeadY >= this.canvas.height) {
                        let directionStr = '';
                        if (newHeadX < 0) { directionStr = 'left'; dx = -1; }
                        else if (newHeadX >= this.canvas.width) { directionStr = 'right'; dx = 1; }
                        else if (newHeadY < 0) { directionStr = 'up'; dy = -1; }
                        else if (newHeadY >= this.canvas.height) { directionStr = 'down'; dy = 1; }
                        
                        let isWeakPoint = false;
                        if (directionStr === 'left' || directionStr === 'right') {
                            const midY = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
                            if (newHeadY >= midY - this.gridSize && newHeadY <= midY + this.gridSize) isWeakPoint = true;
                        } else {
                            const midX = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
                            if (newHeadX >= midX - this.gridSize && newHeadX <= midX + this.gridSize) isWeakPoint = true;
                        }

                        const isBroken = this.worldManager.isWallBroken(this.worldManager.currentRoomX, this.worldManager.currentRoomY, directionStr);
                        
                        if (isWeakPoint && (isBroken || this.state.upgrades.speedLevel === 3)) {
                            if (!isBroken) {
                                let toX = this.worldManager.currentRoomX + dx;
                                let toY = this.worldManager.currentRoomY + dy;
                                this.worldManager.breakWall(this.worldManager.currentRoomX, this.worldManager.currentRoomY, toX, toY);
                                this.audio.playDeath(); // Crash sound
                                
                                if (!this.state.unlocked.wallBroken) {
                                    this.state.unlocked.wallBroken = true;
                                    this.narrative.onWallBreak();
                                }
                            }
                            this.shiftScreen(dx, dy);
                            shifted = true;
                        } else {
                            this.die('border');
                            return;
                        }
                    }
                }
                
                const alive = this.snake.move(
                    this.input.direction,
                    this.canvas.width,
                    this.canvas.height,
                    this.state.unlocked.borders && !shifted
                );
                
                if (!alive) {
                    this.die('border');
                    return;
                }
                
                if (this.obstacles) {
                    for (const obs of this.obstacles) {
                        if (this.snake.head.x === obs.x && this.snake.head.y === obs.y) {
                            this.audio.playDeath();
                            this.die('obstacle');
                            return;
                        }
                    }
                }
                
                if (this.apple instanceof NPC) {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.state.gameState = 'DIALOG';
                        this.dialogManager.start(this.apple.dialog, () => {
                            this.state.unlocked.firstEncounter = true;
                            // Attach Bite to the tail
                            this.snake.body.push({ x: this.apple.x, y: this.apple.y });
                            this.state.gameState = 'PLAYING';
                            this.apple = this.worldManager.getOrCreateRoom(this.state.unlocked).apple;
                        });
                        return;
                    } else {
                        this.snake.shrink(this.state.unlocked.firstEncounter);
                    }
                } else {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.snake.grow(); // Logic handled by not shrinking
                        const gain = this.state.upgrades.dataCompression ? 2 : 1;
                        this.state.addScore(gain);
                        this.audio.playBeep();
                        this.apple = this.spawnApple();
                        this.checkUnlocks();
                    } else {
                        this.snake.shrink(this.state.unlocked.firstEncounter); // Remove tail
                    }
                }
                
                // Check glitch collisions
                for (let i = 0; i < this.glitches.length; i++) {
                    const g = this.glitches[i];
                    if (this.snake.head.x === g.x && this.snake.head.y === g.y) {
                        const damage = this.state.upgrades.reinforcedSegments ? 1 : 3;
                        for (let d = 0; d < damage; d++) {
                            if (this.snake.body.length > 1) {
                                this.snake.shrink();
                            } else {
                                this.die();
                                return;
                            }
                        }
                        this.state.score = Math.max(0, this.state.score - damage);
                        this.audio.playDeath(); // Temp hit sound
                        this.glitches.splice(i, 1);
                        break;
                    }
                }
                
                // Check persistent NPC collisions
                for (const npc of this.npcs) {
                    if (this.snake.head.x === npc.x && this.snake.head.y === npc.y) {
                        if (npc.id === 'bite') {
                            this.state.gameState = 'SHOP';
                            this.shopManager.open(() => {
                                this.state.gameState = 'PLAYING';
                            });
                        } else if (npc.id === 'gate') {
                            this.state.gameState = 'DIALOG';
                            this.dialogManager.start(npc.dialog, () => {
                                // Thread Suspension
                                this.state.isSuspended = true; 
                                this.dialogManager.start([
                                    "Bite: Hey! Leave my best customer alone!",
                                    "Bite: I'm slipping a root-override module into your memory bank.",
                                    "SYSTEM: You received the System Diagnostic Module! (Pause Menu Unlocked)",
                                    "Bite: Use it to break his hold! (Press ESC)"
                                ], () => {
                                    this.state.unlocked.pauseMenu = true;
                                    this.state.gameState = 'PAUSED';
                                    
                                    this.onUnpauseCallback = () => {
                                        this.state.isSuspended = false;
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "Gate: WHAT?!",
                                            "Gate: Root privileges overridden? Impossible!",
                                            "Gate: I must report this anomaly to the Architect!"
                                        ], () => {
                                            this.state.gameState = 'PLAYING';
                                            this.npcs = this.npcs.filter(n => n.id !== 'gate');
                                            this.worldManager.saveRoom(this.apple, this.glitches, this.npcs, this.obstacles);
                                        });
                                    };
                                });
                            });
                        }
                        this.snake.shrink();
                        return;
                    }
                }
                const selfHit = this.snake.checkSelfCollision(this.state.unlocked.firstEncounter);
                if (selfHit === 'BITE') {
                    this.audio.playBeep();
                    // Consume excess data, shrink to 2
                    while (this.snake.body.length > 2) {
                        this.snake.body.splice(1, 1);
                    }
                    this.state.gameState = 'SHOP';
                    this.shopManager.open();
                    return;
                } else if (selfHit) {
                    this.die('self');
                    return;
                }
            }
        }
    }
    
    die(cause = 'unknown') {
        this.state.gameState = 'DEAD';
        this.snake.reset(
            Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize,
            Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize
        );
        this.input.reset();
        this.state.resetScore();
        
        // Save current room, then warp back to hub (0,0)
        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite');
        this.worldManager.saveRoom(this.apple, this.glitches, npcsWithoutBite, this.obstacles);
        
        this.worldManager.currentRoomX = 0;
        this.worldManager.currentRoomY = 0;
        
        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];
        
        this.narrative.onDeath(cause);
    }
    
    checkUnlocks() {
        this.narrative.onScoreUnlock(this.state.score, this.state.unlocked);
        
        if (this.state.score >= 5 && !this.state.unlocked.ui) {
            document.getElementById('ui-layer').classList.remove('hidden');
            document.getElementById('ui-layer-bottom').classList.remove('hidden');
            this.state.unlocked.ui = true;
        }
        
        if (this.state.score >= 10 && !this.state.unlocked.borders) {
            this.state.unlocked.borders = true;
            this.audio.playDeath(); // Dramatic sound for rule change
        }

        // We removed the old upgrade panel, so no upgrades flag to check here
        
        // Update score display if UI is revealed
        if (this.state.unlocked.ui) {
            document.getElementById('score-value').innerText = this.state.score.toString();
        }
    }
    
    draw() {
        this.renderer.draw(this.state, this.snake, this.apple, this.npcs, this.glitches, this.worldManager, this.obstacles);
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
