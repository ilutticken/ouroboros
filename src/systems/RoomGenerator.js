import { NPC } from '../entities/NPC.js';
import { Glitch } from '../entities/Glitch.js';
import { DENNY_INTRO, LOCALHOST_SIGN, LOCALHOST_CITIZENS, GATE_INTRO, CADENZA_SCENE, CACHE_HOME_SCENE,
         WILDS_CITIZENS, LORE_FRAGS, BOOTH_LORE, ROM_VAULT, REFUGEES, QUANTCY, INTAKE } from '../content/dialogue.js';

// Fixed Wilds discovery rooms (matches the Topology Scan reference map).
// Growth caches: a one-bite mass payout ('datacache', +4 Data & +4 length) so a lap of
// the Wilds makes you longer — exploration IS progression (feeds the Encore length gate
// and gear-3 breaches). Lore fragments and wandering clue-givers populate the deep Wilds.
const GROWTH_CACHE_ROOMS = new Set(['7,-3', '9,1', '3,5', '11,-1']);

// Wilds-found UI / Pause-Menu utility modules, keyed by 'x,y' room. Each grants a HUD or
// annotation tool (see Game.npcUiModule). Suppressed once picked up (its room key is in
// unlocked.modulesFound), so it never respawns.
// {2,2} is REDLINE now (the gear meter itself became default-on with driving — a lethal
// gauge could not stay hidden behind optional exploration, §2.6). {0,5} sits inside a
// scanner pocket — the sweep-then-breach verb's first prize.
const WILDS_MODULES = {
    '2,2':  'redline',      // gear-meter enhancement: numeric speed-limit readout
    '8,2':  'coordReadout', // HUD sector-address readout
    '3,-3': 'mapPins',      // the Pause-Menu annotation tool + the first pin shape
    '2,-4': 'pinShape',     // an extra pin shape
    '7,4':  'pinShape',     // an extra pin shape
    '0,5':  'pinShape',     // the SW scanner pocket's prize
};

// Where the scattered Localhost refugees wait (the town starts EMPTY — its people fled
// into the Wilds when the Zones went up). Carry one home on your tail and deliver them
// to THE COMMONS (freed) or THE DATA MINES (the dark tally). Suppressed once delivered
// (origin key in unlocked.refugeesDelivered).
const REFUGEE_ROOMS = new Set(['4,2', '9,-2', '2,4', '10,3', '6,-3']);

