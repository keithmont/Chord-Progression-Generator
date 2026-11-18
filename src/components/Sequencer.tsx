import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fnClass } from './Machine';
import type { Voicing } from '../lib/voicings';

export interface Step extends Voicing { id: string }

function StepSlot({ step, index, active, onRemove, onPlay }: { step: Step; index: number; active: boolean; onRemove: () => void; onPlay: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  return (
    <div
      ref={setNodeRef}
      role="listitem"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={'cm-step' + (active ? ' active' : '') + (isDragging ? ' dragging' : '')}
      {...attributes}
      {...listeners}
      aria-roledescription="sortable step"
      aria-label={`Step ${index + 1}: ${step.name}. Drag or use space and arrow keys to reorder; press P to play.`}
      onKeyDown={(e) => {
        if (e.key === 'p' || e.key === 'P') onPlay();
        else if (e.key === 'Delete' || e.key === 'Backspace') onRemove();
        else listeners?.onKeyDown?.(e);
      }}
      onDoubleClick={onPlay}
    >
      <span className="cm-step-num">
        {String(index + 1).padStart(2, '0')}
        <button type="button" className="cm-step-x" aria-label={`Remove ${step.name}`} onPointerDown={(e) => e.stopPropagation()} onClick={onRemove}>×</button>
      </span>
      <span className="cm-step-name">{step.name}</span>
      <span className={'cm-step-bar ' + fnClass(step.fn)} aria-hidden="true" />
    </div>
  );
}

export function Sequencer({ steps, active, onChange, onPlayStep, slots = 8 }: {
  steps: Step[]; active: number | null; onChange: (s: Step[]) => void; onPlayStep: (s: Step) => void; slots?: number;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = steps.findIndex((s) => s.id === e.active.id);
    const to = steps.findIndex((s) => s.id === e.over!.id);
    onChange(arrayMove(steps, from, to));
  };
  const empties = Math.max(0, slots - steps.length);
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={steps.map((s) => s.id)} strategy={rectSortingStrategy}>
        <div className="cm-seq" role="list" aria-label="Your sequence">
          {steps.map((s, i) => (
            <StepSlot key={s.id} step={s} index={i} active={active === i}
              onRemove={() => onChange(steps.filter((x) => x.id !== s.id))} onPlay={() => onPlayStep(s)} />
          ))}
          {Array.from({ length: empties }, (_, i) => (
            <div key={'e' + i} role="listitem" className="cm-step cm-step-empty" aria-label={`Empty step ${steps.length + i + 1}`}>
              <span className="cm-step-num">{String(steps.length + i + 1).padStart(2, '0')}</span>
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
