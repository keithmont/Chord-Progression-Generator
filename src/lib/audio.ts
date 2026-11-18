// Sampled guitar engine on the Web Audio API.
// Each string plays the nearest recorded note, repitched with playbackRate; strums are staggered
// per string, a new note on a string damps the one before it (as a real string would), and
// everything runs through a light compressor and a generated room reverb.
import { TUNING } from './styles';
import type { Fret } from './voicings';

export type SampledId = 'acoustic' | 'nylon' | 'electric';
export type InstrumentId = SampledId | 'pad';

// Recordings in public/samples/<instrument>/ (tonejs-instruments, MIT).
const SAMPLE_NOTES: Record<SampledId, string[]> = {
  acoustic: ['D2', 'Ds2', 'E2', 'F2', 'Fs2', 'G2', 'Gs2', 'A2', 'As2', 'B2', 'C3', 'Cs3', 'D3', 'Ds3', 'E3', 'F3', 'Fs3', 'G3', 'Gs3', 'A3', 'As3', 'B3', 'C4', 'Cs4', 'D4', 'Ds4', 'E4', 'F4', 'Fs4', 'G4', 'Gs4', 'A4', 'As4', 'B4', 'C5', 'Cs5', 'D5'],
  nylon: ['B1', 'D2', 'E2', 'Fs2', 'Gs2', 'A2', 'B2', 'Cs3', 'D3', 'E3', 'Fs3', 'G3', 'A3', 'B3', 'Cs4', 'Ds4', 'E4', 'Fs4', 'Gs4', 'A4', 'B4', 'Cs5', 'D5', 'E5', 'Fs5', 'G5', 'Gs5', 'A5', 'As5'],
  electric: ['Cs2', 'E2', 'Fs2', 'A2', 'C3', 'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5', 'A5', 'C6'],
};

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function noteToMidi(n: string): number {
  const m = /^([A-G])(s?)(\d)$/.exec(n)!;
  return (Number(m[3]) + 1) * 12 + PC[m[1]] + (m[2] ? 1 : 0);
}

export interface StrumOptions {
  strumMs: number;   // gap between strings
  ring: number;      // 0..1 → how long notes sustain after the next strum point
  velocity?: number; // 0..1
  up?: boolean;      // up-strum: high to low, top four strings, softer
  duration?: number; // seconds until release
}

