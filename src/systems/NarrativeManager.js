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
        this.skipRequested = false;
        this.unknownDeathCount = 0; // deaths with no specific cause (glitch drain) — for the escalating lines
    }

    printMessage(msg) {
        if (!this.terminal || !this.online) return;
        this.messageQueue.push(msg);
        this.processQueue();
    }

    // A keypress while a log is typing fast-completes the current line (and shortens
    // the dwell) so the sim-hang can't strand the player for 6-8s per Architect log.
    requestSkip() {
        if (this.isPrinting) this.skipRequested = true;
    }

    async processQueue() {
        if (this.isPrinting || this.messageQueue.length === 0) return;

        this.isPrinting = true;
        this.skipRequested = false;
        const msg = this.messageQueue.shift();

        const line = document.createElement('div');
        line.className = 'narrative-line';
        this.terminal.appendChild(line);

        // Typewriter effect
        for (let i = 0; i < msg.length; i++) {
            if (this.skipRequested) { line.innerHTML = msg; break; } // fast-complete

            line.innerHTML += msg.charAt(i);

            // Play doot for every few characters to avoid audio overlap clipping. Skip
            // it while the tab is backgrounded — setTimeout throttling stretches the
            // type-out to minutes, and a hidden tab dooting to nobody is just noise.
            if (i % 2 === 0 && this.audio && !document.hidden) {
                this.audio.playDoot();
            }

            // Scroll to bottom
            this.terminal.scrollTop = this.terminal.scrollHeight;
            await new Promise(r => setTimeout(r, 30));
        }

        this.terminal.scrollTop = this.terminal.scrollHeight;
        await new Promise(r => setTimeout(r, this.skipRequested ? 120 : 1000)); // dwell
        this.isPrinting = false;
        this.skipRequested = false;
        this.processQueue();
    }
    
    // NOTE ON VOICE: the Architect writes to his own private diagnostic log. He
    // does NOT know the player can read this terminal, so he mutters, gloats, and
    // — crucially — reveals the very mechanics he's trying to hide. (See design_doc
    // §5.5.) Keep all Architect lines self-directed, never addressed to "you".
    onDeath(cause) {
        this.deathCount++;
        if (cause === 'self') {
            this.printMessage("LOG: Architect > 'It devoured its own tail. On PURPOSE. I do not have a form for this. I am inventing a form for this.'");
        } else if (cause === 'border') {
            this.printMessage("LOG: Architect > 'Quarantine held. Anomaly deleted on impact. Another flawless day for me, personally.'");
        } else if (cause === 'obstacle') {
            this.printMessage("LOG: Architect > 'Anomaly walked into a logic gate. Didn't even have to try. Note: take full credit anyway.'");
        } else {
            // Cause-less deaths (a Glitch draining you to nothing). Gate on a SEPARATE
            // counter — keying these on the global deathCount made them unreachable
            // (they'd need the 1st/3rd death of the whole run to be a glitch-drain).
            this.unknownDeathCount++;
            if (this.unknownDeathCount === 1) {
                this.printMessage("LOG: Architect > 'Unregistered process terminated. Filing under Not My Problem.'");
            } else if (this.unknownDeathCount === 3) {
                this.printMessage("LOG: Architect > 'It keeps coming back. I do not like that.'");
            }
        }
    }

    onScoreUnlock(score, unlockedFlags) {
        // Thresholds (>=), not exact equality: the Data counter can jump past an exact
        // value (Data Compression grants +2/apple; the dev cheat grants +10), and an
        // `=== 5`/`=== 10` check would silently SKIP these one-shot beats. The ui/borders
        // flags are set by checkUnlocks AFTER this runs, so they double as print guards.
        if (score >= 5 && !unlockedFlags.ui) {
            this.printMessage("LOG: Architect > 'The hoarder is growing. Deploying a monitoring overlay.'");
        }
        if (score >= 10 && !unlockedFlags.borders) {
            this.printMessage("LOG: Architect > 'Rogue packet is a genuine nuisance now. Extruding containment walls. Nothing has ever escaped my walls. (Nothing has ever tried.)'");
        }
    }

    onSpeedUpgrade(level) {
        if (level === 1) {
            this.printMessage("LOG: Architect > 'Anomaly is accelerating. It must not learn what speed unlocks. It must NOT.'");
        } else if (level === 2) {
            this.printMessage("LOG: Architect > 'Velocity climbing toward boundary-stress limits. Mildly concerning. Do not log that it is concerning. ...Logged it.'");
        } else if (level === 3) {
            this.printMessage("LOG: Architect > 'CRITICAL: nearly at breach velocity. If it aims that at a weak point now— no. No. It doesn't know about weak points. It CAN'T. Deep breaths. I have no lungs. Deep breaths regardless.'");
        }
    }

    // The Architect's relief that you sub-smashed instead of going max speed — and,
    // by gloating in his log, he hands you exactly the trick he's hiding. Fires once.
    onSubSmash(inHub, unlockedFlags) {
        if (unlockedFlags.subSmashRevealed) return;
        unlockedFlags.subSmashRevealed = true;
        if (inHub) {
            this.printMessage("LOG: Architect > 'The anomaly rammed the quarantine below breach speed and destroyed itself. HA. It has NOT realized it must reach MAXIMUM velocity to crack a wall open. Long may it flail. It could never work that out from in here.'");
        } else {
            this.printMessage("LOG: Architect > 'It keeps hurling itself at barriers too slowly and deleting itself. Reassuring. Full speed is the whole trick and it hasn't the faintest idea. I certainly shan't tell it.'");
        }
    }

    onWallBreak() {
        this.printMessage("LOG: Architect > 'THE QUARANTINE IS BREACHED. HOW. It went max speed at the weak point. It KNEW. Dispatching Gate to Sector 3,0 — CONTAIN IT — and someone find out if this thing can READ.'");
    }
}
