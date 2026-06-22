import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, Palette } from 'lucide-react';
import { translateText } from '@/lib/translate';
import type { LibraryTask, TaskColor } from '@/lib/task-types';
import { TASK_COLORS } from '@/lib/task-types';

const colorDotClasses: Record<TaskColor, string> = {
  none: '',
  blue: 'bg-[hsl(var(--task-blue))]',
  purple: 'bg-[hsl(var(--task-purple))]',
  orange: 'bg-[hsl(var(--task-orange))]',
  pink: 'bg-[hsl(var(--task-pink))]',
  teal: 'bg-[hsl(var(--task-teal))]',
  red: 'bg-[hsl(var(--task-red))]',
  amber: 'bg-[hsl(var(--task-amber))]',
  green: 'bg-[hsl(var(--task-green))]',
  indigo: 'bg-[hsl(var(--task-indigo))]',
  rose: 'bg-[hsl(var(--task-rose))]',
};

const colorBorderOverrides: Record<TaskColor, string> = {
  none: '',
  blue: 'border-l-[hsl(var(--task-blue))] border-l-[3px]',
  purple: 'border-l-[hsl(var(--task-purple))] border-l-[3px]',
  orange: 'border-l-[hsl(var(--task-orange))] border-l-[3px]',
  pink: 'border-l-[hsl(var(--task-pink))] border-l-[3px]',
  teal: 'border-l-[hsl(var(--task-teal))] border-l-[3px]',
  red: 'border-l-[hsl(var(--task-red))] border-l-[3px]',
  amber: 'border-l-[hsl(var(--task-amber))] border-l-[3px]',
  green: 'border-l-[hsl(var(--task-green))] border-l-[3px]',
  indigo: 'border-l-[hsl(var(--task-indigo))] border-l-[3px]',
  rose: 'border-l-[hsl(var(--task-rose))] border-l-[3px]',
};

function DraggableLibraryItem({
  task, onDelete, onSetColor,
}: {
  task: LibraryTask;
  onDelete: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
}) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const taskColor = task.color ?? 'none';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-2 px-3 py-2 bg-card rounded-lg border border-border hover:shadow-hover transition-base ${colorBorderOverrides[taskColor]}`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/25 hover:text-muted-foreground/40 transition-base shrink-0"
      >
        <GripVertical size={12} />
      </button>

      {taskColor !== 'none' && (
        <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${colorDotClasses[taskColor]}`} />
      )}

      <span className="flex-1 text-[13px] text-foreground truncate">{task.content}</span>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-base">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(v => !v); }}
            className="p-0.5 text-muted-foreground/30 hover:text-foreground/60 rounded transition-base"
            title="Color"
          >
            <Palette size={11} />
          </button>
          {showColorPicker && (
            <div
              className="absolute right-0 top-full mt-1 z-50 bg-card rounded-xl shadow-overlay border border-border p-2 grid grid-cols-6 gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {TASK_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onSetColor(task.id, c.id); setShowColorPicker(false); }}
                  className={`w-5 h-5 rounded-full border-2 transition-base ${
                    c.id === 'none'
                      ? 'bg-muted border-border'
                      : `${colorDotClasses[c.id]} ${taskColor === c.id ? 'border-foreground scale-110' : 'border-transparent hover:scale-110'}`
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-0.5 text-muted-foreground/30 hover:text-destructive rounded transition-base shrink-0"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}

interface LibraryPanelProps {
  libraryTasks: LibraryTask[];
  onAddLibraryTask: (task: LibraryTask) => void;
  onDeleteLibraryTask: (id: string) => void;
  onSetLibraryColor: (id: string, color: TaskColor) => void;
}

export function LibraryPanel({ libraryTasks, onAddLibraryTask, onDeleteLibraryTask, onSetLibraryColor }: LibraryPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const addTask = async () => {
    if (!inputValue.trim()) return;
    setIsTranslating(true);
    const translated = await translateText(inputValue);
    onAddLibraryTask({
      id: Math.random().toString(36).substr(2, 9),
      content: translated,
      originalText: /[\u0590-\u05FF]/.test(inputValue) ? inputValue : undefined,
    });
    setInputValue('');
    setIsTranslating(false);
    setIsAdding(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground">Task Library</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-base"
        >
          <Plus size={16} />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/50 mb-3">Drag items into a day column</p>

      {isAdding && (
        <div className="mb-3">
          <input
            type="text"
            value={inputValue}
            dir="auto"
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Task name..."
            autoFocus
            className="w-full px-3 py-2 bg-muted border-none rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
          />
          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={addTask}
              disabled={isTranslating}
              className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 transition-base"
            >
              {isTranslating ? 'Translating...' : 'Add'}
            </button>
            <button
              onClick={() => { setIsAdding(false); setInputValue(''); }}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-md transition-base"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 min-h-[60px]">
        <SortableContext items={libraryTasks} strategy={verticalListSortingStrategy}>
          {libraryTasks.map((t) => (
            <DraggableLibraryItem key={t.id} task={t} onDelete={onDeleteLibraryTask} onSetColor={onSetLibraryColor} />
          ))}
        </SortableContext>
        {libraryTasks.length === 0 && !isAdding && (
          <p className="text-[11px] text-muted-foreground/30 text-center py-4 italic">No tasks yet</p>
        )}
      </div>
    </div>
  );
}
