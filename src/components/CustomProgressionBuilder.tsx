import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChordChart } from './ChordChart';
import { Play, X, GripVertical } from 'lucide-react';
import { playChord, playProgression } from '../services/soundService';

interface CustomChord {
  id: string;
  chordName: string;
  frets: (number | "x")[];
}

interface SortableItemProps {
  chord: CustomChord;
  onRemove: (id: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ chord, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chord.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group flex flex-col items-center">
      <div 
        {...attributes} 
        {...listeners}
        className="absolute -top-2 -left-2 p-1 bg-black text-white zine-border cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-20"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      
      <button
        onClick={() => onRemove(chord.id)}
        className="absolute -top-2 -right-2 p-1 bg-black text-white zine-border opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-white hover:text-black"
      >
        <X className="w-4 h-4" />
      </button>

      <ChordChart chord={chord} onClick={() => playChord(chord.frets)} />
    </div>
  );
};

interface CustomProgressionBuilderProps {
  chords: CustomChord[];
  onReorder: (chords: CustomChord[]) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const CustomProgressionBuilder: React.FC<CustomProgressionBuilderProps> = ({
  chords,
  onReorder,
  onRemove,
  onClear,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = chords.findIndex((item) => item.id === active.id);
      const newIndex = chords.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(chords, oldIndex, newIndex));
    }
  };

  if (chords.length === 0) return null;

  return (
    <section className="zine-card p-8 mb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-black p-2">
            <Play className="w-6 h-6 text-white fill-current" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-black">Custom Builder</h2>
            <p className="text-xs font-bold text-black opacity-60 uppercase tracking-widest">Drag to reorder your sequence</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => playProgression(chords.map(c => c.frets))}
            className="zine-button flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-current" />
            Play Sequence
          </button>
          <button
            onClick={onClear}
            className="text-xs font-bold text-black hover:underline uppercase tracking-widest"
          >
            Clear All
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={chords.map(c => c.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-8 min-h-[180px] items-center justify-center sm:justify-start">
            {chords.map((chord) => (
              <SortableItem key={chord.id} chord={chord} onRemove={onRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
};
