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
import { mountDom, makeGame, step, finishDialog, recordingCtx, badGeometry } from './helpers.js';

const newGame = (width = 400, height = 400) => makeGame({ width, height });

// ---------------------------------------------------------------------------------
// APPLES KEEP THEIR DISTANCE FROM THE WALL (owner: "a little easier, not a lot").
// Measured before the change: 20.9% of spawns landed wall-adjacent and 1.2% in true
// corners, so more than one apple in five demanded a turn executed within one cell of a
// lethal boundary — 30ms at gear 3. Buffer the REWARDS, not the hazards: nobody plays
// differently because apples MIGHT spawn by a wall, so removing it costs no decisions.
describe('Apple spawn buffer', () => {
    beforeEach(mountDom);

    const ringDist = (game, a) => {
        const g = game.gridSize;
        const cols = Math.floor(game.canvas.width / g), rows = Math.floor(game.canvas.height / g);
        return Math.min(a.x / g, a.y / g, cols - 1 - a.x / g, rows - 1 - a.y / g);
    };

    it('no apple spawns wall-adjacent, over a large sample', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        let closest = 99;
        for (let i = 0; i < 4000; i++) closest = Math.min(closest, ringDist(game, rg.spawnValidApple([], [], [])));
        expect(closest).toBeGreaterThanOrEqual(game.worldManager.roomGenerator.APPLE_WALL_BUFFER);
    });

    it('the in-game spawner honours it too (not just the generator)', () => {
        const game = newGame();
        let closest = 99;
        for (let i = 0; i < 400; i++) closest = Math.min(closest, ringDist(game, game.spawnApple()));
        expect(closest).toBeGreaterThanOrEqual(2);
    });

    // The buffer must never be able to STARVE the spawn: better a wall-adjacent apple
    // than no apple. A crowded set-piece room or a small canvas relaxes it by one ring.
    it('relaxes to the interior when the buffered band is full', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        const g = game.gridSize;
        const blockers = [];
        for (let c = 2; c <= rg.cols - 3; c++) {
            for (let r = 2; r <= rg.rows - 3; r++) blockers.push({ x: c * g, y: r * g });
        }
        const a = rg.spawnValidApple([], [], [], blockers);
        expect(blockers.some(b => b.x === a.x && b.y === a.y)).toBe(false); // a real free cell
        expect(ringDist(game, a)).toBe(1);                                  // ...one ring out
    });

    it('still places an apple on canvases too small for the buffer', () => {
        for (const dim of [200, 140, 100, 80]) {
            const game = makeGame({ width: dim, height: dim });
            const a = game.worldManager.roomGenerator.spawnValidApple([], [], []);
            expect(a, `${dim}x${dim}`).toBeTruthy();
            expect(Number.isFinite(a.x) && Number.isFinite(a.y)).toBe(true);
        }
    });

    it('a fully occupied room returns a fallback instead of hanging', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        const g = game.gridSize;
        const all = [];
        for (let c = 0; c < rg.cols; c++) for (let r = 0; r < rg.rows; r++) all.push({ x: c * g, y: r * g });
        expect(rg.spawnValidApple([], [], [], all)).toBeTruthy();
    });

    it('HAZARDS keep their wall-adjacent spawns — the buffer is for rewards only', () => {
        // A Glitch by a wall is avoidable and avoiding it is a real choice; an apple by a
        // wall is compulsory. If this ever fails, the principle has been over-applied.
        const game = newGame();
        game.state.unlocked.biteProgress = 1;
        const rg = game.worldManager.roomGenerator;
        let sawEdgeHazard = false;
        for (let x = 1; x <= 11 && !sawEdgeHazard; x++) {
            for (let y = -5; y <= 5 && !sawEdgeHazard; y++) {
                const room = rg.generateRoom(x, y, game.state.unlocked, game.worldManager);
                for (const o of [...(room.glitches || []), ...(room.obstacles || [])]) {
                    if (ringDist(game, o) <= 1) { sawEdgeHazard = true; break; }
                }
            }
        }
        expect(sawEdgeHazard).toBe(true);
    });
});

