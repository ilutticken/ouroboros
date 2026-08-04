import { GameEngine } from './engine/Game.js';
import { LOGICAL_W, LOGICAL_H, computeFit } from './config.js';

// Entry point
document.addEventListener('DOMContentLoaded', () => {
    // No console banner here: the system speaks through the Architect's terminal or not
    // at all, and the game boots SILENT by design.
    const canvas = document.getElementById('game-canvas');
    const cabinet = document.getElementById('cabinet');

    // THE BACKBUFFER IS FIXED. Every player gets the same board (see config.js); the
    // window only decides how big that board is DRAWN. Set once, never on resize — so the
    // old hazard where shrinking the window stranded the whole worm outside the new wall
    // ring simply cannot happen any more.
    canvas.width = LOGICAL_W;
    canvas.height = LOGICAL_H;

    // ...AND THE WHOLE CABINET SCALES LIKE A CONSOLE, NOT LIKE A TEXTURE: whole-number
    // multiples, nearest-neighbour, aspect preserved, centred, letterboxed.
    //
    // What gets sized here is the CABINET, not just the canvas — see config.js. Sizing the
    // board alone left the HUD pinned to the window's corners and the dialog box overhanging
    // the play field, because those elements were still measuring the viewport. Now #cabinet
    // is exactly the board's width, so `space-between` in the top ribbon means the BOARD's
    // corners, and every overlay percentage is a percentage of the BOARD.
    //
    // --ui-scale rides along so ribbon type and pips grow with the picture: at 2x a 16px
    // readout beside a 2000px-wide field would be a speck. It never drops below 1 (§2.6).
    const fitCanvas = () => {
        const availW = document.documentElement.clientWidth;
        const availH = document.documentElement.clientHeight;
        if (!availW || !availH) return;
        const { uiScale, width, height } = computeFit(availW, availH);
        canvas.style.width = `${Math.round(width)}px`;
        canvas.style.height = `${Math.round(height)}px`;
        if (cabinet) {
            cabinet.style.width = `${Math.round(width)}px`;
            cabinet.style.setProperty('--ui-scale', String(uiScale));
        }
    };

    fitCanvas();
    window.addEventListener('resize', fitCanvas);

    const engine = new GameEngine(canvas);
    engine.start();
});
