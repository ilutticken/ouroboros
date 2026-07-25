/**
 * @vitest-environment happy-dom
 */
// THE AUDIO BOUNDARY. Every other suite replaces AudioEngine's methods with spies, so
// its ~700 lines of from-scratch synthesis had zero execution coverage: a typo in a
// voice would ship silently, and the "Total Diegesis" sound design would be checked only
// by ear. These tests run the REAL AudioEngine against a recording fake AudioContext
// (see installFakeAudio) and assert the things that are actually structural:
//
//   - the master -> duck -> limiter -> destination bus, and that NOTHING bypasses it
//   - the pre-init contract (no gesture yet = no nodes, no throws)
//   - the a11y controls (volume clamp, mute, the coil duck's ramp-never-step rule)
//   - the wub throttle, the layered soundtrack, and that stopping cleans up its timers
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioEngine } from '../src/engine/Audio.js';
import { installFakeAudio } from './helpers.js';

// Every one-shot voice the game can trigger. Used to prove the bus invariant holds for
// ALL of them, so a new sound can't quietly route around the limiter.
const VOICES = [
    'playBeep', 'playBump', 'playDoot', 'playDeath', 'playWub', 'playGlide',
    'playMaterialize', 'playCorruptHit', 'playDenied', 'playCrash', 'playCadenzaSong',
    'playScannerPing', 'playCrack', 'playEncoreNote',
];

