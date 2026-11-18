// Sampled guitar engine on the Web Audio API.
// Each string plays the nearest recorded note, repitched with playbackRate; strums are staggered
// per string, a new note on a string damps the one before it (as a real string would), and
// everything runs through a light compressor and a generated room reverb.
import { TUNING } from './styles';
import type { Fret } from './voicings';

export type InstrumentId = 'acoustic' | 'nylon' | 'electric';

// Recordings in public/samples/<instrument>/ (tonejs-instruments, MIT).
const SAMPLE_NOTES: Record<InstrumentId, string[]> = {
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
    if (!p) {
      const base = import.meta.env.BASE_URL;
      p = Promise.all(
        SAMPLE_NOTES[inst].map(async (n) => {
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
    const hits = PATTERNS[o.pattern].hits;
    hits.forEach(([pos, up], h) => {
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

/** One chord, one down-strum, now. */
export async function playShape(frets: Fret[], strumMs: number, ring: number) {
  const ctx = await engine.resume();
  const bufs = await engine.load(engine.instrument);
  engine.strum(bufs, frets, ctx.currentTime + 0.02, { strumMs, ring, duration: 1.2 + ring * 2 });
}
