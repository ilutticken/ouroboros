import { GameEngine } from './engine/Game.js';
import { LOGICAL_W, LOGICAL_H } from './config.js';

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    // No console banner here: the system speaks through the Architect's terminal or not
    // at all, and the game boots SILENT by design.
    const canvas = document.getElementById('game-canvas');
    const wrapper = document.getElementById('game-wrapper');

    // THE BACKBUFFER IS FIXED. Every player gets the same board (see config.js); the
    // window only decides how big that board is DRAWN. Set once, never on resize — so the
    // old hazard where shrinking the window stranded the whole worm outside the new wall
    // ring simply cannot happen any more.
    canvas.width = LOGICAL_W;
    canvas.height = LOGICAL_H;

    // ...AND IT SCALES LIKE A CONSOLE, NOT LIKE A TEXTURE: whole-number multiples only,
    // nearest-neighbour, aspect preserved, centred, letterboxed. A fractional scale would
    // make some pixels 2 screen-px wide and their neighbours 3, which is the exact shimmer
    // that makes upscaled pixel art look cheap. Integer steps keep every cell identical.
    //
    // The one concession: if even 1x will not fit (a very small window), fall back to a
    // fractional CONTAIN. Cropping the play field is never acceptable — a wall you cannot
    // see is a wall that kills you — so a slightly soft picture is the right trade.
    const fitCanvas = () => {
        const availW = wrapper.clientWidth, availH = wrapper.clientHeight;
        if (!availW || !availH) return;
        const raw = Math.min(availW / LOGICAL_W, availH / LOGICAL_H);
        const scale = raw >= 1 ? Math.floor(raw) : raw;
        canvas.style.width = `${Math.round(LOGICAL_W * scale)}px`;
        canvas.style.height = `${Math.round(LOGICAL_H * scale)}px`;
    };

    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    const engine = new GameEngine(canvas);
    engine.start();
});
