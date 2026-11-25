import { useDraggable } from '@dnd-kit/core';
import { Trash2, Repeat, Repeat1, CalendarClock, Copy } from 'lucide-react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useExclusivePopup } from '@/lib/useExclusivePopup';
import { createPortal } from 'react-dom';
import type { Task, TaskColor } from '@/lib/task-types';
import { categoryStyle } from '@/lib/espresso';
import { PX_PER_MINUTE as BASE_PX_PER_MINUTE, timeToMinutes, minutesToTime } from '@/lib/calendar-grid';
import { matchCalendarName, type GCalCalendar, type SyncedEventInfo } from '@/services/googleCalendar';
import { usePortalPosition } from '@/lib/usePortalPosition';
import { InvitePeopleButton } from './InvitePeopleButton';

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
  onEdit?: (id: string, updates: { content?: string; startTime?: string; durationMinutes?: number }) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onResize?: (id: string, durationMinutes: number) => void;
  calendars?: GCalCalendar[];
  onSetCalendar?: (id: string, calendarId: string) => void;
  learnedCalendarKeywords?: Record<string, string>;
  isSynced?: boolean;
  // The real Google Calendar event this block was synced to, if any —
  // needed to invite people to it.
  syncedEvent?: SyncedEventInfo;
  isOverlay?: boolean;
  zIndex?: number;
  pxPerMinute?: number;
  hasOverlappingSecondary?: boolean;
  // Whether THIS block's edit popover (title/time) is the one currently
  // open — lifted up to the parent grid so at most one can ever be open
  // across the whole calendar at once. See onOpenEdit.
  isEditing?: boolean;
  // Called with this task's id to open its edit popover (implicitly
  // closing whichever other block's was open), or with null to close
  // whichever is open. Absent entirely for the drag-overlay preview,
  // which has no real edit state to manage.
  onOpenEdit?: (id: string | null) => void;
}

