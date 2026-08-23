import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext, pointerWithin, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, DragEndEvent, DragStartEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, GraduationCap, DatabaseZap, CalendarDays, Unlink, LayoutList, CalendarRange, Calendar, AlertTriangle, X } from 'lucide-react';
import { AcademicBoard } from '@/components/AcademicBoard';
import { forceSeedData } from '@/lib/seed';
import {
  isConfigured, isTokenValid, requestToken,
  refreshAccessToken, getStoredRefreshToken, clearAllTokens,
  loadSyncedEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent,
  saveSyncedEvent, fetchWeekEvents, fetchCalendars, matchCalendarName, resolveLearnedOrRuleMatch,
  type SyncedEventInfo, type GCalBusyEvent, type GCalCalendar,
} from '@/services/googleCalendar';
import { WeekCalendarGrid } from '@/components/WeekCalendarGrid';
import { TaskSidebarPanel } from '@/components/TaskSidebarPanel';
import { QuickAddPanel, type QuickAddResult } from '@/components/QuickAddPanel';
import { CalendarTaskBlock } from '@/components/CalendarTaskBlock';
import { GCalBusyBlock } from '@/components/GCalBusyBlock';
import { StatsCard } from '@/components/StatsCard';
import { WeeklyGoals, type WeeklyGoal } from '@/components/WeeklyGoals';
import { DailyGoalsBar } from '@/components/DailyGoalsBar';
import { DayListView } from '@/components/DayListView';
import { translateText } from '@/lib/translate';
import { parseQuickEventText } from '@/lib/parseQuickEvent';
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
  /** Keyword -> Google Calendar id, learned from the user's manual calendar
   * picks so future tasks with a similar keyword auto-resolve without asking. */
  learnedCalendarKeywords: Record<string, string>;
  /** `${content}|${dayId}` keys for recurring tasks the user explicitly
   * deleted — the auto-populate effect below must never recreate one of
   * these from a leftover copy it missed, so deletion is permanent until
   * the user recurring-toggles a matching task back on. */
  deletedRecurringKeys: string[];
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
        learnedCalendarKeywords: parsed.learnedCalendarKeywords ?? {},
        deletedRecurringKeys: parsed.deletedRecurringKeys ?? [],
      };
    }
  } catch { /* ignore */ }
  return { tasksByWeek: {}, goalsByWeek: {}, dailyGoalNames: [], dailyGoalDoneByWeek: {}, libraryTasks: [], learnedCalendarKeywords: {}, deletedRecurringKeys: [] };
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

  // "Today" was previously frozen at mount (useMemo with no real time
  // dependency), so a tab left open across midnight kept highlighting
  // yesterday until a manual refresh. Ticking every minute lets it
  // self-correct instead.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentWeekSunday = useMemo(() => getWeekSunday(now), [now]);
  const isCurrentWeek = weekStart.getTime() === currentWeekSunday.getTime();

  const todayDayId = useMemo(() => {
    if (!isCurrentWeek) return null;
    return DAY_INDEX_TO_ID[now.getDay()] ?? null;
  }, [isCurrentWeek, now]);

  const [storageData, setStorageData] = useState<StorageData>(loadStorage);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [plannerView, setPlannerView] = useState<'calendar' | 'day' | 'list'>('calendar');
  const [selectedDayId, setSelectedDayId] = useState(() => todayDayId ?? DAY_IDS[0]);
  const selectedDayIndex = (DAY_IDS as string[]).indexOf(selectedDayId);

  const navigateDay = (dir: number) => {
    const newIdx = selectedDayIndex + dir;
    if (newIdx < 0) {
      navigateWeek(-1);
      setSelectedDayId(DAY_IDS[DAY_IDS.length - 1]);
    } else if (newIdx >= DAY_IDS.length) {
      navigateWeek(1);
      setSelectedDayId(DAY_IDS[0]);
    } else {
      setSelectedDayId(DAY_IDS[newIdx]);
    }
  };
  const goToToday = () => {
    setWeekStart(currentWeekSunday);
    setSelectedDayId(DAY_INDEX_TO_ID[new Date().getDay()] ?? DAY_IDS[0]);
  };

  // selectedDayId only otherwise changes via the Day view's own </>
  // navigation, so without this, switching into Day view from Week/List
  // always showed whatever day was left selected from last time (or the day
  // the app happened to mount on) instead of something contextually current.
  const switchToDayView = () => {
    setSelectedDayId(todayDayId ?? DAY_IDS[0]);
    setPlannerView('day');
  };

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(() => isTokenValid());
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [syncedEvents, setSyncedEvents] = useState<Record<string, SyncedEventInfo>>(() => loadSyncedEvents());
  const syncedTaskIds = useMemo(() => new Set(Object.keys(syncedEvents)), [syncedEvents]);
  const [busyEventsByDay, setBusyEventsByDay] = useState<Record<string, GCalBusyEvent[]>>({});
  // Surfaces the actual fetch failure in the UI — sync failures were
  // previously only ever logged to the console, which is unreachable on a
  // phone, making them impossible to diagnose without a laptop in hand.
  const [gcalSyncError, setGcalSyncError] = useState<string | null>(null);

  // Silent token refresh. Prefers the persistent refresh-token flow (a plain
  // server call, no popup, no third-party-cookie dependency) over the old
  // GIS silent-reissue trick, which routinely fails on mobile browsers that
  // block the third-party iframe it relies on — that's what forced reconnects
  // every session before.
  useEffect(() => {
    if (!isConfigured()) return;
    const tryRefresh = async () => {
      if (isTokenValid()) { setGcalConnected(true); return; }
      if (getStoredRefreshToken()) {
        try {
          await refreshAccessToken();
          setGcalConnected(true);
        } catch {
          setGcalConnected(false); // refresh token is dead — needs a real reconnect
        }
        return;
      }
      const hasStoredToken = !!localStorage.getItem('gcal_token');
      if (!hasStoredToken) return;
      try {
        await requestToken(''); // legacy silent reissue, for a session that hasn't upgraded yet
        setGcalConnected(true);
      } catch {
        // Silent refresh failed — keep current state, don't force disconnect
      }
    };
    tryRefresh();
    const id = setInterval(tryRefresh, 45 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Calling requestToken() directly — not connectPersistent() — is
  // deliberate: the persistent code-flow (needed for "stay connected
  // forever") depends on a server piece that isn't set up yet, and every
  // attempt at gracefully layering it on top of Connect Calendar has made
  // the button less reliable, not more. This is exactly the plain flow that
  // was already working earlier. Once GOOGLE_CLIENT_SECRET is actually set
  // and verified, this can switch back to connectPersistent().
  const handleConnectCalendar = async () => {
    try {
      await requestToken('consent');
      setGcalConnected(true);
      setGcalSyncError(null);
    } catch (err: any) {
      console.error('Google Calendar connect failed:', err);
      setGcalSyncError(`Couldn't connect to Google Calendar: ${err?.message ?? err}`);
    }
  };

  const handleDisconnectCalendar = () => {
    setGcalSyncError(null);
    clearAllTokens();
    setGcalConnected(false);
  };

  // A Google Calendar API call can fail mid-session (token expired, or
  // revoked server-side) well after the connect flow itself reported
  // success — gcalFetch() already clears the dead token when that happens,
  // but nothing previously told the UI, so "Connected" stayed lit while
  // every sync silently did nothing. Try one silent recovery (refresh token
  // if we have one, else the legacy silent reissue) before conceding the
  // connection is actually dead and flipping the badge back to disconnected.
  const recoverGcalConnection = useCallback(async (): Promise<boolean> => {
    if (isTokenValid()) return true;
    try {
      if (getStoredRefreshToken()) {
        await refreshAccessToken();
      } else {
        await Promise.race([
          requestToken(''),
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
        ]);
      }
      return true;
    } catch {
      setGcalConnected(false);
      return false;
    }
  }, []);

  // Cache the user's calendar list once connected, so tasks can be
  // auto-matched to a calendar without prompting.
  useEffect(() => {
    if (!gcalConnected) { setCalendars([]); return; }
    fetchCalendars().then(list => { setCalendars(list); setGcalSyncError(null); }).catch(async (err) => {
      if (await recoverGcalConnection()) {
        fetchCalendars().then(list => { setCalendars(list); setGcalSyncError(null); }).catch((err2) => {
          setCalendars([]);
          setGcalSyncError(`Couldn't load your calendars: ${err2?.message ?? err2}`);
        });
      } else {
        setCalendars([]);
        setGcalSyncError(`Couldn't load your calendars: ${err?.message ?? err}`);
      }
    });
  }, [gcalConnected, recoverGcalConnection]);

  // Pull existing Google Calendar events for the visible week, bucketed by day.
  const busyFetchRef = useRef(0);
  useEffect(() => {
    if (!gcalConnected) { setBusyEventsByDay({}); return; }
    const requestId = ++busyFetchRef.current;

    const bucketByDay = (events: GCalBusyEvent[]): Record<string, GCalBusyEvent[]> => {
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
      return byDay;
    };

    const load = async () => {
      const rangeStart = new Date(weekStart);
      const rangeEnd = new Date(weekStart);
      rangeEnd.setDate(rangeEnd.getDate() + 7); // covers sun..sat
      try {
        const events = await fetchWeekEvents(rangeStart.toISOString(), rangeEnd.toISOString());
        if (busyFetchRef.current !== requestId) return; // stale response, a newer week was requested
        setBusyEventsByDay(bucketByDay(events));
        setGcalSyncError(null);
      } catch (err) {
        if (busyFetchRef.current !== requestId) return;
        console.warn('[App] failed to fetch busy events, attempting recovery:', err);
        if (await recoverGcalConnection()) {
          try {
            const events = await fetchWeekEvents(rangeStart.toISOString(), rangeEnd.toISOString());
            if (busyFetchRef.current !== requestId) return;
            setBusyEventsByDay(bucketByDay(events));
            setGcalSyncError(null);
            return;
          } catch (err2: any) {
            console.warn('[App] busy events retry after recovery also failed:', err2);
            if (busyFetchRef.current !== requestId) return;
            setBusyEventsByDay({});
            setGcalSyncError(`Couldn't load calendar events: ${err2?.message ?? err2}`);
            return;
          }
        }
        if (busyFetchRef.current !== requestId) return;
        setBusyEventsByDay({});
        setGcalSyncError(`Couldn't load calendar events: ${(err as any)?.message ?? err}`);
      }
    };
    load();
  }, [weekKey, gcalConnected, recoverGcalConnection]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Ground-truth numbers for the status line — turns "sync succeeded but
  // came back empty" (a real, silent failure mode) into something visible
  // instead of indistinguishable from "sync never ran."
  const busyEventCount = useMemo(() => Object.values(busyEventsByDay).flat().length, [busyEventsByDay]);
  const goals = useMemo(() => storageData.goalsByWeek[weekKey] ?? [], [storageData, weekKey]);
  const dailyGoals = useMemo(() => {
    const doneForWeek = storageData.dailyGoalDoneByWeek[weekKey] ?? {};
    return storageData.dailyGoalNames.map(g => ({ id: g.id, name: g.name, doneByDay: doneForWeek[g.id] ?? {} }));
  }, [storageData, weekKey]);
  const libraryTasks = storageData.libraryTasks;
  const learnedCalendarKeywords = storageData.learnedCalendarKeywords;

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

  // Remembers a keyword -> calendar pick so matchCalendarOrLearned resolves
  // the same way next time without asking again.
  const learnCalendarKeyword = useCallback((keyword: string, calendarId: string) => {
    setStorageData(prev => ({
      ...prev,
      learnedCalendarKeywords: { ...prev.learnedCalendarKeywords, [keyword.toLowerCase()]: calendarId },
    }));
  }, []);

  // Auto-populate current week with any recurring (isDaily) tasks from other weeks
  useEffect(() => {
    setStorageData(prev => {
      const weekTasks = prev.tasksByWeek[weekKey] ?? [];

      const allDailyTasks = Object.values(prev.tasksByWeek).flat().filter(t => t.isDaily);
      if (allDailyTasks.length === 0) return prev;

      const deletedKeys = new Set(prev.deletedRecurringKeys ?? []);
      const seen = new Set<string>();
      const templates: Task[] = [];
      for (const t of allDailyTasks) {
        const key = `${t.content}|${t.dayId}`;
        if (deletedKeys.has(key)) continue;
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

  const currentWeekKey = useMemo(() => getWeekKey(currentWeekSunday), [currentWeekSunday]);

  // Roll unfinished tasks from past weeks into the real current week, so an
  // undone task doesn't just silently vanish once its week is over. Keyed on
  // currentWeekKey (the real-world week), not weekKey (whatever week is
  // being browsed) — so looking at an old week to review it doesn't itself
  // trigger a move. Recurring (isDaily) tasks are left alone; they already
  // have their own copy-forward effect above and moving them here too would
  // just fight with it.
  useEffect(() => {
    setStorageData(prev => {
      const pastWeekKeys = Object.keys(prev.tasksByWeek).filter(wk => wk < currentWeekKey);
      const trimmed: Record<string, Task[]> = {};
      const rolled: Task[] = [];
      for (const wk of pastWeekKeys) {
        const wkTasks = prev.tasksByWeek[wk] ?? [];
        const staying = wkTasks.filter(t => t.isDaily || t.status === 'green');
        const moving = wkTasks.filter(t => !t.isDaily && t.status !== 'green');
        if (moving.length > 0) {
          trimmed[wk] = staying;
          rolled.push(...moving);
        }
      }
      if (rolled.length === 0) return prev;

      const currentWeekTasks = prev.tasksByWeek[currentWeekKey] ?? [];
      // A task with a startTime was calendar-scheduled for a specific slot
      // that week — carrying that exact time into the new week made it look
      // like a recurring calendar event nailed to the same hour every week,
      // which is exactly what piled up and made the grid unreadable. Rolling
      // forward should mean "don't lose this to-do," not "re-book the same
      // time slot" — so it lands back in the bank (no startTime) instead,
      // ready to be rescheduled deliberately if it's still relevant.
      const unscheduled = rolled.map((t, i) => ({
        ...t,
        startTime: undefined,
        sortOrder: currentWeekTasks.length + i,
      }));

      return {
        ...prev,
        tasksByWeek: {
          ...prev.tasksByWeek,
          ...trimmed,
          [currentWeekKey]: [...currentWeekTasks, ...unscheduled],
        },
      };
    });
  }, [currentWeekKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Tasks created via the Bank/Library — excludes plain calendar events quick-added
  // by clicking directly on the grid, which aren't tracked as to-dos.
  const trackedTasks = useMemo(() => tasks.filter(t => !t.isCalendarOnly), [tasks]);

  const progress = useMemo(() => {
    let total = 0, done = 0;
    trackedTasks.forEach(t => {
      if (t.isDaily) {
        DAYS.forEach(d => { total++; if ((t.dailyStatuses?.[d.id] ?? t.status) === 'green') done++; });
      } else {
        total++;
        if (t.status === 'green') done++;
      }
    });
    return total === 0 ? 0 : Math.round((done / total) * 100);
  }, [trackedTasks]);

  // Unscheduled, not-yet-done tasks (no startTime) — the task bank.
  const bankTasks = useMemo(() => tasks.filter(t => !t.startTime && t.status !== 'green'), [tasks]);

  // In Day view the sidebar bank narrows to just the focused day's backlog —
  // showing the full week's bank while looking at one day was more noise than help.
  const bankTasksForPanel = useMemo(
    () => plannerView === 'day' ? bankTasks.filter(t => t.dayId === selectedDayId) : bankTasks,
    [bankTasks, plannerView, selectedDayId],
  );

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

  // When a task's calendar can't be confidently resolved (no learned pick, no
  // matching keyword rule) and there's a real choice to make, sync pauses and
  // this holds what's needed to resume once the user picks — see the "which
  // calendar" banner below and resolvePendingCalendarAsk.
  const [pendingCalendarAsk, setPendingCalendarAsk] = useState<
    { syncKey: string; content: string; dayIndex: number; time: string; duration: number } | null
  >(null);

  const syncTaskToCalendar = useCallback(async (
    syncKey: string, content: string, dayIndex: number, time: string, duration: number, existingCalendarId?: string,
  ) => {
    if (!gcalConnected || calendars.length === 0) return;
    let calendarId = existingCalendarId;
    if (!calendarId) {
      const confident = resolveLearnedOrRuleMatch(content, calendars, learnedCalendarKeywords);
      if (confident) {
        calendarId = confident.id;
      } else if (calendars.length > 1) {
        setPendingCalendarAsk({ syncKey, content, dayIndex, time, duration });
        return;
      } else {
        calendarId = matchCalendarName(content, calendars, learnedCalendarKeywords).id;
      }
    }
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
  }, [gcalConnected, calendars, weekStart, syncedEvents, learnedCalendarKeywords]);

  // The user picked a calendar for an ambiguous task from the "which calendar"
  // banner — remember it (so similar content auto-resolves next time), pin it
  // on the task itself (so future resyncs of this exact task skip the ask too),
  // then resume the sync that was paused waiting for this answer.
  const resolvePendingCalendarAsk = useCallback((calendarId: string) => {
    if (!pendingCalendarAsk) return;
    const { syncKey, content, dayIndex, time, duration } = pendingCalendarAsk;
    learnCalendarKeyword(content, calendarId);
    const realId = getRealId(syncKey);
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, calendarId } : t));
    setPendingCalendarAsk(null);
    syncTaskToCalendar(syncKey, content, dayIndex, time, duration, calendarId);
  }, [pendingCalendarAsk, learnCalendarKeyword, setTasks, syncTaskToCalendar]);

  // Skip without picking — syncs to the default calendar this once but
  // doesn't learn anything, so she's asked again next time.
  const skipPendingCalendarAsk = useCallback(() => {
    if (!pendingCalendarAsk) return;
    const { syncKey, content, dayIndex, time, duration } = pendingCalendarAsk;
    const fallbackId = matchCalendarName(content, calendars, learnedCalendarKeywords).id;
    setPendingCalendarAsk(null);
    syncTaskToCalendar(syncKey, content, dayIndex, time, duration, fallbackId);
  }, [pendingCalendarAsk, calendars, learnedCalendarKeywords, syncTaskToCalendar]);

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
    // In Day view the bank is filtered to the focused day (see bankTasksForPanel) —
    // default new tasks to that day so they don't immediately vanish from the list.
    const dayId = plannerView === 'day' ? selectedDayId : DAY_IDS[0];
    setTasks(prev => [...prev, {
      id: genId(), content: translated,
      originalText: /[֐-׿]/.test(text) ? text : undefined,
      status: 'none', color: 'none', dayId, isDaily: false, sortOrder: prev.length,
    }]);
  }, [setTasks, plannerView, selectedDayId]);

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
      startTime: time, durationMinutes: 30, isCalendarOnly: true,
    }]);
    const dayIndex = DAYS.findIndex(d => d.id === dayId);
    syncTaskToCalendar(newId, translated, dayIndex, time, 30);
  }, [setTasks, syncTaskToCalendar]);

  // Freeform "quick add" from the sidebar chat box — parses a note like
  // "11.8" / "13:30" / "ראיון לאליס קוד" into a date+time+title via Claude.
  // A date inside the currently displayed week gets the full task-tracked
  // path (same as addScheduledTask, so it shows on the grid immediately and
  // gets the "which calendar?" ask if ambiguous). A date in a different week
  // goes straight to Google Calendar instead — the visible week never jumps
  // out from under the user for a background capture action.
  const quickAddFromChat = useCallback(async (text: string): Promise<QuickAddResult> => {
    const { date, time, title } = await parseQuickEventText(text);
    if (!date) throw new Error("Couldn't find a date in that — try including one, e.g. 11.8.");
    if (!time) throw new Error("Couldn't find a time in that — include one, e.g. 13:30.");
    if (!gcalConnected || calendars.length === 0) throw new Error('Connect Google Calendar first.');

    const parsedDate = new Date(`${date}T00:00:00`);
    const targetWeekStart = getWeekSunday(parsedDate);

    if (getWeekKey(targetWeekStart) === weekKey) {
      const dayId = DAY_INDEX_TO_ID[parsedDate.getDay()];
      await addScheduledTask(dayId, time, title);
      return { ok: true, message: "Added to this week's calendar." };
    }

    const translated = await translateText(title);
    const calendar = matchCalendarName(translated, calendars, learnedCalendarKeywords);
    const event = await createCalendarEvent(calendar.id, translated, `${date}T${time}`, '', 30);
    return {
      ok: true,
      message: `Added to ${calendar.summary} for ${date}.`,
      link: event.htmlLink,
    };
  }, [gcalConnected, calendars, learnedCalendarKeywords, weekKey, addScheduledTask]);

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

  // Resizing a busy block changes its duration in place (same start time) —
  // patches Google Calendar directly and updates local state optimistically,
  // the same as a task resize, just without a local Task record to update.
  const resizeBusyEvent = useCallback((ev: GCalBusyEvent, durationMinutes: number) => {
    updateCalendarEvent(ev.calendarId, ev.id, ev.start, durationMinutes)
      .catch(err => console.error('[App] failed to resize busy event:', err));
    const newEnd = new Date(new Date(ev.start).getTime() + durationMinutes * 60_000).toISOString();
    setBusyEventsByDay(prev => {
      const next: Record<string, GCalBusyEvent[]> = {};
      for (const [dayId, events] of Object.entries(prev)) {
        next[dayId] = events.map(e => e.id === ev.id ? { ...e, end: newEnd } : e);
      }
      return next;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    if (task.startTime) {
      const keys = task.isDaily ? DAYS.map(d => `${realId}_${d.id}`) : [realId];
      removeSyncedEvents(keys);
    }
    if (task.isDaily) {
      // A recurring task is stored as one copy per week (same content+dayId,
      // the identity key the auto-populate effect above matches on). Deleting
      // only the current week's copy left every other week's copy in place,
      // so the very next time that effect ran it treated the task as "missing
      // from this week" and silently re-added it — the task could never
      // actually be deleted. Removing every week's copy at once fixes that.
      const key = `${task.content}|${task.dayId}`;
      setStorageData(prev => ({
        ...prev,
        tasksByWeek: Object.fromEntries(
          Object.entries(prev.tasksByWeek).map(([wk, wkTasks]) => [
            wk,
            wkTasks.filter(t => !(t.isDaily && t.content === task.content && t.dayId === task.dayId)),
          ]),
        ),
        // Belt-and-suspenders on top of the cross-week removal above: even if
        // some copy is missed (edited content, a race with another tab, a
        // week not yet loaded), the auto-populate effect will refuse to
        // resurrect this exact key until it's explicitly re-created.
        deletedRecurringKeys: prev.deletedRecurringKeys.includes(key)
          ? prev.deletedRecurringKeys
          : [...prev.deletedRecurringKeys, key],
      }));
    } else {
      setTasks(prev => prev.filter(t => t.id !== realId));
    }
  }, [tasks, setTasks, setStorageData, removeSyncedEvents]);

  // Duplicates onto the same day/time as a one-off (not recurring, even if the
  // original is isDaily) — it lands stacked side by side with the original
  // and can be dragged wherever it actually belongs from there.
  const duplicateTask = useCallback((id: string) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    const newId = genId();
    setTasks(prev => [...prev, {
      ...task, id: newId, isDaily: false, dailyStatuses: undefined, sortOrder: prev.length,
    }]);
    if (task.startTime) {
      const dayIndex = DAYS.findIndex(d => d.id === task.dayId);
      syncTaskToCalendar(newId, task.content, dayIndex, task.startTime, task.durationMinutes ?? 30, task.calendarId);
    }
  }, [tasks, setTasks, syncTaskToCalendar]);

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
    if (turningOn) {
      // The user explicitly wants this content+day recurring again — lift
      // any earlier tombstone so the auto-populate effect is allowed to
      // propagate it to other weeks instead of silently ignoring it forever.
      const key = `${task.content}|${task.dayId}`;
      setStorageData(prev => ({
        ...prev,
        deletedRecurringKeys: prev.deletedRecurringKeys.filter(k => k !== key),
      }));
    }
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
  }, [tasks, setTasks, setStorageData, removeSyncedEvents, syncTaskToCalendar]);

  const setTaskColor = useCallback((id: string, color: TaskColor) => {
    const realId = getRealId(id);
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, color } : t));
  }, [setTasks]);

  const editTask = useCallback((id: string, updates: { content?: string; startTime?: string }) => {
    const realId = getRealId(id);
    const task = tasks.find(t => t.id === realId);
    if (!task) return;
    const newContent = updates.content?.trim() || task.content;
    const newStartTime = updates.startTime ?? task.startTime;
    setTasks(prev => prev.map(t => t.id === realId ? { ...t, content: newContent, startTime: newStartTime } : t));
    if (!newStartTime) return;
    const duration = task.durationMinutes ?? 30;
    if (task.isDaily) {
      DAYS.forEach((d, idx) => {
        syncTaskToCalendar(`${realId}_${d.id}`, newContent, idx, newStartTime, duration, task.calendarId);
      });
    } else {
      const dayIndex = DAYS.findIndex(d => d.id === task.dayId);
      syncTaskToCalendar(realId, newContent, dayIndex, newStartTime, duration, task.calendarId);
    }
  }, [tasks, setTasks, syncTaskToCalendar]);

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
  const setLibraryTaskDuration = useCallback((id: string, durationMinutes: number | undefined) => setLibraryTasks(prev => prev.map(t => t.id === id ? { ...t, durationMinutes } : t)), [setLibraryTasks]);

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

    // A read-only Google Calendar block dragged to a new slot: reschedule the
    // real event directly (no local Task record involved) and move it to the
    // new day bucket optimistically so the UI updates without waiting for
    // the next weekly refetch.
    if (aid.startsWith('busy_')) {
      const evId = aid.slice('busy_'.length);
      const found = Object.values(busyEventsByDay).flat().find(e => e.id === evId);
      if (!found) return;
      const slot = parseSlotId(overId);
      if (!slot) return;
      const { dayId, time } = slot;
      const dayIndex = DAYS.findIndex(d => d.id === dayId);
      const duration = Math.max(15, Math.round((new Date(found.end).getTime() - new Date(found.start).getTime()) / 60_000));
      const startDateTime = formatLocalDateTime(weekStart, dayIndex, time);
      updateCalendarEvent(found.calendarId, found.id, startDateTime, duration)
        .catch(err => console.error('[App] failed to reschedule busy event:', err));
      const newStart = new Date(startDateTime);
      const newEnd = new Date(newStart.getTime() + duration * 60_000);
      setBusyEventsByDay(prev => {
        const next: Record<string, GCalBusyEvent[]> = {};
        for (const [dId, evs] of Object.entries(prev)) next[dId] = evs.filter(e => e.id !== evId);
        (next[dayId] ??= []).push({ ...found, start: newStart.toISOString(), end: newEnd.toISOString() });
        return next;
      });
      return;
    }

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
        // Dropped straight onto a grid slot == a plain calendar event, same as
        // the empty-slot quick-add path — not a to-do, so it shouldn't show up
        // in the Bank/List/Stats. A drop elsewhere (no slot) stays a real task.
        isCalendarOnly: !!slot,
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
  }, [libraryTasks, tasks, setTasks, removeSyncedEvents, syncTaskToCalendar, busyEventsByDay, weekStart]);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const dayTasks of Object.values(scheduledTasksByDay)) {
      const found = dayTasks.find(t => t.id === activeId);
      if (found) return found;
    }
    return tasks.find(t => t.id === activeId) ?? null;
  }, [activeId, scheduledTasksByDay, tasks]);

  const activeBusyEvent = useMemo(() => {
    if (!activeId || !activeId.startsWith('busy_')) return null;
    const evId = activeId.slice('busy_'.length);
    return Object.values(busyEventsByDay).flat().find(e => e.id === evId) ?? null;
  }, [activeId, busyEventsByDay]);

  const activeLib = activeId ? libraryTasks.find(lt => lt.id === activeId) : null;

  return (
    <div className="h-screen app-bg text-foreground font-sans flex flex-col overflow-hidden">
      <div className="h-1 w-full shrink-0" style={{ background: 'hsl(340 60% 80%)' }} />

      <header className="bg-card shadow-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-foreground tracking-tight shrink-0">
            Weekly Task Master
          </h1>
          {plannerView === 'day' ? (
            <div className="flex items-center gap-2 mx-auto">
              <button onClick={() => navigateDay(-1)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
                <ChevronLeft size={18} />
              </button>
              <div className="text-center min-w-[170px]">
                <p className="text-sm font-semibold text-foreground">{DAYS[selectedDayIndex]?.label}</p>
                <p className="text-[11px] text-muted-foreground">{formatDayDate(weekStart, selectedDayIndex)}</p>
              </div>
              <button onClick={() => navigateDay(1)} className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
                <ChevronRight size={18} />
              </button>
              {!(isCurrentWeek && selectedDayId === todayDayId) && (
                <button onClick={goToToday} className="ml-2 px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground rounded-xl transition-base hover:opacity-90">
                  Today
                </button>
              )}
            </div>
          ) : (
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
          )}

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
            <div className="flex items-center gap-0.5 bg-muted rounded-xl p-0.5">
              <button
                onClick={() => setPlannerView('calendar')}
                title="Week view"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-base ${
                  plannerView === 'calendar' ? 'bg-card text-foreground shadow-sm-custom' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CalendarRange size={14} />
                <span>Week</span>
              </button>
              <button
                onClick={switchToDayView}
                title="Day view"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-base ${
                  plannerView === 'day' ? 'bg-card text-foreground shadow-sm-custom' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar size={14} />
                <span>Day</span>
              </button>
              <button
                onClick={() => setPlannerView('list')}
                title="List view"
                className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-base ${
                  plannerView === 'list' ? 'bg-card text-foreground shadow-sm-custom' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <LayoutList size={14} />
                <span>List</span>
              </button>
            </div>
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

      {gcalSyncError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-[hsl(var(--status-red-bg))] text-destructive rounded-xl text-xs flex items-center gap-2 shrink-0">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 break-words" dir="auto">{gcalSyncError}</span>
          <button onClick={() => setGcalSyncError(null)} className="shrink-0 p-0.5 hover:opacity-70 transition-base">
            <X size={14} />
          </button>
        </div>
      )}

      {pendingCalendarAsk && (
        <div className="mx-4 mt-3 px-3 py-2.5 bg-primary/10 rounded-xl text-xs flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Calendar size={14} className="shrink-0 text-primary" />
            <span className="flex-1 break-words text-foreground/80" dir="auto">
              Which calendar should <span className="font-semibold" dir="auto">"{pendingCalendarAsk.content}"</span> go to? I'll remember this for next time.
            </span>
            <button onClick={skipPendingCalendarAsk} className="shrink-0 p-0.5 text-muted-foreground/60 hover:text-foreground transition-base" title="Use the default calendar this once">
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {calendars.map(cal => (
              <button
                key={cal.id}
                onClick={() => resolvePendingCalendarAsk(cal.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-card border border-border hover:border-primary/40 hover:shadow-sm-custom transition-base"
              >
                <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: cal.backgroundColor ?? '#999' }} />
                {cal.summary}
              </button>
            ))}
          </div>
        </div>
      )}

      {gcalConnected && !gcalSyncError && (
        <p className="mx-4 mt-1.5 text-[10px] text-muted-foreground/50 shrink-0">
          Google Calendar: {calendars.length} calendar{calendars.length === 1 ? '' : 's'} found, {busyEventCount} event{busyEventCount === 1 ? '' : 's'} loaded for this week
        </p>
      )}

      <main className="flex-1 px-4 pt-4 pb-4 flex gap-3 min-h-0 overflow-hidden">
        {plannerView === 'calendar' || plannerView === 'day' ? (
          <DndContext sensors={sensors} collisionDetection={pointerWithin}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="w-[240px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-2 scroll-thin">
              <QuickAddPanel onSubmit={quickAddFromChat} disabled={!gcalConnected} />
              <TaskSidebarPanel
                tasks={bankTasksForPanel}
                onAddTask={addUnscheduledTask}
                onDelete={deleteTask}
                onCycleStatus={cycleStatus}
                onToggleDaily={toggleDaily}
                onSetColor={setTaskColor}
                onSplitTask={splitTask}
                libraryTasks={libraryTasks}
                onAddLibraryTask={addLibraryTask}
                onDeleteLibraryTask={deleteLibraryTask}
                onSetLibraryColor={setLibraryTaskColor}
                onSetLibraryDuration={setLibraryTaskDuration}
              />
              <StatsCard tasks={trackedTasks} progress={progress} />
              <WeeklyGoals goals={goals} tasks={trackedTasks} onAddGoal={addGoal} onDeleteGoal={deleteGoal} />
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
                days={plannerView === 'day'
                  ? [{ id: selectedDayId, label: DAYS[selectedDayIndex]?.label ?? '', date: formatDayDate(weekStart, selectedDayIndex) }]
                  : DAYS.map((d, i) => ({ id: d.id, label: d.label, date: formatDayDate(weekStart, i) }))}
                todayDayId={todayDayId}
                scheduledTasksByDay={scheduledTasksByDay}
                busyEventsByDay={visibleBusyEventsByDay}
                syncedTaskIds={syncedTaskIds}
                onDelete={deleteTask}
                onDuplicate={duplicateTask}
                onEdit={editTask}
                onSetColor={setTaskColor}
                onResize={resizeTask}
                calendars={calendars}
                onSetCalendar={setTaskCalendar}
                learnedCalendarKeywords={learnedCalendarKeywords}
                onDeleteBusyEvent={deleteBusyEvent}
                onResizeBusyEvent={resizeBusyEvent}
                onQuickAdd={addScheduledTask}
              />
            </div>

            <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
              {activeTask ? (
                <CalendarTaskBlock
                  task={activeTask} top={0} height={36} left="0" width="100%"
                  onDelete={deleteTask} onSetColor={setTaskColor}
                  isOverlay
                />
              ) : null}
              {activeLib ? <div className="px-4 py-2.5 bg-card rounded-xl shadow-overlay border border-primary/20 text-[13px] font-medium text-foreground">{activeLib.content}</div> : null}
              {activeBusyEvent ? (
                <GCalBusyBlock event={activeBusyEvent} top={0} height={36} left="0" width="100%" isOverlay />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <DayListView
            tasks={trackedTasks}
            weekStart={weekStart}
            todayDayId={todayDayId}
            setTasks={setTasks}
            onDelete={deleteTask}
            onCycleStatus={cycleStatus}
            onToggleDaily={toggleDaily}
            onSetColor={setTaskColor}
            onSplitTask={splitTask}
            libraryTasks={libraryTasks}
            onAddLibraryTask={addLibraryTask}
            onDeleteLibraryTask={deleteLibraryTask}
            onSetLibraryColor={setLibraryTaskColor}
            onSetLibraryDuration={setLibraryTaskDuration}
            sidebarBefore={<QuickAddPanel onSubmit={quickAddFromChat} disabled={!gcalConnected} />}
            sidebarAfter={
              <>
                <StatsCard tasks={trackedTasks} progress={progress} />
                <WeeklyGoals goals={goals} tasks={trackedTasks} onAddGoal={addGoal} onDeleteGoal={deleteGoal} />
              </>
            }
          />
        )}
      </main>
    </div>
  );
}
