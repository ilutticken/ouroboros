import { RoomGenerator } from './RoomGenerator.js';

export class WorldManager {
    constructor(canvas, gridSize) {
        this.currentRoomX = 0;
        this.currentRoomY = 0;
        this.rooms = {};
        this.gridSize = gridSize;
        // Keep the live canvas so getWeakPoint reads the SAME dimensions the
        // collision check does (Game reads this.canvas.width/height live), rather
        // than a snapshot that would drift out of sync on a window resize.
        this.canvas = canvas;

        // Track boundaries. Format: 'x1,y1-x2,y2' where the smaller room comes first.
        this.brokenWalls = new Set();     // fully smashed-through (Open) boundaries
        this.wallDamage = {};             // partial crack damage per boundary (persists)
        this.wallBreakThreshold = 3;      // damage to break; one max-gear (gear 3) hit
        this.scannerReveals = {};         // boundaryKey -> remaining ms a scanner sweep keeps a HIDDEN weak point visible

        // THE FINITE WILDS. The Void is bounded: a playable interior wrapped by the
        // Kernel's coil — an unbreakable, lethal ring of deep-red, slowly-creeping
        // blocks (the sleeper's own body, wound around everything it ate). Any wall
        // that faces outside these bounds is coil: no weak point, ever. Matches the
        // approved Topology Scan reference map (interior 12 wide x 11 tall; the coil
        // ring rides just outside at x=-1, x=12, y=-6, y=6).
        this.bounds = { minX: 0, maxX: 11, minY: -5, maxY: 5 };

        // Boundaries that MUST have a weak point, so the world is always traversable
        // regardless of the per-wall hashing below (guaranteed-REACHABLE). Built as
        // guaranteed corridors of adjacent boundaries via _carvePath.
        this.mainPath = new Set();
        // SCRIPTED DOORS — a fixed, CENTRED weak-point span that never moves and never
        // vanishes, independent of the mutable romSealed set below. The checkpoint seam
        // must stay put across Cache's unseal: if its geometry came from romSealed (which
        // she removes), lifting write-protection would teleport the door to a hash offset
        // (or delete it) — the player would sweep/ram the centre where they saw the seam
        // and hit nothing, soft-locking the finale. scriptedDoors owns the geometry;
        // romSealed owns only ram-ability.
        this.scriptedDoors = new Set([
            this.boundaryKey(5, -4, 'up'),  // Cold Storage -> Port 0: the checkpoint seam
        ]);
        // Boundaries that can NEVER be breached by ramming while listed — write-protected
        // (Cache's checkpoint door until she commits your save). A ram is a harmless bonk.
        this.romSealed = new Set([
            this.boundaryKey(5, -4, 'up'),
        ]);
        this._baseRomSealed = new Set(this.romSealed);
        // SCANNER DOORS — the only hidden weak points in the game. Ordinary doors are
        // always visible; the Topology Scanner exists for THESE: the finale door out of
        // Cold Storage, the Deep-Sleep Booth pocket, and the ROM Vault. Hidden until
        // swept (or ram-damaged, or broken).
        this.scannerDoors = new Set([
            this.boundaryKey(5, -4, 'up'),   // Cold Storage -> Port 0 (the Act II door)
            this.boundaryKey(9, 4, 'right'), // HUSH's post -> the Booth corridor
            this.boundaryKey(10, 4, 'down'), // corridor -> the Booth
            this.boundaryKey(1, -5, 'down'), // the ROM Vault's one door (from {1,-4})
        ]);
        // Pocket architecture: force these walls SOLID so the Booth is only enterable
        // through HUSH's post ({9,4} -> {10,4} -> {10,5}) and the Vault only from the
        // south; force the pocket doors themselves to EXIST (hash-proof).
        this.forcedSolid = new Set([
            this.boundaryKey(10, 5, 'left'),  // {9,5}-{10,5}
            this.boundaryKey(10, 5, 'right'), // {10,5}-{11,5}
            this.boundaryKey(10, 4, 'up'),    // {10,3}-{10,4}
            this.boundaryKey(10, 4, 'right'), // {10,4}-{11,4}
            this.boundaryKey(1, -5, 'left'),  // {0,-5}-{1,-5}
            this.boundaryKey(1, -5, 'right'), // {1,-5}-{2,-5}
        ]);
        this.forcedWeak = new Set([
            this.boundaryKey(9, 4, 'right'),  // HUSH's post -> the pocket corridor
            this.boundaryKey(10, 4, 'down'),  // corridor -> the Booth
            this.boundaryKey(1, -5, 'down'),  // the Vault's south door
        ]);

        // 1) The guided spine: Hub -> Localhost, the first Safe Zone.
        this._carvePath(0, 0, 5, 0);

        // 2) Landmark sectors that must never be walled off. Each character's home
        // gets a guaranteed corridor of ordinary, VISIBLE doors carved from Localhost
        // [5,0], so the random per-wall culling can't strand anyone. Register a room
        // here (once the character has a home) and its route auto-generates. Cache's
        // corridor deliberately doglegs up the x=4 column — the Ascent's rematch posts
        // at {5,-2}/{5,-3} sit on the direct x=5 line, and no fight may ever block the
        // road to the archivist.
        this.landmarks = {
            cadenza: { x: 8, y: 3 }, // the sealed singer, southeast of Localhost
            cache: { x: 5, y: -4 },  // the archivist's cold storage, north of Localhost (carved via x=4)
            lostverse: { x: 10, y: 1 }, // a shard of Cadenza's fanfare, out in the Wilds (heals her dead note)
            nibble: { x: 11, y: -4 },   // the black-market stall, deep-east Wilds (freed heap, on the coil edge)
            hush: { x: 9, y: 4 },       // the feral feedback-suppressor, SE past Cadenza (guards the Booth)
        };
        for (const [name, room] of Object.entries(this.landmarks)) {
            if (name === 'cache') continue; // carved via BOTH routes below
            this._carvePath(5, 0, room.x, room.y);
        }
        // TWO guaranteed routes to Cache, so the fights never block the save point but
        // the intended sequence still happens:
        //  (a) the FIGHT GAUNTLET straight up x=5 — Localhost -> Denny rematch {5,-2} ->
        //      Gate rematch {5,-3} -> Cold Storage {5,-4}. Every rung guaranteed so the
        //      canonical "run-in with each again" is always climbable (the hash left the
        //      first rungs solid, stranding the rematches on the direct line).
        this._carvePath(5, 0, 5, -4);
        //  (b) the BYPASS — west to the x=4 column, up, and east into Cold Storage,
        //      skipping every fight room (the "I just need to save" side door).
        this._carvePath(5, 0, 4, -4);
        this._carvePath(4, -4, 5, -4);

        // 3) CONNECTIVITY PASS: the per-wall hash seals ~45% of boundaries, which left
        // whole pockets of the finite interior unreachable in every playthrough (the
        // hash is deterministic — including a registered lore room). Flood-fill from
        // the Hub and stitch every stranded pocket in with a guaranteed door, so "the
        // world is always traversable" is true by construction. Deterministic: scan
        // order fixes which wall opens.
        this._ensureConnectivity();

        this.roomGenerator = new RoomGenerator(gridSize, canvas);
    }

