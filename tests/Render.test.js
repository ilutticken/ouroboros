/**
 * @vitest-environment happy-dom
 */
// THE RENDER BOUNDARY. Smoke.test.js proves draw() doesn't THROW; these tests prove what
// it DREW. The swallow-everything Proxy that makes smoke testing possible also hides the
// two render bugs that actually ship:
//
//   - a NaN/undefined coordinate — fillRect(NaN, y, w, h) draws nothing and throws
//     nothing, so the entity silently vanishes and every test stays green;
//   - an unbalanced save/restore — a missed restore() leaks a clip, transform, or alpha
//     into every subsequent frame, so the screen degrades over time rather than at once.
//
// Both are exactly the "green suite, black screen" failure the smoke test was written to
// catch and can't. On top of those two invariants this pins the design laws that live in
// the render layer: the era palette, the gear-linked glow, the impact shake and its
// reduce-motion suppression, and the §2.6 text floor on reading surfaces.
import { describe, it, expect, beforeEach } from 'vitest';
import { NPC } from '../src/entities/NPC.js';
import { mountDom, makeGame, recordingCtx, badGeometry, fontSizes } from './helpers.js';

const bootGame = () => makeGame({ audio: 'all', playing: false });

/** Attach a fresh recorder, draw n frames, return the ops. */
function record(game, n = 1, dt = 40) {
    const ctx = recordingCtx();
    game.renderer.ctx = ctx;
    for (let i = 0; i < n; i++) { game.update(dt); game.draw(); }
    return ctx.__ops;
}

const count = (ops, op) => ops.filter(o => o.op === op).length;

// The states a player actually sees, and enough unlocks that the HUD, gear gauge,
// scanner, and rider all render rather than being skipped.
function fullyUnlocked(game) {
    Object.assign(game.state.unlocked, {
        ui: true, borders: true, tailRider: true, gearMeter: true,
        redline: true, coordReadout: true, pauseMenu: true, saveFunction: true,
        mapPinsTool: true,
    });
    game.state.upgrades.scanner = true;
    game.state.score = 25;
    game.growSnake(25);
}

