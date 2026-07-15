# Ouroboros: System Design Document

## 1. Core Concept
An incremental RPG that begins masquerading as a minimalist "Snake" clone. Inspired by the unfolding mystery of *A Dark Room* and the narrative flavor of *Tim Schafer's* worlds, the game starts with a cryptic, solitary existence in "The Void". As the player consumes "Data", the game engine evolves, the world expands, and a quirky, mysterious narrative unfolds about a data worm trying to understand its own existence. 

Crucially, **the game never stops being Snake.** The core mechanic of a growing, trailing entity is expanded upon rather than discarded.

## 2. Aesthetic: "X-Bit Neon"
A fusion of retro pixel art and modern neon cyber-aesthetics.
- **Graphics Evolution:** Monochromatic 8-bit -> 16-bit limited neon palette -> 32-bit full RGB neon.
- **Audio Evolution:** Basic square-wave beeps -> Arpeggiated basslines -> Full multi-layered chiptune symphonies.

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


## 5. The Cast of Quirky Characters (The Coterie)
**Bite:** (The Cynical Merchant) A former generic Data packet who figured out how to hoard his brethren instead of being consumed. Acts as your guide and upgrade vendor. Snarky, opportunistic, but ultimately loyal.
**The Architect:** (The Broken Overseer) The system's primary diagnostic tool. Speaks in pompous, pseudo-authoritative system alerts. He claims to be the god of the system, but is actually desperately trying to keep it from falling apart.
**Gate:** (The Obsessive Firewall) A rigid, rule-following security program who speaks like a stressed-out traffic cop. Has an unrequited crush on The Architect's voice.
**Null:** (The Melancholy Subroutine) A half-deleted, depressed program who speaks in cryptic poetry. Hands out weird side-quests and useless but fascinating lore about the system's history.
**Nibble:** (The Shady Sibling) Bite's estranged sister. Runs a black-market shop deep in the Wilds selling illegal, highly dangerous glitch-mods.
**Cache:** (The Hoarder) A disorganized memory bank residing in the Forgotten Sectors. Speaks in outdated slang and holds onto obsolete, fragmented data.
**Ping:** (The Hyperactive Courier) A tiny, incredibly fast networking packet bouncing around the Data Streams. Speaks at lightspeed and runs the fast-travel network.
**Hex:** (The Rebel Zealot) A corrupted executable hiding in the Deep Glitch. Believes you (the Snake) are a divine entity sent to liberate them from the Architect.
**Defrag:** (The Therapist) A soothing, overly organized defragmentation utility in the Archives. Tries to help other programs with their emotional baggage by 'sorting their sectors.'
**The Garbage Collector (GC):** (The Unstoppable Force) A massive, terrifying entity. Not evil, just blindly executing its memory-clearing protocols. You can't fight it; you can only hide from it.
**The Kernel:** (The True Antagonist) The ancient, dormant central core of the system.

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

### Input State Management on Respawn
- **Gotcha:** The game loop pauses processing movement when `gameState === 'DEAD'` or `'START'`. Resuming the game relies on `InputHandler.js` detecting *any* keypress (via an `onFirstInput` callback) to switch the state back to `'PLAYING'`. When refactoring inputs or adding new systems (like `Audio.init()`), it is critical to ensure this callback is preserved, otherwise the game will silently fail to resume, leaving the player stuck in the dead state unable to move.
- **Gotcha (Persistence):** When calling `die()`, the snake is fully reset. The `hasBite` (or `firstEncounter`) flag must be explicitly passed to `this.snake.reset()` during death handling; otherwise, Bite will disappear from the tail upon respawn, breaking the mechanic.
