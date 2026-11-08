import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Loader2, X, Sparkles } from 'lucide-react';
import { TaskItem } from './TaskItem';
import type { Task, TaskColor } from '@/lib/task-types';

interface DayColumnProps {
  dayId: string;
  label: string;
  date: string;
  tasks: Task[];
  isToday: boolean;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onToggleDaily: (id: string) => void;
  onToggleWeekly: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onSplitTask: (id: string) => void;
  onAddInline: (dayId: string, text: string) => Promise<void>;
  onMoveTask: (id: string, direction: 'up' | 'down') => void;
}

export function DayColumn({
  dayId, label, date, tasks, isToday,
  onDelete, onCycleStatus, onToggleDaily, onToggleWeekly, onSetColor, onSplitTask, onAddInline,
  onMoveTask,
}: DayColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: dayId });
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openEditor = () => {
    setIsEditing(true);
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const closeEditor = () => {
    setIsEditing(false);
    setInputValue('');
  };

  const submit = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddInline(dayId, inputValue);
    setIsSubmitting(false);
    closeEditor();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') closeEditor();
  };

  const total = tasks.length;
  const doneCount = tasks.filter(t => t.status === 'green').length;

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[200px] bg-card rounded-2xl shadow-card flex flex-col overflow-hidden transition-base ${
        isOver ? 'ring-2 ring-primary/25 shadow-hover' : ''
      } ${isToday ? 'ring-1 ring-primary/30' : ''}`}
    >
      {isToday && <div className="h-1 bg-primary shrink-0" />}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <h3 className={`text-[15px] font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{label}</h3>
            <span className="text-xs text-muted-foreground">{date}</span>
          </div>
          {isToday && <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">Today</span>}
        </div>
        {total > 0 && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-[hsl(var(--status-green))] transition-all duration-500" style={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
            <span className="text-[10.5px] tabular-nums text-muted-foreground">{doneCount}/{total}</span>
          </div>
        )}
      </div>

      <div className="flex-1 px-3 pt-2 pb-2 flex flex-col gap-1.5 min-h-[240px] overflow-y-auto scroll-thin">
        {tasks.length === 0 && !isEditing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-1.5 py-6 text-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary/50">
              <Sparkles size={16} />
            </span>
            <p className="text-[11px] text-muted-foreground/50">No tasks yet</p>
          </div>
        )}
        <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDelete={onDelete}
              onCycleStatus={onCycleStatus}
              onToggleDaily={onToggleDaily} onToggleWeekly={onToggleWeekly}
              onSetColor={onSetColor}
              onSplitTask={onSplitTask}
              onMoveUp={() => onMoveTask(task.id, 'up')}
              onMoveDown={() => onMoveTask(task.id, 'down')}
            />
          ))}
        </SortableContext>
      </div>

      {isEditing ? (
        <div className="px-3 pb-3 flex flex-col gap-1.5">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            dir="auto"
            placeholder="Task name..."
            className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={submit}
              disabled={!inputValue.trim() || isSubmitting}
              className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-40 transition-base flex items-center justify-center gap-1"
            >
              {isSubmitting ? <Loader2 size={11} className="animate-spin" /> : null}
              Add
            </button>
            <button
              onClick={closeEditor}
              className="p-1.5 text-muted-foreground/40 hover:text-muted-foreground rounded-lg transition-base"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={openEditor}
          className="flex items-center gap-1.5 mx-3 mb-3 px-3 py-2 text-xs text-muted-foreground/60 hover:text-primary hover:bg-primary/5 border border-dashed border-border hover:border-primary/30 rounded-xl transition-base"
        >
          <Plus size={14} />
          <span>Add task</span>
        </button>
      )}
    </div>
  );
}
