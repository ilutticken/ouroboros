export class StateManager {
    constructor() {
        this.score = 0;
        this.gameState = 'START'; // 'START', 'PLAYING', 'DIALOG', 'SHOP', 'DEAD', 'PAUSED'
        this.isSuspended = false;
        this.rolledBack = false;  // true while the DEAD screen is actually a Rollback (not a real death)
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
            cadenzaFound: false // set once Cadenza's sector is reached — silences her homing beacon
        };
        this.upgrades = {
            dataCompression: false,   // apples give +2 Data
            reinforcedSegments: false, // Glitch contact costs 1 segment, not 3
            pivot: false,             // press SHIFT for a safe 180 reversal
            scanner: false,           // sweep a wall to reveal its hidden weak points
            rollbackBuffer: false     // a lethal hit costs 10 Data + a setback instead of your whole run
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
