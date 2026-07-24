# Ouroboros — Act I Reconciled Build Plan

*Single source of truth for the "make it click" pass. Synthesized from four grounded design passes + a reconciliation check, all read against the working tree. Companion detail lives in `design-economy.md`, `design-hydratia.md`, `design-structure.md`, `design-presentation.md`, `design-reconcile.md`.*

**Reconciliation bottom line:** the four workstreams cohere. Every off-body Data value (bank, mine, autosave) lives in the durable `unlocked` set; `serialize()`/`resetScore()` keep `score` and durable progress cleanly separated; **usable Data is always on your body and always dies with you.** The real work is sequencing + merging one duplicated feature, not resolving contradictions.

---

## 1. The constraints (your locked decisions)

1. **Death takes all carried Data, always.** You keep progress + upgrades. No banking-to-survive-death.
2. **The world starts moving after the second Gate fight, at the midpoint** — reached sooner by funnelling Denny/Gate earlier.
3. **No heartbeat from boot.** The game starts silent; Cadenza's Encore is the first sound.
4. **The Scanner earns its price:** blind ramming can kill you; the Scanner reveals hidden doors with *upgrades* behind them.
5. **Text stops the game** (movement is lethal). Fewer Architect messages, each Space-barred through. More/better death messages.

**Canon retcon (authoritative):** refreshd → **Hydratia**; the whole "tick/heartbeat" lore is cut; Glitches are caused by *you gathering Data* (the Architect merely *observes* it and uses it as a reason to contain you); the 2-Bit "speed = mass" line is a deliberate joke, left alone.

**The laws (never violated):** Total Diegesis · Data = Segments · no self-bite · redundant coding §2.6 · always traversable.

---

## 2. Do this first — the canon retcon

The critical safety fact confirmed in code: **"tick" means two different things.** The engine move-tick (`_tick`, `_moveTick`, `moveTimer`) is machinery and is **never touched**; only the *lore* heartbeat metaphor is scrubbed. `refreshDynamicRoomContent` is unrelated plumbing and is **not** renamed. "refreshd" appears in **no code identifier** — only in `dialogue.js` comments and `design_doc.md` prose, so the rename is low-risk.

Three passes:
- **Rename** refreshd → Hydratia (dialogue.js comment l.420; design_doc.md cast/beats). Keep her JOB: the reason unlocks survive death. *(mechanical)*
- **Cut the tick/heartbeat lines** — every shipped line that calls the tick a pulse/heartbeat/clock:
  - `dialogue.js:350` (Cache: "the little tick that keeps you warm…") → rewrite, keep the can't-follow-through-a-breach mechanic, drop "tick". **[OWNER DRAFT]**
  - `dialogue.js:424` (lore frag 11,2: "count along and you'll hear the skips") → **cut**, replace with a Hydratia/decay fragment with no pulse. **[OWNER DRAFT]**
  - `dialogue.js:455` (Booth log: "one pulse per tick. The tick IS the pulse") → cut the pulse clause, keep the redacted sleeper vitals. **[OWNER DRAFT]**
  - `design_doc.md` beat-1 audible-tick line + the Kernel/Cadenza/Motion-Carried "heartbeat" identifications → cut the heartbeat clauses.
  - **Keep** (owner's call, recommended): HUSH's `[Every move-tick is a waveform.]` — that's the *engine* tick as HUSH's sound-domain lore, not the sleeper's heartbeat.
- **Rewrite the Glitch origin** — the Architect *observes* that gathering Data spawns Glitches (replaces both "he deployed them" and "refreshd's decay"):
  - `dialogue.js:125` (ARCHITECT.seedGlitches "Seeding memory corruptors…") → rewrite as observation, not authorship. **[OWNER DRAFT]**
  - `dialogue.js:423` (lore frag 4,-3 "i was late") → rewrite as Hydratia grief without claiming the blanks are the Glitches. **[OWNER DRAFT]**
  - `design_doc.md` origin passages (184/199/257/260) → rewrite. Heur's "flagged by resemblance, never confirmed" wound *survives and sharpens* (you genuinely do spawn Glitches by eating, so he's more right — which is worse).
  - No mechanical change: `seedGlitches` still fires from `spawnApple`; only its *claim* changes.

---

## 3. The four workstreams (what each delivers)

### A. Act-I re-shape & scene order  *(design-structure.md)*

