// Builds src/data/voicings.json — the static voicing library the app reads.
// Run: npm run build:voicings
// For every root (12) × quality, enumerates every playable fingering in standard tuning
// (4-fret hand span, ≤4 fingers or a barre + 3), then files the best ones under each style.
import { writeFileSync } from 'node:fs';
import { ALL_QUALITIES, QUALITIES, Quality } from '../src/lib/theory';
import { STYLE_IDS, StyleId, TUNING, styleQualities } from '../src/lib/styles';

type Frets = number[]; // -1 = muted
const MAX_FRET = 15;
const KEEP = 10;

function analyse(f: Frets, rootPc: number, q: Quality) {
  const def = QUALITIES[q];
  const sounding = f.map((v, i) => (v >= 0 ? i : -1)).filter((i) => i >= 0);
  if (sounding.length < 2) return null;
  const first = sounding[0], last = sounding[sounding.length - 1];
  const internalMutes = last - first + 1 - sounding.length;
  if (internalMutes > 1) return null;

  const pcs = sounding.map((i) => (TUNING[i] + f[i] - rootPc + 120) % 12);
  if (!pcs.every((p) => def.tones.includes(p))) return null;
  const set = new Set(pcs);
  if (!def.required.every((r) => set.has(r))) return null;

  const fretted = sounding.filter((i) => f[i] > 0).map((i) => f[i]);
  const opens = sounding.filter((i) => f[i] === 0).length;
  let barre = false;
  if (fretted.length) {
    const lo = Math.min(...fretted), hi = Math.max(...fretted);
    if (hi - lo > 3) return null;
    if (fretted.length > 4) {
      const loIdx = sounding.filter((i) => f[i] === lo);
      if (loIdx.length < 2) return null;
      if (1 + fretted.filter((v) => v > lo).length > 4) return null;
      // nothing open or muted under the barre
      for (let i = loIdx[0]; i <= loIdx[loIdx.length - 1]; i++) if (f[i] <= 0) return null;
      barre = true;
    } else if (fretted.filter((v) => v === lo).length >= 2 && fretted.length === 4) {
      barre = false; // playable either way
    }
  }
  const maxFret = fretted.length ? Math.max(...fretted) : 0;
  const minFret = fretted.length ? Math.min(...fretted) : 0;
  return {
    n: sounding.length, first, last, internalMutes, opens, barre, maxFret, minFret,
    bassIsRoot: pcs[0] === 0, distinct: set.size, pcs,
  };
}

type A = NonNullable<ReturnType<typeof analyse>>;

// Each style: does this fingering belong, and how good is it (higher = better)?
const STYLE_RULES: Record<StyleId, (a: A, f: Frets) => number | null> = {
  open: (a) =>
    a.opens >= 1 && a.maxFret <= 4 && a.n >= 4 && a.bassIsRoot && a.internalMutes === 0 && a.first <= 2
      ? a.n * 2 + a.opens - a.maxFret * 0.5 : null,
  barre: (a, f) =>
    a.opens === 0 && a.n >= 5 && a.bassIsRoot && a.internalMutes === 0 && a.first <= 1 && a.barre && a.last === 5 && f[a.first] === a.minFret
      ? a.n * 2 - Math.abs(a.minFret - 5) * 0.2 : null,
  power: (a, f) =>
    a.n >= 2 && a.n <= 3 && a.bassIsRoot && a.internalMutes === 0 && a.first <= 2 && a.last === a.first + a.n - 1 && a.minFret <= 10
      ? a.n + (a.opens === 0 ? 1 : a.opens === 1 && f[a.first] === 0 ? 1.5 : -2) : null,
  shell: (a) =>
    a.n >= 3 && a.n <= 4 && a.bassIsRoot && a.first <= 1 && a.opens === 0 && a.distinct === a.n
      ? 10 - a.n + (a.internalMutes ? 1 : 0) - Math.abs(a.minFret - 5) * 0.1 : null,
  triad: (a) =>
    a.n === 3 && a.internalMutes === 0 && a.first >= 2 && a.distinct === 3 && a.opens === 0 && a.minFret <= 12
      ? 5 - (a.first === 2 ? 0.5 : 0) : null,
  twinkle: (a, f) =>
    a.opens >= 1 && a.n >= 4 && a.bassIsRoot && a.internalMutes <= 1 && a.maxFret >= 2
      ? a.opens * 2 + a.n + (a.maxFret >= 5 ? 3 : 0) + (f[5] === 0 || f[4] === 0 ? 1 : 0) - Math.max(0, a.maxFret - 10) * 0.8 : null,
};

const out: Record<string, Partial<Record<StyleId, Frets[]>>> = {};
let total = 0;

// which qualities each style needs
const needed: Record<string, Set<StyleId>> = {};
for (const q of ALL_QUALITIES) for (const s of STYLE_IDS) for (const q2 of styleQualities(s, q)) (needed[q2] ??= new Set()).add(s);

for (let root = 0; root < 12; root++) {
  for (const q of ALL_QUALITIES) {
    const styles = needed[q];
    if (!styles) continue;
    const found = new Map<string, Frets>();
    for (let w = 1; w <= MAX_FRET - 3; w++) {
      const opts = [-1, 0, w, w + 1, w + 2, w + 3];
      const f = [0, 0, 0, 0, 0, 0];
      const rec = (i: number) => {
        if (i === 6) { found.set(f.join(','), f.slice()); return; }
        for (const o of opts) { f[i] = o; rec(i + 1); }
      };
      rec(0);
    }
    const buckets: Partial<Record<StyleId, { f: Frets; s: number }[]>> = {};
    for (const f of found.values()) {
      const a = analyse(f, root, q);
      if (!a) continue;
      for (const s of styles) {
        const score = STYLE_RULES[s](a, f);
        if (score != null) (buckets[s] ??= []).push({ f, s: score });
      }
    }
    const entry: Partial<Record<StyleId, Frets[]>> = {};
    for (const s of styles) {
      const list = (buckets[s] ?? []).sort((x, y) => y.s - x.s || Math.min(...x.f.filter((v) => v > 0), 99) - Math.min(...y.f.filter((v) => v > 0), 99));
      // spread across the neck: keep the best, then at most 2 per minimum-fret region
      const kept: Frets[] = [];
      const perRegion: Record<number, number> = {};
      for (const { f } of list) {
        const region = Math.floor(Math.min(...f.filter((v) => v > 0), 0 + 99) / 3);
        if ((perRegion[region] ?? 0) >= 2) continue;
        perRegion[region] = (perRegion[region] ?? 0) + 1;
        kept.push(f);
        if (kept.length >= KEEP) break;
      }
      if (kept.length) { entry[s] = kept; total += kept.length; }
    }
    out[`${root}:${q}`] = entry;
  }
}

writeFileSync(new URL('../src/data/voicings.json', import.meta.url), JSON.stringify(out));
console.log(`voicings.json: ${Object.keys(out).length} chords, ${total} voicings`);
