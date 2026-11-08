import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, BookOpen, CalendarClock, Check, ChevronDown, ChevronUp,
  Clock, GraduationCap, Plus, Trash2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// University Studies — Semester 2027a (Open University)
// Seeded from the "סמסטר 2027א – סיכום משאילתא" summary (as of 8.11.2026).
// User state (checked items, done assignments, custom items) is kept in
// localStorage; the seed itself is static so it can be updated in code.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'university-studies-2027a';
const SEMESTER_LABEL = 'Semester 2027a';
const AS_OF = '8.11.2026';

type CourseKey = 'psy' | 'pers' | 'econ' | 'isd' | 'stat' | 'db' | 'other';
type ItemKind = 'assignment' | 'session' | 'exam' | 'milestone';

interface CourseInfo {
  code: string;
  name: string;
  short: string;
  meeting?: string;
  color: string; // hsl components
}

const COURSES: Record<CourseKey, CourseInfo> = {
  psy:  { code: '10136', name: 'Intro to Psychology', short: 'Psychology', meeting: 'Fri 08:30–11:00', color: '262 45% 58%' },
  pers: { code: '10269', name: 'Personality: Theory and Research', short: 'Personality', meeting: 'Thu 19:15–21:15', color: '330 50% 58%' },
  econ: { code: '10284', name: 'Basic Concepts in Econometrics', short: 'Econometrics', meeting: 'Mon 18:00–21:00', color: '205 60% 48%' },
  isd:  { code: '20436', name: 'Principles of Information Systems Development', short: 'IS Dev', meeting: 'Wed 18:15–20:45', color: '28 75% 52%' },
  stat: { code: '30112', name: 'Intro to Statistics B', short: 'Statistics', meeting: 'Thu 18:15–20:45', color: '170 45% 38%' },
  db:   { code: '20277', name: 'Database Systems', short: 'Databases', color: '0 55% 52%' },
  other:{ code: '', name: 'Other', short: 'Other', color: '220 10% 50%' },
};

const SESSION_TIME: Partial<Record<CourseKey, string>> = {
  psy: '08:30–11:00', pers: '19:15–21:15', econ: '18:00–21:00', isd: '18:15–20:45', stat: '18:15–20:45',
};

interface TimelineItem {
  id: string;
  date: string; // YYYY-MM-DD
  kind: ItemKind;
  course: CourseKey;
  label: string;
  time?: string;
  note?: string;
  custom?: boolean;
}

// [D.M (year inferred: Nov–Dec = 2026, Jan = 2027), kind, course, label, note?]
type SeedRow = [string, ItemKind, CourseKey, string, string?];

const A = 'assignment' as const;
const S = 'session' as const;

