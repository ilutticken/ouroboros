export class NarrativeManager {
    constructor() {
        this.terminal = document.getElementById('narrative-terminal');
        this.messageQueue = [];
        this.isPrinting = false;
        this.deathCount = 0;
        
        // Initial setup for the terminal element will be done in HTML/CSS
    }
    
    printMessage(msg) {
        if (!this.terminal) return;
        this.messageQueue.push(msg);
        this.processQueue();
    }
    
    async processQueue() {
        if (this.isPrinting || this.messageQueue.length === 0) return;
        
        this.isPrinting = true;
        const msg = this.messageQueue.shift();
        
        const line = document.createElement('div');
        line.className = 'narrative-line';
        this.terminal.appendChild(line);
        
        // Typewriter effect
        for (let i = 0; i < msg.length; i++) {
            line.innerHTML += msg.charAt(i);
            // Scroll to bottom
            this.terminal.scrollTop = this.terminal.scrollHeight;
            await new Promise(r => setTimeout(r, 30));
        }
        
        await new Promise(r => setTimeout(r, 1000)); // Pause after message
        this.isPrinting = false;
        this.processQueue();
    }
    
    onDeath(cause) {
        this.deathCount++;
        if (cause === 'self') {
            this.printMessage("Architect: Have you considered moving *away* from your own tail?");
        } else if (cause === 'border') {
            this.printMessage("Architect: The quarantine walls are reinforced for a reason. Stop hitting them.");
        } else if (cause === 'obstacle') {
            this.printMessage("Architect: Watch where you are going. That pillar has higher priority than you.");
        } else {
            if (this.deathCount === 1) {
                this.printMessage("Diagnostic: System integrity failure.");
                this.printMessage("Conclusion: The subject lacks basic motor functions.");
            } else if (this.deathCount === 3) {
                this.printMessage("Architect: Again? You are testing my patience.");
            }
        }
    }
    
    onScoreUnlock(score, unlockedFlags) {
        if (score === 1 && !unlockedFlags.firstScore) {
            this.printMessage("Data acquired. System stabilizing...");
            unlockedFlags.firstScore = true;
        } else if (score === 5 && !unlockedFlags.ui) {
            this.printMessage("Architect: Oh, it's alive. Let's see how long that lasts.");
        } else if (score === 10 && !unlockedFlags.borders) {
            this.printMessage("Architect: Constructing boundaries. Try not to bump your head.");
        }
    }
    
    onSpeedUpgrade(level) {
        if (level === 1) {
            this.printMessage("Architect: Anomaly velocity increasing. Tuning physics engine...");
        } else if (level === 2) {
            this.printMessage("Architect: Warning: High velocity approaching boundary stress limits.");
        } else if (level === 3) {
            this.printMessage("Architect: DANGER: Velocity exceeds boundary tolerance! Reduce speed immediately!");
        }
    }
    
    onWallBreak() {
        this.printMessage("Architect: SECTOR BREACH! Anomaly has escaped the quarantine zone.");
        this.printMessage("Architect: Dispatching Firewall Gate to Sector [3,0].");
    }
}
