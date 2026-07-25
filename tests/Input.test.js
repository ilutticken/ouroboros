/**
 * @vitest-environment happy-dom
 */
// THE KEYBOARD. Two things live here, and both were previously untested.
//
// 1. THE LISTENER ORDER. Eleven separate window 'keydown' listeners are registered
//    during construction, several of which call stopImmediatePropagation() to be modal.
//    Since a window listener's priority IS its registration order, the order is
//    load-bearing engine behaviour that nothing enforced — moving one line in the
//    GameEngine constructor could silently break the Options overlay, the shop's
//    keyboard ownership, or the death-screen ARG, and every other test would stay green.
//    These tests pin the manifest AND, more importantly, the *properties* the ordering
//    exists to provide.
//
// 2. INPUTHANDLER. The class was never imported directly by any test — it was only ever
//    exercised through the engine, so its own edge cases (case normalization, the
//    gear-tap discrimination, the canSteer gate, the consumed-Space contract) had no
//    coverage at all.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputHandler } from '../src/engine/InputHandler.js';
import { mountDom, makeGame } from './helpers.js';

// ---------------------------------------------------------------------------
// Instrumentation: capture every keydown listener a GameEngine registers, in
// registration order, along with the stack that registered it.
//
// happy-dom's window is shared across a file, so listeners from a previous engine
// would otherwise pile up and fire on later tests. Capturing them is also how we
// remove them again in afterEach.
// ---------------------------------------------------------------------------
let captured = [];

function instrumentedGame(opts) {
    const orig = window.addEventListener;
    const rec = [];
    window.addEventListener = function (type, handler, o) {
        if (type === 'keydown') rec.push({ handler, stack: new Error().stack || '' });
        return orig.call(this, type, handler, o);
    };
    let game;
    try {
        game = makeGame(opts);
    } finally {
        window.addEventListener = orig;
    }
    captured = rec;
    return { game, rec };
}

// Which source file registered a listener. We match the FIRST frame naming one of our
// modules, so ShopManager.bindEvents reports ShopManager (not its GameEngine caller).
const OWNERS = ['Game.js', 'ShopManager.js', 'InputHandler.js'];
function ownerOf(stack) {
    for (const line of stack.split('\n')) {
        if (line.includes('.test.js') || line.includes('helpers.js')) continue;
        const hit = OWNERS.find(s => line.includes(s));
        if (hit) return hit;
    }
    return 'unknown';
}

