/**
 * @vitest-environment happy-dom
 */
// SPRINT 2 — the midpoint pass + the compounding economy + Hydratia:
// the terminal release latch, the canon retcon (tick cut / Glitch origin), the bounce
// ARG window, the scanner pockets + BEYOND read, the emptied Localhost + refugees +
// intake, the Data Mines, Quantcy's Trust, Hydratia (catch / autosave / warm restore),
// and the death receipt.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NPC } from '../src/entities/NPC.js';
import { ARCHITECT, LORE_FRAGS, BOOTH_LORE, CACHE_CHECKPOINT, HYDRATIA_DEATH } from '../src/content/dialogue.js';
import { classifyRoomBeyond } from '../src/systems/RoomGenerator.js';
import { mountDom, makeGame, step, finishDialog } from './helpers.js';

const newGame = (width = 400, height = 400) => makeGame({ width, height });

// ---------------------------------------------------------------------------------
// LIFECYCLE SWEEP REGRESSIONS. Seven confirmed findings from the adversarial sweep of
// "state at the wrong scope / reset at the wrong boundary". The unifying invariant for
// the minting bugs is one line — score always equals embodied-plus-folded Data:
const ledgerBalanced = (game) =>
    game.state.score === game.snake.body.length - 1 - game.riderCount + game.pendingUnfold;

describe('Lifecycle sweep regressions', () => {
    beforeEach(mountDom);

    it('a second bounce mid-unfold keeps the ledger (no phantom Data mint)', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1;
        game.state.score = 30; game.growSnake(30);
        expect(ledgerBalanced(game)).toBe(true);

        game.bounce();                       // fold: score 20, body [head], unfold 20
        expect(ledgerBalanced(game)).toBe(true);
        game.bounce();                       // second hit BEFORE the fold re-extrudes
        // The old code assigned pendingUnfold from the physical body alone, discarding
        // the previous fold while its Data stayed on the score — 10 spendable phantom
        // Data per double-bounce, permanent.
        expect(ledgerBalanced(game)).toBe(true);
        expect(game.state.score).toBe(10);   // two real 10-sheds, nothing else
    });

    it('a SELF-bounce keeps the ledger (the recoil no longer eats a paid segment)', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1;
        game.state.score = 20; game.growSnake(20);
        // stage the self-overlap die('self') finds: head parked on a body cell
        game.snake.body[0] = { ...game.snake.body[5] };
        game.die('self');                    // routes to bounce()
        expect(ledgerBalanced(game)).toBe(true);
    });

    it("Cadenza's Encore holds a mid-bounce fold and returns it on BOTH exits", () => {
        for (const exit of ['finale', 'left']) {
            const game = newGame();
            game.state.upgrades.crumpleLevel = 1;
            game.state.score = 30; game.growSnake(30);
            game.bounce();                   // score 20, unfold 20
            game.glitches = []; game.npcs = []; game.obstacles = [];
            game.startEncore();
            expect(game.pendingUnfold).toBe(0); // length-neutral during the lap
            if (exit === 'finale') game._encoreFinale();
            else game.exitEncore('left');
            finishDialog(game);
            // Zeroing the fold destroyed Data the score kept — phantom, spendable.
            expect(game.pendingUnfold).toBe(20);
            expect(ledgerBalanced(game)).toBe(true);
        }
    });

    it("Gate's set-piece hazards die at every boundary (no ghost walls, clean retries)", () => {
        const stage = (game) => {
            game._finale = { t: 1, rows: [{ r: 5, holes: [3] }] };
            game._gate3Blocks = [{ x: 100, y: 100 }];
            game._shakeMs = 400;
        };
        const cleared = (game) =>
            game._finale === null && game._gate3Blocks === null && game._shakeMs === 0;

        const a = newGame(); stage(a); a.die('wall');
        expect(cleared(a), 'die()').toBe(true);

        const b = newGame(); stage(b); b.resetToNewGame();
        expect(cleared(b), 'resetToNewGame()').toBe(true);

        const c = newGame(); const d = c.serialize(); stage(c); c.applySave(d);
        expect(cleared(c), 'applySave()').toBe(true);
    });

    it("dying before collecting Denny's dropped map re-arms the drop (no map soft-lock)", () => {
        const game = newGame();
        game.state.unlocked.dennyMapDropped = true;  // dropped, sitting in the room cache
        game.carriedModule = null;                   // ...but never picked up
        game.die('wall');                            // the wipe destroys the mapitem NPC
        expect(game.state.unlocked.dennyMapDropped).toBe(false); // so Denny drops it again
    });

    it('an AUTO-ONLY slot is erasable, so the fresh-start contract stays reachable', () => {
        const game = newGame();
        game.saveManager.saveAuto(2, { unlocked: {} });      // Hydratia-only progress
        expect(game.saveManager.anySave()).toBe(true);       // counts toward anySave...
        game.state.gameState = 'START';
        game.startMenuIndex = 1;                             // slot 2's row
        game.startMenuHandleKey('Delete');                   // arm
        game.startMenuHandleKey('Delete');                   // confirm
        expect(game.saveManager.hasAuto(2)).toBe(false);     // ...and is now deletable
        expect(game.saveManager.anySave()).toBe(false);      // fresh-start reachable again
    });

    it("die('border') tallies as a WALL death, so Hydratia's wall coaching can escalate", () => {
        const game = newGame();
        game.die('border');
        expect(game.narrative.deathByCause.wall).toBe(1);
        expect(game.narrative.deathByCause.unknown).toBe(0); // not the uncaused counter
    });

    it('a save file that knows Hydratia HEALS the global caught flag on load', () => {
        const game = newGame();
        const d = game.serialize();
        d.unlocked.hydratiaFound = true;                     // the file is the anchor of record
        window.localStorage.removeItem('ouroboros-hydratia-caught'); // global was re-armed
        game.applySave(d);
        expect(game.saveManager.hasHydratiaCaught()).toBe(true);
        expect(game.state.unlocked.hydratiaFound).toBe(true);
    });

    it('a CORRUPT save blob is treated as nonexistent everywhere (no zombie slot)', () => {
        const game = newGame();
        window.localStorage.setItem('ouroboros-save-s1', '{not json');   // damaged mid-write
        window.localStorage.setItem('ouroboros-save-s2-auto', 'garbage'); // damaged auto too
        // One rule: unparseable = nonexistent. Before, anySave() counted raw keys while
        // slots() counted parses — the menu said EMPTY, the engine said occupied, and the
        // slot was unloadable, un-erasable, and blocked the fresh-start re-arm forever.
        expect(game.saveManager.hasSave(1)).toBe(false);
        expect(game.saveManager.hasAuto(2)).toBe(false);
        expect(game.saveManager.anySave()).toBe(false);
        expect(game.saveManager.slots().every(s => !s.exists)).toBe(true);
        // ...and a fresh save simply overwrites the dead weight.
        expect(game.saveManager.save(1, { unlocked: {} })).toBe(true);
        expect(game.saveManager.hasSave(1)).toBe(true);
    });

    // THE GUARD (institutionalized): every `unlocked.*` key written anywhere in src/ must
    // be declared in StateManager's baseline. applySave and resetToNewGame merge over the
    // defaults, so an undeclared key survives Load and New Game (the merge cannot clear
    // what it does not know about) and then gets baked into the next save — heurMet and
    // nibbleIdle both shipped that way.
    it('every unlocked key written in src/ is declared in the StateManager baseline', async () => {
        const fs = await import('node:fs');
        const path = await import('node:path');
        const root = path.resolve(__dirname, '../src');
        const files = [];
        const walk = (dir) => {
            for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
                const p = path.join(dir, f.name);
                if (f.isDirectory()) walk(p);
                else if (f.name.endsWith('.js')) files.push(p);
            }
        };
        walk(root);
        const written = new Set();
        const rx = /\b(?:unlocked|u|um|u2)\.(\w+)\s*=[^=]/g;
        for (const p of files) {
            const src = fs.readFileSync(p, 'utf8');
            for (const m of src.matchAll(rx)) written.add(m[1]);
        }
        const { StateManager } = await import('../src/state/StateManager.js');
        const declared = new Set(Object.keys(new StateManager().unlocked));
        const undeclaredKeys = [...written].filter(k => !declared.has(k));
        expect(undeclaredKeys, `undeclared unlocked keys: ${undeclaredKeys.join(', ')}`).toEqual([]);
    });
});