export function CalendarTaskBlock({
  task, top, height, left, width, onDelete, onDuplicate, onEdit, onSetColor, onResize, calendars, onSetCalendar,
  learnedCalendarKeywords, isSynced = false, syncedEvent, isOverlay = false, zIndex = 5, pxPerMinute = BASE_PX_PER_MINUTE,
  hasOverlappingSecondary = false, isEditing = false, onOpenEdit,
}: CalendarTaskBlockProps) {
  const calendarPicker = usePortalPosition();
  const showEditForm = isEditing;
  const closeEdit = () => onOpenEdit?.(null);
  const [editContent, setEditContent] = useState(task.content);
  const [editTime, setEditTime] = useState(task.startTime ?? '');
  const [editEndTime, setEditEndTime] = useState('');
  const [resizeDeltaPx, setResizeDeltaPx] = useState<number | null>(null);
  const [isFront, setIsFront] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setRootRef = (el: HTMLDivElement | null) => { rootRef.current = el; setNodeRef(el); };
  // Opening the edit form closes any other popup, and any other popup (or a
  // press anywhere outside this block) closes the edit form.
  const editFormRef = useRef<HTMLDivElement | null>(null);
  useExclusivePopup(isEditing, closeEdit, { ref: rootRef, extraRef: editFormRef });
  // The edit form floats above the page (portal, fixed position) and is kept
  // inside the screen. As a child of the block it was cut off by the grid's
  // edges: on late hours or Saturday the Save button was out of reach.
  const [editPos, setEditPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!isEditing) { setEditPos(null); return; }
    const place = () => {
      const r = rootRef.current?.getBoundingClientRect();
      if (!r) return;
      const W = 240, H = 130, M = 8;
      const left = Math.min(Math.max(M, r.left), window.innerWidth - W - M);
      const below = r.bottom + 4;
      const top = below + H > window.innerHeight - M ? Math.max(M, r.top - H - 4) : below;
      setEditPos({ top, left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [isEditing]);
  const displayHeight = resizeDeltaPx !== null ? Math.max(20, height + resizeDeltaPx) : height;
  const durationMin = task.durationMinutes ?? 30;
  // Up to an hour: one line, title + start time. Longer: title, then the time range.
  const short = durationMin <= 60 || displayHeight < 44;
  const clampLines = durationMin <= 120 ? 'line-clamp-2' : 'line-clamp-3';
  // Clamped to 23:59 so a task whose stored duration already pushes past
  // midnight (old data from before resizing was capped, see handleResizeStart
  // below) can't display as "26:00" — minutesToTime has no day wraparound.
  const endTime = task.startTime
    ? minutesToTime(Math.min(23 * 60 + 59, timeToMinutes(task.startTime) + (task.durationMinutes ?? 30)))
    : undefined;

  // A scheduled task should look like a calendar event (colored by its Google
  // Calendar), not a todo item — the checkbox/status look stays in the task
  // table (List View). Resolve the same calendar a sync would pick, so the
  // color matches even before the task has actually been synced yet.
  const resolvedCalendar = useMemo(() => {
    if (!calendars || calendars.length === 0) return undefined;
    if (task.calendarId) return calendars.find(c => c.id === task.calendarId);
    return matchCalendarName(task.content, calendars, learnedCalendarKeywords);
  }, [calendars, task.calendarId, task.content, learnedCalendarKeywords]);
  // Espresso (R-439): fixed colour by the calendar's category, no colour picker.
  const cat = categoryStyle(resolvedCalendar?.summary);

  // Side-by-side overlapping events are intentionally narrower than the
  // column (each gets an equal slice) — but that also means their text is
  // partly truncated by default. Bringing one to front (hover/click) also
  // expands it to the column's full width so it's actually readable.
  const front = isFront && !isDragging && resizeDeltaPx === null;
  // A primary with a secondary layered on it must never expand over the
  // full row (or outrank the secondary's z-index) on hover — the secondary
  // already sits almost entirely inside the primary's own footprint (see
  // cascadePosition), so doing either would bury it completely with no
  // exposed sliver left to reach it through. Its own title is already
  // close to fully visible via PRIMARY_TEXT_SAFE_PCT, so this widening
  // isn't needed here anyway — it still helps genuinely equal-width
  // side-by-side splits, which is the only case it's left enabled for.
  // Espresso (R-439): overlapping events stay side by side; the tooltip has the full title.
  const expandOnFront = false && front && !hasOverlappingSecondary;

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
      left: expandOnFront ? '0%' : left,
      width: expandOnFront ? '100%' : width,
      opacity: isDragging ? 0.35 : 1,
      zIndex: isDragging || resizeDeltaPx !== null ? 100 : expandOnFront ? 50 : zIndex,
      // Near-opaque, not the old 0.85: a translucent background lets whatever
      // renders underneath (another block's text, in an overlap cluster) show
      // through instead of being cleanly hidden by a higher z-index.
      backgroundColor: cat.bg,
      color: cat.fg,
      boxShadow: cat.ring ? `inset 0 0 0 1px ${cat.ring}` : undefined,
    };

  const saveEdit = () => {
    if (!onEdit) return;
    const newStartTime = editTime || task.startTime;
    // The end time becomes a duration and is saved in the same call as the
    // start and title, so Google gets one consistent update (a separate
    // resize call used to resend the old start time right after).
    let durationMinutes: number | undefined;
    if (newStartTime && editEndTime) {
      const d = timeToMinutes(editEndTime) - timeToMinutes(newStartTime);
      if (d >= MIN_DURATION_MINUTES) durationMinutes = d;
    }
    onEdit(task.id, { content: editContent.trim() || task.content, startTime: newStartTime, durationMinutes });
    closeEdit();
  };

  // True once a press on the resize strip actually dragged. A plain click on
  // the strip (it covers half of a short 30-minute block) must still open the
  // edit form instead of being swallowed — that made events look uneditable.
  const resizedRef = useRef(false);
  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onResize) return;
    resizedRef.current = false;
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startDuration = task.durationMinutes ?? 30;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientY - startY) > 3) resizedRef.current = true;
      setResizeDeltaPx(ev.clientY - startY);
    };
    const handleUp = (ev: PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      setResizeDeltaPx(null);
      const deltaMinutes = (ev.clientY - startY) / pxPerMinute;
      // Cap so the block's end can't cross midnight (e.g. dragging a 23:00
      // block down used to save a 180min duration and show "23:00 – 26:00")
      // — nothing above renders a "next day" continuation of the block.
      const maxDuration = task.startTime ? Math.max(MIN_DURATION_MINUTES, 23 * 60 + 59 - timeToMinutes(task.startTime)) : Infinity;
      const snapped = Math.min(
        maxDuration,
        Math.max(MIN_DURATION_MINUTES, Math.round((startDuration + deltaMinutes) / RESIZE_SNAP_MINUTES) * RESIZE_SNAP_MINUTES),
      );
      if (snapped !== startDuration) onResize(task.id, snapped);
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      ref={setRootRef}
      style={isOverlay ? { ...style, backgroundColor: cat.bg, color: cat.fg } : style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!onOpenEdit) return;
        if (isEditing) {
          onOpenEdit(null);
        } else {
          setEditContent(task.content);
          setEditTime(task.startTime ?? '');
          setEditEndTime(endTime ?? '');
          onOpenEdit(task.id);
        }
        setIsFront(true);
      }}
      onMouseEnter={() => setIsFront(true)}
      onMouseLeave={() => setIsFront(false)}
      title={`${task.content || '(No title)'} · ${task.startTime ?? ''}${endTime ? `–${endTime}` : ''}`}
      className={`group ${isOverlay ? '' : 'absolute'} rounded-[8px] ${short ? 'px-[9px] py-[5px]' : 'px-[9px] py-[7px]'} cursor-grab active:cursor-grabbing ${isDragging ? '' : 'transition-base'} ${isOverlay ? 'shadow-overlay scale-[1.02]' : 'hover:brightness-[0.97]'}`}
    >
      {/* h-full + overflow-hidden clips wrapped text to the block's own height —
          without it, a wrapped multi-line title on a short (30min) block spills
          past its own box and paints over whatever renders after it in the DOM. */}
      <div className="overflow-hidden h-full">
        {short ? (
          <p className="flex items-baseline gap-1.5 min-w-0 text-[12px] leading-[1.25]">
            {task.isDaily && <Repeat size={10} className="shrink-0 self-center opacity-60" />}
            {task.isWeekly && <Repeat1 size={10} className="shrink-0 self-center opacity-60" />}
            <span className={`min-w-[2.5em] truncate font-medium ${task.content ? '' : 'italic opacity-60'}`}>{task.content || '(No title)'}</span>
            <span className="min-w-0 shrink-[6] overflow-hidden whitespace-nowrap text-[11px] opacity-75">{task.startTime}</span>
          </p>
        ) : (
          <>
            <p className={`text-[12px] font-medium leading-[1.3] break-words ${clampLines} ${task.content ? '' : 'italic opacity-60'}`}>
              {task.isDaily && <Repeat size={10} className="inline mr-1 -mt-0.5 opacity-60" />}
              {task.isWeekly && <Repeat1 size={10} className="inline mr-1 -mt-0.5 opacity-60" />}
              {task.content || '(No title)'}
            </p>
            <p className="mt-0.5 text-[11px] opacity-75 truncate">{task.startTime}{endTime ? `–${endTime}` : ''}</p>
          </>
        )}
      </div>

      {/* A solid chip, not bg-inherit — stacking a translucent background on top of the
          block's own translucent background double-composites into a visibly lighter,
          mismatched patch instead of blending in. */}
      <div className="absolute top-0.5 right-0.5 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 flex items-center gap-0.5 bg-card/95 rounded-md shadow-sm-custom transition-base">
        {calendars && calendars.length > 0 && onSetCalendar && (
          <div className="relative">
            <button
              ref={calendarPicker.btnRef}
              onClick={(e) => { e.stopPropagation(); calendarPicker.pos ? calendarPicker.close() : calendarPicker.open(); }}
              className="p-0.5 text-muted-foreground/40 hover:text-foreground/70 rounded transition-base"
              title="Calendar"
            >
              <CalendarClock size={11} />
            </button>
            {calendarPicker.pos && createPortal(
              <div
                ref={calendarPicker.popRef}
                style={{ position: 'fixed', top: calendarPicker.pos.top, right: calendarPicker.pos.right }}
                className="z-[200] bg-card rounded-xl shadow-overlay border border-border p-1.5 flex flex-col gap-0.5 min-w-[150px] max-h-56 overflow-y-auto scroll-thin"
                onClick={(e) => e.stopPropagation()}
              >
                {calendars.map((cal) => (
                  <button
                    key={cal.id}
                    onClick={() => { onSetCalendar(task.id, cal.id); calendarPicker.close(); }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-left hover:bg-muted transition-base ${
                      task.calendarId === cal.id ? 'bg-muted font-semibold text-foreground' : 'text-foreground/80'
                    }`}
                  >
                    <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: cal.backgroundColor ?? '#999' }} />
                    <span className="truncate">{cal.summary}</span>
                  </button>
                ))}
              </div>,
              document.body,
            )}
          </div>
        )}
        {syncedEvent && !isOverlay && (
          <InvitePeopleButton
            calendarId={syncedEvent.calendarId}
            eventId={syncedEvent.eventId}
            className="p-0.5 text-muted-foreground/40 hover:text-foreground/70 rounded transition-base"
          />
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
          onClick={(e) => { if (resizedRef.current) e.stopPropagation(); }}
          title="Drag to resize"
          className={`absolute bottom-0 left-0 right-0 ${displayHeight < 30 ? 'h-1' : 'h-2'} cursor-ns-resize opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 flex items-center justify-center transition-base`}
        >
          <span className="w-6 h-0.5 rounded-full bg-foreground/30" />
        </div>
      )}

      {showEditForm && onEdit && editPos && createPortal(
        <div
          ref={editFormRef}
          style={{ position: 'fixed', top: editPos.top, left: editPos.left, width: 240 }}
          className="z-[200] bg-card rounded-xl shadow-overlay border border-border p-2 flex flex-col gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') closeEdit(); }}
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
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') closeEdit(); }}
              title="Start time"
              className="w-full min-w-0 px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <span className="text-[10px] text-muted-foreground/50 shrink-0">–</span>
            <input
              type="time"
              value={editEndTime}
              onChange={(e) => setEditEndTime(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') closeEdit(); }}
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
              onClick={closeEdit}
              className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md transition-base"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
