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
    
    onDeath() {
        this.deathCount++;
        if (this.deathCount === 1) {
            this.printMessage("Diagnostic: System integrity failure.");
            this.printMessage("Conclusion: The subject lacks basic motor functions.");
        } else if (this.deathCount === 3) {
            this.printMessage("Architect: Again? You are testing my patience.");
        } else if (this.deathCount === 5) {
            this.printMessage("Architect: Have you considered moving *away* from your own tail?");
        }
    }
    
    onScoreUnlock(score) {
        if (score === 1) {
            this.printMessage("Data acquired. System stabilizing...");
        } else if (score === 5) {
            this.printMessage("Architect: Oh, it's alive. Let's see how long that lasts.");
        } else if (score === 10) {
            this.printMessage("Architect: Constructing boundaries. Try not to bump your head.");
        }
    }
}