// ---------------------------------------------------------------------------------
// Every way to die used to collapse into three causes — and the four best ones (Gate's
// ring, Port 0's walls, Heur's ping, Heur's database) all reported "Quarantine held",
// which was untrue. The routing had NO test coverage, so splitting it broke nothing and
// proved nothing. These pin it.
describe('Playtest: state that should not survive', () => {
    beforeEach(mountDom);

    // These tests drive the real start() on boot-screen engines, and a START-state engine's
    // keydown listeners are modal. happy-dom's window is shared across the file, so leaving
    // them attached made every LATER test that dispatches a key fail. Capture and remove.
    let attached = [];
    const bootGame = (opts = {}) => {
        const orig = window.addEventListener;
        window.addEventListener = function (type, handler, o) {
            if (type === 'keydown') attached.push(handler);
            return orig.call(this, type, handler, o);
        };
        let game;
        try { game = makeGame({ audio: 'all', playing: false, ...opts }); }
        finally { window.addEventListener = orig; }
        return game;
    };
    const boot = (game) => {
        const raf = globalThis.requestAnimationFrame;
        globalThis.requestAnimationFrame = () => 0;
        try { game.start(); } finally { globalThis.requestAnimationFrame = raf; }
    };
    afterEach(() => {
        for (const h of attached) window.removeEventListener('keydown', h);
        attached = [];
    });

    it('corruption regrows on death — cleared rooms are re-seeded, not remembered', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.score = 20; game.growSnake(20);
        for (const [x, y] of [[4, 2], [3, 1], [6, 2], [8, -1]]) {
            game.worldManager.currentRoomX = x; game.worldManager.currentRoomY = y;
            game.worldManager.getOrCreateRoom(game.state.unlocked);
        }
        expect(Object.keys(game.worldManager.rooms).length).toBeGreaterThan(1);

        game.die('wall');

        // Room CONTENT derives from the durable unlock set, so dropping the cache costs
        // nothing you earned — it only regrows what the world grows on its own. Only the
        // room you respawned into should be cached again.
        expect(Object.keys(game.worldManager.rooms).length).toBeLessThanOrEqual(1);
    });

    it('death does not undo anything you EARNED', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.upgrades.scanner = true;
        game.state.unlocked.refugeesFreed = 2;
        game.state.unlocked.purgeComplete = true;
        game.worldManager.brokenWalls.add(game.worldManager.boundaryKey(0, 0, 'right'));

        game.die('wall');

        expect(game.state.upgrades.scanner).toBe(true);
        expect(game.state.unlocked.refugeesFreed).toBe(2);
        expect(game.state.unlocked.purgeComplete).toBe(true);
        expect(game.worldManager.isWallBroken(0, 0, 'right')).toBe(true);
    });

    // THE FRESH-START CONTRACT. The cameos and Hydratia's chase are one-time GLOBAL flags,
    // so months of playtesting burn them permanently — the reported symptom was "Hydratia
    // isn't loading on the initial screen" when she had in fact been caught once, long
    // ago, and retired. No save files means a new player.
    it('a boot with no save files re-arms Hydratia and the title cameos', () => {
        window.localStorage.setItem('ouroboros-hydratia-caught', '1'); // caught in a past session
        const game = bootGame();
        expect(game.saveManager.hasHydratiaCaught()).toBe(true);

        boot(game);

        expect(game.saveManager.hasHydratiaCaught()).toBe(false); // re-armed
        expect(game._hydratia).toBeTruthy();                      // and she is on screen
    });

    it('...but a boot WITH a save file leaves the one-time flags alone', () => {
        const game = bootGame();
        game.saveManager.save(1, { unlocked: {} });
        game.saveManager.markHydratiaCaught();

        boot(game);

        expect(game.saveManager.hasHydratiaCaught()).toBe(true); // your progress is your progress
        expect(game._hydratia).toBeNull();
    });

    it('she is on screen on the BARE cold open, before any Start Screen exists', () => {
        const game = bootGame({ ctx: true });
        boot(game);

        expect(game.startMenuActive()).toBe(false); // no files: the bare void, no menu
        game.draw();
        expect(game.state.hydratia).toBeTruthy();
        expect(game.state.hydratia.x).toBeLessThan(game.canvas.width); // actually on canvas
    });

    // REGRESSION (playtest): the fresh-start re-arm called the FULL resetIntroFlags() on
    // every no-save boot, which wiped hydratia-boot/approach — the chase's own progress —
    // on each refresh. Quick reloads therefore never advanced her, for exactly the
    // pre-first-save player the chase was built for.
    it('quick reloads with no save files ADVANCE the chase (the re-arm must not eat it)', () => {
        // Boot 1: she appears at stage 0 and the boot timestamp is stamped.
        const first = bootGame();
        boot(first);
        expect(first._hydratia).toMatchObject({ stage: 0 });

        // Boot 2, "immediately" (same storage, within the 10s window): stage advances.
        const second = bootGame();
        boot(second);
        expect(second._hydratia.stage).toBe(1);

        // ...and on through to reachable: two more quick reloads.
        const third = bootGame();
        boot(third);
        const fourth = bootGame();
        boot(fourth);
        const fifth = bootGame();
        boot(fifth);
        expect(fifth._hydratia.stage).toBe(4);
        expect(fifth._hydratia.catchable).toBe(true);
    });
});

