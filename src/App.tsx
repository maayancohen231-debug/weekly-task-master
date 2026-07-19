import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, DragEndEvent, DragStartEvent,
  defaultDropAnimationSideEffects, DragOverEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ChevronLeft, ChevronRight, GraduationCap, DatabaseZap, CalendarDays, Unlink, CalendarPlus, ListTodo, RefreshCw } from 'lucide-react';
import { AcademicBoard } from '@/components/AcademicBoard';
import { ListsPage } from '@/components/ListsPage';
import { CalendarEventModal } from '@/components/CalendarEventModal';
import { CalendarPickerPopup } from '@/components/CalendarPickerPopup';
import { forceSeedData } from '@/lib/seed';
import {
  isConfigured, isTokenValid, requestToken, clearToken,
  loadSyncedEvents, createCalendarEvent, saveSyncedEvent, fetchWeekEvents,
  type SyncedEventInfo, type GCalBusyEvent,
} from '@/services/googleCalendar';
import { DayColumn } from '@/components/DayColumn';
import { StatsCard } from '@/components/StatsCard';
import { LibraryPanel } from '@/components/LibraryPanel';
import { TaskItem } from '@/components/TaskItem';
import { WeeklyGoals, type WeeklyGoal } from '@/components/WeeklyGoals';
import { translateText } from '@/lib/translate';
import {
  DAYS, DAY_INDEX_TO_ID, getWeekSunday, getWeekKey, formatDayDate, getMonthYear, getWeekRange, nextStatus,
  formatLocalDateTime, getDayIdForDate,
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
  const [searchValue, setSearchValue] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [globalCalendarToggle, setGlobalCalendarToggle] = useState(false);

  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(() => isTokenValid());
  const [calendarModalTaskId, setCalendarModalTaskId] = useState<string | null>(null);
  const [syncedEvents, setSyncedEvents] = useState<Record<string, SyncedEventInfo>>(() => loadSyncedEvents());
  const syncedTaskIds = useMemo(() => new Set(Object.keys(syncedEvents)), [syncedEvents]);
  const [pendingCalendarPick, setPendingCalendarPick] = useState<{ taskId: string; libId: string; content: string } | null>(null);
  const [busyEventsByDay, setBusyEventsByDay] = useState<Record<string, GCalBusyEvent[]>>({});
  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  // Silent token refresh — only if a token already exists (even expired)
  useEffect(() => {
    if (!isConfigured()) return;
    const tryRefresh = async () => {
      if (isTokenValid()) { setGcalConnected(true); return; }
      // Only attempt silent refresh if user previously connected (token in storage)
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

  const handleAddToCalendar = useCallback((taskId: string) => {
    setCalendarModalTaskId(taskId);
  }, []);

  const handleCalendarSynced = useCallback((taskId: string, info: SyncedEventInfo) => {
    setSyncedEvents(prev => ({ ...prev, [taskId]: info }));
  }, []);

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
          const dayId = getDayIdForDate(new Date(ev.start), weekStart);
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
  const calendarModalTask = useMemo(() => {
    if (!calendarModalTaskId) return null;
    return tasks.find(t => t.id === calendarModalTaskId) ?? null;
  }, [calendarModalTaskId, tasks]);
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

      // Gather all isDaily tasks across all weeks
      const allDailyTasks = Object.values(prev.tasksByWeek).flat().filter(t => t.isDaily);
      if (allDailyTasks.length === 0) return prev;

      // Deduplicate by content+dayId — take first occurrence as template
      const seen = new Set<string>();
      const templates: Task[] = [];
      for (const t of allDailyTasks) {
        const key = `${t.content}|${t.dayId}`;
        if (!seen.has(key)) { seen.add(key); templates.push(t); }
      }

      // Find templates missing from this week
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

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    DAYS.forEach(d => { map[d.id] = []; });
    tasks.forEach(t => {
      if (t.isDaily) {
        DAYS.forEach(d => {
          const dayStatus = (t.dailyStatuses?.[d.id] ?? t.status) as Task['status'];
          map[d.id].push({ ...t, dayId: d.id, id: `${t.id}_${d.id}`, status: dayStatus });
        });
      } else if (map[t.dayId]) {
        map[t.dayId].push(t);
      }
    });
    Object.keys(map).forEach(k => map[k].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
    return map;
  }, [tasks]);

  const addTaskToDay = useCallback(async (dayId: string, text: string): Promise<string> => {
    const translated = await translateText(text);
    const newId = genId();
    setTasks(prev => {
      const sortOrder = prev.filter(t => t.dayId === dayId && !t.isDaily).length;
      return [...prev, {
        id: newId, content: translated,
        originalText: /[\u0590-\u05FF]/.test(text) ? text : undefined,
        status: 'none', color: 'none', dayId, isDaily: false, sortOrder,
      }];
    });
    return newId;
  }, [setTasks]);

  const handleGlobalAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    setIsAdding(true);
    const newId = await addTaskToDay(todayDayId ?? 'sun', searchValue);
    if (globalCalendarToggle) setCalendarModalTaskId(newId);
    setSearchValue('');
    setGlobalCalendarToggle(false);
    setIsAdding(false);
  };

  const addInlineTask = useCallback(async (dayId: string, text: string, addToCalendar = false) => {
    if (!text.trim()) return;
    const newId = await addTaskToDay(dayId, text);
    if (addToCalendar) setCalendarModalTaskId(newId);
  }, [addTaskToDay, setCalendarModalTaskId]);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== getRealId(id)));
  }, [setTasks]);

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
    const newTasks: Task[] = Array.from({ length: count }, (_, i) => ({
      id: genId(), content: `${task.content} (${i + 1}/${count})`,
      status: 'none' as const, color: task.color,
      dayId: DAYS[i % DAYS.length]?.id ?? task.dayId, isDaily: false, sortOrder: i,
    }));
    setTasks(prev => [...prev.filter(t => t.id !== realId), ...newTasks]);
  }, [tasks, setTasks]);

  const addLibraryTask = useCallback((t: LibraryTask) => setLibraryTasks(prev => [t, ...prev]), [setLibraryTasks]);
  const deleteLibraryTask = useCallback((id: string) => setLibraryTasks(prev => prev.filter(t => t.id !== id)), [setLibraryTasks]);
  const setLibraryTaskColor = useCallback((id: string, color: TaskColor) => setLibraryTasks(prev => prev.map(t => t.id === id ? { ...t, color } : t)), [setLibraryTasks]);

  const moveTask = useCallback((id: string, direction: 'up' | 'down') => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (!task) return prev;
      const dayTasks = prev.filter(t => t.dayId === task.dayId);
      const idx = dayTasks.findIndex(t => t.id === id);
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= dayTasks.length) return prev;
      const other = dayTasks[swapIdx];
      return prev.map(t => {
        if (t.id === id) return { ...t, sortOrder: other.sortOrder };
        if (t.id === other.id) return { ...t, sortOrder: task.sortOrder };
        return t;
      });
    });
  }, [setTasks]);
  const addGoal = useCallback((name: string, target: number) => {
    setGoals(prev => [...prev, { id: genId(), name, targetCount: target }]);
  }, [setGoals]);
  const deleteGoal = useCallback((id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, [setGoals]);

  const navigateWeek = (dir: number) => setWeekStart(prev => {
    const d = new Date(prev); d.setDate(d.getDate() + dir * 7); return d;
  });

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const aid = active.id as string, oid = over.id as string;
    if (libraryTasks.some(lt => lt.id === aid)) return;
    const realAid = getRealId(aid);
    const at = tasks.find(t => t.id === realAid);
    if (!at || at.isDaily) return;
    if ((DAY_IDS as string[]).includes(oid)) {
      if (at.dayId !== oid) setTasks(prev => prev.map(t => t.id === realAid ? { ...t, dayId: oid } : t));
      return;
    }
    const ot = tasks.find(t => t.id === getRealId(oid));
    if (ot && at.dayId !== ot.dayId) setTasks(prev => prev.map(t => t.id === realAid ? { ...t, dayId: ot.dayId } : t));
  }, [libraryTasks, tasks, setTasks]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const aid = active.id as string, oid = over.id as string;
    const lib = libraryTasks.find(lt => lt.id === aid);
    if (lib) {
      const dayId = (DAY_IDS as string[]).includes(oid) ? oid : (tasks.find(t => t.id === getRealId(oid))?.dayId ?? null);
      if (dayId) {
        const newId = genId();
        setTasks(prev => [...prev, {
          id: newId, content: lib.content, originalText: lib.originalText,
          status: 'none', color: 'none', dayId, isDaily: false,
          sortOrder: prev.filter(t => t.dayId === dayId).length,
          startTime: lib.startTime, durationMinutes: lib.durationMinutes, calendarId: lib.calendarId,
        }]);
        if (lib.startTime && !lib.calendarId) {
          setPendingCalendarPick({ taskId: newId, libId: lib.id, content: lib.content });
        }
      }
      return;
    }
    if (active.id !== over.id && !(DAY_IDS as string[]).includes(oid)) {
      const realAid = getRealId(aid), realOid = getRealId(oid);
      if (tasks.find(t => t.id === realAid)?.isDaily) return;
      setTasks(prev => {
        const oi = prev.findIndex(t => t.id === realAid), ni = prev.findIndex(t => t.id === realOid);
        return oi > -1 && ni > -1 ? arrayMove(prev, oi, ni) : prev;
      });
    }
  }, [libraryTasks, tasks, setTasks]);

  const handleAssignCalendar = useCallback((calendarId: string) => {
    if (!pendingCalendarPick) return;
    const { taskId, libId } = pendingCalendarPick;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, calendarId } : t));
    setLibraryTasks(prev => prev.map(t => t.id === libId ? { ...t, calendarId } : t));
    setPendingCalendarPick(null);
  }, [pendingCalendarPick, setTasks, setLibraryTasks]);

  const handleCancelCalendarPick = useCallback(() => setPendingCalendarPick(null), []);

  const handleSyncToCalendar = useCallback(async () => {
    const toSync = tasks.filter(t => !t.isDaily && t.startTime && t.calendarId && !syncedTaskIds.has(t.id));
    if (toSync.length === 0) { setSyncSummary('No scheduled tasks to sync'); return; }
    setIsSyncingCalendar(true);
    setSyncSummary(null);
    let succeeded = 0, failed = 0;
    for (const t of toSync) {
      try {
        const dayIndex = DAYS.findIndex(d => d.id === t.dayId);
        const startDateTime = formatLocalDateTime(weekStart, dayIndex, t.startTime!);
        const event = await createCalendarEvent(t.calendarId!, t.content, startDateTime, '', t.durationMinutes ?? 30);
        const info: SyncedEventInfo = {
          eventId: event.id, calendarId: t.calendarId!, calendarName: '',
          htmlLink: event.htmlLink, syncedAt: new Date().toISOString(),
        };
        saveSyncedEvent(t.id, info);
        setSyncedEvents(prev => ({ ...prev, [t.id]: info }));
        succeeded++;
      } catch (err) {
        console.error('[App] failed to sync task to calendar:', t.id, err);
        failed++;
      }
    }
    setIsSyncingCalendar(false);
    setSyncSummary(failed > 0 ? `Synced ${succeeded}, ${failed} failed` : `Synced ${succeeded} task${succeeded === 1 ? '' : 's'}`);
    setTimeout(() => setSyncSummary(null), 4000);
  }, [tasks, syncedTaskIds, weekStart]);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const dayTasks of Object.values(tasksByDay)) {
      const found = dayTasks.find(t => t.id === activeId);
      if (found) return found;
    }
    return tasks.find(t => t.id === activeId) ?? null;
  }, [activeId, tasksByDay, tasks]);

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
                <>
                  <button
                    onClick={handleSyncToCalendar}
                    disabled={isSyncingCalendar}
                    title={syncSummary ?? 'Push scheduled tasks to Google Calendar'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isSyncingCalendar ? 'animate-spin' : ''} />
                    <span>{syncSummary ?? 'Sync to Calendar'}</span>
                  </button>
                  <button
                    onClick={handleDisconnectCalendar}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[hsl(var(--status-green))] bg-[hsl(var(--status-green-bg))] hover:bg-[hsl(var(--status-red-bg))] hover:text-destructive rounded-xl transition-base"
                    title="Disconnect Google Calendar"
                  >
                    <Unlink size={14} />
                    <span>Calendar</span>
                  </button>
                </>
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

      <div className="px-6 pt-4 pb-2 shrink-0">
        <form onSubmit={handleGlobalAdd}>
          <div className="relative">
            <input
              type="text" value={searchValue} onChange={e => setSearchValue(e.target.value)} dir="auto"
              placeholder={`Add a task to ${todayDayId ? DAYS.find(d => d.id === todayDayId)?.label : 'Sunday'}... (supports Hebrew)`}
              className={`w-full py-3 bg-card rounded-2xl shadow-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground/35 transition-base ${isConfigured() && gcalConnected ? 'pl-5 pr-12' : 'px-5'}`}
            />
            {isAdding && <span className="absolute right-4 top-3.5 text-xs text-muted-foreground">Adding...</span>}
            {!isAdding && isConfigured() && gcalConnected && (
              <button
                type="button"
                onClick={() => setGlobalCalendarToggle(v => !v)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-base ${
                  globalCalendarToggle
                    ? 'text-[hsl(var(--task-blue))] bg-[hsl(var(--task-blue)/.1)]'
                    : 'text-muted-foreground/30 hover:text-[hsl(var(--task-blue))]'
                }`}
                title={globalCalendarToggle ? 'Will add to Google Calendar' : 'Add to Google Calendar'}
              >
                <CalendarPlus size={15} />
              </button>
            )}
          </div>
        </form>
      </div>

      <main className="flex-1 px-4 pb-4 flex gap-3 min-h-0 overflow-hidden">
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
          <div className="w-[220px] shrink-0 flex flex-col gap-3 overflow-y-auto pb-2">
            <LibraryPanel libraryTasks={libraryTasks} onAddLibraryTask={addLibraryTask} onDeleteLibraryTask={deleteLibraryTask} onSetLibraryColor={setLibraryTaskColor} />
            <StatsCard tasks={tasks} progress={progress} />
            <WeeklyGoals goals={goals} tasks={tasks} onAddGoal={addGoal} onDeleteGoal={deleteGoal} />
          </div>

          <div className="flex-1 flex gap-2 overflow-x-auto pb-2">
            {DAYS.map((day, i) => (
              <DayColumn key={day.id} dayId={day.id} label={day.label}
                date={formatDayDate(weekStart, i)} tasks={tasksByDay[day.id]}
                isToday={todayDayId === day.id} onDelete={deleteTask}
                onCycleStatus={cycleStatus} onToggleDaily={toggleDaily}
                onSetColor={setTaskColor} onSplitTask={splitTask} onAddInline={addInlineTask}
                onMoveTask={moveTask}
                calendarConfigured={isConfigured() && gcalConnected}
                onAddToCalendar={isConfigured() ? handleAddToCalendar : undefined}
                syncedTaskIds={syncedTaskIds}
                busyEvents={busyEventsByDay[day.id]}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
            {activeTask ? <TaskItem task={activeTask} isOverlay /> : null}
            {activeLib ? <div className="px-4 py-2.5 bg-card rounded-xl shadow-overlay border border-primary/20 text-[13px] font-medium text-foreground">{activeLib.content}</div> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {calendarModalTask && (
        <CalendarEventModal
          task={calendarModalTask}
          onClose={() => setCalendarModalTaskId(null)}
          onSynced={(taskId, info) => {
            handleCalendarSynced(taskId, info);
            setCalendarModalTaskId(null);
          }}
        />
      )}

      {pendingCalendarPick && (
        <CalendarPickerPopup
          taskContent={pendingCalendarPick.content}
          onAssign={handleAssignCalendar}
          onCancel={handleCancelCalendarPick}
        />
      )}
    </div>
  );
}
