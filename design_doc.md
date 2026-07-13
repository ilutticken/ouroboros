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
