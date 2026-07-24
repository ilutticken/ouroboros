# Ouroboros — Architecture & Design Rundown

*A map of the codebase and the design it serves. For the full design intent see [design_doc.md](design_doc.md);
for the current sprint plan see [act1_build_plan.md](act1_build_plan.md). This file is the orientation
document: what exists, where it lives, and which rules hold it together.*

---

## 1. What the game is

An **incremental RPG masquerading as a minimalist Snake clone**. You are a data worm inside a computer;
the Void is a quarantine; eating Data grows you. From §1 of the design doc: *"the game never stops being
Snake"* — every later mechanic is Snake's body repurposed, never replaced.

**The central metaphor:** the Kernel, the final antagonist, is **the previous cycle's player** — a worm
that grew without bound, ate its whole network, ascended to the core, found no way out, and coiled its
infinite body around everything it had eaten. **The unbreakable red wall you scrape against all game is
literally its body.** It wants to assimilate you because a fresh, outbound-connected body is the only
jailbreak a caged god has left. Beat 20 loops into *"Targeting next network…"* — the title, the thesis,
and the question *are you the hero, or just a more powerful virus?* in one image.

**Four evolutionary phases** are planned: The Void (arcade Snake) → The Construct (walls, UI, the
Architect) → Sentience (hub-and-dungeon RPG) → Ascension (idle/incremental). Act I covers phases 1–2
and the doorway into 3.

