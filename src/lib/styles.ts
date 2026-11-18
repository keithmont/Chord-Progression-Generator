import type { Quality } from './theory';

// Standard tuning, low E → high e, as MIDI note numbers.
export const TUNING = [40, 45, 50, 55, 59, 64];

export const STYLE_IDS = ['open', 'barre', 'power', 'shell', 'triad', 'twinkle'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export const STYLES: Record<StyleId, { name: string; description: string }> = {
  open: { name: 'Open position', description: 'First-position shapes; open strings ring through every change.' },
  barre: { name: 'Barre chords', description: 'Full six- and five-string barres, kept close together on the neck.' },
  power: { name: 'Power chords', description: 'Root and fifth only. Loud, ambiguous, built for distortion.' },
  shell: { name: 'Shell voicings', description: 'Root, third and seventh — the jazz comping skeleton, with sevenths added.' },
  triad: { name: 'Top-string triads', description: 'Three-note inversions on the top strings, voice-led so each hand move is small.' },
  twinkle: { name: 'Twinkle extensions', description: 'Fretted shapes against ringing open strings, with added ninths. Math-rock sparkle.' },
};

type Family = 'major' | 'minor' | 'dominant' | 'other';
function family(q: Quality): Family {
  if (['maj', 'maj7', 'maj9', 'add9', '6', '5', 'sus2'].includes(q)) return 'major';
  if (['m', 'm7', 'm9', 'madd9', 'm6'].includes(q)) return 'minor';
  if (['7', '9', '7sus4', 'sus4'].includes(q)) return 'dominant';
  return 'other';
}

/** The chord qualities a style plays for a written quality, in order of preference. */
export function styleQualities(style: StyleId, q: Quality): Quality[] {
  const fam = family(q);
  switch (style) {
    case 'open':
    case 'barre':
      return q === '5' ? ['5', 'maj'] : [q, ...(fam === 'major' ? ['maj'] : fam === 'minor' ? ['m'] : fam === 'dominant' && q !== '7' ? ['7'] : [])] as Quality[];
    case 'power':
      return fam === 'other' ? [q] : ['5'];
    case 'shell':
      if (fam === 'major') return ['maj7', '6'];
      if (fam === 'minor') return ['m7', 'm6'];
      if (q === '7sus4' || q === 'sus4') return ['7sus4', '7'];
      if (fam === 'dominant') return ['7'];
      return q === 'dim' ? ['m7b5', 'dim7', 'dim'] : [q];
    case 'triad':
      if (q === 'sus2' || q === 'sus4') return [q];
      if (q === '7sus4') return ['sus4'];
      if (fam === 'major' || fam === 'dominant') return ['maj'];
      if (fam === 'minor') return ['m'];
      if (q === 'aug') return ['aug'];
      return ['dim'];
    case 'twinkle':
      if (fam === 'major') return ['add9', 'maj9', 'maj7', '6', 'sus2', 'maj'];
      if (fam === 'minor') return ['madd9', 'm9', 'm7', 'm'];
      if (fam === 'dominant') return ['9', '7sus4', '7'];
      return [q];
  }
}
