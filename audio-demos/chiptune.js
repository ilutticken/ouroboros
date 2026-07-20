// Ouroboros — a tiny dependency-free NES-style chiptune synth.
// Renders candidate background-music loops to 16-bit mono WAV so they can be auditioned.
// Run:  node audio-demos/chiptune.js   (writes *.wav next to this file)
//
// Design notes (how "pleasant 8-bit" is made here — see README.md):
//  - NES-style voice budget: 2 PULSE channels (melody + arpeggio), 1 TRIANGLE (bass),
//    1 NOISE (percussion). That's the palette the 16/32-bit eras will thicken, not replace.
//  - PULSE duty cycle is the timbre knob: 12.5% = thin/reedy (arps), 25% = round/vocal
//    (melody), 50% = hollow/soft (pads).
//  - Per-note ADSR envelopes stop the "held oscillator" drone (the current annoyance):
//    a quick attack + decay to a sustain, then a short release, so every note has shape.
//  - Chords are implied by fast ARPEGGIOS on one pulse channel (the classic NES trick),
//    not real polyphony.
//  - A gentle VIBRATO on the melody gives Cadenza's line a singer's waver.
//  - Progression: A-minor  Am - F - C - G | F - C - G - Am  (i-VI-III-VII), a warm,
//    wistful loop that resolves home — the through-line to layer on later.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SR = 44100;

const NAMES = { C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11 };
function noteFreq(name) {
    if (name == null) return 0;
    const m = String(name).match(/^([A-G][#b]?)(-?\d)$/);
    if (!m) throw new Error('bad note ' + name);
    const midi = NAMES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
}
const frac = (x) => x - Math.floor(x);
const pulse = (ph, duty) => (frac(ph) < duty ? 1 : -1);
const tri = (ph) => { const p = frac(ph); return p < 0.5 ? 4 * p - 1 : 3 - 4 * p; };

function envAt(t, dur, e) {
    const { a = 0.01, d = 0.06, s = 0.7, r = 0.06 } = e || {};
    const rel = dur - r;
    if (t < a) return t / a;
    if (t < a + d) return 1 - (1 - s) * ((t - a) / d);
    if (t < rel) return s;
    if (t < dur) return s * Math.max(0, 1 - (t - rel) / r);
    return 0;
}

// A monophonic melodic channel. seq = [[note|null, beats], ...]
function renderChannel(buf, ch, bpm) {
    const spb = 60 / bpm;
    let cursor = 0;
    for (const [note, beats] of ch.seq) {
        const dur = beats * spb;
        if (note != null) {
            const f0 = noteFreq(note);
            const n = Math.floor(dur * SR);
            const start = Math.floor(cursor * SR);
            let ph = 0;
            for (let i = 0; i < n; i++) {
                const t = i / SR;
                const f = ch.vib ? f0 * (1 + ch.vib.depth * Math.sin(2 * Math.PI * ch.vib.rate * t)) : f0;
                ph += f / SR;
                let s;
                if (ch.type === 'pulse') s = pulse(ph, ch.duty);
                else if (ch.type === 'tri') s = tri(ph);
                else s = Math.random() * 2 - 1;
                const idx = start + i;
                if (idx < buf.length) buf[idx] += s * envAt(t, dur, ch.env) * ch.vol;
            }
        }
        cursor += dur;
    }
}

// Percussion channel. seq = [[hit|null, beats], ...], hit = 'k' (kick) | 'h' (hat)
function renderPerc(buf, seq, bpm, vol) {
    const spb = 60 / bpm;
    let cursor = 0;
    for (const [hit, beats] of seq) {
        const dur = beats * spb;
        if (hit) {
            const isK = hit === 'k';
            const len = isK ? 0.11 : 0.03;
            const n = Math.floor(len * SR);
            const start = Math.floor(cursor * SR);
            let ph = 0;
            for (let i = 0; i < n; i++) {
                const t = i / SR;
                let s;
                if (isK) { const f = 120 * Math.pow(0.5, t * 32); ph += f / SR; s = tri(ph); }
                else { s = Math.random() * 2 - 1; }
                const e = Math.max(0, 1 - t / len);
                const idx = start + i;
                if (idx < buf.length) buf[idx] += s * e * e * vol * (isK ? 1.7 : 0.5);
            }
        }
        cursor += dur;
    }
}

const limit = (buf) => { for (let i = 0; i < buf.length; i++) buf[i] = Math.tanh(buf[i] * 1.1); };

function writeWav(file, buf) {
    const n = buf.length, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8);
    b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
    b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, buf[i])); b.writeInt16LE(Math.round(s * 32767), 44 + i * 2); }
    fs.writeFileSync(file, b);
}

// ---- Composition -------------------------------------------------------------------
const BPM = 88;
const cat = (...xs) => [].concat(...xs);
const repeat = (seq, n) => { let o = []; for (let i = 0; i < n; i++) o = o.concat(seq); return o; };
const arp = ([a, b, c]) => [[a, .5], [b, .5], [c, .5], [b, .5], [a, .5], [b, .5], [c, .5], [b, .5]]; // root-3-5-3 x2
const bassBar = (root) => [[root, 2], [root, 2]];
const percBar = () => [['k', .5], ['h', .5], ['h', .5], ['h', .5], ['k', .5], ['h', .5], ['h', .5], ['h', .5]];

