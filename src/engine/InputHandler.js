export class InputHandler {
    constructor() {
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.gridSize = 20; // Default grid size
    }

    init(gridSize, onFirstInput) {
        this.gridSize = gridSize;
        window.addEventListener('keydown', (e) => this.handleInput(e, onFirstInput));
    }

    handleInput(e, onFirstInput) {
        // Only allow changing direction if we actually started moving, or to initiate movement
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
                if (this.direction.y === 0) this.nextDirection = { x: 0, y: -this.gridSize };
                break;
            case 'ArrowDown':
            case 's':
                if (this.direction.y === 0) this.nextDirection = { x: 0, y: this.gridSize };
                break;
            case 'ArrowLeft':
            case 'a':
                if (this.direction.x === 0) this.nextDirection = { x: -this.gridSize, y: 0 };
                break;
            case 'ArrowRight':
            case 'd':
                if (this.direction.x === 0) this.nextDirection = { x: this.gridSize, y: 0 };
                break;
        }
        
        if (onFirstInput) {
            onFirstInput();
        }
    }
    
    updateDirection() {
        if (this.nextDirection.x !== 0 || this.nextDirection.y !== 0) {
            this.direction = { ...this.nextDirection };
            return true;
        }
        return false;
    }

    reset() {
        this.direction = {x: 0, y: 0};
        this.nextDirection = {x: 0, y: 0};
    }
}
