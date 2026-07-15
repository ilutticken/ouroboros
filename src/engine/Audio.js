export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.initialized = false;
    }
    
    init() {
        if (this.initialized) return;

        // Create audio context on first user gesture
        window.AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        // Master bus: every voice routes through one gain -> compressor -> speakers.
        // The compressor acts as a limiter so overlapping voices (e.g. rapid-fire
        // wubs while dragging a long body past a Glitch) can't sum past 1.0 and
        // hard-clip the destination.
        this.master = this.ctx.createGain();
        this.master.gain.setValueAtTime(0.9, this.ctx.currentTime);
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-14, this.ctx.currentTime);
        this.limiter.knee.setValueAtTime(12, this.ctx.currentTime);
        this.limiter.ratio.setValueAtTime(6, this.ctx.currentTime);
        this.limiter.attack.setValueAtTime(0.003, this.ctx.currentTime);
        this.limiter.release.setValueAtTime(0.12, this.ctx.currentTime);
        this.master.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);

        this._lastWubAt = -1; // throttle guard for retriggered wubs
        this.initialized = true;
    }

    // Lazily-built white-noise buffer, reused by friction/scrape voices.
    _noiseBuffer() {
        if (this._noise) return this._noise;
        const len = Math.floor(this.ctx.sampleRate * 0.3);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this._noise = buf;
        return buf;
    }
    
    playBeep() {
        if (!this.initialized) return;
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, this.ctx.currentTime); // A4
        osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
        
        osc.connect(gainNode);
        gainNode.connect(this.master);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.1);
    }
    
    playDoot() {
        if (!this.initialized) return;
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, this.ctx.currentTime);
        
        gainNode.gain.setValueAtTime(0.05, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
        
        osc.connect(gainNode);
        gainNode.connect(this.master);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
    }
    
    playDeath() {
        if (!this.initialized) return;
        
        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.ctx.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.2, this.ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);

        osc.connect(gainNode);
        gainNode.connect(this.master);

        osc.start();
        osc.stop(this.ctx.currentTime + 0.5);
    }

    // Diegetic: the sound of corrupted Data bleeding into your body as you slither
    // past a Glitch. An ominous dubstep "wub" — a resonant low-pass filter wobbled
    // by an LFO over a detuned sub-bass. Closer proximity = higher, more frantic wubs.
    // `intensity` in (0, 1]; 1 == the Glitch is one tile from your body.
    playWub(intensity = 1) {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        // Throttle: while a long body drags past a Glitch this can retrigger every
        // 30ms (gear 3). Cap the rate so voices layer into a groove, not a smear.
        if (now - this._lastWubAt < 0.06) return;
        this._lastWubAt = now;

        const amt = Math.max(0.05, Math.min(1, intensity));
        const dur = 0.20 + amt * 0.16; // 0.20 - 0.36s

        // Detuned sub-bass: the "voice" of the corruption
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        const fundamental = 44 + amt * 26; // 44 - 70 Hz, felt more than heard
        osc1.frequency.setValueAtTime(fundamental, now);
        osc2.frequency.setValueAtTime(fundamental, now);
        osc2.detune.setValueAtTime(-14, now); // grit

        // Resonant low-pass filter — this is what makes it a "wub"
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.Q.setValueAtTime(9 + amt * 6, now); // 9 - 15 resonance

        // Center the sweep so the cutoff stays ABOVE zero across the whole LFO
        // cycle. If the trough went negative the BiquadFilter would clamp to 0 and
        // gate the bass silent for part of every wobble — a chop, not a "wob".
        const centre = 320 + amt * 430; // 320 - 750 Hz
        const depth = 240 + amt * 380;  // 240 - 620 Hz  (< centre, so trough > 0)
        filter.frequency.setValueAtTime(centre, now);

        // LFO wobbles the filter cutoff open/closed -> the "wob-wob-wob".
        // Floor the rate high enough that even a short (distant) wub completes
        // ~2 cycles and reads as a wobble rather than a single blip.
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(9 + amt * 9, now); // 9 - 18 Hz
        const lfoDepth = this.ctx.createGain();
        lfoDepth.gain.setValueAtTime(depth, now);
        lfo.connect(lfoDepth);
        lfoDepth.connect(filter.frequency);

        // Amp envelope
        const gainNode = this.ctx.createGain();
        const peak = 0.04 + amt * 0.11; // kept modest; sub-bass + limiter carry it
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(peak, now + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.master);

        osc1.start(now); osc2.start(now); lfo.start(now);
        osc1.stop(now + dur); osc2.stop(now + dur); lfo.stop(now + dur);
    }

    // Diegetic: the friction of your mass scraping the neon quarantine barrier as
    // you glide along a wall. A real scrape is broadband noise, so this is filtered
    // white noise (not a tuned oscillator) through a band-pass that brightens with
    // speed. `intensity` in (0, 1]; scales with gear/velocity.
    playGlide(intensity = 0.5) {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        const amt = Math.max(0.1, Math.min(1, intensity));
        const dur = 0.09;

        const src = this.ctx.createBufferSource();
        src.buffer = this._noiseBuffer();

        // Band-pass centre rises with speed -> a faster scrape sounds brighter/thinner.
        const band = this.ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.setValueAtTime(1200 + amt * 2600, now); // 1.2k - 3.8k Hz
        band.Q.setValueAtTime(0.7, now); // wide, so it reads as abrasive noise not a pitch

        // High-pass above the band strips any low-end rumble, keeping it thin.
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(700, now);

        const gainNode = this.ctx.createGain();
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.04 + amt * 0.04, now + 0.008);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        src.connect(band);
        band.connect(hp);
        hp.connect(gainNode);
        gainNode.connect(this.master);

        src.start(now);
        src.stop(now + dur);
    }

    // Diegetic: the system EXTRUDING quarantine walls into existence (score 10).
    // A rising pitch sweep (barriers growing) capped by a bright "lock" click as
    // they snap into place. The opposite gesture to the descending death drone.
    playMaterialize() {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.22); // walls extruding
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.14, now + 0.05);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        osc.connect(g); g.connect(this.master);
        osc.start(now); osc.stop(now + 0.3);

        // Bright click: the barriers locking into place.
        const click = this.ctx.createOscillator();
        click.type = 'square';
        click.frequency.setValueAtTime(1400, now + 0.22);
        const cg = this.ctx.createGain();
        cg.gain.setValueAtTime(0.0001, now + 0.22);
        cg.gain.exponentialRampToValueAtTime(0.08, now + 0.23);
        cg.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        click.connect(cg); cg.connect(this.master);
        click.start(now + 0.22); click.stop(now + 0.3);
    }

    // Diegetic: corrupted Data BITING into you on Glitch contact (you usually
    // survive, losing segments) — a short harsh dissonant gnash + noise scratch,
    // deliberately NOT the death drone.
    playCorruptHit() {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        const dur = 0.18;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth'; osc2.type = 'square';
        osc1.frequency.setValueAtTime(240, now);
        osc1.frequency.exponentialRampToValueAtTime(90, now + dur);
        osc2.frequency.setValueAtTime(240 * 1.06, now); // dissonant detune -> harsh
        osc2.frequency.exponentialRampToValueAtTime(95, now + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(600, now);
        filter.Q.setValueAtTime(3, now);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        // Noise scratch transient on the bite.
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer();
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.12, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

        osc1.connect(filter); osc2.connect(filter); filter.connect(g); g.connect(this.master);
        noise.connect(ng); ng.connect(this.master);
        osc1.start(now); osc2.start(now); noise.start(now);
        osc1.stop(now + dur); osc2.stop(now + dur); noise.stop(now + 0.05);
    }

    // Diegetic: 2-Bit yanking you back when you try to abandon him — a soft
    // rubber-band tug (bend down, spring back). Nobody dies; nothing terminates.
    playDenied() {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        const dur = 0.16;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.06); // tug down
        osc.frequency.linearRampToValueAtTime(240, now + dur);  // spring back
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(g); g.connect(this.master);
        osc.start(now); osc.stop(now + dur);
    }

    // Diegetic: the violent IMPACT of ramming through the quarantine wall — a
    // filtered noise burst (debris) over a low thud, not a process termination.
    playCrash() {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        const dur = 0.35;

        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer();
        noise.loop = true; // fill the full crash duration
        const nf = this.ctx.createBiquadFilter();
        nf.type = 'lowpass';
        nf.frequency.setValueAtTime(2000, now);
        nf.frequency.exponentialRampToValueAtTime(200, now + dur); // debris settling
        const ng = this.ctx.createGain();
        ng.gain.setValueAtTime(0.3, now);
        ng.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        const thud = this.ctx.createOscillator();
        thud.type = 'sine';
        thud.frequency.setValueAtTime(120, now);
        thud.frequency.exponentialRampToValueAtTime(45, now + 0.2);
        const tg = this.ctx.createGain();
        tg.gain.setValueAtTime(0.0001, now);
        tg.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
        tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

        noise.connect(nf); nf.connect(ng); ng.connect(this.master);
        thud.connect(tg); tg.connect(this.master);
        noise.start(now); noise.stop(now + dur);
        thud.start(now); thud.stop(now + 0.25);
    }

    // Diegetic: a partial hit on a weak wall — a sharp fracture crackle, lighter
    // than the full breach (playCrash). Sub-max ramming chips the barrier.
    playCrack() {
        if (!this.initialized) return;

        const now = this.ctx.currentTime;
        const dur = 0.12;
        const noise = this.ctx.createBufferSource();
        noise.buffer = this._noiseBuffer();
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1800, now);
        bp.Q.setValueAtTime(1.2, now);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.2, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        noise.connect(bp); bp.connect(g); g.connect(this.master);
        noise.start(now); noise.stop(now + dur);
    }
}
