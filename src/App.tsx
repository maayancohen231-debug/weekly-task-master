import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, DragEndEvent, DragStartEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, GraduationCap, DatabaseZap, CalendarDays, Unlink, ListTodo } from 'lucide-react';
import { AcademicBoard } from '@/components/AcademicBoard';
import { ListsPage } from '@/components/ListsPage';
import { forceSeedData } from '@/lib/seed';
import {
  isConfigured, isTokenValid, requestToken, clearToken,
  loadSyncedEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  saveSyncedEvent, fetchWeekEvents, fetchCalendars, matchCalendarName,
  type SyncedEventInfo, type GCalBusyEvent, type GCalCalendar,
} from '@/services/googleCalendar';
import { WeekCalendarGrid } from '@/components/WeekCalendarGrid';
import { TaskBankSidebar } from '@/components/TaskBankSidebar';
import { CalendarTaskBlock } from '@/components/CalendarTaskBlock';
import { StatsCard } from '@/components/StatsCard';
import { LibraryPanel } from '@/components/LibraryPanel';
import { WeeklyGoals, type WeeklyGoal } from '@/components/WeeklyGoals';
import { translateText } from '@/lib/translate';
import { parseSlotId, BANK_ID } from '@/lib/calendar-grid';
import {
  DAYS, DAY_INDEX_TO_ID, getWeekSunday, getWeekKey, formatDayDate, getMonthYear, getWeekRange, nextStatus,
  formatLocalDateTime,
} from '@/lib/task-types';
import type { Task, LibraryTask, TaskColor } from '@/lib/task-types';

// ── Error Boundary ────────────────────────────────────────────────────────────

interface EBState { hasError: boolean; message: string }
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(err: Error): EBState {
    return { hasError: true, message: err.message };
  }
  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] caught:', err, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-8">
          <div className="bg-card rounded-2xl shadow-card p-8 max-w-md w-full text-center space-y-4">
            <p className="text-2xl">⚠️</p>
            <h2 className="text-lg font-bold text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground font-mono bg-muted p-3 rounded-xl text-left break-words">
              {this.state.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-base"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'weekly-planner-data';
const DAY_IDS = DAYS.map(d => d.id);

interface StorageData {
  tasksByWeek: Record<string, Task[]>;
  goalsByWeek: Record<string, WeeklyGoal[]>;
  libraryTasks: LibraryTask[];
}

function loadStorage(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StorageData>;
      return {
        tasksByWeek: parsed.tasksByWeek ?? {},
        goalsByWeek: parsed.goalsByWeek ?? {},
        libraryTasks: parsed.libraryTasks ?? [],
      };
    }
  } catch { /* ignore */ }
  return { tasksByWeek: {}, goalsByWeek: {}, libraryTasks: [] };
}

function genId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function getRealId(id: string): string {
  const parts = id.split('_');
  if (parts.length > 1 && (DAY_IDS as string[]).includes(parts[parts.length - 1])) {
    return parts.slice(0, -1).join('_');
  }
  return id;
}

// ── App shell — only handles page routing, no other hooks ────────────────────

