export class InputHandler {
    constructor() {
        this.direction = { x: 0, y: 0 };
        this.nextDirection = { x: 0, y: 0 };
        this.gridSize = 20; // Default grid size
        // Predicate: is the sim live enough to accept steering? Set in init(); a
        // permissive default keeps unit tests that drive input directly working.
        this.canSteer = () => true;
        // Predicate: is the worm currently a PADDLE (Heur's Purge)? In paddle mode a
        // press always steers — horizontal reversals included (the no-180 grammar
        // protects a snake's neck; a paddle has no neck) — and gear taps don't exist.
        this.isPaddleMode = () => false;
    }

    init(gridSize, onFirstInput, onDialogAdvance, onAction, onSpeedChange, canSteer, isPaddleMode) {
        this.gridSize = gridSize;
        if (canSteer) this.canSteer = canSteer;
        if (isPaddleMode) this.isPaddleMode = isPaddleMode;
        window.addEventListener('keydown', (e) => this.handleKeyDown(e, onFirstInput, onDialogAdvance, onAction, onSpeedChange));
    }

    handleKeyDown(e, onFirstInput, onDialogAdvance, onAction, onSpeedChange) {
        if (e.key === ' ' || e.key === 'Enter') {
            // A Space/Enter that DISMISSES a dialog is consumed — it must not also fire
            // the gameplay action on the same press. (That auto-triggered 2-Bit's
            // consent the instant you closed his offer, so the choice could never be
            // read or declined.) onDialogAdvance returns true when it handled a dialog.
            let consumed = false;
            if (onDialogAdvance) consumed = !!onDialogAdvance();
            if (!consumed && onAction) onAction();
        }

        // Wake/skip FIRST, so a key pressed on the START or DEAD screen flips the state
        // to PLAYING before the steering check below — otherwise that same press
        // couldn't also set the initial direction.
        if (onFirstInput) onFirstInput();

        // Steering + gear only while the sim is actually live. This drops keys pressed
        // during a dialog / pause / terminal print / module-install freeze, which used
        // to buffer silently and fire the instant play resumed (an unexpected turn or a
        // sneaked-through gear change).
        if (!this.canSteer()) return;

        // Normalize single-character keys so WASD works regardless of CapsLock / Shift
        // (arrow keys are multi-character and pass through unchanged).
        const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

        // PADDLE MODE (Heur's Purge): every direction press steers directly — no
        // reversal guard, no gear routing. The paddle slides/aims; it cannot bite itself.
        if (this.isPaddleMode()) {
            switch (key) {
                case 'ArrowUp': case 'w': this.nextDirection = { x: 0, y: -this.gridSize }; break;
                case 'ArrowDown': case 's': this.nextDirection = { x: 0, y: this.gridSize }; break;
                case 'ArrowLeft': case 'a': this.nextDirection = { x: -this.gridSize, y: 0 }; break;
                case 'ArrowRight': case 'd': this.nextDirection = { x: this.gridSize, y: 0 }; break;
            }
            return;
        }

        switch (key) {
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
