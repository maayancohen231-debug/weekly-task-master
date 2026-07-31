import { useState } from 'react';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, Palette, Clock } from 'lucide-react';
import { translateText } from '@/lib/translate';
import type { LibraryTask, TaskColor } from '@/lib/task-types';
import { TASK_COLORS } from '@/lib/task-types';
import { colorDotClasses, colorBorderOverrides } from '@/lib/task-styles';

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];

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

      {task.startTime && (
        <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground/60" title={`${task.startTime} · ${task.durationMinutes ?? 30} min`}>
          <Clock size={10} />
          {task.startTime}
        </span>
      )}

      <div className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 flex items-center gap-0.5 transition-base">
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
  /** Skip the card wrapper/title — used when embedded inside TaskSidebarPanel's tabs. */
  bare?: boolean;
}

export function LibraryPanel({ libraryTasks, onAddLibraryTask, onDeleteLibraryTask, onSetLibraryColor, bare = false }: LibraryPanelProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [durationMinutes, setDurationMinutes] = useState(60);

  const resetForm = () => {
    setInputValue('');
    setTimeEnabled(false);
    setStartTime('09:00');
    setDurationMinutes(60);
  };

  const addTask = async () => {
    if (!inputValue.trim()) return;
    setIsTranslating(true);
    const translated = await translateText(inputValue);
    onAddLibraryTask({
      id: Math.random().toString(36).substr(2, 9),
      content: translated,
      originalText: /[\u0590-\u05FF]/.test(inputValue) ? inputValue : undefined,
      startTime: timeEnabled ? startTime : undefined,
      durationMinutes: timeEnabled ? durationMinutes : undefined,
    });
    resetForm();
    setIsTranslating(false);
    setIsAdding(false);
  };

  const body = (
    <>
      <div className="flex items-center justify-between mb-1">
        {bare
          ? <p className="text-[11px] text-muted-foreground/50">Drag items into a day column</p>
          : <h3 className="text-sm font-bold text-foreground">Task Library</h3>}
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 text-muted-foreground hover:text-foreground rounded transition-base shrink-0"
        >
          <Plus size={16} />
        </button>
      </div>
      {!bare && <p className="text-[11px] text-muted-foreground/50 mb-3">Drag items into a day column</p>}

      {isAdding && (
        <div className="mb-3">
          <input
            type="text"
            value={inputValue}
            dir="auto"
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !timeEnabled && addTask()}
            placeholder="Task name..."
            autoFocus
            className="w-full px-3 py-2 bg-muted border-none rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
          />

          <button
            type="button"
            onClick={() => setTimeEnabled(v => !v)}
            className={`flex items-center gap-1 mt-1.5 text-[11px] font-medium transition-base ${timeEnabled ? 'text-primary' : 'text-muted-foreground/50 hover:text-muted-foreground'}`}
          >
            <Clock size={11} />
            {timeEnabled ? 'Remove time' : 'Add a time'}
          </button>

          {timeEnabled && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {DURATION_OPTIONS.map(min => (
                  <option key={min} value={min}>{min} min</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-1.5 mt-1.5">
            <button
              onClick={addTask}
              disabled={isTranslating}
              className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50 transition-base"
            >
              {isTranslating ? 'Translating...' : 'Add'}
            </button>
            <button
              onClick={() => { setIsAdding(false); resetForm(); }}
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
    </>
  );

  if (bare) return body;
  return <div className="bg-card rounded-2xl shadow-card p-4">{body}</div>;
}
