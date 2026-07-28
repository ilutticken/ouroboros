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
        // Per-cause tallies (Hydratia's hint tiers escalate on the cause actually killing
        // you). One key per distinguishable death, so a boss match no longer reports as a
        // quarantine-wall impact.
        this.deathByCause = { self: 0, wall: 0, weak: 0, obstacle: 0, stamp: 0, glitch: 0, gate: 0, finale: 0, heur: 0, unknown: 0 };
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
        this.deathByCause = { self: 0, wall: 0, weak: 0, obstacle: 0, stamp: 0, glitch: 0, gate: 0, finale: 0, heur: 0, unknown: 0 };
        this._bitePairGloated = false; // the met-but-not-carried gloat re-arms per run
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
    onDeath(cause, opts = {}) {
        this.deathCount++;
        // Per-cause tally: Hydratia's death-screen hints escalate on the cause that is
        // actually killing you, not the global count.
        if (this.deathByCause[cause] !== undefined) this.deathByCause[cause]++;
        else this.deathByCause.unknown++;
        // Situational gloat (once per run): the merchant remnant is met but not yet
        // aboard — the Architect savors the non-cooperation. Replaces the cause line.
        if (opts.nearBite && !this._bitePairGloated) {
            this._bitePairGloated = true;
            this.printMessage(ARCHITECT.death.nearBite);
            return;
        }
        // THE LEADS (owner): while Cache and Hydratia are unmet, a death is an excuse for
        // him to gloat about the two programs that could have saved you — and in gloating,
        // to tell you they exist. Rationed to every 4th death of a given kind so it stays a
        // rumour rather than a signpost, and it never survives meeting them.
        const leads = [];
        if (opts.unlocked && !opts.unlocked.saveFunction) leads.push(ARCHITECT.death.hintCache);
        if (opts.unlocked && !opts.unlocked.hydratiaFound) leads.push(ARCHITECT.death.hintHydratia);
        if (leads.length && this.deathCount % 4 === 0) {
            this.printMessage(leads[(this.deathCount / 4 - 1) % leads.length]);
            return;
        }
        // Per-cause lines. `border` is kept as an alias so any caller I missed still lands
        // on the wall gloat rather than silently falling through to the unknown counter.
        const byCause = {
            self: ARCHITECT.death.self,
            wall: ARCHITECT.death.wall,
            border: ARCHITECT.death.wall,
            weak: null, // handled by onSubSmash, which already spoke this tick
            obstacle: ARCHITECT.death.obstacle,
            stamp: ARCHITECT.death.stamp,
            glitch: ARCHITECT.death.glitch,
            gate: ARCHITECT.death.gate,
            finale: ARCHITECT.death.finale,
            heur: ARCHITECT.death.heur,
        };
        if (cause in byCause) {
            if (byCause[cause]) this.printMessage(byCause[cause]);
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
    // A weak point missed for want of speed. In the Hub it is the TUTORIAL — the only
    // place the game says out loud that maximum velocity is what cracks a wall — so it
    // branches on whether you actually had the mass: `heavy` leaks the rule, `light` says
    // you were never going to make it. Out in the Wilds he has stopped being surprised.
    onSubSmash(inHub, unlockedFlags, heavy = true) {
        if (unlockedFlags.subSmashRevealed) return;
        unlockedFlags.subSmashRevealed = true;
        if (inHub) {
            this.printMessage(heavy ? ARCHITECT.subSmash.heavy : ARCHITECT.subSmash.light);
        } else {
            this.printMessage(ARCHITECT.subSmash.wilds);
        }
    }

    onWallBreak() {
        this.printMessage(ARCHITECT.wallBreak);
    }
}
