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
            
            // Weak points & smashed doorways. For each breakable side of THIS room,
            // draw either an "Open" black gap (fully smashed through) or a crack whose
            // colour, thickness, and glow scale with accumulated ram damage.
            const g = this.gridSize;
            const gapSize = g * 5;
            const W = this.canvas.width;
            const H = this.canvas.height;
            // Centre the gap on the SAME grid-aligned weak point the hit test uses
            // (Game.update: midX/Y = floor(dim/2/g)*g), not the raw pixel centre —
            // otherwise on a non-grid-aligned canvas the drawn doorway drifts off
            // the actually-passable cells.
            const cx = Math.floor(W / 2 / g) * g + g / 2;
            const cy = Math.floor(H / 2 / g) * g + g / 2;

            const gapRect = (dir, thick) => {
                if (dir === 'up') return [cx - gapSize / 2, 0, gapSize, thick];
                if (dir === 'down') return [cx - gapSize / 2, H - thick, gapSize, thick];
                if (dir === 'left') return [0, cy - gapSize / 2, thick, gapSize];
                return [W - thick, cy - gapSize / 2, thick, gapSize]; // right
            };

            if (worldManager) {
                const rx = worldManager.currentRoomX;
                const ry = worldManager.currentRoomY;
                const inHub = rx === 0 && ry === 0;
                const threshold = worldManager.wallBreakThreshold || 3;
                // Hub is a sealed quarantine — only its right wall is breakable.
                const dirs = inHub ? ['right'] : ['up', 'down', 'left', 'right'];
                const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 200));

                for (const dir of dirs) {
                    if (worldManager.isWallBroken(rx, ry, dir)) {
                        // OPEN — punch a black gap through the neon border.
                        this.ctx.shadowBlur = 0;
                        this.ctx.fillStyle = '#050505';
                        this.ctx.fillRect(...gapRect(dir, 4));
                    } else {
                        // CRACK — orange (pristine) -> yellow -> white-hot (about to break).
                        const dmg = worldManager.getWallDamage ? worldManager.getWallDamage(rx, ry, dir) : 0;
                        const t = Math.min(1, dmg / threshold);
                        const green = Math.floor(100 + t * 155); // 100 -> 255
                        const blue = Math.floor(t * 255);        // 0 -> 255
                        this.ctx.fillStyle = `rgba(255, ${green}, ${blue}, ${0.45 + 0.55 * pulse})`;
                        this.ctx.shadowColor = `rgb(255, ${green}, ${blue})`;
                        this.ctx.shadowBlur = 6 + t * 14;
                        this.ctx.fillRect(...gapRect(dir, 3 + Math.round(t * 5)));
                    }
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
                } else if (npc.id === 'denny') {
                    this.ctx.fillStyle = '#ffcc00'; // amber clerk
                    this.ctx.shadowColor = '#ffcc00';
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
