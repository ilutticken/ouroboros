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
                // Re-assert the frame glow each iteration (drawNpcFeatures zeroes it).
                this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
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
                } else if (npc.id === 'citizen') {
                    this.ctx.fillStyle = '#b98cff'; // a Localhost refugee program
                    this.ctx.shadowColor = '#b98cff';
                } else if (npc.id === 'cadenza') {
                    this.ctx.fillStyle = '#ff66cc'; // the diva — a warm stage-light pink
                    this.ctx.shadowColor = '#ff66cc';
                } else {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.shadowColor = '#00ff00';
                }
                this.ctx.fillRect(npc.x + 2, npc.y + 2, this.gridSize - 4, this.gridSize - 4);
                this.drawNpcFeatures(npc); // little 8-bit face/glyph so they aren't plain dots
            }
        }
        
        // Draw Snake
        const biteOnGrid = npcs && npcs.some(n => n.id === 'bite');
        for (let i = 0; i < snake.body.length; i++) {
            const segment = snake.body[i];
            // 2-Bit rides at state.biteIndex — normally the tail tip, but one cell
            // forward while a Module occupies the tail tip (see GameEngine.biteIndex).
            // -1 means don't draw his face here (he's on the grid, dropped off, etc.).
            const isBite = state.biteIndex >= 0 && i === state.biteIndex && !biteOnGrid;
            if (isBite) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.shadowColor = '#00ff00';
                this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? Math.max(1, state.gear || 0) * 10 : 0;
            } else {
                this.ctx.fillStyle = i === 0 ? '#ffffff' : '#ff0055';
                this.ctx.shadowBlur = 0;
            }
            this.ctx.fillRect(segment.x + 1, segment.y + 1, this.gridSize - 2, this.gridSize - 2);
            // The worm's head has no eyes (it's not a packet); 2-Bit, who IS a packet
            // riding the tail, keeps his.
            if (isBite) this.drawEyes(segment.x, segment.y, '#003b00');
        }

        // A carried Module rides ONE segment behind 2-Bit (state.mapCell), so 2-Bit
        // draws in front of it. Hidden during the install animation (drawn in flight).
        if (state.carriedModule && state.mapCell && !state.moduleLoad) {
            const c = state.mapCell;
            this.ctx.fillStyle = '#00ffff';
            this.ctx.shadowColor = '#00ffff';
            this.ctx.shadowBlur = 8;
            this.ctx.fillRect(c.x + 5, c.y + 5, this.gridSize - 10, this.gridSize - 10);
        }

        // Reset shadow for performance
        this.ctx.shadowBlur = 0;

        // 2-Bit's route map (extra feature)
        this.drawMinimap(worldManager, state);

        // Module install animation (in flight, on top)
        this.drawModuleLoad(state);

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
            // Only prompt ESC when ESC actually resumes — i.e. genuinely PAUSED. During
            // the Gate cutscene (isSuspended but gameState==='DIALOG') ESC is dead, so
            // the blinking "PRESS [ESC] TO RESUME" would be a lie.
            if (pulse && state.gameState === 'PAUSED') {
                this.ctx.fillText("PRESS [ESC] TO RESUME", this.canvas.width / 2, this.canvas.height - 60);
            }
        }

        // Room-crossing wipe: the 500ms TRANSITION freeze renders as black so a sector
        // swap reads as a deliberate load, not a dropped or duplicated frame.
        if (state.gameState === 'TRANSITION') {
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#050505';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Death: the sim is frozen behind this. Dim the last frame (so you see WHERE you
        // died) and prompt a restart, instead of the old silent teleport-to-hub.
        if (state.gameState === 'DEAD') {
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = 'rgba(6, 0, 0, 0.72)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#ff0055';
            this.ctx.font = '20px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('SIGNAL LOST', this.canvas.width / 2, this.canvas.height / 2 - 6);
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.font = '10px "Press Start 2P", monospace';
                this.ctx.fillText('PRESS ANY KEY TO RE-SPAWN', this.canvas.width / 2, this.canvas.height / 2 + 26);
            }
        }

        // Boot: a faint blinking prompt so a player staring at a lone square in the void
        // knows the system is waiting on a keypress. Kept small/dim to preserve the
        // stark A-Dark-Room opening.
        if (state.gameState === 'START' && Math.floor(Date.now() / 600) % 2 === 0) {
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = 'rgba(0, 255, 204, 0.5)';
            this.ctx.font = '9px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('press any key', this.canvas.width / 2, this.canvas.height - 28);
        }
    }

    // Two little eyes on a cell (packets have faces; the worm's head doesn't).
    drawEyes(x, y, color) {
        const g = this.gridSize;
        const s = Math.max(2, Math.round(g / 7)); // eye size
        const ey = y + g * 0.34;
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = color || '#0a0a0a';
        this.ctx.fillRect(x + g * 0.3 - s / 2, ey, s, s);
        this.ctx.fillRect(x + g * 0.7 - s / 2, ey, s, s);
    }

    // Simple 8-bit features per character so NPCs aren't plain squares.
    drawNpcFeatures(npc) {
        const g = this.gridSize, x = npc.x, y = npc.y;
        this.ctx.shadowBlur = 0;
        if (npc.id === 'gate') {
            // a stern firewall visor
            this.ctx.fillStyle = '#00284d';
            this.ctx.fillRect(x + 4, y + g * 0.42, g - 8, Math.max(2, Math.round(g * 0.14)));
        } else if (npc.id === 'mapitem') {
            // a tiny map grid
            this.ctx.fillStyle = '#004a5a';
            this.ctx.fillRect(x + g * 0.42, y + 4, 1.5, g - 8);
            this.ctx.fillRect(x + g * 0.62, y + 4, 1.5, g - 8);
            this.ctx.fillRect(x + 4, y + g * 0.45, g - 8, 1.5);
        } else if (npc.id === 'signpost') {
            // an exclamation on the sign
            this.ctx.fillStyle = '#222222';
            this.ctx.fillRect(x + g / 2 - 1, y + 4, 2, Math.round(g * 0.45));
            this.ctx.fillRect(x + g / 2 - 1, y + Math.round(g * 0.68), 2, 2);
        } else {
            // eyes for bite / denny / citizen / shop (and any friendly program)
            this.drawEyes(x, y, npc.id === 'denny' ? '#4a2c00' : '#0a1a0a');
        }
    }

    // The Module Slot — a pulsing dashed 3x3 socket (bottom-left). Drag your tail
    // into it to auto-load a carried module. Glows green while you're carrying one.
    drawModuleSlot(state) {
        if (!state.unlocked || !state.unlocked.moduleSlot) return;
        const g = this.gridSize;
        const x = state.moduleSlotX, y = state.moduleSlotY, size = g * 3;
        const carrying = !!state.carriedModule;
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 250));
        this.ctx.shadowColor = carrying ? '#00ff88' : '#00ffcc';
        this.ctx.shadowBlur = carrying ? 12 : 4;
        this.ctx.strokeStyle = carrying ? `rgba(0,255,136,${0.6 + pulse * 0.4})` : `rgba(0,255,204,${0.3 + pulse * 0.3})`;
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([4, 4]);
        this.ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
        this.ctx.setLineDash([]);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = carrying ? '#00ff88' : '#008866';
        this.ctx.font = '6px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(carrying ? 'DROP TAIL HERE' : 'SLOT', x + size / 2, y - 4);
        // Restore the frame-wide neon glow so later draws (apple, NPCs) still glow.
        this.ctx.shadowBlur = (state.unlocked && state.unlocked.maxSpeedReached) ? 15 : 0;
    }

    // The two-beat install animation: the module is sucked into the socket (phase 1),
    // then flies up to the HUD corner in a little arc (phase 2).
    drawModuleLoad(state) {
        const ml = state.moduleLoad;
        if (!ml) return;
        const g = this.gridSize;
        const slotCx = state.moduleSlotX + g * 1.5;
        const slotCy = state.moduleSlotY + g * 1.5;
        let cx, cy, size;
        if (ml.phase === 1) {
            const p = Math.min(1, ml.t / 500);
            const sx = ml.fromX + g / 2, sy = ml.fromY + g / 2;
            cx = sx + (slotCx - sx) * p;
            cy = sy + (slotCy - sy) * p;
            size = g * (1 - 0.55 * p); // shrink into the socket
        } else {
            const p = Math.min(1, ml.t / 600);
            const topX = this.canvas.width - 42, topY = 30;
            cx = slotCx + (topX - slotCx) * p;
            cy = slotCy + (topY - slotCy) * p - Math.sin(p * Math.PI) * 30; // arc
            size = g * (0.45 + 0.2 * Math.sin(p * Math.PI));
        }
        this.ctx.shadowColor = '#00ffff';
        this.ctx.shadowBlur = 14;
        this.ctx.fillStyle = '#00ffff';
        this.ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#004a5a';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);
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
        // Floor the panel width so the "ROUTE" header can't overflow the border at the
        // smallest explored span (the earliest the map can be installed = a 2-room span).
        const mw = Math.max(cols * cell + pad * 2, 48), mh = rows * cell + pad * 2 + header;
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

        // Nodes: visited rooms. Safe Zones (Localhost) are a bigger GOLD node so they
        // stand out from the teal Wilds rooms.
        for (const [x, y] of coords) {
            const safe = (x === 5 && y === 0); // Localhost
            this.ctx.fillStyle = safe ? '#ffcc00' : '#00aa88';
            const d = safe ? dot + 3 : dot;
            this.ctx.fillRect(gx(x) - d / 2, gy(y) - d / 2, d, d);
        }
        // The current room gets a white ring on top, so you can always find yourself.
        const px = gx(worldManager.currentRoomX), py = gy(worldManager.currentRoomY);
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        const ring = dot + 6; // larger than the gold safe-zone node so it truly encircles
        this.ctx.strokeRect(px - ring / 2, py - ring / 2, ring, ring);
    }
}