// ---------------------------------------------------------------------------------
// 2-BIT FITS THE GEARBOX — the one moment the game hands you its central verb, so it is
// a scene rather than a flag flip. Reuses the Module Slot install's freeze contract and
// its "flies up into your instruments" grammar.
describe('2-Bit fits the gearbox', () => {
    beforeEach(mountDom);

    const atOffer = () => {
        const game = makeGame({ ctx: true });
        game.state.unlocked.biteProgress = 1;
        game.state.score = 30; game.growSnake(30);
        const bite = new NPC(200, 200, 20, 'bite', []);
        game.npcs = [bite];
        return { game, bite };
    };
    const throughOffer = (game, bite) => {
        game.npcBite(bite);
        finishDialog(game);
    };
    const runInstall = (game) => {
        let t = 0;
        while (game.gearInstall && t < 5000) { game.update(16); t += 16; }
        return t;
    };

    it('the gauge is WITHHELD until the last pip lands — the payoff is the animation', () => {
        const { game, bite } = atOffer();
        throughOffer(game, bite);
        // He is aboard immediately (the gag: finishing the offer IS agreeing)...
        expect(game.state.unlocked.tailRider).toBe(true);
        // ...but the tachometer is not yet fitted.
        expect(game.state.unlocked.gearMeter).toBe(false);
        expect(game.gearInstall).toBeTruthy();

        runInstall(game);
        expect(game.state.unlocked.gearMeter).toBe(true);
        expect(game.gearInstall).toBeNull();
        expect(game.state.gameState).toBe('DIALOG'); // ...into the driving tutorial
        finishDialog(game);
        expect(game.state.gameState).toBe('PLAYING');
    });

    it('all three pips are on screen before the scene ends (the settle beat)', () => {
        const { game, bite } = atOffer();
        throughOffer(game, bite);
        const seen = new Set();
        let t = 0;
        while (game.gearInstall && t < 5000) {
            game.update(16); t += 16;
            seen.add(game.gearInstall ? game.gearInstall.pips : null);
        }
        // Without the settle, the third pip landed on the same frame the scene ended and
        // the completed rack never rendered.
        expect([...seen]).toContain(3);
    });

    it('freezes the sim while it plays', () => {
        const { game, bite } = atOffer();
        throughOffer(game, bite);
        game.input.direction = { x: 20, y: 0 };
        game.input.nextDirection = { x: 20, y: 0 };
        const head = { ...game.snake.head };
        for (let i = 0; i < 20; i++) game.update(16);
        expect(game.snake.head).toMatchObject(head);
    });

    it('draws cleanly in both motion modes, and balances save/restore', () => {
        for (const rm of [false, true]) {
            const { game, bite } = atOffer();
            game.settings.reduceMotion = rm;
            throughOffer(game, bite);
            const ctx = recordingCtx();
            game.renderer.ctx = ctx;
            let t = 0;
            while (game.gearInstall && t < 5000) { game.update(16); t += 16; game.draw(); }
            expect(badGeometry(ctx.__ops), `reduceMotion=${rm}`).toEqual([]);
            expect(ctx.__ops.filter(o => o.op === 'save').length)
                .toBe(ctx.__ops.filter(o => o.op === 'restore').length);
        }
    });

    it('never outlives its scene (death mid-install)', () => {
        const { game, bite } = atOffer();
        throughOffer(game, bite);
        expect(game.gearInstall).toBeTruthy();
        game.die('wall');
        expect(game.gearInstall).toBeNull();
    });
});

