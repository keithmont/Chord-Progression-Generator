// Picks voicings for a progression from the static library, voice-leading each set.
import LIBRARY from '../data/voicings.json';
import { ProgressionChord, Quality, chordName } from './theory';
import { STYLE_IDS, STYLES, StyleId, styleQualities } from './styles';

export type Fret = number | 'x';

export interface Voicing {
  name: string;
  numeral: string;
  fn: ProgressionChord['fn'];
  frets: Fret[];
}

export interface VoicingSet {
  style: StyleId;
  name: string;
  description: string;
  voicings: Voicing[];
}

const lib = LIBRARY as Record<string, Partial<Record<StyleId, number[][]>>>;

// If a style has no shape for a chord (e.g. no open strings fit), borrow from these, in order.
const FALLBACK: Record<StyleId, StyleId[]> = {
  open: ['barre', 'shell'], barre: ['open', 'shell'], power: ['barre'], shell: ['barre'], triad: ['barre'], twinkle: ['open', 'barre'],
};

function candidates(c: ProgressionChord, style: StyleId): { q: Quality; f: number[] }[] {
  // a major chord on degree V reads as a dominant seventh in the seventh-based styles
  const written: Quality = c.degree === 4 && c.quality === 'maj' && (style === 'shell' || style === 'twinkle') ? '7' : c.quality;
  for (const s of [style, ...FALLBACK[style]]) {
    for (const q of styleQualities(s, written)) {
      const list = lib[`${c.rootPc}:${q}`]?.[s];
      if (list?.length) return list.map((f) => ({ q, f }));
    }
  }
  return [];
}

function centre(f: number[]): number {
  const fr = f.filter((v) => v > 0);
  return fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : 1.5;
}

// Distance a hand moves between two shapes: position shift + strings that change.
function moveCost(a: number[], b: number[]): number {
  let changed = 0;
  for (let i = 0; i < 6; i++) if (a[i] !== b[i]) changed++;
  return Math.abs(centre(a) - centre(b)) * 1.5 + changed * 0.25;
}

/**
 * Build one set: try each of the first chord's top candidates as a starting point (`variant` rotates
 * which one leads), then pick each next chord to minimise hand movement, weighted with its rank.
 */
function buildSet(chords: ProgressionChord[], style: StyleId, variant: number): VoicingSet | null {
  const cands = chords.map((c) => candidates(c, style));
  if (cands.some((l) => l.length === 0)) return null;
  const starts = cands[0].slice(0, 4);
  const start = starts[variant % starts.length];
  const picked = [start];
  for (let i = 1; i < chords.length; i++) {
    const prev = picked[i - 1].f;
    // a repeated chord keeps its shape
    const same = chords.findIndex((c, j) => j < i && c.rootPc === chords[i].rootPc && c.quality === chords[i].quality);
    if (same >= 0) { picked.push(picked[same]); continue; }
    let best = cands[i][0], bestCost = Infinity;
    cands[i].forEach((cand, rank) => {
      const cost = moveCost(prev, cand.f) + rank * 0.6;
      if (cost < bestCost) { bestCost = cost; best = cand; }
    });
    picked.push(best);
  }
  return {
    style,
    ...STYLES[style],
    voicings: picked.map((p, i) => ({
      name: chordName(chords[i].root, p.q),
      numeral: chords[i].numeral,
      fn: chords[i].fn,
      frets: p.f.map((v) => (v < 0 ? 'x' : v)),
    })),
  };
}

export function buildVoicingSets(chords: ProgressionChord[], variant = 0): VoicingSet[] {
  if (!chords.length) return [];
  return STYLE_IDS.map((s) => buildSet(chords, s, variant)).filter((s): s is VoicingSet => s !== null);
}
