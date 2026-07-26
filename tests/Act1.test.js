/**
 * @vitest-environment happy-dom
 */
// Act I build-out: the finite Wilds (the Kernel's coil), Motion Carried, HUSH,
// Nibble's Glitch Shunt, Heur's Purge Cycle, and the Ascent to Cold Storage
// (Beat 7 trap, Denny's Fall-Through, Gate's Override, Cache's checkpoint,
// the Port 0 rigidity funnel + the 16-bit reboot).
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../src/engine/Game.js';
import { Glitch } from '../src/entities/Glitch.js';
import { NPC } from '../src/entities/NPC.js';
import { HEUR, NIBBLE } from '../src/content/dialogue.js';
import { mountDom, makeGame, step, finishDialog } from './helpers.js';

// Act1 stubs the standard audio set on a 400x400 canvas.
const newGame = (width = 400, height = 400) => makeGame({ width, height });

// ---------------------------------------------------------------------------------
describe('The wall ring actually blocks (playtest fix)', () => {
    beforeEach(mountDom);

    it('a solid wall stops the worm ONE CELL OUT — it never enters the wall ring', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        // find a solid (no-weak-point) stretch of the left wall
        const wp = game.worldManager.getWeakPoint(4, 2, 'left');
        const solidY = wp ? (wp.start === 20 ? wp.end + 40 : 20) : 100;
        game.snake.body = [{ x: 20, y: solidY }]; // col 1, against the left wall, off any door
        step(game, { x: -20, y: 0 }); // drive into the wall
        expect(game.state.gameState).toBe('DEAD'); // died at the wall, not inside it
        // the head never occupied the wall-ring cell (x=0)
        expect(game.snake.body.every(s => s.x >= 20)).toBe(true);
    });

    it('a doorway lets the worm step INTO the ring (then cross), not die', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        const wp = game.worldManager.getWeakPoint(4, 2, 'left');
        if (!wp) return; // (defensive: this room's left wall is solid — skip)
        game.snake.body = [{ x: 20, y: wp.start }]; // col 1, aligned with the door
        step(game, { x: -20, y: 0 }); // step toward the door
        expect(game.state.gameState).not.toBe('DEAD'); // stepped into the doorway, alive
    });

    it('spawns never land in the outer wall ring', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        const cols = rg.cols, rows = rg.rows, g = game.gridSize;
        for (let i = 0; i < 50; i++) {
            const p = rg.spawnValidApple([], [], []);
            const c = p.x / g, r = p.y / g;
            expect(c >= 1 && c <= cols - 2 && r >= 1 && r <= rows - 2).toBe(true);
        }
    });

    it('autonomous movers are blocked from the wall ring', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        expect(game._moverBlocked(0, 100)).toBe(true);              // left ring
        expect(game._moverBlocked(game.ringRight, 100)).toBe(true); // right ring
        expect(game._moverBlocked(100, 0)).toBe(true);              // top ring
        expect(game._moverBlocked(40, 100)).toBe(false);            // interior (nothing there)
    });

    it('ramming a solid wall while ferrying 2-Bit TUGS BACK (non-lethal) — the ring guard delegates', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.tailRider = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.obstacles = [];
        game.npcs = [new NPC(300, 300, 20, 'bite', [])]; // 2-Bit still aboard (on the grid)
        const wp = game.worldManager.getWeakPoint(4, 2, 'left');
        const solidY = wp ? (wp.start === 20 ? wp.end + 40 : 20) : 100; // off any door
        game.snake.body = [{ x: 20, y: solidY }, { x: 40, y: solidY }];
        game.state.score = 12;
        game.input.direction = { x: -20, y: 0 };
        step(game, { x: -20, y: 0 }); // drive into the solid wall
        expect(game.state.gameState).toBe('PLAYING'); // NOT dead — 2-Bit tugged you back
        expect(game.state.score).toBe(12);            // no reset
        expect(game.input.direction.x).toBe(20);      // reversed
    });

    it('driving into Port 0\'s aperture is a BONK, not a death, via the ring guard', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -5;
        game.apple = { x: 40, y: 340 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        const g = game.gridSize;
        const mid = Math.floor(game.canvas.width / 2 / g) * g; // aperture centre column
        game.snake.body = [{ x: mid, y: 20 }]; // row 1, aligned with the aperture, facing north
        game.input.direction = { x: 0, y: -20 };
        step(game, { x: 0, y: -20 }); // drive up into the sealed port
        expect(game.state.gameState).toBe('PLAYING'); // a bonk, never a death
        expect(game.audio.playDenied).toHaveBeenCalled();
        expect(game.snake.head.y).toBe(20); // didn't move into the ring
    });

    it('crossing a broken door still transitions to the next room (2-step doorway walk)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 2;
        game.apple = { x: 200, y: 200 }; game.glitches = []; game.npcs = []; game.obstacles = [];
        // guarantee a broken left door and align the head with it
        const wp = game.worldManager.getWeakPoint(4, 2, 'left') || { start: 100 };
        game.worldManager.breakWall(4, 2, 'left');
        game.snake.body = [{ x: 20, y: wp.start }]; // col 1, at the door
        step(game, { x: -20, y: 0 }); // step into the doorway (col 0)
        expect(game.worldManager.currentRoomX).toBe(4); // not crossed yet — in the doorway
        step(game, { x: -20, y: 0 }); // off-canvas -> transition to {3,2}
        expect(game.worldManager.currentRoomX).toBe(3);
        expect(game.worldManager.currentRoomY).toBe(2);
        expect(game.state.gameState).not.toBe('DEAD');
    });
});

// ---------------------------------------------------------------------------------
describe('The finite Wilds — the Kernel\'s coil', () => {
    beforeEach(mountDom);

    it('walls facing outside the interior are coil: solid, no weak point ever', () => {
        const wm = newGame().worldManager;
        expect(wm.isCoilWall(11, 0, 'right')).toBe(true);
        expect(wm.isCoilWall(5, -5, 'up')).toBe(true);
        expect(wm.isCoilWall(5, 0, 'right')).toBe(false);
        expect(wm.getWeakPoint(11, 0, 'right')).toBeNull();
        expect(wm.getWeakPoint(3, 5, 'down')).toBeNull();
    });

    it('driving into the coil is lethal (no crumple: a real death)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 11;
        game.worldManager.currentRoomY = 0;
        game.apple = { x: 100, y: 100 };
        game.glitches = []; game.npcs = []; game.obstacles = [];
        const g = game.gridSize;
        const rightmost = Math.floor((game.canvas.width - 1) / g) * g;
        game.snake.body = [{ x: rightmost, y: 200 }];
        step(game, { x: g, y: 0 });
        expect(game.state.gameState).toBe('DEAD');
        expect(game.audio.playDeath).toHaveBeenCalled();
    });

    it('nearing the coil ducks the whole soundscape and raises the deaf-legible twin', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 11;
        game.worldManager.currentRoomY = 0;
        game.apple = { x: 100, y: 100 };
        game.glitches = []; game.npcs = []; game.obstacles = [];
        const g = game.gridSize;
        game.snake.body = [{ x: 360, y: 200 }]; // 1 cell from the east coil
        step(game, { x: 0, y: g });
        expect(game._coilNear).toBeTruthy();
        expect(game._coilNear.dirs).toContain('right');
        expect(game._coilNear.proximity).toBeGreaterThan(0.5);
        const duck = game.audio.setDuck.mock.calls.at(-1)[0];
        expect(duck).toBeLessThan(0.5);
    });

    it('the Hub is exempt from the coil presentation', () => {
        const game = newGame();
        game.state.unlocked.borders = true; // hub, borders on
        game.apple = { x: 300, y: 300 };
        game.glitches = []; game.npcs = []; game.obstacles = [];
        game.snake.body = [{ x: 20, y: 200 }]; // hugging the west wall
        step(game, { x: 0, y: 20 });
        expect(game._coilNear).toBeNull();
    });

    it('the Deep-Sleep pocket only opens through HUSH\'s post', () => {
        const wm = newGame().worldManager;
        expect(wm.getWeakPoint(10, 5, 'left')).toBeNull();   // forced solid
        expect(wm.getWeakPoint(10, 5, 'right')).toBeNull();  // forced solid
        expect(wm.getWeakPoint(10, 4, 'up')).toBeNull();     // forced solid
        expect(wm.getWeakPoint(9, 4, 'right')).toBeTruthy(); // the corridor door
        expect(wm.getWeakPoint(10, 4, 'down')).toBeTruthy(); // the Booth door
    });

    it('ordinary doors are always visible; only the registered Scanner doors hide', () => {
        const wm = newGame().worldManager;
        // ordinary doors — spine and landmark corridors alike — draw without any tool
        expect(wm.isWeakPointRevealed(1, 0, 'right')).toBe(true);
        expect(wm.getWeakPoint(6, 0, 'right')).toBeTruthy();
        expect(wm.isWeakPointRevealed(6, 0, 'right')).toBe(true);
        expect(wm.isWeakPointRevealed(5, 0, 'up')).toBe(true);
        // the Scanner doors: the finale door, the Booth pocket, the Vault
        expect(wm.isWeakPointRevealed(5, -4, 'up')).toBe(false);
        expect(wm.isWeakPointRevealed(9, 4, 'right')).toBe(false);
        expect(wm.isWeakPointRevealed(10, 4, 'down')).toBe(false);
        expect(wm.isWeakPointRevealed(1, -5, 'down')).toBe(false);
        // a sweep lights one up
        wm.revealWeakPoint(9, 4, 'right', 1000);
        expect(wm.isWeakPointRevealed(9, 4, 'right')).toBe(true);
    });

    it('Cache has a guaranteed fight-free bypass (x=4 dogleg) AND the climbable x=5 gauntlet', () => {
        const wm = newGame().worldManager;
        // (a) the x=4 bypass: Localhost -> {4,0} -> up the x=4 column -> east into {5,-4},
        //     touching no rematch room — the "just let me save" route.
        expect(wm.mainPath.has(wm.boundaryKey(5, 0, 'left'))).toBe(true);
        for (let y = 0; y > -4; y--) {
            expect(wm.getWeakPoint(4, y, 'up')).toBeTruthy();
        }
        expect(wm.getWeakPoint(4, -4, 'right')).toBeTruthy();
        // and its rooms are NOT the fight posts (x=4, not x=5)
        expect(wm.mainPath.has(wm.boundaryKey(4, -2, 'up'))).toBe(true);

        // (b) the fight gauntlet straight up x=5 is fully climbable (every rung guaranteed),
        //     so the intended Denny/Gate rematches always happen on the direct line.
        for (let y = 0; y > -4; y--) {
            expect(wm.getWeakPoint(5, y, 'up')).toBeTruthy();
            expect(wm.isWeakPointRevealed(5, y, 'up')).toBe(true); // visible ordinary doors
        }
        // but the finale seam past Cache is NOT auto-guaranteed-visible (a Scanner door)
        expect(wm.isWeakPointRevealed(5, -4, 'up')).toBe(false);
    });

    it('the checkpoint seam stays CENTRED and present across unseal (no teleport/vanish)', () => {
        for (const [w, h] of [[400, 400], [420, 380], [640, 480], [300, 300]]) {
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const wm = new GameEngine(canvas).worldManager;
            const g = wm.gridSize;
            const mid = Math.floor(w / 2 / g) * g;
            const sealed = wm.getWeakPoint(5, -4, 'up');
            expect(sealed).toEqual({ start: mid - 2 * g, end: mid + 2 * g }); // centred
            wm.unsealRomDoor(5, -4, 'up');
            const unsealed = wm.getWeakPoint(5, -4, 'up');
            expect(unsealed).toEqual(sealed); // unchanged — the seam is where the player saw it
        }
    });

    it('the ROM Vault opens only through its hidden south door', () => {
        const wm = newGame().worldManager;
        expect(wm.getWeakPoint(1, -5, 'left')).toBeNull();
        expect(wm.getWeakPoint(1, -5, 'right')).toBeNull();
        expect(wm.getWeakPoint(1, -5, 'down')).toBeTruthy();  // exists...
        expect(wm.isWeakPointRevealed(1, -5, 'down')).toBe(false); // ...but hidden
    });

    it('Cache\'s ROM door refuses ramming — a bonk, never a crack, never a death', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.gear = 3;
        const wp = game.worldManager.getWeakPoint(5, -4, 'up');
        const r = game.crossBorder(wp.start, -20);
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING');
        expect(game.audio.playDenied).toHaveBeenCalled();
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(false);
        expect(game.worldManager.getWallDamage(5, -4, 'up')).toBe(0);
    });
});

