export class StateManager {
    constructor() {
        this.score = 0;
        this.gameState = 'START'; // 'START', 'PLAYING', 'DIALOG', 'SHOP', 'DEAD', 'PAUSED'
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
            cadenzaFound: false, // set once Cadenza's sector is reached — silences her homing beacon
            cacheFound: false,  // set once you've spelled CACHE across death screens — she manifests in the Hub
            saveFunction: false // Cache grants this (if you have the pause menu) — unlocks Save/Load
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