    // Restore the ROM seals to their constructor baseline (a fresh run's checkpoint
    // door is write-protected again).
    resetRomSeals() {
        this.romSealed = new Set(this._baseRomSealed);
    }

    // Cache's save-commit lifts the write-protection on a ROM door: it stays a hidden
    // Scanner door, but a max-gear ram can now breach it like any weak point.
    unsealRomDoor(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (key) this.romSealed.delete(key);
    }

    // Open a scripted doorway on demand (Heur's far door on a win): guarantee a real,
    // centred, visible weak point on that wall (scriptedDoors) and breach it, so the
    // player walks straight out — even on a wall the hash had left solid.
    openScriptedDoor(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return;
        if (this.isCoilWall(roomX, roomY, direction)) return; // never punch the Kernel's coil
        this.scriptedDoors.add(key);
        this.brokenWalls.add(key);
    }

    // Can this boundary be opened by adding it to mainPath? (getWeakPoint checks the
    // Hub seal, the coil, forcedSolid, and romSealed BEFORE mainPath — carving any of
    // those would silently do nothing.)
    _isCarvable(roomX, roomY, direction) {
        if (this.isCoilWall(roomX, roomY, direction)) return false;
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return false;
        if (key.startsWith('0,0-') || key.endsWith('-0,0')) return false; // the Hub stays sealed but for its east door
        if (this.forcedSolid.has(key)) return false;
        if (this.romSealed.has(key)) return false;
        return true;
    }