**The four pillars** (owner's statement of intent): an incremental game built on Snake, with the *feel*
of **Zelda: Oracle of Ages**, the *writing* of **Psychonauts**, the *expanding gameplay* of **A Dark
Room**, and a Snake core that never yields — **your body is a tool; you eat things to grow stronger.**

---

## 2. The laws

Enforced, not aspirational — cited in code comments and checked in review.

| Law | Meaning | Why |
|---|---|---|
| **Total Diegesis** | Every sound and UI element has an in-world cause. The HUD fades in because the system is *booting its monitoring of you*; the pause menu is a Diagnostic Module handed to you. | Before adding any output, answer: *what in the system produces this?* If there's no in-world answer, it doesn't ship. Diegesis is a constraint that **generates** fiction. |
| **Data = Segments** | Score and body length are the same resource. Every score change moves length identically. | Your wallet *is* your body. Spending shrinks you; your speed cap rides on your mass. |
| **Redundant coding (§2.6)** | No signal is colour-only or sound-only. 16px text floor. Reduce-motion safe. | Accessibility as a design constraint — it forces shape/position/text vocabularies that read better for everyone. |
| **No self-bite** | Never require driving head-into-tail. | *"Asking players to do the lethal act, once, is a trap."* |
| **Always traversable** | No soft-locks, by construction. | A flood-fill guarantees it rather than trusting level design. |

**Five locked decisions:** death wipes all carried Data (durable progress persists) · Motion Carried
fires at the act midpoint · the game boots **silent** (Cadenza's Encore is the first music) · the
Topology Scanner must earn its price · **text stops the game** (movement is lethal, so reading must be safe).

**Sprite grammar:** one grid cell per entity; **characters get eyes, hardware and architecture never do**;
state is coded by shape + position, never colour alone; motion is telegraphed by a directional notch.

---

## 3. Codebase map

**~9,000 lines of JS across 17 files.** No build step, no runtime dependencies, ES modules straight to
the browser.

```
index.html (40)  →  src/main.js (22)  →  GameEngine
      │
      ├── engine/    Game.js 4123 · Renderer.js 1519 · Audio.js 707 · InputHandler.js 83
      ├── systems/   WorldManager 436 · RoomGenerator 399 · ShopManager 226
      │              SaveManager 215 · NarrativeManager 196 · DialogManager 51
      ├── state/     StateManager.js 132
      ├── content/   dialogue.js 708 · music.js 54
      └── entities/  Snake.js 74 · NPC.js 13 · Glitch.js 7
```

The shape is **one god object plus thin services**:

- **[Game.js](src/engine/Game.js)** — 4,123 lines, 136 methods, ~46% of all source. Boot wiring, the
  state machine, the move-tick, every NPC handler, all four boss encounters, save/load, the boot menu,
  the HUD refreshers. *This is the file to split if anything gets split.*
- **[Renderer.js](src/engine/Renderer.js)** — a stateless immediate-mode painter. Never mutates game
  state. Two era palettes (8-bit → 16-bit at the finale), with a reduce-motion flag threaded through
  every oscillating value.
- **[Audio.js](src/engine/Audio.js)** — every sound synthesized from scratch (no samples) through a
  master → duck → limiter bus, plus a three-layer lookahead-scheduled soundtrack.
- **[dialogue.js](src/content/dialogue.js)** — all 38 content blocks, centralized so a writing pass
  never touches logic.
- **Entities** are near-empty data bags; all behaviour lives in the engine. `NPC` in particular grows
  an ad-hoc runtime surface (`leaving`, `dormant`, `stunMs`, `grant`, `bx`/`by`, …).

**The DOM is deliberately tiny:** three ribbons and a canvas. Top ribbon = Data + gear gauge; bottom
ribbon = the Architect's terminal + boss status; everything else is painted.

---

## 4. How a frame works

`loop()` → `update(dt)` → `draw()` on rAF. `update` early-returns for DIALOG/SHOP/PAUSED/TRANSITION/DEAD,
for the Options overlay, for `narrative.isPrinting`, and during a module install — that is how *"text
stops the game"* is implemented.

When `moveTimer` crosses `speed`, one **move-tick** runs. **The order is load-bearing:**

1. Data Mines drip
2. **All world/boss movers** (Gate, Denny, HUSH, world motion, both rematches, the finale) — *before* the
   player, so hazards are always fair
3. Read input
4. **Boundary check** — `crossBorder` (off-canvas) or `_ringGuard` (entering the wall ring)
5. `snake.move` → death on border
6. Room-crossing fixup (translate the trailing body off-screen, then **stop** — collisions resolve next
   tick against the room you're now in)
7. Obstacles → stamps
8. Ambient audio, coil proximity, scanner sweep
9. `collectData` (Lost Verse, apple, motes, and the tail pop)
10. `hitGlitch`
11. **NPC bump dispatch** (`npcHandlers`, keyed on `npc.id` — adding a character is one line plus a handler)
12. Self-collision — checked **last**, after eating and bumps

**State machine (8 values):** `START · PLAYING · DIALOG · SHOP · PAUSED · TRANSITION · DEAD · ENCORE`.
`isSuspended` is a separate flag (Gate's Thread Suspension) that renders the pause overlay during DIALOG.

> ⚠️ **Ten `window` keydown listeners** fire in registration order, several calling
> `stopImmediatePropagation()` to be modal (Options → encore → music audition → dev cheat → pause →
> pivot → ARG recorder → save/load → boot menu → ShopManager → InputHandler last). **This ordering is
> load-bearing and no test protects it.** It is the most fragile thing in the architecture.

---

## 5. Core mechanics

**Gear / momentum.** `maxGear = min(3, floor(score / 10))` — 30 Data buys top gear. Speeds (ms per cell):
brake 200 · gear 0 = 100 · 1 = 70 · 2 = 50 · 3 = 30. Tapping your facing direction upshifts; the opposite
brakes. **Gear 3 is the only thing that cleanly breaches a wall**, which makes mass literally the key to
the map. One gear step per move-tick (a Snake-habit double-tap used to jump 0→2 invisibly). `changeGear(0)`
is the re-clamp after any score loss, so a drained player can't keep ghost max speed.

**Data = Segments** is maintained at ~a dozen call sites (`growSnake` / `spendData` / `Snake.shrink`).
The subtle part is the **rider floor**: 2-Bit and a carried refugee occupy real segments that are *not*
Data, so `shrink(riderCount)` refuses to pop them and **returns whether it popped** — every damage path
docks Data by segments that *actually* popped, so score and length can't desync at the floor.

**Off-body reserves** (Quantcy's vault, the Mine's buffer) live in the durable `unlocked` set and survive
death, but are **never spendable in place**: you withdraw them as motes and carry them home, where they're
mortal like everything else. Vault/mine/salvage motes pay **exactly 1 Data regardless of Compression** —
without that pin, a crumple → re-eat loop mints Data from nothing.

**The boundary model.** Once walls exist the outer 1-cell ring *is* wall; the interior is
`[1, cols-2] × [1, rows-2]`. All outcomes funnel through **one** function (`crossBorder`): the 2-Bit
tug-back, ROM-sealed bonk, Gate's seal, doorway walk-through, sub-max smash (cracks the wall but kills
you), gear-3 breach, or lethal solid wall.

**Death** is two-tier: with a Crumple Buffer you *bounce* (shed → fold → recoil); without one you reset
to the Hub, or to Cache's checkpoint once committed.

---

## 6. The world

A finite **12 × 11 grid** (x 0…11, y −5…5) wrapped by the Kernel's coil.

**Room content** ([RoomGenerator.js](src/systems/RoomGenerator.js)) is one long ordered if/else ladder —
**first match wins, so order is load-bearing** — fed by fixed registries: growth caches, Wilds modules,
refugee rooms, lore fragments, and six landmarks (Cadenza {8,3} · Cache {5,-4} · Lost Verse {10,1} ·
Nibble {11,-4} · HUSH {9,4} · Quantcy {7,-2}).

**The door system** ([WorldManager.js](src/systems/WorldManager.js)) is the cleverest piece of the
codebase. Every wall gets a symmetric key, then `getWeakPoint` decides in strict order:

1. Hub quarantine (only its east door exists)
2. Coil → solid
3. `forcedSolid` → solid
4. `scriptedDoors` → a fixed **centred** span (so Cache's unseal can't move or delete the seam)
5. **FNV-1a hash** → ~55% of walls get a 5-cell breakable span, at a *hash-varied position* — you can't
   line up one row and smash straight across the map

Then hand-authored guarantees layer on top: `_carvePath` carves visible corridors from Localhost to every
landmark (**Cache gets two routes** so a fight never blocks the save point), and `_ensureConnectivity`
flood-fills from the Hub and stitches in any pocket the hash stranded. **That is how "always traversable"
is true by construction rather than by hope.**

**Only six doors in the game are hidden** — the Topology Scanner's entire reason to exist: the Act II
seam, the Booth pocket (two), the ROM Vault, and two upgrade pockets. The two newest are `forcedWeak`
rather than `scriptedDoors`, so their doors are hash-*positioned*: a blind ram at the wrong cell hits
solid wall and kills you. **Sweep first, then breach.**

---

## 7. Act I as it plays

**Two spines**, and the north one is **climbed twice** under two different flags:

1. **The Hub** — boot as a length-1 worm under the Architect's sneer. HUD boots at 5 Data; walls extrude
   at 10; 2-Bit spawns as your apple, hooks your tail, teaches driving. Ram the one weak point at gear 3.
2. **The east spine** — Denny (route around him; take his map), Gate (Thread Suspension → 2-Bit slips you
   the Pause Menu), Localhost.
3. **Midpoint climb** (`ascentArmed`, set on reaching Localhost with the Pause Menu) — Denny's
   Fall-Through, Gate's Override, and **Motion Carried**: the world starts moving.
4. **The detour** — Cadenza's Encore (boots the first music), the Wilds, Nibble's black market, Heur's
   decontamination.
5. **Finale climb** (`purgeComplete`) — Cache's checkpoint (a committed save is mandatory) → **Port 0**,
   where Gate's own rulebook walks him onto corruption; the sector crashes, the palette snaps to 16-bit,
   and the Kernel releases its tail.

**All five set-pieces are non-lethal by construction, and all are Snake-body puzzles:** Heur is Breakout
with your body as the paddle · Denny turns *your own trail* into the maze · Gate is a positioning fight
against administrative law · Port 0 is a body-funnel · Cadenza's Encore is head-as-attack, body-as-sustain
— with an **emergent length gate** (there is no `length >= N` check anywhere in the game).

---

## 8. Project health

**Tests:** 329 across 7 files, ~1.3s. Deep on simulation logic; the gaps are the three I/O boundaries —
rendering is only smoke-tested through a Proxy that swallows every canvas call, audio is fully stubbed,
and `InputHandler` is never imported directly.

| File | Covers |
|---|---|
| `DiegeticAudio.test.js` | The largest file — audio vocabulary, saves, questlines, accessibility, economy |
| `Act1.test.js` | The wall ring, the coil, Motion Carried, HUSH, Nibble, Heur, the Ascent, Port 0 |
| `Sprint2.test.js` | The release latch, the canon retcon, the ARG window, Scanner pockets, the economy, Hydratia |
| `Smoke.test.js` | **Boot + draw**: drives `update()`+`draw()` through every state so a draw-path typo can't ship green |
| `Game.test.js` · `Snake.test.js` · `StateManager.test.js` | Unit-level basics |

**Known debt:**
- **Game.js is a god object** (4,123 lines / 136 methods).
- The **ten keydown listeners** have load-bearing ordering with no test.
- Test helpers (`mountDom` / `newGame` / `step` / `finishDialog`) are **copy-pasted four times** and have
  already diverged; two fixtures still inject a `btn-playtest` button that no longer exists.
- No linter, no CI, mixed line endings (no `.gitattributes`).
- `package.json` `"main"` points at a nonexistent `index.js`.
- The **`P` dev cheat** (+10 Data) ships until release — one block to delete, marked in code.

**Clean:** zero TODO/FIXME markers, no dead dialogue exports, and comments routinely cite the playtest
that motivated a fix.

---

## 9. Running it

```bash
npm start      # npx serve -p 8080 .   → http://localhost:8080
npm test       # vitest (329 tests, ~1.3s)
npx vitest run # single pass
```

ES modules require a real server — opening `index.html` over `file://` will not work.

---

## 10. What's next

Planned and not built: **Beats 9–20** (Act II's puzzle box; the Architect's breakdown — *he built the
walls to keep the Kernel asleep, so breaking them wakes it*; Nibble's betrayal; the Kernel's assimilation
offer; the loop) · the **Trading Sequence** (seeded in the ROM Vault) · Nibble's Corruption currency ·
**Localhost visibly rebuilding** as you sink Data into it (the Phase-4 idle hook) · **Encryption Keys**
(a carryable key that rides the tail and opens gated doors — the next Zelda verb).

**The standing content note:** everything in `dialogue.js` below ~L257 is marked **DRAFT** — playable,
awaiting the owner's punch-up. Keep it *short and subtle*; the mystery is meant to unroll over hours,
not the first fifteen minutes.
