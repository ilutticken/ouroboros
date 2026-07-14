export class InputHandler {
    constructor() {
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.gridSize = 20; // Default grid size
        this.brakePressed = false;
    }

    init(gridSize, onFirstInput, onDialogAdvance) {
        this.gridSize = gridSize;
        window.addEventListener('keydown', (e) => this.handleKeyDown(e, onFirstInput, onDialogAdvance));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e, onFirstInput, onDialogAdvance) {
        if (e.key === ' ' || e.key === 'Enter') {
            if (onDialogAdvance) onDialogAdvance();
        }
        if (e.key === 'Shift') {
            this.brakePressed = true;
        }
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
    
    handleKeyUp(e) {
        if (e.key === 'Shift') {
            this.brakePressed = false;
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