const SEED_ROWS: SeedRow[] = [
  // November 2026
  ['8.11', A, 'psy', 'Assignment 04', 'Calendar says 8.11, main page says 13.11 – check the course site'],
  ['9.11', S, 'econ', 'Session'],
  ['12.11', S, 'stat', 'Session'], ['12.11', S, 'pers', 'Session'],
  ['13.11', S, 'psy', 'Session'],
  ['15.11', A, 'econ', 'Assignment 03'], ['15.11', A, 'psy', 'Assignment 05'],
  ['16.11', S, 'econ', 'Session'], ['16.11', A, 'stat', 'Assignment 01'],
  ['18.11', S, 'isd', 'Session'],
  ['19.11', S, 'stat', 'Session'], ['19.11', S, 'pers', 'Session'],
  ['20.11', A, 'isd', 'Assignment 01'],
  ['22.11', A, 'psy', 'Assignment 06'],
  ['23.11', S, 'econ', 'Session'],
  ['26.11', S, 'stat', 'Session'],
  ['27.11', S, 'psy', 'Session'],
  ['28.11', A, 'econ', 'Assignment 02'],
  ['29.11', A, 'psy', 'Assignment 07'],
  // December 2026
  ['1.12', 'exam', 'db', 'Exam – Database Systems (20277)', 'Includes extra time. Make sure you are registered!'],
  ['2.12', S, 'isd', 'Session'],
  ['3.12', S, 'stat', 'Session'], ['3.12', S, 'pers', 'Session'],
  ['5.12', A, 'pers', 'Assignment 02'],
  ['6.12', A, 'psy', 'Assignment 08'],
  ['7.12', S, 'econ', 'Session'],
  ['11.12', S, 'psy', 'Session'], ['11.12', A, 'isd', 'Assignment 04'],
  ['13.12', A, 'psy', 'Assignment 09'],
  ['14.12', S, 'econ', 'Session'],
  ['16.12', A, 'stat', 'Assignment 02'],
  ['17.12', S, 'pers', 'Session'],
  ['18.12', A, 'psy', 'Assignment 01'],
  ['21.12', S, 'econ', 'Session'],
  ['23.12', S, 'isd', 'Session'],
  ['24.12', S, 'stat', 'Session'], ['24.12', A, 'stat', 'Assignment 03'],
  ['25.12', S, 'psy', 'Session'],
  ['27.12', A, 'psy', 'Assignment 10'],
  ['30.12', A, 'econ', 'Assignment 04'],
  ['31.12', A, 'econ', 'Assignment 07'], ['31.12', S, 'stat', 'Session'],
  // January 2027
  ['1.1', A, 'isd', 'Assignment 02'],
  ['3.1', A, 'psy', 'Assignment 11'],
  ['4.1', S, 'econ', 'Session'],
  ['7.1', S, 'stat', 'Session'], ['7.1', S, 'pers', 'Session'],
  ['8.1', S, 'psy', 'Session'],
  ['10.1', A, 'econ', 'Assignment 05'],
  ['13.1', S, 'isd', 'Session'],
  ['14.1', S, 'stat', 'Session'], ['14.1', A, 'stat', 'Assignment 04'], ['14.1', S, 'pers', 'Session'],
  ['15.1', A, 'isd', 'Assignment 05'],
  ['16.1', A, 'pers', 'Assignment 04'],
  ['17.1', A, 'psy', 'Assignment 12'],
  ['22.1', S, 'psy', 'Session'],
  ['27.1', S, 'isd', 'Session'],
  ['29.1', S, 'psy', 'Session'],
  ['30.1', A, 'econ', 'Assignment 06'], ['30.1', A, 'pers', 'Assignment 06'], ['30.1', A, 'stat', 'Assignment 05'],
  ['31.1', A, 'psy', 'Assignment 02'], ['31.1', A, 'isd', 'Assignment 03'],
  ['31.1', 'milestone', 'other', 'End of semester'],
];

