// The progression banks, one per mode. Roman numerals; the app transposes them.
// In minor, degrees follow the natural-minor scale (III = relative major) and case sets quality,
// so V is the harmonic-minor dominant and v the natural one.
export interface Progression {
  id: string;
  numerals: string; // space-separated, parsed by parseProgression()
  tag: string;
}

export const MAJOR_PROGRESSIONS: Progression[] = [
  { id: 'pop', numerals: 'I V vi IV', tag: 'Pop' },
  { id: 'emotional', numerals: 'vi IV I V', tag: 'Emotional' },
  { id: 'blues', numerals: 'I IV V', tag: 'Blues / rock' },
  { id: 'jazz', numerals: 'ii7 V7 Imaj7', tag: 'Jazz' },
  { id: 'fifties', numerals: 'I vi IV V', tag: '50s' },
  { id: 'anthem', numerals: 'I V IV V', tag: 'Anthemic' },
  { id: 'math1', numerals: 'IV V iii vi', tag: 'Math rock' },
  { id: 'math2', numerals: 'I iii IV iv', tag: 'Math rock' },
  { id: 'turnaround', numerals: 'I vi ii V', tag: 'Turnaround' },
  { id: 'mixo', numerals: 'I bVII IV I', tag: 'Mixolydian' },
  { id: 'canon', numerals: 'I V vi iii IV I IV V', tag: 'Canon' },
  { id: 'dreamy', numerals: 'Imaj7 IVmaj7', tag: 'Dream pop' },
  { id: 'sad', numerals: 'vi ii V I', tag: 'Circle' },
  { id: 'andalusian', numerals: 'vi V IV iii', tag: 'Andalusian' },
  { id: 'borrowed', numerals: 'I bVI bVII I', tag: 'Epic' },
  { id: 'sus', numerals: 'Isus2 IV vi Vsus4', tag: 'Ambient' },
];

export const MINOR_PROGRESSIONS: Progression[] = [
  { id: 'm-epic', numerals: 'i VI III VII', tag: 'Epic' },
  { id: 'm-andalusian', numerals: 'i VII VI V', tag: 'Andalusian' },
  { id: 'm-blues', numerals: 'i iv v', tag: 'Minor blues' },
  { id: 'm-harmonic', numerals: 'i iv V', tag: 'Harmonic' },
  { id: 'm-jazz', numerals: 'iiø7 V7 i7', tag: 'Minor jazz' },
  { id: 'm-dramatic', numerals: 'i VI iv V', tag: 'Dramatic' },
  { id: 'm-circle', numerals: 'i iv VII III', tag: 'Circle' },
  { id: 'm-rock', numerals: 'i VII VI VII', tag: 'Aeolian rock' },
  { id: 'm-nostalgic', numerals: 'i III VII iv', tag: 'Nostalgic' },
  { id: 'm-dorian', numerals: 'i IV i IV', tag: 'Dorian vamp' },
  { id: 'm-lofi', numerals: 'i7 iv7 VImaj7 V7', tag: 'Lo-fi' },
  { id: 'm-math', numerals: 'VI VII v i', tag: 'Math rock' },
  { id: 'm-ballad', numerals: 'i v VI III iv i iv V', tag: 'Minor canon' },
  { id: 'm-sad', numerals: 'VI VII i i', tag: 'Anthem' },
];

export const PROGRESSIONS_BY_MODE = { major: MAJOR_PROGRESSIONS, minor: MINOR_PROGRESSIONS };
/** Every progression, both modes (for lookups by id). */
export const PROGRESSIONS: Progression[] = [...MAJOR_PROGRESSIONS, ...MINOR_PROGRESSIONS];
