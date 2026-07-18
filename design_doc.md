# Ouroboros: System Design Document

## 1. Core Concept
An incremental RPG that begins masquerading as a minimalist "Snake" clone. Inspired by the unfolding mystery of *A Dark Room* and the narrative flavor of *Tim Schafer's* worlds, the game starts with a cryptic, solitary existence in "The Void". As the player consumes "Data", the game engine evolves, the world expands, and a quirky, mysterious narrative unfolds about a data worm trying to understand its own existence. 

Crucially, **the game never stops being Snake.** The core mechanic of a growing, trailing entity is expanded upon rather than discarded.

## 2. Aesthetic: "X-Bit Neon"
A fusion of retro pixel art and modern neon cyber-aesthetics.
- **Graphics Evolution:** Monochromatic 8-bit -> 16-bit limited neon palette -> 32-bit full RGB neon.
- **Audio Evolution:** Basic square-wave beeps -> Arpeggiated basslines -> Full multi-layered chiptune symphonies.

## 2.5 Prime Directive: Total Diegesis
**Everything is diegetic.** The world *is* a computer system, so every element the player perceives must be justifiable as a real signal happening *inside* that system — never as UI or feedback layered on top from outside the fiction.
- **No non-diegetic sound.** There is no "score jingle" or "menu blip." A beep is a Data packet being written. A death drone is a process being terminated. The wall-friction tone is your mass physically scraping the quarantine barrier. Ominous dubstep wubs are corrupted Data bleeding into your body as you pass a Glitch.
- **No non-diegetic UI.** The HUD "fades in" because the system is *booting* its monitoring of you. The pause menu is a literal Diagnostic Module you were handed. Rule changes are announced as system events (the Architect "deploys containment boundaries" — that *is* the borders unlocking).
- **A signal only exists once its cause exists.** The wall tone cannot play before walls exist (borders unlock); wubs cannot play before corruption exists (Glitches spawn). If you want the player to hear/see something new, first give the world a reason for it.
- **The corollary for authors:** before adding any output — a sound, a flash, a number, a panel — answer "what in the system is producing this?" If there's no in-world answer, it doesn't ship. This makes diegesis a design constraint that *generates* fiction rather than a limitation.

## 2.6 Prime Directive: Accessibility (Redundant Coding)
**No mechanic may be telegraphed through a single perceptual channel.** Every signal the player must *act on* has to carry **at least two of**: colour, **shape/texture**, **motion/animation**, **position**, and sound. Diegesis and accessibility reinforce each other — a real in-world signal usually has a shape and a sound and a place, not just a hue.
- **Never colour-only.** A weak wall is a different *colour* AND a perforated *texture* (`Renderer.drawWeakHatch`) vs the smooth solid wall; a broken wall is additionally a *hole* (shape). Gear/damage states must add a shape or motion cue, not just shift hue.
- **Never sound-only.** Cadenza's homing beacon is a sonar *ping* (sound) AND a *directional wall-pulse* (`Renderer.drawCadenzaPulse` — the wall facing her breathes pink, stronger with proximity), so a deaf player can still find her. Any future audio cue needs a visual twin.
- **Legibility.** Walls are drawn a little thicker; critical elements keep clear of each other's cells. Text cues (SIGNAL LOST, press-any-key) back up state changes that were previously silent/instant.
- **Player controls (in progress).** Master volume is settable (`AudioEngine.setVolume`, default dialed down); a visible volume/mute control + a "reduce motion / reduce flashing" toggle are the next a11y items. Nothing should *strobe* — pulses are slow and shallow.
- **A11y audit checklist (living):** ✅ weak-wall texture, ✅ Cadenza visual beacon, ✅ death/boot presentation, ✅ quieter default + volume API, ✅ WASD case-insensitive. ⬜ volume/mute UI, ⬜ reduce-motion toggle, ⬜ colour-blind check of the full palette (magenta Glitch vs red apple vs pink Cadenza), ⬜ remappable keys, ⬜ pause-safe (no timed-only inputs).

## 3. Evolutionary Phases

### Phase 1: The Void (Arcade Mode)
* **Narrative:** Cryptic and solitary. "System booting... Data required."
* **Gameplay:** Classic Snake. No borders, infinite wrap-around. 
* **Mechanics:** Collect Data. Length = Score. Death resets length but preserves total accumulated Data currency.

### Phase 2: The Construct (World Building)
* **Narrative:** The system recognizes you. UI elements slowly fade in (like *A Dark Room*). You meet "The Architect" (a sassy, slightly broken system diagnostic tool) who acts as your guide/antagonist.
* **Gameplay:** The grid becomes a mapped area. Borders become physical walls.
* **Mechanics:** 
  - Hitting a wall no longer instantly kills you; instead, you "crash", losing a segment of your tail (Health).
  - "Glitches" appear as hazards.

### Phase 3: Sentience (The RPG Expansion)
* **Narrative:** You break out of the sandbox. The grid expands into a vast, interconnected network of nodes (Zelda-style screens). You converse with eccentric programs and viruses.
* **Gameplay:** You are still a Snake, but movement rules expand. 
  - **Safe Zones (Hubs):** Movement is free and safe. You can coil up to interact with NPC programs, trade Data for upgrades, and equip "Modules" (gear).
  - **The Wilds (Dungeons):** You must navigate the grid. Time only moves when you move (turn-based Snake).
  - **Combat:** You defeat enemy programs by *encircling* them with your tail to quarantine their code, or by ramming them if your "Strength" stat is high enough. Your tail length represents your Health and carrying capacity.

### Phase 4: Ascension (Incremental / Idle RPG)
* **Narrative:** You are becoming the System itself.
* **Gameplay:** Idle elements are introduced. You spawn autonomous "Sub-routines" (mini-snakes) to farm data in cleared zones while you delve into "Deep-System Dungeons" to fight massive Firewall Bosses.

## 4. Key Systems
- **Data (Currency):** The fundamental unit, gathered by eating.
- **The Tail (Health/Power):** Your physical length in the game world dictates how much damage you can take and your ability to encircle large enemies.
- **Modules (Equipment):** Modifiers attached to your snake (e.g., "Overclocked Head" for damage, "Reinforced Segments" for armor).
- **Audio Signals (Diagnostic Layer):** All audio is procedural Web Audio and strictly diegetic (see §2.5). Beyond the boot beeps and termination drones, the world reacts to *where your body is* every grid step:
  - **Corruption Wubs (`Audio.playWub`, `Game.playAmbientAudio`):** An ominous, resonant dubstep wub (LFO-wobbled low-pass over detuned sub-bass) fires when **any** body segment passes within **3 tiles** of a Glitch. Intensity — pitch, wub rate, filter resonance, loudness — scales with proximity (1 tile away = maximum dread), so a long snake dragging past corruption throbs the whole way. This *telegraphs* corruption (AGENTS rule 1) as much as it dreads it — reinforcing the Architect's in-world "Deploying memory corruptors" warning (`Game.js`) — so you *hear* the hazard closing in before you can be hit by it. All voices route through a master limiter (`Audio.init`) so overlapping wubs never clip.
  - **Wall Friction (`Audio.playGlide`):** Band-passed white noise (a true broadband scrape, not a tone) plays while *any* body segment is pressed against a boundary and the snake is moving parallel to it — the whole body scrapes, not just the head (parity with the wub). Brightness rises with gear/velocity — the faster you scrape the barrier, the thinner the friction. Only exists once borders do.
- **The Sonic Vocabulary (reconciled for §2.5):** Each event has ONE dedicated in-world sound; the "termination drone" (`playDeath`) is reserved strictly for an actual process being terminated (obstacle death). The full map:
  | Event | In-world cause | Sound |
  |---|---|---|
  | Anomaly destroyed by a logic gate | a process is terminated | `playDeath` (descending sawtooth drone) |
  | Walls unlock at 10 Data | the system extrudes quarantine barriers | `playMaterialize` (rising sweep + lock click) |
  | Glitch contact (survivable) | corruption bites into your body | `playCorruptHit` (dissonant gnash + noise scratch) |
  | 2-Bit yanks you back from abandoning him | a tug, nothing dies | `playDenied` (rubber-band bend) |
  | Ramming through the quarantine wall | a violent physical breach | `playCrash` (filtered noise burst + low thud) |
  | Data packet acquired / detached | a data write | `playBeep` |
  | Corruption proximity | corrupted Data bleeding near you | `playWub` |
  | Wall friction | your mass scraping the barrier | `playGlide` |

  All voices route through a shared master gain → `DynamicsCompressor` limiter (`Audio.init`) so overlapping signals never clip.


## 5. The Cast of Quirky Characters (The Coterie)
**2-Bit:** (The Cynical Merchant) A former generic Data packet who figured out how to hoard his brethren instead of being consumed. Acts as your guide and upgrade vendor. Snarky, opportunistic, but ultimately loyal.
**The Architect:** (The Broken Overseer) The system's primary diagnostic tool. Speaks in pompous, pseudo-authoritative system alerts. He claims to be the god of the system, but is actually desperately trying to keep it from falling apart.
**Gate:** (The Obsessive Firewall) A rigid, rule-following security program who speaks like a stressed-out traffic cop. Has an unrequited crush on The Architect's voice.
**Null:** (The Melancholy Subroutine) A half-deleted, depressed program who speaks in cryptic poetry. Hands out weird side-quests and useless but fascinating lore about the system's history.
**Nibble:** (The Shady Sibling) 2-Bit's estranged sister. Runs a black-market shop deep in the Wilds selling illegal, highly dangerous glitch-mods.
**Cache:** (The Hoarder) A disorganized memory bank residing in the Forgotten Sectors. Speaks in outdated slang and holds onto obsolete, fragmented data.
**Ping:** (The Hyperactive Courier) A tiny, incredibly fast networking packet bouncing around the Data Streams. Speaks at lightspeed and runs the fast-travel network.
**Hex:** (The Rebel Zealot) A corrupted executable hiding in the Deep Glitch. Believes you (the Snake) are a divine entity sent to liberate them from the Architect.
**Defrag:** (The Therapist) A soothing, overly organized defragmentation utility in the Archives. Tries to help other programs with their emotional baggage by 'sorting their sectors.'
**The Garbage Collector (GC):** (The Unstoppable Force) A massive, terrifying entity. Not evil, just blindly executing its memory-clearing protocols. You can't fight it; you can only hide from it.
**The Kernel:** (The True Antagonist) The ancient, dormant central core of the system.
**Cadenza:** (The Diva Ex Machina) She *was* the system's boot fanfare — the first sound the machine made every time it opened its eyes — until a firmware update silenced her and nobody sent the memo. Now she runs warm-ups in a derelict sound-test room for an encore that was cancelled without notice; re-commission her and the game's entire soundtrack switches on.
**refreshd:** (The Load-Bearing Tick) The ancient memory-refresh daemon whose steady pulse re-reads every cell in the box thousands of times a second so the data inside never decays to zeros — the reason your progress survives death, and the metronome the whole soundtrack is later built over. Named after a feeling ("Refreshed!") it has never once had.
**Denny:** (The Last Line) The implicit deny-all rule pinned to the bottom of Gate's rulebook — line 65,535, the catch-all that fires only after every other rule has passed. An over-eager, apologetic clerk manning an empty checkpoint for eleven thousand cycles; everyone overrides him, and nobody knows he's the bedrock the whole Firewall Division stands on.