class Engine {
  ctx: AudioContext | null = null;
  private out!: GainNode;
  private buffers = new Map<InstrumentId, Promise<Map<number, AudioBuffer>>>();
  private padVoices: { gain: GainNode; oscs: OscillatorNode[] }[] = [];
  private padOut!: GainNode;
  private stringVoices: ({ src: AudioBufferSourceNode; gain: GainNode } | null)[] = [null, null, null, null, null, null];
  instrument: InstrumentId = 'acoustic';
  volume = 0.8;

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const master = ctx.createGain();
    master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.2;
    // small room: decaying stereo noise impulse
    const len = Math.floor(ctx.sampleRate * 1.6);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    const verb = ctx.createConvolver(); verb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = 0.16;
    const dry = ctx.createGain(); dry.gain.value = 1;
    dry.connect(comp); verb.connect(wet).connect(comp);
    comp.connect(master).connect(ctx.destination);
    this.out = ctx.createGain();
    this.out.connect(dry); this.out.connect(verb);
    // the pad sits further back: same dry path plus a bigger reverb send
    this.padOut = ctx.createGain();
    const padSend = ctx.createGain(); padSend.gain.value = 3.2;
    this.padOut.connect(dry); this.padOut.connect(padSend).connect(verb);
    this.masterGain = master;
    this.ctx = ctx;
    return ctx;
  }
  private masterGain: GainNode | null = null;

  setVolume(v: number) {
    this.volume = v;
    if (this.masterGain && this.ctx) this.masterGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  load(inst: InstrumentId): Promise<Map<number, AudioBuffer>> {
    const ctx = this.ensure();
    let p = this.buffers.get(inst);
    if (!p && inst === 'pad') {
      p = Promise.resolve(new Map()); // synthesised: nothing to load
      this.buffers.set(inst, p);
    }
    if (!p) {
      const base = import.meta.env.BASE_URL;
      p = Promise.all(
        SAMPLE_NOTES[inst as SampledId].map(async (n) => {
          const res = await fetch(`${base}samples/${inst}/${n}.mp3`);
          const buf = await ctx.decodeAudioData(await res.arrayBuffer());
          return [noteToMidi(n), buf] as const;
        }),
      ).then((pairs) => new Map(pairs));
      p.catch(() => this.buffers.delete(inst));
      this.buffers.set(inst, p);
    }
    return p;
  }

  async resume() {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') await ctx.resume();
    return ctx;
  }

  private nearest(bufs: Map<number, AudioBuffer>, midi: number): [number, AudioBuffer] {
    let best = -1, bestD = Infinity;
    for (const m of bufs.keys()) {
      const d = Math.abs(m - midi) + (m > midi ? 0.1 : 0); // prefer pitching up slightly
      if (d < bestD) { bestD = d; best = m; }
    }
    return [best, bufs.get(best)!];
  }

  /** Schedule one strum at audio time `when`. Samples must be loaded. */
  strum(bufs: Map<number, AudioBuffer>, frets: Fret[], when: number, o: StrumOptions) {
    const ctx = this.ctx!;
    let order = [0, 1, 2, 3, 4, 5].filter((i) => frets[i] !== 'x');
    if (o.up) order = order.filter((i) => i >= 2).reverse();
    const vel = (o.velocity ?? 0.9) * (o.up ? 0.65 : 1);
    const dur = o.duration ?? 2;
    const release = 0.08 + o.ring * 2.4;
    order.forEach((s, k) => {
      const midi = TUNING[s] + (frets[s] as number);
      const [sm, buf] = this.nearest(bufs, midi);
      const t = when + (k * o.strumMs) / 1000 + Math.random() * 0.004;
      const prev = this.stringVoices[s];
      if (prev) {
        prev.gain.gain.cancelScheduledValues(t);
        prev.gain.gain.setTargetAtTime(0, t, 0.015);
        prev.src.stop(t + 0.2);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = Math.pow(2, (midi - sm) / 12);
      const g = ctx.createGain();
      // louder low strings sit back a little; tiny random humanise
      const level = vel * (0.32 + Math.random() * 0.05) * (s < 2 ? 0.85 : 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.004);
      g.gain.setValueAtTime(level, t + dur);
      g.gain.setTargetAtTime(0, t + dur, release / 4);
      src.connect(g).connect(this.out);
      src.start(t);
      src.stop(t + dur + release + 0.5);
      const voice = { src, gain: g };
      this.stringVoices[s] = voice;
      src.onended = () => { if (this.stringVoices[s] === voice) this.stringVoices[s] = null; };
    });
  }

  /**
   * A soft synth pad: per note, two detuned saws spread left/right plus a sine an octave down,
   * through a low-pass filter with a slow wobble, faded in and out. A new chord cross-fades the last.
   */
  pad(frets: Fret[], when: number, o: { duration: number; ring: number; spreadMs: number }) {
    const ctx = this.ctx!;
    const notes = [...new Set(frets.flatMap((f, s) => (f === 'x' ? [] : [TUNING[s] + f])))].sort((a, b) => a - b);
    if (!notes.length) return;
    // lift very low notes an octave so the pad stays soft; keep the bass note as is
    const voiced = notes.map((m, i) => (i > 0 && m < 52 ? m + 12 : m));
    const attack = 0.35 + o.ring * 0.5;
    const release = 0.6 + o.ring * 3;
    for (const v of this.padVoices) {
      v.gain.gain.cancelScheduledValues(when);
      v.gain.gain.setTargetAtTime(0, when, 0.35);
      v.oscs.forEach((osc) => { try { osc.stop(when + 2.5); } catch { /* already stopping */ } });
    }
    this.padVoices = [];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.Q.value = 0.6;
    filter.frequency.setValueAtTime(500, when);
    filter.frequency.linearRampToValueAtTime(1500 + o.ring * 600, when + attack * 1.5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.18;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 220;
    lfo.connect(lfoAmt).connect(filter.frequency);
    filter.connect(this.padOut);

    const end = when + o.duration + release * 4;
    const level = 0.22 / Math.sqrt(voiced.length);
    voiced.forEach((m, i) => {
      const t = when + (i * o.spreadMs) / 1000;
      const hz = 440 * Math.pow(2, (m - 69) / 12);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + attack);
      g.gain.setValueAtTime(level, when + o.duration);
      g.gain.setTargetAtTime(0, when + o.duration, release / 3);
      g.connect(filter);
      const oscs: OscillatorNode[] = [];
      for (const [type, mult, cents, pan, amt] of [
        ['sawtooth', 1, -7, -0.6, 0.5], ['sawtooth', 1, 7, 0.6, 0.5], ['sine', 0.5, 0, 0, 0.6],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = type; osc.frequency.value = hz * mult; osc.detune.value = cents;
        const a = ctx.createGain(); a.gain.value = amt;
        const p = ctx.createStereoPanner(); p.pan.value = pan;
        osc.connect(a).connect(p).connect(g);
        osc.start(t); osc.stop(end);
        oscs.push(osc);
      }
      this.padVoices.push({ gain: g, oscs });
    });
    lfo.start(when); lfo.stop(end);
  }

  /** Stop everything quickly. */
  hush() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.stringVoices.forEach((v, i) => {
      if (!v) return;
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.03);
      try { v.src.stop(t + 0.3); } catch { /* already stopped */ }
      this.stringVoices[i] = null;
    });
    for (const v of this.padVoices) {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0, t, 0.08);
      v.oscs.forEach((o) => { try { o.stop(t + 0.6); } catch { /* already stopped */ } });
    }
    this.padVoices = [];
  }
}