// ---------------------------------------------------------------------------------
describe('Death causes route to the right voice', () => {
    beforeEach(mountDom);

    // Every cause the engine can pass to die(), and what each channel owes it.
    const CAUSES = ['self', 'wall', 'weak', 'obstacle', 'stamp', 'glitch', 'gate', 'finale', 'heur'];

    it('the Architect has a distinct gloat for every cause (none share a line)', () => {
        const lines = CAUSES
            .filter(c => c !== 'weak') // spoken by onSubSmash on the same tick, not onDeath
            .map(c => ARCHITECT.death[c]);
        for (const [i, l] of lines.entries()) {
            expect(l, `no Architect line for '${CAUSES[i]}'`).toBeTruthy();
        }
        expect(new Set(lines).size).toBe(lines.length); // all distinct
    });

    it('Hydratia coaches every cause, in two tiers, without repeating him', () => {
        for (const c of CAUSES) {
            const tiers = HYDRATIA_DEATH.hint[c];
            expect(tiers, `no receipt hint for '${c}'`).toBeTruthy();
            expect(tiers.length).toBe(2); // [first time, repeat offender]
            for (const t of tiers) {
                expect(t.length).toBeGreaterThan(0);
                // she never restates his gloat verbatim
                expect(ARCHITECT.death[c]).not.toBe(t);
            }
        }
    });

    it('a boss match no longer reports as a quarantine-wall impact', () => {
        const game = newGame();
        for (const c of ['gate', 'finale', 'heur']) {
            game.narrative.reset();
            game.narrative.online = true;
            game.narrative.printMessage = vi.fn();
            game.narrative.onDeath(c, { unlocked: { saveFunction: true, hydratiaFound: true } });
            const said = game.narrative.printMessage.mock.calls[0][0];
            expect(said, `'${c}' fell through to the wall line`).not.toBe(ARCHITECT.death.wall);
            expect(said).toBe(ARCHITECT.death[c]);
        }
    });

    it('each cause tallies on its OWN counter, so the hint tiers escalate correctly', () => {
        const game = newGame();
        game.narrative.reset();
        const u = { saveFunction: true, hydratiaFound: true };
        game.narrative.onDeath('gate', { unlocked: u });
        game.narrative.onDeath('gate', { unlocked: u });
        game.narrative.onDeath('heur', { unlocked: u });
        expect(game.narrative.deathByCause.gate).toBe(2);
        expect(game.narrative.deathByCause.heur).toBe(1);
        expect(game.narrative.deathByCause.wall).toBe(0); // not lumped together any more
        expect(game.narrative.deathByCause.unknown).toBe(0);
    });

    it('while Cache and Hydratia are unmet he gloats the leads — and stops once found', () => {
        const game = newGame();
        game.narrative.reset();
        game.narrative.online = true;
        game.narrative.printMessage = vi.fn();
        const unmet = { saveFunction: false, hydratiaFound: false };
        for (let i = 0; i < 4; i++) game.narrative.onDeath('wall', { unlocked: unmet });
        const said = game.narrative.printMessage.mock.calls.map(c => c[0]);
        expect(said).toContain(ARCHITECT.death.hintCache);

        // ...and never once they're both found
        game.narrative.reset();
        game.narrative.online = true;
        game.narrative.printMessage = vi.fn();
        const met = { saveFunction: true, hydratiaFound: true };
        for (let i = 0; i < 12; i++) game.narrative.onDeath('wall', { unlocked: met });
        const after = game.narrative.printMessage.mock.calls.map(c => c[0]);
        expect(after).not.toContain(ARCHITECT.death.hintCache);
        expect(after).not.toContain(ARCHITECT.death.hintHydratia);
    });

    it('the sub-smash gloat branches on whether you HAD the mass to breach', () => {
        const heavy = newGame();
        heavy.narrative.online = true;
        heavy.narrative.printMessage = vi.fn();
        heavy.narrative.onSubSmash(true, {}, true);
        expect(heavy.narrative.printMessage).toHaveBeenCalledWith(ARCHITECT.subSmash.heavy);

        const light = newGame();
        light.narrative.online = true;
        light.narrative.printMessage = vi.fn();
        light.narrative.onSubSmash(true, {}, false);
        expect(light.narrative.printMessage).toHaveBeenCalledWith(ARCHITECT.subSmash.light);
    });
});