// ---------------------------------------------------------------------------------
describe('Motion Carried — the world moves on ITS OWN clock', () => {
    beforeEach(mountDom);

    function motionGame() {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 4;
        game.worldManager.currentRoomY = 2;
        game.apple = { x: 300, y: 300 };
        game.npcs = []; game.obstacles = [];
        return game;
    }

    it('Glitches hold still before the flip and drift after it', () => {
        const game = motionGame();
        game.glitches = [new Glitch(200, 100, 20)];
        game.snake.body = [{ x: 40, y: 300 }];
        step(game, { x: 20, y: 0 });
        expect(game.glitches[0].x).toBe(200);
        expect(game.glitches[0].y).toBe(100);

        game.state.unlocked.motionCarried = true;
        const before = { x: game.glitches[0].x, y: game.glitches[0].y };
        step(game, { x: 20, y: 0 });
        const moved = Math.abs(game.glitches[0].x - before.x) + Math.abs(game.glitches[0].y - before.y);
        expect(moved).toBe(20); // exactly one cell per WORLD step
        expect(game.glitches[0]._m).toBeTruthy(); // and it wears its drift pattern (the notch)
    });

    // THE POINT OF THE WORLD CLOCK: shifting up must not make the world faster. Ambient
    // drift used to ride the move-tick, so at gear 3 (30ms/cell) a Glitch stepped every
    // 60ms — under human reaction time, which is why nothing that moved could fairly
    // touch you. Now speed is EVASION: cruise and you outpace the world.
    it('drift is wall-clock, so going faster does NOT speed the world up', () => {
        const slow = motionGame();
        const fast = motionGame();
        for (const game of [slow, fast]) {
            game.state.unlocked.motionCarried = true;
            game.glitches = [new Glitch(200, 100, 20)];
            game.snake.body = [{ x: 40, y: 300 }];
        }
        // Same wall-clock elapsed, wildly different player speeds.
        slow.speed = 200;   // braked
        fast.speed = 30;    // gear 3
        const ELAPSED = 900;
        for (let i = 0; i < ELAPSED / 30; i++) { slow.update(30); fast.update(30); }

        expect(slow._worldStep).toBe(fast._worldStep);
        expect(slow._worldStep).toBe(Math.floor(ELAPSED / slow.WORLD_STEP));
        // ...and the gear-3 worm took far more move-ticks over the same wall time.
        expect(fast._tick).toBeGreaterThan(slow._tick * 3);
    });

    it('the world does not move at all while text has the game stopped', () => {
        const game = motionGame();
        game.state.unlocked.motionCarried = true;
        game.glitches = [new Glitch(200, 100, 20)];
        game.snake.body = [{ x: 40, y: 300 }];
        const before = { x: game.glitches[0].x, y: game.glitches[0].y };
        game.state.gameState = 'DIALOG';
        for (let i = 0; i < 20; i++) game.update(100);
        expect(game.glitches[0]).toMatchObject(before);
        expect(game._worldStep).toBe(0);
    });

    it('drift patterns are deterministic per room and index', () => {
        const g1 = motionGame();
        const g2 = motionGame();
        expect(g1._glitchMotionFor(0, 4, 2)).toEqual(g2._glitchMotionFor(0, 4, 2));
        expect(g1._glitchMotionFor(1, 4, 2)).not.toEqual(g1._glitchMotionFor(0, 4, 2));
    });

    it('a mover never steps ONTO the worm — it bites and recoils', () => {
        const game = motionGame();
        game.state.unlocked.motionCarried = true;
        game.glitches = [new Glitch(200, 100, 20)];
        // box the glitch in with worm so every step runs into you
        game.snake.body = [
            { x: 180, y: 100 }, { x: 220, y: 100 }, { x: 200, y: 80 }, { x: 200, y: 120 },
        ];
        const before = { x: game.glitches[0].x, y: game.glitches[0].y };
        game.update(1000);
        game.update(1000);
        expect(game.glitches[0]).toMatchObject(before); // never enters your cell
    });

    // ENCROACHMENT — the owner's rule: "if things running into you don't affect you, then
    // the world moving is just cosmetic."
    describe('encroachment (the world runs into YOU)', () => {
        const boxedIn = () => {
            const game = motionGame();
            game.state.unlocked.motionCarried = true;
            game.state.score = 20;
            game.growSnake(20);
            game.glitches = [new Glitch(200, 100, 20)];
            // a wall of worm all round it, so whichever way it drifts it finds you
            game.snake.body = [
                { x: 180, y: 100 }, { x: 220, y: 100 }, { x: 200, y: 80 }, { x: 200, y: 120 },
            ];
            for (let i = 0; i < 18; i++) game.snake.body.push({ x: 20, y: 20 + i * 20 });
            return game;
        };

        it('corruption that runs into you sheds a segment AND the matching Data', () => {
            const game = boxedIn();
            const len = game.snake.body.length, score = game.state.score;
            game.update(1000);
            expect(game.snake.body.length).toBe(len - game.ENCROACH_COST);
            expect(game.state.score).toBe(score - game.ENCROACH_COST); // Data = segments holds
        });

        it('never costs MORE than driving your own head into it (the asymmetry law)', () => {
            const shoved = boxedIn();
            shoved.update(1000);
            const shoveCost = 20 - shoved.state.score;

            const bitten = motionGame();
            bitten.state.score = 20; bitten.growSnake(20);
            bitten.glitches = [new Glitch(bitten.snake.head.x, bitten.snake.head.y, 20)];
            bitten.hitGlitch();
            const biteCost = 20 - bitten.state.score;

            expect(shoveCost).toBeLessThanOrEqual(biteCost);
        });

        it('a shove leaves the drifter alive; a head bite clears it for good', () => {
            // This is the real asymmetry once you own Reinforced Segments, where both
            // cost exactly 1 segment: charging corruption deliberately is what makes it
            // STAY dead. Being shoved just resets a cooldown.
            const shoved = boxedIn();
            shoved.update(1000);
            expect(shoved.glitches).toHaveLength(1);

            const bitten = motionGame();
            bitten.state.score = 20; bitten.growSnake(20);
            bitten.glitches = [new Glitch(bitten.snake.head.x, bitten.snake.head.y, 20)];
            bitten.hitGlitch();
            expect(bitten.glitches).toHaveLength(0);
        });

        // LAW VIOLATION, found by adversarial review and proven by probe: _encroach never
        // called die(), but its changeGear(0) re-clamp dropped you out of gear 3 when a
        // shove crossed a 10-Data boundary — and gear 3 is the only clean wall breach, so
        // crossBorder read an already-committed ram as a sub-max smash, which IS a death.
        // "Never kills" held only in the letter.
        it('a shove may never revoke the gear you are holding', () => {
            const game = boxedIn();
            game.state.score = 30;
            game.changeGear(3);
            expect(game.gear).toBe(3);

            for (let i = 0; i < 20; i++) game.update(1000);

            expect(game.gear).toBe(3);                       // gearbox intact
            expect(game.state.score).toBeGreaterThanOrEqual(30); // and the Data licensing it
        });

        it('...but a shove that costs no gear still lands', () => {
            const game = boxedIn();
            game.state.score = 35;
            game.changeGear(3);
            game.update(1000);
            expect(game.state.score).toBe(34); // shaved, still licensed
            expect(game.gear).toBe(3);
        });

        it('Salvage Claws never refund a shove one-for-one', () => {
            const game = boxedIn();
            game.state.upgrades.salvage = true;
            const score = game.state.score;
            game.update(1000);
            const motes = (game.dataMotes || []).length;
            expect(score - game.state.score).toBe(game.ENCROACH_COST);
            expect(motes).toBeLessThan(game.ENCROACH_COST + 1); // not a full refund
        });
        it('NEVER kills — a floored worm just absorbs the shove', () => {
            const game = motionGame();
            game.state.unlocked.motionCarried = true;
            game.state.score = 0;
            game.snake.body = [
                { x: 180, y: 100 }, { x: 220, y: 100 }, { x: 200, y: 80 }, { x: 200, y: 120 },
            ];
            game.glitches = [new Glitch(200, 100, 20)];
            let died = false;
            game.die = () => { died = true; };
            for (let i = 0; i < 40; i++) game.update(1000);
            expect(died).toBe(false);
            expect(game.snake.body.length).toBeGreaterThanOrEqual(1);
        });

        it('a single mover cannot machine-gun you — the cooldown holds', () => {
            const game = boxedIn();
            const len = game.snake.body.length;
            // Fewer world steps than the cooldown allows hits.
            for (let i = 0; i < game.ENCROACH_COOLDOWN; i++) game.update(game.WORLD_STEP);
            expect(len - game.snake.body.length).toBe(game.ENCROACH_COST); // exactly one hit
        });

        it('villagers do NOT shove you — they are people, not hazards', () => {
            const game = motionGame();
            game.state.unlocked.motionCarried = true;
            game.state.score = 20; game.growSnake(20);
            game.npcs = [new NPC(200, 200, 20, 'citizen', ['hi'])];
            game.snake.body = [
                { x: 180, y: 200 }, { x: 220, y: 200 }, { x: 200, y: 180 }, { x: 200, y: 220 },
            ];
            const len = game.snake.body.length;
            for (let i = 0; i < 40; i++) game.update(1000);
            expect(game.snake.body.length).toBe(len);
        });

        it('the Glitch Shunt is a MOUTH, not armour — being run into still bites', () => {
            const game = boxedIn();
            game.state.upgrades.corruptHandler = true;
            const len = game.snake.body.length;
            game.update(1000);
            expect(game.snake.body.length).toBe(len - game.ENCROACH_COST);
        });

        it('nothing shoves you before the world starts moving', () => {
            const game = boxedIn();
            game.state.unlocked.motionCarried = false;
            const len = game.snake.body.length;
            for (let i = 0; i < 40; i++) game.update(1000);
            expect(game.snake.body.length).toBe(len);
        });
    });

    // Furniture carries no directional notch and kills on contact, so it may never step
    // into the lane the head is already committed to. The old Manhattan<=1 keep-out left
    // head+2 open — 60ms of warning at gear 3, for something drawn identically whether or
    // not it is about to move.
    it('listing furniture never steps into the head\'s travel lane, at any distance', () => {
        const game = motionGame();
        game.state.unlocked.motionCarried = true;
        game.snake.body = [{ x: 200, y: 200 }];
        game.input.direction = { x: 20, y: 0 }; // driving east
        game.obstacles = [];
        for (let c = 3; c < 12; c++) game.obstacles.push({ x: c * 20, y: 180 });

        for (let i = 0; i < 200; i++) game.update(100);

        expect(game.obstacles.filter(o => o.y === 200 && o.x > 200)).toEqual([]);
    });

    it('villagers wiggle in place — never more than one cell from home', () => {
        const game = motionGame();
        game.state.unlocked.motionCarried = true;
        const home = { x: 200, y: 200 };
        game.npcs = [new NPC(home.x, home.y, 20, 'citizen', ['hi'])];
        game.snake.body = [{ x: 40, y: 300 }];
        for (let i = 0; i < 80; i++) game.update(1000);
        const npc = game.npcs[0];
        expect(Math.abs(npc.x - home.x)).toBeLessThanOrEqual(20);
        expect(Math.abs(npc.y - home.y)).toBeLessThanOrEqual(20);
    });

    it('the flip fires on the SECOND Gate run-in (clearing the Override)', () => {
        const game = motionGame();
        game.state.unlocked.ascentArmed = true; // the EARLY climb, armed at Localhost
        expect(game.state.unlocked.motionCarried).toBe(false);
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.shiftScreen(0, -1); // breach north out of the Override
        expect(game.state.unlocked.gateRematchDone).toBe(true);
        expect(game.state.unlocked.motionCarried).toBe(true);
    });

    // The midpoint retiming: the rematches must NOT be chained behind the
    // decontamination any more, or Motion Carried lands two rooms before the act ends.
    it('the Override is climbable WITHOUT the purge (the early climb)', () => {
        const game = motionGame();
        game.state.unlocked.ascentArmed = true;
        game.state.unlocked.purgeComplete = false; // never went to Nibble/Heur
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.shiftScreen(0, -1);
        expect(game.state.unlocked.gateRematchDone).toBe(true);
        expect(game.state.unlocked.motionCarried).toBe(true);
    });

    // REGRESSION: walking into the Override used to be an unavoidable death.
    //
    // The ring is built on the first move-tick IN the room, which is after the entry
    // transition and after Gate's enter dialog — so while you were arriving it did not
    // exist and the Renderer drew nothing. It then seeded at index 0, putting the
    // aperture on the TOP edge while you entered from the bottom, and the bottom lane is
    // solid corner to corner. Your first step north walked into a block that had never
    // been on screen, at a column that could not have saved you, having been unable to
    // pre-steer (canSteer is PLAYING-only, so a turn during the dialog is dropped).
    it('entering the Override from the south is survivable — the aperture starts on YOUR door', () => {
        const game = motionGame();
        const g = game.gridSize;
        game.state.unlocked.ascentArmed = true;
        game.state.unlocked.dennyRematchDone = true;
        game.state.score = 40;
        game.growSnake(40);
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        const room = game.worldManager.getOrCreateRoom(game.state.unlocked);
        game.apple = room.apple; game.glitches = []; game.npcs = room.npcs; game.obstacles = [];

        // Stand in the doorway of his south wall, at the gear the breach requires.
        const wp = game.worldManager.getWeakPoint(5, -2, 'up');
        const col = wp ? Math.floor(((wp.start + wp.end) / 2) / g) : 10;
        game.snake.body = [{ x: col * g, y: 1 * g }];
        for (let i = 1; i < 6; i++) game.snake.body.push({ x: col * g, y: (1 + i) * g });
        game.gear = 3; game.speed = 30;
        game.input.direction = { x: 0, y: -g };

        let died = false;
        const realDie = game.die.bind(game);
        game.die = (cause) => { died = true; return realDie(cause); };

        // Drive straight on, the way you were already heading, for longer than the ring
        // takes to form. A player who does nothing wrong must not be killed by arriving.
        for (let i = 0; i < 8; i++) {
            finishDialog(game);
            if (game.state.gameState !== 'DEAD') game.state.gameState = 'PLAYING';
            game.input.nextDirection = { x: 0, y: -g };
            game.update(1000);
        }

        expect(died).toBe(false);
        expect(game.worldManager.currentRoomY).toBe(-3); // still in his room, alive
    });

    it('the ring holds still for its first few ticks, so no rotation is unseen', () => {
        const game = motionGame();
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
        game._ovr = null;

        game.updateGate3();
        const seeded = game._ovr.gap;
        for (let i = 0; i < game.GATE3_ENTRY_HOLD; i++) game.updateGate3();
        expect(game._ovr.gap).toBe(seeded); // still parked on your door

        for (let i = 0; i < game.GATE3_TURN_TICKS + 1; i++) game.updateGate3();
        expect(game._ovr.gap).not.toBe(seeded); // and then it turns
    });

    it('reaching Localhost after Gate arrests you arms the early climb', () => {
        const game = motionGame();
        game.state.unlocked.ascentArmed = false;
        game.state.unlocked.pauseMenu = true; // Gate's Thread Suspension rescue happened
        game.worldManager.currentRoomX = 4;
        game.worldManager.currentRoomY = 0;
        game.shiftScreen(1, 0); // step east into Localhost {5,0}
        expect(game.state.unlocked.ascentArmed).toBe(true);
    });

    it('does NOT arm before Gate has been met (no Pause Menu yet)', () => {
        const game = motionGame();
        game.state.unlocked.ascentArmed = false;
        game.state.unlocked.pauseMenu = false; // slipped past Gate somehow
        game.worldManager.currentRoomX = 4;
        game.worldManager.currentRoomY = 0;
        game.shiftScreen(1, 0);
        expect(game.state.unlocked.ascentArmed).toBe(false);
    });

    it('bumping a talkative NPC chirps; combat contacts keep their own sounds', () => {
        const game = motionGame();
        game.glitches = [];
        game.npcs = [new NPC(120, 100, 20, 'citizen', ['hi'])];
        game.snake.body = [{ x: 100, y: 100 }];
        step(game, { x: 20, y: 0 }); // head onto the citizen
        expect(game.audio.playBump).toHaveBeenCalledTimes(1);
        // HUSH's clamp is not a handshake
        game.dialogManager.end();
        game.state.gameState = 'PLAYING';
        game.npcs = [new NPC(160, 100, 20, 'hush', [])];
        game.snake.body = [{ x: 140, y: 100 }];
        step(game, { x: 20, y: 0 });
        expect(game.audio.playBump).toHaveBeenCalledTimes(1); // unchanged
    });
});

