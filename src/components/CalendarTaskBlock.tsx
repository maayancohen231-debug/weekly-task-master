import { useDraggable } from '@dnd-kit/core';
import { Trash2, Repeat, Palette, Clock, CalendarClock, Copy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Task, TaskColor } from '@/lib/task-types';
import { TASK_COLORS } from '@/lib/task-types';
import { colorDotClasses, colorBorderOverrides, colorBgTint, hexToRgba } from '@/lib/task-styles';
import { PX_PER_MINUTE as BASE_PX_PER_MINUTE, timeToMinutes, minutesToTime, PRIMARY_TEXT_SAFE_PCT } from '@/lib/calendar-grid';
import { matchCalendarName, type GCalCalendar } from '@/services/googleCalendar';

const MIN_DURATION_MINUTES = 15;
const RESIZE_SNAP_MINUTES = 15;

interface CalendarTaskBlockProps {
  task: Task;
  top: number;
  height: number;
  left: string;
  width: string;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onEdit?: (id: string, updates: { content?: string; startTime?: string }) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onResize?: (id: string, durationMinutes: number) => void;
  calendars?: GCalCalendar[];
  onSetCalendar?: (id: string, calendarId: string) => void;
  learnedCalendarKeywords?: Record<string, string>;
  isSynced?: boolean;
  isOverlay?: boolean;
  zIndex?: number;
  pxPerMinute?: number;
  hasOverlappingSecondary?: boolean;
}

