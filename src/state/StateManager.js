export class StateManager {
    constructor() {
        this.score = 0;
        this.gameState = 'START'; // 'START', 'PLAYING', 'DIALOG', 'SHOP', 'DEAD', 'PAUSED', 'TRANSITION', 'ENCORE'
        this.isSuspended = false;
        this.biteTopicsHeard = 0; // how many of 2-Bit's gossip topics you've heard (persists across deaths)
        this.unlocked = {
            ui: false,
            borders: false,
            biteProgress: 0,
            glitchesTelegraphed: false,
            maxSpeedReached: false,
            pauseMenu: false,
            wallBroken: false,
            tailRider: false,
            // Progression flags set ad-hoc during play. Declared here (default false) so
            // serialize() captures them AND a reset/load baseline can clear them — otherwise
            // a load that merges a save lacking a key can't turn a live-true flag back off.
            biteDroppedOff: false,   // 2-Bit has hopped off the tail in Localhost
            mapModule: false,        // Denny's Topology Map is installed (minimap online)
            moduleSlot: false,       // the 3x3 module socket is unlocked
            dennyMet: false,         // bumped Denny
            dennySlipped: false,     // walked past Denny without meeting him
            dennyMapDropped: false,  // Denny has dropped his map item
            subSmashRevealed: false, // the Architect's sub-smash gloat has fired
            cadenzaFound: false, // set once Cadenza's sector is reached — silences her homing beacon
            cadenzaMet: false,   // she has actually been SPOKEN to (first-contact scene played).
                                 // Distinct from cadenzaFound (arrival/beacon): the beacon
                                 // resolves on entering the room, this gates her dialogue.
            cacheFound: false,  // set once you've spelled CACHE across death screens — she manifests in the Hub
            saveFunction: false, // Cache grants this (if you have the pause menu) — unlocks Save/Load
            // Cache's staged Hub conversation: 0 = not yet helped, 1 = Save Function granted,
            // 2 = spare-data gift given (Hub seeds data on respawn), 3 = directions given
            // (her sector is on your map and she stops manifesting in the Hub).
            cacheStage: 0,
            spareDataUnlocked: false,  // Cache's stage-2 gift: the Hub seeds spare Data on respawn
            startScreenUnlocked: false, // Cache builds the title screen when she grants Save (stage 1)
            // The DA CAPO Encore (Cadenza's music puzzle) and its Wilds gate.
            lostVerseFound: false,     // the Wilds shard that heals Cadenza's "dead note" — gates the Encore finale
            encoreComplete: false,     // the DA CAPO Encore is done (Music Layer 1 booted)
            musicLayer: 0,             // 0 = baseline silence; 1 = Cadenza's Locked Groove (booted at the Encore); 2 = +bassline (Beat 8 reboot); 3 later
            // Motion Carried — the world-state flip after the first real Gate confrontation:
            // the Architect's grip slips, and Glitches / villagers / room furniture start
            // moving on YOUR move-tick. One-way; never turns back off.
            motionCarried: false,
            hushTelegraphed: false,    // the one-time SYSTEM intercept on first entering HUSH's post awake
            coilSeen: false,           // the Architect's one-time log on first reaching a boundary (coil) room
            // Beat 6+ — Nibble's black market and the corruption-handling capability.
            nibbleMet: false,          // bumped Nibble at her deep-Wilds stall
            // Heur's Purge Cycle (the Body-Breakout). Owning the corrupted-Data module flags
            // you as an infection vector; the daemon intercepts you in the next open sector.
            purgeComplete: false,      // the mandatory decontamination has been survived
            bayRoom: null,             // {x,y} where Heur caught you — remembered as the Bay (Act 2 rematch site)
            // The north spine is climbed TWICE, on the same rooms, armed by two different
            // flags:
            //   EARLY CLIMB (ascentArmed) — the Denny rematch {5,-2} and the Gate Override
            //   {5,-3}. Armed just by reaching Localhost having met Gate, so the SECOND
            //   Gate run-in (and Motion Carried with it) lands at the ACT MIDPOINT, before
            //   the outer-Wilds detour. Previously these were gated on purgeComplete,
            //   which chained them behind Nibble + Heur and pushed the world's one
            //   world-wakes-up beat to two rooms before the act ended.
            //   LATE CLIMB (purgeComplete) — Heur's Bay {5,-1}, Cache's checkpoint {5,-4}
            //   and the Port 0 finale {5,-5}. Unchanged: the finale still requires the
            //   mandatory decontamination.
            ascentArmed: false,        // the early climb is live (rematch posts manned)
            dennyRematchIntroSeen: false, // one-shot intro-dialog guards for the Ascent's set-piece rooms
            gateOverrideIntroSeen: false,
            finaleIntroSeen: false,
            dennyRematchDone: false,   // the Fall-Through at {5,-2}
            gateRematchDone: false,    // the Override at {5,-3} — the SECOND Gate run-in (fires Motion Carried)
            checkpointOpen: false,     // Cache committed your save and unsealed the door north (also = checkpoint respawn armed)
            finaleDoorFound: false,    // the hidden Scanner door out of Cold Storage has been breached at least once
            finaleDone: false,         // Beat 8: the Port 0 paradox fired — Act I is over
            era16: false,              // the forced reboot's 16-bit graphics upgrade (set with finaleDone)
            // Wilds-found UI / Pause-Menu utilities (each a diagnostic module you pick up
            // out in the Wilds — see WILDS_MODULES / npcUiModule).
            gearMeter: false,          // HUD tachometer showing your current gear
            coordReadout: false,       // HUD sector-address readout (which room you're in)
            mapPinsTool: false,        // the Pause-Menu annotation tool (mark rooms on your map)
            pinShapes: 0,              // how many pin SHAPES you've unlocked (the tool grants the first)
            modulesFound: []           // 'x,y' room keys of Wilds UI modules already picked up (no respawn)
        };
        this.upgrades = {
            dataCompression: false,   // apples give +2 Data
            reinforcedSegments: false, // Glitch contact costs 1 segment, not 3
            pivot: false,             // press SHIFT for a safe 180 reversal
            scanner: false,           // sweep a wall to reveal its hidden weak points
            crumpleLevel: 0,          // survive hits by shedding+folding (0 = none, die on hit); higher = shed less
            corruptHandler: false,    // Nibble's Glitch Shunt: your head PUSHES corruption instead of biting into it
            salvage: false,           // Nibble's Salvage Claws: shed segments drop as re-collectible Data motes
            glitchWard: false         // Nibble's Scale Mods: absorb the FIRST Glitch bite in each room for free
        };
    }
    
    addScore(amount) {
        this.score += amount;
    }
    
    resetScore() {
        this.score = 0;
        // In true incremental fashion, we don't reset unlocks on death, just the ephemeral score.
        // Or maybe we do lose data? For now, keep unlocks persistent.
        
        // If UI was revealed, update the display
        const display = document.getElementById('score-value');
        if (display) display.innerText = this.score.toString();
    }
}