    // Flood-fill the interior over weak-point existence; while any room is stranded,
    // open ONE hidden door between the first stranded room (scan order) and a reached
    // neighbour, then re-flood. Terminates: every pass connects at least one room.
    _ensureConnectivity() {
        const b = this.bounds;
        const dirs = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];
        const passable = (x, y, dir) => !!this.getWeakPoint(x, y, dir);
        for (let guard = 0; guard < 400; guard++) {
            const reached = new Set(['0,0']);
            const queue = [[0, 0]];
            while (queue.length) {
                const [x, y] = queue.pop();
                for (const [dir, dx, dy] of dirs) {
                    const nx = x + dx, ny = y + dy;
                    if (nx < b.minX || nx > b.maxX || ny < b.minY || ny > b.maxY) continue;
                    const k = `${nx},${ny}`;
                    if (reached.has(k) || !passable(x, y, dir)) continue;
                    reached.add(k);
                    queue.push([nx, ny]);
                }
            }
            let opened = false;
            outer:
            for (let y = b.minY; y <= b.maxY; y++) {
                for (let x = b.minX; x <= b.maxX; x++) {
                    if (reached.has(`${x},${y}`)) continue;
                    for (const [dir, dx, dy] of dirs) {
                        const nx = x + dx, ny = y + dy;
                        if (nx < b.minX || nx > b.maxX || ny < b.minY || ny > b.maxY) continue;
                        if (!reached.has(`${nx},${ny}`)) continue;
                        if (!this._isCarvable(x, y, dir)) continue;
                        this.mainPath.add(this.boundaryKey(x, y, dir)); // hidden, guaranteed
                        opened = true;
                        break outer;
                    }
                }
            }
            if (!opened) return; // fully connected (or nothing more can open — shouldn't happen)
        }
    }

    // Is the wall leaving (roomX,roomY) in `direction` part of the Kernel's coil —
    // i.e. does it face outside the finite playable interior? Coil walls are solid,
    // unbreakable, lethal, and rendered as the sleeper's deep-red segmented body.
    isCoilWall(roomX, roomY, direction) {
        let toX = roomX, toY = roomY;
        if (direction === 'up') toY -= 1;
        else if (direction === 'down') toY += 1;
        else if (direction === 'left') toX -= 1;
        else if (direction === 'right') toX += 1;
        const b = this.bounds;
        return toX < b.minX || toX > b.maxX || toY < b.minY || toY > b.maxY;
    }

    // Is a wall a ROM-sealed scripted door (bonk-proof; only breakWall opens it)?
    isRomSealed(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        return key ? this.romSealed.has(key) : false;
    }


    // Safe Zones are hazard-free by contract (no Glitch may spawn/persist here).
    // Localhost [5,0] today; extend as more towns are added.
    isSafeZone(roomX, roomY) {
        return roomX === 5 && roomY === 0;
    }

    // Force a weak point on every boundary along an L-shaped room route (all the
    // horizontal steps, then the vertical steps) from (ax,ay) to (bx,by) by adding
    // each boundary key to mainPath (guaranteed-reachable, ordinary visible doors).
    // NOTE: getWeakPoint seals every Hub wall except 0,0-1,0 no matter what, so keep
    // guaranteed routes clear of the Hub's other three sides.
    _carvePath(ax, ay, bx, by) {
        let x = ax, y = ay;
        while (x !== bx) {
            const dir = bx > x ? 'right' : 'left';
            this.mainPath.add(this.boundaryKey(x, y, dir));
            x += bx > x ? 1 : -1;
        }
        while (y !== by) {
            const dir = by > y ? 'down' : 'up';
            this.mainPath.add(this.boundaryKey(x, y, dir));
            y += by > y ? 1 : -1;
        }
    }

    // Deterministic 32-bit hash (FNV-1a) so weak points are stable per boundary.
    _hash(str) {
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    // The weak point on a wall as { start, end } — grid-aligned cell top-lefts of a
    // 5-cell breakable segment (end = start + 4*gridSize) — or null if the wall is
    // SOLID. Deterministic + symmetric per boundary; existence AND position vary per
    // wall, so you can't line up one row and smash straight through the Wilds.
    getWeakPoint(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return null;
        const g = this.gridSize;
        const horizontal = (direction === 'up' || direction === 'down');
        const dim = horizontal ? this.canvas.width : this.canvas.height;

        // Hub quarantine: only the Hub<->[1,0] wall is weak (a central crack); every
        // other Hub wall is solid.
        if (key === '0,0-1,0') {
            const mid = Math.floor(dim / 2 / g) * g;
            return { start: mid - 2 * g, end: mid + 2 * g };
        }
        if (key.startsWith('0,0-') || key.endsWith('-0,0')) return null;

        // The Kernel's coil: any wall facing outside the finite interior is solid,
        // always — the outer ring can never grow a door.
        if (this.isCoilWall(roomX, roomY, direction)) return null;

        // Pocket architecture: force-sealed walls have no weak point no matter the hash.
        if (this.forcedSolid.has(key)) return null;

        // Scripted centred doors (Cache's checkpoint seam): a REAL, stable, CENTRED span
        // whether or not it's currently write-protected — so the door never moves or
        // vanishes when romSealed changes. Whether ramming can crack it is a separate
        // question (crossBorder consults isRomSealed).
        if (this.scriptedDoors.has(key)) {
            const mid = Math.floor(dim / 2 / g) * g;
            return { start: mid - 2 * g, end: mid + 2 * g };
        }

        const h = this._hash(key);
        // Forced/main-path walls always have a weak point; ~55% of the rest do.
        if (!this.forcedWeak.has(key) && !this.mainPath.has(key) && (h % 100) >= 55) return null;

        const cells = Math.floor(dim / g);
        const wpCells = 5;
        const maxStart = Math.max(1, cells - wpCells - 1);
        const startCell = 1 + ((h >>> 8) % maxStart); // off the very corner
        const start = startCell * g;
        return { start, end: start + (wpCells - 1) * g };
    }

    // Canonical key for the boundary leaving room (roomX,roomY) in `direction`.
    // Symmetric: the same wall has the same key from either adjoining room.
    boundaryKey(roomX, roomY, direction) {
        let toX = roomX;
        let toY = roomY;
        if (direction === 'up') toY -= 1;
        else if (direction === 'down') toY += 1;
        else if (direction === 'left') toX -= 1;
        else if (direction === 'right') toX += 1;
        else return null;

        if (roomX < toX || (roomX === toX && roomY < toY)) {
            return `${roomX},${roomY}-${toX},${toY}`;
        }
        return `${toX},${toY}-${roomX},${roomY}`;
    }
    
    getRoomKey(x, y) {
        return `${x},${y}`;
    }
    
    saveRoom(apple, glitches, npcs, obstacles) {
        const key = this.getRoomKey(this.currentRoomX, this.currentRoomY);
        this.rooms[key] = { apple, glitches, npcs, obstacles };
    }
    
    getOrCreateRoom(stateUnlocked) {
        const key = this.getRoomKey(this.currentRoomX, this.currentRoomY);
        if (this.rooms[key]) {
            return this.rooms[key];
        }
        
        const newRoom = this.roomGenerator.generateRoom(this.currentRoomX, this.currentRoomY, stateUnlocked, this);
        this.rooms[key] = newRoom;
        return newRoom;
    }
    
    shiftRoom(dx, dy) {
        this.currentRoomX += dx;
        this.currentRoomY += dy;
    }
    
    breakWall(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (key) this.brokenWalls.add(key);
    }

    isWallBroken(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        return key ? this.brokenWalls.has(key) : false;
    }

    // Add crack damage to a weak point; returns the new accumulated total.
    // Optional `cap` clamps the retained damage (sub-smashing keeps SOME crack but
    // can never reach the break threshold — only a max-gear hit breaches).
    damageWall(roomX, roomY, direction, amount, cap) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return 0;
        let d = (this.wallDamage[key] || 0) + amount;
        if (cap !== undefined) d = Math.min(d, cap);
        this.wallDamage[key] = d;
        return d;
    }

    getWallDamage(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        return key ? (this.wallDamage[key] || 0) : 0;
    }

    // --- Hidden weak points & the Topology Scanner ---------------------------------
    // Ordinary weak points are ALWAYS visible — doors are doors; the game must be
    // navigable without any tool. Only the registered SCANNER DOORS (the Cold Storage
    // finale door, the Booth pocket, the ROM Vault) render as solid wall until a
    // Scanner sweep lights them up, they take ram damage (cracked visible), or
    // they've been smashed open.
    isWeakPointRevealed(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return false;
        if (!this.scannerDoors.has(key)) return true;
        if (this.brokenWalls.has(key)) return true;
        if ((this.wallDamage[key] || 0) > 0) return true;
        return (this.scannerReveals[key] || 0) > 0;
    }

    // A Scanner sweep lights a hidden weak point for `ms` (takes the longer of any
    // existing reveal, so re-sweeping extends it).
    revealWeakPoint(roomX, roomY, direction, ms) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return;
        this.scannerReveals[key] = Math.max(this.scannerReveals[key] || 0, ms);
    }

    // Remaining reveal time (ms) for the Renderer's "freshly scanned" pulse. 0 if none.
    scannerRevealRemaining(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        return key ? (this.scannerReveals[key] || 0) : 0;
    }

    // Count down active scanner reveals; call once per frame with dt (ms).
    tickReveals(dt) {
        for (const key of Object.keys(this.scannerReveals)) {
            const left = this.scannerReveals[key] - dt;
            if (left <= 0) delete this.scannerReveals[key];
            else this.scannerReveals[key] = left;
        }
    }
}