// ---------------------------------------------------------------------------------
// THE TEXT HOLD (owner: "a systemic way to keep players from hitting walls and dying
// after exiting a text box"). Decision 5 froze the game for text but resumed the worm at
// full momentum, pointed wherever it was pointed — one cell from a wall, no reaction
// time could save you. Now every text surface closing back into play HOLDS the worm,
// still facing, until the next steering input: the same contract as every spawn.
describe('The text hold — text stops the worm too', () => {
    beforeEach(mountDom);

    // Fresh keydown-listener hygiene (engines register modal listeners; see the
    // Playtest describe above for the original incident).
    let attached = [];
    const holdGame = () => {
        const orig = window.addEventListener;
        window.addEventListener = function (type, handler, o) {
            if (type === 'keydown') attached.push(handler);
            return orig.call(this, type, handler, o);
        };
        let game;
        try { game = makeGame({}); } finally { window.addEventListener = orig; }
        return game;
    };
    afterEach(() => {
        for (const h of attached) window.removeEventListener('keydown', h);
        attached = [];
    });

    // Drive straight at the right wall and stop one cell short, at speed.
    const armAtWall = (game) => {
        game.state.unlocked.borders = true;
        game.state.unlocked.tailRider = true;
        game.state.score = 30; game.growSnake(30);
        game.changeGear(3);
        const y = 200;
        game.snake.body = [];
        for (let i = 0; i < 31; i++) game.snake.body.push({ x: game.ringRight - 20 - i * 20, y });
        game.input.direction = { x: 20, y: 0 };
        game.input.nextDirection = { x: 0, y: 0 };
        game.apple = { x: 40, y: 40 }; game.glitches = []; game.npcs = []; game.obstacles = [];
    };

    it('THE HEADLINE: one cell from a wall at gear 3, a dialog closes — you live', () => {
        const game = holdGame();
        armAtWall(game);
        game.update(50); // establish "not frozen"
        const head = { ...game.snake.head };

        game.state.gameState = 'DIALOG';   // text opens
        game.update(1000);
        game.state.gameState = 'PLAYING';  // text closes — the old code resumed at speed
        for (let i = 0; i < 10; i++) game.update(1000);

        expect(game.state.gameState).toBe('PLAYING');       // alive
        expect(game.snake.head).toMatchObject(head);        // and unmoved

        // ...and a steering tap releases the hold and moves you.
        game.input.nextDirection = { x: 0, y: -20 };
        game.update(1000);
        expect(game.snake.head.y).toBe(head.y - 20);
    });

    it('every text surface engages the hold on close', () => {
        const freezes = {
            dialog: (g, on) => { g.state.gameState = on ? 'DIALOG' : 'PLAYING'; },
            shop: (g, on) => { g.state.gameState = on ? 'SHOP' : 'PLAYING'; },
            pause: (g, on) => { g.state.gameState = on ? 'PAUSED' : 'PLAYING'; },
            options: (g, on) => { g.optionsOpen = on; },
            terminal: (g, on) => { g.narrative.isPrinting = on; },
            moduleInstall: (g, on) => { g.moduleLoad = on ? { phase: 0, t: 0 } : null; },
        };
        for (const [name, set] of Object.entries(freezes)) {
            const game = holdGame();
            armAtWall(game);
            game.update(50);
            const head = { ...game.snake.head };
            set(game, true);
            game.update(200);
            set(game, false);
            if (name === 'moduleInstall') game.moduleLoad = null; // updateModuleLoad may have run
            for (let i = 0; i < 6; i++) game.update(1000);
            expect(game.snake.head, `${name} did not hold`).toMatchObject(head);
            expect(game.state.gameState).toBe('PLAYING');
        }
    });

    it('a tap along your FACING axis resumes WITHOUT shifting gear', () => {
        const game = holdGame();
        armAtWall(game);
        // face away from the wall so resuming does not immediately meet it
        game.input.direction = { x: -20, y: 0 };
        game.update(50);
        game.state.gameState = 'DIALOG';
        game.update(200);
        game.state.gameState = 'PLAYING';
        game.update(50); // hold engaged
        const gearBefore = game.gear;
        const head = { ...game.snake.head };

        // ArrowLeft while facing left = the "go" tap. Old behaviour: an upshift.
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        game.update(1000);

        expect(game.gear).toBe(gearBefore);           // consumed as resume, not a shift
        expect(game.snake.head.x).toBe(head.x - 20);  // and the worm moves
    });

    it('a steer buffered DURING a printing log is honoured, not eaten (respawn contract)', () => {
        const game = holdGame();
        armAtWall(game);
        game.update(50);
        game.narrative.isPrinting = true;   // the death-log scenario
        game.update(200);
        game.input.nextDirection = { x: 0, y: -20 }; // the wake-press steer, buffered
        game.narrative.isPrinting = false;
        const head = { ...game.snake.head };
        game.update(1000);
        // The queued turn releases the hold on the first tick — motionless-at-spawn was
        // a bug once already; the hold must never reintroduce it.
        expect(game.snake.head.y).toBe(head.y - 20);
    });

    it('the world keeps its own clocks while the worm holds', () => {
        const game = holdGame();
        armAtWall(game);
        game.state.unlocked.motionCarried = true;
        game.glitches = [{ x: 100, y: 100 }]; // a drifter (gets its _m pattern lazily)
        game.update(50);
        game.state.gameState = 'DIALOG';
        game.update(200);
        game.state.gameState = 'PLAYING';
        const head = { ...game.snake.head };
        const gl = { ...game.glitches[0] };
        for (let i = 0; i < 12; i++) game.update(200); // several WORLD_STEPs of wall time
        expect(game.snake.head).toMatchObject(head);   // worm held
        const moved = game.glitches[0].x !== gl.x || game.glitches[0].y !== gl.y;
        expect(moved).toBe(true);                      // world did not
    });
});

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

