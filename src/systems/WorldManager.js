import { RoomGenerator } from './RoomGenerator.js';

export class WorldManager {
    constructor(canvasWidth, canvasHeight, gridSize) {
        this.currentRoomX = 0;
        this.currentRoomY = 0;
        this.rooms = {};
        
        // Track boundaries. Format: 'x1,y1-x2,y2' where the smaller room comes first.
        this.brokenWalls = new Set();     // fully smashed-through (Open) boundaries
        this.wallDamage = {};             // partial crack damage per boundary (persists)
        this.wallBreakThreshold = 3;      // damage to break; one max-gear (gear 3) hit

        this.roomGenerator = new RoomGenerator(gridSize, canvasWidth, canvasHeight);
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
    
    moveBiteTowards(playerRoomX, playerRoomY) {
        if (this.biteRoomX < playerRoomX) this.biteRoomX++;
        else if (this.biteRoomX > playerRoomX) this.biteRoomX--;
        else if (this.biteRoomY < playerRoomY) this.biteRoomY++;
        else if (this.biteRoomY > playerRoomY) this.biteRoomY--;
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
        
        const newRoom = this.roomGenerator.generateRoom(this.currentRoomX, this.currentRoomY, stateUnlocked);
        this.rooms[key] = newRoom;
        return newRoom;
    }
    
    loadRoom(x, y) {
        const key = this.getRoomKey(x, y);
        if (this.rooms[key]) {
            return this.rooms[key];
        }
        return null; // Room doesn't exist yet
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
    damageWall(roomX, roomY, direction, amount) {
        const key = this.boundaryKey(roomX, roomY, direction);
        if (!key) return 0;
        this.wallDamage[key] = (this.wallDamage[key] || 0) + amount;
        return this.wallDamage[key];
    }

    getWallDamage(roomX, roomY, direction) {
        const key = this.boundaryKey(roomX, roomY, direction);
        return key ? (this.wallDamage[key] || 0) : 0;
    }
}