export default function App() {
  const [page, setPage] = useState<'planner' | 'academic' | 'lists'>('planner');

  if (page === 'academic') {
    return (
      <ErrorBoundary>
        <AcademicBoard onBack={() => setPage('planner')} />
      </ErrorBoundary>
    );
  }

  if (page === 'lists') {
    return (
      <ErrorBoundary>
        <ListsPage onBack={() => setPage('planner')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Planner onNavigateAcademic={() => setPage('academic')} onNavigateLists={() => setPage('lists')} />
    </ErrorBoundary>
  );
}

// ── Planner — all hooks live here ────────────────────────────────────────────

function Planner({ onNavigateAcademic, onNavigateLists }: { onNavigateAcademic: () => void; onNavigateLists: () => void }) {
  const [weekStart, setWeekStart] = useState(() => getWeekSunday(new Date()));
  const weekKey = useMemo(() => getWeekKey(weekStart), [weekStart]);
  const currentWeekSunday = useMemo(() => getWeekSunday(new Date()), []);
  const isCurrentWeek = weekStart.getTime() === currentWeekSunday.getTime();

  const todayDayId = useMemo(() => {
    if (!isCurrentWeek) return null;
    const dayIndex = new Date().getDay();
    return DAY_INDEX_TO_ID[dayIndex] ?? null;
  }, [isCurrentWeek]);

  const [storageData, setStorageData] = useState<StorageData>(loadStorage);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(() => isTokenValid());
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [syncedEvents, setSyncedEvents] = useState<Record<string, SyncedEventInfo>>(() => loadSyncedEvents());
  const syncedTaskIds = useMemo(() => new Set(Object.keys(syncedEvents)), [syncedEvents]);
  const [busyEventsByDay, setBusyEventsByDay] = useState<Record<string, GCalBusyEvent[]>>({});

  // Silent token refresh — only if a token already exists (even expired)
  useEffect(() => {
    if (!isConfigured()) return;
    const tryRefresh = async () => {
      if (isTokenValid()) { setGcalConnected(true); return; }
      const hasStoredToken = !!localStorage.getItem('gcal_token');
      if (!hasStoredToken) return;
      try {
        await requestToken(''); // silent — no popup if user already granted consent
        setGcalConnected(true);
      } catch {
        // Silent refresh failed — keep current state, don't force disconnect
      }
    };
    tryRefresh();
    const id = setInterval(tryRefresh, 45 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectCalendar = async () => {
    try {
      await requestToken('consent');
      setGcalConnected(true);
    } catch (err) {
      console.error('Google Calendar connect failed:', err);
    }
  };

  const handleDisconnectCalendar = () => {
    clearToken();
    setGcalConnected(false);
  };

  // Cache the user's calendar list once connected, so tasks can be
  // auto-matched to a calendar without prompting.
  useEffect(() => {
    if (!gcalConnected) { setCalendars([]); return; }
    fetchCalendars().then(setCalendars).catch(() => setCalendars([]));
  }, [gcalConnected]);

  // Pull existing Google Calendar events for the visible week, bucketed by day.
  const busyFetchRef = useRef(0);
  useEffect(() => {
    if (!gcalConnected) { setBusyEventsByDay({}); return; }
    const requestId = ++busyFetchRef.current;
    const load = async () => {
      try {
        const rangeStart = new Date(weekStart);
        const rangeEnd = new Date(weekStart);
        rangeEnd.setDate(rangeEnd.getDate() + 5); // covers sun..thu
        const events = await fetchWeekEvents(rangeStart.toISOString(), rangeEnd.toISOString());
        if (busyFetchRef.current !== requestId) return; // stale response, a newer week was requested
        const byDay: Record<string, GCalBusyEvent[]> = {};
        for (const ev of events) {
          const start = new Date(ev.start);
          const dayStart = new Date(weekStart);
          dayStart.setHours(0, 0, 0, 0);
          const diffDays = Math.round((new Date(start).setHours(0, 0, 0, 0) - dayStart.getTime()) / 86_400_000);
          const dayId = DAY_INDEX_TO_ID[diffDays];
          if (!dayId) continue;
          (byDay[dayId] ??= []).push(ev);
        }
        setBusyEventsByDay(byDay);
      } catch (err) {
        if (busyFetchRef.current !== requestId) return;
        console.warn('[App] failed to fetch busy events:', err);
        setBusyEventsByDay({});
      }
    };
    load();
  }, [weekKey, gcalConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const tasks = useMemo(() => storageData.tasksByWeek[weekKey] ?? [], [storageData, weekKey]);
  const goals = useMemo(() => storageData.goalsByWeek[weekKey] ?? [], [storageData, weekKey]);
  const libraryTasks = storageData.libraryTasks;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
  }, [storageData]);

  const setTasks = useCallback((updater: (prev: Task[]) => Task[]) => {
    setStorageData(prev => ({
      ...prev,
      tasksByWeek: { ...prev.tasksByWeek, [weekKey]: updater(prev.tasksByWeek[weekKey] ?? []) },
    }));
  }, [weekKey]);

  const setGoals = useCallback((updater: (prev: WeeklyGoal[]) => WeeklyGoal[]) => {
    setStorageData(prev => ({
      ...prev,
      goalsByWeek: { ...prev.goalsByWeek, [weekKey]: updater(prev.goalsByWeek[weekKey] ?? []) },
    }));
  }, [weekKey]);

  const setLibraryTasks = useCallback((updater: (prev: LibraryTask[]) => LibraryTask[]) => {
    setStorageData(prev => ({ ...prev, libraryTasks: updater(prev.libraryTasks) }));
  }, []);

  // Auto-populate current week with any recurring (isDaily) tasks from other weeks
  useEffect(() => {
    setStorageData(prev => {
      const weekTasks = prev.tasksByWeek[weekKey] ?? [];

      const allDailyTasks = Object.values(prev.tasksByWeek).flat().filter(t => t.isDaily);
      if (allDailyTasks.length === 0) return prev;

      const seen = new Set<string>();
      const templates: Task[] = [];
      for (const t of allDailyTasks) {
        const key = `${t.content}|${t.dayId}`;
        if (!seen.has(key)) { seen.add(key); templates.push(t); }
      }

      const existingKeys = new Set(weekTasks.filter(t => t.isDaily).map(t => `${t.content}|${t.dayId}`));
      const toAdd = templates.filter(t => !existingKeys.has(`${t.content}|${t.dayId}`));
      if (toAdd.length === 0) return prev;

      const newTasks: Task[] = toAdd.map((t, i) => ({
        ...t,
        id: genId(),
        status: 'none' as const,
        dailyStatuses: {},
        sortOrder: weekTasks.length + i,
      }));

      return {
        ...prev,
        tasksByWeek: {
          ...prev.tasksByWeek,
          [weekKey]: [...weekTasks, ...newTasks],
        },
      };
    });
  }, [weekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const progress = useMemo(() => {
    let total = 0, done = 0;
    tasks.forEach(t => {
      if (t.isDaily) {
        DAYS.forEach(d => { total++; if ((t.dailyStatuses?.[d.id] ?? t.status) === 'green') done++; });
      } else {
        total++;
        if (t.status === 'green') done++;
      }
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [tasks]);

  // Unscheduled tasks (no startTime) — the task bank.
  const bankTasks = useMemo(() => tasks.filter(t => !t.startTime), [tasks]);

  // Scheduled tasks (have startTime), bucketed by day — isDaily tasks appear
  // in every day column with an independently-clickable status per day.
  const scheduledTasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    DAYS.forEach(d => { map[d.id] = []; });
    tasks.forEach(t => {
      if (!t.startTime) return;
      if (t.isDaily) {
        DAYS.forEach(d => {
          const dayStatus = (t.dailyStatuses?.[d.id] ?? t.status) as Task['status'];
          map[d.id].push({ ...t, dayId: d.id, id: `${t.id}_${d.id}`, status: dayStatus });
        });
      } else if (map[t.dayId]) {
        map[t.dayId].push(t);
      }
    });
    return map;
  }, [tasks]);

  // ── Google Calendar auto-sync ────────────────────────────────────────────

  const syncTaskToCalendar = useCallback(async (
    syncKey: string, content: string, dayIndex: number, time: string, duration: number, existingCalendarId?: string,
  ) => {
    if (!gcalConnected || calendars.length === 0) return;
    const calendarId = existingCalendarId ?? matchCalendarName(content, calendars)?.id;
    if (!calendarId) return;
    const startDateTime = formatLocalDateTime(weekStart, dayIndex, time);
    const existing = syncedEvents[syncKey];
    try {
      if (existing) {
        await updateCalendarEvent(existing.calendarId, existing.eventId, startDateTime, duration);
        const info: SyncedEventInfo = { ...existing, syncedAt: new Date().toISOString() };
        saveSyncedEvent(syncKey, info);
        setSyncedEvents(prev => ({ ...prev, [syncKey]: info }));
      } else {
        const event = await createCalendarEvent(calendarId, content, startDateTime, '', duration);
        const info: SyncedEventInfo = {
          eventId: event.id, calendarId,
          calendarName: calendars.find(c => c.id === calendarId)?.summary ?? '',
          htmlLink: event.htmlLink, syncedAt: new Date().toISOString(),
        };
        saveSyncedEvent(syncKey, info);
        setSyncedEvents(prev => ({ ...prev, [syncKey]: info }));
      }
    } catch (err) {
      console.error('[App] auto-sync failed:', syncKey, err);
    }
  }, [gcalConnected, calendars, weekStart, syncedEvents]);

  const removeSyncedEvents = useCallback((keys: string[]) => {
    keys.forEach(key => {
      const info = syncedEvents[key];
      if (info) deleteCalendarEvent(info.calendarId, info.eventId).catch(() => {});
    });
    setSyncedEvents(prev => {
      const next = { ...prev };
      keys.forEach(k => delete next[k]);
      return next;
    });
  }, [syncedEvents]);

  // ── Task mutations ───────────────────────────────────────────────────────

  const addUnscheduledTask = useCallback(async (text: string) => {
    const translated = await translateText(text);
    setTasks(prev => [...prev, {
      id: genId(), content: translated,
      originalText: /[֐-׿]/.test(text) ? text : undefined,
      status: 'none', color: 'none', dayId: DAY_IDS[0], isDaily: false, sortOrder: prev.length,
    }]);
  }, [setTasks]);

  const deleteTask = useCallback((id: string) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (task?.startTime) {
      const keys = task.isDaily ? DAYS.map(d => `${realId}_${d.id}`) : [realId];
      removeSyncedEvents(keys);
    }
    setTasks(prev => prev.filter(t => t.id !== realId));
  }, [tasks, setTasks, removeSyncedEvents]);

  const cycleStatus = useCallback((id: string) => {
    const parts = id.split('_');
    if (parts.length > 1 && (DAY_IDS as string[]).includes(parts[parts.length - 1])) {
      const dayId = parts[parts.length - 1];
      const realId = parts.slice(0, -1).join('_');
      setTasks(prev => prev.map(t => {
        if (t.id !== realId || !t.isDaily) return t;
        const cur = t.dailyStatuses?.[dayId] ?? t.status;
        return { ...t, dailyStatuses: { ...t.dailyStatuses, [dayId]: nextStatus(cur) } };
      }));
      return;
    }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus(t.status) } : t));
  }, [setTasks]);

  const toggleDaily = useCallback((id: string) => {
    const realId = getRealId(id);
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, isDaily: !t.isDaily } : t));
  }, [setTasks]);

  const setTaskColor = useCallback((id: string, color: TaskColor) => {
    const realId = getRealId(id);
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, color } : t));
  }, [setTasks]);

  const splitTask = useCallback((id: string) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    const partsStr = prompt('How many parts to split into?', '3');
    if (!partsStr) return;
    const count = parseInt(partsStr);
    if (isNaN(count) || count < 2 || count > 10) return;
    if (task.startTime) {
      const keys = task.isDaily ? DAYS.map(d => `${realId}_${d.id}`) : [realId];
      removeSyncedEvents(keys);
    }
    const newTasks: Task[] = Array.from({ length: count }, (_, i) => ({
      id: genId(), content: `${task.content} (${i + 1}/${count})`,
      status: 'none' as const, color: task.color,
      dayId: DAY_IDS[0], isDaily: false, sortOrder: i,
    }));
    setTasks(prev => [...prev.filter(t => t.id !== realId), ...newTasks]);
  }, [tasks, setTasks, removeSyncedEvents]);

  const addLibraryTask = useCallback((t: LibraryTask) => setLibraryTasks(prev => [t, ...prev]), [setLibraryTasks]);
  const deleteLibraryTask = useCallback((id: string) => setLibraryTasks(prev => prev.filter(t => t.id !== id)), [setLibraryTasks]);
  const setLibraryTaskColor = useCallback((id: string, color: TaskColor) => setLibraryTasks(prev => prev.map(t => t.id === id ? { ...t, color } : t)), [setLibraryTasks]);

  const addGoal = useCallback((name: string, target: number) => {
    setGoals(prev => [...prev, { id: genId(), name, targetCount: target }]);
  }, [setGoals]);
  const deleteGoal = useCallback((id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, [setGoals]);

  const navigateWeek = (dir: number) => setWeekStart(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d;
  });

  // ── Drag & drop: bank ↔ time grid ────────────────────────────────────────

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const aid = active.id as string;
    const overId = over.id as string;

    // Library template dropped: create a new task, scheduled if dropped on a slot.
    const lib = libraryTasks.find(lt => lt.id === aid);
    if (lib) {
      const slot = parseSlotId(overId);
      const newId = genId();
      setTasks(prev => [...prev, {
        id: newId, content: lib.content, originalText: lib.originalText,
        status: 'none', color: lib.color ?? 'none',
        dayId: slot?.dayId ?? DAY_IDS[0], isDaily: false, sortOrder: 0,
        startTime: slot?.time,
        durationMinutes: lib.durationMinutes,
        calendarId: lib.calendarId,
      }]);
      if (slot) {
        const dayIndex = DAYS.findIndex(d => d.id === slot.dayId);
        syncTaskToCalendar(newId, lib.content, dayIndex, slot.time, lib.durationMinutes ?? 30, lib.calendarId);
      }
      return;
    }

    const realAid = getRealId(aid);
    const task = tasks.find(t => t.id === realAid);
    if (!task) return;
    const duration = task.durationMinutes ?? 30;

    // Dropped back onto the bank: unschedule.
    if (overId === BANK_ID) {
      if (!task.startTime) return;
      const keys = task.isDaily ? DAYS.map(d => `${realAid}_${d.id}`) : [realAid];
      removeSyncedEvents(keys);
      setTasks(prev => prev.map(t => t.id === realAid ? { ...t, startTime: undefined } : t));
      return;
    }

    // Dropped onto a time slot: schedule (or reschedule) + auto-sync.
    const slot = parseSlotId(overId);
    if (!slot) return;
    const { dayId, time } = slot;
    if (task.startTime === time && (task.isDaily || task.dayId === dayId)) return; // no-op

    setTasks(prev => prev.map(t => t.id === realAid ? { ...t, dayId: t.isDaily ? t.dayId : dayId, startTime: time } : t));

    if (task.isDaily) {
      DAYS.forEach((d, idx) => {
        syncTaskToCalendar(`${realAid}_${d.id}`, task.content, idx, time, duration, task.calendarId);
      });
    } else {
      const dayIndex = DAYS.findIndex(d => d.id === dayId);
      syncTaskToCalendar(realAid, task.content, dayIndex, time, duration, task.calendarId);
    }
  }, [libraryTasks, tasks, setTasks, removeSyncedEvents, syncTaskToCalendar]);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const dayTasks of Object.values(scheduledTasksByDay)) {
      const found = dayTasks.find(t => t.id === activeId);
      if (found) return found;
    }
    return tasks.find(t => t.id === activeId) ?? null;
  }, [activeId, scheduledTasksByDay, tasks]);

  const activeLib = activeId ? libraryTasks.find(lt => lt.id === activeId) : null;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <div className="h-1 w-full shrink-0" style={{ background: 'hsl(340 60% 80%)' }} />

      <header className="bg-card shadow-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-foreground tracking-tight shrink-0">
            Weekly Task Master
          </h1>
          <div className="flex items-center gap-2 mx-auto">
            <button onClick={() => navigateWeek(-1)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center min-w-[170px]">
              <p className="text-sm font-semibold text-foreground">{getMonthYear(weekStart)}</p>
              <p className="text-[11px] text-muted-foreground">{getWeekRange(weekStart)}</p>
            </div>
            <button onClick={() => navigateWeek(1)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
              <ChevronRight size={18} />
            </button>
            {!isCurrentWeek && (
              <button onClick={() => setWeekStart(currentWeekSunday)} className="ml-2 px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-xl transition-base hover:opacity-90">
                Today
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { if (confirm('Load all sample data? This will overwrite current data.')) forceSeedData(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
              title="Load Sample Data"
            >
              <DatabaseZap size={14} />
              <span>Load Sample Data</span>
            </button>
            {isConfigured() ? (
              gcalConnected ? (
                <button
                  onClick={handleDisconnectCalendar}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[hsl(var(--status-green))] bg-[hsl(var(--status-green-bg))] hover:bg-[hsl(var(--status-red-bg))] hover:text-destructive rounded-xl transition-base"
                  title="Disconnect Google Calendar"
                >
                  <Unlink size={14} />
                  <span>Calendar</span>
                </button>
              ) : (
                <button
                  onClick={handleConnectCalendar}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
                >
                  <CalendarDays size={14} />
                  <span>Connect Calendar</span>
                </button>
              )
            ) : null}
            <button
              onClick={onNavigateLists}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
            >
              <ListTodo size={14} />
              <span>רשימות</span>
            </button>
            <button
              onClick={onNavigateAcademic}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
            >
              <GraduationCap size={14} />
              <span>לוח אקדמי</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-4 flex gap-3 min-h-0 overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="w-[240px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-2">
            <TaskBankSidebar
              tasks={bankTasks}
              onAddTask={addUnscheduledTask}
              onDelete={deleteTask}
              onCycleStatus={cycleStatus}
              onToggleDaily={toggleDaily}
              onSetColor={setTaskColor}
              onSplitTask={splitTask}
            />
            <LibraryPanel libraryTasks={libraryTasks} onAddLibraryTask={addLibraryTask} onDeleteLibraryTask={deleteLibraryTask} onSetLibraryColor={setLibraryTaskColor} />
            <StatsCard tasks={tasks} progress={progress} />
            <WeeklyGoals goals={goals} tasks={tasks} onAddGoal={addGoal} onDeleteGoal={deleteGoal} />
          </div>

          <WeekCalendarGrid
            days={DAYS.map((d, i) => ({ id: d.id, label: d.label, date: formatDayDate(weekStart, i) }))}
            todayDayId={todayDayId}
            scheduledTasksByDay={scheduledTasksByDay}
            busyEventsByDay={busyEventsByDay}
            syncedTaskIds={syncedTaskIds}
            onDelete={deleteTask}
            onCycleStatus={cycleStatus}
            onSetColor={setTaskColor}
          />

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
            {activeTask ? (
              <CalendarTaskBlock
                task={activeTask} top={0} height={36} left="0" width="100%"
                onDelete={deleteTask} onCycleStatus={cycleStatus} onSetColor={setTaskColor}
                isOverlay
              />
            ) : null}
            {activeLib ? <div className="px-4 py-2.5 bg-card rounded-xl shadow-overlay border border-primary/20 text-[13px] font-medium text-foreground">{activeLib.content}</div> : null}
          </DragOverlay>
        </DndContext>
      </main>
    </div>
  );
}