export function CalendarTaskBlock({
  task, top, height, left, width, onDelete, onDuplicate, onEdit, onSetColor, onResize, calendars, onSetCalendar,
  learnedCalendarKeywords, isSynced = false, isOverlay = false, zIndex = 5, pxPerMinute = BASE_PX_PER_MINUTE,
  hasOverlappingSecondary = false,
}: CalendarTaskBlockProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editContent, setEditContent] = useState(task.content);
  const [editTime, setEditTime] = useState(task.startTime ?? '');
  const [editEndTime, setEditEndTime] = useState('');
  const [resizeDeltaPx, setResizeDeltaPx] = useState<number | null>(null);
  const [isFront, setIsFront] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const taskColor = task.color || 'none';
  const displayHeight = resizeDeltaPx !== null ? Math.max(20, height + resizeDeltaPx) : height;
  const compact = displayHeight < 40;
  const endTime = task.startTime ? minutesToTime(timeToMinutes(task.startTime) + (task.durationMinutes ?? 30)) : undefined;

  // A scheduled task should look like a calendar event (colored by its Google
  // Calendar), not a todo item — the checkbox/status look stays in the task
  // table (List View). Resolve the same calendar a sync would pick, so the
  // color matches even before the task has actually been synced yet.
  const resolvedCalendar = useMemo(() => {
    if (!calendars || calendars.length === 0) return undefined;
    if (task.calendarId) return calendars.find(c => c.id === task.calendarId);
    return matchCalendarName(task.content, calendars, learnedCalendarKeywords);
  }, [calendars, task.calendarId, task.content, learnedCalendarKeywords]);
  const eventColor = resolvedCalendar?.backgroundColor;

  // Side-by-side overlapping events are intentionally narrower than the
  // column (each gets an equal slice) — but that also means their text is
  // partly truncated by default. Bringing one to front (hover/click) also
  // expands it to the column's full width so it's actually readable.
  const front = isFront && !isDragging && resizeDeltaPx === null;

  const style: React.CSSProperties = isOverlay
    ? { width: 180, height: Math.max(height, 32) }
    : {
      position: 'absolute',
      top,
      // The hover icon row (color/calendar/delete buttons) needs ~34px of height to
      // fit without spilling past the block — shorter blocks (a 30min task at default
      // zoom is ~16px) would otherwise have the icons overflow into whatever's below.
      // Only bump it while "front" (hovered), so the resting grid layout is untouched.
      height: front ? Math.max(displayHeight, 34) : displayHeight,
      left: front ? '0%' : left,
      width: front ? '100%' : width,
      opacity: isDragging ? 0.35 : 1,
      zIndex: isDragging || resizeDeltaPx !== null ? 100 : isFront ? 50 : zIndex,
      // Near-opaque, not the old 0.85: a translucent background lets whatever
      // renders underneath (another block's text, in an overlap cluster) show
      // through instead of being cleanly hidden by a higher z-index.
      ...(eventColor ? { backgroundColor: hexToRgba(eventColor, 0.97), borderLeft: `3px solid ${eventColor}` } : {}),
    };

  const saveEdit = () => {
    if (!onEdit) return;
    const newStartTime = editTime || task.startTime;
    onEdit(task.id, { content: editContent.trim() || task.content, startTime: newStartTime });
    // End time isn't part of onEdit's own payload (it maps to durationMinutes,
    // which onResize owns) — derive the new duration from start/end here and
    // apply it the same way a drag-resize would, so the end-time field is a
    // real alternative to that drag handle, not just a display.
    if (onResize && newStartTime && editEndTime) {
      const newDuration = timeToMinutes(editEndTime) - timeToMinutes(newStartTime);
      if (newDuration >= MIN_DURATION_MINUTES && newDuration !== task.durationMinutes) {
        onResize(task.id, newDuration);
      }
    }
    setShowEditForm(false);
  };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onResize) return;
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startDuration = task.durationMinutes ?? 30;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (ev: PointerEvent) => {
      setResizeDeltaPx(ev.clientY - startY);
    };
    const handleUp = (ev: PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      setResizeDeltaPx(null);
      const deltaMinutes = (ev.clientY - startY) / pxPerMinute;
      const snapped = Math.max(
        MIN_DURATION_MINUTES,
        Math.round((startDuration + deltaMinutes) / RESIZE_SNAP_MINUTES) * RESIZE_SNAP_MINUTES,
      );
      if (snapped !== startDuration) onResize(task.id, snapped);
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        setEditContent(task.content);
        setEditTime(task.startTime ?? '');
        setEditEndTime(endTime ?? '');
        setShowEditForm(v => !v);
        setIsFront(true);
      }}
      onMouseEnter={() => setIsFront(true)}
      onMouseLeave={() => setIsFront(false)}
      title={task.content}
      className={`group ${isOverlay ? '' : 'absolute'} rounded-lg border border-border/40 ring-1 ring-card px-2 py-1 cursor-grab active:cursor-grabbing ${isDragging ? '' : 'transition-base'} ${
        eventColor ? '' : taskColor !== 'none' ? `${colorBgTint[taskColor]} ${colorBorderOverrides[taskColor]}` : 'bg-card border-l-[3px] border-l-border/50'
      } ${isOverlay ? 'shadow-overlay scale-[1.02]' : 'shadow-sm-custom hover:shadow-hover'}`}
    >
      {/* h-full + overflow-hidden clips wrapped text to the block's own height —
          without it, a wrapped multi-line title on a short (30min) block spills
          past its own box and paints over whatever renders after it in the DOM. */}
      <div className="overflow-hidden h-full">
        <div
          className="flex items-center gap-1 min-w-0"
          // A secondary event sitting on top of this one starts partway across
          // the row, not at this block's own right edge — without a matching
          // cutoff here, a long title runs straight under it and a chunk gets
          // visually chopped out of the middle instead of wrapping around it.
          style={hasOverlappingSecondary && !front ? { maxWidth: `${PRIMARY_TEXT_SAFE_PCT}%` } : undefined}
        >
          {task.isDaily && <Repeat size={9} className="shrink-0 text-foreground/50" />}
          {isSynced && <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[hsl(var(--task-blue))]" title="Synced to Google Calendar" />}
          {/* Status (done/in-progress/delayed) is a to-do concept — shown and
              editable in the Task Bank/List view only. A calendar block should
              read like a calendar event, so no strikethrough here regardless
              of status. */}
          <p className="flex-1 min-w-0 text-[11px] font-medium leading-tight break-words text-foreground/90">
            {task.content}
          </p>
        </div>
        {!compact && (
          <p className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 mt-0.5">
            <Clock size={9} />
            {task.startTime}{endTime ? ` – ${endTime}` : ''}
          </p>
        )}
      </div>

      {/* A solid chip, not bg-inherit — stacking a translucent background on top of the
          block's own translucent background double-composites into a visibly lighter,
          mismatched patch instead of blending in. */}
      <div className="absolute top-0.5 right-0.5 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 flex items-center gap-0.5 bg-card/95 rounded-md shadow-sm-custom transition-base">
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
        {calendars && calendars.length > 0 && onSetCalendar && (
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowCalendarPicker(v => !v); }}
              className="p-0.5 text-muted-foreground/40 hover:text-foreground/70 rounded transition-base"
              title="Calendar"
            >
              <CalendarClock size={11} />
            </button>
            {showCalendarPicker && (
              <div
                className="absolute right-0 top-full mt-1 z-50 bg-card rounded-xl shadow-overlay border border-border p-1.5 flex flex-col gap-0.5 min-w-[150px] max-h-56 overflow-y-auto scroll-thin"
                onClick={(e) => e.stopPropagation()}
              >
                {calendars.map((cal) => (
                  <button
                    key={cal.id}
                    onClick={() => { onSetCalendar(task.id, cal.id); setShowCalendarPicker(false); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-left hover:bg-muted transition-base ${
                      task.calendarId === cal.id ? 'bg-muted font-semibold text-foreground' : 'text-foreground/80'
                    }`}
                  >
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: cal.backgroundColor ?? '#999' }} />
                    <span className="truncate">{cal.summary}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onDuplicate && (
          <button
            onClick={(e) => { e.stopPropagation(); onDuplicate(task.id); }}
            className="p-0.5 text-muted-foreground/40 hover:text-foreground/70 rounded transition-base"
            title="Duplicate"
          >
            <Copy size={11} />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="p-0.5 text-muted-foreground/40 hover:text-destructive rounded transition-base"
        >
          <Trash2 size={11} />
        </button>
      </div>

      {onResize && !isOverlay && (
        <div
          onPointerDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
          title="Drag to resize"
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 flex items-center justify-center transition-base"
        >
          <span className="w-6 h-0.5 rounded-full bg-foreground/30" />
        </div>
      )}

      {showEditForm && onEdit && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-card rounded-xl shadow-overlay border border-border p-2 flex flex-col gap-1.5 w-48"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setShowEditForm(false); }}
            dir="auto"
            autoFocus
            placeholder="Task name..."
            className="w-full px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center gap-1">
            <input
              type="time"
              value={editTime}
              onChange={(e) => {
                const next = e.target.value;
                if (!next) { setEditTime(next); return; }
                // Editing the start should slide the whole block, not resize it —
                // shift the end by the same delta so the block's length stays put
                // no matter which direction the start moves. Previously the end
                // only got nudged when the start would overtake it, so moving the
                // start earlier (or later but still short of the old end) silently
                // stretched or shrank the block instead of just sliding it.
                // Clamped to [0, 23:59]: minutesToTime outside that range produces
                // "-x:xx"/"24:xx", which a native <input type="time"> silently
                // rejects as its controlled value — the field then stops
                // responding to any further typing at all (looks exactly like "it
                // just froze").
                if (editTime && editEndTime) {
                  const deltaMinutes = timeToMinutes(next) - timeToMinutes(editTime);
                  const pushedEnd = Math.min(23 * 60 + 59, Math.max(0, timeToMinutes(editEndTime) + deltaMinutes));
                  setEditEndTime(minutesToTime(pushedEnd));
                }
                setEditTime(next);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setShowEditForm(false); }}
              title="Start time"
              className="w-full min-w-0 px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-[10px] text-muted-foreground/50 shrink-0">–</span>
            <input
              type="time"
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setShowEditForm(false); }}
              title="End time"
              className="w-full min-w-0 px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={saveEdit}
              className="flex-1 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md transition-base"
            >
              Save
            </button>
            <button
              onClick={() => setShowEditForm(false)}
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md transition-base"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