function seedDate(dm: string): string {
  const [d, m] = dm.split('.').map(Number);
  const year = m >= 10 ? 2026 : 2027;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Sessions are numbered per course in date order, starting from the first
// session listed in the summary (9.11). Shift with SESSION_OFFSET if earlier
// sessions already took place.
const SESSION_OFFSET: Partial<Record<CourseKey, number>> = {};

const SEED_ITEMS: TimelineItem[] = (() => {
  const counters: Partial<Record<CourseKey, number>> = {};
  return SEED_ROWS.map(([dm, kind, course, label, note]) => {
    const date = seedDate(dm);
    let finalLabel = label;
    if (kind === 'session') {
      const n = (counters[course] ?? SESSION_OFFSET[course] ?? 0) + 1;
      counters[course] = n;
      finalLabel = `Session ${n}`;
    }
    return {
      id: `${date}_${course}_${kind}_${label}`,
      date, kind, course, label: finalLabel, note,
      time: kind === 'exam' ? '16:30–20:30' : kind === 'session' ? SESSION_TIME[course] : undefined,
    };
  });
})();

// ── Static summary sections ─────────────────────────────────────────────────

const URGENT: { id: string; title: string; detail: string }[] = [
  { id: 'u-db-exam', title: 'Register for the 20277 Database Systems exam', detail: 'Exam on 1.12.2026, 16:30–20:30 (incl. extra time). The "Alternative assessments" page says "not yet registered for the exam date".' },
  { id: 'u-deferral', title: 'Check the deferral requests (20436, 10284)', detail: 'Course deferral requests were filed on 5.11, status "handled". The courses may have been deferred even though they still show as "studying".' },
  { id: 'u-psy-maman', title: 'Confirm Psychology Assignment 04 due date', detail: 'Calendar says 8.11, main page says 13.11 – check the course site.' },
  { id: 'u-pending', title: 'Complete registration – 3 courses "awaiting your action"', detail: '30112 Intro to Statistics B, 10523 Ethics in Management, 20551 Intro to AI.' },
  { id: 'u-20465', title: 'Systems Programming Lab (20465) – not registered', detail: 'Does not appear anywhere in the record. If a request was sent, it was probably not received or went through another channel (e.g. email).' },
];

interface CourseRow { code: string; name: string; meeting: string; warn?: string; }

const ENROLLED: CourseRow[] = [
  { code: '10136', name: 'Intro to Psychology', meeting: 'Fri 08:30–11:00' },
  { code: '10269', name: 'Personality: Theory and Research', meeting: 'Thu 19:15–21:15' },
  { code: '10284', name: 'Basic Concepts in Econometrics', meeting: 'Mon 18:00–21:00', warn: 'Deferral request "handled"' },
  { code: '20436', name: 'Principles of Information Systems Development', meeting: 'Wed 18:15–20:45', warn: 'Deferral request "handled"' },
];

const PENDING: CourseRow[] = [
  { code: '30112', name: 'Intro to Statistics B', meeting: 'Thu 18:15–20:45 (on calendar)' },
  { code: '10523', name: 'Ethics in Management', meeting: '12.11, 18:00–20:30' },
  { code: '20551', name: 'Intro to Artificial Intelligence', meeting: '9.11, 18:00–21:00' },
];

const NOT_REGISTERED: CourseRow[] = [
  { code: '20465', name: 'Systems Programming Lab', meeting: '—', warn: 'Not in the record' },
];

const GRADE_IMPROVEMENT: { code: string; name: string; status: 'ok' | 'action' | 'waiting'; text: string }[] = [
  { code: '10627', name: 'Price Theory A', status: 'ok', text: 'Approved (10.9)' },
  { code: '20606', name: 'Python Programming & Data Analysis', status: 'ok', text: 'Approved (10.9)' },
  { code: '20277', name: 'Database Systems', status: 'action', text: 'Offered in 2026c, registration active. Exam 1.12.2026, 16:30–20:30. Not yet registered for the exam date – register.' },
  { code: '30204', name: 'Statistical Inference', status: 'waiting', text: 'Forwarded to the Center for Academic Achievement, no final decision. Earlier reply: a paid grade improvement can be requested in 2027a.' },
];

// ── Persistence ─────────────────────────────────────────────────────────────

interface StudiesState {
  urgentDone: Record<string, boolean>;
  itemDone: Record<string, boolean>;
  hidden: Record<string, boolean>;
  custom: TimelineItem[];
}

const EMPTY_STATE: StudiesState = { urgentDone: {}, itemDone: {}, hidden: {}, custom: [] };

function loadState(): StudiesState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<StudiesState>) };
  } catch { /* ignore */ }
  return EMPTY_STATE;
}

// ── Date helpers ────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

function daysUntil(iso: string): number {
  const t = parseISO(todayISO()).getTime();
  return Math.round((parseISO(iso).getTime() - t) / 86400000);
}

function fmtDM(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

function relLabel(n: number): string {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 0) return `${-n}d ago`;
  return `in ${n}d`;
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// ── Small UI pieces ─────────────────────────────────────────────────────────

function CourseChip({ course }: { course: CourseKey }) {
  const c = COURSES[course];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap"
      style={{ background: `hsl(${c.color} / 0.12)`, color: `hsl(${c.color})` }}
    >
      {c.short}
    </span>
  );
}

