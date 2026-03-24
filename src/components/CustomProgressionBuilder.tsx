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
        className="absolute -top-2 -left-2 p-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full shadow-sm cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-20"
      >
        <GripVertical className="w-3 h-3 text-slate-400" />
      </div>
      
      <button
        onClick={() => onRemove(chord.id)}
        className="absolute -top-2 -right-2 p-1 bg-red-50 dark:bg-red-900/30 text-red-500 border border-red-100 dark:border-red-800 rounded-full shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-100 dark:hover:bg-red-900/50"
      >
        <X className="w-3 h-3" />
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
    <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 mb-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-2 rounded-lg">
            <Play className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Custom Builder</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Drag to reorder your sequence</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => playProgression(chords.map(c => c.frets))}
            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 dark:shadow-none"
          >
            <Play className="w-4 h-4 fill-current" />
            Play Sequence
          </button>
          <button
            onClick={onClear}
            className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors"
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
          <div className="flex flex-wrap gap-6 min-h-[180px] items-center">
            {chords.map((chord) => (
              <SortableItem key={chord.id} chord={chord} onRemove={onRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
};
