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
            const W = this.canvas.width;
            const H = this.canvas.height;

            // A weak point occupies [wp.start, wp.end] cell top-lefts (5 cells); its
            // pixel span is that range plus one cell. Position varies per wall.
            const gapRect = (dir, wp, thick) => {
                const s = wp.start;
                const len = (wp.end - wp.start) + g;
                if (dir === 'up') return [s, 0, len, thick];
                if (dir === 'down') return [s, H - thick, len, thick];
                if (dir === 'left') return [0, s, thick, len];
                return [W - thick, s, thick, len]; // right
            };

            if (worldManager && worldManager.getWeakPoint) {
                const rx = worldManager.currentRoomX;
                const ry = worldManager.currentRoomY;
                const threshold = worldManager.wallBreakThreshold || 3;
                const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 200));

                for (const dir of ['up', 'down', 'left', 'right']) {
                    const wp = worldManager.getWeakPoint(rx, ry, dir);
                    if (!wp) continue; // solid wall — no doorway to draw
                    if (worldManager.isWallBroken(rx, ry, dir)) {
                        // OPEN — punch a black gap through the neon border.
                        this.ctx.shadowBlur = 0;
                        this.ctx.fillStyle = '#050505';
                        this.ctx.fillRect(...gapRect(dir, wp, 4));
                    } else {
                        // CRACK — orange (pristine) -> yellow as it takes sub-max damage
                        // (capped below the break point; only a max-gear hit finishes it).
                        const dmg = worldManager.getWallDamage(rx, ry, dir);
                        const t = Math.min(1, dmg / threshold);
                        const green = Math.floor(100 + t * 155); // 100 -> 255
                        const blue = Math.floor(t * 255);        // 0 -> 255
                        this.ctx.fillStyle = `rgba(255, ${green}, ${blue}, ${0.45 + 0.55 * pulse})`;
                        this.ctx.shadowColor = `rgb(255, ${green}, ${blue})`;
                        this.ctx.shadowBlur = 6 + t * 14;
                        this.ctx.fillRect(...gapRect(dir, wp, 3 + Math.round(t * 5)));
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
        
        // Module Slot (socket you install carried modules into)
        this.drawModuleSlot(state);

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
                } else if (npc.id === 'signpost') {
                    this.ctx.fillStyle = '#ffffff'; // Localhost welcome sign
                    this.ctx.shadowColor = '#ffffff';
                } else if (npc.id === 'mapitem') {
                    this.ctx.fillStyle = '#00ffff'; // a dropped Module (Denny's map)
                    this.ctx.shadowColor = '#00ffff';
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

        // A carried Module rides the tail tip (cyan pip).
        if (state.carriedModule && snake.body.length) {
            const tip = snake.body[snake.body.length - 1];
            this.ctx.fillStyle = '#00ffff';
            this.ctx.shadowColor = '#00ffff';
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(tip.x + 5, tip.y + 5, this.gridSize - 10, this.gridSize - 10);
        }

        // Reset shadow for performance
        this.ctx.shadowBlur = 0;

        // 2-Bit's route map (extra feature)
        this.drawMinimap(worldManager, state);

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

    // The Module Slot — a pulsing dashed socket (bottom-left) you steer your head
    // over and press SPACE to install a carried module. Glows green when carrying.
    drawModuleSlot(state) {
        if (!state.unlocked || !state.unlocked.moduleSlot) return;
        const g = this.gridSize;
        const x = state.moduleSlotX, y = state.moduleSlotY;
        const carrying = !!state.carriedModule;
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 250));
        this.ctx.shadowColor = carrying ? '#00ff88' : '#00ffcc';
        this.ctx.shadowBlur = carrying ? 12 : 4;
        this.ctx.strokeStyle = carrying ? `rgba(0,255,136,${0.6 + pulse * 0.4})` : `rgba(0,255,204,${0.35 + pulse * 0.3})`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([3, 3]);
        this.ctx.strokeRect(x + 2, y + 2, g - 4, g - 4);
        this.ctx.setLineDash([]);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = carrying ? '#00ff88' : '#008866';
        this.ctx.font = '5px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SLOT', x + g / 2, y - 3);
        // Restore the frame-wide neon glow so later draws (apple, NPCs) still glow.
        this.ctx.shadowBlur = (state.unlocked && state.unlocked.maxSpeedReached) ? 15 : 0;
    }

    // 2-Bit's route map (diegetic: a Data Broker's habit) — a small network
    // topology in the corner of visited rooms and the boundaries you've smashed
    // open, with the current room highlighted. Appears once the Topology Map is installed.
    drawMinimap(worldManager, state) {
        if (!worldManager || !state.unlocked.mapModule) return;
        const roomKeys = Object.keys(worldManager.rooms);
        if (roomKeys.length < 2) return;

        const visited = new Set(roomKeys);
        const coords = roomKeys.map(k => k.split(',').map(Number));
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of coords) {
            minX = Math.min(minX, x); maxX = Math.max(maxX, x);
            minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        }
        const cols = maxX - minX + 1, rows = maxY - minY + 1;
        const pad = 6, header = 12, dot = 4, maxBox = 120;
        // Scale the cell down so a big explored span never overflows the corner box.
        const cell = Math.max(4, Math.min(12, Math.floor((maxBox - pad * 2) / Math.max(cols, rows))));
        const mw = cols * cell + pad * 2, mh = rows * cell + pad * 2 + header;
        const ox = this.canvas.width - mw - 10, oy = 10;

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = 'rgba(0, 20, 18, 0.72)';
        this.ctx.fillRect(ox, oy, mw, mh);
        this.ctx.strokeStyle = '#00ffcc';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(ox, oy, mw, mh);
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.font = '7px "Press Start 2P", monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('ROUTE', ox + pad, oy + 9);

        const gx = (x) => ox + pad + (x - minX) * cell + cell / 2;
        const gy = (y) => oy + pad + header + (y - minY) * cell + cell / 2;

        // Edges: smashed-open boundaries between two VISITED rooms (so Gate's
        // pre-visit breach into an un-entered sector doesn't draw off the box).
        // Regex-match the key so negative room coordinates parse correctly.
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 2;
        const keyRe = /^(-?\d+,-?\d+)-(-?\d+,-?\d+)$/;
        for (const wallKey of worldManager.brokenWalls) {
            const m = wallKey.match(keyRe);
            if (!m || !visited.has(m[1]) || !visited.has(m[2])) continue;
            const [ax, ay] = m[1].split(',').map(Number);
            const [bx, by] = m[2].split(',').map(Number);
            this.ctx.beginPath();
            this.ctx.moveTo(gx(ax), gy(ay));
            this.ctx.lineTo(gx(bx), gy(by));
            this.ctx.stroke();
        }

        // Nodes: visited rooms; the current room is white.
        for (const [x, y] of coords) {
            const cur = x === worldManager.currentRoomX && y === worldManager.currentRoomY;
            this.ctx.fillStyle = cur ? '#ffffff' : '#00aa88';
            this.ctx.fillRect(gx(x) - dot / 2, gy(y) - dot / 2, dot, dot);
        }
    }
}
