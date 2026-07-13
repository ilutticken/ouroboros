import { GameEngine } from './engine/Game.js';

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    console.log("System booting...");
    
    const canvas = document.getElementById('game-canvas');
    
    // Make canvas full screen for the void
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Handle resize
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    const engine = new GameEngine(canvas);
    engine.start();
});
