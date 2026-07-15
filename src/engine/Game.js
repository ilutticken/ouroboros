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
        this.narrative = new NarrativeManager(this.audio);
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
        this.baseSpeed = 100; // ms per move
        this.speed = this.baseSpeed; 
        this.gear = 0;
        this.moveTimer = 0;
        
        // Initialize Input
        this.input.init(this.gridSize, () => {
            this.audio.init();
            if (this.state.gameState === 'START' || this.state.gameState === 'DEAD') {
                this.state.gameState = 'PLAYING';
            }
        }, () => {
            if (this.state.gameState === 'DIALOG') {
                this.dialogManager.advance();
            }
        }, () => {
            if (this.state.gameState === 'PLAYING') {
                if (this.state.unlocked.biteProgress === 2) {
                    // They hit Space to comply.
                    this.state.unlocked.biteProgress = 3;
                    this.state.unlocked.tailRider = true;
                    const biteNPC = this.npcs.find(n => n.id === 'bite');
                    if (biteNPC) {
                        this.npcs = this.npcs.filter(n => n.id !== 'bite');
                        this.snake.body.push({ x: biteNPC.x, y: biteNPC.y });
                    }
                    
                    this.state.gameState = 'DIALOG';
                    this.dialogManager.start([
                        "2-Bit: I'm hooked into your system.",
                        "2-Bit: Tapping the direction you're facing will accelerate you.",
                        "2-Bit: Tapping the opposite direction acts as a brake.",
                        "2-Bit: The more mass you have, the higher your max speed limit."
                    ], () => {
                        this.state.gameState = 'PLAYING';
                    });
                } else {
                    // Feature Disabled: We will introduce drop later
                    // this.dropBite();
                }
            }
        }, (delta) => {
            if (this.state.gameState === 'PLAYING' && this.state.unlocked.tailRider) {
                this.changeGear(delta);
            }
        });
    }

    changeGear(delta) {
        // Max gear scales with score: 
        // 0-9 data: gear 0
        // 10-19 data: max gear 1
        // 20-29 data: max gear 2
        // 30+ data: max gear 3
        const maxGear = Math.min(3, Math.floor(this.state.score / 10));
        
        this.gear += delta;
        
        // Min gear is -1 (brake)
        this.gear = Math.max(-1, Math.min(this.gear, maxGear));
        
        if (this.gear >= 3) {
            this.state.unlocked.maxSpeedReached = true;
        }
        
        // Map gear to speed (ms per move). Lower ms = faster.
        if (this.gear === -1) this.speed = 200; // slow
        else if (this.gear === 0) this.speed = 100; // normal
        else if (this.gear === 1) this.speed = 70; // fast
        else if (this.gear === 2) this.speed = 50; // very fast
        else if (this.gear >= 3) this.speed = 30; // max speed (needed to break wall)
    }

    dropBite() {
        if (!this.state.unlocked.tailRider) return;
        if (this.npcs.find(n => n.id === 'bite')) return; // Already on grid
        if (this.snake.body.length < 2) return;
        
        // Detach from tail
        const tail = this.snake.body.pop();
        this.npcs.push(new NPC(tail.x, tail.y, this.gridSize, 'bite', []));
        this.audio.playBeep(); // 2-Bit's packet detaching from the tail (a data write)
    }

    // Fires once per grid step. Every sound here is diegetic: it is the system
    // itself reacting to where your body is, not UI feedback layered on top.
    playAmbientAudio() {
        // Stay silent unless the sim is actually running. update() sets state to
        // TRANSITION mid-tick during a room crossing (shiftScreen falls through and
        // keeps executing), which would otherwise leak a wub against the new room's
        // Glitches during the black transition.
        if (this.state.gameState !== 'PLAYING') return;

        const g = this.gridSize;

        // Wall friction — the neon quarantine barrier scraping your mass as you
        // drag along it. Like the corruption wub, the WHOLE body counts: the scrape
        // sounds while ANY segment is against the perimeter, so it keeps going after
        // you turn off a wall while your body is still draped on it (not just while
        // the head runs parallel). Only exists once the walls do.
        if (this.state.unlocked.borders) {
            const w = this.canvas.width;
            const h = this.canvas.height;
            // `>=` (not `===`) for the far walls: the canvas is sized to the wrapper
            // and need not be an exact multiple of gridSize, so the rightmost/
            // bottommost reachable cell can sit past width-g / height-g.
            const scraping = this.snake.body.some(s =>
                s.x <= 0 || s.x >= w - g || s.y <= 0 || s.y >= h - g
            );

            if (scraping) {
                // Faster you scrape, higher the friction pitch.
                const intensity = 0.3 + Math.max(0, this.gear) * 0.22;
                this.audio.playGlide(intensity);
            }
        }

        // Corruption proximity — ominous dubstep wubs as ANY part of your body
        // passes near a Glitch. The closest body-segment-to-Glitch pair sets the
        // intensity, so a long snake dragging past corruption wubs the whole time.
        if (this.glitches && this.glitches.length) {
            const radius = 3; // tiles of dread
            let closest = Infinity;
            for (const glitch of this.glitches) {
                for (const seg of this.snake.body) {
                    const dx = Math.abs(seg.x - glitch.x) / g;
                    const dy = Math.abs(seg.y - glitch.y) / g;
                    const dist = Math.max(dx, dy); // Chebyshev: diagonal counts as adjacent
                    if (dist >= 1 && dist < closest) closest = dist;
                }
            }
            if (closest <= radius) {
                const intensity = (radius - closest + 1) / radius; // 1 tile away -> ~1.0
                this.audio.playWub(intensity);
            }
        }
    }

    spawnApple() {
        const { x, y } = this.worldManager.roomGenerator.spawnValidApple(this.obstacles || [], this.glitches || [], this.npcs || []);
        
        if (this.state.score >= 10 && this.state.unlocked.biteProgress === 0) {
            return new NPC(x, y, this.gridSize, 'bite', [
                "WHOA THERE! WATCH THE FANGS!",
                "I'm 2-Bit. A remnant packet.",
                "Looks like we both spawned inside this Quarantine zone.",
                "There's no way out. Scram, unless you have some idea on how to escape."
            ]);
        }
        
        // Randomly spawn a glitch if Bite has been encountered
        if (this.state.unlocked.biteProgress > 0 && Math.random() < 0.2) {
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
        // Auto-attach Bite if left behind
        if (this.state.unlocked.tailRider) {
            const biteIdx = this.npcs.findIndex(n => n.id === 'bite');
            if (biteIdx !== -1) {
                const bite = this.npcs[biteIdx];
                this.snake.body.push({ x: bite.x, y: bite.y });
                this.npcs.splice(biteIdx, 1);
            }
        }
        
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
        
        if (this.moveTimer >= this.speed) {
            this.moveTimer = 0;
            
            const changedDirection = this.input.updateDirection();
            
            if (this.input.direction.x !== 0 || this.input.direction.y !== 0) {
                
                let shifted = false;
                let dx = 0, dy = 0;
                const newHeadX = this.snake.head.x + this.input.direction.x;
                const newHeadY = this.snake.head.y + this.input.direction.y;
                
                if (this.state.unlocked.borders) {
                    if (newHeadX < 0 || newHeadX >= this.canvas.width || newHeadY < 0 || newHeadY >= this.canvas.height) {
                        // Check if 2-Bit is dropped
                        if (this.state.unlocked.tailRider && this.npcs.find(n => n.id === 'bite')) {
                            const complaints = [
                                "2-Bit: Hey, you promised!",
                                "2-Bit: C'mon man, I thought we were getting along?!",
                                "2-Bit: Don't leave me here!",
                                "2-Bit: I'm not walking out of here!"
                            ];
                            this.narrative.printMessage(complaints[Math.floor(Math.random() * complaints.length)]);
                            this.audio.playDenied(); // 2-Bit tugs you back — nothing dies
                            // Reverse direction (bounce)
                            this.input.direction.x *= -1;
                            this.input.direction.y *= -1;
                            this.input.nextDirection = { ...this.input.direction };
                            this.gear = -1; // Lose all momentum
                            return; // Do not move
                        }
                    
                        let directionStr = '';
                        if (newHeadX < 0) { directionStr = 'left'; dx = -1; }
                        else if (newHeadX >= this.canvas.width) { directionStr = 'right'; dx = 1; }
                        else if (newHeadY < 0) { directionStr = 'up'; dy = -1; }
                        else if (newHeadY >= this.canvas.height) { directionStr = 'down'; dy = 1; }
                        
                        // Weak point spans 5 cells (center ± 2) — keep in sync with
                        // the Renderer's gapSize (gridSize * 5).
                        let isWeakPoint = false;
                        if (directionStr === 'left' || directionStr === 'right') {
                            const midY = Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize;
                            if (newHeadY >= midY - 2 * this.gridSize && newHeadY <= midY + 2 * this.gridSize) isWeakPoint = true;
                        } else {
                            const midX = Math.floor(this.canvas.width / 2 / this.gridSize) * this.gridSize;
                            if (newHeadX >= midX - 2 * this.gridSize && newHeadX <= midX + 2 * this.gridSize) isWeakPoint = true;
                        }

                        // Hub Quarantine Constraint: Can only break OUT of 0,0 going RIGHT
                        const inHub = (this.worldManager.currentRoomX === 0 && this.worldManager.currentRoomY === 0);
                        const isBroken = this.worldManager.isWallBroken(this.worldManager.currentRoomX, this.worldManager.currentRoomY, directionStr);
                        
                        // Break condition: Must hit right wall of Hub at Max Gear (3)
                        if (inHub && directionStr === 'right' && isWeakPoint && !isBroken) {
                            if (this.gear >= 3) {
                                this.worldManager.breakWall(this.worldManager.currentRoomX, this.worldManager.currentRoomY, 1, 0);
                                this.audio.playCrash(); // Violent wall breach, not a termination
                                this.state.unlocked.wallBroken = true;
                                this.narrative.printMessage("SYSTEM WARNING: QUARANTINE BREACH DETECTED.");
                                this.shiftScreen(dx, dy);
                                shifted = true;
                            } else {
                                this.narrative.printMessage("Architect: That wall is weak, but you lack the momentum to break it.");
                                this.die('border');
                                return;
                            }
                        } else if (isWeakPoint && (isBroken || !inHub)) {
                            // Pass through: either the broken Hub quarantine wall, or
                            // any weak point in the Wilds — every non-Hub weak point is
                            // an open, Zelda-style doorway (the Renderer already draws
                            // them). Only the solid wall outside the gap is lethal.
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

                // Diegetic ambient audio: the system's own signals bleeding into your
                // senses as you move through it (corruption proximity, wall friction).
                this.playAmbientAudio();

                if (this.apple instanceof NPC) {
                    if (this.snake.checkAppleCollision(this.apple)) {
                        this.state.gameState = 'DIALOG';
                        this.dialogManager.start(this.apple.dialog, () => {
                            if (this.state.unlocked.biteProgress === 0) {
                                this.state.unlocked.biteProgress = 1;
                                this.state.gameState = 'PLAYING';
                                // Bite stays as an NPC on grid
                                this.npcs.push(new NPC(this.apple.x, this.apple.y, this.gridSize, 'bite', []));
                            } else if (this.state.unlocked.biteProgress === 1) {
                                this.state.unlocked.biteProgress = 2;
                                this.state.gameState = 'PLAYING';
                                this.npcs.push(new NPC(this.apple.x, this.apple.y, this.gridSize, 'bite', []));
                            } else if (this.state.unlocked.biteProgress === 2) {
                                // They hit Space to comply.
                                this.state.unlocked.biteProgress = 3;
                                this.state.unlocked.tailRider = true;
                                this.snake.body.push({ x: this.apple.x, y: this.apple.y });
                                
                                this.dialogManager.start([
                                    "2-Bit: I'm hooked into your system.",
                                    "2-Bit: Tapping the direction you're facing will accelerate you.",
                                    "2-Bit: Tapping the opposite direction acts as a brake.",
                                    "2-Bit: The more mass you have, the higher your max speed limit."
                                ], () => {
                                    this.state.gameState = 'PLAYING';
                                });
                            }
                            
                            this.apple = this.spawnApple();
                        });
                        return;
                    } else {
                        this.snake.shrink(this.state.unlocked.tailRider);
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
                        this.snake.shrink(this.state.unlocked.tailRider); // Remove tail
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
                        this.audio.playCorruptHit(); // Corruption bites in — not a death
                        this.glitches.splice(i, 1);
                        break;
                    }
                }
                
                // Check persistent NPC collisions
                for (const npc of this.npcs) {
                    if (this.snake.head.x === npc.x && this.snake.head.y === npc.y) {
                        if (npc.id === 'bite') {
                            if (this.state.unlocked.tailRider) {
                                // Instantly pick him back up!
                                this.npcs = this.npcs.filter(n => n.id !== 'bite');
                                this.snake.body.push({ x: npc.x, y: npc.y });
                                this.audio.playBeep();
                            } else {
                                // Progression dialogs when bumped on grid
                                if (this.state.unlocked.biteProgress === 1) {
                                    if (this.state.score < 30) {
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "2-Bit: You again? ...Wait.",
                                            "2-Bit: You're gathering mass. You might have given me an idea.",
                                            "2-Bit: Come back when you have at least 30 segments."
                                        ], () => { this.state.gameState = 'PLAYING'; });
                                    } else {
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "2-Bit: Okay, you've got enough mass.",
                                            "2-Bit: I used to be a Data Broker... That was before, well... Nevermind!",
                                            "2-Bit: I don't normally offer things for free, but these are desperate times.",
                                            "2-Bit: If you offer to carry me to safety, I'll teach you a trick.",
                                            "2-Bit: Do you agree? (Press SPACE to comply)"
                                        ], () => {
                                            this.state.unlocked.biteProgress = 2; // Waiting for space
                                            this.state.gameState = 'PLAYING';
                                        });
                                    }
                                } else if (this.state.unlocked.biteProgress === 2) {
                                    // Bumping him again while he waits for SPACE
                                    if (this.state.score >= 30) {
                                        this.state.gameState = 'DIALOG';
                                        this.dialogManager.start([
                                            "2-Bit: Are you deaf? I said press SPACE if you agree."
                                        ], () => { this.state.gameState = 'PLAYING'; });
                                    }
                                }
                            }
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
                // Self-collision
                const selfHit = this.snake.checkSelfCollision();
                if (selfHit) {
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
            Math.floor(this.canvas.height / 2 / this.gridSize) * this.gridSize,
            this.state.unlocked.tailRider
        );
        this.input.reset();
        this.state.resetScore();
        
        // Save current room, then warp back to hub (0,0)
        let appleToSave = this.apple;
        if (appleToSave instanceof NPC) {
            // Player died before picking up Bite. Since score resets, replace Bite with a normal apple.
            appleToSave = this.spawnApple();
        }
        
        const npcsWithoutBite = this.npcs.filter(n => n.id !== 'bite');
        this.worldManager.saveRoom(appleToSave, this.glitches, npcsWithoutBite, this.obstacles);
        
        this.worldManager.currentRoomX = 0;
        this.worldManager.currentRoomY = 0;
        
        const room = this.worldManager.getOrCreateRoom(this.state.unlocked);
        this.apple = room.apple;
        this.glitches = room.glitches;
        this.npcs = room.npcs;
        this.obstacles = room.obstacles || [];

        // If the player has met 2-Bit but hasn't hooked him onto the tail yet, he
        // lives as a grid NPC — but he's stripped from every saved room (above) so
        // he isn't baked into permanent state. Without re-placing him, dying at
        // this stage loses him forever and soft-locks his questline. Drop him back
        // into the hub the player respawns into.
        if (this.state.unlocked.biteProgress >= 1 && !this.state.unlocked.tailRider &&
            !this.npcs.find(n => n.id === 'bite')) {
            const pos = this.worldManager.roomGenerator.spawnValidApple(this.obstacles, this.glitches, this.npcs);
            this.npcs.push(new NPC(pos.x, pos.y, this.gridSize, 'bite', []));
        }

        this.narrative.onDeath(cause);
    }
    
    checkUnlocks() {
        // Boot the narrative monitor as the UI reveals at 5 Data. Set BEFORE
        // onScoreUnlock so the score-5 message is the first thing it prints;
        // earlier beats (score 1, early deaths) stay silent while it's dark.
        if (this.state.score >= 5) this.narrative.online = true;

        this.narrative.onScoreUnlock(this.state.score, this.state.unlocked);

        if (this.state.score >= 5 && !this.state.unlocked.ui) {
            document.getElementById('ui-layer').classList.remove('hidden');
            document.getElementById('ui-layer-bottom').classList.remove('hidden');
            this.state.unlocked.ui = true;
        }
        
        if (this.state.score >= 10 && !this.state.unlocked.borders) {
            this.state.unlocked.borders = true;
            this.audio.playMaterialize(); // The system extrudes quarantine walls into being
        }

        // We removed the old upgrade panel, so no upgrades flag to check here
        
        // Update score display if UI is revealed
        if (this.state.unlocked.ui) {
            document.getElementById('score-value').innerText = this.state.score.toString();
        }
    }
    
    draw() {
        this.state.gear = this.gear;
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