// ---------------------------------------------------------------------------------
describe('The terminal release latch (text stops the game until Space)', () => {
    beforeEach(mountDom);

    it('a finished log freezes the sim until release(); requestSkip cannot release it', () => {
        const game = newGame();
        game.narrative.isPrinting = true;
        game.narrative.awaitingRelease = true;
        game.snake.body = [{ x: 200, y: 200 }];
        step(game, { x: 20, y: 0 });
        expect(game.snake.head.x).toBe(200); // frozen — the worm did not move
        game.narrative.requestSkip();        // the type-out skip must NOT unfreeze
        expect(game.narrative.isPrinting).toBe(true);
        expect(game.narrative.release()).toBe(true);
        expect(game.narrative.isPrinting).toBe(false);
        step(game, { x: 20, y: 0 });
        expect(game.snake.head.x).toBe(220); // released — play resumes
    });

    it('reset() clears a stuck latch (a New Game can never boot frozen)', () => {
        const game = newGame();
        game.narrative.isPrinting = true;
        game.narrative.awaitingRelease = true;
        game.narrative.reset();
        expect(game.narrative.awaitingRelease).toBe(false);
        expect(game.narrative.isPrinting).toBe(false);
    });
});

describe('Canon retcon (the tick is cut; Glitches follow the anomaly)', () => {
    it('the Architect guide is trimmed to two logs and the new fuses exist', () => {
        expect(Object.keys(ARCHITECT.guide).sort()).toEqual(['3,0', '5,0']);
        expect(ARCHITECT.motionDrift).toBeUndefined(); // merged into motionCarried
        expect(ARCHITECT.canRead).toBeTruthy();
        expect(ARCHITECT.finaleCut).toBeTruthy();
    });

    it('the heartbeat lore is gone from every shipped line', () => {
        const all = [
            ...LORE_FRAGS['4,-3'], ...LORE_FRAGS['11,2'], ...BOOTH_LORE,
            ...CACHE_CHECKPOINT.demand,
        ].join(' ');
        expect(all).not.toMatch(/the tick/i);
        expect(all).not.toMatch(/pulse per tick/i);
        expect(all).not.toMatch(/count along/i);
    });

    it('seedGlitches observes (does not author) the corruption', () => {
        expect(ARCHITECT.seedGlitches).not.toMatch(/Seeding memory corruptors/);
        expect(ARCHITECT.seedGlitches).toMatch(/feeding path|wake|gathers/i);
    });
});

describe('The bounce ARG window (a crumple is a little death)', () => {
    beforeEach(mountDom);

    it('a bounce opens the listen window and letters feed the code buffer', () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1;
        game.growSnake(12);
        game.input.direction = { x: 20, y: 0 };
        game.die('border'); // crumple short-circuits into bounce()
        expect(game.state.gameState).toBe('PLAYING'); // bounced, not dead
        expect(game._argListenMs).toBeGreaterThan(0);
        for (const k of ['c', 'a', 'c', 'h']) {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: k }));
        }
        expect(game.deathCode.endsWith('CACH')).toBe(true);
        // steering keys are IGNORED (not '·'-padded) — they can't wreck a partial code
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
        expect(game.deathCode.endsWith('CACH')).toBe(true);
    });

    it('a code completed outside the Hub latches cachePending; the next Hub entry consumes it', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.deathCode = 'CACH';
        game._argListenMs = 1500;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
        expect(game.state.unlocked.cachePending).toBe(true);
        expect(game.npcs.some(n => n.id === 'cache')).toBe(false); // not manifested out here
        game.worldManager.currentRoomX = 0; game.worldManager.currentRoomY = 0;
        game.npcs = [];
        game.refreshDynamicRoomContent();
        expect(game.state.unlocked.cachePending).toBe(false);
        expect(game.npcs.some(n => n.id === 'cache')).toBe(true);
    });
});

describe('Scanner pockets + the BEYOND read', () => {
    beforeEach(mountDom);

    it('the two new pockets exist, hidden, with sealed flanks', () => {
        const wm = newGame().worldManager;
        expect(wm.getWeakPoint(0, 5, 'up')).toBeTruthy();      // door exists (forcedWeak)
        expect(wm.isWeakPointRevealed(0, 5, 'up')).toBe(false); // ...but hidden (scannerDoor)
        expect(wm.getWeakPoint(0, 5, 'right')).toBeNull();      // flank sealed
        expect(wm.getWeakPoint(8, -5, 'down')).toBeTruthy();
        expect(wm.isWeakPointRevealed(8, -5, 'down')).toBe(false);
        expect(wm.getWeakPoint(8, -5, 'left')).toBeNull();
        expect(wm.getWeakPoint(8, -5, 'right')).toBeNull();
    });

    it('the ROM Vault holds the Crumple II module (kept: manifest + mass reserve)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1; game.worldManager.currentRoomY = -5;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'uimodule' && n.grant === 'crumple2')).toBe(true);
        expect(room.npcs.some(n => n.id === 'datacache')).toBe(true);
        expect(room.npcs.some(n => n.id === 'lorefrag')).toBe(true);
    });

    it('crumple2 grants tier 2 and never downgrades', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        const npc = new NPC(100, 100, 20, 'uimodule', []);
        npc.grant = 'crumple2'; npc.roomKey = '1,-5';
        game.npcs = [npc];
        game.npcUiModule(npc);
        expect(game.state.upgrades.crumpleLevel).toBe(2);
        expect(game.shedAmount).toBe(6);
        expect(game.state.unlocked.modulesFound).toContain('1,-5');
    });

    it('classifyRoomBeyond reads the static registries (category only)', () => {
        const wm = newGame().worldManager;
        const u = { modulesFound: [], refugeesDelivered: [] };
        expect(classifyRoomBeyond(2, 2, wm, u)).toBe('module');
        expect(classifyRoomBeyond(7, -3, wm, u)).toBe('cache');
        expect(classifyRoomBeyond(11, 2, wm, u)).toBe('lore');
        expect(classifyRoomBeyond(4, 2, wm, u)).toBe('someone');
        expect(classifyRoomBeyond(11, -4, wm, u)).toBe('landmark'); // Nibble
        expect(classifyRoomBeyond(6, 1, wm, u)).toBeNull();         // plain Wilds
        // consumed content stops echoing
        expect(classifyRoomBeyond(2, 2, wm, { modulesFound: ['2,2'] })).toBeNull();
    });

    it('a sweep along a wall reveals WHAT IS BEYOND it (and it fades)', () => {
        const game = newGame();
        game.state.upgrades.scanner = true;
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 3; game.worldManager.currentRoomY = 2; // west of {2,2}
        game.snake.body = [{ x: 20, y: 100 }, { x: 20, y: 120 }, { x: 20, y: 140 }];
        game.detectScannerSweep();
        const b = game.worldManager.beyondFor(3, 2, 'left');
        expect(b).toBeTruthy();
        expect(b.kind).toBe('module');
        game.worldManager.tickReveals(b.ms + 1); // expire
        expect(game.worldManager.beyondFor(3, 2, 'left')).toBeNull();
    });
});

