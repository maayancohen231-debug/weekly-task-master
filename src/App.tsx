import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext, pointerWithin, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, DragEndEvent, DragStartEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, GraduationCap, DatabaseZap, CalendarDays, Unlink, LayoutList, CalendarRange } from 'lucide-react';
import { AcademicBoard } from '@/components/AcademicBoard';
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
import { DailyGoalsBar } from '@/components/DailyGoalsBar';
import { DayListView } from '@/components/DayListView';
import { translateText } from '@/lib/translate';
import { parseSlotId, BANK_ID } from '@/lib/calendar-grid';
import {
  DAYS, DAY_INDEX_TO_ID, getWeekSunday, getWeekKey, formatDayDate, getMonthYear, getWeekRange, nextStatus,
  formatLocalDateTime,
} from '@/lib/task-types';
import type { Task, LibraryTask, TaskColor, DailyGoal } from '@/lib/task-types';

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

interface DailyGoalName {
  id: string;
  name: string;
}

interface StorageData {
  tasksByWeek: Record<string, Task[]>;
  goalsByWeek: Record<string, WeeklyGoal[]>;
  /** The daily-goal checklist itself — shared across every week, not per-week. */
  dailyGoalNames: DailyGoalName[];
  /** Per-week completion state: weekKey -> goalId -> dayId -> done. */
  dailyGoalDoneByWeek: Record<string, Record<string, Record<string, boolean>>>;
  libraryTasks: LibraryTask[];
}

/**
 * Daily goals used to be stored per-week (dailyGoalsByWeek: DailyGoal[] with
 * embedded doneByDay), which meant the checklist itself reset every week.
 * Migrate old data into a shared goal-name list plus per-week done state,
 * de-duplicating goals across weeks by name.
 */
function migrateDailyGoals(parsed: Partial<StorageData> & { dailyGoalsByWeek?: Record<string, DailyGoal[]> }): {
  dailyGoalNames: DailyGoalName[];
  dailyGoalDoneByWeek: Record<string, Record<string, Record<string, boolean>>>;
} {
  if (!parsed.dailyGoalsByWeek) {
    return { dailyGoalNames: parsed.dailyGoalNames ?? [], dailyGoalDoneByWeek: parsed.dailyGoalDoneByWeek ?? {} };
  }
  const nameToId = new Map<string, string>();
  const dailyGoalNames: DailyGoalName[] = [];
  const dailyGoalDoneByWeek: Record<string, Record<string, Record<string, boolean>>> = {};

  for (const [weekKey, weekGoals] of Object.entries(parsed.dailyGoalsByWeek)) {
    for (const g of weekGoals) {
      let id = nameToId.get(g.name);
      if (!id) {
        id = g.id;
        nameToId.set(g.name, id);
        dailyGoalNames.push({ id, name: g.name });
      }
      dailyGoalDoneByWeek[weekKey] ??= {};
      dailyGoalDoneByWeek[weekKey][id] = { ...dailyGoalDoneByWeek[weekKey][id], ...g.doneByDay };
    }
  }
  return { dailyGoalNames, dailyGoalDoneByWeek };
}

function loadStorage(): StorageData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<StorageData> & { dailyGoalsByWeek?: Record<string, DailyGoal[]> };
      return {
        tasksByWeek: parsed.tasksByWeek ?? {},
        goalsByWeek: parsed.goalsByWeek ?? {},
        ...migrateDailyGoals(parsed),
        libraryTasks: parsed.libraryTasks ?? [],
      };
    }
  } catch { /* ignore */ }
  return { tasksByWeek: {}, goalsByWeek: {}, dailyGoalNames: [], dailyGoalDoneByWeek: {}, libraryTasks: [] };
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
  const [page, setPage] = useState<'planner' | 'academic'>('planner');

  if (page === 'academic') {
    return (
      <ErrorBoundary>
        <AcademicBoard onBack={() => setPage('planner')} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Planner onNavigateAcademic={() => setPage('academic')} />
    </ErrorBoundary>
  );
}

// ── Planner — all hooks live here ────────────────────────────────────────────