// ---------------------------------------------------------------------------------
describe('HUSH — the House Silence', () => {
    beforeEach(mountDom);

    function hushGame(layer = 0) {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.musicLayer = layer;
        game.worldManager.currentRoomX = 9;
        game.worldManager.currentRoomY = 4;
        game.apple = { x: 40, y: 40 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 200, 20, 'hush', [])];
        return game;
    }

    it('awake, it homes one cell per move-tick toward your head', () => {
        const game = hushGame(0);
        game.snake.body = [{ x: 300, y: 200 }];
        game.update(1000);
        expect(game.npcs[0].x).toBe(220); // one step toward the head
        expect(game.npcs[0].dormant).toBe(false);
    });

    it('the clamp bites two segments and two Data, then stalls — never a kill', () => {
        const game = hushGame(0);
        game.state.score = 5;
        game.snake.body = [{ x: 300, y: 200 }, { x: 280, y: 200 }, { x: 260, y: 200 }, { x: 240, y: 200 }];
        const hush = game.npcs[0];
        hush.x = 280; hush.y = 200; // on a body segment
        game._hushClamp(hush);
        expect(game.snake.body.length).toBe(2);
        expect(game.state.score).toBe(3);
        expect(game.audio.playCorruptHit).toHaveBeenCalledTimes(1);
        game._hushClamp(hush); // stunned: no chain-clamp
        expect(game.audio.playCorruptHit).toHaveBeenCalledTimes(1);
    });

    it('a length-1 worm cannot be clamped below existence', () => {
        const game = hushGame(0);
        game.state.score = 5;
        game.snake.body = [{ x: 280, y: 200 }];
        const hush = game.npcs[0];
        hush.x = 280; hush.y = 200;
        game._hushClamp(hush);
        expect(game.snake.body.length).toBe(1);
        expect(game.state.score).toBe(5); // nothing clamped, nothing drained
        expect(game.audio.playCorruptHit).not.toHaveBeenCalled();
    });

    it('Music Layer 1 puts it on STANDING BY — a state flag, not audible output', () => {
        const game = hushGame(1);
        game.snake.body = [{ x: 300, y: 200 }];
        game.update(1000);
        expect(game.npcs[0].dormant).toBe(true);
        expect(game.npcs[0].x).toBe(200); // perfectly still
    });
});

