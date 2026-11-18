// Chord Machine components — React ports of the design system's bundle.
import { ButtonHTMLAttributes, KeyboardEvent, ReactNode, useRef } from 'react';
import type { Fret } from '../lib/voicings';
import type { ChordFn } from '../lib/theory';

export function Led({ on }: { on: boolean }) {
  return <span className={'cm-led' + (on ? ' on' : '')} aria-hidden="true" />;
}

interface KeyProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: ReactNode;
  variant?: 'cap' | 'signal';
  size?: 'sm' | 'md' | 'lg';
  pressed?: boolean;
  led?: boolean;
}
export function Key({ label, variant = 'cap', size = 'md', pressed, led, className, ...rest }: KeyProps) {
  const word = typeof label === 'string' && label.length > 2;
  return (
    <button
      type="button"
      {...rest}
      aria-pressed={pressed == null ? undefined : pressed}
      className={['cm-key', variant === 'signal' && 'cm-key-signal', size === 'lg' && 'cm-key-lg', size === 'sm' && 'cm-key-sm', word && 'cm-key-word', className].filter(Boolean).join(' ')}
    >
      {led != null && <Led on={led} />}
      {label}
    </button>
  );
}

export function Module({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={'cm-module ' + (className ?? '')}>
      <div className="cm-module-head">
        <h2 className="cm-label">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function KeyGrid({ keys, value, onChange }: { keys: string[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="cm-keygrid" role="radiogroup" aria-label="Key">
      {keys.map((k) => (
        <button key={k} type="button" role="radio" aria-checked={k === value} className="cm-key" onClick={() => onChange(k)}>
          {k}
        </button>
      ))}
    </div>
  );
}

export interface ListItem { id: string; numerals: string; tag: string }
export function ProgressionList({ items, value, onChange }: { items: ListItem[]; value: string | null; onChange: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = items[(i + d + items.length) % items.length];
    onChange(next.id);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus());
  };
  return (
    <div className="cm-plist" role="radiogroup" aria-label="Progression" ref={ref}>
      {items.map((it, i) => {
        const on = it.id === value;
        return (
          <button key={it.id} type="button" role="radio" aria-checked={on} tabIndex={on || (value == null && i === 0) ? 0 : -1}
            className="cm-row" onClick={() => onChange(it.id)} onKeyDown={(e) => onKey(e, i)}>
            <Led on={on} />
            <span className="cm-row-num">{it.numerals.split(' ').join(' – ')}</span>
            <span className="cm-row-tag">{it.tag}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Display({ lines, caption, width = 22 }: { lines: [string, string]; caption: [string, string]; width?: number }) {
  const ghost = '8'.repeat(width);
  return (
    <div className="cm-display" role="status" aria-live="polite">
      <div className="cm-display-line lg"><span className="cm-display-ghost" aria-hidden="true">{ghost}</span><span className="cm-display-text">{lines[0]}</span></div>
      <div className="cm-display-line sm"><span className="cm-display-ghost" aria-hidden="true">{ghost + ghost}</span><span className="cm-display-text">{lines[1]}</span></div>
      <div className="cm-display-cap"><span className="cm-label">{caption[0]}</span><span className="cm-label">{caption[1]}</span></div>
    </div>
  );
}

export function Knob({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (v: number) => void }) {
  const drag = useRef<{ y: number; v: number } | null>(null);
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v / step) * step)));
  const angle = -135 + (270 * (value - min)) / (max - min);
  return (
    <div className="cm-knob-wrap">
      <div
        className="cm-knob" role="slider" tabIndex={0} aria-label={label} aria-valuemin={min} aria-valuemax={max} aria-valuenow={value}
        aria-valuetext={`${value}${unit ? ' ' + unit : ''}`}
        onPointerDown={(e) => { drag.current = { y: e.clientY, v: value }; e.currentTarget.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (drag.current) set(drag.current.v + ((drag.current.y - e.clientY) * (max - min)) / 150); }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onDoubleClick={() => set((min + max) / 2)}
        onKeyDown={(e) => {
          const d = ({ ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 } as Record<string, number>)[e.key];
          if (d) { e.preventDefault(); set(value + d * step); }
        }}
      >
        <span className="cm-knob-tick" style={{ transform: `rotate(${angle}deg)` }} />
      </div>
      <span className="cm-knob-val">{value}{unit ? ' ' + unit : ''}</span>
      <span className="cm-label">{label}</span>
    </div>
  );
}

const FN_CLASS: Record<ChordFn, string> = { tonic: 'cm-fn-tonic', sub: 'cm-fn-sub', dom: 'cm-fn-dom', other: 'cm-fn-other' };
export function fnClass(fn: ChordFn) { return FN_CLASS[fn]; }

export function Fretboard({ frets }: { frets: Fret[] }) {
  const nums = frets.filter((f): f is number => typeof f === 'number' && f > 0);
  const minF = nums.length ? Math.min(...nums) : 0;
  const maxF = nums.length ? Math.max(...nums) : 0;
  const start = maxF <= 4 ? 1 : minF;
  const sx = [16, 34, 52, 70, 88, 106];
  const fy = [24, 46, 68, 90, 112];
  return (
    <svg width="116" height="124" viewBox="0 0 116 124" aria-hidden="true">
      {fy.map((y) => <line key={y} x1={16} y1={y} x2={106} y2={y} className="cm-fb-line" strokeWidth={1.5} />)}
      {sx.map((x) => <line key={x} x1={x} y1={24} x2={x} y2={112} className="cm-fb-line" strokeWidth={1.5} />)}
      {start === 1 ? <rect x={15} y={20} width={92} height={5} className="cm-fb-dot" /> : <text x={0} y={39} className="cm-fb-text">{start}</text>}
      {frets.map((f, i) => {
        const x = sx[i];
        if (f === 'x') return <path key={i} d={`M${x - 4} 6 L${x + 4} 14 M${x + 4} 6 L${x - 4} 14`} className="cm-fb-line" strokeWidth={2} />;
        if (f === 0) return <circle key={i} cx={x} cy={10} r={4} className="cm-fb-open" strokeWidth={2} />;
        const r = f - start;
        return r >= 0 && r < 4 ? <circle key={i} cx={x} cy={35 + r * 22} r={7} className="cm-fb-dot" /> : null;
      })}
    </svg>
  );
}

export function fretsText(frets: Fret[]) {
  return frets.map((f) => (f === 'x' ? 'x' : String(f))).join(' ');
}

export function ChordCard({ name, numeral, fn, frets, playing, added, onPlay, onToggle }: {
  name: string; numeral: string; fn: ChordFn; frets: Fret[]; playing?: boolean; added?: boolean; onPlay: () => void; onToggle?: () => void;
}) {
  return (
    <div className="cm-cardwrap">
      <button type="button" className={'cm-card' + (playing ? ' playing' : '')} onClick={onPlay}
        aria-label={`Play ${name}, ${numeral}. Frets low to high: ${fretsText(frets)}`}>
        <span className="cm-card-top">
          <span className={'cm-card-name' + (name.length > 6 ? ' long' : '')}>{name}</span>
          <span className={'cm-tab ' + FN_CLASS[fn]}>{numeral}</span>
        </span>
        <Fretboard frets={frets} />
      </button>
      {onToggle && (
        <button type="button" className="cm-add" aria-pressed={!!added} onClick={onToggle} aria-label={`${added ? 'Remove' : 'Add'} ${name} ${added ? 'from' : 'to'} sequence`}>
          <Led on={!!added} />
          <span>{added ? 'Added' : 'Add'}</span>
        </button>
      )}
    </div>
  );
}
