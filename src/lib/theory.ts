// Music theory: keys, Roman-numeral parsing, chord spelling. Pure functions, no I/O.

export type Quality =
  | 'maj' | 'm' | 'dim' | 'aug' | '5'
  | '7' | 'maj7' | 'm7' | 'm7b5' | 'dim7'
  | 'sus2' | 'sus4' | '7sus4'
  | '6' | 'm6'
  | 'add9' | 'madd9' | 'maj9' | 'm9' | '9';

export interface QualityDef {
  suffix: string;     // printed after the root
  tones: number[];    // semitones above the root, all allowed
  required: number[]; // must be present in a full voicing
}

export const QUALITIES: Record<Quality, QualityDef> = {
  maj:    { suffix: '',      tones: [0, 4, 7],         required: [0, 4] },
  m:      { suffix: 'm',     tones: [0, 3, 7],         required: [0, 3] },
  dim:    { suffix: 'dim',   tones: [0, 3, 6],         required: [0, 3, 6] },
  aug:    { suffix: 'aug',   tones: [0, 4, 8],         required: [0, 4, 8] },
  '5':    { suffix: '5',     tones: [0, 7],            required: [0, 7] },
  '7':    { suffix: '7',     tones: [0, 4, 7, 10],     required: [0, 4, 10] },
  maj7:   { suffix: 'maj7',  tones: [0, 4, 7, 11],     required: [0, 4, 11] },
  m7:     { suffix: 'm7',    tones: [0, 3, 7, 10],     required: [0, 3, 10] },
  m7b5:   { suffix: 'm7b5',  tones: [0, 3, 6, 10],     required: [0, 3, 6, 10] },
  dim7:   { suffix: 'dim7',  tones: [0, 3, 6, 9],      required: [0, 3, 6, 9] },
  sus2:   { suffix: 'sus2',  tones: [0, 2, 7],         required: [0, 2] },
  sus4:   { suffix: 'sus4',  tones: [0, 5, 7],         required: [0, 5] },
  '7sus4':{ suffix: '7sus4', tones: [0, 5, 7, 10],     required: [0, 5, 10] },
  '6':    { suffix: '6',     tones: [0, 4, 7, 9],      required: [0, 4, 9] },
  m6:     { suffix: 'm6',    tones: [0, 3, 7, 9],      required: [0, 3, 9] },
  add9:   { suffix: 'add9',  tones: [0, 2, 4, 7],      required: [0, 2, 4] },
  madd9:  { suffix: 'm(add9)', tones: [0, 2, 3, 7],    required: [0, 2, 3] },
  maj9:   { suffix: 'maj9',  tones: [0, 2, 4, 7, 11],  required: [0, 2, 4, 11] },
  m9:     { suffix: 'm9',    tones: [0, 2, 3, 7, 10],  required: [0, 2, 3, 10] },
  '9':    { suffix: '9',     tones: [0, 2, 4, 7, 10],  required: [0, 2, 4, 10] },
};

export const ALL_QUALITIES = Object.keys(QUALITIES) as Quality[];

// Keys in the original app's order (circle of fifths, sharps then flats).
export const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];

export function pitchClass(name: string): number {
  const li = LETTERS.indexOf(name[0].toUpperCase());
  let pc = LETTER_PC[li];
  for (const c of name.slice(1)) pc += c === '#' ? 1 : c === 'b' ? -1 : 0;
  return ((pc % 12) + 12) % 12;
}

/** Spell the note on scale degree `deg` (0-6) of a major key, shifted by `shift` semitones. */
export function spellDegree(key: string, deg: number, shift = 0): string {
  const keyLetter = LETTERS.indexOf(key[0]);
  const letterIdx = (keyLetter + deg) % 7;
  const target = (pitchClass(key) + MAJOR[deg] + shift + 120) % 12;
  let diff = (target - LETTER_PC[letterIdx] + 12) % 12;
  if (diff > 6) diff -= 12;
  const acc = diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return LETTERS[letterIdx] + acc;
}

export type ChordFn = 'tonic' | 'sub' | 'dom' | 'other';

export interface ProgressionChord {
  numeral: string;  // as written, e.g. "ii7", "bVII"
  root: string;     // spelled, e.g. "F#"
  rootPc: number;
  quality: Quality;
  fn: ChordFn;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const FN_BY_DEGREE: ChordFn[] = ['tonic', 'sub', 'tonic', 'sub', 'dom', 'tonic', 'dom'];

/** Parse one Roman numeral (e.g. "bVII", "ii7", "IVmaj7", "vii°", "Vsus4", "iv") in a major key. */
export function parseNumeral(raw: string, key: string): ProgressionChord | null {
  const s = raw.trim();
  const m = /^([b#♭♯]?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)(.*)$/.exec(s);
  if (!m) return null;
  const [, accRaw, rn, restRaw] = m;
  const acc = accRaw === 'b' || accRaw === '♭' ? -1 : accRaw === '#' || accRaw === '♯' ? 1 : 0;
  const deg = ROMAN.indexOf(rn.toUpperCase());
  const upper = rn === rn.toUpperCase();
  const rest = restRaw.replace(/\s+/g, '').toLowerCase();

  let quality: Quality;
  if (rest.startsWith('°7') || rest === 'dim7' || rest === 'o7') quality = 'dim7';
  else if (rest.startsWith('°') || rest.startsWith('dim') || rest === 'o') quality = 'dim';
  else if (rest.startsWith('ø') || rest === 'm7b5') quality = 'm7b5';
  else if (rest.startsWith('+') || rest.startsWith('aug')) quality = 'aug';
  else if (rest === 'maj7' || rest === 'δ' || rest === 'δ7') quality = 'maj7';
  else if (rest === 'maj9') quality = upper ? 'maj9' : 'm9';
  else if (rest === '7sus4' || rest === '7sus') quality = '7sus4';
  else if (rest === 'sus4' || rest === 'sus') quality = 'sus4';
  else if (rest === 'sus2') quality = 'sus2';
  else if (rest === 'add9') quality = upper ? 'add9' : 'madd9';
  else if (rest === '9') quality = upper ? '9' : 'm9';
  else if (rest === '7') quality = upper ? '7' : 'm7';
  else if (rest === '6') quality = upper ? '6' : 'm6';
  else if (rest === '5') quality = '5';
  else if (rest === '') quality = upper ? 'maj' : 'm';
  else return null;

  const root = spellDegree(key, deg, acc);
  const fn: ChordFn = acc !== 0 ? 'other' : (rn === 'iv' ? 'sub' : FN_BY_DEGREE[deg]);
  return { numeral: s, root, rootPc: pitchClass(root), quality, fn };
}

/** Split "I - V - vi - IV" / "I V vi IV" / "I, V, vi" into chords. Returns null with the bad token on error. */
export function parseProgression(text: string, key: string): { chords: ProgressionChord[]; bad?: string } {
  const tokens = text.split(/[\s,–—|-]+/).filter(Boolean);
  const chords: ProgressionChord[] = [];
  for (const t of tokens) {
    const c = parseNumeral(t, key);
    if (!c) return { chords, bad: t };
    chords.push(c);
  }
  return { chords };
}

export function chordName(root: string, q: Quality): string {
  return root + QUALITIES[q].suffix;
}