function Section({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-[15px] font-bold text-foreground">{title}</h2>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function CourseTable({ rows, title }: { rows: CourseRow[]; title: string }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground mb-1.5">{title}</h3>
      <div className="divide-y divide-border/50">
        {rows.map(r => (
          <div key={r.code} className="py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">{r.name}</span>
              <span className="text-[11px] text-muted-foreground/70 tabular-nums">{r.code}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <span className="text-xs text-muted-foreground">{r.meeting}</span>
              {r.warn && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(40_70%_35%)] bg-[hsl(var(--status-yellow-bg))] px-1.5 py-0.5 rounded-md">
                  <AlertTriangle size={11} /> {r.warn}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'red' | 'green' | 'neutral' }) {
  const cls = tone === 'red'
    ? 'text-[hsl(var(--status-red))]'
    : tone === 'green' ? 'text-[hsl(var(--status-green))]' : 'text-foreground';
  return (
    <div className="flex flex-col items-center px-4 py-2 rounded-xl bg-muted/40 min-w-[84px]">
      <span className={`text-lg font-bold tabular-nums leading-tight ${cls}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

type Filter = 'all' | 'assignment' | 'session';

function kindOrder(k: ItemKind): number {
  return k === 'exam' ? 0 : k === 'assignment' ? 1 : k === 'session' ? 2 : 3;
}

export function UniversityStudies() {
  const [state, setState] = useState<StudiesState>(loadState);
  const [filter, setFilter] = useState<Filter>('all');
  const [showPast, setShowPast] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newCourse, setNewCourse] = useState<CourseKey>('other');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  const today = todayISO();

  const allItems = useMemo(
    () => [...SEED_ITEMS, ...state.custom]
      .filter(i => !state.hidden[i.id])
      .sort((a, b) => a.date.localeCompare(b.date) || kindOrder(a.kind) - kindOrder(b.kind)),
    [state.custom, state.hidden],
  );

  const assignments = allItems.filter(i => i.kind === 'assignment' || i.kind === 'exam');
  const doneCount = assignments.filter(i => state.itemDone[i.id]).length;
  const nextDeadline = assignments.find(i => i.date >= today && !state.itemDone[i.id]);
  const overdue = assignments.filter(i => i.date < today && !state.itemDone[i.id]);
  const urgentOpen = URGENT.filter(u => !state.urgentDone[u.id]).length;

  const visible = allItems.filter(i => {
    if (filter === 'assignment' && i.kind === 'session') return false;
    if (filter === 'session' && i.kind !== 'session') return false;
    if (!showPast && i.date < today) {
      return (i.kind === 'assignment' || i.kind === 'exam') && !state.itemDone[i.id];
    }
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    visible.forEach(i => {
      const d = parseISO(i.date);
      const key = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    });
    return [...map.entries()];
  }, [visible]);

  const toggleUrgent = (id: string) =>
    setState(s => ({ ...s, urgentDone: { ...s.urgentDone, [id]: !s.urgentDone[id] } }));
  const toggleItem = (id: string) =>
    setState(s => ({ ...s, itemDone: { ...s.itemDone, [id]: !s.itemDone[id] } }));
  const removeItem = (item: TimelineItem) =>
    setState(s => item.custom
      ? { ...s, custom: s.custom.filter(c => c.id !== item.id) }
      : { ...s, hidden: { ...s.hidden, [item.id]: true } });
  const restoreHidden = () => setState(s => ({ ...s, hidden: {} }));

  const addCustom = () => {
    if (!newDate || !newLabel.trim()) return;
    const item: TimelineItem = {
      id: `custom_${genId()}`, date: newDate, kind: 'assignment', course: newCourse,
      label: newLabel.trim(), custom: true,
    };
    setState(s => ({ ...s, custom: [...s.custom, item] }));
    setNewLabel('');
  };

  const hiddenCount = Object.values(state.hidden).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl shadow-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{SEMESTER_LABEL}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Open University · updated {AS_OF} · semester ends 31.1.2027</p>
            {nextDeadline && (
              <p className="text-sm mt-2">
                <span className="text-muted-foreground">Next due: </span>
                <span className="font-semibold text-foreground">{COURSES[nextDeadline.course].short} {nextDeadline.label}</span>
                <span className="text-muted-foreground"> · {fmtDM(nextDeadline.date)} ({relLabel(daysUntil(nextDeadline.date))})</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat label="Urgent open" value={urgentOpen} tone={urgentOpen ? 'red' : 'green'} />
            <Stat label="Assignments done" value={`${doneCount}/${assignments.length}`} tone="green" />
            {overdue.length > 0 && <Stat label="Overdue" value={overdue.length} tone="red" />}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-start">
        {/* ── Timeline (main column) ─────────────── */}
        <Section
          icon={<Clock size={16} className="text-primary" />}
          title="Semester Timeline"
          right={
            <div className="flex items-center gap-0.5 bg-muted rounded-xl p-0.5">
              {(['all', 'assignment', 'session'] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-base ${filter === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  {f === 'all' ? 'All' : f === 'assignment' ? 'Assignments' : 'Sessions'}
                </button>
              ))}
            </div>
          }
        >
          {/* Add custom deadline */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Add deadline..."
              className="flex-1 min-w-[120px] px-3 py-1.5 text-sm bg-muted/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
            />
            <select
              value={newCourse}
              onChange={e => setNewCourse(e.target.value as CourseKey)}
              className="px-2 py-1.5 text-xs bg-muted/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {(Object.keys(COURSES) as CourseKey[]).map(k => (
                <option key={k} value={k}>{COURSES[k].short}</option>
              ))}
            </select>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="px-2 py-1.5 text-xs bg-muted/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={addCustom} className="p-1.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base">
              <Plus size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {grouped.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-6">Nothing to show</p>}
            {grouped.map(([month, items]) => (
              <div key={month}>
                <h3 className="text-xs font-bold text-muted-foreground mb-1 pb-1 border-b border-border/60">{month}</h3>
                <div>
                  {items.map(item => {
                    const done = !!state.itemDone[item.id];
                    const n = daysUntil(item.date);
                    const isPast = n < 0;
                    const checkable = item.kind === 'assignment' || item.kind === 'exam';
                    const isOverdue = checkable && isPast && !done;
                    const isToday = n === 0;
                    const isSession = item.kind === 'session';
                    const d = parseISO(item.date);
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-3 px-2 rounded-lg transition-base
                          ${isSession ? 'py-1' : 'py-1.5'}
                          ${item.kind === 'exam' ? 'bg-[hsl(var(--status-red-bg))] my-1 py-2' : isToday ? 'bg-accent/50' : 'hover:bg-muted/30'}
                          ${(done || (isPast && !isOverdue)) ? 'opacity-45' : ''}`}
                      >
                        {/* date */}
                        <div className="w-[68px] shrink-0 flex items-baseline gap-1.5 tabular-nums">
                          <span className={`text-sm ${isSession ? 'text-muted-foreground' : 'font-bold text-foreground'}`}>{fmtDM(item.date)}</span>
                          <span className="text-[11px] text-muted-foreground/60">{DAYS[d.getDay()]}</span>
                        </div>

                        {/* check / icon */}
                        {checkable ? (
                          <button
                            onClick={() => toggleItem(item.id)}
                            title={done ? 'Mark as not submitted' : 'Mark as submitted'}
                            className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-base ${done ? 'bg-[hsl(var(--status-green))] border-transparent text-white' : 'border-border bg-card hover:border-primary'}`}
                          >
                            {done && <Check size={12} strokeWidth={3} />}
                          </button>
                        ) : item.kind === 'milestone' ? (
                          <GraduationCap size={16} className="text-muted-foreground shrink-0" />
                        ) : (
                          <span className="w-[18px] flex justify-center shrink-0"><span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${COURSES[item.course].color})` }} /></span>
                        )}

                        {/* label + course */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isSession ? (
                              <><span className="text-sm text-muted-foreground">{item.label}</span><CourseChip course={item.course} /></>
                            ) : (
                              <>
                                <span className={`text-sm font-semibold text-foreground ${done ? 'line-through' : ''}`}>{item.label}</span>
                                {item.course !== 'other' && item.kind !== 'exam' && <CourseChip course={item.course} />}
                              </>
                            )}
                            {checkable && !done && n >= 0 && n <= 7 && (
                              <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">{relLabel(n)}</span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] font-bold text-[hsl(var(--status-red))] bg-[hsl(var(--status-red-bg))] px-1.5 py-0.5 rounded-md">Overdue</span>
                            )}
                          </div>
                          {item.note && <p className="text-[11px] text-[hsl(40_70%_35%)] mt-0.5">{item.note}</p>}
                        </div>

                        {item.time && <span className="text-[11px] text-muted-foreground/60 tabular-nums shrink-0 hidden sm:inline">{item.time}</span>}
                        <button
                          onClick={() => removeItem(item)}
                          title="Remove"
                          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-0.5 text-muted-foreground/30 hover:text-destructive rounded transition-base shrink-0"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-muted-foreground/60 mt-4">Assignment numbers are not always in date order – this is how they appear in the record. Sessions are numbered from 9.11 onward.</p>
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-border/50 text-xs">
            <button onClick={() => setShowPast(p => !p)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-base">
              {showPast ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {showPast ? 'Hide past items' : 'Show past items'}
            </button>
            {hiddenCount > 0 && (
              <button onClick={restoreHidden} className="text-muted-foreground hover:text-foreground transition-base">
                Restore {hiddenCount} removed
              </button>
            )}
          </div>
        </Section>

        <div className="flex flex-col gap-5">
          {/* ── Urgent ──────────────────────────────────────────── */}
          <Section icon={<AlertTriangle size={16} className="text-[hsl(var(--status-red))]" />} title="Urgent Action Items">
            <div className="divide-y divide-border/50">
              {URGENT.map(u => {
                const done = !!state.urgentDone[u.id];
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUrgent(u.id)}
                    className={`w-full text-left flex items-start gap-3 py-2.5 transition-base ${done ? 'opacity-45' : ''}`}
                  >
                    <span className={`mt-0.5 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 ${done ? 'bg-[hsl(var(--status-green))] border-transparent text-white' : 'border-[hsl(var(--status-red))]/60 bg-card'}`}>
                      {done && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm font-semibold text-foreground ${done ? 'line-through' : ''}`}>{u.title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5 leading-relaxed">{u.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          {/* ── Courses ─────────────────────────────────────────── */}
          <Section icon={<BookOpen size={16} className="text-primary" />} title="Courses">
            <div className="flex flex-col gap-4">
              <CourseTable title="Enrolled" rows={ENROLLED} />
              <CourseTable title='Registration incomplete ("awaiting your action")' rows={PENDING} />
              <CourseTable title="Not registered" rows={NOT_REGISTERED} />
              <p className="text-xs text-muted-foreground">The main page also lists a Price Theory C session on 12.11, 17:00–20:00.</p>
            </div>
          </Section>

          {/* ── Grade improvement ───────────────────────────────── */}
          <Section icon={<CalendarClock size={16} className="text-primary" />} title="Grade Improvement">
            <div className="divide-y divide-border/50">
              {GRADE_IMPROVEMENT.map(g => (
                <div key={g.code} className="flex items-start gap-3 py-2">
                  <span className="text-sm leading-5">{g.status === 'ok' ? '✅' : g.status === 'action' ? '⚠️' : '⏳'}</span>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-foreground">{g.name}</span>
                      <span className="text-[11px] text-muted-foreground/70 tabular-nums">{g.code}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
