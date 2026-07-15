export class Renderer {
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
    }
    
    draw(state, snake, apple, npcs, glitches, worldManager, obstacles) {
        // Clear screen (The Void)
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Neon Glow effect
        this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
        
        if (state.unlocked.borders) {
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.lineWidth = 4;
            this.ctx.shadowColor = '#00ffcc';
            this.ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
            
            // Draw weak points (Orange pulsing)
            const pulse = Math.abs(Math.sin(Date.now() / 200));
            this.ctx.strokeStyle = `rgba(255, 100, 0, ${0.5 + pulse * 0.5})`;
            this.ctx.shadowColor = '#ff6600';
            
            const gapSize = this.gridSize * 5;
            const cx = this.canvas.width / 2;
            const cy = this.canvas.height / 2;
            
            // Draw gap indicators (Weak points)
            if (state.unlocked.borders) {
                const inHub = worldManager && worldManager.currentRoomX === 0 && worldManager.currentRoomY === 0;
                this.ctx.beginPath();
                
                if (!inHub) {
                    // Up
                    this.ctx.moveTo(cx - gapSize/2, 2);
                    this.ctx.lineTo(cx + gapSize/2, 2);
                    // Down
                    this.ctx.moveTo(cx - gapSize/2, this.canvas.height - 2);
                    this.ctx.lineTo(cx + gapSize/2, this.canvas.height - 2);
                    // Left
                    this.ctx.moveTo(2, cy - gapSize/2);
                    this.ctx.lineTo(2, cy + gapSize/2);
                }
                
                if (!inHub || state.unlocked.wallBroken) {
                    // Right
                    this.ctx.moveTo(this.canvas.width - 2, cy - gapSize/2);
                    this.ctx.lineTo(this.canvas.width - 2, cy + gapSize/2);
                }
                this.ctx.stroke();
            }
            
            // Draw broken walls (black gaps)
            if (worldManager) {
                this.ctx.fillStyle = '#050505';
                this.ctx.shadowBlur = 0;
                
                if (worldManager.isWallBroken(worldManager.currentRoomX, worldManager.currentRoomY, 'up')) {
                    this.ctx.fillRect(cx - gapSize/2, 0, gapSize, 4);
                }
                if (worldManager.isWallBroken(worldManager.currentRoomX, worldManager.currentRoomY, 'down')) {
                    this.ctx.fillRect(cx - gapSize/2, this.canvas.height - 4, gapSize, 4);
                }
                if (worldManager.isWallBroken(worldManager.currentRoomX, worldManager.currentRoomY, 'left')) {
                    this.ctx.fillRect(0, cy - gapSize/2, 4, gapSize);
                }
                
                const rightBroken = worldManager.isWallBroken(worldManager.currentRoomX, worldManager.currentRoomY, 'right');
                if (rightBroken) {
                    this.ctx.fillRect(this.canvas.width - 4, cy - gapSize/2, 4, gapSize);
                } else if (worldManager.currentRoomX === 0 && worldManager.currentRoomY === 0) {
                    // Quarantine Cracked Wall indicator
                    this.ctx.fillStyle = '#ffaa00'; // Yellowish crack
                    this.ctx.shadowColor = '#ffaa00';
                    this.ctx.fillRect(this.canvas.width - 4, cy - gapSize/2, 4, gapSize);
                    
                    // Reset back to normal border color
                    this.ctx.fillStyle = '#00ffff'; 
                    this.ctx.shadowColor = '#00ffff';
                }
                this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
            }
        }
        
        // Draw Obstacles (Solid Green)
        if (obstacles) {
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.shadowColor = '#00ffcc';
            for (const obs of obstacles) {
                this.ctx.fillRect(obs.x + 1, obs.y + 1, this.gridSize - 2, this.gridSize - 2);
            }
        }
        
        // Draw Glitches (Magenta)
        if (glitches) {
            this.ctx.fillStyle = '#ff00ff';
            this.ctx.shadowColor = '#ff00ff';
            for (const g of glitches) {
                this.ctx.fillRect(g.x + 2, g.y + 2, this.gridSize - 4, this.gridSize - 4);
            }
        }
        
        // Draw Apple (Red Data)
        this.ctx.fillStyle = '#ff0055';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.fillRect(apple.x + 2, apple.y + 2, this.gridSize - 4, this.gridSize - 4);
        
        // Draw persistent NPCs
        if (npcs) {
            for (const npc of npcs) {
                if (npc.id === 'gate') {
                    this.ctx.fillStyle = '#0088ff';
                    this.ctx.shadowColor = '#0088ff';
                } else {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.shadowColor = '#00ff00';
                }
                this.ctx.fillRect(npc.x + 2, npc.y + 2, this.gridSize - 4, this.gridSize - 4);
            }
        }
        
        // Draw Snake
        for (let i = 0; i < snake.body.length; i++) {
            const segment = snake.body[i];
            
            const biteOnGrid = npcs && npcs.some(n => n.id === 'bite');
            if (i === snake.body.length - 1 && state.unlocked.tailRider && !biteOnGrid) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.shadowColor = '#00ff00';
                
                if (state.unlocked.maxSpeedReached) {
                    const gearGlow = Math.max(1, state.gear || 0); // Base glow of 1, ramps up to 3
                    this.ctx.shadowBlur = gearGlow * 10;
                } else {
                    this.ctx.shadowBlur = 0;
                }
            } else {
                if (i === 0) {
                    this.ctx.fillStyle = '#ffffff';
                } else {
                    this.ctx.fillStyle = '#ff0055';
                }
                this.ctx.shadowBlur = 0;
            }
            this.ctx.fillRect(segment.x + 1, segment.y + 1, this.gridSize - 2, this.gridSize - 2);
        }
        
        // Reset shadow for performance
        this.ctx.shadowBlur = 0;
        
        // Pause Overlay
        if (state.isSuspended || state.gameState === 'PAUSED') {
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 6;
            this.ctx.strokeRect(10, 10, this.canvas.width - 20, this.canvas.height - 20);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '16px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("=== SYSTEM DIAGNOSTIC ===", this.canvas.width / 2, 60);
            
            this.ctx.fillStyle = '#ff0000';
            this.ctx.font = '24px "Press Start 2P", monospace';
            this.ctx.fillText("THREAD SUSPENDED", this.canvas.width / 2, this.canvas.height / 2);
            
            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '12px "Press Start 2P", monospace';
            
            const pulse = Math.floor(Date.now() / 500) % 2 === 0;
            if (pulse) {
                this.ctx.fillText("PRESS [ESC] TO RESUME", this.canvas.width / 2, this.canvas.height - 60);
            }
        }
    }
}
