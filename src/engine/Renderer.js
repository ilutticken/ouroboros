import { HUSH_LABELS } from '../content/dialogue.js';

// The era palettes (§2 "X-Bit Neon"): the Beat-8 reboot doubles the palette — same
// room, drawn beautiful. 8-bit is the original monochrome-neon; 16-bit deepens the
// void to indigo, warms every hue, and turns the baseline glow up.
const PAL8 = { bg: '#050505', wall: '#00ffcc', obstacle: '#00ffcc', apple: '#ff0055', body: '#ff0055', head: '#ffffff', glitch: '#ff00ff', glow: 15 };
const PAL16 = { bg: '#0a0618', wall: '#3af5cf', obstacle: '#2fd6a8', apple: '#ff2e7e', body: '#ff4d94', head: '#ffffff', glitch: '#d84cff', glow: 20 };

// The quarantine wall's drawn thickness (px). The playable interior is inset by a full
// 1-cell ring (the snake can't enter it — see GameEngine._ringGuard), so this band reads
// as a real barrier the worm stays clear of; entities live in the interior and never
// overlap it. Kept a little under a full cell so a clean gap shows between wall and worm.
const WALL = 14;

export class Renderer {
    constructor(canvas, gridSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = gridSize;
    }

    // The drawn rect for a cell entity. Since the playable interior now excludes the
    // whole wall ring (GameEngine._ringGuard keeps every entity a clear cell inside the
    // wall), no wall-clamp is needed — the old clamp only ever bit the HEAD while it
    // transited a doorway ring cell, pinching it to a sliver. `pad` is the in-cell inset.
    _cellRect(x, y, pad) {
        const g = this.gridSize;
        return [x + pad, y + pad, g - 2 * pad, g - 2 * pad];
    }

