/**
 * @vitest-environment happy-dom
 */
// SPRINT 2 — the midpoint pass + the compounding economy + Hydratia:
// the terminal release latch, the canon retcon (tick cut / Glitch origin), the bounce
// ARG window, the scanner pockets + BEYOND read, the emptied Localhost + refugees +
// intake, the Data Mines, Quantcy's Trust, Hydratia (catch / autosave / warm restore),
// and the death receipt.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { NPC } from '../src/entities/NPC.js';
import { ARCHITECT, LORE_FRAGS, BOOTH_LORE, CACHE_CHECKPOINT, HYDRATIA_DEATH } from '../src/content/dialogue.js';
import { classifyRoomBeyond } from '../src/systems/RoomGenerator.js';

function mountDom() {
    document.body.innerHTML = `
        <div id="ui-layer" class="hidden">
            <div id="score-value">0</div>
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
        </div>
    `;
    window.localStorage.clear();
}

function newGame(width = 400, height = 400) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const game = new GameEngine(canvas);
    for (const fn of ['init', 'playWub', 'playGlide', 'playDenied', 'playCorruptHit', 'playCrack',
        'playCrash', 'playBeep', 'playDeath', 'playMaterialize', 'playDoot', 'playBump',
        'playScannerPing', 'setDuck', 'setMusicLayer', 'stopVoidAmbient', 'stopMusic']) {
        game.audio[fn] = vi.fn();
    }
    game.state.gameState = 'PLAYING';
    return game;
}

function step(game, dir) {
    game.input.nextDirection = { ...dir };
    game.update(1000);
}

function finishDialog(game) {
    let guard = 0;
    while (game.dialogManager.currentDialog && guard++ < 200) game.dialogManager.advance();
}

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

    it('quick reloads advance the approach; four in a row makes her catchable', () => {
        const game = newGame();
        game.saveManager.save(1, {}); // the chase needs an existing save (menu is up)
        for (let i = 0; i < 4; i++) game.maybeStartHydratiaCatch();
        // boot 1 seeded the timestamp (approach 0), boots 2-4 were quick: approach 3.
        expect(game.saveManager.hydratiaApproach()).toBe(3);
        game.maybeStartHydratiaCatch();
        expect(game.saveManager.hydratiaApproach()).toBe(4);
        expect(game._hydratia && game._hydratia.catchable).toBe(true);
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