// ---------------------------------------------------------------------------------
// PLAYTEST ROUND 3 — the owner's post-cabinet feedback, locked in.
describe('Playtest feedback (round 3)', () => {
    beforeEach(mountDom);

    // 1. THE GROWING TERMINAL. The CSS side (definite ribbon height / min-height: 0 /
    // grid-template-rows: 100%) can't be asserted in happy-dom, so what's pinned here is
    // the DOM side: the monitor trims its own scrollback, so a long session can never
    // accumulate an unbounded line stack for layout to lose a fight with.
    it('the terminal trims scrollback nobody can reach (>=31 lines never accumulate)', () => {
        const game = newGame();
        game.narrative.online = true;
        const term = document.getElementById('narrative-terminal');
        for (let i = 0; i < 45; i++) {
            const div = document.createElement('div');
            div.className = 'narrative-line';
            term.appendChild(div);
        }
        game.narrative.printMessage('LOG: one more line.');
        // The trim runs synchronously at the top of processQueue (before any await).
        expect(term.querySelectorAll('.narrative-line').length).toBeLessThanOrEqual(31);
    });

    // 2. NO SCRAPE IN A DOORWAY (owner). The glide is friction against WALL; a doorway
    // is a hole. The old band test (<= ringLeft) also counted ring cells and the
    // off-canvas trail mid-crossing, so every room transit scraped the whole way through.
    it('threading an open door is silent; dragging along solid wall still scrapes', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.glitches = [];
        const wm = game.worldManager;
        wm.currentRoomX = 1; wm.currentRoomY = 0;
        const wp = wm.getWeakPoint(1, 0, 'up');
        expect(wp, 'test premise: {1,0} has a north door').toBeTruthy();
        wm.breakWall(1, 0, 'up');

        // Body threading the open doorway: one segment in the ring cell, one on the
        // interior band INSIDE the door span, one off-canvas (the mid-crossing trail).
        game.snake.body = [
            { x: wp.start, y: 0 },                 // in the ring (inside the hole)
            { x: wp.start, y: game.ringTop },      // interior band, within the open span
            { x: wp.start, y: -20 },               // off-canvas trail
        ];
        game.playAmbientAudio();
        expect(game.audio.playGlide).not.toHaveBeenCalled();

        // The same band cell OUTSIDE the open span is real wall: it scrapes. (Scan for
        // an interior column clear of the span — the span's position is hash-varied.)
        let outX = null;
        for (let x = game.ringLeft; x <= game.ringRight - game.gridSize; x += game.gridSize) {
            if (x < wp.start || x > wp.end) { outX = x; break; }
        }
        game.snake.body = [{ x: outX, y: game.ringTop }];
        game.playAmbientAudio();
        expect(game.audio.playGlide).toHaveBeenCalledTimes(1);

        // An off-canvas trail segment must not phantom-match a PERPENDICULAR wall:
        // {x: ringLeft, y: -40} has the left band's x but sits far above the room
        // (review-confirmed: ~1 in 14 doors hugs a corner closely enough to hit this).
        game.audio.playGlide.mockClear();
        game.snake.body = [{ x: game.ringLeft, y: -40 }, { x: game.ringRight - 20, y: game.canvas.height + 40 }];
        game.playAmbientAudio();
        expect(game.audio.playGlide).not.toHaveBeenCalled();

        // An INTACT (unbroken) weak point is still wall — perforated, not open.
        const game2 = newGame();
        game2.state.unlocked.borders = true;
        game2.glitches = [];
        game2.worldManager.currentRoomX = 1; game2.worldManager.currentRoomY = 0;
        const wp2 = game2.worldManager.getWeakPoint(1, 0, 'up');
        game2.snake.body = [{ x: wp2.start, y: game2.ringTop }];
        game2.playAmbientAudio();
        expect(game2.audio.playGlide).toHaveBeenCalledTimes(1);
    });

    // 3. THE WALL EXTRUSION. One-time, at the 10-Data flip; loads/respawns skip it.
    it('the 10-Data unlock runs the extrusion once; loads skip straight to settled', () => {
        const game = makeGame({ ctx: true });
        game.state.score = 10;
        game.checkUnlocks();
        expect(game.state.unlocked.borders).toBe(true);
        expect(game._wallsDeploy).not.toBeNull();
        game.draw();
        expect(game.state.wallsDeployT).toBeGreaterThanOrEqual(0);
        expect(game.state.wallsDeployT).toBeLessThan(1);
        // ...and the animated frame draws clean (the extrusion path, mid-flight).
        const ctx = recordingCtx();
        game.renderer.ctx = ctx;
        game.draw();
        expect(badGeometry(ctx.__ops)).toEqual([]);
        expect(ctx.__ops.filter(o => o.op === 'save').length)
            .toBe(ctx.__ops.filter(o => o.op === 'restore').length);
        // THE SNAP (review-confirmed): the containment log is skippable by design, so
        // the instant the freeze ends the band must be FULLY drawn — skip the cinematic,
        // forfeit the cinematic, never the information. Lethal physics may never run
        // ahead of a half-drawn wall.
        game._wallsDeploy = performance.now(); // mid-animation...
        game.narrative.isPrinting = false;     // ...but the log was skipped + released
        game.narrative.awaitingRelease = false;
        game.draw();
        expect(game.state.wallsDeployT).toBe(1);
        expect(game._wallsDeploy).toBeNull();

        // A LOAD arrives with borders already true and never re-runs it.
        const loaded = makeGame({ ctx: true });
        loaded.applySave({ unlocked: { borders: true } });
        loaded.draw();
        expect(loaded.state.wallsDeployT).toBe(1);
    });

    // 4. HYDRATIA IS SHY (owner): she peeks for ~a second, dashes off the edge she came
    // from, and only the trace lane survives her. Stage 4 holds still until spooked.
    it('below stage 4 she peeks, dashes, and leaves only the trace', () => {
        const game = makeGame({ ctx: true, playing: false });
        game._hydratia = { stage: 2, catchable: false, born: performance.now(), bolt: null };
        game.draw();
        expect(game.state.hydratia.gone).toBe(false);       // peeking
        expect(game.state.hydratia.dashing).toBe(false);
        const peekX = game.state.hydratia.x;

        game._hydratia.born = performance.now() - (game.HYDRATIA_PEEK_MS + 100); // mid-dash
        game.draw();
        expect(game.state.hydratia.dashing).toBe(true);
        expect(game.state.hydratia.x).toBeGreaterThan(peekX); // moving toward the edge

        game._hydratia.born = performance.now() - (game.HYDRATIA_PEEK_MS + game.HYDRATIA_DASH_MS + 50);
        game.draw();
        expect(game.state.hydratia.gone).toBe(true);          // just the trace lane now
        expect(game.state.hydratia.baseX).toBe(peekX);        // the lane starts where she was
    });

    it('stage 4 holds still until a non-catch key spooks her into a visible dash', () => {
        const game = makeGame({ ctx: true, playing: false });
        game._hydratia = { stage: 4, catchable: true, born: performance.now() - 60000, bolt: null };
        game.draw();
        expect(game.state.hydratia.gone).toBe(false);         // a minute later: still there
        expect(game.state.hydratia.dashing).toBe(false);
        game._hydratia.bolt = performance.now() - 50;         // spooked
        game.draw();
        expect(game.state.hydratia.dashing).toBe(true);
    });

    it('under reduce-motion the dash is a hard cut — no travel frames', () => {
        const game = makeGame({ ctx: true, playing: false });
        game.settings.reduceMotion = true;
        game._hydratia = { stage: 1, catchable: false, born: performance.now() - (game.HYDRATIA_PEEK_MS + 10), bolt: null };
        game.draw();
        expect(game.state.hydratia.dashing).toBe(false);
        expect(game.state.hydratia.gone).toBe(true);
    });

    // 5. THE MODULE SLOT IS GONE. Its install-on-pickup replacement is pinned in
    // DiegeticAudio; here, pin the removal itself so it can't creep back half-wired.
    it('no slot state survives anywhere (engine, state flags, or sync payload)', () => {
        const game = makeGame({ ctx: true });
        expect(game.moduleSlotX).toBeUndefined();
        expect(game.state.unlocked.moduleSlot).toBeUndefined();
        game.draw();
        expect(game.state.carriedModule).toBeUndefined();
        expect(game.state.mapCell).toBeUndefined();
    });

    // Review-confirmed: install-on-pickup means the retire can fire while you STAND in
    // Denny's room — and leaving a room writes the live npcs back into the cache, which
    // resurrected the cache the retire had just deleted, Denny included, forever.
    it("retiring Denny while standing in {1,0} strips him from the LIVE room too", () => {
        const game = newGame();
        game.worldManager.currentRoomX = 1; game.worldManager.currentRoomY = 0;
        game.npcs = [new NPC(120, 100, 20, 'denny', [])];
        game.state.unlocked.mapModule = true;
        game.state.unlocked.biteDroppedOff = true;
        game._maybeRetireDenny();
        expect(game.npcs.some(n => n.id === 'denny')).toBe(false); // save-on-exit stays clean
        expect(game.worldManager.rooms['1,0']).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------------
// PLAYTEST ROUND 4 — the owner's feedback items, locked in.
describe('Playtest feedback (round 4)', () => {
    beforeEach(mountDom);

    it("Gate's first scene never replays: {3,0} spawns him only until the Pause Menu is granted", () => {
        // Death wipes the room cache, and his first-encounter memory lived on the cached
        // NPC (npc.met) — so dying after Localhost regenerated a fresh Gate who re-ran
        // the whole Thread Suspension. The pauseMenu grant is the scene's durable receipt.
        const before = newGame();
        before.worldManager.currentRoomX = 3; before.worldManager.currentRoomY = 0;
        expect(before.worldManager.getOrCreateRoom(before.state.unlocked)
            .npcs.some(n => n.id === 'gate')).toBe(true);

        const after = newGame();
        after.state.unlocked.pauseMenu = true;
        after.worldManager.currentRoomX = 3; after.worldManager.currentRoomY = 0;
        expect(after.worldManager.getOrCreateRoom(after.state.unlocked)
            .npcs.some(n => n.id === 'gate')).toBe(false);
    });

    it("2-Bit's stall survives death: a regenerated Localhost includes the shop once he's dropped off", () => {
        const game = newGame();
        game.state.unlocked.biteDroppedOff = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        expect(room.npcs.some(n => n.id === 'shop')).toBe(true);

        // ...and only once he HAS dropped off (before that he still rides your tail).
        const fresh = newGame();
        fresh.worldManager.currentRoomX = 5; fresh.worldManager.currentRoomY = 0;
        expect(fresh.worldManager.getOrCreateRoom(fresh.state.unlocked)
            .npcs.some(n => n.id === 'shop')).toBe(false);
    });

    it('an intake building is ONE object: one read per contact, re-armed by leaving', () => {
        const game = newGame();
        game.state.gameState = 'PLAYING';
        const cells = [new NPC(100, 100, 20, 'commons', ['THE COMMONS: benches.']),
                       new NPC(120, 100, 20, 'commons', ['THE COMMONS: benches.'])];
        game.npcs = cells; game.glitches = []; game.obstacles = []; game.apple = { x: 380, y: 380 };
        let opens = 0;
        game.dialogManager.start = (lines, cb) => { opens++; if (cb) cb(); };

        game.npcCommons(cells[0]);          // first contact: the read
        expect(opens).toBe(1);
        game.npcCommons(cells[1]);          // second cell of the same building: silent
        expect(opens).toBe(1);

        // The latched building also swallows the handshake chirp per extra cell.
        game.snake.body = [{ x: 120, y: 100 }];
        game.handleNpcCollisions();
        expect(game.audio.playBump).not.toHaveBeenCalled();
        expect(opens).toBe(1);

        // Walk away — the move-tick re-arms the latch once the head has left the
        // structure — and the next contact reads again.
        game.snake.body = [{ x: 300, y: 300 }];
        step(game, { x: 20, y: 0 });
        game.npcCommons(cells[0]);
        expect(opens).toBe(2);
    });

    it('the latch guards words, not verbs: a delivery goes through while latched', () => {
        const game = newGame();
        game.growSnake(3);
        game.npcs = []; game.obstacles = []; game.glitches = []; game.apple = { x: 380, y: 380 };
        game._intakeRead.add('commons');    // already read the flavor this contact
        game.carriedRefugee = '4,2';
        game.npcCommons(new NPC(100, 100, 20, 'commons', []));
        finishDialog(game);
        expect(game.state.unlocked.refugeesFreed).toBe(1);
        expect(game.carriedRefugee).toBeNull();
    });

    it("a bought Shadow Copy tier commits immediately — Cache's saveFunction not required", () => {
        // The reported loss: two tiers bought, page refreshed, everything gone. Two holes:
        // autoCommit() refused to write without Cache's saveFunction (her tiers sell fine
        // without it — a paid no-op), and every tier's trigger is an EVENT, so a buyer who
        // refreshed before the next trigger had a backup that never once ran.
        const game = newGame();
        game.saveManager.clearAll();
        expect(game.state.unlocked.saveFunction).toBeFalsy(); // never met Cache
        game.state.score = 60; game.growSnake(60);
        game.shopManager.activeVendor = 'hydratia';
        game.shopManager.purchase(game.shopManager.vendors.hydratia.items[0]);
        expect(game.state.unlocked.autosaveSafe).toBe(true);
        expect(game.saveManager.hasAuto(game.activeSlot)).toBe(true); // the first copy exists NOW
        game.saveManager.clearAll();
    });

    it('autoCommit writes the shadow buffer with no saveFunction at all', () => {
        const game = newGame();
        game.saveManager.clearAll();
        game.autoCommit();
        expect(game.saveManager.hasAuto(game.activeSlot)).toBe(true);
        game.saveManager.clearAll();
    });
});