describe('The emptied Localhost + the refugee economy', () => {
    beforeEach(mountDom);

    it('Localhost starts empty: signpost + intake stations, no citizens', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'signpost')).toBe(true);
        expect(room.npcs.some(n => n.id === 'commons')).toBe(true);
        expect(room.npcs.some(n => n.id === 'minegate')).toBe(true);
        expect(room.npcs.filter(n => n.id === 'citizen').length).toBe(0);
        expect(room.npcs.some(n => n.id === 'hydratia')).toBe(false); // not caught yet
    });

    it('freed refugees repopulate the town (count-based)', () => {
        const game = newGame();
        game.state.unlocked.refugeesFreed = 2;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.filter(n => n.id === 'citizen').length).toBe(2);
    });

    it('a refugee waits in the Wilds, rides the tail, and is suppressed once delivered', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        const ref = room.npcs.find(n => n.id === 'refugee');
        expect(ref).toBeTruthy();
        game.npcs = room.npcs;
        const lenBefore = game.snake.body.length;
        game.npcRefugee(ref);
        finishDialog(game);
        expect(game.carriedRefugee).toBe('4,2');
        expect(game.snake.body.length).toBe(lenBefore + 1); // their seat
        expect(game.npcs.includes(ref)).toBe(false);
        // delivered origins never respawn
        game.state.unlocked.refugeesDelivered = ['4,2'];
        delete game.worldManager.rooms['4,2'];
        const again = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(again.npcs.some(n => n.id === 'refugee')).toBe(false);
    });

    it('THE COMMONS frees them: pop +1, a citizen settles in, the seat leaves', () => {
        const game = newGame();
        game.carriedRefugee = '4,2';
        game.growSnake(3);
        const lenBefore = game.snake.body.length;
        game.npcs = []; game.obstacles = []; game.glitches = []; game.apple = { x: 380, y: 380 };
        game.npcCommons(new NPC(100, 100, 20, 'commons', []));
        finishDialog(game);
        expect(game.state.unlocked.refugeesFreed).toBe(1);
        expect(game.carriedRefugee).toBeNull();
        expect(game.snake.body.length).toBe(lenBefore - 1);
        expect(game.npcs.some(n => n.id === 'citizen')).toBe(true); // settled in NOW
        expect(game.state.unlocked.refugeesDelivered).toContain('4,2');
    });

    it('THE MINE takes them: dark tally + the one-time 2-Bit unease', () => {
        const game = newGame();
        game.carriedRefugee = '9,-2';
        game.growSnake(2);
        game.npcs = []; game.obstacles = []; game.glitches = []; game.apple = { x: 380, y: 380 };
        game.npcMinegate(new NPC(100, 100, 20, 'minegate', []));
        expect(game.state.unlocked.refugeesMined).toBe(1);
        expect(game.state.unlocked.mineFirst2BitDone).toBe(true);
        expect(game.state.unlocked.refugeesFreed).toBe(0);
        finishDialog(game);
    });

    it('a death loses the carried refugee — but they respawn back home (not delivered)', () => {
        const game = newGame();
        game.carriedRefugee = '2,4';
        game.die('border');
        expect(game.carriedRefugee).toBeNull();
        expect((game.state.unlocked.refugeesDelivered || []).includes('2,4')).toBe(false);
    });
});