// ---------------------------------------------------------------------------------
describe('Nibble\'s black market & the Glitch Shunt', () => {
    beforeEach(mountDom);

    it('first bump plays her intro, then opens her REAL shop (like 2-Bit)', () => {
        const game = newGame();
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcs = [nib];
        game.npcNibble(nib);
        expect(game.state.unlocked.nibbleMet).toBe(true);
        expect(game.state.gameState).toBe('DIALOG'); // intro first
        finishDialog(game); // intro's onComplete opens the shop
        expect(game.state.gameState).toBe('SHOP');
        expect(game.shopManager.activeVendor).toBe('nibble');
        expect(game.shopManager.items.some(i => i.name === 'Glitch Shunt')).toBe(true);
    });

    it('buying the Glitch Shunt spends Data off the body; price = 20', () => {
        const game = newGame();
        game.state.unlocked.nibbleMet = true;
        game.state.unlocked.nibbleIdle = NIBBLE.idle.length; // past her patter
        game.state.score = 25;
        game.growSnake(25); // Data = segments: 26 cells incl. head
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcs = [nib];
        game.npcNibble(nib); // straight to shop (met, and she's out of small talk)
        expect(game.state.gameState).toBe('SHOP');
        const shunt = game.shopManager.items.find(i => i.name === 'Glitch Shunt');
        game.shopManager.purchase(shunt);
        expect(game.state.upgrades.corruptHandler).toBe(true);
        expect(game.state.score).toBe(5);
        expect(game.snake.body.length).toBe(6); // 26 - 20 spent (Data = segments)
    });

    it('under 20 Data the Shunt button is disabled, and nothing is spent', () => {
        const game = newGame();
        game.state.unlocked.nibbleMet = true;
        game.state.score = 10;
        const nib = new NPC(200, 200, 20, 'nibble', []);
        game.npcNibble(nib);
        finishDialog(game); // she prices you out loud first (tooPoor), then opens the shelf
        expect(game.state.gameState).toBe('SHOP');
        const shunt = game.shopManager.items.find(i => i.name === 'Glitch Shunt');
        game.shopManager.purchase(shunt); // refused: can't afford
        expect(game.state.upgrades.corruptHandler).toBe(false);
        expect(game.state.score).toBe(10);
    });

    // Three of her five dialogue blocks used to be unreachable — `pitch` was written for a
    // one-item shelf and had rotted, `tooPoor` and `idle` were never wired. These pin all
    // three so a future shop change can't quietly orphan her writing again.
    describe('her script actually plays', () => {
        it('the first bump runs intro AND pitch before the shelf', () => {
            const game = newGame();
            const nib = new NPC(200, 200, 20, 'nibble', []);
            game.npcNibble(nib);
            const said = [];
            while (game.dialogManager.currentDialog) {
                said.push(...game.dialogManager.currentDialog);
                game.dialogManager.currentDialog = null;
                game.dialogManager.end();
            }
            expect(said).toEqual([...NIBBLE.intro, ...NIBBLE.pitch]);
        });

        it('priced out of the WHOLE shelf, she says so — then lets you look anyway', () => {
            const game = newGame();
            game.state.unlocked.nibbleMet = true;
            game.state.score = 0;
            game.npcNibble(new NPC(200, 200, 20, 'nibble', []));
            expect(game.dialogManager.currentDialog).toEqual(NIBBLE.tooPoor);
            finishDialog(game);
            expect(game.state.gameState).toBe('SHOP'); // a merchant, not a bouncer
        });

        it('affording ANY row skips tooPoor, even if the good one is out of reach', () => {
            const game = newGame();
            game.state.unlocked.nibbleMet = true;
            game.state.unlocked.nibbleIdle = NIBBLE.idle.length;
            game.state.score = 20; // the Shunt exactly; the 25 and 30 rows are not
            game.npcNibble(new NPC(200, 200, 20, 'nibble', []));
            expect(game.state.gameState).toBe('SHOP');
        });

        it('owning everything affordable does not re-trigger tooPoor', () => {
            // Every row owned => nothing left to be priced out OF. Without the
            // already-owned filter a broke completionist gets scolded forever.
            const game = newGame();
            game.state.unlocked.nibbleMet = true;
            game.state.unlocked.nibbleIdle = NIBBLE.idle.length;
            game.state.score = 0;
            game.state.upgrades.corruptHandler = true;
            game.state.upgrades.salvage = true;
            game.state.upgrades.glitchWard = true;
            game.npcNibble(new NPC(200, 200, 20, 'nibble', []));
            expect(game.state.gameState).toBe('SHOP');
        });

        it('return visits deal ONE idle entry each, in order, then she goes quiet', () => {
            const game = newGame();
            game.state.unlocked.nibbleMet = true;
            game.state.score = 100; // affords everything, so tooPoor never fires
            const nib = new NPC(200, 200, 20, 'nibble', []);

            for (let i = 0; i < NIBBLE.idle.length; i++) {
                game.npcNibble(nib);
                expect(game.dialogManager.currentDialog, `visit ${i + 1}`).toEqual(NIBBLE.idle[i]);
                finishDialog(game);
                expect(game.state.gameState).toBe('SHOP');
                game.shopManager.close();
            }
            // Pool dry: she stops talking and just opens the shelf.
            game.npcNibble(nib);
            expect(game.dialogManager.currentDialog).toBeNull();
            expect(game.state.gameState).toBe('SHOP');
        });

        it('no line of hers quotes a price or a stock count (the copy-rot trap)', () => {
            // The old `pitch` said "One item today" long after she stocked three, and
            // `tooPoor` hardcoded "Twenty". The shelf is the only place numbers live.
            const all = [NIBBLE.intro, NIBBLE.pitch, NIBBLE.tooPoor, NIBBLE.buy, ...NIBBLE.idle].flat();
            for (const line of all) {
                expect(line, line).not.toMatch(/\b\d+\s*Data\b|\bTwenty\b|\bOne item\b|\bThree in stock\b/i);
            }
        });
    });

    it('Scale Mods absorb the first Glitch bite per room, then it bites again', () => {
        const game = newGame();
        game.state.upgrades.glitchWard = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 }; game.npcs = []; game.obstacles = [];
        game.state.score = 10; game.growSnake(10); // 11 cells
        game._wardUsedThisRoom = false;
        game.glitches = [new Glitch(120, 100, 20)];
        game.snake.body = [{ x: 100, y: 100 }, ...Array.from({ length: 10 }, (_, i) => ({ x: 80 - i * 20, y: 100 }))];
        step(game, { x: 20, y: 0 }); // first bite: absorbed
        expect(game.state.score).toBe(10); // no drain
        expect(game._wardUsedThisRoom).toBe(true);
        game.glitches = [new Glitch(140, 100, 20)];
        step(game, { x: 20, y: 0 }); // second bite: real
        expect(game.state.score).toBeLessThan(10);
    });

    it('Salvage Claws drop re-collectible Data when corruption sheds you', () => {
        const game = newGame();
        game.state.upgrades.salvage = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 }; game.npcs = []; game.obstacles = [];
        game.state.score = 10; game.growSnake(10);
        // tail trails DOWN the screen (on-canvas) so shed cells are valid drop sites
        game.snake.body = [{ x: 100, y: 100 }, ...Array.from({ length: 10 }, (_, i) => ({ x: 100, y: 120 + i * 20 }))];
        game.glitches = [new Glitch(120, 100, 20)];
        step(game, { x: 20, y: 0 }); // 3-segment bite -> salvage drops ~2 motes
        expect(game.dataMotes.some(m => m.salvage)).toBe(true);
    });

    it('Salvage Claws also drop on a Crumple bounce (post-fold, so the shed cells are free)', () => {
        const game = newGame();
        game.state.upgrades.salvage = true;
        game.state.upgrades.crumpleLevel = 1;
        game.state.unlocked.borders = false;
        game.apple = { x: 340, y: 20 }; game.npcs = []; game.obstacles = [];
        game.state.score = 20; game.growSnake(20);
        // a long on-canvas body so shedAmount(10) has room and the shed cells are valid
        game.snake.body = [{ x: 200, y: 20 }, ...Array.from({ length: 18 }, (_, i) => ({ x: 200, y: 40 + i * 20 }))];
        game.input.direction = { x: 20, y: 0 };
        game.bounce();
        expect(game.dataMotes.some(m => m.salvage)).toBe(true); // motes dropped at vacated cells
    });

    it('the Shunt pushes a Glitch along your heading instead of biting', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.npcs = []; game.obstacles = [];
        game.glitches = [new Glitch(120, 100, 20)];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }];
        game.state.score = 1;
        step(game, { x: 20, y: 0 }); // head onto the glitch cell
        expect(game.glitches[0].x).toBe(140); // shoved one cell on
        expect(game.snake.body.length).toBe(2); // no bite
        expect(game.state.score).toBe(1);
        expect(game.audio.playDenied).toHaveBeenCalled();
    });

    it('a blocked push falls back to the old bite', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = false;
        game.apple = { x: 300, y: 300 };
        game.npcs = [];
        game.obstacles = [{ x: 140, y: 100 }]; // the push destination is walled
        game.glitches = [new Glitch(120, 100, 20)];
        game.snake.body = [{ x: 100, y: 100 }, { x: 80, y: 100 }, { x: 60, y: 100 }, { x: 40, y: 100 }, { x: 40, y: 120 }];
        game.state.score = 4;
        step(game, { x: 20, y: 0 });
        expect(game.state.score).toBe(1); // -3: corruption bit in
        expect(game.audio.playCorruptHit).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------------
describe('Heur\'s Decontamination — in-room Breakout', () => {
    beforeEach(mountDom);

    it('fires only in the DEDICATED Bay {5,-1}, entered while flagged; you stay in PLAYING', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = 0; // Localhost
        game.shiftScreen(0, -1); // heading NORTH up the spine into the Bay {5,-1}
        expect(game.state.gameState).toBe('DIALOG');
        expect(game.dialogManager.currentDialog).toBe(HEUR.intercept);
        finishDialog(game);
        expect(game.state.gameState).toBe('PLAYING'); // the fight is played IN the room
        expect(game.heur).toBeTruthy();
        expect(game.heur.far).toBe('up'); // you were heading north
        expect(game.state.unlocked.bayRoom).toEqual({ x: 5, y: -1 });
        expect(game.glitches.length).toBe(0); // the bay is swept clean
        expect(game.obstacles.length).toBe(0);
    });

    it('the daemon never ambushes elsewhere — only the Bay triggers it', () => {
        const game = newGame();
        game.state.upgrades.corruptHandler = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        expect(game._heurInterceptHere(1, 0)).toBe(false); // a random open sector
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = 0;
        expect(game._heurInterceptHere(0, -1)).toBe(false); // Localhost
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -1;
        expect(game._heurInterceptHere(0, -1)).toBe(true);  // the Bay
        // and never again once decontaminated
        game.state.unlocked.purgeComplete = true;
        expect(game._heurInterceptHere(0, -1)).toBe(false);
    });

    it('the ping ADVANCES on a wall-bonk tick (no free pressure by parking on a wall)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.tailRider = true; // gear system on
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far=right, retreat=left
        // hold into the FAR (sealed, non-retreat) wall — a bonk every tick
        game.snake.body = [{ x: game.ringRight - 20, y: 200 }];
        game.input.direction = { x: 20, y: 0 };
        game.input.nextDirection = { x: 20, y: 0 };
        const before = { c: game.heur.ping.c, r: game.heur.ping.r };
        game.update(1000); // one move-tick: the head bonks, but the ping must still step
        expect(game.heur).toBeTruthy(); // NOT a retreat — the fight is still live
        const after = { c: game.heur.ping.c, r: game.heur.ping.r };
        expect(after.c === before.c && after.r === before.r).toBe(false); // ping moved
    });

    it('the Bay {5,-1} is an interior spine room — its far door (up) is never coil', () => {
        const wm = newGame().worldManager;
        expect(wm.isCoilWall(5, -1, 'up')).toBe(false);   // north to the rematches
        expect(wm.isCoilWall(5, -1, 'down')).toBe(false); // south back to Localhost (retreat)
    });

    it('the room is SEALED (a bonk, not a death) except the retreat door', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far=right, retreat=left
        game.gear = 3;
        const r = game.crossBorder(400, 200); // ram the far (right) wall — sealed
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING'); // no death
        expect(game.heur).toBeTruthy();               // fight still live
        expect(game.audio.playDenied).toHaveBeenCalled();
        // but the retreat (left, the way you came) is NOT sealed — the fight ENDS
        // (the seal lifts) and the crossing falls through to the normal boundary logic.
        game.crossBorder(-20, 200);
        expect(game.heur).toBeNull(); // retreated: fight over, no restart, no penalty
    });

    // OWNER REWORK: the read-head no longer docks segments (measured: it floored out to a
    // total no-op after five reads). It hits exactly like a wall — the head is a one-cell
    // target on a fixed 150ms ping clock, so being caught by it means you drove into it.
    it('the ping reading the HEAD is a WALL TOUCH — death, or a Crumple bounce', () => {
        const g = 20;
        const aimAtHead = (game) => {
            game.heur.bricks = []; // isolate: no accidental win
            game.snake.body = [{ x: 5 * g, y: 5 * g }, { x: 6 * g, y: 5 * g }, { x: 7 * g, y: 5 * g }];
            game.heur.ping.c = 4; game.heur.ping.r = 5;
            game.heur.ping.sc = 1; game.heur.ping.sr = 0; game.heur.ping.k = 0;
        };

        const lethal = newGame();
        lethal.state.score = 10; lethal.growSnake(10);
        lethal.worldManager.currentRoomX = 8; lethal.worldManager.currentRoomY = 1;
        lethal.startHeurFight('right');
        aimAtHead(lethal);
        lethal._heurPingStep();
        expect(lethal.state.gameState).toBe('DEAD');

        const buffered = newGame();
        buffered.state.upgrades.crumpleLevel = 1;
        buffered.state.score = 20; buffered.growSnake(20);
        buffered.worldManager.currentRoomX = 8; buffered.worldManager.currentRoomY = 1;
        buffered.startHeurFight('right');
        aimAtHead(buffered);
        buffered._heurPingStep();
        expect(buffered.state.gameState).toBe('PLAYING'); // bounced, not dead
    });

    it('Heur takes HEUR_SEALS hits and only then falls — ordinary bricks break in one', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        game.snake.body = [{ x: 0, y: 0 }]; // body out of the way
        const heur = game.heur.bricks.find(b => b.heur);
        expect(heur.hp).toBe(game.HEUR_SEALS);

        for (let i = 1; i < game.HEUR_SEALS; i++) {
            game.heur.ping.hot = game.HEUR_HOT; // armed off your body
            game._heurApplyHit({ brick: heur });
            expect(game.heur, `fight ended after ${i} seal(s)`).toBeTruthy();
            expect(heur.hp).toBe(game.HEUR_SEALS - i);
        }
        game.heur.ping.hot = game.HEUR_HOT;
        game._heurApplyHit({ brick: heur });
        expect(game.heur).toBeNull(); // the last seal ends it
    });

    // THE ARMING RULE. A ball that has only been rattling off walls carries no signature
    // to flag him with. Without this, a parked player still won on a lucky orbit —
    // measured at 106 ping steps — which left the paddle optional.
    it('an UNARMED ping cannot break a seal, however often it strikes him', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        game.snake.body = [{ x: 0, y: 0 }];
        const heur = game.heur.bricks.find(b => b.heur);

        game.heur.ping.hot = 0;
        for (let i = 0; i < 30; i++) game._heurApplyHit({ brick: heur });
        expect(heur.hp).toBe(game.HEUR_SEALS); // untouched
        expect(game.heur).toBeTruthy();

        // ...but one touch of your body arms it, and the next strike lands.
        game._heurApplyHit({ body: true, i: 3 });
        expect(game.heur.ping.hot).toBe(game.HEUR_HOT);
        game._heurApplyHit({ brick: heur });
        expect(heur.hp).toBe(game.HEUR_SEALS - 1);
        expect(game.heur.ping.hot).toBe(0); // and the strike spent it
    });

    it('the arming cools as the ping travels, so a stale contact stops counting', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        game.snake.body = [{ x: 0, y: 0 }];
        game.heur.bricks = [game.heur.bricks.find(b => b.heur)];
        game._heurApplyHit({ body: true, i: 3 });
        expect(game.heur.ping.hot).toBe(game.HEUR_HOT);
        for (let i = 0; i < game.HEUR_HOT; i++) game._heurTick(game.HEUR_PING_MS);
        expect(game.heur && game.heur.ping.hot).toBe(0);
    });

    it('the ping is CONTAINED — it bounces off every wall (no pass, no restart)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far=right, retreat=left
        game.snake.body = [{ x: 0, y: 0 }]; // body out of the way
        game.heur.bricks = [game.heur.bricks.find(b => b.heur)]; // isolate: no accidental win
        // drive the ping into the LEFT wall (the retreat side) — it must reflect, not leave
        game.heur.ping.c = 0; game.heur.ping.r = 5;
        game.heur.ping.sc = -1; game.heur.ping.sr = 0; game.heur.ping.k = 0;
        game._heurPingStep();
        expect(game.heur).toBeTruthy();          // still fighting (no reseal, no restart)
        expect(game.heur.ping.sc).toBe(1);       // reflected back into the room
        expect(game.heur.ping.c).toBeGreaterThanOrEqual(0); // never left the bay
    });

    it('breaking HEUR wins: the far door opens, the seal lifts, the Ascent arms', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right'); // far = right door
        game.snake.body = [{ x: 0, y: 0 }];
        const heur = game.heur.bricks.find(b => b.heur);
        game.heur.bricks = [heur];
        for (let i = 0; i < game.HEUR_SEALS; i++) {
            if (!game.heur) break;
            game.heur.ping.hot = game.HEUR_HOT; // armed off your body
            game._heurApplyHit({ brick: heur });
        }
        expect(game.heur).toBeNull(); // seal lifted
        expect(game.state.unlocked.purgeComplete).toBe(true);
        expect(game.worldManager.isWallBroken(8, 1, 'right')).toBe(true); // far door opened
        expect(game.state.gameState).toBe('DIALOG');
        finishDialog(game);
        expect(game.state.gameState).toBe('PLAYING');
        // and now you can actually leave through the far door
        expect(game.worldManager.getWeakPoint(8, 1, 'right')).toBeTruthy();
    });

    // THE REWORK'S LOAD-BEARING PROPERTIES. Each of these was a measured defect before.
    describe('the rework', () => {
        const inBay = (dir = 'up') => {
            const game = newGame();
            game.state.unlocked.borders = true;
            game.state.unlocked.tailRider = true;
            game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -1;
            game.apple = { x: 300, y: 300 }; game.npcs = []; game.glitches = []; game.obstacles = [];
            game.state.score = 40; game.growSnake(40);
            game.startHeurFight(dir);
            return game;
        };

        it('the ping keeps its OWN clock — gear does not speed it up', () => {
            const count = (gear) => {
                const game = inBay();
                game.state.score = 40;
                game.changeGear(gear);
                let steps = 0, prev = `${game.heur.ping.c},${game.heur.ping.r}`;
                for (let ms = 0; ms < 3000 && game.heur; ms += 16) {
                    game.update(16);
                    if (!game.heur) break;
                    const now = `${game.heur.ping.c},${game.heur.ping.r}`;
                    if (now !== prev) { steps++; prev = now; }
                }
                return steps;
            };
            // Measured before the fix: 10 steps/sec in gear 0 against 33 in gear 3.
            expect(count(0)).toBe(count(3));
        });

        it('striking different body segments produces different angles (aiming exists)', () => {
            const ks = new Set();
            for (const idx of [1, 3, 6, 10]) {
                const game = inBay();
                game.heur.bricks = [];
                game.snake.body = [];
                for (let i = 0; i < 14; i++) game.snake.body.push({ x: (3 + i) * 20, y: 15 * 20 });
                game.heur.ping.c = game.snake.body[idx].x / 20; game.heur.ping.r = 14;
                game.heur.ping.sc = 1; game.heur.ping.sr = 1; game.heur.ping.k = 0;
                game._heurPingStep();
                ks.add(game.heur.ping.k);
            }
            // Before: 13 strike points, ONE outgoing vector, byte-identical.
            expect(ks.size).toBeGreaterThan(1);
        });

        it('the ping visits BOTH cell parities — the old orbit lock is broken', () => {
            const game = inBay();
            game.snake.body = [10, 11, 12, 13, 14].map(c => ({ x: c * 20, y: 15 * 20 }));
            const par = { 0: 0, 1: 0 };
            for (let i = 0; i < 2000 && game.heur && game.state.gameState !== 'DEAD'; i++) {
                game._heurTick(game.HEUR_PING_MS);
                if (game.heur) par[Math.abs((game.heur.ping.c + game.heur.ping.r) % 2)]++;
            }
            // Diagonal-only motion made (c+r) parity invariant, so the ball lived on one
            // colour of the checkerboard and settled into closed orbits it never left.
            expect(par[0]).toBeGreaterThan(0);
            expect(par[1]).toBeGreaterThan(0);
        });

        it('the database is SOLID — driving the head into a brick is a wall touch', () => {
            const game = inBay();
            const b = game.heur.bricks.find(x => !x.heur) || game.heur.bricks[0];
            game.snake.body = [{ x: b.c * 20, y: (b.r + 1) * 20 }];
            game.input.direction = { x: 0, y: -20 };
            game.input.nextDirection = { x: 0, y: -20 };
            game.update(1000);
            expect(game.state.gameState).toBe('DEAD');
        });

        it('a brick NEVER spawns on the worm (the intercept leaves you in the band)', () => {
            // The intercept fires from crossBorder, so your body trails back through
            // exactly the rows the band wants. Entombing it would be an unavoidable death
            // on the first move now that bricks are solid.
            const game = newGame();
            game.state.unlocked.borders = true;
            game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -1;
            game.snake.body = [];
            for (let r = 1; r < 8; r++) game.snake.body.push({ x: 10 * 20, y: r * 20 });
            game.startHeurFight('up');
            for (const b of game.heur.bricks) {
                const clash = game.snake.body.some(s => s.x === b.c * 20 && s.y === b.r * 20);
                expect(clash, `brick at ${b.c},${b.r} spawned inside the worm`).toBe(false);
            }
        });

        it('Heur is never masked by your body — he is the scanner, he cannot hide', () => {
            const game = inBay();
            const hb = game.heur.bricks.find(b => b.heur);
            game.snake.body = [
                { x: 2 * 20, y: 17 * 20 },
                { x: 3 * 20, y: 17 * 20 },
                { x: hb.c * 20, y: hb.r * 20 }, // draped over him
            ];
            expect(game._heurClassify(hb.c, hb.r).brick).toBe(hb);
        });

        it('he performs the full protocol once; coming back is one word', () => {
            const game = newGame();
            game.state.upgrades.corruptHandler = true;
            game.state.unlocked.borders = true;
            game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -1;

            expect(game._heurInterceptHere(0, -1)).toBe(true);
            expect(game.dialogManager.currentDialog).toBe(HEUR.intercept);
            finishDialog(game);

            game.heur = null;
            expect(game._heurInterceptHere(0, -1)).toBe(true);
            expect(game.dialogManager.currentDialog).toBe(HEUR.reentry);
        });
    });

    it('the ping never freezes in a corner against the locked signature', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
        game.startHeurFight('right');
        game.snake.body = [{ x: 0, y: 0 }];
        const positions = new Set();
        for (let i = 0; i < 40; i++) {
            if (!game.heur) break;
            game._heurPingStep();
            if (game.heur) positions.add(game.heur.ping.c + ',' + game.heur.ping.r);
        }
        expect(positions.size).toBeGreaterThan(3); // it keeps travelling
    });

    it('for EVERY far direction the ping stays in-bounds, keeps moving, never tunnels bricks', () => {
        for (const far of ['right', 'left', 'up', 'down']) {
            const game = newGame();
            game.worldManager.currentRoomX = 8; game.worldManager.currentRoomY = 1;
            game.startHeurFight(far);
            game.snake.body = [{ x: 0, y: 0 }]; // body out of the way
            const H = game.heur;
            const seen = new Set();
            let steps = 0;
            const goal = H.goal;
            while (game.heur && steps < 600) {
                const p = game.heur.ping;
                // the ping must never sit inside a NON-goal out-of-bounds cell (a leak)
                const oobBad =
                    (p.c < 0 && goal !== 'left') || (p.c >= H.cols && goal !== 'right') ||
                    (p.r < 0 && goal !== 'up') || (p.r >= H.rows && goal !== 'down');
                expect(oobBad).toBe(false);
                seen.add(p.c + ',' + p.r);
                game._heurPingStep();
                steps++;
            }
            // it should have visited many cells (not frozen) and terminated (win or a
            // reseal opening a dialog) within the budget — never an infinite loop.
            expect(seen.size).toBeGreaterThan(8);
        }
    });

    it('a win on a far wall the hash left SOLID still opens a usable door (no soft-lock)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        // pick a room+dir where getWeakPoint is null pre-win
        let room = null;
        outer:
        for (let x = 2; x <= 10; x++) for (let y = -4; y <= 4; y++) {
            for (const dir of ['right', 'left', 'up', 'down']) {
                if (!game.worldManager.isCoilWall(x, y, dir) && !game.worldManager.getWeakPoint(x, y, dir)) { room = { x, y, dir }; break outer; }
            }
        }
        expect(room).toBeTruthy();
        game.worldManager.currentRoomX = room.x; game.worldManager.currentRoomY = room.y;
        game.startHeurFight(room.dir);
        game.snake.body = [{ x: 0, y: 0 }];
        game.heur.bricks = [game.heur.bricks.find(b => b.heur)];
        const hb = game.heur.bricks[0];
        // deliver the ping onto the last brick — HEUR_SEALS times now, not once
        game.heur.ping.c = hb.c - 1; game.heur.ping.r = hb.r;
        game.heur.ping.sc = 1; game.heur.ping.sr = 0; game.heur.ping.k = 0;
        for (let i = 0; i < 1200 && game.heur; i++) {
            game.snake.body = [{ x: 0, y: 0 }];
            game.heur.ping.hot = game.HEUR_HOT; // stand in for a player who keeps deflecting
            game._heurPingStep();
        }
        expect(game.heur).toBeNull();
        expect(game.worldManager.getWeakPoint(room.x, room.y, room.dir)).toBeTruthy(); // door forced into being
        expect(game.worldManager.isWallBroken(room.x, room.y, room.dir)).toBe(true);   // and opened
    });
});