    draw(state, snake, apple, npcs, glitches, worldManager, obstacles) {
        // Reduce-motion (a11y): when on, oscillating pulses hold at a steady value and
        // blinking prompts stay lit — nothing strobes. Threaded through the whole frame.
        const rm = !!state.reduceMotion;
        // The active era palette (the Beat-8 reboot flips it mid-frame, no fanfare).
        const P = (state.unlocked && state.unlocked.era16) ? PAL16 : PAL8;
        this.pal = P;
        // Clear screen (The Void)
        this.ctx.fillStyle = P.bg;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Neon Glow effect
        this.ctx.shadowBlur = this._frameGlow(state);
        
        if (state.unlocked.borders) {
            // The quarantine wall — a THICK neon band (WALL px). Drawn as a wide stroke,
            // inset by half its width so it stays on-canvas; entities are kept out of the
            // band by _cellRect, so the snake stays a clear gap away when scanning.
            const wallThickness = WALL;
            const inset = wallThickness / 2;
            this.ctx.strokeStyle = P.wall;
            this.ctx.lineWidth = wallThickness;
            this.ctx.shadowColor = P.wall;
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
                this.ctx.fillStyle = P.bg;
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

                // THE KERNEL'S COIL: any wall facing outside the finite interior renders
                // as the sleeper's deep-red, slowly-creeping segmented body — a corrupt
                // mirror of your own snake. Unbreakable, lethal; motion is menace, not a
                // gap (held static under reduce-motion). The Hub is exempt — the
                // Architect's own quarantine masks the coil there.
                if (worldManager.isCoilWall && !(rx === 0 && ry === 0)) {
                    for (const dir of ['up', 'down', 'left', 'right']) {
                        if (!worldManager.isCoilWall(rx, ry, dir)) continue;
                        const aperture = (rx === 5 && ry === -5 && dir === 'up');
                        this.drawCoilWall(dir, rm, aperture, !!(state.unlocked && state.unlocked.finaleDone));
                    }
                }

                for (const dir of ['up', 'down', 'left', 'right']) {
                    const wp = worldManager.getWeakPoint(rx, ry, dir);
                    if (!wp) continue; // solid wall — no doorway to draw
                    if (worldManager.isWallBroken(rx, ry, dir)) {
                        // OPEN — punch a full-thickness black gap through the neon border.
                        this.ctx.shadowBlur = 0;
                        this.ctx.fillStyle = P.bg;
                        this.ctx.fillRect(...gapRect(dir, wp, wallThickness));
                        continue;
                    }
                    // Ordinary doors always draw. The few registered Scanner doors stay
                    // HIDDEN (plain solid wall) until ram damage, a Scanner sweep, or a
                    // breach reveals them — that's the whole point of the Topology Scanner.
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

                // THE SCANNER'S BEYOND READ — a category echo of the neighbouring sector,
                // drawn as a labelled tag at the swept wall's midpoint (text on a dark
                // plate, >=16px — §2.6: never colour-only). Fades with the reveal.
                if (worldManager.beyondFor) {
                    const LABELS = { module: 'MOD', cache: 'DATA', lore: 'LOG', someone: 'LIFE', landmark: '???' };
                    for (const dir of ['up', 'down', 'left', 'right']) {
                        const b = worldManager.beyondFor(rx, ry, dir);
                        if (!b || !LABELS[b.kind]) continue;
                        const alpha = Math.min(1, b.ms / 800);
                        const txt = `[${LABELS[b.kind]}]`;
                        this.ctx.save();
                        this.ctx.shadowBlur = 0;
                        this.ctx.font = '16px "Press Start 2P", monospace';
                        this.ctx.textAlign = 'center';
                        let tx = W / 2, ty = H / 2;
                        if (dir === 'up') ty = wallThickness + 24;
                        else if (dir === 'down') ty = H - wallThickness - 10;
                        else if (dir === 'left') { tx = wallThickness + 44; }
                        else { tx = W - wallThickness - 44; }
                        const w = this.ctx.measureText(txt).width;
                        this.ctx.fillStyle = `rgba(3, 8, 6, ${0.75 * alpha})`;
                        this.ctx.fillRect(tx - w / 2 - 4, ty - 15, w + 8, 20);
                        this.ctx.fillStyle = `rgba(0, 229, 255, ${alpha})`;
                        this.ctx.fillText(txt, tx, ty);
                        this.ctx.restore();
                    }
                }
                this.ctx.shadowBlur = this._frameGlow(state);
            }

            // Cadenza's DIRECTIONAL cue (a11y: her beacon must not be sound-only). In
            // rooms near her sealed sector the wall(s) facing her breathe with her tone,
            // stronger the closer you are — so which way to go is also VISIBLE.
            if (state.cadenzaBeacon) this.drawCadenzaPulse(state.cadenzaBeacon, W, H, rm);
        }
        
        // Draw Obstacles (Solid Green)
        const bordersOn = !!state.unlocked.borders;
        if (obstacles) {
            this.ctx.fillStyle = P.obstacle;
            this.ctx.shadowColor = P.obstacle;
            for (const obs of obstacles) {
                this.ctx.fillRect(...this._cellRect(obs.x, obs.y, 1, bordersOn));
            }
        }

        // Denny's DENIED stamps — his lagged enforcement hardening your own trail. Amber
        // (his colour) with a dark 'D' glyph (shape + text, never hue alone); the last
        // ticks of a stamp's decay fade it out (a fade, not a strobe — reduce-motion-safe).
        if (state.stamps && state.stamps.length) {
            const g = this.gridSize;
            for (const s of state.stamps) {
                const a = s.ttl >= 4 ? 1 : Math.max(0.25, s.ttl / 4);
                this.ctx.globalAlpha = a;
                this.ctx.fillStyle = '#ffcc00';
                this.ctx.shadowColor = '#ffcc00';
                this.ctx.shadowBlur = 6;
                this.ctx.fillRect(s.x + 2, s.y + 2, g - 4, g - 4);
                this.ctx.shadowBlur = 0;
                this.ctx.fillStyle = '#4a2c00';
                this.ctx.font = 'bold ' + Math.max(10, Math.floor(g * 0.55)) + 'px "Press Start 2P", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText('D', s.x + g / 2, s.y + g / 2 + 1);
                this.ctx.textBaseline = 'alphabetic';
            }
            this.ctx.globalAlpha = 1;
            this.ctx.shadowBlur = this._frameGlow(state);
        }

        // Draw Glitches (Magenta) — with a dark X so corruption reads as a HAZARD by SHAPE,
        // not colour alone (a11y §2.6 redundant coding): distinct from the apple's plain data
        // square even in grayscale / for red-magenta colour-blindness. Once Motion Carried
        // lands, a moving Glitch additionally wears a static directional NOTCH — its next
        // step is printed on it (deaf/colour-blind-legible, steady under reduce-motion).
        if (glitches) {
            const gg = this.gridSize;
            for (const g of glitches) {
                const [bx, by, bw, bh] = this._cellRect(g.x, g.y, 2, bordersOn);
                this.ctx.fillStyle = P.glitch;
                this.ctx.shadowColor = P.glitch;
                this.ctx.shadowBlur = this._frameGlow(state);
                this.ctx.fillRect(bx, by, bw, bh);
                this.ctx.shadowBlur = 0;
                this.ctx.strokeStyle = '#2a002a';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.moveTo(bx + 3, by + 3);
                this.ctx.lineTo(bx + bw - 3, by + bh - 3);
                this.ctx.moveTo(bx + bw - 3, by + 3);
                this.ctx.lineTo(bx + 3, by + bh - 3);
                this.ctx.stroke();
                if (g._m) {
                    // the drift notch: a solid wedge on the edge it will step through —
                    // anchored to the CLAMPED body square (bx/by/bw/bh) so in an edge
                    // cell it stays on the visible glitch, never floating onto the wall.
                    this.ctx.fillStyle = '#2a002a';
                    const cx = bx + bw / 2, cy = by + bh / 2;
                    const nx = cx + g._m.dx * Math.max(0, bw / 2 - 3), ny = cy + g._m.dy * Math.max(0, bh / 2 - 3);
                    this.ctx.beginPath();
                    if (g._m.dx !== 0) {
                        this.ctx.moveTo(nx, ny - 4); this.ctx.lineTo(nx, ny + 4); this.ctx.lineTo(nx + g._m.dx * 4, ny);
                    } else {
                        this.ctx.moveTo(nx - 4, ny); this.ctx.lineTo(nx + 4, ny); this.ctx.lineTo(nx, ny + g._m.dy * 4);
                    }
                    this.ctx.closePath();
                    this.ctx.fill();
                }
            }
            // Restore the frame glow the X-stroke zeroed, so the apple (drawn next) still glows.
            this.ctx.shadowBlur = this._frameGlow(state);
        }

        // Module Slot (socket you install carried modules into)
        this.drawModuleSlot(state);

        // Draw Apple (Red Data). NULL is legal — a wandered-off apple (the 20% skitter)
        // leaves the room foodless until re-entry. An unguarded deref here killed the
        // rAF loop mid-draw (walls drawn, snake/NPCs not — the playtest lockup).
        if (apple) {
            this.ctx.fillStyle = P.apple;
            this.ctx.shadowColor = P.apple;
            this.ctx.fillRect(...this._cellRect(apple.x, apple.y, 2, bordersOn));
        }

        // Cache's spare-data motes (Hub only): small Data pips with a cold archival glow,
        // so they read as HERS and as smaller than the main apple.
        if (state.dataMotes && state.dataMotes.length) {
            const g = this.gridSize;
            const pulse = rm ? 0.8 : 0.6 + 0.4 * Math.abs(Math.sin(Date.now() / 300));
            for (const m of state.dataMotes) {
                // Salvage Claws' reclaimed mass reads as plain red Data; Cache's spare
                // bytes keep their cold archival blue glow.
                this.ctx.fillStyle = m.salvage ? P.apple : '#ff2f6b';
                this.ctx.shadowColor = m.salvage ? P.apple : '#cfd8ff';
                this.ctx.shadowBlur = 6 * pulse;
                this.ctx.fillRect(...this._cellRect(m.x, m.y, 6, bordersOn));
            }
            this.ctx.shadowBlur = 0;
        }

        // Draw persistent NPCs
        if (npcs) {
            for (const npc of npcs) {
                // Re-assert the frame glow each iteration (drawNpcFeatures zeroes it).
                this.ctx.shadowBlur = this._frameGlow(state);
                // Cache's apparition materialises/dissolves — honour her alpha (others = 1).
                this.ctx.globalAlpha = (npc.alpha === undefined) ? 1 : Math.max(0, Math.min(1, npc.alpha));
                if (npc.id === 'gate' || npc.id === 'gate3' || npc.id === 'gatefinal') {
                    this.ctx.fillStyle = '#0088ff';
                    this.ctx.shadowColor = '#0088ff';
                } else if (npc.id === 'denny' || npc.id === 'denny2'
                           || npc.id === 'dennyfinal' || npc.id === 'dennyafter') {
                    this.ctx.fillStyle = '#ffcc00'; // amber clerk
                    this.ctx.shadowColor = '#ffcc00';
                } else if (npc.id === 'nibble') {
                    this.ctx.fillStyle = '#ff9e3d'; // warm like a heat lamp — comforting, and it burns
                    this.ctx.shadowColor = '#ff9e3d';
                } else if (npc.id === 'hush') {
                    // the suppressor: bruised rose awake, ash-grey at rest
                    const asleep = npc.dormant || (state.unlocked && (state.unlocked.musicLayer || 0) >= 1);
                    this.ctx.fillStyle = asleep ? '#5a4a52' : '#cf8aa0';
                    this.ctx.shadowColor = asleep ? '#5a4a52' : '#cf8aa0';
                } else if (npc.id === 'datacache') {
                    this.ctx.fillStyle = '#ffd24d'; // a mass payout — gold crate
                    this.ctx.shadowColor = '#ffd24d';
                } else if (npc.id === 'uimodule') {
                    this.ctx.fillStyle = '#00e0d0'; // a diagnostic MODULE — cyan chip, not a face
                    this.ctx.shadowColor = '#00e0d0';
                } else if (npc.id === 'lorefrag') {
                    this.ctx.fillStyle = '#9adfff'; // a scannable log fragment — pale archival ice
                    this.ctx.shadowColor = '#9adfff';
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
                } else if (npc.id === 'hydratia') {
                    this.ctx.fillStyle = '#0a2e2b'; // her cell is DEEP water — the droplet glyph carries the light
                    this.ctx.shadowColor = '#7ee8e0';
                } else if (npc.id === 'quantcy') {
                    this.ctx.fillStyle = '#d8b64a'; // banker's brass — a strongbox, not a packet
                    this.ctx.shadowColor = '#d8b64a';
                } else if (npc.id === 'commons' || npc.id === 'minegate') {
                    this.ctx.fillStyle = '#4a5a50'; // weathered structure-grey: architecture, not a program
                    this.ctx.shadowColor = '#4a5a50';
                } else {
                    this.ctx.fillStyle = '#00ff00';
                    this.ctx.shadowColor = '#00ff00';
                }
                // Buildings draw at PAD 0 so their nine cells fuse into one continuous
                // structure (padded cells read as a grid of squares, not a place).
                const basePad = (npc.id === 'commons' || npc.id === 'minegate') ? 0 : 2;
                this.ctx.fillRect(...this._cellRect(npc.x, npc.y, basePad, bordersOn));
                this.drawNpcFeatures(npc, state); // little 8-bit face/glyph so they aren't plain dots
                this.ctx.globalAlpha = 1; // reset after a possibly-faded apparition
            }
            // HUSH's process-status label (≥16px, the deaf-legible half of its state):
            // ON DUTY while it hunts, STANDING BY once the Locked Groove is its lullaby.
            const hush = npcs.find(n => n.id === 'hush');
            if (hush) this.drawHushLabel(hush, state);
        }

        // Draw Snake
        const biteOnGrid = npcs && npcs.some(n => n.id === 'bite');
        for (let i = 0; i < snake.body.length; i++) {
            const segment = snake.body[i];
            // 2-Bit rides at state.biteIndex — normally the tail tip, but one cell
            // forward while a Module occupies the tail tip (see GameEngine.biteIndex).
            // -1 means don't draw his face here (he's on the grid, dropped off, etc.).
            const isBite = state.biteIndex >= 0 && i === state.biteIndex && !biteOnGrid;
            // A carried refugee rides a segment exactly like 2-Bit does — a real
            // passenger with a face, not a HUD label.
            const isRefugee = state.refugeeIndex >= 0 && i === state.refugeeIndex;
            if (isBite || isRefugee) {
                this.ctx.fillStyle = '#00ff00';
                this.ctx.shadowColor = '#00ff00';
                this.ctx.shadowBlur = Math.max(0, state.gear || 0) * 10; // the worm's own glow rides the live gear too
            } else {
                this.ctx.fillStyle = i === 0 ? P.head : P.body;
                this.ctx.shadowBlur = 0;
            }
            this.ctx.fillRect(...this._cellRect(segment.x, segment.y, 1, bordersOn));
            // The worm's head has no eyes (it's not a packet); passengers keep theirs.
            if (isBite) this.drawEyes(segment.x, segment.y, '#003b00');
            else if (isRefugee) {
                this.drawEyes(segment.x, segment.y, '#0a1a0a');
                // the bindle — they're still packed, even mid-ride
                this.ctx.fillStyle = '#0a1a0a';
                this.ctx.fillRect(segment.x + this.gridSize - 7, segment.y + 3, 4, 4);
            }
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
                this.ctx.fillStyle = P.body;
                this.ctx.shadowColor = P.body;
                this.ctx.shadowBlur = 6;
                const sz = 2 + 6 * life;
                this.ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
            }
            this.ctx.globalAlpha = 1;
        }