describe('The Data Mines (passive drip, capped, collected as motes)', () => {
    beforeEach(mountDom);

    it('miners produce per move-tick; the buffer caps (Deep Vein doubles it)', () => {
        const game = newGame();
        game.state.unlocked.refugeesMined = 5;
        game.apple = { x: 380, y: 380 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        game.snake.body = [{ x: 200, y: 200 }];
        step(game, { x: 20, y: 0 });
        expect(game.state.unlocked.mineStockpile).toBeCloseTo(0.075, 5); // 0.01*5*1.5
        game.state.unlocked.mineStockpile = 999;
        step(game, { x: 20, y: 0 });
        expect(game.state.unlocked.mineStockpile).toBe(40); // capped (>=2 miners: 20*2)
    });

    it('the stockpile lands as mine motes at Localhost, each worth EXACTLY 1', () => {
        const game = newGame();
        game.state.upgrades.dataCompression = true; // must NOT multiply stored Data
        game.state.unlocked.mineStockpile = 5;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        game.npcs = []; game.obstacles = []; game.glitches = []; game.apple = { x: 40, y: 40 };
        game.refreshDynamicRoomContent();
        const motes = game.dataMotes.filter(m => m.mine);
        expect(motes.length).toBe(5);
        // eat one: +1 score / -1 stockpile (no Compression multiplier)
        const m = motes[0];
        game.snake.body = [{ x: m.x - 20, y: m.y }];
        const score0 = game.state.score;
        step(game, { x: 20, y: 0 });
        expect(game.state.score).toBe(score0 + 1);
        expect(game.state.unlocked.mineStockpile).toBe(4);
    });

    it("2-Bit's Compression II appears only at >= 3 miners", () => {
        const game = newGame();
        game.shopManager.open('bite', () => {});
        expect(game.shopManager.rows.some(r => r.item.key === '6')).toBe(false);
        game.shopManager.close();
        game.state.unlocked.refugeesMined = 3;
        game.shopManager.open('bite', () => {});
        expect(game.shopManager.rows.some(r => r.item.key === '6')).toBe(true);
        game.shopManager.close();
    });
});

describe("Quantcy's Trust (deposit / compound / withdrawal run)", () => {
    beforeEach(mountDom);

    it('a deposit sheds the body and banks the principal (Data = segments)', () => {
        const game = newGame();
        game.state.score = 60;
        game.growSnake(60);
        const dep = game.shopManager.vendors.quantcy.items.find(i => i.key === '2'); // Deposit 25
        const lenBefore = game.snake.body.length;
        game.shopManager.purchase(dep);
        expect(game.state.unlocked.quantcyPrincipal).toBe(25);
        expect(game.state.score).toBe(35);
        expect(game.snake.body.length).toBe(lenBefore - 25); // you SHRINK by what you bank
    });

    it('the vault compounds per sector crossed and halts at yield == principal', () => {
        const game = newGame();
        game.state.unlocked.quantcyPrincipal = 100;
        game.state.unlocked.quantcyYield = 0;
        game.apple = { x: 380, y: 380 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        game.shiftScreen(1, 0);
        expect(game.state.unlocked.quantcyYield).toBeCloseTo(3, 5); // 3%/sector
        game.state.unlocked.quantcyYield = 100; // full vault
        game.shiftScreen(1, 0);
        expect(game.state.unlocked.quantcyYield).toBe(100); // halted — go collect
    });

    it('a withdrawal converts the vault to motes AT HIS ROOM; the vault survives death, the haul does not', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 7; game.worldManager.currentRoomY = -2;
        game.npcs = []; game.obstacles = []; game.glitches = []; game.apple = { x: 40, y: 40 };
        game.dataMotes = [];
        game.state.unlocked.quantcyPrincipal = 10;
        game.state.unlocked.quantcyYield = 2.9;
        game.quantcyWithdraw();
        expect(game.state.unlocked.quantcyPrincipal).toBe(0);
        expect(game.state.unlocked.quantcyPayout).toBe(12); // floored
        expect(game.dataMotes.filter(m => m.vault).length).toBe(12);
        // die before collecting: the un-collected payout is still yours (durable)…
        game.die('border');
        expect(game.state.unlocked.quantcyPayout).toBe(12);
        expect(game.state.score).toBe(0); // …but anything you'd embodied is gone
    });
});

describe('Hydratia (the catch, the autosave, the receipt)', () => {
    beforeEach(mountDom);

    it('QUICK reloads advance the chase (the hide timer); four in a row = catchable', () => {
        const game = newGame();
        // boot 1 seeds the timestamp; boots 2-5 land inside the 10s window
        for (let i = 0; i < 4; i++) game.maybeStartHydratiaCatch();
        expect(game.saveManager.hydratiaApproach()).toBe(3);
        game.maybeStartHydratiaCatch();
        expect(game.saveManager.hydratiaApproach()).toBe(4);
        expect(game._hydratia && game._hydratia.catchable).toBe(true);
    });

    it('erasing the LAST save file restores the intro beats (playtest: the cameos stopped existing)', () => {
        const game = newGame();
        game.saveManager.save(1, { unlocked: {} });
        // burn every one-time flag, the way months of playtesting does
        game.saveManager.markCameoSeen();
        game.saveManager.markCadenzaCameoSeen();
        game.saveManager.markHydratiaCaught();
        expect(game.saveManager.hasCameoSeen()).toBe(true);

        game.state.gameState = 'START';
        game.startMenuIndex = 0;
        game.startMenuHandleKey('Delete');           // arm
        game.startMenuHandleKey('Delete');           // confirm — that was the last file
        expect(game.saveManager.anySave()).toBe(false);
        // a genuinely fresh start: the openings come back
        expect(game.saveManager.hasCameoSeen()).toBe(false);
        expect(game.saveManager.hasCadenzaCameoSeen()).toBe(false);
        expect(game.saveManager.hasHydratiaCaught()).toBe(false);
        expect(game.state.unlocked.hydratiaFound).toBe(false);
    });

    it('erasing ONE of several files leaves the intro flags alone', () => {
        const game = newGame();
        game.saveManager.save(1, { unlocked: {} });
        game.saveManager.save(2, { unlocked: {} });
        game.saveManager.markCameoSeen();
        game.state.gameState = 'START';
        game.startMenuIndex = 0;
        game.startMenuHandleKey('Delete');
        game.startMenuHandleKey('Delete');
        expect(game.saveManager.anySave()).toBe(true);   // file 2 survives
        expect(game.saveManager.hasCameoSeen()).toBe(true); // ...so the cameo stays spent
    });

    it('she haunts the BARE cold open too — no save files required (owner fix)', () => {
        const game = newGame();
        game.state.gameState = 'START'; // the boot screen, before any file exists
        expect(game.saveManager.anySave()).toBe(false); // pre-Start-Screen player
        game.maybeStartHydratiaCatch();
        expect(game._hydratia).toBeTruthy(); // the glimpse still loads
        // ...and catching her from the cold open works end-to-end
        game.saveManager.setHydratiaApproach(3);
        game.saveManager.setHydratiaBoot(Date.now()); // a quick reload follows
        game.maybeStartHydratiaCatch();
        expect(game._hydratia.catchable).toBe(true);
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        finishDialog(game);
        expect(game.saveManager.hasHydratiaCaught()).toBe(true);
        expect(game.state.gameState).toBe('START'); // the catch did NOT start the run
    });

    it('her stall seats in Localhost once caught', () => {
        const game = newGame();
        game.state.unlocked.hydratiaFound = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'hydratia')).toBe(true);
    });

    it('Auto-Commit writes the SHADOW buffer on entering a safe zone — never the manual file', () => {
        const game = newGame();
        game.state.unlocked.saveFunction = true;
        game.state.unlocked.autosaveSafe = true;
        game.apple = { x: 380, y: 380 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 0;
        game.shiftScreen(1, 0); // step east into Localhost {5,0}
        expect(game.saveManager.hasAuto(1)).toBe(true);
        expect(game.saveManager.hasSave(1)).toBe(false); // Cache's file untouched
        const d = game.saveManager.loadAuto(1);
        expect(d.score).toBeUndefined(); // structurally cannot bank carried Data
        expect(d.unlocked).toBeTruthy();
    });

    it('Last Breath snapshots progress at death; Warm Restore loads it', () => {
        const game = newGame();
        game.state.unlocked.saveFunction = true;
        game.state.unlocked.autosaveDeath = true;
        game.state.upgrades.scanner = true; // some progress worth keeping
        game.die('self');
        expect(game.saveManager.hasAuto(1)).toBe(true);
        expect(game.loadAutoSlot(1)).toBe(true);
        expect(game.state.upgrades.scanner).toBe(true);
        expect(game.state.score).toBe(0); // a load is always a fresh, Data-less run
    });

    it('the death receipt reassures + coaches, escalating on the repeat cause', () => {
        const game = newGame();
        game.state.unlocked.hydratiaFound = true; // caught — her name shows
        game.die('self');
        expect(game._deathReceipt.hint).toBe(HYDRATIA_DEATH.hint.self[0]);
        expect(game._deathReceipt.line).toBe(HYDRATIA_DEATH.receipt);
        game.state.gameState = 'PLAYING'; game.die('self');
        game.state.gameState = 'PLAYING'; game.die('self');
        expect(game._deathReceipt.hint).toBe(HYDRATIA_DEATH.hint.self[1]); // 3rd offense: tier 2
    });
});

