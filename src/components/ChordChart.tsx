import React from 'react';

interface ChordChartProps {
  chord: {
    chordName: string;
    frets: (number | "x")[];
  };
  onClick?: () => void;
  onAddToggle?: (checked: boolean) => void;
  isAdded?: boolean;
}

export const ChordChart: React.FC<ChordChartProps> = ({ chord, onClick, onAddToggle, isAdded }) => {
  const { chordName, frets } = chord;
  
  // Find the starting fret (lowest non-zero fret)
  const numericFrets = frets.filter((f): f is number => typeof f === 'number' && f > 0);
  const minFret = numericFrets.length > 0 ? Math.min(...numericFrets) : 0;
  const startFret = minFret > 4 ? minFret : 1;
  const numFrets = 5; // Display 5 frets

  const stringX = [10, 30, 50, 70, 90, 110];
  const fretY = [20, 45, 70, 95, 120, 145];

  return (
    <div className="flex flex-col items-center gap-2">
      <button 
        onClick={onClick}
        className="flex flex-col items-center p-4 bg-white zine-border w-36 hover:bg-[#F5F5DC] transition-all cursor-pointer group active:translate-x-[2px] active:translate-y-[2px]"
        aria-label={`Play ${chordName} chord`}
      >
        <span className="text-lg font-bold mb-3 text-black uppercase tracking-tighter truncate w-full text-center">{chordName}</span>
        <svg width="120" height="160" viewBox="0 0 120 160" className="overflow-visible">
          {/* Fretboard background */}
          <rect x="10" y="20" width="100" height="125" fill="none" stroke="black" strokeWidth="2" />
          
          {/* Nut (if startFret is 1) */}
          {startFret === 1 && (
            <line x1="10" y1="20" x2="110" y2="20" stroke="black" strokeWidth="6" />
          )}

          {/* Frets */}
          {fretY.map((y, i) => (
            <line key={`fret-${i}`} x1="10" y1={y} x2="110" y2={y} stroke="black" strokeWidth="2" />
          ))}

          {/* Strings */}
          {stringX.map((x, i) => (
            <line key={`string-${i}`} x1={x} y1="20" x2={x} y2="145" stroke="black" strokeWidth="2" />
          ))}

          {/* Fret number */}
          {startFret > 1 && (
            <text x="0" y="35" fontSize="12" fill="black" fontWeight="bold" className="font-mono">{startFret}</text>
          )}

          {/* Dots (Muted or Open) */}
          {frets.map((fret, stringIdx) => {
            const x = stringX[stringIdx];
            if (fret === "x") {
              return (
                <g key={`muted-${stringIdx}`}>
                  <line x1={x - 5} y1="8" x2={x + 5} y2="18" stroke="black" strokeWidth="3" />
                  <line x1={x + 5} y1="8" x2={x - 5} y2="18" stroke="black" strokeWidth="3" />
                </g>
              );
            }
            if (fret === 0) {
              return (
                <circle key={`open-${stringIdx}`} cx={x} cy="10" r="5" fill="none" stroke="black" strokeWidth="3" />
              );
            }
            
            // Pressed fret
            const relativeFret = fret - startFret + 1;
            if (relativeFret >= 1 && relativeFret <= numFrets) {
              const y = fretY[relativeFret - 1] + (fretY[relativeFret] - fretY[relativeFret - 1]) / 2;
              return (
                <circle key={`pressed-${stringIdx}`} cx={x} cy={y} r="8" fill="black" />
              );
            }
            return null;
          })}
        </svg>
      </button>
      
      {onAddToggle && (
        <label className="flex items-center gap-2 cursor-pointer group">
          <div className="relative flex items-center">
            <input 
              type="checkbox" 
              checked={isAdded}
              onChange={(e) => onAddToggle(e.target.checked)}
              className="peer sr-only"
            />
            <div className="w-5 h-5 border-2 border-black rounded-none peer-checked:bg-black transition-all"></div>
            <svg className="absolute w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none left-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-black">
            {isAdded ? 'Added' : 'Add'}
          </span>
        </label>
      )}
    </div>
  );
};
