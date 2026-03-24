const GUITAR_TUNING_FREQS = [82.41, 110.00, 146.83, 196.00, 246.94, 329.63];

let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function playChord(frets: (number | "x")[]) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const now = ctx.currentTime;
  const strumDelay = 0.05; // Delay between strings for strumming effect

  frets.forEach((fret, i) => {
    if (fret === "x") return;

    const freq = GUITAR_TUNING_FREQS[i] * Math.pow(2, fret / 12);
    playNote(ctx, freq, now + i * strumDelay);
  });
}

export async function playProgression(progression: (number | "x")[][], bpm: number = 80) {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const secondsPerBeat = 60 / bpm;
  const now = ctx.currentTime;

  progression.forEach((frets, chordIdx) => {
    const chordStartTime = now + chordIdx * secondsPerBeat;
    const strumDelay = 0.05;

    frets.forEach((fret, stringIdx) => {
      if (fret === "x") return;
      const freq = GUITAR_TUNING_FREQS[stringIdx] * Math.pow(2, fret / 12);
      playNote(ctx, freq, chordStartTime + stringIdx * strumDelay);
    });
  });
}

function playNote(ctx: AudioContext, freq: number, startTime: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  // Use a triangle wave for a slightly "woodier" sound than a sine wave
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, startTime);

  // Simple decay envelope
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01); // Attack
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.5); // Decay

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + 1.5);
}