- **Funnel Denny/Gate earlier (Decision 2).** The rooms are already carved and reachable from Localhost — what makes Gate-2 *late* is that the two rematch rooms (`{5,-2}`, `{5,-3}`) arm on `purgeComplete` (which needs the whole Nibble→Heur detour). Fix: **split the spine into two climbs on the same rooms.** A new early flag `ascentArmed` (set on reaching Localhost) arms the Denny→Gate rematch pair; breaching north out of `{5,-3}` fires **Motion Carried at the midpoint**, before outer-Wilds exploration. The late climb (Heur `{5,-1}`, Cache checkpoint `{5,-4}`, Port 0 `{5,-5}`) stays on `purgeComplete`, unchanged. No geometry edits; Denny-below-Gate and traversability preserved. This also reconciles the code with design_doc, which already says the world should wake at the first real Gate fight.
- **Cache's first meeting never blocked (she teaches Save).** Today `talkToCacheHome` checks the `needPurge` refusal first, so a dirty player who arrived without Save gets turned away and never learns to save. Fix: run the Save-teaching install **before** the needPurge refusal; needPurge then only guards the *checkpoint commit* (still `purgeComplete`-gated), never the introduction. Also: make **Cache 2-Bit's first gossip topic** (pure array reorder).
- **Scene-order rewiring (numbered code comments):**
  - **(a) Cadenza** — gate the "You came BACK!" on a new `cadenzaMet`; first contact plays the already-written-but-dead `CADENZA_SCENE`, then the encore.
  - **(b) The Architect's "can it READ?" payoff + finale presence** — two new terminal logs: `ARCHITECT.canRead` at the Override clear (he realizes his gloats were an instruction manual) and `ARCHITECT.finaleCut` at the reboot (a half-line cut off by the era-16 snap, explaining his absence). **[OWNER DRAFT]** Non-blocking terminal mutters, not blocking dialogs.
  - **(c) The CACHE ARG vs Crumple** — a Crumple bounce currently skips the DEAD screen the ARG needs. Fix: a bounce opens a short, redundant-coded "listening" window (`_argListenMs`) that accepts a letter key into the same buffer; a code completed outside the Hub latches `cachePending` and summons Cache on the next Hub visit.
- **Scanner value (Decision 4).** Put **real upgrades behind hidden doors**: repurpose the ROM Vault's placeholder cache into an upgrade, and add 2–3 new hash-positioned scanner pockets (each a Wilds-module-class upgrade). Non-scripted scanner doors are *already* hash-randomized in position, so a blind gear-3 ram at the wrong cell already hits solid wall and dies — Decision 4's "randomized position" is already true for these. Add a **"sweep reveals what's beyond"** second read so the verb does something in every ordinary room (category-only peek at the neighbor: upgrade / lore / cache / hazard).

### B. Hydratia — the persistence character  *(design-hydratia.md)*

One entity, three faces (confirmed single-sourced): the shy daemon you catch, the Localhost save-vendor, and the death-receipt voice.

- **The catch-on-reload.** Once you've saved at least once, the START screen gains a shy mote that flickers at the edge and bolts. Reload within ~10s and she's closer; four fast reloads and she's catchable (Space to reach her). Reuses the **existing title-cameo scaffolding** (Cache/Cadenza already walk on at boot) and `Date.now()` + three localStorage keys. Silent (Decision 3), §2.6-legible (edge distance + `TRACE n/4` pip + tick bar), never holds the file menu hostage. Catching relocates her to Localhost. **[OWNER DRAFT: one catch dialog.]**
- **Save upgrades.** She sells the **autosave machinery the game lacks today** (currently the only disk write is manual pause→S). Cache = manual, named commit to your FILE; Hydratia = continuous automatic durability to a *separate* `-auto` buffer (disjoint keys, never clobbers your file; opt-in "Warm Restore" on boot). Three items: **Auto-Commit** (on safe-zone entry, 20), **Last Breath** (autosave the instant before death wipes the run — saves progress, never Data, 25), **Frequent Commit** (every room-cross, 30).
- **The receipt.** A "RETAINED" panel (breached walls / modules / upgrades) on the DEAD overlay and PAUSE menu — the game already keeps all of this; the receipt just makes Decision 1's kept-half *visible*. Framed as Hydratia's held ledger.

### C. The compounding economy — Quantcy + Refugee Mines  *(design-economy.md)*

Two income engines sharing **one risk model**: off-body reserve → collect as `dataMotes` → carry home → **death wipes only what's on your body**. This is how compounding coexists with wealth-as-body and full-wipe-on-death.