export const engine = new Engine();

// Strum patterns: [beat position within a 4-beat bar, up-strum?]
export const PATTERNS = {
  whole: { name: 'Whole', hits: [[0, false]] as [number, boolean][] },
  half: { name: 'Halves', hits: [[0, false], [2, false]] as [number, boolean][] },
  quarter: { name: 'Quarters', hits: [[0, false], [1, false], [2, false], [3, false]] as [number, boolean][] },
  folk: { name: 'D DU UDU', hits: [[0, false], [1, false], [1.5, true], [2.5, true], [3, false], [3.5, true]] as [number, boolean][] },
};
export type PatternId = keyof typeof PATTERNS;

export interface TransportOptions {
  bpm: number;
  pattern: PatternId;
  strumMs: number;
  ring: number;
  loop: boolean;
  onStep?: (index: number | null) => void;
}

/** Plays a list of shapes, one bar each. Returns a stop function. */
export async function playSequence(shapes: Fret[][], opts: () => TransportOptions): Promise<() => void> {
  const ctx = await engine.resume();
  const bufs = await engine.load(engine.instrument);
  let stopped = false;
  const timers: number[] = [];
  let bar = 0;
  let barStart = ctx.currentTime + 0.08;

  const scheduleBar = () => {
    if (stopped) return;
    const o = opts();
    if (bar >= shapes.length) {
      if (!o.loop) {
        timers.push(window.setTimeout(() => { if (!stopped) o.onStep?.(null); }, Math.max(0, (barStart - ctx.currentTime) * 1000)));
        return;
      }
      bar = 0;
    }
    const beat = 60 / o.bpm;
    const idx = bar;
    if (engine.instrument === 'pad') {
      // one sustained chord per bar, overlapping into the next
      engine.pad(shapes[idx], barStart, { duration: 4 * beat, ring: o.ring, spreadMs: o.strumMs });
    } else PATTERNS[o.pattern].hits.forEach(([pos, up], h) => {
      const hits = PATTERNS[o.pattern].hits;
      const next = h + 1 < hits.length ? hits[h + 1][0] : 4;
      engine.strum(bufs, shapes[idx], barStart + pos * beat, {
        strumMs: up ? o.strumMs * 0.7 : o.strumMs, ring: o.ring, up,
        velocity: pos === 0 ? 0.95 : 0.8,
        duration: Math.max(0.15, (next - pos) * beat * (0.5 + o.ring * 0.5)),
      });
    });
    timers.push(window.setTimeout(() => { if (!stopped) o.onStep?.(idx); }, Math.max(0, (barStart - ctx.currentTime) * 1000)));
    barStart += 4 * beat;
    bar++;
    // schedule the next bar shortly before it starts
    timers.push(window.setTimeout(scheduleBar, Math.max(0, (barStart - ctx.currentTime - 0.25) * 1000)));
  };
  scheduleBar();

  return () => {
    stopped = true;
    timers.forEach((t) => clearTimeout(t));
    engine.hush();
    opts().onStep?.(null);
  };
}

/** One chord now: a down-strum, or a swell on the pad. */
export async function playShape(frets: Fret[], strumMs: number, ring: number) {
  const ctx = await engine.resume();
  const bufs = await engine.load(engine.instrument);
  if (engine.instrument === 'pad') engine.pad(frets, ctx.currentTime + 0.02, { duration: 1.6 + ring * 2, ring, spreadMs: strumMs });
  else engine.strum(bufs, frets, ctx.currentTime + 0.02, { strumMs, ring, duration: 1.2 + ring * 2 });
}
