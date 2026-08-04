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

// --- THE CABINET ---------------------------------------------------------------------
// Fixing the canvas alone was half a job. The board became a fixed 1000x560 centred in
// the window while every ribbon and overlay still measured the WINDOW, so on a 1920-wide
// display the Data readout sat ~430px LEFT of the play field, the gear gauge ~430px right
// of it, and the dialog box (absolutely positioned against the viewport, because <body>
// is not a containing block) overhung the field by ~150px on each side and started above
// its top edge. The chrome was furnished for a room the game no longer lived in.
//
// So the unit that scales is not the canvas — it is the whole machine: top ribbon, board,
// bottom ribbon, one 1000 x 720 object. main.js sizes #cabinet to the scaled board width
// and publishes --ui-scale, so the HUD sits in the BOARD's corners and every overlay is a
// percentage of the BOARD. There is one thing on screen, and it has one size.
export const CHROME_TOP = 60;     // Data + the gear gauge
export const CHROME_BOTTOM = 100; // the Architect's terminal + boss status
export const CABINET_W = LOGICAL_W;                                // 1000
export const CABINET_H = LOGICAL_H + CHROME_TOP + CHROME_BOTTOM;   // 720

// The one fit formula, exported so main.js and the tests cannot drift apart (the first
// version of this test re-implemented the maths, which pins a copy rather than the code).
//
// Whole multiples only, because a fractional scale makes some pixels 2 screen-px wide and
// their neighbours 3 — the exact shimmer that makes upscaled pixel art look cheap.
//
// TWO PASSES, AND THE ORDER MATTERS. The board is maximised FIRST, against chrome held at
// 1x; only then does the chrome grow into whatever height is left over. Scaling them in
// lockstep is the obvious version and it is wrong — measured, it cost a windowed 1440p
// display its 2x board (2000x1120 -> 1000x560 in a 2560px window, a stamp in a letterbox)
// purely to avoid a 16px ribbon. The play field is the thing; the furniture yields to it.
//
// Below 1x the chrome stops scaling entirely: shrinking type under the §2.6 16px floor is
// never the trade, and an unreadable gear gauge is a worse failure than a soft board.
// Cropping is never on the table — a wall you cannot see is a wall that kills you.
export function computeFit(availW, availH) {
    const chrome = CHROME_TOP + CHROME_BOTTOM;
    const raw = Math.min(availW / LOGICAL_W, (availH - chrome) / LOGICAL_H);
    if (raw < 1) {
        const board = Math.max(0.1, raw);
        return { scale: board, uiScale: 1, width: LOGICAL_W * board, height: LOGICAL_H * board };
    }
    const scale = Math.floor(raw);
    let uiScale = 1;
    while (uiScale < scale && LOGICAL_H * scale + chrome * (uiScale + 1) <= availH) uiScale++;
    return { scale, uiScale, width: LOGICAL_W * scale, height: LOGICAL_H * scale };
}
