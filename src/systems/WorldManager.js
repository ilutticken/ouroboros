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

        // Boundaries that MUST have a weak point, so the world is always traversable
        // regardless of the per-wall hashing below. Built as guaranteed corridors of
        // adjacent boundaries via _carvePath.
        this.mainPath = new Set();
        // 1) The guided spine: Hub -> Localhost, the first Safe Zone.
        this._carvePath(0, 0, 5, 0);

        // 2) Landmark sectors that must never be walled off. Each character's home
        // gets a guaranteed corridor carved from Localhost [5,0], so the random
        // per-wall culling can't strand anyone behind solid walls. This is the
        // "guaranteed path to everyone" system — register a room here (once the
        // character has a home) and its route auto-generates.
        this.landmarks = {
            cadenza: { x: 8, y: 3 }, // the sealed singer, southeast of Localhost
            // nibble: { x: ?, y: ? }, // black-market stall, deep Wilds — add when built
            // cache:  { x: ?, y: ? }, // the lost archivist — add when built
        };
        for (const room of Object.values(this.landmarks)) {
            this._carvePath(5, 0, room.x, room.y);
        }

        this.roomGenerator = new RoomGenerator(gridSize, canvas);
    }

    // Safe Zones are hazard-free by contract (no Glitch may spawn/persist here).
    // Localhost [5,0] today; extend as more towns are added.
    isSafeZone(roomX, roomY) {
        return roomX === 5 && roomY === 0;
    }

    // Force a weak point on every boundary along an L-shaped room route (all the
    // horizontal steps, then the vertical steps) from (ax,ay) to (bx,by) by adding
    // each boundary key to mainPath. Guarantees the whole route is breach-able.
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

        const h = this._hash(key);
        // Main-path walls always have a weak point; ~55% of the rest do.
        if (!this.mainPath.has(key) && (h % 100) >= 55) return null;

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
}
