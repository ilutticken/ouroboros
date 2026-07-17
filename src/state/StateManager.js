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
            cadenzaFound: false // set once Cadenza's sector is reached — silences her homing beacon
        };
        this.upgrades = {
            dataCompression: false,
            reinforcedSegments: false,
            speedLevel: 0,
            manualBrake: false
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
