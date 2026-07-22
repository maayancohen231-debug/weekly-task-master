import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Repeat, Palette, Clock } from 'lucide-react';
import { useState } from 'react';
import type { Task, TaskColor } from '@/lib/task-types';
import { TASK_COLORS } from '@/lib/task-types';
import { statusClasses, statusBorderClasses, colorDotClasses, colorBorderOverrides } from '@/lib/task-styles';

interface CalendarTaskBlockProps {
  task: Task;
  top: number;
  height: number;
  left: string;
  width: string;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  isSynced?: boolean;
  isOverlay?: boolean;
  zIndex?: number;
}

export function CalendarTaskBlock({
  task, top, height, left, width, onDelete, onCycleStatus, onSetColor, isSynced = false, isOverlay = false, zIndex = 5,
}: CalendarTaskBlockProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const taskColor = task.color || 'none';
  const compact = height < 40;

  const style: React.CSSProperties = isOverlay
    ? { width: 180, height: Math.max(height, 32) }
    : {
      position: 'absolute',
      top, height, left, width,
      transform: transform ? CSS.Translate.toString(transform) : undefined,
      opacity: isDragging ? 0.35 : 1,
      zIndex: isDragging ? 100 : zIndex,
    };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onCycleStatus(task.id)}
      className={`group ${isOverlay ? '' : 'absolute'} rounded-lg border px-2 py-1 cursor-grab active:cursor-grabbing transition-base ${statusClasses[task.status]} ${statusBorderClasses[task.status]} ${colorBorderOverrides[taskColor]} ${
        isOverlay ? 'shadow-overlay scale-[1.02]' : 'shadow-sm-custom hover:shadow-hover'
      }`}
    >
      <div className="overflow-hidden">
        <div className="flex items-center gap-1 min-w-0">
          {task.isDaily && <Repeat size={9} className="shrink-0 text-primary/50" />}
          {taskColor !== 'none' && <span className={`shrink-0 w-1.5 h-1.5 rounded-full ${colorDotClasses[taskColor]}`} />}
          {isSynced && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--task-blue))]" title="Synced to Google Calendar" />}
          <p className={`flex-1 min-w-0 text-[11px] font-medium leading-tight truncate ${task.status === 'green' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.content}
          </p>
        </div>
        {!compact && (
          <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 mt-0.5">
            <Clock size={9} />
            {task.startTime}
          </p>
        )}
      </div>

      <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-inherit transition-base">
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColorPicker(v => !v); }}
            className="p-0.5 text-muted-foreground/40 hover:text-foreground/70 rounded transition-base"
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
          className="p-0.5 text-muted-foreground/40 hover:text-destructive rounded transition-base"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
