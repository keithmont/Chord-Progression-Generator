import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, RefreshCw, ChevronRight, Guitar, Info, Play, Sun, Moon } from 'lucide-react';
import { generateVoicings, VoicingSet } from './services/geminiService';
import { ChordChart } from './components/ChordChart';
import { playChord, playProgression } from './services/soundService';
import { CustomProgressionBuilder } from './components/CustomProgressionBuilder';

const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const COMMON_PROGRESSIONS = [
  { label: 'I - V - vi - IV (Pop)', value: 'I-V-vi-IV' },
  { label: 'vi - IV - I - V (Emotional)', value: 'vi-IV-I-V' },
  { label: 'I - IV - V (Blues/Rock)', value: 'I-IV-V' },
  { label: 'ii - V - I (Jazz)', value: 'ii-V-I' },
  { label: 'I - vi - IV - V (50s)', value: 'I-vi-IV-V' },
  { label: 'I - V - IV - V (Anthemic)', value: 'I-V-IV-V' },
  { label: 'IV - V - iii - vi (Math Rock)', value: 'IV-V-iii-vi' },
  { label: 'I - iii - IV - iv (Math Rock)', value: 'I-iii-IV-iv' },
  { label: 'Surprise Me!', value: 'surprise' },
];

interface CustomChord {
  id: string;
  chordName: string;
  frets: (number | "x")[];
}

export default function App() {
  const [selectedKey, setSelectedKey] = useState('C');
  const [selectedProgression, setSelectedProgression] = useState('I-V-vi-IV');
  const [customProgression, setCustomProgression] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [voicingSets, setVoicingSets] = useState<VoicingSet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  
  // Custom builder state
  const [customChords, setCustomChords] = useState<CustomChord[]>([]);

  const currentProgression = isCustom ? customProgression : selectedProgression;

  useEffect(() => {
    const root = window.document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    }
  }, [darkMode]);

  const handleGenerate = async () => {
    if (!currentProgression) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateVoicings(selectedKey, currentProgression);
      if (result.length === 0) {
        setError("Failed to generate voicings. Please try again.");
      } else {
        setVoicingSets(result);
      }
    } catch (err) {
      setError("An error occurred while generating voicings.");
    } finally {
      setIsLoading(false);
    }
  };

  const surpriseKey = () => {
    const randomKey = KEYS[Math.floor(Math.random() * KEYS.length)];
    setSelectedKey(randomKey);
  };

  const surpriseProgression = () => {
    const options = COMMON_PROGRESSIONS.filter(p => p.value !== 'surprise');
    const randomProg = options[Math.floor(Math.random() * options.length)].value;
    setSelectedProgression(randomProg);
    setIsCustom(false);
  };

  useEffect(() => {
    handleGenerate();
  }, [selectedKey, selectedProgression]);

  const toggleChordInBuilder = (voicing: any, setIdx: number, vIdx: number) => {
    const chordId = `${voicing.chordName}-${setIdx}-${vIdx}`;
    const exists = customChords.find(c => c.id === chordId);
    
    if (exists) {
      setCustomChords(prev => prev.filter(c => c.id !== chordId));
    } else {
      setCustomChords(prev => [...prev, {
        id: chordId,
        chordName: voicing.chordName,
        frets: voicing.frets
      }]);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans pb-20 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Guitar className="text-white w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">Chord Architect</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-widest hidden sm:block">
              Guitar Voicing Generator
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Controls Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Key Selection */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Music className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold text-slate-700 dark:text-slate-200">Select Key</h2>
              </div>
              <button
                onClick={surpriseKey}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Surprise Me
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setSelectedKey(k)}
                  className={`py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedKey === k
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200 dark:shadow-none'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Progression Selection */}
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="font-semibold text-slate-700 dark:text-slate-200">Progression</h2>
              </div>
              <button
                onClick={surpriseProgression}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Surprise Me
              </button>
            </div>
            
            <div className="space-y-4">
              <select
                disabled={isCustom}
                value={selectedProgression}
                onChange={(e) => {
                  if (e.target.value === 'surprise') {
                    surpriseProgression();
                  } else {
                    setSelectedProgression(e.target.value);
                  }
                }}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 text-slate-700 dark:text-slate-200"
              >
                {COMMON_PROGRESSIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="custom-toggle"
                  checked={isCustom}
                  onChange={(e) => setIsCustom(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 bg-transparent"
                />
                <label htmlFor="custom-toggle" className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Custom Progression
                </label>
              </div>

              {isCustom && (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. I - IV - vi - V"
                    value={customProgression}
                    onChange={(e) => setCustomProgression(e.target.value)}
                    className="flex-1 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 dark:text-slate-200"
                  />
                  <button
                    onClick={handleGenerate}
                    className="bg-slate-800 dark:bg-slate-700 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Custom Progression Builder Section */}
        <CustomProgressionBuilder 
          chords={customChords}
          onReorder={setCustomChords}
          onRemove={(id) => setCustomChords(prev => prev.filter(c => c.id !== id))}
          onClear={() => setCustomChords([])}
        />

        {/* Results Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Voicing Options</h2>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-100 dark:border-blue-800">
                <Music className="w-3 h-3" />
                <span>CLICK TO STRUM</span>
              </div>
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">Generating...</span>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 p-4 rounded-xl mb-8 flex items-center gap-3">
              <Info className="w-5 h-5" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-12">
            <AnimatePresence mode="wait">
              {voicingSets.map((set, setIdx) => (
                <motion.div
                  key={`${set.name}-${setIdx}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: setIdx * 0.1 }}
                  className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800"
                >
                  <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">{set.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{set.description}</p>
                    </div>
                    <button
                      onClick={() => playProgression(set.voicings.map(v => v.frets))}
                      className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm hover:text-blue-700 dark:hover:text-blue-300 transition-colors bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-xl border border-blue-100 dark:border-blue-900/30"
                    >
                      <Play className="w-4 h-4 fill-current" />
                      Play Progression
                    </button>
                  </div>
                  
                  <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
                    {set.voicings.map((voicing, vIdx) => (
                      <div key={vIdx} className="relative group">
                        <ChordChart 
                          chord={voicing} 
                          onClick={() => playChord(voicing.frets)}
                          onAddToggle={() => toggleChordInBuilder(voicing, setIdx, vIdx)}
                          isAdded={!!customChords.find(c => c.id === `${voicing.chordName}-${setIdx}-${vIdx}`)}
                        />
                        {vIdx < set.voicings.length - 1 && (
                          <div className="hidden lg:flex absolute -right-5 top-1/2 -translate-y-1/2 text-slate-200 dark:text-slate-700">
                            <ChevronRight className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* Regenerate Button */}
        <div className="mt-16 flex justify-center">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="group flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-blue-200 dark:shadow-none hover:bg-blue-700 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            Regenerate Voicings
          </button>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto px-4 py-8 border-t border-slate-200 dark:border-slate-800 mt-12 text-center">
        <p className="text-slate-400 dark:text-slate-500 text-sm">
          Explore different ways to play your favorite progressions. 
          <br className="hidden sm:block" />
          Charts show fret numbers on the left and muted strings with an 'X'.
        </p>
      </footer>
    </div>
  );
}
