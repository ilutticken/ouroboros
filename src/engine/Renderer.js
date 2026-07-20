export class Renderer {
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
    }
    
    draw(state, snake, apple, npcs, glitches, worldManager, obstacles) {
        // Reduce-motion (a11y): when on, oscillating pulses hold at a steady value and
        // blinking prompts stay lit — nothing strobes. Threaded through the whole frame.
        const rm = !!state.reduceMotion;
        // Clear screen (The Void)
        this.ctx.fillStyle = '#050505';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Neon Glow effect
        this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
        
        if (state.unlocked.borders) {
            // Walls are drawn a little THICKER for legibility (a11y). Inset by half the
            // thickness so the stroke stays fully on-canvas.
            const wallThickness = 6;
            const inset = wallThickness / 2;
            this.ctx.strokeStyle = '#00ffcc';
            this.ctx.lineWidth = wallThickness;
            this.ctx.shadowColor = '#00ffcc';
            this.ctx.strokeRect(inset, inset, this.canvas.width - wallThickness, this.canvas.height - wallThickness);

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

            // A11y REDUNDANT CODING: a weak wall must read as breakable by more than
            // COLOUR. Punch regular dark notches along the crack so it looks perforated
            // / dashed — a texture the smooth solid wall never has, legible in grayscale
            // and for colour-blind players.
            const drawWeakHatch = (dir, wp, thick) => {
                const horizontal = (dir === 'up' || dir === 'down');
                const [rx0, ry0, rw, rh] = gapRect(dir, wp, thick);
                this.ctx.save();
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#050505';
                const step = Math.max(4, Math.round(g / 3));
                if (horizontal) {
                    for (let x = rx0 + 2; x < rx0 + rw - 1; x += step) this.ctx.fillRect(x, ry0, 2, rh);
                } else {
                    for (let y = ry0 + 2; y < ry0 + rh - 1; y += step) this.ctx.fillRect(rx0, y, rw, 2);
                }
                this.ctx.restore();
            };

            if (worldManager && worldManager.getWeakPoint) {
                const rx = worldManager.currentRoomX;
                const ry = worldManager.currentRoomY;
                const threshold = worldManager.wallBreakThreshold || 3;
                const pulse = rm ? 0.8 : 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 200));

                for (const dir of ['up', 'down', 'left', 'right']) {
                    const wp = worldManager.getWeakPoint(rx, ry, dir);
                    if (!wp) continue; // solid wall — no doorway to draw
                    if (worldManager.isWallBroken(rx, ry, dir)) {
                        // OPEN — punch a full-thickness black gap through the neon border.
                        this.ctx.shadowBlur = 0;
                        this.ctx.fillStyle = '#050505';
                        this.ctx.fillRect(...gapRect(dir, wp, wallThickness));
                        continue;
                    }
                    // HIDDEN until revealed (guided route / ram damage / a Scanner sweep).
                    // An un-revealed weak point renders as plain solid wall — that's the
                    // whole point of the Topology Scanner.
                    if (worldManager.isWeakPointRevealed && !worldManager.isWeakPointRevealed(rx, ry, dir)) continue;

                    // CRACK — orange (pristine) -> yellow as it takes sub-max damage
                    // (capped below the break point; only a max-gear hit finishes it).
                    const dmg = worldManager.getWallDamage(rx, ry, dir);
                    const t = Math.min(1, dmg / threshold);
                    const green = Math.floor(100 + t * 155); // 100 -> 255
                    const blue = Math.floor(t * 255);        // 0 -> 255
                    const thick = wallThickness + Math.round(t * 4);
                    this.ctx.fillStyle = `rgba(255, ${green}, ${blue}, ${0.45 + 0.55 * pulse})`;
                    this.ctx.shadowColor = `rgb(255, ${green}, ${blue})`;
                    this.ctx.shadowBlur = 6 + t * 14;
                    this.ctx.fillRect(...gapRect(dir, wp, thick));
                    drawWeakHatch(dir, wp, thick); // the a11y texture cue (not colour-only)

                    // A FRESH scanner detection (revealed by a sweep, no ram damage yet)
                    // gets a cyan "sonar" outline that fades as the reveal expires.
                    const scan = worldManager.scannerRevealRemaining ? worldManager.scannerRevealRemaining(rx, ry, dir) : 0;
                    if (scan > 0 && dmg === 0) {
                        const sAlpha = Math.min(1, scan / 800) * (0.4 + 0.6 * pulse);
                        this.ctx.save();
                        this.ctx.strokeStyle = `rgba(0, 255, 204, ${sAlpha})`;
                        this.ctx.shadowColor = '#00ffcc';
                        this.ctx.shadowBlur = 10;
                        this.ctx.lineWidth = 2;
                        const [sgx, sgy, sgw, sgh] = gapRect(dir, wp, thick);
                        this.ctx.strokeRect(sgx, sgy, sgw, sgh);
                        this.ctx.restore();
                    }
                }
                this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
            }

            // Cadenza's DIRECTIONAL cue (a11y: her beacon must not be sound-only). In
            // rooms near her sealed sector the wall(s) facing her breathe with her tone,
            // stronger the closer you are — so which way to go is also VISIBLE.
            if (state.cadenzaBeacon) this.drawCadenzaPulse(state.cadenzaBeacon, W, H, rm);
        }
        
        // Draw Obstacles (Solid Green)
        if (obstacles) {
            this.ctx.fillStyle = '#00ffcc';
            this.ctx.shadowColor = '#00ffcc';
            for (const obs of obstacles) {
                this.ctx.fillRect(obs.x + 1, obs.y + 1, this.gridSize - 2, this.gridSize - 2);
            }
        }
        
        // Draw Glitches (Magenta) — with a dark X so corruption reads as a HAZARD by SHAPE,
        // not colour alone (a11y §2.6 redundant coding): distinct from the apple's plain data
        // square even in grayscale / for red-magenta colour-blindness.
        if (glitches) {
            const gg = this.gridSize;
            for (const g of glitches) {
                this.ctx.fillStyle = '#ff00ff';
                this.ctx.shadowColor = '#ff00ff';
                this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
                this.ctx.fillRect(g.x + 2, g.y + 2, gg - 4, gg - 4);
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = '#2a002a';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(g.x + 5, g.y + 5);
                this.ctx.lineTo(g.x + gg - 5, g.y + gg - 5);
                this.ctx.moveTo(g.x + gg - 5, g.y + 5);
                this.ctx.lineTo(g.x + 5, g.y + gg - 5);
                this.ctx.stroke();
            }
            // Restore the frame glow the X-stroke zeroed, so the apple (drawn next) still glows.
            this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
        }

        // Module Slot (socket you install carried modules into)
        this.drawModuleSlot(state);

        // Draw Apple (Red Data)
        this.ctx.fillStyle = '#ff0055';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.fillRect(apple.x + 2, apple.y + 2, this.gridSize - 4, this.gridSize - 4);

        // Cache's spare-data motes (Hub only): small Data pips with a cold archival glow,
        // so they read as HERS and as smaller than the main apple.
        if (state.dataMotes && state.dataMotes.length) {
            const g = this.gridSize;
            const pulse = rm ? 0.8 : 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 300));
            for (const m of state.dataMotes) {
                this.ctx.fillStyle = '#ff2f6b';
                this.ctx.shadowColor = '#cfd8ff';
                this.ctx.shadowBlur = 6 * pulse;
                this.ctx.fillRect(m.x + 6, m.y + 6, g - 12, g - 12);
            }
            this.ctx.shadowBlur = 0;
        }

        // Draw persistent NPCs
        if (npcs) {
            for (const npc of npcs) {
                // Re-assert the frame glow each iteration (drawNpcFeatures zeroes it).
                this.ctx.shadowBlur = state.unlocked.maxSpeedReached ? 15 : 0;
                // Cache's apparition materialises/dissolves — honour her alpha (others = 1).
                this.ctx.globalAlpha = (npc.alpha === undefined) ? 1 : Math.max(0, Math.min(1, npc.alpha));
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
                } else if (npc.id === 'cache' || npc.id === 'cachehome') {
                    this.ctx.fillStyle = '#cfd8ff'; // the archivist — a pale, cold memory-blue
                    this.ctx.shadowColor = '#cfd8ff';
                } else if (npc.id === 'lostverse') {
                    this.ctx.fillStyle = '#ffe08a'; // a shard of Cadenza's fanfare — a warm gold note
                    this.ctx.shadowColor = '#ffe08a';
                } else {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.shadowColor = '#00ff00';
                }
                this.ctx.fillRect(npc.x + 2, npc.y + 2, this.gridSize - 4, this.gridSize - 4);
                this.drawNpcFeatures(npc); // little 8-bit face/glyph so they aren't plain dots
                this.ctx.globalAlpha = 1; // reset after a possibly-faded apparition
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

        // Shed-segment burst: the mass that "burst out of you" on a survivable hit,
        // flying outward and fading (red data debris).
        if (state.bursts && state.bursts.length) {
            for (const p of state.bursts) {
                const life = Math.max(0, p.life);
                this.ctx.globalAlpha = life;
                this.ctx.fillStyle = '#ff0055';
                this.ctx.shadowColor = '#ff0055';
                this.ctx.shadowBlur = 6;
                const sz = 2 + 6 * life;
                this.ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
            }
            this.ctx.globalAlpha = 1;
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
            
            const pulse = rm ? true : Math.floor(Date.now() / 500) % 2 === 0;

            // Cache's Save Function — offered from the REAL pause menu (not the Gate
            // Thread-Suspension cutscene) once she's granted it.
            if (state.gameState === 'PAUSED' && !state.isSuspended && state.unlocked && state.unlocked.saveFunction) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.font = '16px "Press Start 2P", monospace';
                const fileTag = state.activeSlot ? `  (FILE ${state.activeSlot})` : '';
                this.ctx.fillText(`[S] SAVE   [L] LOAD${fileTag}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
            }
            // Save/Load confirmation toast (SAVED / LOADED / NO SAVE).
            if (state.saveFlash) {
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.fillText(state.saveFlash, this.canvas.width / 2, this.canvas.height / 2 + 76);
            }

            this.ctx.fillStyle = '#00ff00';
            this.ctx.font = '16px "Press Start 2P", monospace';
            // Only prompt ESC when ESC actually resumes — i.e. genuinely PAUSED. During
            // the Gate cutscene (isSuspended but gameState==='DIALOG') ESC is dead, so
            // the "PRESS [ESC] TO RESUME" prompt would be a lie. (Steady under reduce-motion.)
            if (pulse && state.gameState === 'PAUSED') {
                this.ctx.fillText("PRESS [ESC] TO RESUME", this.canvas.width / 2, this.canvas.height - 60);
            }
            if (state.gameState === 'PAUSED') {
                this.ctx.fillStyle = '#00885f';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.fillText("[O] ACCESSIBILITY", this.canvas.width / 2, this.canvas.height - 34);
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
            const midX = this.canvas.width / 2, midY = this.canvas.height / 2;
            this.ctx.fillStyle = '#ff0055';
            this.ctx.font = '20px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('SIGNAL LOST', midX, midY - 22);

            // The last-5 "continue" inputs — a quiet puzzle prompt. It fills in one slot
            // per respawn; spelling CACHE across five deaths summons the archivist.
            const code = ((state.deathCode || '').padEnd(5, '_')).slice(-5).split('').join(' ');
            this.ctx.fillStyle = '#00776a';
            this.ctx.font = '16px "Press Start 2P", monospace';
            this.ctx.fillText(code, midX, midY + 6);

            if (rm || Math.floor(Date.now() / 500) % 2 === 0) { // steady under reduce-motion
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.fillText('PRESS ANY KEY TO CONTINUE', midX, midY + 36);
            }
        }

        // Boot / title. Before Cache "builds" it (startScreenUnlocked) the boot screen is
        // the bare A-Dark-Room void with a faint prompt — preserving the stark cold open.
        // After, it's her placeholder title treatment, with a one-time walk-on cameo.
        if (state.gameState === 'START' && state.startMenu) {
            this.drawStartScreen(state); // green title + 3-file select menu
            if (state.titleCameoSprite) this.drawTitleCameoSprite(state.titleCameoSprite);
        } else {
            // Bare A-Dark-Room cold open (no save files yet): a faint prompt (kept dim to
            // preserve the stark opening, but legible-sized and steady under reduce-motion).
            if (state.gameState === 'START' && (rm || Math.floor(Date.now() / 600) % 2 === 0)) {
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = 'rgba(0, 255, 204, 0.55)';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('press any key', this.canvas.width / 2, this.canvas.height - 34);
                this.ctx.fillStyle = 'rgba(0, 255, 204, 0.4)';
                this.ctx.fillText('[O] accessibility', this.canvas.width / 2, this.canvas.height - 14);
            }
        }

        // Cadenza's DA CAPO Encore — the ring + call/progress banner, over the live room.
        if (state.gameState === 'ENCORE' && state.encore) this.drawEncore(state);

        // Accessibility / Options overlay — drawn last, on top of everything.
        if (state.options) this.drawOptions(state);
    }

    // Accessibility / Options overlay: Volume / Mute / Reduce Motion. Green-on-black, all text
    // at the 16px a11y minimum, reachable in ANY state. state.options = { index, settings }.
    drawOptions(state) {
        const W = this.canvas.width, H = this.canvas.height, midX = W / 2;
        const o = state.options, s = o.settings;
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.globalAlpha = 1;
        this.ctx.fillStyle = 'rgba(3, 8, 6, 0.93)';
        this.ctx.fillRect(0, 0, W, H);
        this.ctx.strokeStyle = '#00ff88';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(12, 12, W - 24, H - 24);

        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#00ff88';
        this.ctx.shadowColor = '#00ff88';
        this.ctx.shadowBlur = 10;
        this.ctx.font = '24px "Press Start 2P", monospace';
        this.ctx.fillText('ACCESSIBILITY', midX, H * 0.24);
        this.ctx.shadowBlur = 0;

        const rows = [
            { label: 'VOLUME', value: s.muted ? 'MUTED' : Math.round(s.volume * 100) + '%' },
            { label: 'MUTE', value: s.muted ? 'ON' : 'OFF' },
            { label: 'REDUCE MOTION', value: s.reduceMotion ? 'ON' : 'OFF' },
        ];
        const top = H * 0.40, rowH = Math.max(34, Math.floor(H * 0.09));
        const lx = midX - Math.min(220, W * 0.42), rx = midX + Math.min(220, W * 0.42);
        this.ctx.font = '16px "Press Start 2P", monospace';
        for (let i = 0; i < rows.length; i++) {
            const y = top + i * rowH;
            const sel = i === o.index;
            this.ctx.textAlign = 'left';
            this.ctx.fillStyle = sel ? '#7dffb0' : '#00b36b';
            this.ctx.fillText((sel ? '> ' : '  ') + rows[i].label, lx, y);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = sel ? '#00ffcc' : '#008f5c';
            this.ctx.fillText(rows[i].value, rx, y);
        }

        this.ctx.textAlign = 'center';
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.fillText('up/down select    left/right adjust', midX, H - H * 0.17);
        this.ctx.fillStyle = '#00885f';
        this.ctx.fillText('[O] or [ESC] close', midX, H - H * 0.10);
        this.ctx.restore();
    }

    // Cadenza's DA CAPO Encore overlay: the 8-node ring + a call/progress banner, drawn on
    // top of the live room so you can see your body draping the ring. Deaf-legible — every
    // node carries its NUMBER + a SHAPE state (outline / filled-ringing / cracked-X) + its
    // POSITION, never colour alone; the banner spells the progress and any broken take.
    // Reduce-motion holds all glows steady (nothing strobes).
    drawEncore(state) {
        const g = this.gridSize, W = this.canvas.width;
        const e = state.encore;
        const rm = !!state.reduceMotion;
        const numFont = 'bold ' + Math.max(12, Math.floor(g * 0.6)) + 'px "Press Start 2P", monospace';
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        for (const n of e.nodes) {
            const cx = n.x + g / 2, cy = n.y + g / 2;
            const isNext = n.index === e.nextIndex;
            const deadLocked = n.dead && !e.verse;
            this.ctx.lineWidth = isNext ? 3 : 2;
            if (deadLocked) {
                // the hole in the song — a cracked, silent node
                this.ctx.strokeStyle = '#ff3b3b';
                this.ctx.strokeRect(n.x + 1, n.y + 1, g - 2, g - 2);
                this.ctx.beginPath();
                this.ctx.moveTo(n.x + 4, n.y + 4); this.ctx.lineTo(n.x + g - 4, n.y + g - 4);
                this.ctx.moveTo(n.x + g - 4, n.y + 4); this.ctx.lineTo(n.x + 4, n.y + g - 4);
                this.ctx.stroke();
            } else if (n.sounding) {
                // ringing — filled, with a steady glow (no strobe under reduce-motion)
                this.ctx.fillStyle = '#00ffcc';
                this.ctx.shadowColor = '#00ffcc';
                this.ctx.shadowBlur = rm ? 0 : 12;
                this.ctx.fillRect(n.x + 2, n.y + 2, g - 4, g - 4);
                this.ctx.shadowBlur = 0;
            } else if (n.eaten) {
                // struck but no longer sustained — a dim marker (the chord is slipping)
                this.ctx.strokeStyle = '#0c8f66';
                this.ctx.strokeRect(n.x + 2, n.y + 2, g - 4, g - 4);
            } else {
                // waiting to be sung
                this.ctx.strokeStyle = isNext ? '#ffcc00' : '#00885f';
                this.ctx.strokeRect(n.x + 2, n.y + 2, g - 4, g - 4);
            }
            // the NEXT note gets an outer ring so it reads without colour
            if (isNext && !deadLocked) {
                this.ctx.strokeStyle = '#ffcc00';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(n.x - 2, n.y - 2, g + 4, g + 4);
            }
            // the note number (1-based) — legible on every state
            this.ctx.fillStyle = n.sounding ? '#04302a' : (deadLocked ? '#ff8a8a' : '#bff5e6');
            this.ctx.font = numFont;
            this.ctx.fillText(String(n.index + 1), cx, cy);
        }

        // Banner: who's singing + how much of the chord is held + any broken-take message.
        const bh = Math.max(44, Math.floor(g * 2.4));
        this.ctx.fillStyle = 'rgba(3, 8, 6, 0.82)';
        this.ctx.fillRect(0, 0, W, bh);
        this.ctx.fillStyle = '#ff66cc';
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.fillText('CADENZA — DA CAPO', W / 2, 16);
        if (e.crackFlash > 0 && e.msg) {
            this.ctx.fillStyle = '#ff6b6b';
            this.ctx.fillText(e.msg, W / 2, 34);
        } else {
            this.ctx.fillStyle = '#00ffcc';
            const held = e.nodes.filter(n => n.sounding).length;
            this.ctx.fillText('HOLD THE CHORD   ' + e.nextIndex + ' / ' + e.total + '   [' + held + ' ringing]', W / 2, 34);
        }
        this.ctx.restore();
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

    // A gentle pink pulse along the wall(s) facing Cadenza's sealed sector — the
    // VISIBLE half of her homing beacon (the audible half is the sonar ping). Amplitude
    // scales with proximity; the rhythm is slow and breath-like, echoing her sustained
    // tone. beacon = { proximity: 0..1, dx: sign toward her X, dy: sign toward her Y }.
    drawCadenzaPulse(beacon, W, H, rm) {
        const p = Math.max(0, Math.min(1, beacon.proximity));
        if (p <= 0) return;
        // Reduce-motion: hold the "breath" steady so the directional wall cue stays visible
        // (redundant coding) without pulsing.
        const breath = rm ? 0.85 : 0.5 + 0.5 * Math.sin(Date.now() / 600);
        const alpha = 0.22 + 0.72 * p * breath;                // a little more intense per playtest
        this.ctx.save();
        this.ctx.strokeStyle = `rgba(255, 102, 204, ${alpha})`;
        this.ctx.shadowColor = '#ff66cc';
        this.ctx.shadowBlur = 12 + 28 * p * breath;
        this.ctx.lineWidth = 8;
        const walls = [];
        if (beacon.dx > 0) walls.push([W - 3, 0, W - 3, H]);   // east
        else if (beacon.dx < 0) walls.push([3, 0, 3, H]);      // west
        if (beacon.dy > 0) walls.push([0, H - 3, W, H - 3]);   // south
        else if (beacon.dy < 0) walls.push([0, 3, W, 3]);      // north
        for (const [x0, y0, x1, y1] of walls) {
            this.ctx.beginPath();
            this.ctx.moveTo(x0, y0);
            this.ctx.lineTo(x1, y1);
            this.ctx.stroke();
        }
        this.ctx.restore();
    }

    // The Module Slot — a pulsing dashed 3x3 socket (bottom-left). Drag your tail
    // into it to auto-load a carried module. Glows green while you're carrying one.
    drawModuleSlot(state) {
        if (!state.unlocked || !state.unlocked.moduleSlot) return;
        const g = this.gridSize;
        const x = state.moduleSlotX, y = state.moduleSlotY, size = g * 3;
        const carrying = !!state.carriedModule;
        const pulse = state.reduceMotion ? 0.8 : 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 250));
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
        // Cache marks her sector on your map at the end of her Hub questline. Fold it into
        // the bounds (even if unvisited) so the marker sits in the right direction.
        const cacheLm = worldManager.landmarks && worldManager.landmarks.cache;
        const showCache = !!cacheLm && state.unlocked && state.unlocked.cacheStage >= 3;
        const boundsCoords = showCache ? [...coords, [cacheLm.x, cacheLm.y]] : coords;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const [x, y] of boundsCoords) {
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

        // Cache's marked sector — a blinking archival-blue pip with a small 'C' tag, even
        // if you haven't been there yet. "You have a place for her in your notes."
        if (showCache) {
            const mx = gx(cacheLm.x), my = gy(cacheLm.y);
            const blink = state.reduceMotion ? 0.85 : 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 400));
            const d = dot + 2;
            this.ctx.fillStyle = `rgba(207, 216, 255, ${0.45 + 0.55 * blink})`;
            this.ctx.shadowColor = '#cfd8ff';
            this.ctx.shadowBlur = 6 * blink;
            this.ctx.fillRect(mx - d / 2, my - d / 2, d, d);
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#cfd8ff';
            this.ctx.font = '6px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('C', mx, my - d);
        }
    }

    // Cache's placeholder title screen + the 3-file select menu, in the game's green-on-
    // black terminal palette. state.startMenu = { slots:[{slot,exists,meta,savedAt}], index,
    // confirmErase }.
    drawStartScreen(state) {
        const W = this.canvas.width, H = this.canvas.height, midX = W / 2;
        const menu = state.startMenu || { slots: [], index: 0, confirmErase: null };

        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = 'rgba(5, 5, 5, 0.93)';
        this.ctx.fillRect(0, 0, W, H);

        // ACCESSIBILITY (design_doc §2.6): boot-screen text is never rendered below MIN_FONT
        // px, and scales UP from there with the canvas. Body text is the interactive/info
        // size; the title is much larger. (Cache's cameo now shows in the dialog window.)
        const MIN_FONT = 16;
        const body = Math.max(MIN_FONT, Math.min(Math.floor(H / 22), Math.floor(W / 26)));
        // Fit the 9-glyph title within the canvas WITH horizontal margin (~24px/side) and
        // room for its glow (shadowBlur 18) so it can't clip at narrow/mobile widths.
        // Floors at 30 (accessibility) even if that means less margin on a tiny canvas.
        const titleFs = Math.max(30, Math.min(56, Math.floor((W - 48 - 36) / 9)));

        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#00ff66';
        this.ctx.shadowColor = '#00ff88';
        this.ctx.shadowBlur = 18;
        this.ctx.font = `${titleFs}px "Press Start 2P", monospace`;
        this.ctx.fillText('0r0b0r0u5', midX, H * 0.20);
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#00885f';
        this.ctx.font = `${MIN_FONT}px "Press Start 2P", monospace`;
        this.ctx.fillText('// placeholder title //', midX, H * 0.20 + titleFs * 0.8);

        // Three save FILES — two lines each (name, then summary) so the bigger text can't clip.
        const slots = menu.slots;
        const rowH = body + MIN_FONT + 16;
        const top = H * 0.42;
        const lx = midX - Math.min(190, W * 0.42);

        for (let i = 0; i < slots.length; i++) {
            const s = slots[i];
            const selected = i === menu.index;
            const y = top + i * rowH;

            this.ctx.textAlign = 'left';
            this.ctx.font = `${body}px "Press Start 2P", monospace`;
            if (selected) {
                this.ctx.fillStyle = '#00ff88';
                this.ctx.shadowColor = '#00ff88';
                this.ctx.shadowBlur = 8;
                this.ctx.fillText('>', lx - body - 4, y);
                this.ctx.shadowBlur = 0;
            }
            this.ctx.fillStyle = selected ? '#7dffb0' : (s.exists ? '#00b36b' : '#5a6b60');
            this.ctx.fillText(`FILE ${s.slot}`, lx, y);

            // Summary line beneath the file name.
            this.ctx.font = `${MIN_FONT}px "Press Start 2P", monospace`;
            const sy = y + MIN_FONT + 6;
            if (menu.confirmErase === s.slot) {
                this.ctx.fillStyle = '#ff5555';
                this.ctx.fillText('ERASE?  DEL again', lx + body, sy);
            } else if (s.exists) {
                const m = s.meta || {};
                this.ctx.fillStyle = selected ? '#00cc88' : '#008f5c';
                this.ctx.fillText(`${m.place || 'In progress'} - ${m.mods || 0} mod${m.mods === 1 ? '' : 's'}`, lx + body, sy);
            } else {
                this.ctx.fillStyle = selected ? '#8fbfa0' : '#5a6b60';
                this.ctx.fillText('-- new game --', lx + body, sy);
            }
        }

        // Controls prompt (two lines, at the accessibility minimum).
        const sel = slots[menu.index];
        this.ctx.textAlign = 'center';
        this.ctx.font = `${MIN_FONT}px "Press Start 2P", monospace`;
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.fillText(sel && sel.exists ? 'ENTER load   N new   DEL erase' : 'ENTER  new game', midX, H - body * 2.2);
        this.ctx.fillStyle = '#00885f';
        this.ctx.fillText('up/down select file     [O] accessibility', midX, H - body * 0.9);
    }

    // Cache's title-cameo sprite (her archival-blue block + eyes) — walks on and fades under
    // the control of GameEngine.updateTitleCameo; here we just paint it at the given alpha.
    drawTitleCameoSprite(s) {
        const g = this.gridSize;
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha));
        this.ctx.shadowColor = '#cfd8ff';
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = '#cfd8ff';
        this.ctx.fillRect(s.x, s.y, g, g);
        this.drawEyes(s.x, s.y, '#1a2233');
        this.ctx.restore();
    }
}
