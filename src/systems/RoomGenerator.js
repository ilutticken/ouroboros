import { NPC } from '../entities/NPC.js';
import { Glitch } from '../entities/Glitch.js';
import { DENNY_INTRO, LOCALHOST_SIGN, LOCALHOST_CITIZENS, GATE_INTRO, CADENZA_SCENE, CACHE_HOME_SCENE } from '../content/dialogue.js';

export class RoomGenerator {
    constructor(gridSize, canvas) {
        this.gridSize = gridSize;
        // Keep the LIVE canvas ref and derive the grid per access, so a window resize
        // (main.js resizeCanvas) can't leave rooms sized to a stale snapshot — which
        // stranded apples off-grid and silently moved weak points.
        this.canvas = canvas;
    }

    get cols() { return Math.floor(this.canvas.width / this.gridSize); }
    get rows() { return Math.floor(this.canvas.height / this.gridSize); }

    generateRoom(roomX, roomY, stateUnlocked, worldManager) {
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
        } else if (roomX === 1 && roomY === 0) {
            // First Wilds room — Denny, the apologetic deny-all checkpoint you route around.
            npcs.push(new NPC(cx, cy, this.gridSize, 'denny', DENNY_INTRO));
        } else if (roomX === 5 && roomY === 0) {
            // Localhost — the first Safe Zone. No hazards; a welcome sign., 
            npcs.push(new NPC(cx, cy, this.gridSize, 'signpost', LOCALHOST_SIGN));
            // The few refugee programs still here. Their chatter CROSS-HINTS at the
            // missing villagers (Cadenza SE, Nibble in the Wilds, the lost Cache),
            // echoing 2-Bit's gossip so the leads land from more than one voice. Lines live
            // in content/dialogue.js (LOCALHOST_CITIZENS); positions stay here (grid-relative).
            const C = LOCALHOST_CITIZENS;
            const town = [
                { c: 6, r: 6, lines: C.newFace },
                { c: this.cols - 7, r: 5, lines: C.cadenzaHint },
                { c: 7, r: this.rows - 6, lines: C.nibbleHint },
                { c: this.cols - 8, r: this.rows - 7, lines: C.cacheClue1 },
                { c: Math.floor(this.cols / 2) + 4, r: 6, lines: C.cacheClue2 },
            ];
            for (const t of town) {
                npcs.push(new NPC(t.c * this.gridSize, t.r * this.gridSize, this.gridSize, 'citizen', t.lines));
            }
        } else if (roomX === 3 && roomY === 0) {
            // Gate Encounter Room
            npcs.push(new NPC(cx, cy, this.gridSize, 'gate', GATE_INTRO));
            
            // Add some pillar obstacles in corners to make a small arena. Skip the
            // column Gate spawns/tracks in (center) so he can never park ON a pillar
            // and turn the scripted encounter into an unexplained obstacle-death.
            const gateCol = Math.floor(this.cols / 2);
            const oCols = [10, this.cols - 10];
            const oRows = [8, this.rows - 8];
            for (let c of oCols) {
                for (let r of oRows) {
                    if (c === gateCol) continue;
                    let ox = c * this.gridSize;
                    let oy = r * this.gridSize;
                    if (!isSafeZone(ox, oy)) obstacles.push({ x: ox, y: oy });
                }
            }
        } else if (worldManager && worldManager.landmarks && worldManager.landmarks.cadenza
                   && roomX === worldManager.landmarks.cadenza.x && roomY === worldManager.landmarks.cadenza.y) {
            // Cadenza's sealed sector — the beacon's destination. PLACEHOLDER until her
            // Sound Test minigame exists: a hazard-free room with Cadenza herself at
            // center, so following the song resolves in SOMETHING rather than an empty
            // random room that pings forever. (Beacon is silenced on arrival, Game.js.)
            npcs.push(new NPC(cx, cy, this.gridSize, 'cadenza', CADENZA_SCENE));
        } else if (worldManager && worldManager.landmarks && worldManager.landmarks.cache
                   && roomX === worldManager.landmarks.cache.x && roomY === worldManager.landmarks.cache.y) {
            // Cache's cold-storage stacks — the sector she marks on your map at the end of
            // her Hub questline. PLACEHOLDER destination (like Cadenza's) so "go find me"
            // resolves in a real scene rather than an empty room. Uses a distinct id
            // ('cachehome') so it is NOT the transient Hub apparition and reads plainly.
            npcs.push(new NPC(cx, cy, this.gridSize, 'cachehome', CACHE_HOME_SCENE));
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

                // Seed the minefield's glitches once corruption exists in the world.
                // (This gated on `firstEncounter`, which is never set anywhere — so a
                // "Glitch Minefield" reliably generated ZERO glitches. Keyed now on
                // biteProgress, matching spawnApple's own glitch gate.)
                if (stateUnlocked && stateUnlocked.biteProgress > 0) {
                    for (let k = 0; k < 5; k++) {
                        let gx = Math.floor(Math.random() * this.cols) * this.gridSize;
                        let gy = Math.floor(Math.random() * this.rows) * this.gridSize;
                        glitches.push(new Glitch(gx, gy, this.gridSize));
                    }
                }
            }
        }
        
        // Clear a straight lane through each doorway's weak point so obstacles never
        // block access to a breakable wall (weak points now vary in position).
        if (worldManager && worldManager.getWeakPoint) {
            for (const dir of ['up', 'down', 'left', 'right']) {
                const wp = worldManager.getWeakPoint(roomX, roomY, dir);
                if (!wp) continue;
                const horizontal = (dir === 'up' || dir === 'down');
                obstacles = obstacles.filter(o => {
                    const c = horizontal ? o.x : o.y;
                    return c < wp.start || c > wp.end;
                });
            }
        }

        // Always spawn one apple
        apple = this.spawnValidApple(obstacles, glitches, npcs);

        return { apple, glitches, npcs, obstacles };
    }
    
    // Find a free cell. `extraOccupied` lets callers exclude the snake body (and the
    // current apple) so nothing spawns invisibly under the worm. Random-first keeps
    // placement varied; a bounded scan fallback means a nearly-full room can't spin
    // this loop forever.
    spawnValidApple(obstacles = [], glitches = [], npcs = [], extraOccupied = []) {
        const occupied = new Set();
        const mark = (o) => { if (o) occupied.add(`${o.x},${o.y}`); };
        obstacles.forEach(mark);
        glitches.forEach(mark);
        npcs.forEach(mark);
        extraOccupied.forEach(mark);

        for (let attempt = 0; attempt < 400; attempt++) {
            const x = Math.floor(Math.random() * this.cols) * this.gridSize;
            const y = Math.floor(Math.random() * this.rows) * this.gridSize;
            if (!occupied.has(`${x},${y}`)) return { x, y };
        }
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = c * this.gridSize, y = r * this.gridSize;
                if (!occupied.has(`${x},${y}`)) return { x, y };
            }
        }
        return { x: 0, y: 0 }; // pathological: every cell occupied
    }
}
