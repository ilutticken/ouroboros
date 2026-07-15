export class InputHandler {
    constructor() {
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.gridSize = 20; // Default grid size
        this.brakePressed = false;
    }

    init(gridSize, onFirstInput, onDialogAdvance, onAction, onSpeedChange) {
        this.gridSize = gridSize;
        window.addEventListener('keydown', (e) => this.handleKeyDown(e, onFirstInput, onDialogAdvance, onAction, onSpeedChange));
    }

    handleKeyDown(e, onFirstInput, onDialogAdvance, onAction, onSpeedChange) {
        if (e.key === ' ' || e.key === 'Enter') {
            if (onDialogAdvance) onDialogAdvance();
            if (onAction) onAction();
        }
        
        switch(e.key) {
            case 'ArrowUp':
            case 'w':
                if (this.direction.y === 0) this.nextDirection = { x: 0, y: -this.gridSize };
                else if (this.direction.y < 0 && onSpeedChange) onSpeedChange(1);
                else if (this.direction.y > 0 && onSpeedChange) onSpeedChange(-1);
                break;
            case 'ArrowDown':
            case 's':
                if (this.direction.y === 0) this.nextDirection = { x: 0, y: this.gridSize };
                else if (this.direction.y > 0 && onSpeedChange) onSpeedChange(1);
                else if (this.direction.y < 0 && onSpeedChange) onSpeedChange(-1);
                break;
            case 'ArrowLeft':
            case 'a':
                if (this.direction.x === 0) this.nextDirection = { x: -this.gridSize, y: 0 };
                else if (this.direction.x < 0 && onSpeedChange) onSpeedChange(1);
                else if (this.direction.x > 0 && onSpeedChange) onSpeedChange(-1);
                break;
            case 'ArrowRight':
            case 'd':
                if (this.direction.x === 0) this.nextDirection = { x: this.gridSize, y: 0 };
                else if (this.direction.x > 0 && onSpeedChange) onSpeedChange(1);
                else if (this.direction.x < 0 && onSpeedChange) onSpeedChange(-1);
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
