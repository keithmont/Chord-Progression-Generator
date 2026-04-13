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

  // useEffect(() => {
  //   handleGenerate();
  // }, [selectedKey, selectedProgression]);

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
    <div className="min-h-screen pb-20 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white zine-border border-t-0 border-l-0 border-r-0 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tighter text-black uppercase">Find Your Voicing</h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-xs font-bold text-black uppercase tracking-[0.2em] hidden sm:flex items-center gap-4">
              <span>Guitar Voicing Assistant</span>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-1.5 zine-border bg-white hover:bg-black hover:text-white transition-colors"
                aria-label="Toggle theme"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        {/* Controls Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
          {/* Key Selection */}
          <div className="zine-card p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Music className="w-6 h-6 text-black" />
                <h2 className="text-xl font-bold text-black">Select Key</h2>
              </div>
              <button
                onClick={surpriseKey}
                className="text-xs font-bold text-black hover:underline flex items-center gap-1 uppercase tracking-widest"
              >
                <RefreshCw className="w-3 h-3" />
                Surprise Me
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {KEYS.map((k) => (
                <button
                  key={k}
                  onClick={() => setSelectedKey(k)}
                  className={`py-3 text-sm font-bold transition-all zine-border ${
                    selectedKey === k
                      ? 'bg-black text-white'
                      : 'bg-white text-black hover:bg-[#F5F5DC]'
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          {/* Progression Selection */}
          <div className="zine-card p-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ChevronRight className="w-6 h-6 text-black" />
                <h2 className="text-xl font-bold text-black">Progression</h2>
              </div>
              <button
                onClick={surpriseProgression}
                className="text-xs font-bold text-black hover:underline flex items-center gap-1 uppercase tracking-widest"
              >
                <RefreshCw className="w-3 h-3" />
                Surprise Me
              </button>
            </div>
            
            <div className="space-y-6">
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
                className="w-full zine-select text-sm font-bold uppercase tracking-tight"
              >
                {COMMON_PROGRESSIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>

              <div className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    id="custom-toggle"
                    checked={isCustom}
                    onChange={(e) => setIsCustom(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="w-5 h-5 border-2 border-black rounded-none peer-checked:bg-black transition-all"></div>
                  <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <label htmlFor="custom-toggle" className="text-sm font-bold text-black uppercase tracking-widest cursor-pointer">
                  Custom Progression
                </label>
              </div>

              {isCustom && (
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="E.G. I - IV - VI - V"
                    value={customProgression}
                    onChange={(e) => setCustomProgression(e.target.value)}
                    className="flex-1 zine-input text-sm font-bold uppercase"
                  />
                  <button
                    onClick={handleGenerate}
                    className="zine-button py-2 px-6"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>


        {/* Generate Button */}
        <div className="flex justify-center mb-16">
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="zine-button px-12 py-5 text-xl flex items-center gap-4 group"
          >
            <RefreshCw className={`w-6 h-6 ${isLoading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            {voicingSets.length > 0 ? 'Regenerate' : 'Generate'}
          </button>
        </div>

        {/* Custom Progression Builder Section */}
        <CustomProgressionBuilder 
          chords={customChords}
          onReorder={setCustomChords}
          onRemove={(id) => setCustomChords(prev => prev.filter(c => c.id !== id))}
          onClear={() => setCustomChords([])}
        />

        {/* Results Section */}
        {voicingSets.length > 0 || isLoading ? (
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-black">Voicing Options</h2>
              </div>
            </div>

            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 zine-card mb-12">
                <dotlottie-wc 
                  src="https://lottie.host/a7eca740-9b96-4804-9b2c-9bfdb70550dc/Fy8ued9bPa.lottie" 
                  style={{ width: '200px', height: '200px' }} 
                  autoplay 
                  loop
                />
                <span className="text-xl font-bold uppercase tracking-[0.2em] mt-4 text-black">Architecting...</span>
              </div>
            )}

            {error && (
              <div className="zine-border bg-white p-6 mb-12 flex items-center gap-4">
                <Info className="w-6 h-6 text-black" />
                <p className="text-sm font-bold uppercase tracking-tight">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-16">
              <AnimatePresence mode="wait">
                {voicingSets.map((set, setIdx) => (
                  <motion.div
                    key={`${set.name}-${setIdx}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="zine-card p-10"
                  >
                    <div className="mb-10 flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                      <div>
                        <h3 className="text-2xl font-bold text-black mb-2">{set.name}</h3>
                        <p className="text-xs font-bold text-black opacity-60 uppercase tracking-widest max-w-2xl">{set.description}</p>
                      </div>
                      <button
                        onClick={() => playProgression(set.voicings.map(v => v.frets))}
                        className="zine-button flex items-center gap-2 whitespace-nowrap"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Play Progression
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-10 justify-center sm:justify-start">
                      {set.voicings.map((voicing, vIdx) => (
                        <div key={vIdx} className="relative group">
                          <ChordChart 
                            chord={voicing} 
                            onClick={() => playChord(voicing.frets)}
                            onAddToggle={() => toggleChordInBuilder(voicing, setIdx, vIdx)}
                            isAdded={!!customChords.find(c => c.id === `${voicing.chordName}-${setIdx}-${vIdx}`)}
                          />
                          {vIdx < set.voicings.length - 1 && (
                            <div className="hidden xl:flex absolute -right-6 top-1/2 -translate-y-1/2 text-black opacity-20">
                              <ChevronRight className="w-6 h-6" />
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
        ) : (
          <div className="zine-card p-16 text-center border-dashed">
            <h3 className="text-2xl font-bold text-black mb-4">Ready to Architect?</h3>
            <p className="text-xs font-bold text-black opacity-60 uppercase tracking-[0.2em] max-w-md mx-auto leading-relaxed">
              Select your key and progression above, then click "Generate" to see your options.
            </p>
          </div>
        )}

        {/* Regenerate Button removed from here as it's now above */}
      </main>

      {/* Footer Info */}
      <footer className="max-w-6xl mx-auto px-4 py-12 border-t-4 border-black mt-20 text-center">
        <p className="text-black font-bold text-xs uppercase tracking-[0.3em] leading-loose">
          Explore different ways to play your favorite progressions. 
          <br className="hidden sm:block" />
          Charts show fret numbers on the left and muted strings with an 'X'.
        </p>
      </footer>
    </div>
  );
}
