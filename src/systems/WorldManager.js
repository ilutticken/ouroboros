import { RoomGenerator } from './RoomGenerator.js';

export class WorldManager {
    constructor(canvasWidth, canvasHeight, gridSize) {
        this.currentRoomX = 0;
        this.currentRoomY = 0;
        this.rooms = {};
        
        // Track broken boundaries. Format: 'x1,y1-x2,y2' where x1<=x2 and y1<=y2
        this.brokenWalls = new Set();
        
        this.roomGenerator = new RoomGenerator(gridSize, canvasWidth, canvasHeight);
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
    
    breakWall(fromX, fromY, toX, toY) {
        // Ensure consistent key ordering
        let key = '';
        if (fromX < toX || (fromX === toX && fromY < toY)) {
            key = `${fromX},${fromY}-${toX},${toY}`;
        } else {
            key = `${toX},${toY}-${fromX},${fromY}`;
        }
        this.brokenWalls.add(key);
    }
    
    isWallBroken(roomX, roomY, direction) {
        let toX = roomX;
        let toY = roomY;
        
        if (direction === 'up') toY -= 1;
        else if (direction === 'down') toY += 1;
        else if (direction === 'left') toX -= 1;
        else if (direction === 'right') toX += 1;
        else return false;
        
        let key = '';
        if (roomX < toX || (roomX === toX && roomY < toY)) {
            key = `${roomX},${roomY}-${toX},${toY}`;
        } else {
            key = `${toX},${toY}-${roomX},${roomY}`;
        }
        
        return this.brokenWalls.has(key);
    }
}
