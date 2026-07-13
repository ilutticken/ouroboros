export class Snake {
    constructor(startX, startY, gridSize) {
        this.gridSize = gridSize;
        this.body = [{ x: startX, y: startY }];
    }
    
    get head() {
        return this.body[0];
    }
    
    move(direction, canvasWidth, canvasHeight, bordersUnlocked) {
        const newHead = { ...this.head };
        newHead.x += direction.x;
        newHead.y += direction.y;
        
        // Unfolding Mechanic: Initially, screen wraps (no borders)
        if (!bordersUnlocked) {
            if (newHead.x < 0) newHead.x = Math.floor(canvasWidth / this.gridSize) * this.gridSize - this.gridSize;
            if (newHead.x >= canvasWidth) newHead.x = 0;
            if (newHead.y < 0) newHead.y = Math.floor(canvasHeight / this.gridSize) * this.gridSize - this.gridSize;
            if (newHead.y >= canvasHeight) newHead.y = 0;
        } else {
            // Borders are unlocked, we can die to them.
            if (newHead.x < 0 || newHead.x >= canvasWidth || newHead.y < 0 || newHead.y >= canvasHeight) {
                return false; // Died by border
            }
        }
        
        this.body.unshift(newHead);
        return true;
    }
    
    checkSelfCollision() {
        const head = this.head;
        for (let i = 1; i < this.body.length; i++) {
            if (head.x === this.body[i].x && head.y === this.body[i].y) {
                return true;
            }
        }
        return false;
    }
    
    checkAppleCollision(apple) {
        return this.head.x === apple.x && this.head.y === apple.y;
    }
    
    grow() {
        // Just don't pop the tail, handled in Game loop
    }
    
    shrink() {
        this.body.pop();
    }
    
    reset(startX, startY) {
        this.body = [{ x: startX, y: startY }];
    }
}
