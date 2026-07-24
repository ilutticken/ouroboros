import { ARCHITECT } from '../content/dialogue.js';

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
        this.deathByCause = { self: 0, border: 0, obstacle: 0, unknown: 0 }; // per-cause tallies (Hydratia's hint tiers)
        this._generation = 0;       // bumped by reset() to abandon an in-flight typewriter loop
        // THE RELEASE LATCH (owner decision 5: text STOPS the game, and each log must be
        // Space-barred through). A finished log no longer releases on a timer — it waits
        // for release() (wired to Space in Game.js) behind a visible ">> SPACE" cue.
        this.awaitingRelease = false;
    }

    // Wipe all per-run state (queued/printing logs, death counters, the on-screen terminal)
    // so a New Game / Load doesn't inherit the previous run's logs or escalation counts.
    // Leaves the monitor OFFLINE; the caller re-arms it if progress warrants.
    reset() {
        this.messageQueue = [];
        this.isPrinting = false;
        this.skipRequested = false;
        this.awaitingRelease = false; // a stuck latch here would boot a New Game frozen
        this.deathCount = 0;
        this.unknownDeathCount = 0;
        this.deathByCause = { self: 0, border: 0, obstacle: 0, unknown: 0 };
        this.online = false;
        this._generation++; // any in-flight processQueue loop is now stale and will bail
        if (this.terminal) this.terminal.innerHTML = ''; // (also removes any advance cue)
    }

    printMessage(msg) {
        if (!this.terminal || !this.online) return;
        this.messageQueue.push(msg);
        this.processQueue();
    }

    // A keypress while a log is TYPING fast-completes the current line. It never
    // releases the latch — that takes an explicit release() (Space), the two-press
    // model that matches the dialog boxes: first press finishes the type-out, second
    // press releases the frozen sim.
    requestSkip() {
        if (this.isPrinting && !this.awaitingRelease) this.skipRequested = true;
    }

    // Space on a finished log: hide the cue, unfreeze the sim, pump the queue. Returns
    // true when it consumed the press (so the caller doesn't also steer/advance).
    release() {
        if (!this.awaitingRelease) return false;
        this.awaitingRelease = false;
        this._hideAdvanceCue();
        this.isPrinting = false;
        this.skipRequested = false;
        this.processQueue();
        return true;
    }

    // §2.6: the frozen sim needs a VISIBLE cue that a key releases it (text, >=16px,
    // steady — no motion dependency). Appended under the finished log line.
    _showAdvanceCue() {
        if (!this.terminal) return;
        this._hideAdvanceCue();
        const cue = document.createElement('div');
        cue.className = 'narrative-advance';
        cue.textContent = '>> SPACE';
        this.terminal.appendChild(cue);
        this.terminal.scrollTop = this.terminal.scrollHeight;
    }
    _hideAdvanceCue() {
        if (!this.terminal) return;
        const cue = this.terminal.querySelector('.narrative-advance');
        if (cue) cue.remove();
    }

    async processQueue() {
        if (this.isPrinting || this.messageQueue.length === 0) return;

        this.isPrinting = true;
        this.skipRequested = false;
        const gen = this._generation; // if reset() runs mid-print, this loop is orphaned
        const msg = this.messageQueue.shift();

        const line = document.createElement('div');
        line.className = 'narrative-line';
        this.terminal.appendChild(line);

        // Typewriter effect
        for (let i = 0; i < msg.length; i++) {
            if (gen !== this._generation) return; // reset() ran: abandon this stale loop (no phantom doots, no double-writer)
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

        if (gen !== this._generation) return;
        this.terminal.scrollTop = this.terminal.scrollHeight;
        // THE LATCH (owner decision 5). The old behavior released the sim on a fixed
        // 1000ms timer — if you glanced away, lethal movement resumed unconfirmed. Now a
        // finished log holds the freeze (isPrinting stays true) behind a visible cue
        // until Space releases it (Game.js routes Space to release() ahead of steering).
        this._showAdvanceCue();
        this.awaitingRelease = true;
    }
    
    // NOTE ON VOICE: the Architect writes to his own private diagnostic log. He
    // does NOT know the player can read this terminal, so he mutters, gloats, and
    // — crucially — reveals the very mechanics he's trying to hide. (See design_doc
    // §5.5.) Keep all Architect lines self-directed, never addressed to "you".
    onDeath(cause) {
        this.deathCount++;
        // Per-cause tally: Hydratia's death-screen hints escalate on the cause that is
        // actually killing you, not the global count.
        if (this.deathByCause[cause] !== undefined) this.deathByCause[cause]++;
        else this.deathByCause.unknown++;
        if (cause === 'self') {
            this.printMessage(ARCHITECT.death.self);
        } else if (cause === 'border') {
            this.printMessage(ARCHITECT.death.border);
        } else if (cause === 'obstacle') {
            this.printMessage(ARCHITECT.death.obstacle);
        } else {
            // Cause-less deaths (a Glitch draining you to nothing). Gate on a SEPARATE
            // counter — keying these on the global deathCount made them unreachable
            // (they'd need the 1st/3rd death of the whole run to be a glitch-drain).
            this.unknownDeathCount++;
            if (this.unknownDeathCount === 1) {
                this.printMessage(ARCHITECT.death.unknownFirst);
            } else if (this.unknownDeathCount === 3) {
                this.printMessage(ARCHITECT.death.unknownThird);
            }
        }
    }

    onScoreUnlock(score, unlockedFlags) {
        // Thresholds (>=), not exact equality: the Data counter can jump past an exact
        // value (Data Compression grants +2/apple; the dev cheat grants +10), and an
        // `=== 5`/`=== 10` check would silently SKIP these one-shot beats. The ui/borders
        // flags are set by checkUnlocks AFTER this runs, so they double as print guards.
        if (score >= 5 && !unlockedFlags.ui) {
            this.printMessage(ARCHITECT.scoreUnlock.ui);
        }
        if (score >= 10 && !unlockedFlags.borders) {
            this.printMessage(ARCHITECT.scoreUnlock.borders);
        }
    }

    // Fires once, the first time the anomaly hits MAX gear — the Architect frets that
    // it's near "breach velocity," inadvertently confirming that speed is the trick.
    // (Repurposed from the retired Overclock shop upgrade's best line.)
    onMaxGear() {
        this.printMessage(ARCHITECT.maxGear);
    }

    // The Architect's relief that you sub-smashed instead of going max speed — and,
    // by gloating in his log, he hands you exactly the trick he's hiding. Fires once.
    onSubSmash(inHub, unlockedFlags) {
        if (unlockedFlags.subSmashRevealed) return;
        unlockedFlags.subSmashRevealed = true;
        if (inHub) {
            this.printMessage(ARCHITECT.subSmash.hub);
        } else {
            this.printMessage(ARCHITECT.subSmash.wilds);
        }
    }

    onWallBreak() {
        this.printMessage(ARCHITECT.wallBreak);
    }
}