        // Reset shadow for performance
        this.ctx.shadowBlur = 0;

        // Heur's decontamination — Breakout played IN the sealed room: the signature
        // database (bricks), the scan-ping, and a clearance/goal banner, drawn over the
        // live snake so you can read the ball and your body-as-paddle together.
        if (state.heur) this.drawHeur(state, bordersOn);

        // THE COIL'S HELD BREATH (deaf-legible twin of the audio duck): approaching the
        // Kernel's body dims the room from the coil side and prints a signal readout —
        // the whole approach reads with the sound off.
        if (state.coilNear && state.coilNear.proximity > 0) {
            this.drawCoilNear(state.coilNear, rm);
        }

        // (Gate's citations and Heur's signature count moved OFF the canvas into the
        // bottom ribbon — see #boss-status / Game.refreshBossStatus. The play space
        // stays clean during boss encounters, per playtest.)

        // 2-Bit's route map (extra feature).
        this.drawMinimap(worldManager, state);

        // Wilds-found HUD utilities: the gear meter (tachometer) and the sector readout.
        this.drawFoundHud(state);

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
            // Map Pins tool: mark the current room (shows the current room's pin state).
            if (state.gameState === 'PAUSED' && !state.isSuspended && state.unlocked && state.unlocked.mapPinsTool) {
                const cur = state.mapPins ? state.mapPins[`${state.roomX},${state.roomY}`] : undefined;
                const tag = cur === undefined ? 'unmarked' : `shape ${cur + 1}`;
                this.ctx.fillStyle = '#ffd24d';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.fillText(`[M] MARK ROOM  (${tag})`, this.canvas.width / 2, this.canvas.height / 2 + 112);
            }
            // THE INVENTORY (Zelda-style): everything you own, by name, in two columns —
            // UPGRADES left, MODULES right. Convention-standard equipment screen; the
            // pause menu is the diegetic System Diagnostic, so this is its device list.
            if (state.gameState === 'PAUSED' && !state.isSuspended && state.inventory) {
                const inv = state.inventory;
                const colY = 110, lineH = 24;
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.textAlign = 'left';
                this.ctx.fillStyle = '#00885f';
                this.ctx.fillText('UPGRADES', 36, colY);
                this.ctx.fillStyle = '#00cc88';
                inv.upgrades.forEach((name, i) => this.ctx.fillText(name, 36, colY + (i + 1) * lineH));
                if (!inv.upgrades.length) { this.ctx.fillStyle = '#33554a'; this.ctx.fillText('- none -', 36, colY + lineH); }
                this.ctx.textAlign = 'right';
                this.ctx.fillStyle = '#00885f';
                this.ctx.fillText('MODULES', this.canvas.width - 36, colY);
                this.ctx.fillStyle = '#00cc88';
                inv.modules.forEach((name, i) => this.ctx.fillText(name, this.canvas.width - 36, colY + (i + 1) * lineH));
                if (!inv.modules.length) { this.ctx.fillStyle = '#33554a'; this.ctx.fillText('- none -', this.canvas.width - 36, colY + lineH); }
                this.ctx.textAlign = 'center';
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
            this.ctx.fillStyle = P.bg;
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

            // HYDRATIA'S RECEIPT — the death screen's second voice. The Architect gloats
            // in the terminal; she reassures (what persisted) and coaches (cause-keyed
            // hint, escalating with repeat offenses). All >=16px, static (§2.6).
            if (state.deathReceipt) {
                const r = state.deathReceipt;
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.fillStyle = '#69d0a8';
                this.ctx.fillText(r.line, midX, midY + 72);
                // plain stats, game-convention style — no 'kept'/'retained' framing
                this.ctx.fillStyle = '#3fa080';
                this.ctx.fillText(`${r.walls} WALLS BROKEN   ${r.mods} UPGRADES   ${r.modules} MODULES`, midX, midY + 96);
                this.ctx.fillStyle = '#cf8aa0';
                this.ctx.fillText(r.hint, midX, midY + 124);
            }
        }