function Planner({ onNavigateAcademic }: { onNavigateAcademic: () => void }) {
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
  const [plannerView, setPlannerView] = useState<'calendar' | 'list'>('calendar');

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
        rangeEnd.setDate(rangeEnd.getDate() + 7); // covers sun..sat
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

  // Busy events that are themselves the Google Calendar side of a task we already
  // render as a CalendarTaskBlock — drop them so the same event never shows twice.
  // Only trust syncedEvents entries that still map to a real, currently-scheduled
  // task: e.g. "Load Sample Data" replaces the task list without touching the
  // separate synced-events store, and a leftover stale mapping must never hide a
  // real, unrelated Google Calendar event.
  const activeSyncedGcalEventIds = useMemo(() => {
    const activeSyncKeys = new Set<string>();
    tasks.forEach(t => {
      if (!t.startTime) return;
      if (t.isDaily) DAYS.forEach(d => activeSyncKeys.add(`${t.id}_${d.id}`));
      else activeSyncKeys.add(t.id);
    });
    const ids = new Set<string>();
    for (const [key, info] of Object.entries(syncedEvents)) {
      if (activeSyncKeys.has(key)) ids.add(info.eventId);
    }
    return ids;
  }, [tasks, syncedEvents]);

  const visibleBusyEventsByDay = useMemo(() => {
    const out: Record<string, GCalBusyEvent[]> = {};
    for (const [dayId, events] of Object.entries(busyEventsByDay)) {
      out[dayId] = events.filter(ev => !activeSyncedGcalEventIds.has(ev.id));
    }
    return out;
  }, [busyEventsByDay, activeSyncedGcalEventIds]);
  const goals = useMemo(() => storageData.goalsByWeek[weekKey] ?? [], [storageData, weekKey]);
  const dailyGoals = useMemo(() => {
    const doneForWeek = storageData.dailyGoalDoneByWeek[weekKey] ?? {};
    return storageData.dailyGoalNames.map(g => ({ id: g.id, name: g.name, doneByDay: doneForWeek[g.id] ?? {} }));
  }, [storageData, weekKey]);
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

  const setDailyGoalNames = useCallback((updater: (prev: DailyGoalName[]) => DailyGoalName[]) => {
    setStorageData(prev => ({ ...prev, dailyGoalNames: updater(prev.dailyGoalNames) }));
  }, []);
  const setDailyGoalDoneForWeek = useCallback((updater: (prev: Record<string, Record<string, boolean>>) => Record<string, Record<string, boolean>>) => {
    setStorageData(prev => ({
      ...prev,
      dailyGoalDoneByWeek: { ...prev.dailyGoalDoneByWeek, [weekKey]: updater(prev.dailyGoalDoneByWeek[weekKey] ?? {}) },
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

  // Unscheduled, not-yet-done tasks (no startTime) — the task bank.
  const bankTasks = useMemo(() => tasks.filter(t => !t.startTime && t.status !== 'green'), [tasks]);

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

  // Keys currently being created/updated — lets the backfill reconciler below
  // tell "not synced yet" apart from "sync already in flight", so it never
  // fires a second, duplicate create for the same task while the first request
  // is still pending.
  const pendingSyncRef = useRef<Set<string>>(new Set());

  const syncTaskToCalendar = useCallback(async (
    syncKey: string, content: string, dayIndex: number, time: string, duration: number, existingCalendarId?: string,
  ) => {
    if (!gcalConnected || calendars.length === 0) return;
    const calendarId = existingCalendarId ?? matchCalendarName(content, calendars)?.id;
    if (!calendarId) return;
    pendingSyncRef.current.add(syncKey);
    try {
      const startDateTime = formatLocalDateTime(weekStart, dayIndex, time);
      const existing = syncedEvents[syncKey];
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
    } finally {
      pendingSyncRef.current.delete(syncKey);
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

  // Backfill sync for scheduled tasks that don't have a Google Calendar event
  // yet — covers two real gaps: (1) recurring daily tasks that got auto-copied
  // into a newly-visited week (the auto-populate effect above only touches
  // local state, it never calls syncTaskToCalendar), and (2) tasks that were
  // scheduled while Calendar wasn't connected and never got a retroactive sync
  // once the user connected. Purely additive — it only ever creates missing
  // events, never deletes, so a transient computation glitch here can't wipe
  // a real synced event (deletion stays explicit: deleteTask / toggleDaily /
  // drag-to-bank).
  useEffect(() => {
    if (!gcalConnected || calendars.length === 0) return;
    tasks.forEach(t => {
      if (!t.startTime) return;
      const duration = t.durationMinutes ?? 30;
      if (t.isDaily) {
        DAYS.forEach((d, idx) => {
          const key = `${t.id}_${d.id}`;
          if (!syncedEvents[key] && !pendingSyncRef.current.has(key)) {
            syncTaskToCalendar(key, t.content, idx, t.startTime!, duration, t.calendarId);
          }
        });
      } else {
        const key = t.id;
        if (!syncedEvents[key] && !pendingSyncRef.current.has(key)) {
          const dayIndex = DAYS.findIndex(d => d.id === t.dayId);
          syncTaskToCalendar(key, t.content, dayIndex, t.startTime!, duration, t.calendarId);
        }
      }
    });
  }, [tasks, gcalConnected, calendars, syncedEvents, syncTaskToCalendar]);

  // ── Task mutations ───────────────────────────────────────────────────────

  const addUnscheduledTask = useCallback(async (text: string) => {
    const translated = await translateText(text);
    setTasks(prev => [...prev, {
      id: genId(), content: translated,
      originalText: /[֐-׿]/.test(text) ? text : undefined,
      status: 'none', color: 'none', dayId: DAY_IDS[0], isDaily: false, sortOrder: prev.length,
    }]);
  }, [setTasks]);

  // Creates a task directly scheduled on the calendar grid — clicking an
  // empty slot, rather than only being able to add via the Task Bank and
  // then drag it onto a time.
  const addScheduledTask = useCallback(async (dayId: string, time: string, text: string) => {
    if (!text.trim()) return;
    const translated = await translateText(text);
    const newId = genId();
    setTasks(prev => [...prev, {
      id: newId, content: translated,
      originalText: /[֐-׿]/.test(text) ? text : undefined,
      status: 'none', color: 'none', dayId, isDaily: false, sortOrder: prev.length,
      startTime: time, durationMinutes: 30,
    }]);
    const dayIndex = DAYS.findIndex(d => d.id === dayId);
    syncTaskToCalendar(newId, translated, dayIndex, time, 30);
  }, [setTasks, syncTaskToCalendar]);

  // Deletes the real Google Calendar event behind a read-only "busy" block
  // (an event pulled straight from Google Calendar, not created by this app —
  // these previously had no delete affordance at all).
  const deleteBusyEvent = useCallback((ev: GCalBusyEvent) => {
    if (!confirm(`Delete "${ev.title}" from Google Calendar? This can't be undone.`)) return;
    deleteCalendarEvent(ev.calendarId, ev.id).catch(() => {});
    setBusyEventsByDay(prev => {
      const next: Record<string, GCalBusyEvent[]> = {};
      for (const [dayId, events] of Object.entries(prev)) next[dayId] = events.filter(e => e.id !== ev.id);
      return next;
    });
  }, []);

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

  // Toggling isDaily changes which sync-key scheme the task's calendar events
  // live under (single `realId` key for a one-off task vs. one `realId_dayId`
  // key per day for a daily task) — flip the flag and migrate the synced
  // events to match, otherwise the old key's event is orphaned (and reappears
  // as a duplicate "busy" block) while the new keys never get created.
  const toggleDaily = useCallback((id: string) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    const turningOn = !task.isDaily;
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, isDaily: turningOn } : t));
    if (!task.startTime) return;

    const duration = task.durationMinutes ?? 30;
    if (turningOn) {
      removeSyncedEvents([realId]);
      DAYS.forEach((d, idx) => {
        syncTaskToCalendar(`${realId}_${d.id}`, task.content, idx, task.startTime!, duration, task.calendarId);
      });
    } else {
      removeSyncedEvents(DAYS.map(d => `${realId}_${d.id}`));
      const dayIndex = DAYS.findIndex(d => d.id === task.dayId);
      syncTaskToCalendar(realId, task.content, dayIndex, task.startTime!, duration, task.calendarId);
    }
  }, [tasks, setTasks, removeSyncedEvents, syncTaskToCalendar]);

  const setTaskColor = useCallback((id: string, color: TaskColor) => {
    const realId = getRealId(id);
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, color } : t));
  }, [setTasks]);

  const resizeTask = useCallback((id: string, durationMinutes: number) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, durationMinutes } : t));
    if (!task.startTime) return;
    if (task.isDaily) {
      DAYS.forEach((d, idx) => {
        syncTaskToCalendar(`${realId}_${d.id}`, task.content, idx, task.startTime!, durationMinutes, task.calendarId);
      });
    } else {
      const dayIndex = DAYS.findIndex(d => d.id === task.dayId);
      syncTaskToCalendar(realId, task.content, dayIndex, task.startTime!, durationMinutes, task.calendarId);
    }
  }, [tasks, setTasks, syncTaskToCalendar]);

  // Move a scheduled task to a different Google Calendar — deletes the old event
  // (if any) and recreates it on the newly chosen calendar, since Calendar's API
  // has no simple "reassign calendar" call for an existing event.
  const setTaskCalendar = useCallback(async (id: string, calendarId: string) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, calendarId } : t));
    if (!task.startTime || !gcalConnected) return;

    const duration = task.durationMinutes ?? 30;
    const calendarName = calendars.find(c => c.id === calendarId)?.summary ?? '';
    const keys = task.isDaily ? DAYS.map(d => `${realId}_${d.id}`) : [realId];

    for (const key of keys) {
      const dayId = task.isDaily ? key.slice(realId.length + 1) : task.dayId;
      const dayIndex = DAYS.findIndex(d => d.id === dayId);
      const startDateTime = formatLocalDateTime(weekStart, dayIndex, task.startTime);
      const existing = syncedEvents[key];
      try {
        if (existing) await deleteCalendarEvent(existing.calendarId, existing.eventId);
        const event = await createCalendarEvent(calendarId, task.content, startDateTime, '', duration);
        const info: SyncedEventInfo = {
          eventId: event.id, calendarId, calendarName,
          htmlLink: event.htmlLink, syncedAt: new Date().toISOString(),
        };
        saveSyncedEvent(key, info);
        setSyncedEvents(prev => ({ ...prev, [key]: info }));
      } catch (err) {
        console.error('[App] failed to move task to new calendar:', key, err);
      }
    }
  }, [tasks, setTasks, syncedEvents, calendars, gcalConnected, weekStart]);

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
      dayId: DAYS[i % DAYS.length]?.id ?? task.dayId, isDaily: false, sortOrder: i,
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

  const addDailyGoal = useCallback((name: string) => {
    setDailyGoalNames(prev => [...prev, { id: genId(), name }]);
  }, [setDailyGoalNames]);
  const deleteDailyGoal = useCallback((id: string) => {
    setDailyGoalNames(prev => prev.filter(g => g.id !== id));
  }, [setDailyGoalNames]);
  const toggleDailyGoalDay = useCallback((goalId: string, dayId: string) => {
    setDailyGoalDoneForWeek(prev => ({
      ...prev,
      [goalId]: { ...prev[goalId], [dayId]: !prev[goalId]?.[dayId] },
    }));
  }, [setDailyGoalDoneForWeek]);

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
    <div className="h-screen bg-background text-foreground font-sans flex flex-col overflow-hidden">
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
              onClick={() => setPlannerView(v => v === 'calendar' ? 'list' : 'calendar')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
            >
              {plannerView === 'calendar' ? <LayoutList size={14} /> : <CalendarRange size={14} />}
              <span>{plannerView === 'calendar' ? 'List View' : 'Calendar View'}</span>
            </button>
            <button
              onClick={onNavigateAcademic}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
            >
              <GraduationCap size={14} />
              <span>Academic Board</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pt-4 pb-4 flex gap-3 min-h-0 overflow-hidden">
        {plannerView === 'calendar' ? (
          <DndContext sensors={sensors} collisionDetection={pointerWithin}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="w-[240px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-2 scroll-thin">
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

            <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">
              <DailyGoalsBar
                days={DAYS.map((d, i) => ({ id: d.id, label: d.label, date: formatDayDate(weekStart, i) }))}
                goals={dailyGoals}
                onAddGoal={addDailyGoal}
                onToggleGoalDay={toggleDailyGoalDay}
                onDeleteGoal={deleteDailyGoal}
              />
              <WeekCalendarGrid
                days={DAYS.map((d, i) => ({ id: d.id, label: d.label, date: formatDayDate(weekStart, i) }))}
                todayDayId={todayDayId}
                scheduledTasksByDay={scheduledTasksByDay}
                busyEventsByDay={visibleBusyEventsByDay}
                syncedTaskIds={syncedTaskIds}
                onDelete={deleteTask}
                onCycleStatus={cycleStatus}
                onSetColor={setTaskColor}
                onResize={resizeTask}
                calendars={calendars}
                onSetCalendar={setTaskCalendar}
                onDeleteBusyEvent={deleteBusyEvent}
                onQuickAdd={addScheduledTask}
              />
            </div>

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
        ) : (
          <>
            <div className="w-[240px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-2 scroll-thin">
              <LibraryPanel libraryTasks={libraryTasks} onAddLibraryTask={addLibraryTask} onDeleteLibraryTask={deleteLibraryTask} onSetLibraryColor={setLibraryTaskColor} />
              <StatsCard tasks={tasks} progress={progress} />
              <WeeklyGoals goals={goals} tasks={tasks} onAddGoal={addGoal} onDeleteGoal={deleteGoal} />
            </div>
            <DayListView
              tasks={tasks}
              weekStart={weekStart}
              todayDayId={todayDayId}
              setTasks={setTasks}
              onDelete={deleteTask}
              onCycleStatus={cycleStatus}
              onToggleDaily={toggleDaily}
              onSetColor={setTaskColor}
              onSplitTask={splitTask}
            />
          </>
        )}
      </main>
    </div>
  );
}
