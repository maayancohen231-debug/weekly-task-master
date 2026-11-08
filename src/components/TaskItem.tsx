import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, CheckCircle2, Repeat, Repeat1, Palette, Scissors, CalendarPlus, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { useState } from 'react';
import type { Task, TaskColor } from '@/lib/task-types';
import { TASK_COLORS, DAYS } from '@/lib/task-types';
import { statusIconClasses, colorDotClasses, colorBorderOverrides } from '@/lib/task-styles';

interface TaskItemProps {
  task: Task;
  onDelete?: (id: string) => void;
  onCycleStatus?: (id: string) => void;
  onToggleDaily?: (id: string) => void;
  onToggleWeekly?: (id: string) => void;
  onSetColor?: (id: string, color: TaskColor) => void;
  onSplitTask?: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddToCalendar?: (id: string) => void;
  isSynced?: boolean;
  isOverlay?: boolean;
}

export function TaskItem({
  task, onDelete, onCycleStatus, onToggleDaily, onToggleWeekly, onSetColor, onSplitTask,
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

  const isDone = task.status === 'green';
  // Done = quiet (faded, struck through). In-progress / stuck keep a soft tint
  // so they still stand out from plain open tasks.
  const surface =
    task.status === 'yellow' ? 'bg-[hsl(var(--status-yellow-bg))] border-[hsl(var(--status-yellow)/0.25)]'
    : task.status === 'red' ? 'bg-[hsl(var(--status-red-bg))] border-[hsl(var(--status-red)/0.25)]'
    : isDone ? 'bg-muted/30 border-transparent'
    : 'bg-card border-border/70';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative flex flex-col rounded-xl border transition-base cursor-grab active:cursor-grabbing ${surface} ${colorBorderOverrides[taskColor]} ${
        isOverlay ? 'shadow-overlay scale-[1.02] bg-card' : isDone ? '' : 'hover:shadow-sm-custom hover:border-border'
      }`}
      onClick={() => onCycleStatus?.(task.id)}
    >
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <CheckCircle2
          size={17}
          strokeWidth={isDone ? 2.25 : 1.75}
          className={`shrink-0 mt-px transition-base ${statusIconClasses[task.status]} ${task.status === 'none' ? 'group-hover:text-primary/50' : ''}`}
        />

        <div className="flex-1 min-w-0">
          <p
            dir="auto"
            className={`text-[13px] leading-snug break-words ${isDone ? 'line-through decoration-muted-foreground/40 text-muted-foreground/70' : 'text-foreground'}`}
          >
            {task.content}
          </p>
          {(task.isDaily || task.isWeekly || taskColor !== 'none' || isSynced || task.startTime) && (
            <div className={`flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1 text-[10.5px] ${isDone ? 'text-muted-foreground/50' : 'text-muted-foreground/70'}`}>
              {task.startTime && (
                <span className="inline-flex items-center gap-0.5 tabular-nums" title={`${task.startTime} · ${task.durationMinutes ?? 30} min`}>
                  <Clock size={10} /> {task.startTime}
                </span>
              )}
              {task.isDaily && <span className="inline-flex items-center gap-0.5"><Repeat size={10} /> Daily</span>}
              {task.isWeekly && <span className="inline-flex items-center gap-0.5"><Repeat1 size={10} /> Weekly</span>}
              {taskColor !== 'none' && <span className={`w-1.5 h-1.5 rounded-full ${colorDotClasses[taskColor]}`} />}
              {isSynced && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--task-blue))]" title="Added to Google Calendar" />}
            </div>
          )}
        </div>
      </div>

      {/* Actions: on touch screens an inline row under the content; with a mouse
          a small floating toolbar that appears on hover, so cards don't carry an
          empty row of invisible buttons. */}
      {!isOverlay && (
      <div className="flex items-center flex-wrap justify-end gap-0.5 px-2 pb-1.5 transition-base
        [@media(hover:hover)]:absolute [@media(hover:hover)]:top-1 [@media(hover:hover)]:right-1 [@media(hover:hover)]:z-20
        [@media(hover:hover)]:p-0.5 [@media(hover:hover)]:bg-card [@media(hover:hover)]:rounded-lg [@media(hover:hover)]:shadow-overlay [@media(hover:hover)]:border [@media(hover:hover)]:border-border/60
        [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-hover:pointer-events-auto">
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
        {onToggleWeekly && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleWeekly(task.id); }}
            className={`p-1 rounded-lg transition-base ${task.isWeekly ? 'text-primary' : 'text-muted-foreground/30 hover:text-primary/60'}`}
            title={task.isWeekly ? 'Stop repeating weekly' : `Repeat every ${DAYS.find(d => d.id === task.dayId)?.label ?? 'week'}`}
          >
            <Repeat1 size={12} />
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
      )}
    </div>
  );
}
