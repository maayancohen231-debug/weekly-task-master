import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, CheckCircle2, Repeat, Palette, Scissors, CalendarPlus, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { useState } from 'react';
import type { Task, TaskColor } from '@/lib/task-types';
import { TASK_COLORS } from '@/lib/task-types';
import { statusClasses, statusBorderClasses, statusIconClasses, colorDotClasses, colorBorderOverrides } from '@/lib/task-styles';

interface TaskItemProps {
  task: Task;
  onDelete?: (id: string) => void;
  onCycleStatus?: (id: string) => void;
  onToggleDaily?: (id: string) => void;
  onSetColor?: (id: string, color: TaskColor) => void;
  onSplitTask?: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddToCalendar?: (id: string) => void;
  isSynced?: boolean;
  isOverlay?: boolean;
}

export function TaskItem({
  task, onDelete, onCycleStatus, onToggleDaily, onSetColor, onSplitTask,
  onMoveUp, onMoveDown, onAddToCalendar, isSynced = false, isOverlay = false,
}: TaskItemProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const taskColor = task.color || 'none';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-base cursor-grab active:cursor-grabbing ${statusClasses[task.status]} ${statusBorderClasses[task.status]} ${colorBorderOverrides[taskColor]} ${
        isOverlay ? 'shadow-overlay scale-[1.02]' : 'shadow-sm-custom hover:shadow-hover'
      }`}
      onClick={() => onCycleStatus?.(task.id)}
    >
      <GripVertical size={14} className="shrink-0 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-base" />

      <CheckCircle2 size={16} className={`shrink-0 transition-base ${statusIconClasses[task.status]}`} />

      <div className="flex-1 min-w-0 flex items-center gap-1">
        {task.isDaily && (
          <Repeat size={10} className="shrink-0 text-primary/50" />
        )}
        {taskColor !== 'none' && (
          <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${colorDotClasses[taskColor]}`} />
        )}
        {isSynced && (
          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--task-blue))]" title="Added to Google Calendar" />
        )}
        <p className={`flex-1 text-[11px] leading-relaxed break-words ${task.status === 'green' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.content}
        </p>
        {task.startTime && (
          <span className="shrink-0 flex items-center gap-0.5 text-[10px] text-muted-foreground/60" title={`${task.startTime} · ${task.durationMinutes ?? 30} min`}>
            <Clock size={10} />
            {task.startTime}
          </span>
        )}
      </div>

      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-base">
        {onMoveUp && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            className="p-1 text-muted-foreground/30 hover:text-foreground/60 rounded-lg transition-base"
            title="Move up"
          >
            <ChevronUp size={12} />
          </button>
        )}
        {onMoveDown && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            className="p-1 text-muted-foreground/30 hover:text-foreground/60 rounded-lg transition-base"
            title="Move down"
          >
            <ChevronDown size={12} />
          </button>
        )}
        {onToggleDaily && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleDaily(task.id); }}
            className={`p-1 rounded-lg transition-base ${task.isDaily ? 'text-primary' : 'text-muted-foreground/30 hover:text-primary/60'}`}
            title={task.isDaily ? 'Remove daily' : 'Set as daily'}
          >
            <Repeat size={12} />
          </button>
        )}
        {onSetColor && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
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
        )}
        {onSplitTask && (
          <button
            onClick={(e) => { e.stopPropagation(); onSplitTask(task.id); }}
            className="p-1 text-muted-foreground/30 hover:text-primary/60 rounded-lg transition-base"
            title="Split task"
          >
            <Scissors size={12} />
          </button>
        )}
        {onAddToCalendar && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToCalendar(task.id); }}
            className={`p-1 rounded-lg transition-base ${isSynced ? 'text-[hsl(var(--task-blue))]' : 'text-muted-foreground/30 hover:text-[hsl(var(--task-blue))]'}`}
            title={isSynced ? 'Added to Google Calendar' : 'Add to Google Calendar'}
          >
            <CalendarPlus size={12} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(task.id); }}
          className="p-1 text-muted-foreground/30 hover:text-destructive rounded-lg transition-base"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
