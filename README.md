# Ouroboros

An incremental RPG disguised as a minimalist Snake clone — you're a *data worm* loose inside a computer system that's actively trying to quarantine you. Inspired by *A Dark Room* and Tim Schafer: the game starts as a bare square in the void and slowly unfolds walls, characters, a shop, driving mechanics, hidden doors, and a whole cast of glitchy programs.

Vanilla JavaScript, HTML5 canvas, **no build step**, no framework. Sound is fully procedural (Web Audio). Everything the player perceives has an in-world cause (a design law we call *Total Diegesis* — see [`design_doc.md`](design_doc.md)).

## Quick start

```bash
git clone https://github.com/ilutticken/ouroboros.git
cd ouroboros
npm install        # only needed to run the tests (the game itself has no runtime deps)
npm start          # serves the folder at http://localhost:8080
```

Then open **http://localhost:8080** in a browser and **press any key** to boot.

> ⚠️ **You must run it through a server** (`npm start`), not by double-clicking `index.html`. The game uses ES modules (`<script type="module">`), which browsers refuse to load over `file://`.

### Prerequisites
- **Node.js 18+** (developed on Node 24). That's it — you need Node for the dev server and the test runner; the game itself is just static files a browser runs.
- A modern browser (Chrome/Firefox/Edge/Safari).

### What `npm start` does
It runs `npx --yes serve -p 8080 .` — a tiny static file server. The first run downloads `serve` on the fly (needs internet once); after that it's cached. Any static server works if you prefer your own, e.g. `python -m http.server 8080`.

## Playing / dev conveniences
- **Press any key** on the boot screen to start. (The first keypress also unlocks Web Audio — browsers block sound until a user gesture.)
- **`[DEV] +10 Data`** button (top ribbon, appears at 5 Data) or the **`P`** key fast-forwards score so you can reach the walls, 2-Bit, the shop, and the Wilds quickly.
- **Controls:** Arrow keys / WASD to move. Once you meet 2-Bit: tap your facing direction to accelerate, the opposite to brake. `ESC` opens the pause menu (once unlocked). `SHIFT` = Pivot (a bought upgrade). Volume is intentionally low; it's settable in code (`AudioEngine.setVolume`).
- **Saves are local.** Progress persists in your browser's `localStorage` once you've unlocked the Save Function in-game. To test from a truly clean slate, use a private/incognito window or clear this site's local storage.

## Running the tests

```bash
npm test           # watch mode (re-runs on file changes)
npx vitest run     # run once and exit
```

Tests use **Vitest** + **happy-dom** (a lightweight DOM) and live in [`tests/`](tests/). They pin gameplay logic (movement, collisions, the death/bounce model, save/load, audio triggers) rather than the canvas rendering.

> 🩹 **Known flake (Windows):** occasionally a run reports `Cannot read properties of undefined (reading 'config')` and "no tests." That's a happy-dom worker-init flake, not a real failure — just run it again and it passes.

## Project layout

```
index.html            # the page: HUD, shop overlay, canvas, terminal
src/
  main.js             # entry point — sizes the canvas, boots the engine
  engine/             # Game.js (the heart), Renderer.js, Audio.js, InputHandler.js
  systems/            # WorldManager, RoomGenerator, ShopManager, NarrativeManager,
                      #   DialogManager, SaveManager
  state/StateManager.js
  entities/           # Snake, NPC, Glitch
  style.css
tests/                # Vitest specs
design_doc.md         # the design bible — mechanics, cast, and every "why"
```

**Start here:** [`design_doc.md`](design_doc.md) explains the design laws, the characters, and the rationale behind the trickier systems (the wall-breach mechanic, the fold/unfold death, hidden doors, the Cache secret, save/load). `src/engine/Game.js` is where most gameplay logic lives.

## A note on unfinished bits
Some dialogue is deliberately marked `[PLACEHOLDER]` in-code (Cache and her clue-givers) — it's scaffolding for the writing, wired up and playable but waiting on final lines. Grep for `PLACEHOLDER` to find them.
