import { useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus, X } from 'lucide-react';
import type { Task, TaskColor } from '@/lib/task-types';
import type { GCalBusyEvent, GCalCalendar } from '@/services/googleCalendar';
import {
  GRID_START_HOUR, GRID_END_HOUR, GRID_HOURS, SLOT_MINUTES, PX_PER_MINUTE, SLOT_TIMES,
  minutesFromGridStart, slotId, layoutOverlaps, clampToGridPx, cascadePosition,
} from '@/lib/calendar-grid';
import { CalendarTaskBlock } from './CalendarTaskBlock';
import { GCalBusyBlock } from './GCalBusyBlock';

const SLOT_HEIGHT = SLOT_MINUTES * PX_PER_MINUTE;
const COLUMN_HEIGHT = (GRID_END_HOUR - GRID_START_HOUR) * 60 * PX_PER_MINUTE;

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
  onCycleStatus: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onResize?: (id: string, durationMinutes: number) => void;
  calendars?: GCalCalendar[];
  onSetCalendar?: (id: string, calendarId: string) => void;
  onDeleteBusyEvent?: (event: GCalBusyEvent) => void;
  onResizeBusyEvent?: (event: GCalBusyEvent, durationMinutes: number) => void;
  onQuickAdd?: (dayId: string, time: string, text: string) => void;
}

function SlotCell({ dayId, time, onClick }: { dayId: string; time: string; onClick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(dayId, time) });
  const isHourStart = time.endsWith(':00');
  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{ height: SLOT_HEIGHT }}
      className={`group/slot border-b ${isHourStart ? 'border-border/50' : 'border-border/20'} transition-base cursor-pointer hover:bg-primary/5 ${isOver ? 'bg-primary/10' : ''}`}
      title="Click to add an event"
    >
      <Plus size={11} className="mx-auto mt-0.5 text-primary/0 [@media(hover:hover)]:group-hover/slot:text-primary/40 transition-base" />
    </div>
  );
}

function nowIndicatorTop(): number | null {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const startMins = GRID_START_HOUR * 60;
  const endMins = GRID_END_HOUR * 60;
  if (mins < startMins || mins > endMins) return null;
  return (mins - startMins) * PX_PER_MINUTE;
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
  onDelete, onCycleStatus, onSetColor, onResize, calendars, onSetCalendar, onDeleteBusyEvent, onResizeBusyEvent, onQuickAdd,
}: WeekCalendarGridProps) {
  const nowTop = useMemo(nowIndicatorTop, []);
  const tzLabel = useMemo(timezoneLabel, []);

  const [quickAdd, setQuickAdd] = useState<{ dayId: string; time: string } | null>(null);
  const [quickAddValue, setQuickAddValue] = useState('');
  const quickAddInputRef = useRef<HTMLInputElement>(null);

  const openQuickAdd = (dayId: string, time: string) => {
    if (!onQuickAdd) return;
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
    <div className="flex-1 flex bg-card rounded-2xl shadow-card overflow-hidden min-w-0 min-h-0">
      <div className="flex-1 overflow-y-auto overflow-x-auto scroll-thin">
        <div className="flex min-w-[860px]">
          {/* Hour axis gutter */}
          <div className="w-14 shrink-0 sticky left-0 bg-card z-10 border-r border-border/40">
            <div className="h-[44px] flex items-end justify-center pb-1.5 border-b border-border/40">
              <span className="text-[9px] font-medium text-muted-foreground/50">{tzLabel}</span>
            </div>
            <div style={{ height: COLUMN_HEIGHT }} className="relative">
              {GRID_HOURS.map(hour => (
                <div
                  key={hour}
                  style={{ top: (hour - GRID_START_HOUR) * 60 * PX_PER_MINUTE }}
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
              <div key={day.id} className={`flex-1 min-w-[104px] border-r border-border/30 last:border-r-0 ${isToday ? 'bg-primary/[0.03]' : ''}`}>
                <div className="h-[44px] flex flex-col items-center justify-center gap-0.5 border-b border-border/40">
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

                <div style={{ height: COLUMN_HEIGHT }} className="relative">
                  {SLOT_TIMES.map(time => (
                    <SlotCell key={time} dayId={day.id} time={time} onClick={() => openQuickAdd(day.id, time)} />
                  ))}

                  {isToday && nowTop !== null && (
                    <div style={{ top: nowTop }} className="absolute left-0 right-0 z-10 pointer-events-none flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive -ml-0.5" />
                      <div className="flex-1 h-px bg-destructive/70" />
                    </div>
                  )}

                  {busy.map(ev => {
                    const l = layout.get(`busy_${ev.id}`);
                    const { leftPct, widthPct, z } = cascadePosition(l?.col ?? 0, l?.totalCols ?? 1);
                    const r = busyRanges.get(ev.id)!;
                    const { top, height } = clampToGridPx(r.startMin, r.endMin);
                    return (
                      <GCalBusyBlock
                        key={ev.id}
                        event={ev}
                        top={top}
                        height={height}
                        left={`${leftPct}%`}
                        width={`${widthPct}%`}
                        zIndex={z}
                        onDelete={onDeleteBusyEvent}
                        onResize={onResizeBusyEvent}
                      />
                    );
                  })}

                  {tasks.map(task => {
                    const l = layout.get(task.id);
                    const { leftPct, widthPct, z } = cascadePosition(l?.col ?? 0, l?.totalCols ?? 1);
                    const duration = task.durationMinutes ?? 30;
                    const startMin = minutesFromGridStart(task.startTime!);
                    const { top, height } = clampToGridPx(startMin, startMin + duration);
                    return (
                      <CalendarTaskBlock
                        key={task.id}
                        task={task}
                        top={top}
                        height={height}
                        left={`${leftPct}%`}
                        width={`${widthPct}%`}
                        zIndex={10 + z}
                        onDelete={onDelete}
                        onCycleStatus={onCycleStatus}
                        onSetColor={onSetColor}
                        onResize={onResize}
                        calendars={calendars}
                        onSetCalendar={onSetCalendar}
                        isSynced={syncedTaskIds.has(task.id)}
                      />
                    );
                  })}

                  {quickAdd?.dayId === day.id && (
                    <div
                      style={{ top: minutesFromGridStart(quickAdd.time) * PX_PER_MINUTE, zIndex: 60 }}
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
