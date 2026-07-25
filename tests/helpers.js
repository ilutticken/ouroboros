// Shared test scaffolding. These four helpers were copy-pasted across Act1 /
// DiegeticAudio / Sprint2 / Smoke and had already diverged (different DOM fixtures,
// different audio stubbing, inconsistent localStorage clearing), so a fixture fix had
// to be made four times and two copies still injected a #btn-playtest button that no
// longer exists in the game. They live here now — PARAMETERIZED, because the per-file
// differences are deliberate (see the options on each function).
import { vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';

// The canonical DOM the game expects. One fixture, so adding a new element to
// index.html means updating exactly one place.
//   clearStorage: wipe localStorage first (default true). DiegeticAudio opts OUT — it
//   manages save-slot state across its own tests and clears explicitly.
export function mountDom({ clearStorage = true } = {}) {
    document.body.innerHTML = `
        <div id="ui-layer" class="hidden">
            <div id="score-display">Data: <span id="score-value">0</span></div>
            <div id="gear-display" class="hidden"></div>
        </div>
        <div id="game-wrapper">
            <div id="shop-overlay" class="hidden">
                <h2 id="shop-title"></h2>
                <div class="shop-items" id="shop-items"></div>
                <button id="btn-close-shop">Leave</button>
            </div>
        </div>
        <div id="ui-layer-bottom" class="hidden">
            <div id="narrative-terminal"></div>
            <div id="boss-status" class="hidden"></div>
        </div>
    `;
    if (clearStorage) window.localStorage.clear();
}

// Audio methods stubbed by default: everything a game-level test can trigger. A test
// that wants to assert on a REAL AudioEngine call passes its own list (or 'none').
export const DEFAULT_AUDIO_STUBS = [
    'init', 'playWub', 'playGlide', 'playDenied', 'playCorruptHit', 'playCrack',
    'playCrash', 'playBeep', 'playDeath', 'playMaterialize', 'playDoot', 'playBump',
    'playScannerPing', 'setDuck', 'setMusicLayer', 'stopVoidAmbient', 'stopMusic',
];

// Build a GameEngine on a fresh canvas, already PLAYING.
//   width/height: canvas size (default 400x400 = a 20x20 grid at gridSize 20).
//   audio: 'default' | 'all' (every prototype method) | string[] | 'none'.
//   ctx: true to install the swallow-everything 2D context (see stubCtx) — required
//        for any test that calls draw(), since happy-dom's getContext returns null.
//   playing: leave gameState alone when false (boot-screen tests).
export function makeGame({ width = 400, height = 400, audio = 'default', ctx = false, playing = true } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const game = new GameEngine(canvas);

    let names = [];
    if (audio === 'all') {
        names = Object.getOwnPropertyNames(Object.getPrototypeOf(game.audio))
            .filter(k => k !== 'constructor' && typeof game.audio[k] === 'function');
    } else if (Array.isArray(audio)) {
        names = audio;
    } else if (audio !== 'none') {
        names = DEFAULT_AUDIO_STUBS;
    }
    for (const n of names) game.audio[n] = vi.fn();

    if (ctx) game.renderer.ctx = stubCtx();
    if (playing) game.state.gameState = 'PLAYING';
    return game;
}

/** Drive exactly one grid step. dt=1000 exceeds any speed threshold, so it's one move. */
export function step(game, dir) {
    game.input.nextDirection = { ...dir };
    game.update(1000);
}

/** Advance every queued dialog (chained onCompletes included) to the end. */
export function finishDialog(game) {
    let guard = 0;
    while (game.dialogManager.currentDialog && guard++ < 200) game.dialogManager.advance();
}

// A 2D context that absorbs every call, so draw() logic (branching, string building,
// state reads) runs for real without a rasterizer. happy-dom returns null from
// getContext, so this is the only way to exercise the render paths at all.
export function stubCtx() {
    const stub = new Proxy({}, {
        get: (t, prop) => {
            if (prop === 'measureText') return () => ({ width: 42 });
            if (prop === 'canvas') return undefined;
            return () => stub;
        },
        set: () => true,
    });
    return stub;
}

/** Run n full frames (update + draw). */
export function frames(game, n, dt = 40) {
    for (let i = 0; i < n; i++) { game.update(dt); game.draw(); }
}