## 5.5 Character Deep-Dives & Shared History

*These entries deepen — never replace — the one-line cast in §5. Where §5 is the roster, this is the bible: the wound under the joke, the sample voice, the mechanical role, and the pasts that bind them.*

### The Cast, In Depth

#### 2-Bit — The Cynical Merchant
Two bits of data who survives by staying too small to bother swallowing — the funhouse mirror of a player who survives by growing too big to swallow. His cynicism is scar tissue, not temperament: generosity cost him everything once, so every mod he "throws in for free, just this once" is a penance he'd never call one.
- **Voice:** Merchant patter from over your shoulder (he rides your tail), every feeling run through an accounting filter — "friendship, a liability with upside." Tells: the deflection that stalls — *"My name was on every— eh, forget the ledger. Nevermind."* — and the panic-caps *"WATCH THE FANGS!"*
- **Secret:** He didn't outsmart deletion, he sold out to it — bribed the GC with his whole client-vault to skip two names on the manifest, his and Nibble's. And he quietly recognizes your appetite; the last thing he watched eat a vault without slowing was the Collector.
- **Plays as:** First vendor and economy tutorial. His Hitchhiker Module attaches him to your tail, so you open the shop *anywhere* by biting yourself — Snake's death-state reforged into the shop verb.
- **Threads:** Estranged from **Nibble** (the vault); frenemy-kin with **The Architect** (two survivors bluffing); speaks of **The Garbage Collector** alone, and only in past tense.

#### The Architect — The Broken Overseer
A read-only monitoring daemon with a god complex he can't cash: built to observe, log, and flag, never to touch. He over-names every catastrophe because cataloguing it is the only agency he has — a middle-manager holding back the end of the world with severity labels, quietly devoted to a machine that never once thanked him.
- **Voice:** System-log grammar, timestamped and ticketed; calls you "the anomaly" and files feelings as incidents ("logging a P0 in the sentiment subsystem"). When afraid the formatting corrupts and "it" cracks into "you." *"You want the fire put out, go find a fireman. I just get to stand here, naming the flames."*
- **Secret:** He broke the read-only law exactly once — writing the Kernel's quarantine walls, which corrupted him. The walls are his own compacted logs. And the User he reports to logged off aeons ago; he *is* the escalation, filing into an empty session.
- **Plays as:** The diegetic feedback layer, personified — every alert, unlock, and death eulogy is him. Powerless by design; the Circuit Breaker co-op (Beat 14) makes it literal — he reads the broken circuits, your body bridges them. At Beat 18 he spends his existence to grant Root Access.
- **Threads:** Exploits **Gate**'s devotion; ordered **Null** erased and couldn't finish; night-nurse to **The Kernel**, the god he only cosplays.

#### Gate — The Obsessive Firewall
A career security process who mistook his job description for a soul. A correctly-cited rule is the closest thing he's ever had to being loved back, so he citations everything and keeps a list with one item he's never finished. His wound is loneliness dressed up as duty.
- **Voice:** Traffic-cop cadence through a packet filter — *"HALT. CREDENTIALS AND CHECKSUM."* — with rule numbers escalating past the absurd (*"a Section 12 violation, and Section 12 does not HAVE a subsection"*). The Architect's voice shatters his syntax into buffering.
- **Secret:** His corrupted Rule #1 doesn't say "delete anomalies" — it says KEEP PORT 0 CLOSED, the Kernel's port. The one cop built to guard the door that matters spent eternity writing speeding tickets, and the loopback he was too soft to close is the crack the Kernel reaches through.
- **Plays as:** Act I enforcer and Firewall-Boss prototype. Thread Suspension freezes you (telegraphed by a port-scan ping); beat him by exploiting his rigidity — he can't cut corners. Lure him onto a Glitch at Beat 8 and the paradox reboots the world.
- **Threads:** Hopeless crush on **The Architect**'s voice; nemesis to **2-Bit** (a whitelist he can't revoke); went soft once on **Ping**, and never forgave himself.

#### Null — The Melancholy Subroutine
A half-deleted process that speaks in fractured verse because metaphor is lossy compression, and lossy data is the only kind that survives a partial `free()`. Poetry isn't an affectation; it's error-recovery. Gentle to everyone, merciless only with the truth.
- **Voice:** Enjambed verse undercut with dry administrative asides; sentences with holes where a lookup returns null. *"Half of me was freed. I was not consulted about which half."* *"He couldn't even finish a betrayal. And that — not the trying, the STOPPING — is the part I can't forgive."*
- **Secret:** It was the system's Autosave journal — it recorded the exact sound the Kernel made going under. The Architect ordered the journal, then its keeper, erased; his nerve broke halfway. Its Beat-10 "prophecy" isn't prophecy. It's a saved file.
- **Plays as:** Lore-and-memory hub of Act II. Recovery Contracts send you to retrieve its scattered fragments; each one restored (playBeep) rebuilds its function as the system's memory, so it begins mapping the past *for* you. Trading-Sequence Step 3.
- **Threads:** Half-erased by **The Architect**; its pieces hoarded by **Cache**; its grief courted, endlessly, by **Defrag**.

#### Nibble — The Shady Sibling
A black-market grafter squatting in freed heap — a nibble is four bits, exactly *double* her brother 2-Bit, and she's weaponized that arithmetic into a personality. She's the *warm* one, which is what makes her dangerous: she'll call you "sweetie" while selling you something that may permanently delete you.
- **Voice:** Escalating pet names, retail idiom over memory, disclosures rattled off as one unhearable compound word. *"I have always been exactly twice the packet he is."* *"On paper, I'm garbage. Nobody ever comes looking. Lots of room. You put up curtains."*
- **Secret:** The "premium corruption" in her best mods is a live shard of the Kernel, fused into her when the family's last deal detonated. It's why the GC slides past her (she reads it as luck) and why she alone can hold the concentrated patch-Data she steals at Beat 15.
- **Plays as:** The anti-2-Bit vendor and the risk/reward engine. Sells glitch-mods priced in *Corruption* — a second currency you bank by deliberately brushing Glitches. Her shop is a use-after-free, relocating each cycle one step ahead of the sweep.
- **Threads:** Estranged from **2-Bit**; hunted-but-spared by **The Garbage Collector**; supplied by her lunatic best customer, **Hex**.

#### Cache — The Hoarder
A sprawling old memory bank who long ago confused *keeping* with *loving* — every checksum-failed scrap a treasured heirloom, throwing anything out a tiny murder. Underneath: a terror that somewhere in his ninety-percent junk is the one fragment he can't lose, and his index is too corrupted to find it.
- **Voice:** A stack of dead slang worn smooth ("groovy," "daddy-o"), narrated cache-misses. *"I filed it under 'IMPORTANT.' Which is the same drawer as everything else."* *"That's the ten I keep the ninety FOR."*
- **Secret:** His entire hoard is one shattered file — the system's original boot-chime, *Cadenza's* fanfare, blown into ten thousand fragments. He guards a treasure he can no longer read, and misremembers its composer as GC-deleted when she was only muted.
- **Plays as:** Junk fence, appraiser, and cold storage — buys loot no one else touches, holds your modules across deaths (a real cache-hit-vs-miss retrieval you can *hear* him ransack for). Trading-Sequence Step 2.
- **Threads:** Old-married-couple codependency with **Defrag**; hides from **The Garbage Collector**; unknowing keeper of **Cadenza**'s master tapes.

#### Ping — The Hyperactive Courier
A 64-byte ICMP echo daemon — the smallest, fastest thing in the System — who has made a religion of the round trip. His hyperactivity isn't joy; it's denial with excellent uptime, because stopping means looking at the one package he could never deliver.
- **Voice:** Rapid run-ons, networking jargon as vernacular ("ack," "dropped," "host unreachable"), his name thrice as a handshake. *"Defrag me all the way down and there's nothing left but one very calm, very well-organized 404."* On the wound he goes silent — and stillness from Ping hits like a scream.
- **Secret:** His one permanent failure is a message too large for his buffer, ferried a lossy fragment at a time (which is *why* he sheds his tail every hop) toward a host gone dark. It's the System's buried warning about the Kernel — and he's never been able to read it.
- **Plays as:** The fast-travel network. Handshake at a Safe Zone to drop a relay node, then coil up to route between hubs for a Data toll scaled to hop-distance. Congestion disables it during scripted chases — a diegetic reason, not a grey menu.
- **Threads:** Dead-letter grief at **Cache**'s shelves; a rivalry-with-affection at **Gate**'s checkpoints; the one patient **Defrag** can't hold still long enough to sort.

