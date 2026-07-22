import { useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical, CheckCircle2, Repeat, Palette, Scissors, Loader2 } from 'lucide-react';
import type { Task, TaskColor } from '@/lib/task-types';
import { TASK_COLORS } from '@/lib/task-types';
import { statusClasses, statusBorderClasses, statusIconClasses, colorDotClasses, colorBorderOverrides } from '@/lib/task-styles';
import { BANK_ID } from '@/lib/calendar-grid';

interface BankItemProps {
  task: Task;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onToggleDaily: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onSplitTask: (id: string) => void;
}

function BankItem({ task, onDelete, onCycleStatus, onToggleDaily, onSetColor, onSplitTask }: BankItemProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const taskColor = task.color || 'none';
  const style = {
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onCycleStatus(task.id)}
      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-base cursor-grab active:cursor-grabbing ${statusClasses[task.status]} ${statusBorderClasses[task.status]} ${colorBorderOverrides[taskColor]} shadow-sm-custom hover:shadow-hover`}
    >
      <GripVertical size={14} className="shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-base" />
      <CheckCircle2 size={16} className={`shrink-0 transition-base ${statusIconClasses[task.status]}`} />

      <div className="flex-1 min-w-0 flex items-center gap-1">
        {task.isDaily && <Repeat size={10} className="shrink-0 text-primary/50" />}
        {taskColor !== 'none' && <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${colorDotClasses[taskColor]}`} />}
        <p className={`flex-1 text-[11px] leading-relaxed break-words ${task.status === 'green' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.content}
        </p>
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-base">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleDaily(task.id); }}
          className={`p-1 rounded-lg transition-base ${task.isDaily ? 'text-primary' : 'text-muted-foreground/30 hover:text-primary/60'}`}
          title={task.isDaily ? 'Remove daily' : 'Set as daily'}
        >
          <Repeat size={12} />
        </button>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(v => !v); }}
            className="p-1 text-muted-foreground/30 hover:text-foreground/60 rounded-lg transition-base"
            title="Color"
          >
            <Palette size={12} />
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
          onClick={(e) => { e.stopPropagation(); onSplitTask(task.id); }}
          className="p-1 text-muted-foreground/30 hover:text-primary/60 rounded-lg transition-base"
          title="Split task"
        >
          <Scissors size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-1 text-muted-foreground/30 hover:text-destructive rounded-lg transition-base"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}

interface TaskBankSidebarProps {
  tasks: Task[];
  onAddTask: (text: string) => Promise<void>;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onToggleDaily: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onSplitTask: (id: string) => void;
}

export function TaskBankSidebar({
  tasks, onAddTask, onDelete, onCycleStatus, onToggleDaily, onSetColor, onSplitTask,
}: TaskBankSidebarProps) {
  const { setNodeRef, isOver } = useDroppable({ id: BANK_ID });
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openEditor = () => {
    setIsEditing(true);
    setInputValue('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const submit = async () => {
    if (!inputValue.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await onAddTask(inputValue);
    setIsSubmitting(false);
    setInputValue('');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { setIsEditing(false); setInputValue(''); }
  };

  return (
    <div
      ref={setNodeRef}
      className={`bg-card rounded-2xl shadow-card p-4 flex flex-col transition-base ${isOver ? 'ring-2 ring-primary/20 shadow-hover' : ''}`}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-bold text-foreground">Task Bank</h3>
        <button onClick={openEditor} className="p-1 text-muted-foreground hover:text-foreground rounded transition-base">
          <Plus size={16} />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground/50 mb-3">Drag a task onto the calendar to schedule it</p>

      {isEditing && (
        <div className="mb-2 flex flex-col gap-1.5">
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
              onClick={() => { setIsEditing(false); setInputValue(''); }}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded-lg transition-base"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 min-h-[60px] max-h-[320px] overflow-y-auto scroll-thin">
        {tasks.map(task => (
          <BankItem
            key={task.id}
            task={task}
            onDelete={onDelete}
            onCycleStatus={onCycleStatus}
            onToggleDaily={onToggleDaily}
            onSetColor={onSetColor}
            onSplitTask={onSplitTask}
          />
        ))}
        {tasks.length === 0 && !isEditing && (
          <p className="text-[11px] text-muted-foreground/30 text-center py-4 italic">All tasks scheduled</p>
        )}
      </div>
    </div>
  );
}