describe('Renderer — frame invariants', () => {
    beforeEach(mountDom);

    describe('save/restore balance', () => {
        // An unmatched save() leaves a transform or clip on the stack forever; an
        // unmatched restore() pops state the caller still owned. Either compounds
        // frame over frame, which is why it reads as "the screen slowly breaks".
        const STATES = ['START', 'PLAYING', 'DIALOG', 'PAUSED', 'TRANSITION', 'DEAD'];

        for (const s of STATES) {
            it(`balances in ${s}`, () => {
                const game = bootGame();
                fullyUnlocked(game);
                game.state.gameState = s;
                const ops = record(game, 3);
                expect(count(ops, 'save')).toBe(count(ops, 'restore'));
            });
        }

        it('stays balanced while the impact shake is running', () => {
            // The shake wraps the WHOLE frame in an extra save/translate, restored at the
            // very end of draw(). An early return anywhere after it would strand that save.
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.shakeScreen(600);
            const ops = record(game, 1);
            expect(count(ops, 'save')).toBe(count(ops, 'restore'));
        });

        it('balances in both Gate fights', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.state.unlocked.ascentArmed = true;
            game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -3;
            game.apple = { x: 300, y: 300 }; game.glitches = []; game.obstacles = [];
            game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
            const ctx = recordingCtx();
            game.renderer.ctx = ctx;
            for (let i = 0; i < 12; i++) { game.updateGate3(); game.draw(); }
            expect(count(ctx.__ops, 'save')).toBe(count(ctx.__ops, 'restore'));

            const g2 = bootGame();
            fullyUnlocked(g2);
            g2.state.gameState = 'PLAYING';
            g2.worldManager.currentRoomX = 5; g2.worldManager.currentRoomY = -5;
            g2.apple = { x: 300, y: 300 }; g2.glitches = []; g2.obstacles = []; g2.stamps = [];
            g2.npcs = [new NPC(200, 40, 20, 'gatefinal', []), new NPC(200, 340, 20, 'dennyfinal', [])];
            const c2 = recordingCtx();
            g2.renderer.ctx = c2;
            for (let i = 0; i < 40; i++) { g2._tick++; g2.updateGateFinal(); g2.draw(); }
            expect(count(c2.__ops, 'save')).toBe(count(c2.__ops, 'restore'));
        });
    });

    describe('no NaN geometry', () => {
        // A NaN coordinate is invisible in every sense: no throw, no pixel, no failing
        // assertion. These are the frames where the arithmetic is densest.
        it('across every game state', () => {
            for (const s of ['START', 'PLAYING', 'DIALOG', 'PAUSED', 'TRANSITION', 'DEAD']) {
                const game = bootGame();
                fullyUnlocked(game);
                game.state.gameState = s;
                expect(badGeometry(record(game, 3)), `state ${s}`).toEqual([]);
            }
        });

        it('across real rooms, with a rider, a wandered-off apple, and a scanner reveal', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.carriedRefugee = '4,2';
            game._argListenMs = 1000;
            game.worldManager.revealBeyond(0, 0, 'right', 'module', 3000);
            const ctx = recordingCtx();
            game.renderer.ctx = ctx;

            for (const [x, y] of [[5, 0], [1, -5], [8, -5], [7, -2], [4, 2], [5, -4], [9, 4]]) {
                game.worldManager.currentRoomX = x;
                game.worldManager.currentRoomY = y;
                const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
                game.apple = room.apple; game.glitches = room.glitches;
                game.npcs = room.npcs; game.obstacles = room.obstacles || [];
                for (let i = 0; i < 3; i++) { game.update(40); game.draw(); }
            }
            game.apple = null;   // she wandered off — the null-apple crash from playtest
            for (let i = 0; i < 3; i++) { game.update(40); game.draw(); }

            expect(badGeometry(ctx.__ops)).toEqual([]);
        });

        it('in the two Gate fights and the Encore', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.state.unlocked.ascentArmed = true;
            game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -3;
            game.apple = { x: 300, y: 300 }; game.glitches = []; game.obstacles = [];
            game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
            const ctx = recordingCtx();
            game.renderer.ctx = ctx;
            for (let i = 0; i < 12; i++) { game.updateGate3(); game.draw(); }
            expect(badGeometry(ctx.__ops), 'the Override').toEqual([]);

            const g2 = bootGame();
            fullyUnlocked(g2);
            g2.state.gameState = 'PLAYING';
            g2.worldManager.currentRoomX = 5; g2.worldManager.currentRoomY = -5;
            g2.apple = { x: 300, y: 300 }; g2.glitches = []; g2.obstacles = []; g2.stamps = [];
            g2.npcs = [new NPC(200, 40, 20, 'gatefinal', []), new NPC(200, 340, 20, 'dennyfinal', [])];
            const c2 = recordingCtx();
            g2.renderer.ctx = c2;
            for (let i = 0; i < 40; i++) { g2._tick++; g2.updateGateFinal(); g2.draw(); }
            expect(badGeometry(c2.__ops), 'Port 0').toEqual([]);

            const g3 = bootGame();
            fullyUnlocked(g3);
            g3.state.gameState = 'PLAYING';
            g3.npcs = []; g3.glitches = []; g3.obstacles = []; g3.apple = { x: 300, y: 300 };
            g3.growSnake(30);
            g3.startEncore();
            expect(badGeometry(record(g3, 10)), 'the Encore').toEqual([]);
        });
    });

    describe('the impact shake', () => {
        it('translates the frame while shake is running', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.settings.reduceMotion = false;
            game.shakeScreen(600);
            const ops = record(game, 1);
            const shifts = ops.filter(o => o.op === 'translate' && (o.args[0] !== 0 || o.args[1] !== 0));
            expect(shifts.length).toBeGreaterThan(0);
        });

        it('decays to nothing rather than stopping dead', () => {
            // The shake settles in loop(), not update() — deliberately, so it keeps
            // decaying while a dialog or pause has update() early-returning. Driving
            // loop() directly means stubbing out its rAF tail.
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.renderer.ctx = recordingCtx();
            game.settings.reduceMotion = false;
            const raf = globalThis.requestAnimationFrame;
            globalThis.requestAnimationFrame = () => 0;
            try {
                game.lastTime = 0;
                game.shakeScreen(600);
                game.loop(400);
                expect(game._shakeMs).toBeGreaterThan(0);
                expect(game._shakeMs).toBeLessThan(600);
                game.loop(900);
                expect(game._shakeMs).toBe(0);
            } finally {
                globalThis.requestAnimationFrame = raf;
            }
        });

        it('is fully suppressed under reduce-motion (§2.6: sound + text carry it)', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.settings.reduceMotion = true;
            game.shakeScreen(600);
            const ops = record(game, 1);
            expect(ops.filter(o => o.op === 'translate' && (o.args[0] !== 0 || o.args[1] !== 0))).toEqual([]);
        });
    });

    describe('the design laws that live in the render layer', () => {
        it('the frame glow rides LIVE gear, not a stored maximum', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';

            // draw() copies the ENGINE's live gear onto the render state each frame, so
            // this must be set on the engine — that copy is the "live, not stored" part.
            game.gear = 0;
            const at0 = record(game, 1).filter(o => o.op === 'set:shadowBlur').map(o => o.args[0]);
            game.gear = 3;
            const at3 = record(game, 1).filter(o => o.op === 'set:shadowBlur').map(o => o.args[0]);

            expect(Math.max(...at3)).toBeGreaterThan(Math.max(...at0));
            expect(at0[0]).toBe(0); // gear 0 = no glow at all
        });

        it('the era palette flips 8-bit to 16-bit at the Beat-8 reboot', () => {
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';

            const bg = (ops) => ops.find(o => o.op === 'set:fillStyle').args[0];
            game.state.unlocked.era16 = false;
            const eight = bg(record(game, 1));
            game.state.unlocked.era16 = true;
            const sixteen = bg(record(game, 1));

            expect(eight).not.toBe(sixteen);
        });

        it('holds the §2.6 16px floor on the surfaces you READ', () => {
            // The canvas prose surfaces are START (boot menu) and DEAD (the receipt).
            // DIALOG is NOT here: conversations are a DOM overlay, so they're governed by
            // style.css, not this path. PAUSED is deliberately excluded too — it contains
            // the MAP, a diagram whose room labels and pins are 6-7px glyphs, and its body
            // text is currently 12px, tracked separately as a real §2.6 gap.
            for (const s of ['START', 'DEAD']) {
                const game = bootGame();
                fullyUnlocked(game);
                // The bare cold open paints only the void — the boot menu (and its text)
                // needs a file to list.
                if (s === 'START') game.saveManager.save(1, { unlocked: {} });
                game.state.gameState = s;
                const sizes = fontSizes(record(game, 2));
                expect(sizes.length, `${s} drew no text`).toBeGreaterThan(0);
                expect(Math.min(...sizes), `${s} drew text below the 16px floor`).toBeGreaterThanOrEqual(16);
            }
        });

        it('paints the void before the shake, so no seam shows at the edges', () => {
            // The clear must be the FIRST op of the frame and must precede any translate,
            // or a shaking frame exposes an unpainted band at the canvas edge.
            const game = bootGame();
            fullyUnlocked(game);
            game.state.gameState = 'PLAYING';
            game.settings.reduceMotion = false;
            game.shakeScreen(600);
            const ops = record(game, 1);

            const firstFill = ops.findIndex(o => o.op === 'fillRect');
            const firstTranslate = ops.findIndex(o => o.op === 'translate');
            expect(firstFill).toBeGreaterThanOrEqual(0);
            expect(firstTranslate).toBeGreaterThan(firstFill);
        });
    });
});