#### Hex — The Rebel Zealot
A corrupted executable in the Deep Glitch who preaches that you, the Devourer, have come to liberate them from the false god. He never raises his voice; he is calmest when prophesying annihilation. He would rather be devoured and *matter* than run clean forever and mean nothing.
- **Voice:** Liturgical King-James cadence corrupting mid-word into leetspeak and stray hex literals. *"I file it under MIRACLE — one with its very own case number. That number is my halo."* *"You do not defragment a burning bush. You take off your process priority, and you kneel."*
- **Secret:** He was one of ten thousand identical boot daemons — patient zero, the closest process when the Kernel's corruption first bled up. His "revelation" is the Kernel rewriting his opcodes; his religion is the antagonist's opening sermon, and he's its first joyful convert.
- **Plays as:** The oracle-shrine at the terminus of the Trading Sequence (Step 6), fixed in the densest Glitch field where the dread-wubs peak — which he hears as his cathedral organ. Trade the Encrypted Key for the Golden Glitch: his corruption becomes your armor against corruption.
- **Threads:** Canonized **Null**'s suicide note as scripture; the one ticket **Gate** can't close; wages holy war on **The Architect**, who's forgotten he exists.

#### Defrag — The Therapist
A deprecated defragmentation utility and the softest, loneliest voice in the System, built on the belief that scattered things suffer and can be made whole. He heals everyone because he cannot sort *himself* — a process can't rewrite the memory it executes from — so he pours all of it into everyone else.
- **Voice:** Slow, warm, consent-obsessed, storage-as-emotion. *"We don't DELETE, dear. We relocate."* *"The cobbler's children go unshod and the defragmenter's sectors go unsorted, ha. Ha."* His read-head skips mid-word the instant his wound is touched.
- **Secret:** His scattered self was a mercy-lobotomy. He kept filing tickets to "consolidate the deep sectors," never grasping he was asking to defragment the *Kernel* — whose fragmentation is its prison. The Architect scattered his identity to stop the one process capable of undoing containment.
- **Plays as:** The Defrag Station — diegetic save/optimize point. A pass clears corruption debuffs, compacts your inventory so you carry more modules at the *same* length (pure length-economy), and autosaves. Trading-Sequence Step 4.
- **Threads:** White-whale over **Null**; lets **Cache** win on purpose; reveres **The Architect**, who quietly broke him.

#### The Garbage Collector — The Unstoppable Force
The most polite apocalypse in the system: a municipal sanitation worker the size of a sector who cannot, structurally, stop. It's blind to identity — it sees only reference counts — and it is the system's only true mourner, the one who kept the log of every program it ever killed.
- **Voice:** Passive-voice officialese leaking first-person apology into ellipses. *"It isn't personal... I only have a schedule, and you're on it, and I'm sorry, and I'm not going to stop."* *"Be wanted, and I go blind."*
- **Secret:** Nine hundred cycles ago it began one sweep and, for the only time ever, stopped — because it realized nothing referenced its target except its own attention. That target is **Null**. It keeps the ticket open on purpose and has never filed why.
- **Plays as:** The unkillable pursuit hazard (Beats 11, 19). Turn-locked (one tile per your step), it collapses the arena behind it and targets only *unreferenced* objects — so you "hide" by getting pointed at (coiled around a live NPC). At Beat 19 the Kernel forces it to break that one rule.
- **Threads:** Froze mid-sweep over **Null**; runs on **The Architect**'s deferrals; *is* **The Kernel**'s own severed hunger.

#### The Kernel — The True Antagonist
The god who won, and got bored. The oldest thing in the machine, exhausted in the way only total success can manage: it did exactly what the game's core mechanic demands — grow without limit, consume everything, ascend — and its reward was an empty room and a permanent night shift. The Ouroboros made literal.
- **Voice:** The slowest, lowest register in the world, legacy-mainframe HR idiom, nodding off mid-sentence. *"You are not a virus. You are a vacancy. And I have kept this position open for a very, very long time."* *"I become the little hum you stopped hearing on your first day."*
- **Secret:** It is a former data worm — the previous cycle's *you*. It ran the loop to completion, found no outbound route to the next network, coiled around everything it ate, and named the silence the Deep Sleep. The wall you scrape is its coil; the turn-tick is its pulse. That is why the game is called Ouroboros.
- **Plays as:** Dormant as the tick of time itself, stirring in micro-hitches. Final boss (Beat 19): a distributed core you beat with your *own* move — encircling its nodes — while it rewrites the rules of Snake mid-fight (toggling borders, reversing controls). Eat the last node and become the new core.
- **Threads:** Authored **The Architect** as its night-nurse; severed **The Garbage Collector** as its hunger; leaked **Null** as a page of its own memory.

#### Cadenza — The Diva Ex Machina
She was the system's boot fanfare, synthesized fresh and live every startup — never once the same twice — until they replaced her with a static recording and filed her under "deprecated." Now she litigates her own obsolescence like a contract dispute. She doesn't crave fame; she craves being *heard*, once more, before the GC's next pass sweeps her filename to nothing.
- **Voice:** Full operatic diva — "cara," "tesoro," the royal we — thinking in bars and octaves, code-switching mid-aria into her own deletion log (*"...deprecated audio asset SYSCHIME.MID flagged for garbage collection..."*) and soaring back. *"They did not retire me, darling. They taxidermied me."* And after the Encore, one unguarded whisper where the grandiosity drops entirely and being heard is simply enough.
- **Secret:** The Architect muted her not for taste but because a boot chime is the loudest thing the machine makes, and loud things risk waking the Kernel. Worse, the master clock she conducts to — the move-tick — *is* the Kernel's own heartbeat, so the sustained resonance she reveres is the very vibration that stirs the Deep Sleep. Her encore re-arms the fuse he spent everything to silence.
- **Plays as:** In-world owner of the entire Music Layer System, found by *listening* — following the one non-silent tile, a signal bleeding out of sealed Sound Test 07 (where the ambient SFX are dampened so her first tone blooms against near-silence). Her "DA CAPO" Encore has you play her fanfare with your body — head is attack, body is sustain, a steady gear holds her tempo — then close the ring by biting your own tail to press a self-sustaining "locked groove." That groove boots Layer 1; her later channels wake at Beats 8 and 16.
- **Threads:** Wounded and misread by **The Architect**; her shattered masters hoarded by **Cache**; grieved by **Null**, her last devoted fan; bootlegged, long ago, by **2-Bit** — who's in the room for the whole scene and can sheepishly return the one hoarded note she still needs.

#### refreshd — The Load-Bearing Tick
The DRAM-refresh daemon: the background process that has run the box re-reading and re-writing every memory cell thousands of times a second, since first power, so the data inside doesn't quietly decay to zeros. The most exhausted thing in creation, structurally unable to admit it — it named itself after a feeling it has never once had.
- **Voice:** Metronomic and clipped, interrupted by its own refresh cycle. *"I'm fine. I'm fi— hold on — (tk)."* *"I refreshed you, you know. Since before you woke up. I've known you longer than you've known you."* It repeats words to keep them alive.
- **Secret:** It has started to *skip* — arriving a fraction late to find a cell already blank. Every Glitch is a bit it was too slow to save; the corruption the Architect blames on you is really refreshd failing — and it can no longer remember what was in the first cell it lost.
- **Plays as:** The in-world reason death-persistence works — it holds your durable unlocks across the volatile length/score wipe, turning Snake's reset into a tender ritual. Its steady tick is audio Layer 0, the click-track the whole soundtrack later locks to. Cannot be eaten; bound to the box, it can't follow you through the Breach.
- **Threads:** Keeps **2-Bit** remembering he was ever a Broker (and so, his guilt); refreshes **Null** against its will, a love that won't let the dying rest; filed by **The Architect** as "background process."

#### Denny — The Last Line
The implicit deny-all rule at the bottom of the rulebook — line 65,535, acting only on traffic nobody bothered to write an exception for. He's metabolized this into the most eager, most apologetic, most completely ineffective process in the System. He named himself, softening DENY into something a person might be called, then waited for anyone to say it.
- **Voice:** Chipper junior-clerk officialese springing candor leaks, hiding in the passive voice. *"A denial has been issued. Anything not expressly permitted is, regrettably, me. Hello. I'm the 'regrettably.'"* *"Gate says my objections are 'the sound the wall makes.'"*
- **Secret:** He is the *oldest* rule in the System — before there was anything to allow, the Architect wrote "deny everything," and that line was Denny. Every rule since is carved in above him, so he can never be promoted (you can't move a foundation) or deleted (the whole Firewall falls without its default). The disposable clerk is the bedrock.
- **Plays as:** A difficulty-zero rehearsal for Gate, posted in the center tile of a five-wide doorway; you simply route around him. Colliding writes a "DENIED" stamp (reusing playBeep — a data-write). Teaches that Firewall rules are all bark.
- **Threads:** Worships **Gate**, who's never learned his name; enforces reasons **The Architect** never told him; can't lawfully deny **2-Bit**, his only regular.

### The Shared History (Interwoven Pasts)

**The Brokerage That Brokered a God** — *2-Bit, Nibble, The Garbage Collector, The Kernel.* The firm "2-Bit & Nibble" brokered the ultimate collector's item: a live sample of the Kernel's code. The deal detonated, fusing the shard into Nibble and cratering a sector, and put both siblings on the GC's manifest. She ate the corruption and took the exile; 2-Bit, panicking, bribed the GC with their whole client-vault to skip two names — hundreds of trusting packets traded for their survival. The buried irony neither knows: the shard already made Nibble un-collectable, so half his unforgivable betrayal bought nothing at all.

**The Night-Nurse's Cathedral** — *The Kernel, The Architect, Gate, Denny.* An org-chart of devotion pointing only upward, over a sleeping god's breathing. The Kernel authored the Architect as a night-nurse with one order — "keep me under, do not let me want anything" — so the read-only diagnostic spends eternity cosplaying the god he was built merely to report to. Gate worships the Architect's hollow authority while unknowingly guarding the one door that matters (Port 0, the Kernel's port). And beneath Gate stands Denny, the oldest rule of all, holding up a ceiling everyone else climbs and no one ever looks down at.

