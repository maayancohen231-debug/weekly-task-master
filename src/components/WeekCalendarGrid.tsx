import { useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable, useDndMonitor } from '@dnd-kit/core';
import { Plus, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { Task, TaskColor } from '@/lib/task-types';
import type { GCalBusyEvent, GCalCalendar } from '@/services/googleCalendar';
import {
  GRID_START_HOUR, GRID_END_HOUR, GRID_HOURS, SLOT_MINUTES, PX_PER_HOUR, SLOT_TIMES,
  minutesFromGridStart, slotId, layoutOverlaps, clampToGridPx, cascadePosition,
} from '@/lib/calendar-grid';
import { CalendarTaskBlock } from './CalendarTaskBlock';
import { GCalBusyBlock } from './GCalBusyBlock';

const ZOOM_KEY = 'calendarPxPerHour';
const ZOOM_MIN = 20;
const ZOOM_MAX = 84;
const ZOOM_STEP = 8;

interface DayInfo {
  id: string;
  label: string;
  date: string;
}

interface WeekCalendarGridProps {
  days: DayInfo[];
  todayDayId: string | null;
  scheduledTasksByDay: Record<string, Task[]>;
  busyEventsByDay: Record<string, GCalBusyEvent[]>;
  syncedTaskIds: Set<string>;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onEdit?: (id: string, updates: { content?: string; startTime?: string }) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onResize?: (id: string, durationMinutes: number) => void;
  calendars?: GCalCalendar[];
  onSetCalendar?: (id: string, calendarId: string) => void;
  learnedCalendarKeywords?: Record<string, string>;
  onDeleteBusyEvent?: (event: GCalBusyEvent) => void;
  onResizeBusyEvent?: (event: GCalBusyEvent, durationMinutes: number) => void;
  onQuickAdd?: (dayId: string, time: string, text: string) => void;
}

function SlotCell({ dayId, time, height, onClick }: { dayId: string; time: string; height: number; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(dayId, time) });
  // This cell's border-b renders at its BOTTOM edge, i.e. at the start of the
  // *next* slot — so the bold hour line belongs on the half-hour slot (whose
  // bottom edge is the next full hour), not on the hour slot itself.
  const isBottomEdgeHour = time.endsWith(':30');
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{ height }}
      className={`group/slot flex items-center justify-center border-b ${isBottomEdgeHour ? 'border-border/50' : 'border-border/20'} transition-base cursor-pointer hover:bg-primary/5 ${isOver ? 'bg-primary/10' : ''}`}
      title="Click to add an event"
    >
      <Plus size={11} className="text-primary/0 [@media(hover:hover)]:group-hover/slot:text-primary/40 transition-base" />
    </div>
  );
}

function nowIndicatorTop(pxPerMinute: number): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const startMins = GRID_START_HOUR * 60;
  const endMins = GRID_END_HOUR * 60;
  if (mins < startMins || mins > endMins) return null;
  return (mins - startMins) * pxPerMinute;
}