// What is (statically) in a neighbouring room — the Topology Scanner's "beyond" read.
// Category-only (the peek sells the sweep verb without spoiling the find), computed from
// the fixed content registries so no room ever has to be generated to answer.
export function classifyRoomBeyond(roomX, roomY, worldManager, stateUnlocked, carriedRefugeeKey = null) {
    const key = `${roomX},${roomY}`;
    // The refugee currently RIDING YOUR TAIL isn't home — their empty origin room must
    // not echo [LIFE] for the whole carry.
    if (carriedRefugeeKey === key) return null;
    const lm = worldManager && worldManager.landmarks;
    if (lm) {
        for (const name of Object.keys(lm)) {
            if (lm[name].x === roomX && lm[name].y === roomY) return 'landmark';
        }
    }
    // Fixed story rooms that aren't landmark-registered.
    if (['0,0', '1,0', '3,0', '5,0', '5,-1', '5,-2', '5,-3', '5,-5', '10,5', '1,-5'].includes(key)) return 'landmark';
    if (WILDS_MODULES[key] && !((stateUnlocked && stateUnlocked.modulesFound) || []).includes(key)) return 'module';
    if (GROWTH_CACHE_ROOMS.has(key) || key === '8,-5') return 'cache';
    if (LORE_FRAGS[key]) return 'lore';
    if (WILDS_CITIZENS[key]) return 'someone';
    if (REFUGEE_ROOMS.has(key) && !((stateUnlocked && stateUnlocked.refugeesDelivered) || []).includes(key)) return 'someone';
    return null;
}

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
            // Localhost — the first Safe Zone. It starts EMPTY (pop. 1: the sign): its
            // people scattered into the Wilds when the Zones went up, and the town only
            // re-fills as you carry refugees home. The signpost + 2-Bit's gossip carry the
            // landmark leads a first-timer used to get from the citizens (owner call, G1).
            npcs.push(new NPC(cx, cy, this.gridSize, 'signpost', LOCALHOST_SIGN));
            // The two intake stations for a carried refugee: THE COMMONS (SW — freed) and
            // THE DATA MINE (SE — the dark tally). Bump one while carrying to deliver.
            npcs.push(new NPC(5 * this.gridSize, (this.rows - 6) * this.gridSize, this.gridSize, 'commons', INTAKE.commonsEmpty));
            npcs.push(new NPC((this.cols - 6) * this.gridSize, (this.rows - 6) * this.gridSize, this.gridSize, 'minegate', INTAKE.mineEmpty));
            // Hydratia's stall, once she's been caught on the START screen (global flag,
            // mirrored into unlocked.hydratiaFound on run start). North side — she likes
            // her back to a wall nobody comes through.
            if (stateUnlocked && stateUnlocked.hydratiaFound) {
                npcs.push(new NPC(Math.floor(this.cols / 2 - 4) * this.gridSize, 4 * this.gridSize, this.gridSize, 'hydratia', []));
            }
            // FREED refugees repopulate the town, one home per delivery, reusing the old
            // citizen voices (they're the same people — they just had to walk home).
            const C = LOCALHOST_CITIZENS;
            const homes = [
                { c: 6, r: 6, lines: C.newFace },
                { c: this.cols - 7, r: 5, lines: C.cadenzaHint },
                { c: 7, r: this.rows - 6, lines: C.nibbleHint },
                { c: this.cols - 8, r: this.rows - 7, lines: C.cacheClue1 },
                { c: Math.floor(this.cols / 2) + 4, r: 6, lines: C.cacheClue2 },
            ];
            const freed = Math.min((stateUnlocked && stateUnlocked.refugeesFreed) || 0, homes.length);
            for (let i = 0; i < freed; i++) {
                const t = homes[i];
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
        } else if (worldManager && worldManager.landmarks && worldManager.landmarks.lostverse
                   && roomX === worldManager.landmarks.lostverse.x && roomY === worldManager.landmarks.lostverse.y) {
            // Cadenza's Lost Verse — a shard of her fanfare scattered out in the Wilds. It
            // heals the "dead note" that otherwise halts the DA CAPO Encore's finale. Placed
            // only until you pick it up (gated on the flag, so it never re-spawns).
            if (!(stateUnlocked && stateUnlocked.lostVerseFound)) {
                // Off-centre — you have to look for it, not walk straight onto it.
                const lvx = Math.floor(this.cols * 0.3) * this.gridSize;
                const lvy = Math.floor(this.rows * 0.3) * this.gridSize;
                npcs.push(new NPC(lvx, lvy, this.gridSize, 'lostverse', []));
            }
        } else if (worldManager && worldManager.landmarks && worldManager.landmarks.nibble
                   && roomX === worldManager.landmarks.nibble.x && roomY === worldManager.landmarks.nibble.y) {
            // NIBBLE's black-market stall — deep-east Wilds, squatting in freed heap right
            // against the coil. Her stall is the room's fixture; a couple of parked Glitches
            // are her ambience (stock, pets, security — she'd say all three).
            npcs.push(new NPC(cx, cy, this.gridSize, 'nibble', []));
            if (stateUnlocked && stateUnlocked.biteProgress > 0) {
                glitches.push(new Glitch(4 * this.gridSize, 4 * this.gridSize, this.gridSize));
                glitches.push(new Glitch((this.cols - 5) * this.gridSize, (this.rows - 5) * this.gridSize, this.gridSize));
            }
        } else if (worldManager && worldManager.landmarks && worldManager.landmarks.quantcy
                   && roomX === worldManager.landmarks.quantcy.x && roomY === worldManager.landmarks.quantcy.y) {
            // QUANTCY'S TRUST — the Wilds bank. He stands mid-room behind an absent
            // counter; the room is otherwise ordinary Wilds (the vault is safe, the walk
            // isn't — deliberately no hazard suppression here).
            npcs.push(new NPC(cx, cy, this.gridSize, 'quantcy', QUANTCY.intro));
        } else if (worldManager && worldManager.landmarks && worldManager.landmarks.hush
                   && roomX === worldManager.landmarks.hush.x && roomY === worldManager.landmarks.hush.y) {
            // HUSH's post — the dead sound-stage corridor SE of Cadenza. Sterile: the
            // suppressor clamped everything else out of this room long ago. Two obstacle
            // rails shape a wide corridor toward the pocket door east.
            npcs.push(new NPC(cx, cy, this.gridSize, 'hush', []));
            for (let i = 4; i < this.cols - 4; i += 2) {
                const ox = i * this.gridSize;
                if (!isSafeZone(ox, 4 * this.gridSize)) obstacles.push({ x: ox, y: 4 * this.gridSize });
                if (!isSafeZone(ox, (this.rows - 5) * this.gridSize)) obstacles.push({ x: ox, y: (this.rows - 5) * this.gridSize });
            }
        } else if (roomX === 10 && roomY === 5) {
            // THE DEEP-SLEEP BOOTH — HUSH's vault, backed onto the SE coil. A lore terminal
            // and a growth cache; the room the guardian was guarding.
            npcs.push(new NPC(cx, cy - 2 * this.gridSize, this.gridSize, 'lorefrag', BOOTH_LORE));
            npcs.push(new NPC(cx, cy + 2 * this.gridSize, this.gridSize, 'datacache', []));
        } else if (WILDS_MODULES[`${roomX},${roomY}`]
                   && !((stateUnlocked && stateUnlocked.modulesFound) || []).includes(`${roomX},${roomY}`)) {
            // A found UI/diagnostic module — off-centre so you have to explore to it.
            const mx = Math.floor(this.cols * 0.4) * this.gridSize;
            const my = Math.floor(this.rows * 0.45) * this.gridSize;
            const npc = new NPC(mx, my, this.gridSize, 'uimodule', []);
            npc.grant = WILDS_MODULES[`${roomX},${roomY}`];
            npc.roomKey = `${roomX},${roomY}`;
            npcs.push(npc);
        } else if (GROWTH_CACHE_ROOMS.has(`${roomX},${roomY}`)) {
            // A growth cache — one-bite mass payout, off the spine. Exploration = length.
            const gx = Math.floor(this.cols * 0.65) * this.gridSize;
            const gy = Math.floor(this.rows * 0.35) * this.gridSize;
            npcs.push(new NPC(gx, gy, this.gridSize, 'datacache', []));
        } else if (LORE_FRAGS[`${roomX},${roomY}`] && !(roomX === 8 && roomY === -5)) {
            // A scannable environmental lore fragment (re-readable; it stays). {8,-5} is
            // excluded here: the smuggler's-hoard pocket branch below places its frag
            // TOGETHER with the mass cache.
            const lx = Math.floor(this.cols * 0.3) * this.gridSize;
            const ly = Math.floor(this.rows * 0.65) * this.gridSize;
            npcs.push(new NPC(lx, ly, this.gridSize, 'lorefrag', LORE_FRAGS[`${roomX},${roomY}`]));
        } else if (WILDS_CITIZENS[`${roomX},${roomY}`]) {
            // A wandering refugee clue-giver, out in the Wilds (they wander once Motion
            // Carried lands — same shared tick as the Localhost citizens).
            const wx = Math.floor(this.cols * 0.6) * this.gridSize;
            const wy = Math.floor(this.rows * 0.55) * this.gridSize;
            npcs.push(new NPC(wx, wy, this.gridSize, 'citizen', WILDS_CITIZENS[`${roomX},${roomY}`]));
        } else if (roomX === 1 && roomY === -5) {
            // THE ROM VAULT — the Scanner-only pocket, deep NW against the coil. One
            // hidden south door (a Scanner door); inside, the vault manifest, the sealed
            // mass cache — and now a real UPGRADE (Crumple Buffer II), so the Scanner's
            // marquee purchase pays for itself in kind. The Corrupted Save File
            // (Trading-Sequence Step 1) still moves in when that chain is built.
            npcs.push(new NPC(cx, cy - 2 * this.gridSize, this.gridSize, 'lorefrag', ROM_VAULT));
            npcs.push(new NPC(cx, cy + 2 * this.gridSize, this.gridSize, 'datacache', []));
            if (!((stateUnlocked && stateUnlocked.modulesFound) || []).includes('1,-5')) {
                const up = new NPC(cx - 3 * this.gridSize, cy, this.gridSize, 'uimodule', []);
                up.grant = 'crumple2';
                up.roomKey = '1,-5';
                npcs.push(up);
            }
        } else if (roomX === 8 && roomY === -5) {
            // THE SMUGGLER'S HOARD — the N-edge scanner pocket. A mass cache and the
            // note that teaches the sweep-first habit. (Its LORE_FRAGS entry is placed
            // here, not via the generic branch, so the pocket holds both.)
            npcs.push(new NPC(cx, cy - 2 * this.gridSize, this.gridSize, 'lorefrag', LORE_FRAGS['8,-5']));
            npcs.push(new NPC(cx, cy + 2 * this.gridSize, this.gridSize, 'datacache', []));
        } else if (REFUGEE_ROOMS.has(`${roomX},${roomY}`)
                   && !((stateUnlocked && stateUnlocked.refugeesDelivered) || []).includes(`${roomX},${roomY}`)) {
            // A scattered Localhost refugee, waiting out the quarantine. Bump to take
            // them aboard (they ride your tail like 2-Bit did); deliver at Localhost.
            const rfx = Math.floor(this.cols * 0.55) * this.gridSize;
            const rfy = Math.floor(this.rows * 0.4) * this.gridSize;
            const ref = new NPC(rfx, rfy, this.gridSize, 'refugee', REFUGEES[`${roomX},${roomY}`] || []);
            ref.roomKey = `${roomX},${roomY}`;
            npcs.push(ref);
        } else if (roomX === 5 && roomY === -2 && stateUnlocked && stateUnlocked.ascentArmed && !stateUnlocked.dennyRematchDone) {
            // THE FALL-THROUGH — Denny's rematch. Open floor: the maze is the one HE
            // stamps onto your own trail, one beat late.
            npcs.push(new NPC(cx, cy, this.gridSize, 'denny2', []));
        } else if (roomX === 5 && roomY === -3 && stateUnlocked && stateUnlocked.ascentArmed && !stateUnlocked.gateRematchDone) {
            // THE OVERRIDE — Gate's rematch. He guards the north egress and rewrites the
            // rules, one override at a time. A couple of pillars for cover.
            npcs.push(new NPC(cx, 2 * this.gridSize, this.gridSize, 'gate3', []));
            obstacles.push({ x: 6 * this.gridSize, y: Math.floor(this.rows / 2) * this.gridSize });
            obstacles.push({ x: (this.cols - 7) * this.gridSize, y: Math.floor(this.rows / 2) * this.gridSize });
        } else if (roomX === 5 && roomY === -5) {
            // PORT 0 — the Act I -> II finale arena. Gate's last stand at the door that
            // matters, one corrupted cell he refuses to touch, and Denny slipping in
            // behind you. After the paradox: Denny keeps the vigil.
            if (stateUnlocked && stateUnlocked.finaleDone) {
                npcs.push(new NPC(cx - 3 * this.gridSize, (this.rows - 4) * this.gridSize, this.gridSize, 'dennyafter', []));
            } else {
                npcs.push(new NPC(cx, 2 * this.gridSize, this.gridSize, 'gatefinal', []));
                glitches.push(new Glitch(cx + 2 * this.gridSize, 2 * this.gridSize, this.gridSize));
                npcs.push(new NPC(cx - 4 * this.gridSize, (this.rows - 3) * this.gridSize, this.gridSize, 'dennyfinal', []));
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

                // Seed the minefield's glitches once corruption exists in the world.
                // (This gated on `firstEncounter`, which is never set anywhere — so a
                // "Glitch Minefield" reliably generated ZERO glitches. Keyed now on
                // biteProgress, matching spawnApple's own glitch gate.)
                if (stateUnlocked && stateUnlocked.biteProgress > 0) {
                    const cHi = Math.max(1, this.cols - 2), rHi = Math.max(1, this.rows - 2);
                    for (let k = 0; k < 5; k++) {
                        // interior only — never in the outer wall ring
                        let gx = (1 + Math.floor(Math.random() * cHi)) * this.gridSize;
                        let gy = (1 + Math.floor(Math.random() * rHi)) * this.gridSize;
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
    
    // Find a free cell WITHIN THE PLAYABLE INTERIOR — cells [1, cols-2] x [1, rows-2],
    // never the outer 1-cell WALL RING (so nothing spawns "inside the wall"). `extraOccupied`
    // lets callers exclude the snake body (and the current apple) so nothing spawns invisibly
    // under the worm. Random-first keeps placement varied; a bounded scan fallback means a
    // nearly-full room can't spin this loop forever.
    spawnValidApple(obstacles = [], glitches = [], npcs = [], extraOccupied = []) {
        const occupied = new Set();
        const mark = (o) => { if (o) occupied.add(`${o.x},${o.y}`); };
        obstacles.forEach(mark);
        glitches.forEach(mark);
        npcs.forEach(mark);
        extraOccupied.forEach(mark);

        const cLo = 1, cHi = Math.max(1, this.cols - 2), rLo = 1, rHi = Math.max(1, this.rows - 2);
        for (let attempt = 0; attempt < 400; attempt++) {
            const c = cLo + Math.floor(Math.random() * (cHi - cLo + 1));
            const r = rLo + Math.floor(Math.random() * (rHi - rLo + 1));
            const x = c * this.gridSize, y = r * this.gridSize;
            if (!occupied.has(`${x},${y}`)) return { x, y };
        }
        for (let r = rLo; r <= rHi; r++) {
            for (let c = cLo; c <= cHi; c++) {
                const x = c * this.gridSize, y = r * this.gridSize;
                if (!occupied.has(`${x},${y}`)) return { x, y };
            }
        }
        return { x: this.gridSize, y: this.gridSize }; // pathological: every interior cell occupied
    }
}
