// The progression bank. Roman numerals in a major key; the app transposes them.
export interface Progression {
  id: string;
  numerals: string; // space-separated, parsed by parseProgression()
  tag: string;
}

export const PROGRESSIONS: Progression[] = [
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
