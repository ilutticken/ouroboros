// The Ouroboros soundtrack — Cadenza's theme, as shared NOTE-DATA so the in-game player
// (Web Audio, src/engine/Audio.js) and the WAV demo generator (audio-demos/chiptune.js)
// render the SAME music and can never drift. Key: A minor, Am-F-C-G | F-C-G-Am (i-VI-III-VII).

export const BPM = 88;
export const LOOP_BEATS = 32; // the 8-bar theme loop (all channels below sum to this)

const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export function noteFreq(name) {
    if (name == null) return 0;
    const m = String(name).match(/^([A-G][#b]?)(-?\d)$/);
    if (!m) throw new Error('bad note ' + name);
    const midi = NAMES[m[1]] + (parseInt(m[2], 10) + 1) * 12;
    return 440 * Math.pow(2, (midi - 69) / 12);
}

export const cat = (...xs) => [].concat(...xs);
export const repeat = (seq, n) => { let o = []; for (let i = 0; i < n; i++) o = o.concat(seq); return o; };
export const arp = ([a, b, c]) => [[a, .5], [b, .5], [c, .5], [b, .5], [a, .5], [b, .5], [c, .5], [b, .5]]; // root-3-5-3 x2
const bassBar = (root) => [[root, 2], [root, 2]];
const percBar = () => [['k', .5], ['h', .5], ['h', .5], ['h', .5], ['k', .5], ['h', .5], ['h', .5], ['h', .5]];

// Note sequences: [ [noteName|null, beats], ... ]. Percussion uses 'k' (kick) / 'h' (hat).
export const MELODY = [
    ['A4', 1], ['C5', 1], ['E5', 2],                 // Am
    ['F5', 1], ['E5', 1], ['C5', 2],                 // F
    ['E5', 1], ['G5', 1], ['A5', 1], ['G5', 1],      // C
    ['D5', 2], ['B4', 2],                            // G
    ['A4', 1], ['C5', 1], ['F5', 2],                 // F
    ['E5', 1], ['G5', 1], ['E5', 2],                 // C
    ['D5', 1], ['B4', 1], ['G4', 2],                 // G
    ['A4', 4],                                       // Am (resolve home)
];
export const ARP = cat(
    arp(['A3', 'C4', 'E4']), arp(['F3', 'A3', 'C4']), arp(['C4', 'E4', 'G4']), arp(['G3', 'B3', 'D4']),
    arp(['F3', 'A3', 'C4']), arp(['C4', 'E4', 'G4']), arp(['G3', 'B3', 'D4']), arp(['A3', 'C4', 'E4']),
);
export const BASS = cat(
    bassBar('A2'), bassBar('F2'), bassBar('C2'), bassBar('G2'),
    bassBar('F2'), bassBar('C2'), bassBar('G2'), bassBar('A2'),
);
export const PERC = repeat(percBar(), 8);

// The in-game LAYERED soundtrack. Each channel switches on at a music layer (1-3) and stacks:
//   Layer 1 (Encore / Locked Groove) = bass groove
//   Layer 2 (Beat 8 reboot)          = + arpeggiated pulse ("audio gains a bassline")
//   Layer 3 (Beat 16, 32-bit)        = + melody + percussion (full symphony)
// Same note-data as the WAV demos; the player gates channels by the current layer.
export const THEME_CHANNELS = [
    { id: 'bass',   layer: 1, type: 'tri',                 vol: 0.30, env: { a: .01, d: .10, s: .85, r: .06 }, seq: BASS },
    { id: 'arp',    layer: 2, type: 'pulse', duty: 0.125,  vol: 0.11, env: { a: .005, d: .04, s: .25, r: .03 }, seq: ARP },
    { id: 'melody', layer: 3, type: 'pulse', duty: 0.25,   vol: 0.20, env: { a: .01, d: .08, s: .70, r: .08 }, vib: { rate: 5.5, depth: 0.006 }, seq: MELODY },
    { id: 'perc',   layer: 3, type: 'noise',               vol: 0.09, seq: PERC },
];
