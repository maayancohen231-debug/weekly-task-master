import { useState, useRef } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Loader2, X } from 'lucide-react';
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
  onSetColor: (id: string, color: TaskColor) => void;
  onSplitTask: (id: string) => void;
  onAddInline: (dayId: string, text: string) => Promise<void>;
  onMoveTask: (id: string, direction: 'up' | 'down') => void;
}

export function DayColumn({
  dayId, label, date, tasks, isToday,
  onDelete, onCycleStatus, onToggleDaily, onSetColor, onSplitTask, onAddInline,
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

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[140px] bg-card rounded-2xl shadow-card flex flex-col transition-base ${
        isOver ? 'ring-2 ring-primary/20 shadow-hover' : ''
      }`}
    >
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-bold text-foreground">{label}</h3>
          {isToday && <span className="w-2 h-2 rounded-full bg-foreground" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{date}</p>
      </div>

      <div className="flex-1 px-3 pb-2 flex flex-col gap-2 min-h-[240px] overflow-y-auto scroll-thin">
        <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onDelete={onDelete}
              onCycleStatus={onCycleStatus}
              onToggleDaily={onToggleDaily}
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
          className="flex items-center gap-1.5 px-4 py-3.5 text-xs text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 rounded-b-2xl transition-base"
        >
          <Plus size={14} />
          <span>Add task</span>
        </button>
      )}
    </div>
  );
}