// ---------------------------------------------------------------------------------
describe('The Ascent — Beat 7, the Fall-Through, the Override', () => {
    beforeEach(mountDom);

    it('the fight ladder is intro -> one rematch each -> finale: {5,-1} stays a normal room', () => {
        const game = newGame();
        const room = game.worldManager.roomGenerator.generateRoom(5, -1, { purgeComplete: true, biteProgress: 1 }, game.worldManager);
        expect(room.npcs.some(n => String(n.id).startsWith('gate'))).toBe(false);
        expect(room.npcs.some(n => String(n.id).startsWith('denny'))).toBe(false);
    });

    it('a Gate scuffle: three segments, three Data, knockback, stall', () => {
        const game = newGame();
        game.state.score = 5;
        game.growSnake(5);
        game.npcs = []; game.obstacles = []; game.glitches = [];
        game.apple = { x: 40, y: 40 }; // keep the landing cell deterministic
        const gate = new NPC(200, 200, 20, 'gate3', []);
        game.snake.body = [{ x: 180, y: 200 }, ...game.snake.body.slice(1)];
        game.input.direction = { x: 20, y: 0 };
        game.npcGateScuffle(gate);
        expect(game.snake.body.length).toBe(3);
        expect(game.state.score).toBe(2);
        expect(gate.x).toBe(260); // knocked 3 cells along your heading
        expect(gate.stun).toBe(3);
        expect(game.audio.playCrash).toHaveBeenCalled();
    });

    it('the Fall-Through stamps your TAIL wake — the path behind you hardens (v3)', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        const denny = new NPC(200, 340, 20, 'denny2', []);
        denny.stunMs = 999999; // park the chase; this test is about the stamps
        game.npcs = [denny];
        game.snake.body = [{ x: 120, y: 100 }, { x: 100, y: 100 }];
        step(game, { x: 20, y: 0 }); // the tail vacates (100,100); the wake memory primes
        step(game, { x: 20, y: 0 }); // the vacated cell comes back DENIED
        expect(game.stamps).toContainEqual(expect.objectContaining({ x: 100, y: 100 }));
        // never under your live body — the wake is always BEHIND the tail
        for (const s of game.stamps) {
            expect(game.snake.body.some(b => b.x === s.x && b.y === s.y)).toBe(false);
        }
    });

    it('doubling back into a stamp is an obstacle-death', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        const denny = new NPC(200, 340, 20, 'denny2', []);
        denny.stunMs = 999999;
        game.npcs = [denny];
        game.stamps = [{ x: 160, y: 100, ttl: 9999 }];
        game.snake.body = [{ x: 140, y: 100 }];
        step(game, { x: 20, y: 0 });
        expect(game.state.gameState).toBe('DEAD');
    });

    it('stamps PERSIST until you leave the room (v3), and leaving clears them', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        const denny = new NPC(200, 340, 20, 'denny2', []);
        denny.stunMs = 999999;
        game.npcs = [denny];
        game.stamps = [{ x: 60, y: 60, ttl: 9999 }];
        game.snake.body = [{ x: 200, y: 100 }];
        for (let i = 0; i < 4; i++) step(game, { x: 20, y: 0 });
        expect(game.stamps.some(s => s.x === 60 && s.y === 60)).toBe(true); // no decay
        game.shiftScreen(0, 1); // leaving the room voids the paperwork
        expect(game.stamps.length).toBe(0);
    });

    it('the Fall-Through chase runs on HIS clock: faster than gear 2, slower than gear 3', () => {
        const game = newGame();
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -2;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        const denny = new NPC(300, 300, 20, 'denny2', []);
        game.npcs = [denny];
        game.snake.body = [{ x: 60, y: 60 }];
        const before = { x: denny.x, y: denny.y };
        game.updateDenny2Chase(120); // 120ms = 3 steps at 40ms/cell (gear2=50, gear3=30)
        const moved = (Math.abs(denny.x - before.x) + Math.abs(denny.y - before.y)) / 20;
        expect(moved).toBe(3);
    });

    it('THE GATE is a rotating ring with ONE aperture that always comes back around', () => {
        const game = newGame();
        game.state.unlocked.ascentArmed = true;
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
        game.snake.body = [{ x: 200, y: 200 }];

        game.updateGate3();
        const ring = game._gate3Ring();
        // the ring wraps the interior perimeter, minus exactly one aperture run
        expect(game._gate3Blocks.length).toBe(ring.length - game.GATE3_APERTURE);
        // it ROTATES: the block set changes as the gap advances — but only AFTER the
        // entry hold, which parks the aperture on the door you came in through.
        const first = game._gate3Blocks.map(b => `${b.x},${b.y}`).join('|');
        for (let i = 0; i < game.GATE3_ENTRY_HOLD; i++) game.updateGate3();
        expect(game._gate3Blocks.map(b => `${b.x},${b.y}`).join('|')).toBe(first);
        for (let i = 0; i < game.GATE3_TURN_TICKS + 1; i++) game.updateGate3();
        expect(game._gate3Blocks.map(b => `${b.x},${b.y}`).join('|')).not.toBe(first);
        // and the aperture is never sealed — every rotation keeps a gap (no soft-lock)
        for (let i = 0; i < ring.length * game.GATE3_TURN_TICKS; i++) {
            game.updateGate3();
            expect(game._gate3Blocks.length).toBe(ring.length - game.GATE3_APERTURE);
        }
    });

    it('beating THE GATE stages his defeat IN the room — he runs and smashes his way out', () => {
        const game = newGame();
        const u = game.state.unlocked;
        u.ascentArmed = true; u.borders = true;
        game.state.score = 40;
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -3;
        game.apple = { x: 300, y: 300 }; game.obstacles = []; game.glitches = [];
        const gate = new NPC(200, 40, 20, 'gate3', []);
        game.npcs = [gate];
        game.snake.body = [{ x: 40, y: 200 }]; // west side, so he flees EAST
        game.gear = 3;

        const wp = game.worldManager.getWeakPoint(5, -3, 'up');
        const r = game.crossBorder(wp.start, -20); // breach north at full speed
        expect(r.stop).toBe(true);                 // you do NOT leave — you watch
        expect(u.gateRematchDone).toBe(true);
        expect(game.worldManager.isWallBroken(5, -3, 'up')).toBe(true); // door stands open
        expect(gate.leaving).toBe(true);
        expect(gate.exitDir).toBe('right');        // away from you, the long way
        expect(game._gate3Blocks).toBeNull();      // the ring dies with his authority
        finishDialog(game);

        // THE WORLD IS STILL STILL. Motion Carried is caused by the IMPACT, not by the
        // breach — nothing has shaken anything loose yet.
        expect(u.motionCarried).toBe(false);

        // he runs, then smashes out and is gone
        for (let i = 0; i < 60 && game.npcs.some(n => n.id === 'gate3'); i++) game.updateGate3();
        expect(game.npcs.some(n => n.id === 'gate3')).toBe(false);
        expect(game.worldManager.isWallBroken(5, -3, 'right')).toBe(true);
        // ...and THAT is what wakes the world, with a rattle you can see.
        expect(u.motionCarried).toBe(true);
        expect(game._shakeMs).toBeGreaterThan(0);
    });

    it('the shake is suppressed under reduce-motion (the SYSTEM line carries it instead)', () => {
        const game = makeGame({ ctx: true }); // draw() needs a canvas context
        game.shakeScreen(600);
        game.settings.reduceMotion = true;
        game.draw();
        expect(game.state.shake).toBe(0);
        game.settings.reduceMotion = false;
        game.draw();
        expect(game.state.shake).toBeGreaterThan(0);
    });

    it('walking out on Gate mid-run still shakes the sector loose (no skippable flip)', () => {
        const game = newGame();
        const u = game.state.unlocked;
        u.ascentArmed = true; u.gateRematchDone = true; u.motionCarried = false;
        game.apple = { x: 300, y: 300 }; game.obstacles = []; game.glitches = []; game.npcs = [];
        game.worldManager.currentRoomX = 5; game.worldManager.currentRoomY = -3;
        game.shiftScreen(0, -1);
        expect(u.motionCarried).toBe(true);
    });

    it('touching THE GATE is a wall hit (Crumple still saves you)', () => {
        const game = newGame();
        game.state.unlocked.ascentArmed = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -3;
        game.apple = { x: 300, y: 300 };
        game.obstacles = []; game.glitches = [];
        game.npcs = [new NPC(200, 40, 20, 'gate3', [])];
        game.snake.body = [{ x: 200, y: 200 }];
        game.updateGate3();
        const block = game._gate3Blocks[0];
        game.snake.body = [{ x: block.x, y: block.y }];
        expect(game._gate3Collide()).toBe(true);
        expect(game.state.gameState).toBe('DEAD');
    });
});