- **Quantcy** ("it's a family name") — active lump **investment** in a **Wilds** sector (placement *is* the risk). Deposit by shedding body Data (you shrink, you lose breach gear); principal compounds ~3%/sector in his vault (off-body, death-proof); to use it you **withdraw** → motes at his vault → carry the haul home (a "withdrawal run" — mortal the instant it's on your back). Caps force periodic runs so it never idles into infinity.
- **Refugee Data Mines** — Localhost **starts empty**. Refugees are found in the Wilds; carry one home (reuse the 2-Bit tail-rider mechanic) and choose at intake: **free them** (they become citizens; boosts Quantcy's cap/rate + shop discounts) **or the Data Mines** (passive drip ~0.1 Data/s per miner, more miners unlock gated upgrades, dark tally). The **refugee is the single moral lever** — you can't max both engines, and the Freed/Mined tally feeds the (unbuilt) A-Dark-Room ending.
- **Crumple becomes an economic upgrade**, not just survival: it turns a fatal carry-run loss into a 10/6/3 trim.
- Every route from reserve → *usable* wealth passes through your body, so `maxGear = floor(score/10)` still governs map access — income compounds, but the moment of use is always Snake-length and always mortal.

### D. Presentation & cleanup  *(design-presentation.md)*

- **Dev button** removed from `index.html`; **the `P` hotkey is lifted out of the button's guard** so it keeps working (trap: deleting only the button silently kills P too). Ships-removed later.
- **Gear meter visible the moment driving is granted** (Decision 5 / §2.6) — 2-Bit fits the gauge when he hooks your tail, instead of hiding a *lethal* readout behind the optional `{2,2}` pickup (repurpose that pickup to a "redline" enhancement). Add a 1-tick cooldown so a double-tap can't jump two gears unseen.
- **Text pacing** — Architect logs already freeze the sim (good); the bug is they *release on a 1000ms timer* with no confirmation. Fix: release on **Space** with a visible "▸ PRESS SPACE" cue (matches the dialog box). Trim the 5-log eastward-corridor narration to 2; **keep the two breach-teaching leaks** (`maxGear`, `subSmash`/`wallBreak`) untouched.
- **Death messages** — add a second, *helpful* channel: a **Hydratia receipt + cause-keyed coaching hint** on the DEAD overlay (the Architect keeps gloating in the terminal — two voices, two jobs). Cause hints keyed off the `cause` already passed to `die()`; escalate by a per-cause tally.
- **Leave alone:** the 2-Bit mass joke; the tab-title vs `0r0b0r0u5` placeholder (flagged, not changed).

---

## 4. Conflicts & merges the reconciliation resolved

- **Duplicated death receipt (the one true double-count).** Hydratia §C and Presentation §4 both add a "what persisted" panel to the same DEAD block. **Merge into one:** Presentation's cause-hint + escalation is the richer spec; fold Hydratia's concrete counts in as the itemized variant. One `state.deathReceipt`, one `countMods()` helper (both pieces asked for that refactor — do it once).
- **"Localhost starts empty" vs its 5 citizens.** Accept the empty town (it's the funnel for the refugee economy). At t=0 Localhost = **signpost + 2-Bit only**; freed refugees repopulate it; Hydratia's stall appears post-catch. **This creates the one real open decision — see §6, G1.**
- **`purgeComplete` reworked by two structure pieces.** Land the `ascentArmed` split *before* the `talkToCacheHome` reorder.
- **Hydratia single-sourced.** Confirmed one entity across all three pieces (daemon = catch = save-vendor = receipt voice). The one copy nuance: she keeps a shadow copy the Kernel can't reach, but *can't cross the breach with your live body* (why manual Save stays mandatory) — complementary, not contradictory.
- **One coordinated `unlocked`/serialize pass** for all new flags (Economy 7, Hydratia 4, Structure 3) with safe `|| false`/`|| 0` defaults, so old saves load clean and four merge-conflicts become one edit.

---

## 5. The single build order (dependency-ordered)

Legend: **[M]** = mechanical/safe · **[D]** = needs owner draft lines · **[?]** = gated on an owner decision in §6.
**STATUS (sprint 2): ALL ELEVEN STEPS ARE BUILT.** Every [D] item shipped with placeholder lines explicitly marked DRAFT in `dialogue.js` for the owner's punch-up. 302 tests passing; nothing committed.

1. ✅ **Canon retcon** — refreshd→Hydratia everywhere; tick/heartbeat lore cut (engine move-tick untouched); Glitch origin = the anomaly's feeding, observed. design_doc + audio-demos README updated.
2. ✅ **`unlocked` flag pass** — all sprint flags, safe defaults (auto-serialized).
3. ✅ **`ascentArmed` / Motion-Carried retiming** — midpoint climb live; +4 tests.
4. ✅ **`talkToCacheHome` reorder + Cache-first gossip** — first meeting unblockable; +2 tests.
5. ✅ **Scene-order** — `cadenzaMet` first contact; `canRead` fires at the Override clear; `finaleCut` at the reboot; bounce-ARG listen window + `cachePending` latch.
6. ✅ **Presentation** — dev button gone (P kept); gear meter with driving + 1-step/tick cap; the terminal RELEASE LATCH (a finished log waits for Space behind a `>> SPACE` cue; guide logs 5→2; motionCarried+drift merged into one Space).
7. ✅ **Scanner value** — pockets {0,5} & {8,-5}; ROM Vault carries Crumple II; {2,2}→Redline (numeric limit readout); the BEYOND read (sweep any wall → category tag of the next room).
8. ✅ **Economy funnel** — Localhost starts empty (signpost carries the leads); 5 refugee rooms; tail-carry with protected passenger seats; COMMONS/MINE intake; freed citizens repopulate.
9. ✅ **Hydratia** — catch-on-reload (4 quick boots; the '11,2' frag is the planted clue); Localhost stall selling Auto-Commit / Last Breath / Frequent Commit; per-file auto-buffer + [R] Warm Restore.
10. ✅ **Quantcy + Mines** — deposit-by-shedding, 3%/sector compounding (+0.5pp per freed refugee), vault-full forcing withdrawal runs; mine drip with Deep Vein/Refinery gates and 2-Bit's mine-gated Compression II.
11. ✅ **Merged death receipt** — Hydratia's DEAD-overlay reassurance + cause-keyed coaching (tiered by repeat cause), PAUSE `RETAINED` readout, one `countMods()`.

---

## 6. Decisions still needed from you

**G1 — RESOLVED (owner, this pass).** Emptying Localhost removes the 5 citizens who currently hint Cadenza / Nibble / Cache to a first-timer. **Decision: 2-Bit + the signpost carry the three leads.** The town still reads as empty, but a new player is never left without a direction. Implementation: fold the Cadenza / Nibble / Cache leads into `TWO_BIT.gossip` (which already drip-feeds one topic per shop visit, and whose Cache topic is moving to index 0 in step 4) and into the Localhost signpost copy; the `LOCALHOST_CITIZENS` lines are then retired or recycled onto Wilds refugees. All replacement copy is **[OWNER DRAFT]**.

**Smaller forks (each has a recommended default in the design docs — skim and veto):**
- ROM Vault content: an interim upgrade now, **or** reserve it for the future Corrupted Save File / Trading Sequence it's earmarked for? *(rec: give it an interim upgrade; the Vault otherwise holds only a manifest)*
- Which upgrades go behind the new scanner pockets; "beyond" peek shows category-only vs exact contents *(rec: category-only)*.
- `ascentArmed` on any Localhost entry vs require `dennyMet` first *(rec: require it, so the rematch tone is earned)*.
- Refugee mining permanent vs reversible *(rec: permanent — stronger moral weight)*; free-perks buff the mine or keep the engines cleanly opposed *(rec: opposed)*.
- Hydratia: stage-4 auto-seize vs passive prompt *(rec: auto-seize once)*; reload window 10s vs 15s; receipt always-on vs post-catch reveal *(rec: numbers always, attribution post-catch)*.
- `{2,2}` module: delete vs repurpose to a "redline" readout *(rec: repurpose)*.
- Architect guide logs 5→2 vs keep 3 *(rec: →2)*.
- Persist a lifetime death counter, or session-only escalation *(rec: session-only to start; add persistence later if wanted)*.

**Deferred (Act II):** the exact Freed/Mined ending thresholds.

---

## 7. What will reach you as DRAFT (per the standing rule)

Every line below comes to you as a placeholder to punch up; I only wire the structure:
- The Glitch-origin rewrite (ARCHITECT.seedGlitches, lore frag 4,-3) + the tick-cut replacements (Cache breach line, lore frag 11,2, Booth log).
- `ARCHITECT.canRead` + `ARCHITECT.finaleCut`.
- Hydratia's catch dialog, stall barker, and the death receipt + cause-hint lines.
- Quantcy's bank lines + the refugee intake Free/Mine choice + refugee barks.
- The one 2-Bit tutorial clause naming the new gauge; any Denny/Gate rematch intensity tweak.
