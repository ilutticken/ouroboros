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
            musicLayer: 0              // 0 = baseline silence; 1 = Cadenza's Locked Groove (booted at the Encore); 2,3 later
        };
        this.upgrades = {
            dataCompression: false,   // apples give +2 Data
            reinforcedSegments: false, // Glitch contact costs 1 segment, not 3
            pivot: false,             // press SHIFT for a safe 180 reversal
            scanner: false,           // sweep a wall to reveal its hidden weak points
            crumpleLevel: 0           // survive hits by shedding+folding (0 = none, die on hit); higher = shed less
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