// ---------------------------------------------------------------------------------
describe('Cold Storage — the checkpoint', () => {
    beforeEach(mountDom);

    it('armed, Cache demands a committed save; committing UNSEALS the Scanner door (no auto-breach)', () => {
        const game = newGame();
        const u = game.state.unlocked;
        u.purgeComplete = true;
        u.pauseMenu = true;
        u.saveFunction = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        const home = new NPC(200, 200, 20, 'cachehome', []);
        game.state.gameState = 'DIALOG';
        game.talkToCacheHome(home);
        finishDialog(game);
        expect(u.checkpointOpen).toBe(false); // demanded, not granted
        expect(game.worldManager.isRomSealed(5, -4, 'up')).toBe(true);

        game.saveGame();
        expect(u.checkpointOpen).toBe(true);
        expect(game.worldManager.isRomSealed(5, -4, 'up')).toBe(false); // write-protection lifted...
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(false); // ...but the seam is YOURS to breach
        expect(game.onUnpauseCallback).toBeTruthy(); // her unseal scene waits on the unpause
        const saved = game.saveManager.load(game.activeSlot);
        expect(saved.unlocked.checkpointOpen).toBe(true); // the file carries the opened state

        // and now a max-gear ram breaches the (hidden, unsealed) seam like any weak point
        game.state.gameState = 'PLAYING';
        game.state.unlocked.borders = true;
        game.gear = 3;
        const wp = game.worldManager.getWeakPoint(5, -4, 'up');
        game.npcs = []; game.glitches = []; game.obstacles = []; game.apple = { x: 40, y: 340 };
        const r = game.crossBorder(wp.start, -20);
        expect(r.shifted).toBe(true); // clean breach into Port 0
        expect(game.state.unlocked.finaleDoorFound).toBe(true);
    });

    it('death after the checkpoint respawns you at Cold Storage; the seam re-opens only once found', () => {
        const game = newGame();
        game.state.unlocked.checkpointOpen = true;
        game.npcs = []; game.glitches = []; game.obstacles = [];
        game.apple = { x: 300, y: 300 };
        game.die('border');
        expect(game.worldManager.currentRoomX).toBe(5);
        expect(game.worldManager.currentRoomY).toBe(-4);
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(false); // never breached: stays a seam
        expect(game._diedSinceCheckpoint).toBe(true);

        game.state.unlocked.finaleDoorFound = true;
        game.state.gameState = 'PLAYING';
        game.die('border');
        expect(game.worldManager.isWallBroken(5, -4, 'up')).toBe(true); // finale retries walk right back in
    });

    it('stepping through the door re-seals it behind you (one-way, pre-finale)', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.breakWall(5, -4, 'up');
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.shiftScreen(0, -1);
        expect(game.worldManager.currentRoomY).toBe(-5);
        expect(game.worldManager.isWallBroken(5, -5, 'down')).toBe(false);
        expect(game.state.unlocked.finaleDoorFound).toBe(true);
    });

    it('a load re-derives the checkpoint door from flags', () => {
        const game = newGame();
        game.state.unlocked.purgeComplete = true;
        game.state.unlocked.checkpointOpen = true;
        const committedOnly = game.serialize();
        game.state.unlocked.finaleDoorFound = true;
        const foundToo = game.serialize();

        const game2 = newGame();
        expect(game2.applySave(committedOnly)).toBe(true);
        expect(game2.worldManager.isRomSealed(5, -4, 'up')).toBe(false); // unsealed
        expect(game2.worldManager.isWallBroken(5, -4, 'up')).toBe(false); // but not breached

        expect(game2.applySave(foundToo)).toBe(true);
        expect(game2.worldManager.isWallBroken(5, -4, 'up')).toBe(true); // once found, it stands open
    });

    it('a pre-checkpoint load re-arms the write-protection', () => {
        const game = newGame();
        const preSave = game.serialize(); // nothing earned yet
        game.worldManager.unsealRomDoor(5, -4, 'up'); // a later run unsealed it
        expect(game.applySave(preSave)).toBe(true);
        expect(game.worldManager.isRomSealed(5, -4, 'up')).toBe(true);
    });

    it('checkpoint respawn clears glitches around the ACTUAL spawn cell, not the room centre', () => {
        const game = newGame();
        game.state.unlocked.checkpointOpen = true;
        game.npcs = []; game.obstacles = [];
        game.apple = { x: 300, y: 60 };
        const g = game.gridSize;
        const cx = Math.floor(game.canvas.width / 2 / g) * g;
        const cy = Math.floor(game.canvas.height / 2 / g) * g;
        // adjacent to the offset spawn (cx, cy+3g) but 3 cells from the centre
        game.glitches = [new Glitch(cx + g, cy + 3 * g, g)];
        game.die('border');
        expect(game.glitches.length).toBe(0);
    });

    it('the CACHE ARG never manifests the Hub apparition inside Cold Storage', () => {
        const game = newGame();
        game.state.unlocked.checkpointOpen = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.npcs = [];
        game.deathCode = 'CACH';
        game.recordContinueKey('E'); // spells CACHE at the checkpoint respawn
        expect(game.npcs.some(n => n.id === 'cache')).toBe(false);
    });
});