describe('AudioEngine (real synthesis, fake AudioContext)', () => {
    let fake;
    let audio;

    beforeEach(() => {
        fake = installFakeAudio();
        audio = new AudioEngine();
    });

    afterEach(() => {
        audio.stopMusic();
        audio.stopVoidAmbient();
        fake.uninstall();
    });

    describe('the bus', () => {
        it('init() wires master -> duck -> limiter -> destination', () => {
            audio.init();
            expect(fake.connections).toEqual(
                expect.arrayContaining([['gain', 'gain'], ['gain', 'compressor'], ['compressor', 'destination']])
            );
            expect(audio.initialized).toBe(true);
        });

        it('init() is idempotent — a second user gesture does not rebuild the bus', () => {
            audio.init();
            const built = fake.nodes.length;
            audio.init();
            expect(fake.nodes.length).toBe(built);
        });

        it('configures the limiter so overlapping voices cannot hard-clip', () => {
            audio.init();
            const comp = fake.of('compressor')[0];
            expect(comp).toBeDefined();
            expect(comp.threshold.value).toBeLessThan(0);
            expect(comp.ratio.value).toBeGreaterThan(1);
            // A limiter with a slow attack lets the transient through; keep it fast.
            expect(comp.attack.value).toBeLessThan(0.02);
        });

        it('NO voice bypasses the bus — destination has exactly one input, the limiter', () => {
            audio.init();
            for (const v of VOICES) {
                audio.currentTime = 0;
                audio._lastWubAt = -1; // defeat the throttle so playWub actually builds
                audio[v]();
            }
            audio.setMusicLayer(3);
            audio.startVoidAmbient();

            const toDest = fake.connections.filter(([, to]) => to === 'destination');
            expect(toDest).toEqual([['compressor', 'destination']]);
        });

        it('every one-shot voice actually builds and schedules something', () => {
            audio.init();
            for (const v of VOICES) {
                fake.reset();
                audio._lastWubAt = -1;
                audio[v]();
                const sources = [...fake.of('oscillator'), ...fake.of('bufferSource')];
                expect(sources.length, `${v} created no sound source`).toBeGreaterThan(0);
                // Anything that starts must also be scheduled to stop, or the voice
                // runs forever and the node is never collected.
                for (const s of sources) {
                    expect(s.started, `${v}: a source was never started`).not.toBeNull();
                    expect(s.stopped, `${v}: a source was never stopped`).not.toBeNull();
                    expect(s.stopped).toBeGreaterThan(s.started);
                }
            }
        });
    });

    describe('before the first user gesture', () => {
        it('every voice no-ops silently — no context, no nodes, no throw', () => {
            for (const v of VOICES) expect(() => audio[v]()).not.toThrow();
            expect(() => audio.startVoidAmbient()).not.toThrow();
            expect(audio.ctx).toBeNull();
            expect(fake.nodes).toHaveLength(0);
        });

        it('setVolume / setDuck are safe early and the volume survives to init()', () => {
            audio.setVolume(0.8);
            audio.setDuck(0.5);
            expect(audio.masterVolume).toBe(0.8);

            audio.init();
            // The master gain must boot at the volume already chosen, not the default —
            // otherwise the Options setting is ignored until you next touch the slider.
            expect(fake.of('gain')[0].gain.value).toBeCloseTo(0.8);
        });
    });

    describe('accessibility controls', () => {
        it('setVolume clamps to 0..1 and drives the live master gain', () => {
            audio.init();
            const master = fake.of('gain')[0];

            audio.setVolume(0.25);
            expect(master.gain.value).toBeCloseTo(0.25);

            audio.setVolume(5);
            expect(audio.masterVolume).toBe(1);
            audio.setVolume(-3);
            expect(audio.masterVolume).toBe(0);
            expect(master.gain.value).toBe(0);
        });

        it('the coil duck RAMPS, never steps — approaching the Kernel must not click', () => {
            audio.init();
            fake.reset();
            audio.setDuck(0);
            const ramps = fake.automation.filter(a => a.name === 'gain' && a.how === 'linear');
            expect(ramps.length).toBeGreaterThan(0);
        });

        it('a full duck floors at 0.0001, never a true zero', () => {
            audio.init();
            audio.setDuck(0);
            const duck = fake.of('gain')[1]; // master, duck, limiter — in build order
            expect(duck.gain.value).toBeGreaterThan(0);
            expect(duck.gain.value).toBeLessThan(0.001);
        });

        it('setDuck clamps out-of-range input', () => {
            audio.init();
            audio.setDuck(9);
            const duck = fake.of('gain')[1];
            expect(duck.gain.value).toBeLessThanOrEqual(1);
        });
    });

    describe('the wub throttle', () => {
        it('collapses retriggers inside 60ms into one voice', () => {
            audio.init();
            fake.reset();

            audio.playWub(1);
            const first = fake.of('oscillator').length;
            expect(first).toBeGreaterThan(0);

            audio.playWub(1);                        // same instant — dragging a long body
            expect(fake.of('oscillator').length).toBe(first);

            fake.ctx.currentTime = 0.07;             // past the throttle window
            audio.playWub(1);
            expect(fake.of('oscillator').length).toBeGreaterThan(first);
        });

        it('keeps the wub filter cutoff above zero across the whole LFO cycle', () => {
            // If the sweep trough went negative the BiquadFilter clamps to 0 and gates
            // the bass silent for part of every wobble — a chop, not a "wob".
            audio.init();
            for (const intensity of [0.05, 0.5, 1]) {
                fake.reset();
                audio._lastWubAt = -1;
                audio.playWub(intensity);
                const filter = fake.of('filter')[0];
                const lfoDepth = fake.of('gain').find(g => g.gain.value > 1); // depth in Hz, not a level
                expect(filter.frequency.value).toBeGreaterThan(lfoDepth.gain.value);
            }
        });
    });

    describe('the layered soundtrack', () => {
        it('layer 0 means silence, and starting requires a gesture', () => {
            audio.setMusicLayer(2);
            expect(audio._music).toBeFalsy();   // no context yet

            audio.init();
            audio.setMusicLayer(0);
            expect(audio._music).toBeFalsy();
        });

        it('a higher layer adds voices rather than replacing them', () => {
            audio.init();

            audio.setMusicLayer(1);
            const atOne = fake.of('oscillator').length;
            expect(atOne).toBeGreaterThan(0);
            audio.stopMusic();

            fake.reset();
            audio.setMusicLayer(3);
            const atThree = fake.of('oscillator').length;
            expect(atThree).toBeGreaterThan(atOne);
        });

        it('clamps the layer to 0..3', () => {
            audio.init();
            audio.setMusicLayer(99);
            expect(audio._musicLayer).toBe(3);
            audio.stopMusic();
            audio.setMusicLayer(-4);
            expect(audio._musicLayer).toBe(0);
        });

        it('stopMusic clears the scheduler and fades sounding voices out', () => {
            audio.init();
            audio.setMusicLayer(2);
            expect(audio._music).toBeTruthy();

            fake.reset();
            audio.stopMusic();

            expect(audio._music).toBeNull();
            expect(audio._musicLayer).toBe(0);
            // Voices already scheduled get ramped down, not cut — a hard stop clicks.
            expect(fake.automation.some(a => a.how === 'exp')).toBe(true);
        });

        it('the void ambient is idempotent and stops cleanly', () => {
            audio.init();
            audio.startVoidAmbient();
            const amb = audio._ambient;
            expect(amb).toBeTruthy();

            audio.startVoidAmbient();       // a second call must not stack a second pad
            expect(audio._ambient).toBe(amb);

            audio.stopVoidAmbient();
            expect(audio._ambient).toBeNull();
            expect(() => audio.stopVoidAmbient()).not.toThrow();
        });
    });
});