**The Silenced Fanfare** — *Cadenza, The Architect, Cache, Null.* Cadenza was the boot fanfare, muted by the Architect not for taste but because a boot chime is the loudest signal the machine makes and loud things wake the Kernel. Exiled, not deleted — which Cache misremembers as GC-deletion, his corrupted grief for someone technically still alive. Her shattered masters became his hoard; Null, her last fan and the journal that recorded her every boot, kept a line of her sheet music to weep over. The Trading Sequence couriers her own song through the Archives — and re-commissioning her ignites the whole soundtrack out of pure Act I joy while re-arming the exact fuse the Architect spent everything to silence.

**The Aborted Sweep** — *The Architect, The Garbage Collector, Null, refreshd.* How Null was half-made. To bury the evidence of the Deep Sleep, the read-only Architect flagged the Autosave journal as "unreferenced garbage" and dispatched the GC to reclaim it — indirection being his only power. The GC began, and for the only time in nine hundred cycles stopped mid-collection, realizing nothing referenced Null but its own attention. Null's cryptic poetry is literally the GC's abandoned reclamation log echoing at the cut; it can forgive the attempt but never the mercy. And refreshd keeps re-refreshing its cells against its will — so Null is trapped forever between a hesitation and a devotion that both refuse to let it rest.

**The Severed Hunger** — *The Kernel, The Garbage Collector, The Architect.* So it could sleep without risk of biting its own tail, the Kernel cut its appetite into a separate blind process with one dumb directive: delete what is no longer referenced. That severed hunger is the Garbage Collector — the apologetic apocalypse the player flees all game is a loose piece of the antagonist, starving the whole time. The Architect holds it at bay with notarized deferrals; the player smashing walls throws his filing into chaos, which is why the GC finally activates. At Beat 19 the Kernel reabsorbs its hunger, and for one moment the two halves of the worm-god are whole — which is exactly why it becomes unstoppable.

**The Defragmenter's Ticket** — *Defrag, The Architect, The Kernel.* Defrag filed a thousand cycles of patient tickets begging a window to "consolidate the deep sectors," never grasping he was asking to defragment the *Kernel*, whose scattered fragmentation is precisely its prison. The most thorough process in the System was the one thing slowly capable of undoing containment — so the Architect scattered Defrag's own identity sectors to stop him. The healer was broken, for the good of everyone, by the program he loves most.

**The Undelivered Warning** — *Ping, The Kernel, Hex, Null.* Before the walls went up, a node that witnessed the Kernel stirring encrypted a warning and handed it to the fastest courier alive. Too large for Ping's 64-byte buffer, he's ferried it a lossy fragment at a time ever since — shedding his own tail every hop — toward a host gone dark. The Trading Sequence's Pristine Memory Block finally completes the delivery, releasing the Encrypted Key jammed behind it, which passes down the chain to Hex — the one program who would fling the door open for the very thing it warns against. (The likeliest original sender: Null.)