// ---------------------------------------------------------------------------------
describe('Port 0 — the rigidity funnel and the reboot', () => {
    beforeEach(mountDom);

    function finaleGame() {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -5;
        game.apple = { x: 40, y: 340 };
        game.obstacles = []; game.stamps = [];
        return game;
    }

    it('the finale room is armed with Gate and Denny — and NO Glitch (the squeeze)', () => {
        const game = newGame();
        const room = game.worldManager.roomGenerator.generateRoom(5, -5, { finaleDone: false, biteProgress: 1 }, game.worldManager);
        expect(room.npcs.some(n => n.id === 'gatefinal')).toBe(true);
        expect(room.npcs.some(n => n.id === 'dennyfinal')).toBe(true);
        // the finale no longer keys on corruption: Motion Carried makes Glitches DRIFT,
        // so a held-still "puddle" was impossible by the time you got here.
        expect(room.glitches.length).toBe(0);
        const after = game.worldManager.roomGenerator.generateRoom(5, -5, { finaleDone: true, biteProgress: 1 }, game.worldManager);
        expect(after.npcs.some(n => n.id === 'dennyafter')).toBe(true);
    });

    it('Gate extrudes advancing walls that always keep a hole, and Denny stamps behind you', () => {
        const game = finaleGame();
        const gate = new NPC(200, 40, 20, 'gatefinal', []);
        const denny = new NPC(200, 340, 20, 'dennyfinal', []);
        game.npcs = [gate, denny];
        game.glitches = []; game.obstacles = []; game.stamps = [];
        game.snake.body = [{ x: 200, y: 200 }];

        for (let i = 0; i < 40; i++) { game._tick++; game.updateGateFinal(); }
        expect(game._finale.rows.length).toBeGreaterThan(0);          // walls exist
        const cols = game._cols;
        for (const w of game._finale.rows) {
            const cells = game._finaleWallCells().filter(c => c.y === w.r * 20);
            expect(cells.length).toBeLessThan(cols - 2);              // never a full seal
        }
        expect(game.stamps.length).toBeGreaterThan(0);                // Denny closed the floor
    });

    it('Denny SNAKES the floor — a boustrophedon sweep, and it is slow', () => {
        const game = finaleGame();
        const denny = new NPC(20, 340, 20, 'dennyfinal', []); // bottom-left, heading right
        game.npcs = [new NPC(200, 40, 20, 'gatefinal', []), denny];
        game.glitches = []; game.obstacles = []; game.stamps = [];
        game.apple = { x: 300, y: 300 };
        game.snake.body = [{ x: 200, y: 120 }];

        const cols = game._cols;
        // walk him to the end of his row and one step past: he must climb and REVERSE
        const steps = (cols - 2) + 2;
        for (let i = 0; i < steps * game.FINALE_DENNY_TICKS; i++) { game._tick++; game.updateGateFinal(); }
        expect(denny.y).toBeLessThan(340);      // climbed a row
        expect(denny.sweep).toBe(-1);           // ...and turned around
        expect(game.stamps.length).toBeGreaterThan(cols - 4); // laid the row behind him

        // SLOW by construction: a full sweep of the interior is thousands of ticks, so
        // the squeeze can never be a hidden timer.
        const fullSweep = (cols - 2) * (game._rows - 3) * game.FINALE_DENNY_TICKS;
        expect(fullSweep).toBeGreaterThan(500);
    });

    it('Denny never stamps under the worm, the apple, or Gate', () => {
        const game = finaleGame();
        const denny = new NPC(100, 340, 20, 'dennyfinal', []);
        game.npcs = [new NPC(200, 40, 20, 'gatefinal', []), denny];
        game.glitches = []; game.obstacles = []; game.stamps = [];
        game.apple = { x: 120, y: 340 };                 // dead ahead of him
        game.snake.body = [{ x: 140, y: 340 }];          // and so is the worm
        for (let i = 0; i < 6 * game.FINALE_DENNY_TICKS; i++) { game._tick++; game.updateGateFinal(); }
        expect(game.stamps.some(s => s.x === 120 && s.y === 340)).toBe(false); // not the apple
        expect(game.stamps.some(s => s.x === 140 && s.y === 340)).toBe(false); // not the worm
    });

    it('an advancing wall is a wall hit', () => {
        const game = finaleGame();
        game.npcs = [new NPC(200, 40, 20, 'gatefinal', []), new NPC(200, 340, 20, 'dennyfinal', [])];
        game.glitches = []; game.obstacles = []; game.stamps = [];
        game.snake.body = [{ x: 200, y: 200 }];
        for (let i = 0; i < 40; i++) { game._tick++; game.updateGateFinal(); }
        const cell = game._finaleWallCells()[0];
        game.snake.body = [{ x: cell.x, y: cell.y }];
        expect(game._finaleCollide()).toBe(true);
        expect(game.state.gameState).toBe('DEAD');
    });

    it('REACHING Gate ends it: he backs onto a DENIED stamp — reboot, era 16, Layer 2', () => {
        const game = finaleGame();
        const gate = new NPC(200, 40, 20, 'gatefinal', []);
        const denny = new NPC(200, 340, 20, 'dennyfinal', []);
        game.npcs = [gate, denny];
        game.glitches = []; game.obstacles = [];
        game.stamps = [{ x: 200, y: 60, ttl: 9999, denied: true }]; // a stamp behind him
        game.snake.body = [{ x: 200, y: 200 }];

        game.npcGateFinal(gate); // you reached him — the win condition
        expect(game.state.gameState).toBe('DIALOG');
        finishDialog(game);
        const u = game.state.unlocked;
        expect(u.finaleDone).toBe(true);
        expect(u.era16).toBe(true);
        expect(u.musicLayer).toBe(2);
        expect(game.npcs.some(n => n.id === 'gatefinal')).toBe(false); // terminated
        expect(game.audio.playDeath).toHaveBeenCalled();
        expect(game.worldManager.isWallBroken(5, -5, 'down')).toBe(true); // the way home
        expect(game._finale).toBeNull();                                  // the walls stop
        expect(game.state.gameState).toBe('PLAYING');
    });

    it('reaching Gate does NOT charge you the scuffle price for winning', () => {
        const game = finaleGame();
        const gate = new NPC(200, 40, 20, 'gatefinal', []);
        game.npcs = [gate, new NPC(200, 340, 20, 'dennyfinal', [])];
        game.glitches = []; game.obstacles = []; game.stamps = [];
        game.growSnake(10);
        game.state.score = 20;
        const len = game.snake.body.length;
        game.npcGateFinal(gate);
        expect(game.snake.body.length).toBe(len); // no 3-segment scuffle toll
        expect(game.state.score).toBe(20);
        finishDialog(game);
    });

    it('the PORT 0 aperture is a bonk, not a death', () => {
        const game = finaleGame();
        game.npcs = []; game.glitches = [];
        const g = game.gridSize;
        const mid = Math.floor(game.canvas.width / 2 / g) * g;
        const r = game.crossBorder(mid, -20);
        expect(r.stop).toBe(true);
        expect(game.state.gameState).toBe('PLAYING');
        expect(game.audio.playDenied).toHaveBeenCalled();
    });

    it('post-finale, re-entering Port 0 does NOT reseal the way home', () => {
        const game = newGame();
        game.state.unlocked.borders = true;
        game.state.unlocked.finaleDone = true;
        game.state.unlocked.era16 = true;
        game.worldManager.brokenWalls.add(game.worldManager.boundaryKey(5, -4, 'up'));
        game.worldManager.currentRoomX = 5;
        game.worldManager.currentRoomY = -4;
        game.shiftScreen(0, -1); // visit Denny's vigil
        expect(game.worldManager.currentRoomY).toBe(-5);
        expect(game.worldManager.isWallBroken(5, -5, 'down')).toBe(true); // still open
    });

    it("the finale's corrupted cell cannot be eaten, bitten, OR shunt-SHOVED away", () => {
        const game = finaleGame();
        game.npcs = []; game.stamps = [];
        game.state.upgrades.corruptHandler = true; // the Shunt would normally shove it
        game.obstacles = [];
        game.glitches = [new Glitch(220, 100, 20)];
        game.snake.body = [{ x: 200, y: 100 }, { x: 180, y: 100 }];
        game.state.score = 1;
        step(game, { x: 20, y: 0 }); // head onto the glitch — the finale guard runs BEFORE the shove
        expect(game.glitches.length).toBe(1);       // still there
        expect(game.glitches[0].x).toBe(220);       // and NOT shoved off position
        expect(game.state.score).toBe(1);           // a harmless bonk
        expect(game.snake.body.length).toBe(2);
    });
});