        // Boot / title. Before Cache "builds" it (startScreenUnlocked) the boot screen is
        // the bare A-Dark-Room void with a faint prompt — preserving the stark cold open.
        // After, it's her placeholder title treatment, with a one-time walk-on cameo.
        if (state.gameState === 'START' && state.startMenu) {
            this.drawStartScreen(state); // green title + 3-file select menu
            if (state.titleCameoSprite) this.drawTitleCameoSprite(state.titleCameoSprite);
            if (state.hydratia) this.drawHydratia(state.hydratia, rm);
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
            // Hydratia haunts the bare cold open too (she predates your Start Screen).
            if (state.gameState === 'START' && state.hydratia) this.drawHydratia(state.hydratia, rm);
        }

        // Cadenza's DA CAPO Encore — the ring + call/progress banner, over the live room.
        if (state.gameState === 'ENCORE' && state.encore) this.drawEncore(state);

        // Accessibility / Options overlay — drawn last, on top of everything.
        if (state.options) this.drawOptions(state);
    }

    // One coil wall: the Kernel's body as segmented deep-red blocks that creep slowly
    // along the edge (held perfectly still under reduce-motion — the menace is the
    // texture, not the strobe). `aperture` carves PORT 0's central port ({5,-5});
    // `released` is the post-finale state — the Kernel has let go of its own tail,
    // and the port stands OPEN: two blunt tail-ends flank a true gap in the ring.
    drawCoilWall(dir, rm, aperture, released) {
        const g = this.gridSize, W = this.canvas.width, H = this.canvas.height;
        const horizontal = (dir === 'up' || dir === 'down');
        const span = horizontal ? W : H;
        const thick = WALL; // match the quarantine wall band, so the coil fully covers it
        const seg = Math.round(g * 1.6), gap = 4, pitch = seg + gap;
        const creep = rm ? 0 : Math.floor((Date.now() / 120) % pitch); // ~8px/s crawl
        this.ctx.save();
        this.ctx.shadowColor = '#ff2d6b';
        this.ctx.shadowBlur = 10;
        // aperture bounds (PORT 0): the central 5 cells stay open in the block run
        const mid = Math.floor(span / 2 / g) * g;
        const apLo = mid - 2 * g, apHi = mid + 3 * g;
        for (let s = -pitch + creep; s < span; s += pitch) {
            const lo = Math.max(0, s), hi = Math.min(span, s + seg);
            if (hi <= lo) continue;
            const segments = aperture
                ? [[lo, Math.min(hi, apLo)], [Math.max(lo, apHi), hi]].filter(([a, b]) => b > a)
                : [[lo, hi]];
            for (const [a, b] of segments) {
                this.ctx.fillStyle = '#8f0f2e';
                if (dir === 'up') this.ctx.fillRect(a, 0, b - a, thick);
                else if (dir === 'down') this.ctx.fillRect(a, H - thick, b - a, thick);
                else if (dir === 'left') this.ctx.fillRect(0, a, thick, b - a);
                else this.ctx.fillRect(W - thick, a, thick, b - a);
                // the belly line — each block reads as a body segment, not a brick
                this.ctx.fillStyle = '#ff2d6b';
                if (horizontal) this.ctx.fillRect(a + 2, dir === 'up' ? thick / 2 - 1 : H - thick / 2 - 1, Math.max(0, b - a - 4), 2);
                else this.ctx.fillRect(dir === 'left' ? thick / 2 - 1 : W - thick / 2 - 1, a + 2, 2, Math.max(0, b - a - 4));
            }
        }
        if (aperture) {
            this.ctx.shadowBlur = 0;
            if (released) {
                // POST-FINALE: the tail is RELEASED. A true gap — void, no seal, no
                // ring — flanked by the coil's two blunt tail-ends. The Ouroboros has
                // let go; Act II is on the other side.
                this.ctx.fillStyle = '#05050f';
                this.ctx.fillRect(apLo, 0, apHi - apLo, thick + 2);
                this.ctx.fillStyle = '#ff2d6b';
                this.ctx.fillRect(apLo - 4, 0, 4, thick);          // west tail-end, blunt cap
                this.ctx.fillRect(apHi, 0, 4, thick);              // east tail-end
                this.ctx.fillStyle = '#ff8a3d';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('PORT 0 — OPEN', (apLo + apHi) / 2, thick + 18);
            } else {
                // PORT 0 — the sealed aperture in the coil: a dark port ringed in its
                // own light, named in ≥16px text. The door that matters.
                this.ctx.fillStyle = '#05050f';
                this.ctx.fillRect(apLo, 0, apHi - apLo, thick);
                this.ctx.strokeStyle = '#ff8a3d';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(apLo + 1, 1, apHi - apLo - 2, thick);
                this.ctx.fillStyle = '#ff8a3d';
                this.ctx.font = '16px "Press Start 2P", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('PORT 0', (apLo + apHi) / 2, thick + 18);
            }
        }
        this.ctx.restore();
    }

    // The coil-approach deaf twin: the room dims from the coil side(s) and a ≥16px
    // signal readout counts the world down toward the held breath.
    drawCoilNear(near, rm) {
        const W = this.canvas.width, H = this.canvas.height;
        const p = Math.max(0, Math.min(1, near.proximity));
        if (p <= 0) return;
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        for (const dir of near.dirs) {
            const depth = (dir === 'up' || dir === 'down' ? H : W) * 0.45;
            let grad;
            if (dir === 'up') grad = this.ctx.createLinearGradient(0, 0, 0, depth);
            else if (dir === 'down') grad = this.ctx.createLinearGradient(0, H, 0, H - depth);
            else if (dir === 'left') grad = this.ctx.createLinearGradient(0, 0, depth, 0);
            else grad = this.ctx.createLinearGradient(W, 0, W - depth, 0);
            grad.addColorStop(0, `rgba(20, 2, 8, ${0.62 * p})`);
            grad.addColorStop(1, 'rgba(20, 2, 8, 0)');
            this.ctx.fillStyle = grad;
            this.ctx.fillRect(0, 0, W, H);
        }
        // the readout: how much of the world's signal is left
        const bars = 8;
        const lit = Math.max(0, Math.round(bars * (1 - p)));
        const meter = '[' + '#'.repeat(lit) + '-'.repeat(bars - lit) + ']';
        this.ctx.fillStyle = `rgba(255, 138, 160, ${0.55 + 0.45 * p})`;
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`SIGNAL ${meter}${p > 0.6 ? '  THE COIL' : ''}`, W / 2, H - 12);
        this.ctx.restore();
    }

    // HUSH's status label — the deaf-legible half of its state machine, ≥16px, drawn
    // near the top of its room. Redundant by text + shape + motion (the sprite itself
    // is jaws-vs-restline, moving-vs-still).
    drawHushLabel(hush, state) {
        const asleep = hush.dormant || (state.unlocked && (state.unlocked.musicLayer || 0) >= 1);
        const W = this.canvas.width;
        this.ctx.save();
        this.ctx.shadowBlur = 0;
        this.ctx.textAlign = 'center';
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.fillStyle = asleep ? '#8f8a92' : '#ff8aa8';
        this.ctx.fillText(asleep ? HUSH_LABELS.standby : HUSH_LABELS.onDuty, W / 2, 24);
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.fillStyle = asleep ? '#6a6570' : '#cf8aa0';
        this.ctx.fillText(asleep ? HUSH_LABELS.standbySub : HUSH_LABELS.onDutySub, W / 2, 46);
        this.ctx.restore();
    }

    // Heur's decontamination — Breakout played IN the sealed room, over the live snake.
    // Draws the signature database (bricks — Heur's own wears its name and is unbreakable
    // until last), the scan-ping (a diamond notched with its heading), the far-door goal
    // tint, a read-head warning outline, and a ≥16px clearance/goal banner. The player's
    // BODY is the paddle (drawn by the normal snake pass). Reduce-motion holds glows steady.
    drawHeur(state, bordersOn) {
        const h = state.heur;
        const g = this.gridSize;
        const W = this.canvas.width, H = this.canvas.height;
        const rm = !!state.reduceMotion;
        this.ctx.save();
        this.ctx.shadowBlur = 0;

        // the signature database bricks
        for (const b of h.bricks) {
            const [bx, by, bw, bh] = this._cellRect(b.c * g, b.r * g, 1, bordersOn);
            if (b.heur) {
                this.ctx.fillStyle = '#e8f4ff';
                this.ctx.fillRect(bx, by, bw, bh);
                this.ctx.fillStyle = '#26404d';
                this.ctx.font = 'bold ' + Math.max(7, Math.floor(g * 0.32)) + 'px "Press Start 2P", monospace';
                this.ctx.textAlign = 'center';
                this.ctx.fillText('H', b.c * g + g / 2, b.r * g + g * 0.66);
            } else {
                this.ctx.fillStyle = '#7fd4ff';
                this.ctx.fillRect(bx, by, bw, bh);
                // perforated texture (a11y: the same broken-wall cue as a cracked door)
                this.ctx.fillStyle = 'rgba(2, 8, 12, 0.85)';
                for (let x = bx + 3; x < bx + bw - 2; x += 6) this.ctx.fillRect(x, by + 1, 2, bh - 2);
            }
        }

        // the far-door goal seam glows faintly on the far wall (you'll leave there on a win)
        this.ctx.fillStyle = 'rgba(127, 212, 255, 0.10)';
        const band = g;
        if (h.far === 'right') this.ctx.fillRect(W - band, 0, band, H);
        else if (h.far === 'left') this.ctx.fillRect(0, 0, band, H);
        else if (h.far === 'down') this.ctx.fillRect(0, H - band, W, band);
        else this.ctx.fillRect(0, 0, W, band);

        // the scan-ping: a diamond wearing its heading as a notch (discrete steps only)
        const px = h.ping.c * g + g / 2, py = h.ping.r * g + g / 2;
        this.ctx.fillStyle = '#d84cff';
        this.ctx.shadowColor = '#d84cff';
        this.ctx.shadowBlur = rm ? 0 : 10;
        this.ctx.beginPath();
        this.ctx.moveTo(px, py - g * 0.4);
        this.ctx.lineTo(px + g * 0.4, py);
        this.ctx.lineTo(px, py + g * 0.4);
        this.ctx.lineTo(px - g * 0.4, py);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = '#2a002a';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(px, py);
        this.ctx.lineTo(px + h.ping.dc * g * 0.4, py + h.ping.dr * g * 0.4);
        this.ctx.stroke();

        // read-head warning: a steady red outline on your head when the ping is closing in
        if (h.warnHead) {
            this.ctx.strokeStyle = '#ff3b3b';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(state.headCell.x - 2, state.headCell.y - 2, g + 4, g + 4);
        }

        // (The objective banner + signature count moved to the bottom ribbon — see
        // #boss-status. In-room stays pure arena: bricks, ping, the read-head warning.)

        this.ctx.restore();
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

    // Wilds-found HUD utilities. Both are found modules (see WILDS_MODULES): the GEAR
    // METER (a tachometer — brake/0..3 as pips) bottom-right, and the SECTOR READOUT (the
    // current room's network address) top-left. Only drawn once found, and only in play
    // (not on menus/dialog overlays that own the screen).
    drawFoundHud(state) {
        if (state.gameState !== 'PLAYING' && state.gameState !== 'ENCORE') return;
        const u = state.unlocked || {};
        const W = this.canvas.width, H = this.canvas.height;
        this.ctx.save();
        this.ctx.shadowBlur = 0;

        if (u.coordReadout) {
            // top-left address readout, e.g. "SECTOR 5,-3" — clear of the top-right minimap
            // and top-centre banners; nudged below any citation strip. Drawn on a small
            // dark plate in a soft amber (NOT the wall's cyan) so it stays legible against
            // the cyan wall band + its max-speed glow.
            const txt = `SECTOR ${state.roomX},${state.roomY}`;
            const yy = 26;
            this.ctx.textAlign = 'left';
            this.ctx.font = '16px "Press Start 2P", monospace';
            const w = this.ctx.measureText(txt).width;
            this.ctx.fillStyle = 'rgba(3, 8, 6, 0.75)';
            this.ctx.fillRect(12, yy - 15, w + 8, 20);
            this.ctx.fillStyle = '#ffc234';
            this.ctx.fillText(txt, 16, yy);
        }

        // (The gear gauge moved OFF the canvas into the top ribbon, beside your Data —
        // see index.html #gear-display / Game.refreshGearDisplay. HUD stats live together.)

        // (The carried refugee shows AS a passenger on your tail — like 2-Bit — rather
        // than as a HUD label; see the snake loop's refugeeIndex face.)
        // The bounce ARG's listen window (§2.6 twin of the crack sound): Cache's back-up
        // daemon leans in for a beat after a crumple — letters typed now are HEARD.
        // Drawn only once the secret is PRIMED (you've heard 2-Bit's Cache gossip);
        // before that it read as inexplicable noise on every wall crumple.
        if ((state.argListenMs || 0) > 0 && state.argCuePrimed) {
            this.ctx.textAlign = 'center';
            this.ctx.font = '16px "Press Start 2P", monospace';
            this.ctx.fillStyle = '#00776a';
            this.ctx.fillText('. . . listening . . .', W / 2, H - 12);
        }
        this.ctx.restore();
    }

    // Draw a map-pin glyph (shape index -> shape) centred at (cx,cy) on the minimap.
    _drawPinGlyph(cx, cy, shape, color) {
        const r = 4;
        this.ctx.save();
        this.ctx.strokeStyle = color; this.ctx.fillStyle = color;
        this.ctx.lineWidth = 1.5;
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        if (shape === 0) { // diamond
            this.ctx.moveTo(cx, cy - r); this.ctx.lineTo(cx + r, cy); this.ctx.lineTo(cx, cy + r); this.ctx.lineTo(cx - r, cy); this.ctx.closePath(); this.ctx.fill();
        } else if (shape === 1) { // cross
            this.ctx.moveTo(cx - r, cy - r); this.ctx.lineTo(cx + r, cy + r); this.ctx.moveTo(cx + r, cy - r); this.ctx.lineTo(cx - r, cy + r); this.ctx.stroke();
        } else if (shape === 2) { // triangle
            this.ctx.moveTo(cx, cy - r); this.ctx.lineTo(cx + r, cy + r); this.ctx.lineTo(cx - r, cy + r); this.ctx.closePath(); this.ctx.fill();
        } else { // ring
            this.ctx.arc(cx, cy, r, 0, Math.PI * 2); this.ctx.stroke();
        }
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
    // ENVIRONMENT GLOW RIDES THE LIVE GEAR (owner direction): the neon breathes with
    // your momentum — gear 0 is a dull, dormant world; gear 3 is full bloom. (Replaces
    // the old permanent switch that flipped on at first max speed and never dimmed.)
    _frameGlow(state) {
        const P = this.pal || PAL8;
        return (Math.max(0, (state && state.gear) || 0) / 3) * P.glow;
    }

    drawNpcFeatures(npc, state) {
        const g = this.gridSize, x = npc.x, y = npc.y;
        this.ctx.shadowBlur = 0;
        if (npc.id === 'gate' || npc.id === 'gate3' || npc.id === 'gatefinal') {
            // a stern firewall visor — and, when he's a live pursuer, his next-step
            // notch (the same shape grammar as a moving Glitch: motion is telegraphed
            // by shape + position, never colour).
            this.ctx.fillStyle = '#00284d';
            this.ctx.fillRect(x + 4, y + g * 0.42, g - 8, Math.max(2, Math.round(g * 0.14)));
            if (npc.notch) {
                const ncx = x + g / 2 + npc.notch.dx * (g / 2 - 3);
                const ncy = y + g / 2 + npc.notch.dy * (g / 2 - 3);
                this.ctx.fillRect(ncx - 2, ncy - 2, 4, 4);
            }
        } else if (npc.id === 'hush') {
            // awake: open clamp-jaws (two wedges, hungry for waveforms) + its next-step
            // notch; dormant: a single flat rest-line. State is coded by SHAPE + motion
            // + the room label — never colour alone.
            const asleep = npc.dormant || (state && state.unlocked && (state.unlocked.musicLayer || 0) >= 1);
            this.ctx.fillStyle = '#2a1218';
            if (asleep) {
                this.ctx.fillRect(x + 3, y + g / 2 - 1, g - 6, 3); // the rest-line
            } else {
                this.ctx.beginPath(); // upper jaw
                this.ctx.moveTo(x + 4, y + 4); this.ctx.lineTo(x + g - 4, y + 4); this.ctx.lineTo(x + g / 2, y + g / 2 - 1);
                this.ctx.closePath(); this.ctx.fill();
                this.ctx.beginPath(); // lower jaw
                this.ctx.moveTo(x + 4, y + g - 4); this.ctx.lineTo(x + g - 4, y + g - 4); this.ctx.lineTo(x + g / 2, y + g / 2 + 1);
                this.ctx.closePath(); this.ctx.fill();
                if (npc.notch) {
                    const cx = x + g / 2 + npc.notch.dx * (g / 2 - 3);
                    const cy = y + g / 2 + npc.notch.dy * (g / 2 - 3);
                    this.ctx.fillRect(cx - 2, cy - 2, 4, 4);
                }
            }
        } else if (npc.id === 'datacache') {
            // a '+' on the crate: mass in a box
            this.ctx.fillStyle = '#5a3a00';
            this.ctx.fillRect(x + g / 2 - 1, y + 5, 3, g - 10);
            this.ctx.fillRect(x + 5, y + g / 2 - 1, g - 10, 3);
        } else if (npc.id === 'uimodule') {
            // a diagnostic MODULE — a chip with contact pins + a tool glyph keyed to what
            // it grants (tachometer arc / address dots / map pins). NO eyes: it's hardware,
            // not a character.
            this.ctx.fillStyle = '#04302e';
            // chip contact pins along top & bottom
            for (let px = x + 5; px < x + g - 4; px += 4) {
                this.ctx.fillRect(px, y + 3, 2, 2);
                this.ctx.fillRect(px, y + g - 5, 2, 2);
            }
            const cxp = x + g / 2, cyp = y + g / 2;
            if (npc.grant === 'gearMeter') {
                // a tachometer needle in a dial
                this.ctx.strokeStyle = '#04302e'; this.ctx.lineWidth = 2;
                this.ctx.beginPath(); this.ctx.arc(cxp, cyp + 2, g * 0.28, Math.PI, 0); this.ctx.stroke();
                this.ctx.beginPath(); this.ctx.moveTo(cxp, cyp + 2); this.ctx.lineTo(cxp + g * 0.18, cyp - g * 0.14); this.ctx.stroke();
            } else if (npc.grant === 'coordReadout') {
                // an address ticker: three dots
                for (let i = -1; i <= 1; i++) this.ctx.fillRect(cxp + i * 5 - 1, cyp - 1, 3, 3);
            } else {
                // map pins: a pin + a dot
                this.ctx.fillRect(cxp - 1, cyp - g * 0.22, 2, g * 0.32);
                this.ctx.beginPath(); this.ctx.arc(cxp, cyp + g * 0.16, 2.5, 0, Math.PI * 2); this.ctx.fill();
            }
        } else if (npc.id === 'lorefrag') {
            // a '?' — a fragment worth reading
            this.ctx.fillStyle = '#123a4d';
            this.ctx.font = 'bold ' + Math.max(10, Math.floor(g * 0.6)) + 'px "Press Start 2P", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('?', x + g / 2, y + g * 0.72);
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
        } else if (npc.id === 'lostverse') {
            // a little musical note — a shard of fanfare, NOT a face
            this.ctx.fillStyle = '#5a3a00';
            const sx = x + g * 0.6;
            this.ctx.fillRect(sx, y + g * 0.22, 2, g * 0.42);                 // stem
            this.ctx.fillRect(sx, y + g * 0.22, g * 0.16, 2);                 // flag
            this.ctx.fillRect(x + g * 0.34, y + g * 0.56, g * 0.24, g * 0.2); // note head
        } else if (npc.id === 'commons' || npc.id === 'minegate') {
            // DAMAGED 3x3 BUILDINGS (the intake stations are places, not people). Each
            // NPC cell knows its position in the facade (bx 0-2, by 0-2) and draws its
            // piece: a cracked roofline on top, walls and broken windows mid, a doorway
            // at bottom-centre. The minegate hangs a headframe strut over its door; the
            // commons keeps a bench by its. No eyes anywhere: architecture.
            const bx = npc.bx ?? 1, by = npc.by ?? 1;
            this.ctx.fillStyle = '#12251a';
            if (by === 0) {
                // roofline: slabs with bites missing (the quarantine years were unkind)
                if (!(npc.id === 'commons' && bx === 2)) this.ctx.fillRect(x + 1, y + g - 7, g - 2, 4);
                if (bx === 0) this.ctx.fillRect(x + 3, y + g * 0.35, g * 0.5, 3); // sagging ridge
                if (npc.id === 'minegate' && bx === 1) this.ctx.fillRect(x + g / 2 - 2, y + 2, 4, g - 4); // headframe strut
            } else if (by === 1) {
                if (bx === 0) { // left wall + broken window
                    this.ctx.fillRect(x + 2, y, 3, g);
                    this.ctx.fillRect(x + 8, y + g * 0.3, 5, 4);
                } else if (bx === 2) { // right wall + boarded window
                    this.ctx.fillRect(x + g - 5, y, 3, g);
                    this.ctx.fillRect(x + 4, y + g * 0.3, 6, 2);
                } else if (npc.id === 'minegate') { // the lift cable runs down the middle
                    this.ctx.fillRect(x + g / 2 - 1, y, 2, g);
                }
            } else {
                // ground floor: foundation line; the doorway at bottom-centre
                this.ctx.fillRect(x + 1, y + g - 5, g - 2, 3);
                if (bx === 1) {
                    this.ctx.fillRect(x + g / 2 - 4, y + 3, 8, g - 7); // the dark doorway
                } else if (bx === 0) {
                    this.ctx.fillRect(x + 3, y, 3, g - 4); // corner post
                    if (npc.id === 'commons') this.ctx.fillRect(x + 8, y + g - 9, g * 0.5, 3); // the bench
                } else {
                    this.ctx.fillRect(x + g - 6, y, 3, g - 4); // corner post
                }
            }
        } else if (npc.id === 'hydratia') {
            // HYDRATIA — the watery-cyan droplet from the boot screen (same silhouette,
            // so catching her THERE is finding her HERE), with her shy wide eyes.
            this.ctx.fillStyle = '#7ee8e0';
            this.ctx.beginPath();
            this.ctx.arc(x + g / 2, y + g * 0.58, g * 0.3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillRect(x + g / 2 - 1.5, y + g * 0.12, 3, g * 0.2); // the droplet nub
            this.ctx.fillStyle = '#0a3a36'; // eyes (she was missing them on the boot screen too)
            this.ctx.fillRect(x + g / 2 - 4, y + g * 0.52, 2.5, 2.5);
            this.ctx.fillRect(x + g / 2 + 1.5, y + g * 0.52, 2.5, 2.5);
        } else if (npc.id === 'quantcy') {
            // QUANTCY — a strongbox of a program: a vault door (ring + keyhole) worn like
            // a face, with two narrow appraising eyes above it.
            this.ctx.strokeStyle = '#3a2c00';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(x + g / 2, y + g * 0.6, g * 0.24, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.fillStyle = '#3a2c00';
            this.ctx.fillRect(x + g / 2 - 1, y + g * 0.55, 2, g * 0.14); // the keyhole
            this.ctx.fillRect(x + g / 2 - 5, y + g * 0.26, 3.5, 2);      // narrow eyes
            this.ctx.fillRect(x + g / 2 + 1.5, y + g * 0.26, 3.5, 2);
        } else if (npc.id === 'refugee') {
            // A refugee — a citizen face plus the bindle on their back (they're packed).
            this.drawEyes(x, y, '#0a1a0a');
            this.ctx.fillStyle = '#0a1a0a';
            this.ctx.fillRect(x + g - 7, y + 3, 4, 4);       // the bundle
            this.ctx.fillRect(x + g - 9, y + 6, 2, g * 0.3); // the stick
        } else {
            // eyes for bite / denny (all of him) / nibble / citizen / shop (any friendly program)
            const dennyish = npc.id === 'denny' || npc.id === 'denny2'
                || npc.id === 'dennyfinal' || npc.id === 'dennyafter';
            this.drawEyes(x, y, dennyish ? '#4a2c00' : (npc.id === 'nibble' ? '#5a2400' : '#0a1a0a'));
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
        this.ctx.shadowBlur = this._frameGlow(state);
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
        // A posted citation owns the top strip — the map slides under it.
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

        // Map-Pins annotations — the player's own marks on visited rooms (Map-Pins tool).
        // Only pinned rooms that are on the minimap (visited/in-bounds) are drawn.
        if (state.mapPins) {
            for (const key of Object.keys(state.mapPins)) {
                if (!visited.has(key)) continue;
                const [pxr, pyr] = key.split(',').map(Number);
                this._drawPinGlyph(gx(pxr), gy(pyr) - dot - 3, state.mapPins[key], '#ffd24d');
            }
        }

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
    // HYDRATIA'S GLIMPSE (boot screen): the shy persistence daemon, a watery-cyan mote at
    // the right edge. Each quick reload she's ~8% further in (stage 0..4); at stage 4 she
    // holds still and a [SPACE] prompt appears. Static per boot — no animation, so there
    // is nothing for reduce-motion to dampen; progress is coded by position + a TRACE
    // counter (never colour alone, §2.6). Silent by design (decision 3: no boot audio).
    drawHydratia(h, rm) {
        const W = this.canvas.width, H = this.canvas.height;
        const y = Math.floor(H * 0.66);
        const R = 13; // playtest: she was a 6px speck 20px off the right edge — unfindable
        this.ctx.save();
        this.ctx.shadowBlur = 14;
        this.ctx.shadowColor = '#7ee8e0';
        this.ctx.fillStyle = '#7ee8e0';
        // A droplet PEEKING from behind the right edge — the clipping IS the character
        // (she's hiding, not decorating). Each stage pulls her further into the room.
        this.ctx.beginPath();
        this.ctx.arc(h.x, y, R, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillRect(h.x - 3, y - R - 8, 6, 10); // the nub
        this.ctx.shadowBlur = 0;
        // her shy wide eyes (matching her Localhost sprite)
        this.ctx.fillStyle = '#0a3a36';
        this.ctx.fillRect(h.x - 7, y - 4, 5, 5);
        this.ctx.fillRect(h.x + 2, y - 4, 5, 5);
        // A DASHED TRACE LANE from her to the edge she bolted through: motionless (so
        // reduce-motion needs no branch) but unmistakably "something went that way".
        this.ctx.strokeStyle = 'rgba(126, 232, 224, 0.35)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 6]);
        this.ctx.beginPath();
        this.ctx.moveTo(h.x + R + 4, y);
        this.ctx.lineTo(W, y);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        // The readout — >=16px, on a dark plate so it can't wash out against the title.
        this.ctx.font = '16px "Press Start 2P", monospace';
        this.ctx.textAlign = 'right';
        const label = h.catchable ? 'TRACE 4/4 — REACHABLE' : `TRACE ${h.stage}/4`;
        const tw = this.ctx.measureText(label).width;
        this.ctx.fillStyle = 'rgba(3, 12, 12, 0.8)';
        this.ctx.fillRect(W - 16 - tw - 6, 8, tw + 12, 22);
        this.ctx.fillStyle = h.catchable ? '#7ee8e0' : '#3fa080';
        this.ctx.fillText(label, W - 20, 24);
        if (h.catchable) {
            this.ctx.textAlign = 'center';
            this.ctx.fillStyle = '#7ee8e0';
            this.ctx.fillText('[SPACE] reach out', Math.max(140, h.x - 70), y + 34);
        }
        this.ctx.restore();
    }

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
            } else if (s.autoSavedAt) {
                // No manual file, but Hydratia holds a shadow copy — say so, or the only
                // surviving record of a run would masquerade as an empty slot.
                this.ctx.fillStyle = selected ? '#7ee8e0' : '#3fa080';
                this.ctx.fillText('auto backup held — [R]', lx + body, sy);
            } else {
                this.ctx.fillStyle = selected ? '#8fbfa0' : '#5a6b60';
                this.ctx.fillText('-- new game --', lx + body, sy);
            }
        }

        // Controls prompt (two lines, at the accessibility minimum). When Hydratia's
        // shadow copy is NEWER than the selected file's manual save, offer the opt-in
        // Warm Restore ([R]) — the manual file is never auto-clobbered.
        const sel = slots[menu.index];
        const warmRestore = sel && sel.autoSavedAt && sel.autoSavedAt > (sel.savedAt || 0);
        this.ctx.textAlign = 'center';
        this.ctx.font = `${MIN_FONT}px "Press Start 2P", monospace`;
        this.ctx.fillStyle = '#00ffcc';
        this.ctx.fillText(
            sel && sel.exists
                ? (warmRestore ? 'ENTER load   R restore-auto   N new   DEL erase' : 'ENTER load   N new   DEL erase')
                : (warmRestore ? 'ENTER new game   R restore-auto' : 'ENTER  new game'),
            midX, H - body * 2.2);
        this.ctx.fillStyle = '#00885f';
        this.ctx.fillText('up/down select file     [O] accessibility', midX, H - body * 0.9);
    }

    // Cache's title-cameo sprite (her archival-blue block + eyes) — walks on and fades under
    // the control of GameEngine.updateTitleCameo; here we just paint it at the given alpha.
    drawTitleCameoSprite(s) {
        const g = this.gridSize;
        this.ctx.save();
        this.ctx.globalAlpha = Math.max(0, Math.min(1, s.alpha));
        if (s.who === 'cadenza') {
            // the diva — stage-light pink, wearing a little note instead of eyes
            this.ctx.shadowColor = '#ff66cc';
            this.ctx.shadowBlur = 12;
            this.ctx.fillStyle = '#ff66cc';
            this.ctx.fillRect(s.x, s.y, g, g);
            this.ctx.shadowBlur = 0;
            this.ctx.fillStyle = '#3a0022';
            const sx = s.x + g * 0.6;
            this.ctx.fillRect(sx, s.y + g * 0.22, 2, g * 0.42);                     // stem
            this.ctx.fillRect(sx, s.y + g * 0.22, g * 0.16, 2);                     // flag
            this.ctx.fillRect(s.x + g * 0.34, s.y + g * 0.56, g * 0.24, g * 0.2);   // note head
        } else {
            this.ctx.shadowColor = '#cfd8ff';
            this.ctx.shadowBlur = 10;
            this.ctx.fillStyle = '#cfd8ff';
            this.ctx.fillRect(s.x, s.y, g, g);
            this.drawEyes(s.x, s.y, '#1a2233');
        }
        this.ctx.restore();
    }
}