const MELODY = [
    ['A4', 1], ['C5', 1], ['E5', 2],                 // Am
    ['F5', 1], ['E5', 1], ['C5', 2],                 // F
    ['E5', 1], ['G5', 1], ['A5', 1], ['G5', 1],      // C
    ['D5', 2], ['B4', 2],                            // G
    ['A4', 1], ['C5', 1], ['F5', 2],                 // F
    ['E5', 1], ['G5', 1], ['E5', 2],                 // C
    ['D5', 1], ['B4', 1], ['G4', 2],                 // G
    ['A4', 4],                                       // Am (resolve home)
];
const ARP = cat(
    arp(['A3', 'C4', 'E4']), arp(['F3', 'A3', 'C4']), arp(['C4', 'E4', 'G4']), arp(['G3', 'B3', 'D4']),
    arp(['F3', 'A3', 'C4']), arp(['C4', 'E4', 'G4']), arp(['G3', 'B3', 'D4']), arp(['A3', 'C4', 'E4']),
);
const BASS = cat(
    bassBar('A2'), bassBar('F2'), bassBar('C2'), bassBar('G2'),
    bassBar('F2'), bassBar('C2'), bassBar('G2'), bassBar('A2'),
);
const PAD = cat(
    [['A3', 4]], [['F3', 4]], [['C4', 4]], [['G3', 4]],
    [['F3', 4]], [['C4', 4]], [['G3', 4]], [['A3', 4]],
);
const PERC = repeat(percBar(), 8);

const LOOPS = 2;                       // render two passes so the loop point is audible
const TOTAL_BEATS = 32 * LOOPS;
const N = Math.ceil(TOTAL_BEATS * (60 / BPM) * SR);
const newBuf = () => new Float32Array(N);
const L = (seq) => repeat(seq, LOOPS);

// 01 — Cadenza's Theme: melody + arpeggio + bass. The main candidate (replaces the drone).
{
    const buf = newBuf();
    renderChannel(buf, { type: 'pulse', duty: 0.25, vol: 0.22, env: { a: .01, d: .08, s: .7, r: .08 }, vib: { rate: 5.5, depth: 0.006 }, seq: L(MELODY) }, BPM);
    renderChannel(buf, { type: 'pulse', duty: 0.125, vol: 0.10, env: { a: .005, d: .04, s: .25, r: .03 }, seq: L(ARP) }, BPM);
    renderChannel(buf, { type: 'tri', vol: 0.32, env: { a: .01, d: .10, s: .85, r: .06 }, seq: L(BASS) }, BPM);
    limit(buf); writeWav(path.join(__dirname, '01-cadenza-theme.wav'), buf);
}
// 02 — The Void (ambient baseline): soft pad + bass, NO melody. The quiet Layer-0/1 bed.
{
    const buf = newBuf();
    renderChannel(buf, { type: 'pulse', duty: 0.5, vol: 0.09, env: { a: .3, d: .5, s: .7, r: .4 }, seq: L(PAD) }, BPM);
    renderChannel(buf, { type: 'tri', vol: 0.26, env: { a: .02, d: .2, s: .8, r: .1 }, seq: L(BASS) }, BPM);
    limit(buf); writeWav(path.join(__dirname, '02-void-ambient.wav'), buf);
}
// 03 — Cadenza's Theme, Full: adds soft percussion — a taste of the fuller 16-bit build.
{
    const buf = newBuf();
    renderChannel(buf, { type: 'pulse', duty: 0.25, vol: 0.22, env: { a: .01, d: .08, s: .7, r: .08 }, vib: { rate: 5.5, depth: 0.006 }, seq: L(MELODY) }, BPM);
    renderChannel(buf, { type: 'pulse', duty: 0.125, vol: 0.11, env: { a: .005, d: .04, s: .25, r: .03 }, seq: L(ARP) }, BPM);
    renderChannel(buf, { type: 'tri', vol: 0.32, env: { a: .01, d: .10, s: .85, r: .06 }, seq: L(BASS) }, BPM);
    renderPerc(buf, L(PERC), BPM, 0.10);
    limit(buf); writeWav(path.join(__dirname, '03-cadenza-full.wav'), buf);
}
// 04 — Cadenza's MAIN THEME: the full mix, longer, with the plucking undertone playing
// ALONE for four bars to break up the loud sections. Structure (24 bars, ~65s):
//   [pluck-only x4] -> [FULL x8] -> [pluck-only x4] -> [FULL x8] -> loop.
{
    const BEATS = 96;
    const NN = Math.ceil(BEATS * (60 / BPM) * SR);
    const buf = new Float32Array(NN);
    const restBars = (n) => [[null, n * 4]];
    const ARP4 = cat(arp(['A3', 'C4', 'E4']), arp(['F3', 'A3', 'C4']), arp(['C4', 'E4', 'G4']), arp(['G3', 'B3', 'D4']));
    const MAIN_MELODY = cat(restBars(4), MELODY, restBars(4), MELODY);
    const MAIN_ARP    = cat(ARP4, ARP, ARP4, ARP);          // the plucking plays throughout
    const MAIN_BASS   = cat(restBars(4), BASS, restBars(4), BASS);
    const MAIN_PERC   = cat(restBars(4), PERC, restBars(4), PERC);
    renderChannel(buf, { type: 'pulse', duty: 0.25, vol: 0.22, env: { a: .01, d: .08, s: .7, r: .08 }, vib: { rate: 5.5, depth: 0.006 }, seq: MAIN_MELODY }, BPM);
    renderChannel(buf, { type: 'pulse', duty: 0.125, vol: 0.12, env: { a: .005, d: .04, s: .25, r: .03 }, seq: MAIN_ARP }, BPM);
    renderChannel(buf, { type: 'tri', vol: 0.32, env: { a: .01, d: .10, s: .85, r: .06 }, seq: MAIN_BASS }, BPM);
    renderPerc(buf, MAIN_PERC, BPM, 0.10);
    limit(buf); writeWav(path.join(__dirname, '04-cadenza-main-theme.wav'), buf);
}

console.log('Wrote 01-cadenza-theme, 02-void-ambient, 03-cadenza-full, 04-cadenza-main-theme (.wav) to ' + __dirname);
