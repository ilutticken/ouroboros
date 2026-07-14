import { GameEngine } from './engine/Game.js';

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    console.log("System booting...");
    
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
