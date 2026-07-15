import { NPC } from '../entities/NPC.js';
import { Glitch } from '../entities/Glitch.js';

export class RoomGenerator {
    constructor(gridSize, canvasWidth, canvasHeight) {
        this.gridSize = gridSize;
        this.cols = Math.floor(canvasWidth / gridSize);
        this.rows = Math.floor(canvasHeight / gridSize);
    }
    
    generateRoom(roomX, roomY, stateUnlocked) {
        let obstacles = [];
        let glitches = [];
        let npcs = [];
        let apple = null;
        
        const cx = Math.floor(this.cols / 2) * this.gridSize;
        const cy = Math.floor(this.rows / 2) * this.gridSize;
        
        const isSafeZone = (x, y) => {
            const midX = Math.floor(this.cols / 2) * this.gridSize;
            const midY = Math.floor(this.rows / 2) * this.gridSize;
            const isYCenter = Math.abs(y - midY) <= this.gridSize;
            const isXCenter = Math.abs(x - midX) <= this.gridSize;
            
            // 4-block clear path from all door entrances
            if (isYCenter && (x < this.gridSize * 5 || x > this.cols * this.gridSize - this.gridSize * 6)) return true;
            if (isXCenter && (y < this.gridSize * 5 || y > this.rows * this.gridSize - this.gridSize * 6)) return true;
            return false;
        };
        
        if (roomX === 0 && roomY === 0) {
            // Hub: No obstacles
        } else if (roomX === 3 && roomY === 0) {
            // Gate Encounter Room
            npcs.push(new NPC(cx, cy, this.gridSize, 'gate', [
                "HALT! UNAUTHORIZED SECTOR BREACH!",
                "I am Gate, Firewall Division.",
                "You are a Level 1 Anomaly. The Architect's isolation protocol demands your immediate deletion.",
                "Initiating Thread Suspension..."
            ]));
            
            // Add some pillar obstacles in corners to make a small arena
            const oCols = [10, this.cols - 10];
            const oRows = [8, this.rows - 8];
            for (let c of oCols) {
                for (let r of oRows) {
                    let ox = c * this.gridSize;
                    let oy = r * this.gridSize;
                    if (!isSafeZone(ox, oy)) obstacles.push({ x: ox, y: oy });
                }
            }
        } else {
            // Random Templates
            const templateType = Math.floor(Math.random() * 3);
            
            if (templateType === 0) {
                // The Cross Maze (Less aggressive)
                for (let i = 10; i < this.cols - 10; i++) {
                    // Leave a 5-tile gap in the middle instead of 3
                    if (i < Math.floor(this.cols / 2) - 2 || i > Math.floor(this.cols / 2) + 2) {
                        let ox = i * this.gridSize;
                        let oy = cy;
                        if (!isSafeZone(ox, oy)) obstacles.push({ x: ox, y: oy });
                    }
                }
                for (let j = 5; j < this.rows - 5; j++) {
                    // Leave a 5-tile gap in the middle instead of 3
                    if (j < Math.floor(this.rows / 2) - 2 || j > Math.floor(this.rows / 2) + 2) {
                        let ox = cx;
                        let oy = j * this.gridSize;
                        if (!isSafeZone(ox, oy)) obstacles.push({ x: ox, y: oy });
                    }
                }
            } else if (templateType === 1) {
                // The Pillars
                for (let i = 8; i < this.cols - 8; i += 4) {
                    for (let j = 6; j < this.rows - 6; j += 4) {
                        let ox = i * this.gridSize;
                        let oy = j * this.gridSize;
                        if (!isSafeZone(ox, oy)) obstacles.push({ x: ox, y: oy });
                    }
                }
            } else if (templateType === 2) {
                // Glitch Minefield
                let ox1 = cx - 4*this.gridSize;
                let oy1 = cy - 4*this.gridSize; // Moved up to avoid center line
                let ox2 = cx + 4*this.gridSize;
                let oy2 = cy + 4*this.gridSize; // Moved down to avoid center line
                
                if (!isSafeZone(ox1, oy1)) obstacles.push({ x: ox1, y: oy1 });
                if (!isSafeZone(ox2, oy2)) obstacles.push({ x: ox2, y: oy2 });
                
                if (stateUnlocked && stateUnlocked.firstEncounter) {
                    for (let k = 0; k < 5; k++) {
                        let gx = Math.floor(Math.random() * this.cols) * this.gridSize;
                        let gy = Math.floor(Math.random() * this.rows) * this.gridSize;
                        glitches.push(new Glitch(gx, gy, this.gridSize));
                    }
                }
            }
        }
        
        // Always spawn one apple
        apple = this.spawnValidApple(obstacles, glitches, npcs);
        
        return { apple, glitches, npcs, obstacles };
    }
    
    spawnValidApple(obstacles, glitches, npcs) {
        let valid = false;
        let x, y;
        while (!valid) {
            x = Math.floor(Math.random() * this.cols) * this.gridSize;
            y = Math.floor(Math.random() * this.rows) * this.gridSize;
            
            valid = true;
            for (let obs of obstacles) {
                if (obs.x === x && obs.y === y) valid = false;
            }
            for (let g of glitches) {
                if (g.x === x && g.y === y) valid = false;
            }
            for (let n of npcs) {
                if (n.x === x && n.y === y) valid = false;
            }
        }
        return { x, y };
    }
}