function press(key, init = {}) {
    window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

describe('window keydown listeners — the load-bearing registration order', () => {
    beforeEach(() => mountDom());
    afterEach(() => {
        for (const r of captured) window.removeEventListener('keydown', r.handler);
        captured = [];
    });

    it('registers exactly 11 keydown listeners, in the documented owner order', () => {
        const { rec } = instrumentedGame({ audio: 'all' });

        // A window listener's priority is its registration order, so this list IS the
        // priority table. If you add a listener, put it where its modality requires and
        // update this manifest deliberately — do not just append to make the test pass.
        expect(rec.map(r => ownerOf(r.stack))).toEqual([
            'Game.js',          //  1. Options overlay — modal, and must outrank the shop
            'Game.js',          //  2. Encore: ESC leaves Cadenza's performance
            'Game.js',          //  3. Music audition (M)
            'ShopManager.js',   //  4. the shop owns the keyboard while its overlay is up
            'Game.js',          //  5. dev cheat (P) — deleted at release
            'Game.js',          //  6. pause toggle (ESC)
            'Game.js',          //  7. Pivot Override (SHIFT)
            'Game.js',          //  8. the CACHE death-screen ARG recorder
            'Game.js',          //  9. save / load / map pins (PAUSED only)
            'Game.js',          // 10. boot file-select menu
            'InputHandler.js',  // 11. steering — ALWAYS last, so anything modal pre-empts it
        ]);
    });

    it('Options is registered first, so O reaches it even while the shop owns the keyboard', () => {
        // The shop's own listener stops propagation for EVERY key, so the only way 'O'
        // works in a shop is by outranking it.
        const { game } = instrumentedGame({ audio: 'all' });
        game.state.gameState = 'SHOP';
        game.shopManager.open('bite');

        press('o');

        expect(game.optionsOpen).toBe(true);
    });

    it('the open shop swallows keys the later listeners would otherwise act on', () => {
        const { game } = instrumentedGame({ audio: 'all' });
        game.state.unlocked.pauseMenu = true;
        game.state.upgrades.pivot = true;
        game.pivot = vi.fn();
        game.state.gameState = 'PLAYING';
        game.shopManager.open('bite');

        press('Shift');                              // pivot listener is #7, shop is #4
        expect(game.pivot).not.toHaveBeenCalled();

        press('Escape');                             // closes the shop...
        expect(game.state.gameState).not.toBe('PAUSED'); // ...and must NOT also pause
    });

    it('the ARG recorder outranks InputHandler, so one key both records and revives', () => {
        // The recorder must see gameState DEAD. InputHandler's wake-press flips it to
        // PLAYING, so if the two were swapped the death-screen ARG would never record.
        const { game } = instrumentedGame({ audio: 'all' });
        game.state.gameState = 'DEAD';
        game.deathCode = '';

        press('c');

        expect(game.deathCode).toBe('C');            // recorded while still DEAD
        expect(game.state.gameState).toBe('PLAYING'); // and the same press revived you
    });

    it('the boot menu outranks InputHandler, so a menu key never also starts the run', () => {
        const { game } = instrumentedGame({ audio: 'all' });
        game.saveManager.save(1, { score: 5 });
        game.state.gameState = 'START';
        game.startMenuIndex = 0;
        expect(game.startMenuActive()).toBe(true);

        press('ArrowDown');

        expect(game.startMenuIndex).toBe(1);          // the menu moved
        expect(game.state.gameState).toBe('START');   // the wake-press did not fire
    });

    it('erasing the LAST file mid-event does not let the same press start a run', () => {
        // The nastiest case the ordering protects: the second DEL clears the file, which
        // flips startMenuActive() false *inside* the event. Without stopImmediatePropagation
        // the very same keypress would fall through to InputHandler and auto-start a run.
        const { game } = instrumentedGame({ audio: 'all' });
        game.saveManager.save(1, { score: 5 });
        game.state.gameState = 'START';
        game.startMenuIndex = 0;

        press('Delete');  // arms
        press('Delete');  // confirms — anySave() goes false here

        expect(game.saveManager.anySave()).toBe(false);
        expect(game.state.gameState).toBe('START');
    });

    it('save/load bind only while PAUSED, so S still steers in play', () => {
        const { game } = instrumentedGame({ audio: 'all' });
        game.state.unlocked.saveFunction = true;
        game.state.unlocked.pauseMenu = true;
        game.saveGame = vi.fn();

        game.state.gameState = 'PLAYING';
        press('s');
        expect(game.saveGame).not.toHaveBeenCalled();

        game.state.gameState = 'PAUSED';
        press('s');
        expect(game.saveGame).toHaveBeenCalledTimes(1);
    });

    it('save/load stay blocked during the Gate Thread-Suspension (also a PAUSED state)', () => {
        const { game } = instrumentedGame({ audio: 'all' });
        game.state.unlocked.saveFunction = true;
        game.saveGame = vi.fn();
        game.state.gameState = 'PAUSED';
        game.state.isSuspended = true;

        press('s');

        expect(game.saveGame).not.toHaveBeenCalled();
    });

    it('the dev cheat swallows P, so it cannot also reach the CACHE buffer', () => {
        const { game } = instrumentedGame({ audio: 'all' });
        game.state.gameState = 'PLAYING';
        game._argListenMs = 2000;   // the bounce "little death" listen window is open
        game.deathCode = '';
        const before = game.state.score;

        press('p');

        expect(game.state.score).toBe(before + 10);
        expect(game.deathCode).toBe('');
    });
});

// ---------------------------------------------------------------------------

describe('InputHandler', () => {
    let input;
    let onSpeedChange;

    beforeEach(() => {
        input = new InputHandler();
        input.gridSize = 20;
        onSpeedChange = vi.fn();
    });

    /** Drive handleKeyDown directly — no window, no engine. */
    const key = (k, cbs = {}) => input.handleKeyDown(
        { key: k, repeat: false },
        cbs.onFirstInput, cbs.onDialogAdvance, cbs.onAction, cbs.onSpeedChange
    );

    it('steers with both arrows and WASD', () => {
        key('ArrowUp');
        expect(input.nextDirection).toEqual({ x: 0, y: -20 });
        input.reset();
        key('d');
        expect(input.nextDirection).toEqual({ x: 20, y: 0 });
    });

    it('normalizes case, so CapsLock and Shift do not break WASD', () => {
        key('W');
        expect(input.nextDirection).toEqual({ x: 0, y: -20 });
        input.reset();
        key('S');
        expect(input.nextDirection).toEqual({ x: 0, y: 20 });
    });

    it('reads a tap in the facing direction as an upshift, not a turn', () => {
        input.direction = { x: 20, y: 0 };          // moving right
        key('ArrowRight', { onSpeedChange });
        expect(onSpeedChange).toHaveBeenCalledWith(1);
        expect(input.nextDirection).toEqual({ x: 0, y: 0 }); // no turn queued
    });

    it('reads a tap opposite the facing direction as a brake, never a 180', () => {
        input.direction = { x: 20, y: 0 };
        key('ArrowLeft', { onSpeedChange });
        expect(onSpeedChange).toHaveBeenCalledWith(-1);
        expect(input.nextDirection).toEqual({ x: 0, y: 0 }); // the self-bite is impossible
    });

    it('turns perpendicular without touching the gear', () => {
        input.direction = { x: 20, y: 0 };
        key('ArrowUp', { onSpeedChange });
        expect(input.nextDirection).toEqual({ x: 0, y: -20 });
        expect(onSpeedChange).not.toHaveBeenCalled();
    });

    it('drops steering and gear taps entirely when canSteer() is false', () => {
        input.canSteer = () => false;
        input.direction = { x: 20, y: 0 };
        key('ArrowUp', { onSpeedChange });
        key('ArrowRight', { onSpeedChange });
        // Keys pressed during a dialog/pause used to buffer silently and fire the
        // instant play resumed — an unexpected turn, or a sneaked-through gear change.
        expect(input.nextDirection).toEqual({ x: 0, y: 0 });
        expect(onSpeedChange).not.toHaveBeenCalled();
    });

    it('wakes BEFORE the steer gate, so one key can revive and set direction', () => {
        const seen = [];
        input.canSteer = () => seen.length > 0; // "PLAYING" only after onFirstInput ran
        key('ArrowUp', { onFirstInput: () => seen.push(true) });
        expect(seen).toHaveLength(1);
        expect(input.nextDirection).toEqual({ x: 0, y: -20 });
    });

    it('a Space that dismisses a dialog is consumed — it does not also fire the action', () => {
        // This is 2-Bit's consent gag: dismissing his offer must not auto-trigger the
        // action on the same press.
        const onAction = vi.fn();
        const onFirstInput = vi.fn();
        key(' ', { onDialogAdvance: () => true, onAction, onFirstInput });
        expect(onAction).not.toHaveBeenCalled();
        expect(onFirstInput).toHaveBeenCalledWith(true); // consumed reaches the skip too
    });

    it('a Space with nothing to dismiss falls through to the action', () => {
        const onAction = vi.fn();
        const onFirstInput = vi.fn();
        key(' ', { onDialogAdvance: () => false, onAction, onFirstInput });
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onFirstInput).toHaveBeenCalledWith(false);
    });

    it('Enter behaves as Space for dialog advance', () => {
        const onDialogAdvance = vi.fn(() => true);
        key('Enter', { onDialogAdvance });
        expect(onDialogAdvance).toHaveBeenCalledTimes(1);
    });

    it('updateDirection commits a queued turn once, and reports whether it did', () => {
        expect(input.updateDirection()).toBe(false);   // nothing queued
        input.nextDirection = { x: 0, y: -20 };
        expect(input.updateDirection()).toBe(true);
        expect(input.direction).toEqual({ x: 0, y: -20 });
        // The committed direction is a COPY — mutating it must not alias nextDirection.
        input.direction.x = 999;
        expect(input.nextDirection).toEqual({ x: 0, y: -20 });
    });

    it('reset clears both directions', () => {
        input.direction = { x: 20, y: 0 };
        input.nextDirection = { x: 0, y: 20 };
        input.reset();
        expect(input.direction).toEqual({ x: 0, y: 0 });
        expect(input.nextDirection).toEqual({ x: 0, y: 0 });
    });

    it('defaults canSteer permissive, so a bare handler steers without init()', () => {
        expect(new InputHandler().canSteer()).toBe(true);
    });
});
