// THE LOGICAL CANVAS — one fixed play space for every player, on every monitor.
//
// The canvas used to be sized to the viewport, so the ROOM was literally the size of your
// window. Measured, a 4K player got 19,000 interior cells against a laptop's 1,980: ~10x
// the area, 10x the apple spawn locations, a worm occupying a tenth as much of the room,
// and ambient drift covering 0.88% of the floor in 30s instead of 8.4%. Meanwhile anything
// counted in CELLS stayed fixed while anything SPANNING the room grew, so the same screen
// that made the open world trivial made the bosses brutal: Gate's aperture went from 3.7%
// of his ring to 1.2%, and Heur's database from 64 bricks to 188. Two opposite difficulty
// slopes at once, and neither of them chosen by anybody.
//
// Now the grid is fixed and the picture is INTEGER-SCALED to fit (see main.js fitCanvas).
//
// --- WHY 50 x 28 -------------------------------------------------------------------
// * 1000 x 560 at GRID 20 — near 16:9, so a widescreen display letterboxes barely at all.
// * 48 x 26 = 1,248 interior cells, in the same neighbourhood as the smallest real screen
//   the game was actually being played on (1,980), so existing tuning barely moves — and
//   tighter than the old average, which is the correct direction for a Snake: the 4K
//   problem was always too MUCH room.
// * GRID stays 20, which keeps every sprite's detail maths (eyes, notches, pips, the
//   >=16px text floor) exactly where it was tuned.
//
// --- THE ERA LADDER (why the grid is fixed and the GRID SIZE is the dial) -----------
// The game climbs 8-bit -> 16-bit -> 32-bit. A console generation does not hand you MORE
// PLAY FIELD, it hands you more PIXELS FOR THE SAME FIELD — so the cell grid is frozen at
// 50 x 28 forever and the era moves GRID instead:
//
//     8-bit    GRID 20  ->  1000 x  560     (today)
//     16-bit   GRID 30  ->  1500 x  840     (Beat 8's forced reboot)
//     32-bit   GRID 40  ->  2000 x 1120     (Act III)
//
// Every one of those is the same 50 x 28 board, so NO gameplay constant, hazard span, or
// fight tuning changes across an era jump — the aperture is still 7 cells, the database is
// still the same brick count. And because the logical picture grows while the monitor does
// not, each era naturally spends its upscale factor on fidelity instead of magnification,
// which is exactly how a generation jump felt. The era flip is already diegetic (a forced
// system reboot at Port 0), which is the one moment a resolution change is free.
export const GRID = 20;
export const COLS = 50;
export const ROWS = 28;
export const LOGICAL_W = COLS * GRID;  // 1000
export const LOGICAL_H = ROWS * GRID;  // 560
