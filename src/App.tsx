import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChordCard, Display, Key, KeyGrid, Knob, Module, ProgressionList, fretsText } from './components/Machine';
import { Sequencer, Step } from './components/Sequencer';
import { PROGRESSIONS_BY_MODE } from './data/progressions';
import { InstrumentId, PATTERNS, PatternId, engine, playSequence, playShape } from './lib/audio';
import { KEYS_BY_MODE, Mode, keyForMode, parseProgression } from './lib/theory';
import { Fret, Voicing, VoicingSet, buildVoicingSets } from './lib/voicings';

type Theme = 'light' | 'dark';
type Source = { kind: 'set'; index: number } | { kind: 'seq' };

const INSTRUMENTS: { id: InstrumentId; name: string }[] = [
  { id: 'acoustic', name: 'Steel' },
  { id: 'nylon', name: 'Nylon' },
  { id: 'electric', name: 'Electric' },
];

function load<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
function save(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ }
}
const pick = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => load<Theme | null>('cm.theme', null) ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const [key, setKey] = useState(() => load('cm.key', 'C'));
  const [mode, setMode] = useState<Mode>(() => load<Mode>('cm.mode', 'major'));
  // remember the chosen progression separately for each mode
  const [progByMode, setProgByMode] = useState<Record<Mode, string>>(() => load('cm.progs', { major: 'pop', minor: 'm-epic' }));
  const progId = progByMode[mode];
  const setProgId = (id: string) => setProgByMode((p) => ({ ...p, [mode]: id }));
  const bank = PROGRESSIONS_BY_MODE[mode];
  const keys = KEYS_BY_MODE[mode];
  const changeMode = (m: Mode) => { setMode(m); setKey((k) => keyForMode(k, m)); };
  const [custom, setCustom] = useState(() => load('cm.custom', ''));
  const [useCustom, setUseCustom] = useState(false);
  const [bpm, setBpm] = useState(() => load('cm.bpm', 92));
  const [strumMs, setStrumMs] = useState(() => load('cm.strum', 28));
  const [ring, setRing] = useState(() => load('cm.ring', 60));
  const [volume, setVolume] = useState(() => load('cm.vol', 80));
  const [pattern, setPattern] = useState<PatternId>(() => load('cm.pattern', 'whole'));
  const [instrument, setInstrument] = useState<InstrumentId>(() => load('cm.inst', 'acoustic'));
  const [loop, setLoop] = useState(true);
  const [generated, setGenerated] = useState(false);
  const [variant, setVariant] = useState(0);
  const [steps, setSteps] = useState<Step[]>(() => load('cm.steps', []));
  const [source, setSource] = useState<Source | null>(null);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => { document.documentElement.dataset.theme = theme; save('cm.theme', theme); }, [theme]);
  useEffect(() => {
    save('cm.key', key); save('cm.mode', mode); save('cm.progs', progByMode); save('cm.custom', custom); save('cm.bpm', bpm); save('cm.strum', strumMs);
    save('cm.ring', ring); save('cm.vol', volume); save('cm.pattern', pattern); save('cm.inst', instrument); save('cm.steps', steps);
  }, [key, mode, progByMode, custom, bpm, strumMs, ring, volume, pattern, instrument, steps]);
  useEffect(() => { engine.setVolume(volume / 100); }, [volume]);
  useEffect(() => {
    engine.instrument = instrument;
    if (engine.ctx) { setLoading(true); engine.load(instrument).catch(() => {}).finally(() => setLoading(false)); }
  }, [instrument]);

  // live transport settings, read by the scheduler at each bar
  const live = useRef({ bpm, strumMs, ring, pattern, loop });
  live.current = { bpm, strumMs, ring, pattern, loop };

  const progressionText = useCustom ? custom : bank.find((p) => p.id === progId)?.numerals ?? '';
  const parsed = useMemo(() => parseProgression(progressionText, key, mode), [progressionText, key, mode]);
  const sets: VoicingSet[] = useMemo(
    () => (generated && !parsed.bad && parsed.chords.length ? buildVoicingSets(parsed.chords, variant) : []),
    [generated, parsed, variant],
  );

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    setSource(null);
    setActiveStep(null);
  }, []);

  // new voicings on screen stop a set that is playing
  useEffect(() => { if (source?.kind === 'set') stop(); }, [sets]); // eslint-disable-line react-hooks/exhaustive-deps

  const sameSource = (a: Source | null, b: Source) =>
    !!a && a.kind === b.kind && (a.kind === 'seq' || (b.kind === 'set' && a.index === b.index));

  const play = async (shapes: Fret[][], src: Source) => {
    const toggleOff = sameSource(source, src);
    stop();
    if (toggleOff || !shapes.length) return;
    setSource(src);
    setLoading(!engine.ctx);
    try {
      stopRef.current = await playSequence(shapes, () => ({
        ...live.current,
        ring: live.current.ring / 100,
        onStep: (i) => { setActiveStep(i); if (i === null) setSource(null); },
      }));
    } catch {
      setSource(null);
    } finally {
      setLoading(false);
    }
  };

  const strumOne = async (v: Voicing, id: string) => {
    setFlash(id);
    window.setTimeout(() => setFlash((f) => (f === id ? null : f)), 450);
    setLoading(!engine.ctx);
    try { await playShape(v.frets, strumMs, ring / 100); } catch { /* audio unavailable */ } finally { setLoading(false); }
  };

  const generate = () => {
    if (generated) setVariant((v) => v + 1);
    setGenerated(true);
    engine.resume().then(() => engine.load(instrument)).catch(() => {});
  };
  const surprise = () => {
    setKey(pick(keys));
    setProgId(pick(bank).id);
    setUseCustom(false);
    setVariant(Math.floor(Math.random() * 4));
    setGenerated(true);
  };

  const stepId = (v: Voicing) => `${v.name}|${fretsText(v.frets)}`;
  const toggleStep = (v: Voicing) => {
    const id = stepId(v);
    setSteps((s) => (s.some((x) => x.id === id) ? s.filter((x) => x.id !== id) : s.length >= 8 ? s : [...s, { ...v, id }]));
  };

  // ---- LCD ----
  const numerals = parsed.chords.map((c) => c.numeral).join('-');
  const playingSet = source?.kind === 'set' ? sets[source.index] : null;
  const playingChord = activeStep == null ? null : source?.kind === 'seq' ? steps[activeStep] : playingSet?.voicings[activeStep];
  const total = source?.kind === 'seq' ? steps.length : playingSet?.voicings.length;
  const line1 = `${key} ${mode === 'major' ? 'MAJ' : 'MIN'}  ${parsed.bad ? '??' : numerals || '--'}`.slice(0, 22);
  const line2 = loading
    ? 'LOADING SAMPLES...'
    : playingChord && activeStep != null
      ? `PLAY ${activeStep + 1}/${total}  ${playingChord.name}`.slice(0, 44)
      : `BPM ${String(bpm).padStart(3, '0')}  ${INSTRUMENTS.find((i) => i.id === instrument)!.name.toUpperCase()}`;
  const caption: [string, string] = [
    playingSet ? playingSet.name : source?.kind === 'seq' ? 'Sequence' : generated ? `${sets.length} sets` : 'Ready',
    PATTERNS[pattern].name,
  ];
  const full = steps.length >= 8;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-row">
            <span className="cm-label">Chord machine · six-string</span>
            <Key size="sm" label={theme === 'dark' ? 'Panel' : 'Night'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`} />
          </div>
          <h1>Find your voicing</h1>
        </div>
        <Display lines={[line1, line2]} caption={caption} />
      </header>

      <div className="controls">
        <Module title="01 · Key" aside={<span className="cm-label">Circle of fifths</span>}>
          <KeyGrid keys={keys} value={key} onChange={setKey} />
          <div className="mode-row" role="radiogroup" aria-label="Mode">
            {(['major', 'minor'] as Mode[]).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={mode === m} className="cm-key cm-key-word" onClick={() => changeMode(m)}>
                <span className={'cm-led' + (mode === m ? ' on' : '')} aria-hidden="true" />
                {m === 'major' ? 'Major' : 'Minor'}
              </button>
            ))}
          </div>
        </Module>

        <Module title="02 · Progression" aside={
          <Key size="sm" label="Custom" led={useCustom} pressed={useCustom} onClick={() => setUseCustom((u) => !u)} />
        }>
          {useCustom ? (
            <>
              <label className="sr-only" htmlFor="custom">Custom progression in Roman numerals</label>
              <div className="custom">
                <input id="custom" className="cm-input" value={custom} placeholder="e.g. I vi ii7 V7" autoComplete="off" spellCheck={false}
                  onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') generate(); }} />
              </div>
              <p className={'custom-help' + (parsed.bad ? ' error' : '')}>
                {parsed.bad
                  ? `Can't read “${parsed.bad}”. Use numerals like I ii iii IV V vi vii°, with b/# and 7, maj7, 9, add9, sus2, sus4, 6.`
                  : custom.trim()
                    ? `In ${key}: ${parsed.chords.map((c) => c.root + (c.quality === 'maj' ? '' : c.quality)).join('  ')}`
                    : `Uppercase is major, lowercase minor. Separate with spaces or dashes.${mode === 'minor' ? ' Degrees follow natural minor: i ii° III iv v VI VII.' : ''}`}
              </p>
            </>
          ) : (
            <ProgressionList items={bank} value={progId} onChange={setProgId} />
          )}
        </Module>
      </div>

      <section className="cm-module strip" aria-label="Sound">
        <div className="knobs">
          <Knob label="Tempo" value={bpm} min={40} max={200} unit="bpm" onChange={setBpm} />
          <Knob label="Strum" value={strumMs} min={0} max={80} unit="ms" onChange={setStrumMs} />
          <Knob label="Ring" value={ring} min={0} max={100} unit="%" onChange={setRing} />
          <Knob label="Level" value={volume} min={0} max={100} unit="%" onChange={setVolume} />
        </div>
        <div className="seg">
          <span className="cm-label">Guitar</span>
          <div className="seg-row" role="radiogroup" aria-label="Guitar">
            {INSTRUMENTS.map((i) => (
              <button key={i.id} type="button" role="radio" aria-checked={instrument === i.id} className="cm-key cm-key-word" onClick={() => setInstrument(i.id)}>{i.name}</button>
            ))}
          </div>
        </div>
        <div className="seg">
          <span className="cm-label">Strum pattern</span>
          <div className="seg-row" role="radiogroup" aria-label="Strum pattern">
            {(Object.keys(PATTERNS) as PatternId[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={pattern === p} className="cm-key cm-key-word" onClick={() => setPattern(p)}>{PATTERNS[p].name}</button>
            ))}
          </div>
        </div>
        <div className="strip-actions">
          <Key label="Surprise" onClick={surprise} />
          <Key label={generated ? 'Shuffle' : 'Generate'} variant="signal" size="lg" onClick={generate} disabled={!!parsed.bad || !parsed.chords.length} />
        </div>
      </section>

      <Module title="03 · Sequence" aside={
        <div className="seg-row">
          <Key size="sm" label="Loop" led={loop} pressed={loop} onClick={() => setLoop((l) => !l)} />
          <Key size="sm" label="Clear" onClick={() => { if (source?.kind === 'seq') stop(); setSteps([]); }} disabled={!steps.length} />
          <Key size="sm" label={source?.kind === 'seq' ? 'Stop' : 'Play'} led={source?.kind === 'seq'} disabled={!steps.length}
            onClick={() => play(steps.map((s) => s.frets), { kind: 'seq' })} />
        </div>
      }>
        <Sequencer steps={steps} active={source?.kind === 'seq' ? activeStep : null} onChange={setSteps}
          onPlayStep={(s) => strumOne(s, 'seq-' + s.id)} />
        <p className="custom-help">
          {steps.length === 0 ? 'Press Add under any chord to build your own progression here. Drag steps to reorder.'
            : full ? 'Sequence full — remove a step to add another.' : 'Drag to reorder. Double-click a step to hear it.'}
        </p>
      </Module>

      <section className="sets" aria-label="Voicings">
        {sets.length === 0 ? (
          <div className="empty">
            <span className="cm-label">04 · Voicings</span>
            <h3>{parsed.bad ? 'Check the progression' : 'Ready when you are'}</h3>
            <p>Pick a key and a progression, then press Generate to lay out six ways to play it. Click any chord to hear it.</p>
          </div>
        ) : (
          sets.map((set, si) => {
            const isPlaying = source?.kind === 'set' && source.index === si;
            return (
              <section key={set.style} className="cm-module" aria-label={set.name}>
                <div className="cm-set-head">
                  <div>
                    <p className="cm-label cm-set-num">04.{si + 1} · {set.style}</p>
                    <h3 className="cm-set-name">{set.name}</h3>
                    <p className="cm-set-desc">{set.description}</p>
                  </div>
                  <Key label={isPlaying ? 'Stop' : 'Play'} led={isPlaying} onClick={() => play(set.voicings.map((v) => v.frets), { kind: 'set', index: si })} />
                </div>
                <div className="cm-set-row">
                  {set.voicings.map((v, vi) => {
                    const id = `${si}-${vi}`;
                    const added = steps.some((s) => s.id === stepId(v));
                    return (
                      <ChordCard key={vi} {...v} playing={(isPlaying && activeStep === vi) || flash === id} added={added}
                        onPlay={() => strumOne(v, id)} onToggle={!added && full ? undefined : () => toggleStep(v)} />
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </section>

      <footer>
        <span>Diagrams run low E → high e. ○ open, × muted; a number marks the starting fret.</span>
        <span>Guitar samples: <a href="https://github.com/nbrosowsky/tonejs-instruments" target="_blank" rel="noreferrer">tonejs-instruments</a></span>
      </footer>
    </div>
  );
}