function eventTimeString(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "GMT+3" / "GMT-5:30" style label for the corner of the time gutter, Google Calendar-style. */
function timezoneLabel(): string {
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** Pull the trailing day-of-month digits out of a "Jul 19"-style formatted date. */
function dayOfMonth(dateStr: string): string {
  return dateStr.match(/\d+$/)?.[0] ?? dateStr;
}

export function WeekCalendarGrid({
  days, todayDayId, scheduledTasksByDay, busyEventsByDay, syncedTaskIds,
  onDelete, onDuplicate, onEdit, onSetColor, onResize, calendars, onSetCalendar, learnedCalendarKeywords, onDeleteBusyEvent, onResizeBusyEvent, onQuickAdd,
}: WeekCalendarGridProps) {
  const tzLabel = useMemo(timezoneLabel, []);

  // Vertical zoom (px per hour) — persisted so a preferred density survives
  // a reload. Threaded through as a value (not a fixed constant) so every
  // top/height/drag calculation stays in sync with the current zoom level.
  const [pxPerHour, setPxPerHour] = useState(() => {
    const stored = Number(localStorage.getItem(ZOOM_KEY));
    return stored >= ZOOM_MIN && stored <= ZOOM_MAX ? stored : PX_PER_HOUR;
  });
  const pxPerMinute = pxPerHour / 60;
  const zoomBy = (delta: number) => setPxPerHour(prev => {
    const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev + delta));
    localStorage.setItem(ZOOM_KEY, String(next));
    return next;
  });

  // nowIndicatorTop reads `new Date()` fresh each call, but a plain
  // useMemo only re-runs when one of its OWN deps changes — with just
  // `pxPerMinute` as a dep, the red "now" line froze at whatever time the
  // page happened to load (or last zoom change) and never moved again,
  // which is exactly why it read as "pointing at the wrong time" and
  // "not responding": nothing was ever telling it to recompute as real
  // time passed. A ticking counter, refreshed every 30s, gives it a
  // reason to re-run periodically without needing a reload.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setNowTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
  const nowTop = useMemo(() => nowIndicatorTop(pxPerMinute), [pxPerMinute, nowTick]);
  const slotHeight = SLOT_MINUTES * pxPerMinute;
  const columnHeight = (GRID_END_HOUR - GRID_START_HOUR) * 60 * pxPerMinute;
  // A week's worth of narrow columns needs a wide scroll surface; a single
  // focused day (Day View) shouldn't force the same width and an empty gap.
  const gridMinWidth = Math.max(400, 56 + days.length * (days.length === 1 ? 420 : 104));

  const [quickAdd, setQuickAdd] = useState<{ dayId: string; time: string } | null>(null);
  const [quickAddValue, setQuickAddValue] = useState('');
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  // Which task's edit form (title/time popover) is open, lifted up here
  // instead of living as local state inside each CalendarTaskBlock — that
  // used to let every block open its OWN form independently, so clicking
  // a second block while a first one's form was still open left BOTH
  // popovers rendered at once, overlapping ("stays open and also broken").
  // At most one editing popover can exist across the whole grid now:
  // opening a new one (via onOpenEdit below) always closes whichever was
  // open before, by construction.
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Dropping a dragged event onto a slot still fires a native `click` on
  // that same slot right after — dnd-kit's PointerSensor doesn't swallow it,
  // and a droppable div's onClick has no idea a drag just landed on it. That
  // stray click was opening an unwanted "Event at HH:MM..." quick-add box
  // right on top of the event that was just moved there. Suppress clicks for
  // a brief window after any drag ends, anywhere in this grid.
  const justDraggedRef = useRef(false);
  useDndMonitor({
    onDragEnd: () => {
      justDraggedRef.current = true;
      setTimeout(() => { justDraggedRef.current = false; }, 300);
    },
  });

  const openQuickAdd = (dayId: string, time: string) => {
    if (!onQuickAdd || justDraggedRef.current) return;
    setEditingTaskId(null);
    setQuickAdd({ dayId, time });
    setQuickAddValue('');
    setTimeout(() => quickAddInputRef.current?.focus(), 0);
  };
  const closeQuickAdd = () => { setQuickAdd(null); setQuickAddValue(''); };
  const submitQuickAdd = () => {
    if (quickAdd && quickAddValue.trim()) onQuickAdd?.(quickAdd.dayId, quickAdd.time, quickAddValue);
    closeQuickAdd();
  };

  return (
    <div className="relative flex-1 flex bg-card rounded-2xl shadow-card overflow-hidden min-w-0 min-h-0">
      <div className="absolute top-1.5 right-1.5 z-40 flex items-center gap-0.5 bg-card/95 rounded-lg shadow-sm-custom border border-border/40 p-0.5">
        <button
          onClick={() => zoomBy(-ZOOM_STEP)}
          disabled={pxPerHour <= ZOOM_MIN}
          title="Zoom out (shorter hours)"
          className="p-1 text-muted-foreground/50 hover:text-foreground disabled:opacity-30 rounded transition-base"
        >
          <ZoomOut size={13} />
        </button>
        <button
          onClick={() => zoomBy(ZOOM_STEP)}
          disabled={pxPerHour >= ZOOM_MAX}
          title="Zoom in (taller hours)"
          className="p-1 text-muted-foreground/50 hover:text-foreground disabled:opacity-30 rounded transition-base"
        >
          <ZoomIn size={13} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-auto scroll-thin">
        <div className="flex" style={{ minWidth: gridMinWidth }}>
          {/* Hour axis gutter */}
          <div className="w-14 shrink-0 sticky left-0 bg-card z-10 border-r border-border/40">
            <div className="h-[44px] flex items-end justify-center pb-1.5 border-b border-border/40 sticky top-0 z-30 bg-card">
              <span className="text-[9px] font-medium text-muted-foreground/50">{tzLabel}</span>
            </div>
            <div style={{ height: columnHeight }} className="relative">
              {GRID_HOURS.map(hour => (
                <div
                  key={hour}
                  style={{ top: (hour - GRID_START_HOUR) * 60 * pxPerMinute }}
                  className="absolute -translate-y-1/2 right-2 text-[10px] text-muted-foreground/60"
                >
                  {String(hour).padStart(2, '0')}:00
                </div>
              ))}
            </div>
          </div>

          {/* Day columns */}
          {days.map(day => {
            const tasks = scheduledTasksByDay[day.id] ?? [];
            const busy = busyEventsByDay[day.id] ?? [];
            const isToday = day.id === todayDayId;

            // Busy-event times as minutes-since-grid-start, computed once and reused
            // for both overlap layout and rendering so the two stay in sync.
            const busyRanges = new Map<string, { startMin: number; endMin: number }>();
            busy.forEach(ev => {
              const start = new Date(ev.start);
              const end = new Date(ev.end);
              const startMin = minutesFromGridStart(eventTimeString(start));
              const endMin = startMin + Math.max(15, (end.getTime() - start.getTime()) / 60000);
              busyRanges.set(ev.id, { startMin, endMin });
            });

            const intervals = [
              ...tasks.map(t => ({
                id: t.id,
                startMin: minutesFromGridStart(t.startTime!),
                endMin: minutesFromGridStart(t.startTime!) + (t.durationMinutes ?? 30),
              })),
              ...busy.map(ev => {
                const r = busyRanges.get(ev.id)!;
                return { id: `busy_${ev.id}`, startMin: r.startMin, endMin: r.endMin };
              }),
            ];
            const layout = layoutOverlaps(intervals);

            return (
              <div key={day.id} className={`${days.length === 1 ? 'w-[420px] shrink-0' : 'flex-1 min-w-[104px]'} border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/[0.03]' : ''}`}>
                <div className="h-[44px] flex flex-col items-center justify-center gap-0.5 border-b border-border/40 sticky top-0 z-20 bg-card">
                  <p className={`text-[10px] font-semibold tracking-wide uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {day.label.slice(0, 3)}
                  </p>
                  <span
                    className={`flex items-center justify-center w-7 h-7 rounded-full text-[14px] font-bold transition-base ${
                      isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    }`}
                  >
                    {dayOfMonth(day.date)}
                  </span>
                </div>

                <div style={{ height: columnHeight }} className="relative">
                  {SLOT_TIMES.map(time => (
                    <SlotCell key={time} dayId={day.id} time={time} height={slotHeight} onClick={() => openQuickAdd(day.id, time)} />
                  ))}

                  {isToday && nowTop !== null && (
                    <div style={{ top: nowTop }} className="absolute left-0 right-0 z-10 pointer-events-none flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive -ml-0.5" />
                      <div className="flex-1 h-px bg-destructive/70" />
                    </div>
                  )}

                  {busy.map(ev => {
                    const l = layout.get(`busy_${ev.id}`);
                    const { leftPct, widthPct, z } = cascadePosition({
                      col: l?.col ?? 0, totalCols: l?.totalCols ?? 1, isPrimary: l?.isPrimary ?? false, hasPrimary: l?.hasPrimary ?? false,
                    });
                    const r = busyRanges.get(ev.id)!;
                    const { top, height } = clampToGridPx(r.startMin, r.endMin, pxPerMinute);
                    return (
                      <GCalBusyBlock
                        key={ev.id}
                        event={ev}
                        top={top}
                        height={height}
                        left={`${leftPct}%`}
                        width={`${widthPct}%`}
                        zIndex={z}
                        pxPerMinute={pxPerMinute}
                        hasOverlappingSecondary={!!(l?.isPrimary && l?.hasPrimary)}
                        onDelete={onDeleteBusyEvent}
                        onResize={onResizeBusyEvent}
                      />
                    );
                  })}

                  {tasks.map(task => {
                    const l = layout.get(task.id);
                    const { leftPct, widthPct, z } = cascadePosition({
                      col: l?.col ?? 0, totalCols: l?.totalCols ?? 1, isPrimary: l?.isPrimary ?? false, hasPrimary: l?.hasPrimary ?? false,
                    });
                    const duration = task.durationMinutes ?? 30;
                    const startMin = minutesFromGridStart(task.startTime!);
                    const { top, height } = clampToGridPx(startMin, startMin + duration, pxPerMinute);
                    return (
                      <CalendarTaskBlock
                        key={task.id}
                        task={task}
                        top={top}
                        height={height}
                        left={`${leftPct}%`}
                        width={`${widthPct}%`}
                        zIndex={z}
                        pxPerMinute={pxPerMinute}
                        hasOverlappingSecondary={!!(l?.isPrimary && l?.hasPrimary)}
                        onDelete={onDelete}
                        onDuplicate={onDuplicate}
                        onEdit={onEdit}
                        onSetColor={onSetColor}
                        onResize={onResize}
                        calendars={calendars}
                        onSetCalendar={onSetCalendar}
                        learnedCalendarKeywords={learnedCalendarKeywords}
                        isSynced={syncedTaskIds.has(task.id)}
                        isEditing={editingTaskId === task.id}
                        onOpenEdit={setEditingTaskId}
                      />
                    );
                  })}

                  {quickAdd?.dayId === day.id && (
                    <div
                      style={{ top: minutesFromGridStart(quickAdd.time) * pxPerMinute, zIndex: 60 }}
                      className="absolute left-0.5 right-0.5"
                      onClick={e => e.stopPropagation()}
                    >
                      <div className="bg-card rounded-lg shadow-overlay border border-primary/30 p-1 flex items-center gap-1">
                        <input
                          ref={quickAddInputRef}
                          value={quickAddValue}
                          onChange={e => setQuickAddValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') submitQuickAdd();
                            if (e.key === 'Escape') closeQuickAdd();
                          }}
                          dir="auto"
                          placeholder={`Event at ${quickAdd.time}...`}
                          className="flex-1 min-w-0 px-1.5 py-1 text-[11px] bg-muted border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40"
                        />
                        <button onClick={submitQuickAdd} title="Add" className="p-1 text-primary hover:opacity-70 transition-base shrink-0">
                          <Plus size={13} />
                        </button>
                        <button onClick={closeQuickAdd} title="Cancel" className="p-1 text-muted-foreground/50 hover:text-foreground transition-base shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