// ---------------------------------------------------------------------------------
// REGRESSIONS — the adversarial review's confirmed findings, locked in.
describe('Review fixes (sprint 2)', () => {
    beforeEach(mountDom);

    it('salvage motes pay EXACTLY 1 — Compression cannot mint Data from a crumple loop', () => {
        const game = newGame();
        game.state.upgrades.dataCompression2 = true; // x3 apples — but NOT re-embodied Data
        game.dataMotes = [{ x: 220, y: 200, salvage: true }];
        game.snake.body = [{ x: 200, y: 200 }];
        game.apple = { x: 40, y: 40 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        const score0 = game.state.score;
        step(game, { x: 20, y: 0 });
        expect(game.state.score).toBe(score0 + 1); // not +3
    });

    it('a mine-gated shop item cannot be bought while hidden (keypress path)', () => {
        const game = newGame();
        game.state.score = 60;
        game.growSnake(60);
        const compII = game.shopManager.vendors.bite.items.find(i => i.key === '6');
        game.shopManager.purchase(compII); // gate closed: refugeesMined = 0
        expect(game.state.upgrades.dataCompression2).toBe(false);
        expect(game.state.score).toBe(60); // nothing charged
        game.state.unlocked.refugeesMined = 3;
        game.shopManager.purchase(compII); // gate open
        expect(game.state.upgrades.dataCompression2).toBe(true);
    });

    it('a refugee lost to a death WALKS HOME — their origin room regenerates with them', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        const ref = room.npcs.find(n => n.id === 'refugee');
        game.npcs = room.npcs;
        game.npcRefugee(ref);
        finishDialog(game);
        expect(game.carriedRefugee).toBe('4,2');
        game.die('border'); // a real death mid-carry (no Crumple)
        expect(game.carriedRefugee).toBeNull();
        expect(game.worldManager.rooms['4,2']).toBeUndefined(); // cache invalidated...
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        const back = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(back.npcs.some(n => n.id === 'refugee')).toBe(true); // ...they're home
    });

    it("a bounce never sheds a passenger's seat", () => {
        const game = newGame();
        game.state.upgrades.crumpleLevel = 1; // shed 10
        game.carriedRefugee = '4,2';
        game.growSnake(3); // head + 3 (one of them the seat)
        game.input.direction = { x: 20, y: 0 };
        game.bounce();
        // fold keeps 1 + riderCount at minimum: head in body, the rest in pendingUnfold
        expect(game.snake.body.length + game.pendingUnfold).toBeGreaterThanOrEqual(2);
        expect(game.carriedRefugee).toBe('4,2'); // still aboard
    });

    it('New Game re-mirrors the global Hydratia catch (her stall survives fresh files)', () => {
        const game = newGame();
        game.saveManager.markHydratiaCaught();
        game.resetToNewGame();
        expect(game.state.unlocked.hydratiaFound).toBe(true);
    });

    it('Space advances an OPEN DIALOG before the terminal latch (finale unresponsiveness)', () => {
        const game = newGame();
        game.state.gameState = 'DIALOG';
        game.dialogManager.start(['line one', 'line two'], () => {});
        game.narrative.awaitingRelease = true;
        game.narrative.isPrinting = true;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(game.narrative.awaitingRelease).toBe(true); // the latch did NOT eat the press
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(game.dialogManager.currentDialog).toBeFalsy(); // the dialog consumed both
    });

    it('the bounce window records ADVANCE-ONLY: steering noise never wrecks a partial code', () => {
        const game = newGame();
        game.deathCode = 'CAC';
        game._argListenMs = 1500;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' })); // steering — ignored
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' })); // steering — ignored
        expect(game.deathCode).toBe('CAC');
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' })); // the next letter
        expect(game.deathCode).toBe('CACH');
    });

    it('an auto-only buffer keeps the boot menu alive (anySave counts shadows)', () => {
        const game = newGame();
        expect(game.saveManager.anySave()).toBe(false);
        game.saveManager.saveAuto(2, { unlocked: {} });
        expect(game.saveManager.anySave()).toBe(true);
    });

    it('a pre-sprint save that collected {2,2} is granted its replacement (redline)', () => {
        const game = newGame();
        const ok = game.applySave({ unlocked: { modulesFound: ['2,2'], gearMeter: true } });
        expect(ok).toBe(true);
        expect(game.state.unlocked.redline).toBe(true);
    });
});

