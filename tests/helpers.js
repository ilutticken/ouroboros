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

// A 2D context that RECORDS instead of swallowing. stubCtx proves draw() doesn't throw;
// this proves what it drew. It exists because the swallow-everything Proxy hides the two
// worst render bugs: a NaN coordinate (draws nothing, throws nothing) and an unbalanced
// save/restore (leaks clip/transform state into every later frame). Both ship a broken
// screen with a green suite.
//   ops:   [{ op, args }] in call order; property writes appear as { op: 'set:font' }.
//   props: the last value written to each property.
export function recordingCtx() {
    const ops = [];
    const props = {};
    const stub = new Proxy({}, {
        get: (t, prop) => {
            if (prop === '__ops') return ops;
            if (prop === '__props') return props;
            if (prop === 'measureText') return () => ({ width: 42 });
            if (prop === 'canvas') return undefined;
            if (typeof prop === 'string' && prop in props) return props[prop];
            return (...args) => { ops.push({ op: String(prop), args }); return stub; };
        },
        set: (t, prop, value) => {
            props[String(prop)] = value;
            ops.push({ op: `set:${String(prop)}`, args: [value] });
            return true;
        },
    });
    return stub;
}

// Ops whose arguments are geometry. 'all' = every argument must be a finite number (a
// trailing boolean is allowed for arc/ellipse); 'tail' = every argument after the text.
export const GEOMETRY_OPS = {
    fillRect: 'all', strokeRect: 'all', clearRect: 'all', rect: 'all',
    moveTo: 'all', lineTo: 'all', arc: 'all', arcTo: 'all', ellipse: 'all',
    quadraticCurveTo: 'all', bezierCurveTo: 'all', roundRect: 'all',
    translate: 'all', scale: 'all', rotate: 'all',
    createLinearGradient: 'all', createRadialGradient: 'all',
    fillText: 'tail', strokeText: 'tail',
};

/** Every recorded geometry op with a non-finite argument. Empty means the frame is clean. */
export function badGeometry(ops) {
    const bad = [];
    for (const { op, args } of ops) {
        const mode = GEOMETRY_OPS[op];
        if (!mode) continue;
        const check = mode === 'tail' ? args.slice(1) : args;
        for (const a of check) {
            if (typeof a === 'boolean') continue;       // arc/ellipse anticlockwise flag
            if (!Number.isFinite(a)) { bad.push({ op, args }); break; }
        }
    }
    return bad;
}

/** Font sizes (px) set during the recorded ops, in order. */
export function fontSizes(ops) {
    return ops
        .filter(o => o.op === 'set:font')
        .map(o => {
            const m = /(\d+(?:\.\d+)?)px/.exec(String(o.args[0]));
            return m ? parseFloat(m[1]) : null;
        })
        .filter(v => v !== null);
}

// ---------------------------------------------------------------------------
// A recording fake Web Audio API. happy-dom has no AudioContext, so Audio.js was
// never executed by any test — every suite stubbed the AudioEngine's methods out
// wholesale, which meant 700 lines of synthesis could not be checked at all.
//
// This implements just the surface Audio.js touches, and records what was built:
// nodes by kind, every connect() as a [from, to] pair, and every AudioParam
// automation. That's enough to assert bus topology and envelope shape without a
// rasterizer for sound.
// ---------------------------------------------------------------------------
export function installFakeAudio() {
    const rec = { nodes: [], connections: [], automation: [] };

    const mkParam = (kind, name) => {
        const p = { value: 0 };
        const write = (how, v) => { p.value = v; rec.automation.push({ kind, name, how, value: v }); return p; };
        p.setValueAtTime = (v) => write('set', v);
        p.linearRampToValueAtTime = (v) => write('linear', v);
        p.exponentialRampToValueAtTime = (v) => write('exp', v);
        p.setTargetAtTime = (v) => write('target', v);
        p.cancelScheduledValues = () => p;
        return p;
    };

    const mkNode = (kind, params = [], extra = {}) => {
        const n = { kind, started: null, stopped: null, out: [] };
        for (const name of params) n[name] = mkParam(kind, name);
        n.connect = (dest) => {
            // A connect target is either a node or an AudioParam (LFO -> filter.frequency).
            const to = dest && dest.kind ? dest.kind : (dest && dest.setValueAtTime ? 'param' : 'unknown');
            n.out.push(dest);
            rec.connections.push([kind, to]);
            return dest;
        };
        n.disconnect = () => {};
        // Per spec, a bare start()/stop() means "now" — so record currentTime, not undefined.
        n.start = (t) => { n.started = t === undefined ? (rec.ctx ? rec.ctx.currentTime : 0) : t; };
        n.stop = (t) => { n.stopped = t === undefined ? (rec.ctx ? rec.ctx.currentTime : 0) : t; };
        n.setPeriodicWave = () => {};
        Object.assign(n, extra);
        rec.nodes.push(n);
        return n;
    };

    class FakeAudioContext {
        constructor() {
            this.currentTime = 0;
            this.sampleRate = 44100;
            this.state = 'running';
            this.destination = mkNode('destination');
            rec.ctx = this;
        }
        createGain() { return mkNode('gain', ['gain']); }
        createOscillator() { return mkNode('oscillator', ['frequency', 'detune']); }
        createBiquadFilter() { return mkNode('filter', ['frequency', 'Q', 'gain']); }
        createBufferSource() { return mkNode('bufferSource', ['playbackRate', 'detune']); }
        createDynamicsCompressor() {
            return mkNode('compressor', ['threshold', 'knee', 'ratio', 'attack', 'release']);
        }
        createBuffer(channels, length) {
            const data = new Float32Array(length);
            return { length, numberOfChannels: channels, getChannelData: () => data };
        }
        createPeriodicWave() { return { kind: 'periodicWave' }; }
        resume() { return Promise.resolve(); }
        close() { return Promise.resolve(); }
    }

    const prevCtor = window.AudioContext;
    const prevWebkit = window.webkitAudioContext;
    window.AudioContext = FakeAudioContext;
    window.webkitAudioContext = FakeAudioContext;

    rec.reset = () => { rec.nodes.length = 0; rec.connections.length = 0; rec.automation.length = 0; };
    rec.uninstall = () => { window.AudioContext = prevCtor; window.webkitAudioContext = prevWebkit; };
    rec.of = (kind) => rec.nodes.filter(n => n.kind === kind);
    return rec;
}