// ---------------------------------------------------------------------------------
describe('Wilds discovery', () => {
    beforeEach(mountDom);

    it('a growth cache is +4 Data and +4 length in one bite', () => {
        const game = newGame();
        game.state.score = 0;
        const cache = new NPC(200, 200, 20, 'datacache', []);
        game.npcs = [cache];
        game.npcDataCache(cache);
        expect(game.state.score).toBe(4);
        expect(game.snake.body.length).toBe(5); // head + 4
        expect(game.npcs.length).toBe(0);
    });

    it('every interior room is reachable (the connectivity pass stitches hash-sealed pockets)', () => {
        const wm = newGame().worldManager;
        const b = wm.bounds;
        const dirs = [['right', 1, 0], ['left', -1, 0], ['down', 0, 1], ['up', 0, -1]];
        const reached = new Set(['0,0']);
        const queue = [[0, 0]];
        while (queue.length) {
            const [x, y] = queue.pop();
            for (const [dir, dx, dy] of dirs) {
                const nx = x + dx, ny = y + dy;
                if (nx < b.minX || nx > b.maxX || ny < b.minY || ny > b.maxY) continue;
                const k = `${nx},${ny}`;
                if (reached.has(k) || !wm.getWeakPoint(x, y, dir)) continue;
                reached.add(k);
                queue.push([nx, ny]);
            }
        }
        const total = (b.maxX - b.minX + 1) * (b.maxY - b.minY + 1);
        expect(reached.size).toBe(total); // no room is sealed out of every playthrough
    });

    it('Wilds UI modules are found by bump, grant their tool, and never respawn', () => {
        const game = newGame();
        const gm = new NPC(80, 80, 20, 'uimodule', []);
        gm.grant = 'gearMeter'; gm.roomKey = '2,2';
        game.npcs = [gm];
        game.npcUiModule(gm);
        expect(game.state.unlocked.gearMeter).toBe(true);
        expect(game.state.unlocked.modulesFound).toContain('2,2');
        expect(game.npcs.length).toBe(0);
        // RoomGenerator suppresses an already-found module room
        const room = game.worldManager.roomGenerator.generateRoom(2, 2, game.state.unlocked, game.worldManager);
        expect(room.npcs.some(n => n.id === 'uimodule')).toBe(false);
    });

    it('the map-pins tool grants a shape and cycles the current room pin (persisted)', () => {
        const game = newGame();
        const tool = new NPC(80, 80, 20, 'uimodule', []);
        tool.grant = 'mapPins'; tool.roomKey = '3,-3';
        game.npcUiModule(tool);
        expect(game.state.unlocked.mapPinsTool).toBe(true);
        expect(game.state.unlocked.pinShapes).toBe(1);
        game.worldManager.currentRoomX = 4; game.worldManager.currentRoomY = 1;
        game.cycleMapPin();
        expect(game.mapPins['4,1']).toBe(0); // first shape
        game.cycleMapPin();
        expect(game.mapPins['4,1']).toBeUndefined(); // one shape -> cycles straight back to none
        // an extra shape module raises the cycle length
        const extra = new NPC(80, 80, 20, 'uimodule', []);
        extra.grant = 'pinShape'; extra.roomKey = '2,-4';
        game.npcUiModule(extra);
        expect(game.state.unlocked.pinShapes).toBe(2);
        game.cycleMapPin(); expect(game.mapPins['4,1']).toBe(0);
        game.cycleMapPin(); expect(game.mapPins['4,1']).toBe(1);
        game.cycleMapPin(); expect(game.mapPins['4,1']).toBeUndefined();
    });

    it('pin-shape count is order-independent: extras-first then the tool = 2 shapes', () => {
        const game = newGame();
        const extra = new NPC(0, 0, 20, 'uimodule', []); extra.grant = 'pinShape'; extra.roomKey = '2,-4';
        game.npcUiModule(extra); finishDialog(game);
        expect(game.state.unlocked.pinShapes).toBe(1); // the extra
        const tool = new NPC(0, 0, 20, 'uimodule', []); tool.grant = 'mapPins'; tool.roomKey = '3,-3';
        game.npcUiModule(tool); finishDialog(game);
        expect(game.state.unlocked.mapPinsTool).toBe(true);
        expect(game.state.unlocked.pinShapes).toBe(2); // the tool ADDS its own shape (not clamped to 1)
    });

    it('found UI modules and pins survive a save/load round-trip', () => {
        const game = newGame();
        game.state.unlocked.gearMeter = true;
        game.state.unlocked.coordReadout = true;
        game.state.unlocked.mapPinsTool = true;
        game.state.unlocked.pinShapes = 2;
        game.state.unlocked.modulesFound = ['2,2', '8,2'];
        game.mapPins = { '5,0': 1, '8,3': 0 };
        const d = game.serialize();
        const g2 = newGame();
        expect(g2.applySave(d)).toBe(true);
        expect(g2.state.unlocked.gearMeter).toBe(true);
        expect(g2.state.unlocked.pinShapes).toBe(2);
        expect(g2.state.unlocked.modulesFound).toEqual(['2,2', '8,2']);
        expect(g2.mapPins).toEqual({ '5,0': 1, '8,3': 0 });
    });

    it('the discovery rooms exist where the Topology Scan says they do', () => {
        const game = newGame();
        const rg = game.worldManager.roomGenerator;
        const u = { biteProgress: 1 };
        expect(rg.generateRoom(7, -3, u, game.worldManager).npcs.some(n => n.id === 'datacache')).toBe(true);
        expect(rg.generateRoom(11, 2, u, game.worldManager).npcs.some(n => n.id === 'lorefrag')).toBe(true);
        expect(rg.generateRoom(6, 2, u, game.worldManager).npcs.some(n => n.id === 'citizen')).toBe(true);
        expect(rg.generateRoom(11, -4, u, game.worldManager).npcs.some(n => n.id === 'nibble')).toBe(true);
        expect(rg.generateRoom(9, 4, u, game.worldManager).npcs.some(n => n.id === 'hush')).toBe(true);
        const booth = rg.generateRoom(10, 5, u, game.worldManager).npcs;
        expect(booth.some(n => n.id === 'lorefrag')).toBe(true);
        expect(booth.some(n => n.id === 'datacache')).toBe(true);
    });
});
