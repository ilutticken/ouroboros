export class NarrativeManager {
    constructor(audio) {
        this.audio = audio;
        this.terminal = document.getElementById('narrative-terminal');
        this.messageQueue = [];
        this.isPrinting = false;
        this.deathCount = 0;
        // The monitor is dark until the system boots it (the UI reveal at 5 Data).
        // While offline it must not print OR play typewriter doots — otherwise the
        // player hears the terminal typing with nothing on screen.
        this.online = false;
    }

    printMessage(msg) {
        if (!this.terminal || !this.online) return;
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
            
            // Play doot for every few characters to avoid audio overlap clipping
            if (i % 2 === 0 && this.audio) {
                this.audio.playDoot();
            }
            
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
            this.printMessage("LOG: Architect > 'Why is it consuming itself? Fascinating.'");
        } else if (cause === 'border') {
            this.printMessage("LOG: Architect > 'Quarantine integrity holding. Anomaly destroyed on impact.'");
        } else if (cause === 'obstacle') {
            this.printMessage("LOG: Architect > 'Anomaly terminated by standard logic gate collision.'");
        } else {
            if (this.deathCount === 1) {
                this.printMessage("SYSTEM WARNING: Unregistered process terminated.");
            } else if (this.deathCount === 3) {
                this.printMessage("LOG: Architect > 'It keeps returning. I must analyze its memory allocation.'");
            }
        }
    }
    
    onScoreUnlock(score, unlockedFlags) {
        if (score === 1 && !unlockedFlags.firstScore) {
            this.printMessage("SYSTEM: Data packet acquired. Storage initialized.");
            unlockedFlags.firstScore = true;
        } else if (score === 5 && !unlockedFlags.ui) {
            this.printMessage("LOG: Architect > 'A rogue packet is hoarding Data. Monitoring progress.'");
        } else if (score === 10 && !unlockedFlags.borders) {
            this.printMessage("LOG: Architect > 'Deploying containment boundaries to isolate the rogue packet.'");
        }
    }
    
    onSpeedUpgrade(level) {
        if (level === 1) {
            this.printMessage("LOG: Architect > 'Anomaly velocity increasing. Adjusting physics engine...'");
        } else if (level === 2) {
            this.printMessage("SYSTEM WARNING: High velocity approaching boundary stress limits.");
        } else if (level === 3) {
            this.printMessage("CRITICAL DANGER: Velocity exceeds boundary tolerance!");
        }
    }
    
    onWallBreak() {
        this.printMessage("CRITICAL ALERT: SECTOR BREACH! Anomaly has escaped the quarantine zone.");
        this.printMessage("LOG: Architect > 'Dispatching Firewall Gate to Sector [3,0]. CONTAIN IT!'");
    }
}