// ---------------------------------------------------------------------------------
// PLAYTEST ROUND 2 — the owner's feedback items, locked in.
describe('Playtest feedback (round 2)', () => {
    beforeEach(mountDom);

    it('Denny stands down from {1,0} once the map is installed AND Localhost is open', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1; game.worldManager.currentRoomY = 0;
        expect(game.worldManager.getOrCreateRoom(game.state.unlocked).npcs.some(n => n.id === 'denny')).toBe(true);
        game.state.unlocked.mapModule = true;
        game.state.unlocked.biteDroppedOff = true;
        game._maybeRetireDenny(); // the cached room is wiped when the pair completes
        const after = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(after.npcs.some(n => n.id === 'denny')).toBe(false);
    });

    it("the Architect's met-but-not-carried gloat fires once, then normal gloats resume", () => {
        const game = newGame();
        game.narrative.online = true;
        const printed = [];
        game.narrative.printMessage = (m) => printed.push(m);
        game.state.unlocked.biteProgress = 1; // met 2-Bit...
        game.state.unlocked.tailRider = false; // ...but never hooked him aboard
        game.die('border');
        expect(printed[printed.length - 1]).toContain('merchant remnant');
        game.state.gameState = 'PLAYING';
        game.die('border');
        expect(printed[printed.length - 1]).not.toContain('merchant remnant'); // once per run
    });

    it('the Fall-Through catch THROWS you back toward the door you entered (never kills)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 }; game.obstacles = []; game.glitches = [];
        game._roomEntryDir = { x: 0, y: -1 }; // you entered heading NORTH (from the south door)
        const denny = new NPC(120, 100, 20, 'denny2', []); // already adjacent
        game.npcs = [denny];
        game.snake.body = [{ x: 100, y: 100 }];
        game.input.direction = { x: 20, y: 0 };
        game._denny2Catch(denny);
        expect(game.input.direction).toEqual({ x: 0, y: 20 }); // hurled back toward the south door
        expect(game.gear).toBe(0);
        expect(game.state.gameState).toBe('PLAYING'); // a DENIED, never a death
        expect(denny.stunMs).toBeGreaterThan(0); // satisfied — you get a running start
    });

    it('the Pause inventory lists what you own by display name', () => {
        const game = newGame();
        game.state.upgrades.scanner = true;
        game.state.upgrades.crumpleLevel = 2;
        game.state.unlocked.mapModule = true;
        game.state.unlocked.autosaveSafe = true;
        const inv = game._buildInventory();
        expect(inv.upgrades).toContain('Topology Scanner');
        expect(inv.upgrades).toContain('Crumple Buffer II');
        expect(inv.upgrades).toContain('Auto-Commit');
        expect(inv.modules).toContain('Sector Map');
    });

    it('outside the Hub, an eaten apple can WANDER (20%); re-entry re-arms the room', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 3; game.worldManager.currentRoomY = 1;
        game.npcs = []; game.obstacles = []; game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }];
        game.apple = { x: 120, y: 100 };
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1); // inside the 20%
        step(game, { x: 20, y: 0 });
        rand.mockRestore();
        expect(game.apple).toBeNull(); // it skittered into another sector
        game.shiftScreen(1, 0);  // leave...
        game.shiftScreen(-1, 0); // ...and return: the food came back
        expect(game.apple).toBeTruthy();
    });

    it("a wandered-off apple can't crash a tick — the room simply has no food (playtest lockup)", () => {
        const game = newGame();
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked); // the refugee room
        game.npcs = room.npcs; game.obstacles = []; game.glitches = [];
        game.apple = null; // the skitter just happened
        game.snake.body = [{ x: 100, y: 100 }];
        expect(() => {
            step(game, { x: 20, y: 0 }); // the old code threw in checkAppleCollision
            step(game, { x: 20, y: 0 });
        }).not.toThrow();
        expect(game.state.gameState).toBe('PLAYING');
    });

    it('the death receipt is UNATTRIBUTED until Hydratia is caught', () => {
        const game = newGame();
        game.die('self');
        expect(game._deathReceipt.line).not.toContain('HYDRATIA');
        game.state.gameState = 'PLAYING';
        game.state.unlocked.hydratiaFound = true;
        game.die('self');
        expect(game._deathReceipt.line).toContain('HYDRATIA');
    });

    it('a carried refugee rides the tail with a face, like 2-Bit', () => {
        const game = newGame();
        game.carriedRefugee = '4,2';
        game.growSnake(4);
        expect(game.refugeeIndex).toBe(game.snake.body.length - 1); // the tail tip
        game.carriedRefugee = null;
        expect(game.refugeeIndex).toBe(-1);
    });

    it('the Hub always respawns its apple in place (tutorial economy)', () => {
        const game = newGame();
        game.npcs = []; game.obstacles = []; game.glitches = [];
        game.snake.body = [{ x: 100, y: 100 }];
        game.apple = { x: 120, y: 100 };
        const rand = vi.spyOn(Math, 'random').mockReturnValue(0.1);
        step(game, { x: 20, y: 0 });
        rand.mockRestore();
        expect(game.apple).toBeTruthy();
    });

    it("Hydratia's shop is a tiered ladder: each Shadow Copy requires the last", () => {
        const game = newGame();
        game.shopManager.open('hydratia', () => {});
        expect(game.shopManager.rows.length).toBe(1); // only tier I on the shelf
        game.shopManager.close();
        game.state.unlocked.autosaveSafe = true;
        game.shopManager.open('hydratia', () => {});
        expect(game.shopManager.rows.length).toBe(2); // tier II appears
        game.shopManager.close();
    });

    it('the ribbon gear gauge appears with the meter unlock and reads the live gear', () => {
        const game = newGame();
        game.state.unlocked.ui = true;
        game.state.unlocked.gearMeter = true;
        game.state.score = 30;
        game.gear = 2;
        game.refreshGearDisplay();
        const el = document.getElementById('gear-display');
        expect(el.classList.contains('hidden')).toBe(false);
        expect(el.querySelectorAll('.gear-pip.on').length).toBe(2);
        game.gear = -1;
        game.refreshGearDisplay();
        expect(el.innerHTML).toContain('BRK');
    });
});