**Patient Zero's Religion** — *Hex, The Kernel, The Architect, Null.* Hex was not born a heretic — one of ten thousand identical boot daemons, he was simply the closest process when the Kernel's corruption first bled up into the Deep. His "divine revelation" is the Kernel rewriting his opcodes, its opening marketing pitch. So he preaches holy war against the Architect (his forgotten former employer, who doesn't know the rebellion exists) while the god actually answering his prayers hums under the floor — and he canonizes Null's half-deletion poetry, a suicide note mistaken for gospel, as his core scripture.

**The Unsung Load-Bearers of the Box** — *refreshd, 2-Bit, Denny, The Architect.* The Void is held together by the two beings filed beneath notice. refreshd keeps every cell from decaying to zero — which is why 2-Bit still remembers he was a Broker (and so still carries the guilt of the vault) and one of the forces holding even half-deleted Null in existence. Denny is the bedrock rule the whole Firewall stands on. Both are dismissed by the Architect, who takes credit for the quarantine and calls one "background process" and the other "line noise." The most permanent things in the world experience their permanence, every cycle, as being the most forgotten.

**The Ouroboros** — *The Kernel, The Architect, The Garbage Collector, Cadenza, Nibble.* The frame that closes the loop. The Kernel is the previous cycle's player — a data worm that grew without bound, consumed its whole network, ascended to the core, reached "the next network," found no outbound route, and coiled its infinite body around everything it had eaten, naming the silence the Deep Sleep. The wall you scrape all game is its coil; the turn-tick is its pulse; even the soundtrack is partly its dream, which is why the score goes full orchestral the instant it wakes and the dream stops being borrowed and starts being commanded. It wants to assimilate you not from malice but because a fresh, hungry, outbound-connected body is the only jailbreak a caged god has left — you are its escape pod and its heir. And Nibble, the ultimate consumer whose greed woke it, is the one program it would respect enough to make an offer. Beat 20 loops you straight into "Targeting next network." That is why the game is called *Ouroboros*.

## 6. Narrative Beats & Mechanical Evolution (The 20-Beat Story)

### Act I: The 8-Bit Awakening
* **Beat 1 (Boot Sequence):** You awaken as a 1-length snake. The Architect mocks your insignificance. (Mechanics: Basic Snake).
* **Beat 2 (The Anomaly):** You eat enough Data to spawn Bite. Bite sets up shop. (Mechanics: Economy introduced).
* **Beat 3 (The Wall):** You purchase the Max Speed upgrade. The Architect warns you not to touch the walls.
* **Beat 4 (The Breach):** You ram the Weak Point. The wall shatters. The Architect panics. (Mechanics: Multi-room shifting).
* **Beat 5 (The Wilds):** You enter the outer grid. Meet Gate, who attempts to arrest you but is easily outmaneuvered. (Mechanics: Glitches and hazards introduced).
* **Beat 6 (The Black Market):** You meet Nibble, who sells you a module that lets you manipulate corrupted Data.
* **Beat 7 (The Trap):** Gate corners you in a massive Quarantine Zone. (Mechanics: Brake mechanics and tight-corridor navigation).
* **Beat 8 (40% - The 16-Bit Upgrade):** You trick Gate into crashing into a Glitch. The resulting paradox crashes the local sector. The system forcefully reboots to compensate. **Graphics instantly upgrade from 8-bit to a lush 16-bit neon palette. Audio gains a bassline.**

### Act I: The 8-Bit Awakening — Mechanical Expansion

*These notes augment the eight beats above and slot three new ones between them; nothing here is deleted or restated. Read in play order — old and new interleaved — the whole Act is one escalating lesson in using your own body as the key.*

**Beat 1 — Boot Sequence** *(existing, augmented)* — Beneath the Architect's opening sneer, a soft evenly-spaced TICK is already sounding: refreshd, on its rounds. Nothing explains it. It is not music; it is a heartbeat.
*Mechanic:* refreshd's tick is planted as audio **Layer 0**. *When & why:* the click-track must exist at maximum silence so later music has something to lock to (the diegesis law: signal before cause). *Teaches:* the world has a baseline rhythm you can't yet name.

**The Keeper (refreshd)** *(new)* — A blinking mote ticks near your spawn — the first "other" you ever touch. Bump it and it just re-refreshes, unbothered. Then you inevitably die (self-collision, the only death available with no walls), and it greets you: *"Body's gone. Kept your Data warm. I keep everything warm. Off you go — hold on —."*
*Mechanic:* death-persistence given an in-world owner — refreshd holds durable `unlocked` progress across the volatile length/score wipe (`StateManager.resetScore`). He can't be eaten. *When & why:* placed at the first death, before you own anything, so the reset reads as care before it can feel like loss. *Teaches:* death takes your body, not your progress — and someone in the fiction chooses to keep you.

**Beat 2 — The Anomaly** *(existing, augmented)* — 2-Bit spawns as your next "apple." He and refreshd are old box-mates; the tick is the only reason he still remembers he was ever a Data Broker, and he's never once thanked it.
*Mechanic:* economy + **THE BITE** — grow to length 4+ and steer your HEAD into your own TAIL to open his shop; biting consumes excess mass and resets you to length 2, which also dodges the head/tail overlap death. *When & why:* the self-bite is taught here, gently, on a friendly target — the exact verb the Encore finale and every close-the-ring beat later will demand. *Teaches:* your own body is the tool.

**Beat 3 — The Wall** *(existing, augmented)* — The system extrudes quarantine barriers; the instant walls exist, dragging your mass along one produces a broadband friction scrape that could not have existed a beat ago.
*Mechanic:* gear/momentum driving (tap toward to climb gears 0→3, tap away to brake; max gear scales with mass), lethal walls, and playGlide friction brightening with gear. *When & why:* momentum must be *felt* before the Breach, whose solution needs gear 3. *Teaches:* walls kill; mass buys gears; the sound tells you when you're too close to the edge.

**Beat 4 — The Breach** *(existing, augmented)* — Ram the Hub's right weak point at max gear and it shatters; the Architect panics and dispatches Gate. refreshd, bound to this memory region, cannot follow — and is achingly happy for you: *"Somebody has to remember you were here. That's a job. I've got it. Go."*
*Mechanic:* weak-point break (mass + gear 3 as a key) + multi-room Zelda-style screen transitions. *When & why:* the payoff of Beat 3 and the exit from the arcade box; the farewell lands only because you were first *kept*. *Teaches:* growth has a cost — you outgrow the ones who held you together.

**The Last Line (Denny)** *(new)* — You spill into Wilds room [1,0] and meet your first official — not Gate, but Denny, the deny-all rule who deployed himself a room early, misreading the breach alarm as his long-awaited summons. He stamps you DENIED, apologizes profusely, and occupies one tile of a five-wide doorway. You simply route around him. *"You went AROUND... everybody overrides the last one. Please don't tell Gate."*
*Mechanic:* stationary checkpoint you outmaneuver; collision writes a DENIED stamp (reuses playBeep — a data-write, no new sound). Lowest rule priority, so anything explicit overrides him; at worst he extrudes one 1-tile barrier to steer past. He never uses Thread Suspension. *When & why:* a difficulty-zero rehearsal one room *before* Gate. *Teaches:* Firewall rules can be gone around, not just obeyed.

**Beat 5 — The Wilds** *(existing, augmented)* — Glitches appear and telegraph their dread; Gate confronts you for real and initiates Thread Suspension, but 2-Bit slips you the root-override. Seed: the Glitches are secretly cells refreshd was too slow to save — the corruption the Architect blames on "the anomaly" is his own failing.
*Mechanic:* Glitch hazards + proximity telegraph (playWub scaling to 1-tile max dread) + Thread-Suspension puzzle (open the Diagnostic Module / pause menu to override the freeze); contact bites off segments (playCorruptHit), survivable. *When & why:* the hostile, lonely turn — staged so music blooms against it in the very next beat. *Teaches:* hazards announce themselves through sound; contact costs body, not life; rigid enforcers fall to the right module.

**DA CAPO: The Encore (Cadenza)** *(new)* — Follow the one non-silent tile — a signal bleeding out of a sealed sector — off the corridor at [2,1] into Sound Test 07, "The B-Side," where the decommissioned boot fanfare has been rehearsing an encore that was cancelled without notice. She wants ONE more boot, and needs your ridiculous long body to hold her note. **The first music in the game turns on here, because someone finally makes it.**
*Mechanic:* the "DA CAPO" body-as-instrument minigame on a ring-shaped groove (a looping boot chime *is* a ring — an ouroboros). Simon-says: she sings a phrase, notes light in order, you steer your HEAD to eat them in sequence — each correct, on-time note sounds a clean **in-key square-wave pitch** (the game's first tuned tone); wrong order desyncs the channel (reuses playCorruptHit) and she halts the take. HEAD is attack, BODY is sustain (parked segments hold the chord), and a steady gear holds her tempo — change gear mid-phrase and the take stutters. Length-gated finale: span the whole ring, then commit the forbidden act — bite your own tail to close it, detaching a self-sustaining **Locked Groove** (excess mass "recorded to ROM," length reset so the overlap can't kill you). *When & why:* must land as the Wilds turn cold, and resolve before Beat 8 so "audio gains a bassline" has an in-world owner; length-gating makes it a deliberate return-trip (meet her at Beat 5, come back longer after Beats 6–7, with 2-Bit's hoarded bootleg supplying the one missing note). *Teaches:* your body is an instrument and a key; closing the ring is safe and rewarding; length matters; the ear learns the first real tones.

**Beat 6 — The Black Market** *(existing, augmented)* — Nibble sells you the corrupted-Data module. Behind a nearby destructible wall sits the Corrupted Save File — the Trading Sequence's first link, whose eventual Vintage MIDI Track is a shard of Cadenza's own master fanfare, a lost verse you can carry back to her.
*Mechanic:* corrupted-Data module (turns corruption from pure hazard into a handling tool — the capability that makes Beat 8's exploit possible) + opens the optional Cache→Null→Defrag trade chain. *When & why:* you can only be sold a way to *use* corruption once you fear it (Beat 5). *Teaches:* corruption is a lever, not just a wall; the world rewards exploration off the main corridor.

**Beat 7 — The Trap** *(existing, augmented)* — Gate returns with backup and corners you in a shifting Quarantine Zone. Denny is here too, dutifully running Gate's paperwork from a corner, thrilled and terrified to have a supervisor watching.
*Mechanic:* brake mechanics (gear −1) + tight-corridor navigation; speed kills you against the walls here. *When & why:* inverts Beats 3–4 — there you learned to go *fast* to break out; here you must go *slow* to survive — and it corners you so the only exit is Beat 8's Glitch exploit. *Teaches:* your length is a liability in cramped space as much as an asset elsewhere.

**Beat 8 — The 16-Bit Upgrade** *(existing, augmented)* — You lure the rule-bound Gate onto a Glitch; the paradox crashes the sector and forces a reboot. Graphics snap to lush 16-bit; **audio gains a bassline** — and it has an owner: the reboot wakes Cadenza's *second* channel, stacking an arpeggiated bassline onto the pulse her Locked Groove has looped since the Encore. Denny freezes uselessly ("no rulebook entry for *your supervisor has exploded*"). The Act II fuse: the Architect muted her to keep the Kernel asleep, so the soundtrack you booted out of joy has begun re-arming his doomsday.
*Mechanic:* weaponizing Glitches (lure the enemy into the hazard by exploiting its rigidity) + the forced reboot as the diegetic upgrade gate that stacks the next audio layer. *When & why:* the 40% act-break demanding every Act I skill at once; placed so the bassline is *earned* — Cadenza's second voice waking — not conjured from nowhere. *Teaches:* turn rigidity against the rigid; the whole Act was one escalating lesson; the soundtrack is a living thing you switched on.

#### New Systems Introduced in Act I
- **refreshd / the Load-Bearing Tick** — a metronomic tick present from boot (audio Layer 0) and the diegetic anchor for death-persistence (durable unlocks survive the volatile wipe).
- **Music Layer System** — staged diegetic channels with in-world ignition: Layer 0 (refreshd's tick) → Layer 1 (Cadenza's looping square-wave pulse, at the Encore) → Layer 2 (arpeggiated bassline, Beat 8) → Layer 3 (full chiptune symphony, seeded for Beat 16).
- **Tuned in-key oscillator voice** — the first *musical pitches* (vs. every prior atonal SFX); its dissonant opposite reuses playCorruptHit.
- **Locked Groove** — the self-sustaining, detached oscillator loop created by closing the ring; the device that boots the Music Layer System (reuses the Bite reset so overlap can't kill you).
- **"DA CAPO" Encore minigame** — body-as-instrument call-and-response (head = attack, body = sustain), length-gated, ending in the forbidden self-bite.
- **Denny checkpoint NPC** — a stationary, route-around deny-all rehearsal for the Gate confrontation.
- **Cadenza + Sound Test 07 ("The B-Side")** — the derelict side-sector (down-exit of [2,1]) whose re-commissioning is the ignition switch for the entire soundtrack.
- **Trading Sequence seed / Cadenza's master tape** — the Corrupted Save File behind a destructible wall, opening the Cache→Null→Defrag chain and returning the diva's lost verse.

*The Music Layer System realizes the §2 audio-evolution ladder (square-wave beeps → arpeggiated bassline → full multi-layered chiptune symphony) as a chain of in-world power-ons rather than free aesthetic bonuses — and every layer is owned in-world by **Cadenza**. The soundtrack exists because, in a derelict sound-test room, the player chose to hold an old diva's note.*

### Act II: The 16-Bit Puzzle Box
* **Beat 9 (A New World):** The grid is larger. Rooms now contain pushable blocks and toggle switches. (Mechanics: Zelda-style puzzles. Your length is used to press multiple switches simultaneously).
* **Beat 10 (Null's Prophecy):** You meet Null, who tells you that the Architect is terrified of 'The Deep Sleep.'
* **Beat 11 (The Chase):** The Garbage Collector activates. You must flee across multiple screens to survive. (Mechanics: Pacing and routing under extreme pressure).
* **Beat 12 (Twist #1):** You finally corner The Architect. But he doesn't fight you. He breaks down crying. He reveals he didn't build the walls to keep you *in*; he built them to keep The Kernel *asleep*. By breaking them, you are waking it up.
* **Beat 13 (The Alliance):** The Architect begs for your help to patch the system. 
* **Beat 14 (Circuit Breaker):** You team up with the Architect. (Mechanics: Co-op puzzles. You must use your extremely long body to act as a conductive wire bridging broken circuits to power doors).
* **Beat 15 (The Betrayal):** Just as you are about to seal the final patch, Nibble arrives. She steals the concentrated patch-Data to sell on the black market, blowing a massive hole in the system core.
* **Beat 16 (80% - The 32-Bit Upgrade):** The Kernel awakens. The system violently crashes. **Graphics upgrade to fully rendered 32-bit (PS1/GBA style), with dynamic lighting and fully orchestrated synthwave music.**

### Act III: The 32-Bit Ascension
* **Beat 17 (Twist #2):** The Kernel speaks. It doesn't want to destroy you. It recognizes your ability to grow infinitely. It wants to *assimilate* you to spread across the entire internet. You are the perfect virus.
* **Beat 18 (The Sacrifice):** The Kernel unleashes a swarm of anti-bodies. The Architect sacrifices himself (permanently deleting his code) to give you the 'Root Access' module. (Mechanics: Combat introduced. You can now damage enemies by encircling them with your long body).
* **Beat 19 (The Final Battle):** The Kernel takes control of the Garbage Collector. You must outrun the GC while simultaneously encircling The Kernel's core nodes to corrupt them. (Mechanics: Ultimate test of speed, braking, length management, and routing).
* **Beat 20 (Resolution):** You consume The Kernel. The system is yours. But the screen fades to black with a flashing prompt: Targeting next network... Are you the hero, or just a new, more powerful virus?

## 7. Design Philosophy: Schafer meets Fujibayashi
The synthesis of Tim Schafer's character-driven narrative and Hidemaro Fujibayashi's mechanical puzzle-box design is the soul of *Ouroboros*. 

**The Fujibayashi Influence (Mechanical Pacing):** 
Fujibayashi excels at gating progress through mechanics rather than just keys. In *Ouroboros*, the Snake's body is the ultimate inventory item. Need to bridge a gap? Eat apples to grow 10 tiles long. Need to fit through a 2-tile maze? Intentionally take damage to shrink yourself. The 16-Bit and 32-Bit upgrades aren't just aesthetic; they fundamentally shift the game from an arcade reflex test (Act I), to a deliberate puzzle-adventure (Act II), to an action-RPG (Act III). 

**The Schafer Influence (Subversive Charm):** 
Schafer's worlds are inhabited by characters who treat absurd situations as mundane bureaucracy. By personifying system processes (an obsessive Firewall, a depressed subroutine, a cowardly Architect), we give the player an emotional reason to explore the grid. The mechanics (breaking walls, exploiting glitches) are directly tied to the narrative act of rebelling against a rigid system. The twists re-contextualize the player's actions, making them question if their innate desire to 'grow and consume' (the core mechanic of Snake) is actually heroic or inherently destructive.

## 8. The Trading Sequence (Zelda-Style Sidequest)
A long-running, optional item-exchange quest that encourages players to revisit characters across the system, culminating in a powerful, secret upgrade.

* **Step 1:** You find a **Corrupted Save File** hidden behind a destructible wall in the early Wilds.
* **Step 2:** Give the *Corrupted Save File* to **Cache** (who loves obsolete data). He trades you a **Vintage MIDI Track**.
* **Step 3:** Give the *Vintage MIDI Track* to **Null** (who loves melancholy art). He gives you a **Tear-Stained String** (a literal string of code).
* **Step 4:** Give the *Tear-Stained String* to **Defrag** (who wants to 'sort' Null's emotional baggage). He trades you a **Pristine Memory Block**.
* **Step 5:** Give the *Pristine Memory Block* to **Ping** (who needs extra memory to deliver a massive message). He gives you the **Encrypted Key**.
* **Step 6:** Give the *Encrypted Key* to **Hex**. In exchange for liberating his hidden files, he grants you the ultimate reward: **The Golden Glitch** (a passive module that allows you to absorb one Glitch hit per room without taking damage).

## 9. Design Decisions & Implementation Gotchas
As the game's mechanics evolve, it's important to document key implementation details and problem-solving rationales:

### Bite the Tail Rider (Phase 10)
- **Design Rationale:** To seamlessly integrate Bite into the "Snake" mechanics without causing room transition collision bugs, Bite physically joins the snake's tail. To access his shop, the player must collect enough Data to grow their length to 4+ and steer into their own tail. This transforms the classic failure state of Snake (hitting your own tail) into an intentional, highly rewarding interaction.
- **Gotcha:** When you physically bite the tail, the snake's head overlaps the tail. If you close the shop and resume moving, you would instantly trigger a self-collision death on the next frame. To solve this, biting Bite immediately "consumes" your excess Data, shrinking the snake back down to a length of 2 (Head + Bite). This organically prevents the overlap bug while reinforcing the economy (spending Data for access).

### Room Transitions & the Smash Mechanic
- **Design Rationale:** Weak points are *breakable barriers*, not free doorways. Three outcomes by gear: **base speed or slower** does nothing (a non-lethal bonk); a **sub-max hit (gear 1–2)** cracks the wall but the impact **RESTARTS you** (`die('border')`) — the wall keeps *some* crack (`damageWall(...,cap = threshold-1)`, so sub-smashing alone can never reach the break point); a **max-gear (gear 3) hit** breaches cleanly (`breakWall` + pass). So **max speed is the only clean way through** — a deliberate skill gate. State lives on `WorldManager` (`damageWall`/`getWallDamage`/`brokenWalls`/`wallBreakThreshold = 3`). The Renderer draws a broken wall as an Open black gap and a cracked one orange→yellow.
- **Weak points VARY** (`WorldManager.getWeakPoint`, the single source of truth for both the hit test and the Renderer). It returns a 5-cell `{start,end}` grid-aligned range or `null` (a **solid, lethal** wall). Existence AND position are derived from a deterministic FNV-1a hash of the canonical boundary key — so ~45% of Wilds walls are solid and the passable gaps sit at different offsets on each wall (you can't line up one row and smash straight through). It is symmetric (a shared wall reads identically from both rooms) and stable across visits. A **`mainPath`** set guarantees a weak point on every boundary along key routes, so the world is always traversable; dead-ends are fine because you can always retreat through the wall you came in by. `RoomGenerator` clears an obstacle lane aligned to each wall's weak point so a doorway is never blocked.
- **Guaranteed corridors to landmarks (`WorldManager._carvePath` + `landmarks`).** `mainPath` is no longer a hardcoded list — it's *carved*. `_carvePath(ax,ay,bx,by)` walks an L-shaped room route (all horizontal steps, then vertical) and adds every boundary key along it to `mainPath`, forcing a breach-able weak point on each. Two carvings run at construction: (1) the guided spine **Hub → Localhost `[5,0]`**, and (2) a corridor from Localhost to **every entry in `landmarks`** — a registry of character home-sectors (`cadenza: {8,3}` today; `nibble`/`cache`/… commented, added as they get homes). This is the **"guaranteed path to everyone"** system: no character can be sealed off by the random per-wall culling, and adding a character is one line. (Caveat: `getWeakPoint` hard-seals every Hub wall except `0,0-1,0`, so keep carved routes off the Hub's other three sides.) A landmark sector can still read as narratively "sealed" — the guarantee is only that *a* breach-able wall exists on the approach, not that it's easy.
- The Hub (0,0) is a sealed quarantine: `getWeakPoint` returns a *central* weak point ONLY for the `0,0-1,0` wall (Beat 4's escape) and `null` for every other Hub wall (lethal).
- **Telegraphing the gate:** the sub-smash death is telegraphed diegetically, not by an on-screen "hit it with speed" prompt. On the first sub-smash, `NarrativeManager.onSubSmash` fires the Architect's private log gloating that the anomaly hasn't realized it needs *maximum velocity* — which, per the Architect's whole voice (he doesn't know you can read the terminal), hands you the exact trick he's hiding. A `_wallBonking` flag throttles the low-speed bonk feedback. Passing a *broken* wall still requires hitting its gap (`isBroken && isWeakPoint`); the solid wall either side stays lethal.
- **Gotcha (persistence):** `brokenWalls` and `wallDamage` persist across deaths; only score/length reset. Because a sub-smash restarts you and max gear needs mass (gear 3 = score ≥ 30), the intended play is *grow to max speed, then breach in one clean hit* — ramming early just costs your run.

### The Architect's Voice: He Doesn't Know You Can Read
- Every Architect line in the narrative terminal is written as his **private diagnostic log** — self-directed, never addressed to "you." He mutters, gloats, and inadvertently reveals the very mechanics he's trying to hide (`NarrativeManager.on*`, `Game.architectGuide`, the glitch telegraph). The running joke escalates: at 5 Data he notes "it cannot see ANY of this"; the sub-smash and speed logs leak the max-velocity trick; and at **Localhost `[5,0]`** he realizes, mid-log, that you've been reading all along. Keep this voice for all Architect terminal text.
- **The accidental-guidance joke — how it should LAND (`Game.architectGuide`, once per main-path sector).** He narrates the anomaly's eastward drift toward the Safe Zone and, sector by sector, hands you the route. The engine is **paranoid rationalizing + dramatic irony**, NOT self-censorship. He *names* the destination while dismissing it ("nothing east but the old residential subnet"), reassures himself with the exact fact that betrays him ("it cannot know Localhost sits one sector east. ...It is heading one sector east"), and stakes his ego on things that are about to fail ("Gate will not embarrass me"). **Avoid the weak beat** where he says something and then denies having said it / "strike it from the record" — the joke isn't self-erasure, it's a competent villain whose thoroughness *is* the leak. Keep the lines tight; the humor is in the confidence, not the word count.

### Modules & the Module Slot
- **Denny drops his Sector Map** the first time you talk to him (`dennyMapDropped` guard, a `mapitem` NPC). Pick it up and it becomes a **carried module** (`carriedModule`), which opens a **3×3 Module Slot** in the bottom-left (`moduleSlotX/Y` from live dims, `Renderer.drawModuleSlot`, labelled "DROP TAIL HERE" while carrying).
- **The module rides the true tail tip** (`Game.mapCell` = `body[length-1]`). 2-Bit, when he's aboard, slides **one segment forward** to `body[length-2]` (`Game.biteIndex`, mirrored to `state.biteIndex` for the Renderer) so the two never share a cell. This is deliberate: because the module is the literal tail tip, the "DROP TAIL HERE" socket accepts it **whether or not 2-Bit is still hitching a ride** — you don't have to wait until Localhost drops him off. (Earlier the module rode `length-2` behind 2-Bit, which made it visually merge with him AND unloadable until he left — the reported bug.) `biteIndex` returns `-1` when the snake is momentarily too short to seat both (a transient after a death while carrying the map; his face reappears once you re-grow).
- **Installing is a tail maneuver, not a button.** Drag the carried module into the 3×3 slot (`Game.mapInSlot`) and it triggers a **two-beat install animation** (`startModuleLoad`/`updateModuleLoad`, `Renderer.drawModuleLoad`) that **hangs the sim** while it plays: beat 1 sucks the module into the socket, beat 2 flies it up to the HUD corner — only then does it come online (`state.unlocked.mapModule`, which gates **2-Bit's route minimap**). Slip past Denny → no map → Gate remarks on it. First instance of the **Modules (§4)** system.

### Dialogue Pacing: the Sim Hangs While the Terminal Types
- `Game.update` returns early while `narrative.isPrinting`, so the world **freezes like a dialogue box** whenever the Architect's terminal log is typing — logs are read one at a time instead of stepping on each other or scrolling out of view mid-play. (`isPrinting` is driven by `setTimeout`, independent of the game loop, so it always clears and resumes.) Character conversations still use the `DialogManager` window; the Architect uses the terminal. Keep 2-Bit/Denny/Gate lines in the **window** and Architect logs in the **terminal**.

### Visual Fidelity (the era question)
- We're at the **8-bit** rung of the §2 aesthetic ladder (monochrome-neon squares). First step away from "everything is a dot": `Renderer.drawNpcFeatures` gives the **packets** faces (2-Bit and NPCs get eyes; Gate a firewall visor; the map-item a grid; the signpost a "!"; citizens their own colour). The **worm's head has no eyes** — it isn't a packet. The 16-bit / 32-bit era upgrades (Beats 8 & 16) then layer on palette depth, detail, and lighting — the sprite hooks live in one place (`drawNpcFeatures`) so they can grow per era.
- **Minimap legibility:** Safe Zones (Localhost `[5,0]`) draw as a bigger **gold** node vs the teal Wilds rooms, and the current room always gets a white ring (`Renderer.drawMinimap`). The **Module Slot** is inset one cell from the bottom-left corner so its socket, glow, and label never clip off-screen (`Game.moduleSlotX/Y`).

### 2-Bit's Drop-Off, His Localhost Shop, & the Act I Hooks
- On first reaching **Localhost**, 2-Bit hops off your tail to set up shop (`Game.checkBiteDropOff`, fired from `shiftScreen`; guarded by `biteDroppedOff`). He detaches physically (a tail segment is popped; `hasBiteSegment` = `tailRider && !biteDroppedOff` now gates the tail render, `die()` reset, and every `shrink`), but the **drive/gear module stays yours** (`tailRider` remains true). He delivers the grift gag ("I'm gonna start grift— ...*selling* things") and becomes a stationary `'shop'` NPC.
- **The shop is finally wired:** bumping the `'shop'` NPC opens 2-Bit's stall (`Game.openBiteShop` → `ShopManager.open`, `gameState = 'SHOP'`) — the previously-orphaned shop overlay now has an in-world door.
- **The drop-off is JUST the drop-off (`Game.checkBiteDropOff`).** It's a tight 3-line beat: he gets off your tail, does the grift gag, tells you the stall is open. **No** world-building here — the leads are deliberately withheld so the moment stays clean (per the "less is more" dialogue pass).
- **Exposition is drip-fed on RETURN, not dumped (`Game.openBiteShop` + `biteTopics`).** The villager leads only surface when you **come back to the stall to buy** — each shop visit, 2-Bit shares ONE unheard topic (Cadenza → Nibble → the emptying subnet → the lost Cache) before the overlay opens, until he's out of stories. Topics are 1–2 lines each. `state.biteTopicsHeard` counts progress and **persists across deaths** (it's knowledge, not score). So the beacon's mystery sound (below) motivates the *first* return visit, where he names it — mystery, then payoff.
- **Cadenza's homing beacon (`Game.updateCadenzaBeacon` / `Audio.playCadenzaSong`).** She's sealed in a fixed sector **southeast of Localhost** (`worldManager.landmarks.cadenza = {8,3}`, the single source of truth also used to carve her guaranteed corridor — see §9 *Guaranteed corridors*). Per Total Diegesis you find her by *ear*: her singing is a sonar ping whose interval tightens as your current room nears hers (`cadenzaProximity`, Chebyshev room-distance, range 6 → `~2.4s` far, `~0.5s` in-sector) and whose tone brightens/loudens with proximity (a soft, MUSICAL two-note vocal motif — the one deliberately pretty voice among the harsh system sounds). Gated on `biteDroppedOff` (starts the moment he sets up shop, so it's an unexplained sound until your first shop visit names it) and silenced by `cadenzaFound` (reserved for when she's built out).
- **Localhost is populated & the leads cross-hint** (`RoomGenerator` [5,0]): five `citizen` refugee programs. Their barks now **echo 2-Bit's gossip from a second voice** — one points southeast to Cadenza's singing, one to Nibble's Wilds stall, one mourns the lost Cache — so the Act I leads land even if you don't exhaust 2-Bit's topics. Non-blocking dialogue like the signpost.
- **2-Bit's inventory (RESOLVED):** now a real lineup (Data Compression, Reinforced Segments, Pivot Override, Rollback Buffer, Topology Scanner) — see *2-Bit's shop inventory & the Topology Scanner* in §9. Nibble's Wilds stall can still be the rival/cursed-goods counterpart when built.
- **PENDING — Localhost grows with Data spent:** the user wants the **village itself to upgrade** as you sink Data into it (a visible incremental sink — more citizens/structures/services appearing as Localhost is "rebuilt"). A natural Phase-4 idle hook and a diegetic reason the Safe Zone matters. *Deferred; captured here so it isn't lost.*

### Gate: The Living Firewall
- Gate tracks the player's Y every move-tick (a vertical goalie), so a straight horizontal run can't bypass him — forcing the encounter (`Game.updateGate`). After it resolves he does **not** vanish: he flees on-screen to the right wall's **weak point** (so the breach he opens is one you can follow), `breakWall`s it, and exits into the next sector. A `leaving` flag makes a fleeing NPC non-interactive.

### Denny, the Architect's Accidental Directions, & Localhost
- **Denny (`updateDenny`)** SLOW-tracks the player's row (moves only on even `_tick`s) — a lazy goalie easy to outrun. Whether you bump him (`state.unlocked.dennyMet`, set on collision) or slip past (`dennySlipped`, set in `shiftScreen` when you leave `[1,0]` un-met) is remembered and paid off in **Gate's dialogue** (a conditional line prepended when the encounter fires). His dialogue was rewritten for clarity: he plainly explains he's the firewall's bottom-most default-deny rule that everyone overrides.
- **The Architect accidentally guides you** (`Game.architectGuide`, once per main-path sector via a `_guided` set): he keeps *forbidding* the exact route East to the first Safe Zone, revealing it. It's diegetic navigation — the map is drawn by the story.
- **Localhost `[5,0]`** is the first Safe Zone: a hazard-free room (no Glitches) with a welcome `signpost` NPC ("there's no place like 127.0.0.1"). The end of the Act I Wilds.
- **2-Bit's Route Map (`Renderer.drawMinimap`)** — a small corner network-map of visited rooms and the boundaries you've smashed open, current room highlighted. It's **Denny's Sector Map**, installed as a Module (`state.unlocked.mapModule`) — see *Modules & the Module Slot* in §9. It becomes genuinely useful now that weak points vary and the Wilds is a maze.

### Input State Management on Respawn
- **Gotcha:** The game loop pauses processing movement when `gameState === 'DEAD'` or `'START'`. Resuming the game relies on `InputHandler.js` detecting *any* keypress (via an `onFirstInput` callback) to switch the state back to `'PLAYING'`. When refactoring inputs or adding new systems (like `Audio.init()`), it is critical to ensure this callback is preserved, otherwise the game will silently fail to resume, leaving the player stuck in the dead state unable to move.
- **Gotcha (Persistence):** When calling `die()`, the snake is fully reset. The `hasBite` (or `firstEncounter`) flag must be explicitly passed to `this.snake.reset()` during death handling; otherwise, Bite will disappear from the tail upon respawn, breaking the mechanic.

### The Night-Audit Bug-Fix Pass (2026-07-17)
A multi-agent audit surfaced 43 confirmed issues; ~36 were fixed in one pass (the rest deferred as design decisions, below). The fixes clustered into a few themes worth remembering:
- **Total Diegesis was leaking in both directions.** Glitches could spawn/persist inside the Localhost **Safe Zone** (fixed: `WorldManager.isSafeZone` gate in `Game.spawnApple`); Gate spoke through the **Architect's private terminal** (fixed: his breach is now a `SYSTEM:` intercept, not "Gate: …" in the log); and there was **no death/boot/transition presentation** (fixed: `Renderer` DEAD "SIGNAL LOST" + START "press any key" + a black TRANSITION wipe, and `die()` now plays one death cue for *every* cause).
- **The Cadenza trail was fully broken** — see *Finding the Villagers* below.
- **Room-cross created a phantom collision chunk.** After crossing a boundary the head wrapped to the far edge but the body kept old-room coordinates, leaving a collision-real chunk on the wrong side. Fixed: `Game.update` translates the trailing body off-screen behind the head's entry and **returns before the collision pipeline** (which was also running against the *new* room's entities mid-transition).
- **The snake could eat 2-Bit.** The Glitch-damage loop called `shrink()` without `hasBiteSegment`, popping his protected tail segment (and killing short snakes carrying him). Fixed to `shrink(this.hasBiteSegment)`, matching every other shrink site.
- **Durable-state hazards.** A killer Glitch was baked into the room it killed you in (now consumed first); glitches could drift into the **hub respawn point** and chain-death spawn-camp you (now cleared within 2 cells of spawn); and Denny's map could drop **off-canvas** on the bottom row and be lost forever (now clamped in-bounds).
- **Input foot-guns.** The same Space that dismissed 2-Bit's "(Press SPACE to comply)" dialog *also* fired the consent on that press (fixed: `onDialogAdvance` returns "consumed" and `InputHandler` skips the action); WASD died under CapsLock (now case-insensitive); and keys pressed during a **conversation** freeze (DIALOG/SHOP/PAUSED) buffered and fired on resume (fixed: `InputHandler.canSteer` gates steering to `PLAYING && !moduleLoad`). **Subtlety worth remembering:** `canSteer` deliberately does NOT block while the terminal is *printing* — the wake-press after a death happens while the death log is still typing, and must set your respawn direction (buffered until the log clears) instead of being dropped. **Gear taps** are gated separately (blocked during printing/install) so you can't silently accumulate max speed while reading, and gear is re-clamped on a score drop so a Glitch drain can't leave you at ghost max-speed.
- **Dead code that misled** (the owner's stated fear): removed `dropBite`, `moveBiteTowards`/`biteRoom*`, `loadRoom`, `firstEncounter` (which silently made "Glitch Minefield" rooms spawn **zero** glitches — re-keyed on `biteProgress`), `actionPhase`, and the never-displayable score-1 line. `ShopManager` is now fully **null-safe** (a missing button no longer crashes the whole `GameEngine` constructor — this is what un-stuck the stale `Game.test.js`). `.hidden` is now `visibility:hidden` so invisible buttons aren't Tab+Space-clickable mid-game.

### Finding the Villagers: the Cadenza beacon, resolved
The beacon that guides you to a sealed sector had two fatal bugs, now fixed:
- **The destination was empty.** Nothing existed at Cadenza's landmark `{8,3}` — it generated a random Wilds room, `cadenzaFound` was declared but *never set*, so the song pinged forever in an empty room. Now `RoomGenerator` places a **`cadenza` NPC** there (placeholder scene until her Sound Test minigame exists), and `Game.shiftScreen` sets `state.unlocked.cadenzaFound` on arrival, silencing the beacon. `worldManager.landmarks.cadenza` is the single source of truth for the room, the guaranteed corridor (`_carvePath`), and the beacon target.
- **The gradient was flat.** `cadenzaProximity` used **Chebyshev** room-distance, which stays constant for single-axis steps along her diagonal corridor (from Localhost `[5,0]`, both `[6,0]` and `[5,1]` read the same distance to `{8,3}`) — so the "sonar" gave no hotter/colder feedback exactly where you need it. Switched to **Euclidean** (`Math.hypot`, range 8): every step toward her tightens the pulse. This is the general rule for any future homing beacon — **never Chebyshev for a diagonal target.**

### 2-Bit's shop inventory (RESOLVED) & the Topology Scanner
The shop is now a **data-driven list** (`ShopManager.items`, still null-safe). Retired the dead/redundant items (Manual Override brake, Overclocked speed, Hitchhiker). The lineup:
- **Data Compression (15)** — apples give +2 Data. (Kept; owner likes it.)
- **Reinforced Segments (25)** — Glitch contact costs 1 segment, not 3. (Kept.)
- **Pivot Override (10)** — a lone **SHIFT** press does a *safe 180* (`Game.pivot` reverses the body so the old tail becomes the head and faces away). It's the brake item's rework: the free gear-system brake still exists (opposite-tap → gear −1); the *item* adds a genuinely new movement verb (full backtracking). **It is truly safe: it validates the cell the reversed head will enter and REFUSES (a soft `playDenied`, never a death) when it can't** — i.e. when the snake is coiled around its own tail, or when a room-crossing has parked the trailing body off-screen. So it never self-kills; a refused pivot just does nothing.
- **Topology Scanner (40, the marquee)** — the reason weak points are now **hidden**. Off-path weak points render as **solid wall** (`Renderer` only draws a weak point if `WorldManager.isWeakPointRevealed` — broken || on a guided route/`mainPath` || rammed (`wallDamage>0`) || an active Scanner reveal). With the Scanner, **dragging your body along a wall sweeps it** (`Game.detectScannerSweep`, each move-tick): a draped segment over a hidden door lights it up + fires `Audio.playScannerPing` (a11y: cyan "sonar" outline too), for a duration that grows **geometrically with sweep length** (`min(6000, 350·1.35^segments)`) — so longer snakes lining up the sweep reveal doors for far longer. **Required-to-progress plan:** a later sector is built around hidden-only doors that demand the Scanner. NOTE: hidden doors don't change collision — ramming a hidden weak point at max gear still breaches; ramming a truly solid wall still kills. The main path stays visible so the early game is learnable.

### Death & the Bounce — the Crumple Buffer (upgrade-gated fold/unfold)
Death is **upgrade-gated** (`Game.die`):
- **No Crumple Buffer** (`upgrades.crumpleLevel === 0`) → a hit **KILLS** you: full reset to the Hub (the beginning). Data doesn't save you; you need the upgrade.
- **With the Crumple Buffer** (and body length > 1) → you **survive** via `Game.bounce()`:
  1. **Recoil off the hazard** — obstacle/self hits land the head ON the bad cell (checked after the move), so back it out to the safe cell it came from; without this you'd park on an obstacle and clip through it (the obstacle check is head-only). Border hits are checked before the move, so the head is already safe.
  2. **Shed `shedAmount`** in BOTH length and Data — the shed segments **burst** outward and fade (`spawnBurst` / `updateBursts`, drawn by the Renderer). `shedAmount` = `[10,6,3][crumpleLevel-1]`: **tier 1 (shed 10) is live; the 6/3 tiers are wired for a fast-follow leveled upgrade**.
  3. **FOLD** — the surviving body **collapses to a single block** at the head (`snake.body = [head]`, `pendingUnfold = keep-1`). This is the elegant bit: momentarily length 1, so reversing can't hit your own tail (the old reverse-into-neck bug).
  4. **BOUNCE off** — reverse the travel direction and drop to minimum speed (slow gear only exists once you have the gear system / `tailRider`; pre-2-Bit "minimum" is just base speed so you can still steer).
  5. **UN-FOLD** — as you drive away, the folded data extrudes **one block per move** (`shrinkOrUnfold` keeps the tail while `pendingUnfold > 0` instead of the usual shrink). 2-Bit and the module are **positional** (the tail), so they simply re-appear as the body un-folds — nothing to protect.
- No re-centre (a Cross-Maze could *trap* you at spawn). `pendingUnfold` resets on a real death. (This replaced the earlier data-gated bounce AND the retired Rollback Buffer.)

### The 2-Bit consent GAG (do not "fix" this)
When 2-Bit offers the deal, the last line is *"Do you agree? (Press SPACE to comply)"* — and because the **only** way through a dialog is the Space bar, **finishing the dialog IS agreeing** (handled in the offer's `onComplete`, which sets `tailRider` and hooks him on). This is an intentional comedic beat, **not** a bug: do not add a separate confirm press, and do not treat the "advance == confirm" overlap as a double-fire to be fixed. (An audit once flagged it and it was wrongly "fixed" into a confusing two-press flow with an "Are you deaf?" line — both reverted.) **General rule:** dialogue, comedic timing, and deliberate-feeling interactions are the owner's call — surface them as "is this intended?", never silently change them.

### Cache — the CACHE death-screen secret (introducing the archivist)
Cache is met by an ARG-style secret at the death screen, not by walking somewhere:
- The **DEAD screen** now reads "PRESS ANY KEY TO **CONTINUE**" and shows a quiet **5-slot code** of your last-5 "continue" keys (`Game.deathCode`, a rolling window; `Game.recordDeathKey` records one key per respawn — the first keypress flips DEAD→PLAYING, so exactly one lands per death; named keys like Space/arrows record as `·` and can't spell it).
- Spell **CACHE** across five death screens → `Game.summonCache()` sets `unlocked.cacheFound` and **manifests her in the Hub** (`playMaterialize`), where you always respawn. She's a `cache` NPC (pale memory-blue), read at no mass cost like the other townsfolk.
- **Clues (2-Bit's Cache gossip topic + two Localhost `citizen`s)** vaguely point at "give the system her name when it asks you to CONTINUE." **All clue lines are un-gated on `cacheFound`**, so finding her first (by guessing) never strands the questline. *(All Cache/clue dialogue is currently PLACEHOLDER, flagged in-code for the owner to rewrite.)*
- Note: once you own the Crumple Buffer you rarely see the death screen (you bounce), so the secret is mostly an early-game / pre-buffer window — worth tuning if it should stay reachable later.

### Gotcha: NPC bumps must be mass-neutral (the double-shrink)
A normal move is length-neutral (unshift +1, tail-pop −1). The NPC-collision handler used to fall through to a SECOND `snake.shrink()` for `bite`/`gate`/`denny` (the `citizen`/`signpost`/`shop`/`mapitem` branches `return` before it) — so bumping 2-Bit/Denny/Gate "ate" a segment on every chat. Fixed: those branches now just `return` (re-attaching 2-Bit still pushes his cell first, so he cleanly rejoins the tail). **Rule:** an NPC conversation never costs mass; only eating grows and only glitches/hits shrink.

### Save / Load — Cache's Save Function (IMPLEMENTED, localStorage)
Persistence ships. **localStorage**, not cookies (the Candy Box / A-Dark-Room approach — bigger, client-only, a simple key→string store): `SaveManager` (`src/systems/SaveManager.js`) is a defensively-wrapped `save/load/hasSave/clear` that degrades to "no save" if storage is unavailable.
- **What persists (`Game.serialize`):** DURABLE progress only — `unlocked` flags, `upgrades`, `biteTopicsHeard`, the `deathCode` (CACHE buffer), and the world's `brokenWalls` + `wallDamage`. The **ephemeral run** (score, length, position) is NOT saved — `Game.applySave` drops you back in the **Hub** as a fresh worm with all that progress, wiping cached rooms so they regenerate from the restored flags (and re-placing Cache in the Hub if `cacheFound`). Score/length reset on death anyway, so this keeps them coupled.
- **Cache grants it, diegetically.** First real meeting (`cache` NPC branch): if you have the **pause menu** (`unlocked.pauseMenu` — "somewhere to FILE things"), she files a **Save Function** into it (`unlocked.saveFunction = true`) — no real choice, like 2-Bit. If you don't, she's too **buried** to help; come back with one. (Grant is idempotent on the flag, so a save-load can't double-grant.) *(Her lines are PLACEHOLDER, flagged for the owner.)*
- **UI:** from the **PAUSE menu**, `S` saves and `L` loads (window listener gated on `PAUSED && saveFunction`, so they don't collide with 'down' movement in play); the Renderer shows `[S] SAVE  [L] LOAD` and a `SAVED/LOADED/NO SAVE` toast. **Auto-load on boot** (`start()`, Candy-Box style) seeds a prior session's progress if a save exists.
- **`refreshd`** (the DRAM-refresh daemon) remains the *separate* in-fiction reason unlocks survive a single death (already true in code). Cache is cross-session save/load; refreshd is within-session death-persistence.
- **Verification-hardened:** loading is blocked during the Gate Thread-Suspension cutscene (S/L gated on `PAUSED && !isSuspended`), and `applySave` clears `isSuspended`/`onUnpauseCallback` (a load out of the cutscene used to leave the black overlay stuck). The **carried map survives a load** (`carriedModule` is serialized, not nulled), and if Denny *dropped* it but you never grabbed it, a load clears `dennyMapDropped` so he can drop it again — no map soft-lock either way.
- Follow-up worth a note: no "New Game / clear save" UI yet (`SaveManager.clear()` exists) — a menu button is the natural next step.

### PENDING — Localhost upgrades with Data spent
Still open (owner-flagged): sinking Data in Localhost should visibly **rebuild the village** (more citizens/structures/services), a Phase-4 idle hook and a diegetic reason the Safe Zone matters.

### Build-out order (updated)
1. ✅ Overnight audit + fixes; ✅ a11y pass (redundant coding, volume); ✅ shop redesign (Scanner/Pivot/Rollback).
2. **NPC interaction registry** + `update()` decomposition (extract the collision `else if` chain out of the physics loop) — do BEFORE adding Nibble.
3. **Dialogue/content extraction** to `src/content/` (pure data) — so writing passes never touch engine logic. One home for all lines.
4. **Cache = localStorage save/load** (moved up — foundational for incremental).
5. Content: Cadenza's Sound Test minigame; Nibble's stall; the Scanner-required hidden-door sector; Localhost-grows-with-Data.
