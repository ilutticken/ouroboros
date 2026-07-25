import { GameEngine } from './engine/Game.js';

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    // No console banner here: the system speaks through the Architect's terminal or not
    // at all, and the game boots SILENT by design.
    const canvas = document.getElementById('game-canvas');
    const wrapper = document.getElementById('game-wrapper');
    
    const resizeCanvas = () => {
        canvas.width = wrapper.clientWidth;
        canvas.height = wrapper.clientHeight;
    };
    
    resizeCanvas();
    
    // Handle resize
    window.addEventListener('resize', resizeCanvas);

    const engine = new GameEngine(canvas);
    engine.start();
});
