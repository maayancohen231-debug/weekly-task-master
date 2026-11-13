import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useReloadOnExternalChange } from '@/lib/useReloadOnExternalChange';
import {
  AlertTriangle, BookOpen, CalendarClock, CalendarDays, Check, ChevronDown, ChevronUp,
  Circle, Clock, Eye, FileText, GraduationCap, ListChecks, Plus, Trash2, Video,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// University Studies — Semester 2027a (Open University)
// Seeded from the semester summary query (as of 8.11.2026).
// User state (checked items, submitted assignments, watched sessions, custom
// items) is kept in localStorage; the seed itself is static so it can be
// updated in code.
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
  psy:  { code: '10136', name: 'Introduction to Psychology', short: 'Psychology', meeting: 'Fri 08:30–11:00', color: '262 45% 58%' },
  pers: { code: '10269', name: 'Personality: Theory and Research', short: 'Personality', meeting: 'Thu 19:15–21:15', color: '330 50% 58%' },
  econ: { code: '10284', name: 'Basic Concepts in Econometrics', short: 'Econometrics', meeting: 'Mon 18:00–21:00', color: '205 60% 48%' },
  isd:  { code: '20436', name: 'Principles of Information Systems Development', short: 'Info Systems', meeting: 'Wed 18:15–20:45', color: '28 75% 52%' },
  stat: { code: '30112', name: 'Introduction to Statistics B', short: 'Statistics', meeting: 'Thu 18:15–20:45', color: '170 45% 38%' },
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

// [D.M (year inferred: Oct–Dec = 2026, Jan = 2027), kind, course, assignment no. / label, note?]
type SeedRow = [string, ItemKind, CourseKey, string?, string?];

const A = 'assignment' as const;
const S = 'session' as const;

const SEED_ROWS: SeedRow[] = [
  // November 2026
  ['8.11', A, 'psy', '04', 'Calendar says 8.11, course home page says 13.11 – check the course site'],
  ['9.11', S, 'econ'],
  ['12.11', S, 'stat'], ['12.11', S, 'pers'],
  ['13.11', S, 'psy'],
  ['15.11', A, 'econ', '03'], ['15.11', A, 'psy', '05'],
  ['16.11', S, 'econ'], ['16.11', A, 'stat', '01'],
  ['18.11', S, 'isd'],
  ['19.11', S, 'stat'], ['19.11', S, 'pers'],
  ['20.11', A, 'isd', '01'],
  ['22.11', A, 'psy', '06'],
  ['23.11', S, 'econ'],
  ['26.11', S, 'stat'],
  ['27.11', S, 'psy'],
  ['28.11', A, 'econ', '02'],
  ['29.11', A, 'psy', '07'],
  // December 2026
  ['1.12', 'exam', 'db', 'Exam – Database Systems (20277)', 'Includes extra time. Make sure you are registered for this exam date!'],
  ['2.12', S, 'isd'],
  ['3.12', S, 'stat'], ['3.12', S, 'pers'],
  ['5.12', A, 'pers', '02'],
  ['6.12', A, 'psy', '08'],
  ['7.12', S, 'econ'],
  ['11.12', S, 'psy'], ['11.12', A, 'isd', '04'],
  ['13.12', A, 'psy', '09'],
  ['14.12', S, 'econ'],
  ['16.12', A, 'stat', '02'],
  ['17.12', S, 'pers'],
  ['18.12', A, 'psy', '01'],
  ['21.12', S, 'econ'],
  ['23.12', S, 'isd'],
  ['24.12', S, 'stat'], ['24.12', A, 'stat', '03'],
  ['25.12', S, 'psy'],
  ['27.12', A, 'psy', '10'],
  ['30.12', A, 'econ', '04'],
  ['31.12', A, 'econ', '07'], ['31.12', S, 'stat'],
  // January 2027
  ['1.1', A, 'isd', '02'],
  ['3.1', A, 'psy', '11'],
  ['4.1', S, 'econ'],
  ['7.1', S, 'stat'], ['7.1', S, 'pers'],
  ['8.1', S, 'psy'],
  ['10.1', A, 'econ', '05'],
  ['13.1', S, 'isd'],
  ['14.1', S, 'stat'], ['14.1', A, 'stat', '04'], ['14.1', S, 'pers'],
  ['15.1', A, 'isd', '05'],
  ['16.1', A, 'pers', '04'],
  ['17.1', A, 'psy', '12'],
  ['22.1', S, 'psy'],
  ['27.1', S, 'isd'],
  ['29.1', S, 'psy'],
  ['30.1', A, 'econ', '06'], ['30.1', A, 'pers', '06'], ['30.1', A, 'stat', '05'],
  ['31.1', A, 'psy', '02'], ['31.1', A, 'isd', '03'],
  ['31.1', 'milestone', 'other', 'End of semester'],
];

function seedDate(dm: string): string {
  const [d, m] = dm.split('.').map(Number);
  const year = m >= 10 ? 2026 : 2027;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Item ids were built from the original Hebrew labels. They are kept exactly as
// before so checkmarks already saved in localStorage still match.
function legacyLabel(kind: ItemKind, value?: string): string {
  if (kind === 'assignment') return `ממ"ן ${value}`;
  if (kind === 'session') return 'מפגש';
  if (kind === 'exam') return 'בחינה – מערכות בסיסי־נתונים (20277)';
  return 'סוף הסמסטר';
}

const SEED_ITEMS: TimelineItem[] = SEED_ROWS.map(([dm, kind, course, value, note]) => {
  const date = seedDate(dm);
  const label = kind === 'assignment' ? `Assignment ${value}` : kind === 'session' ? 'Session' : value ?? '';
  return {
    id: `${date}_${course}_${kind}_${legacyLabel(kind, value)}`,
    date, kind, course, label, note,
    time: kind === 'exam' ? '16:30–20:30' : kind === 'session' ? SESSION_TIME[course] : undefined,
  };
});

// ── Static summary sections ─────────────────────────────────────────────────

const URGENT: { id: string; title: string; detail: string }[] = [
  { id: 'u-db-exam', title: 'Register for the 20277 Database Systems exam', detail: 'The exam is on 1.12.2026, 16:30–20:30 (incl. extra time). The "Alternative assessments" page says you have not registered for an exam date yet.' },
  { id: 'u-deferral', title: 'Check the deferral requests (20436, 10284)', detail: 'Course deferral requests were filed on 5.11 with status "Handled". The courses may have been deferred, even though they still show as "Studying".' },
  { id: 'u-psy-maman', title: 'Confirm the date of Psychology assignment 04', detail: 'The calendar shows 8.11, the course home page shows 13.11 – check the course site.' },
  { id: 'u-pending', title: 'Complete registration – 3 courses "Awaiting your action"', detail: '30112 Introduction to Statistics B, 10523 Ethics in Management, 20551 Introduction to Artificial Intelligence.' },
  { id: 'u-20465', title: 'Systems Programming Lab (20465) – not registered', detail: 'It does not appear in the query at all. If a request was filed, it was probably not received or was sent another way (e.g. by email).' },
];

interface CourseRow { code: string; name: string; meeting: string; warn?: string; course?: CourseKey; }

const ENROLLED: CourseRow[] = [
  { code: '10136', name: 'Introduction to Psychology', meeting: 'Fri 08:30–11:00', course: 'psy' },
  { code: '10269', name: 'Personality: Theory and Research', meeting: 'Thu 19:15–21:15', course: 'pers' },
  { code: '10284', name: 'Basic Concepts in Econometrics', meeting: 'Mon 18:00–21:00', warn: 'Deferral request "Handled"', course: 'econ' },
  { code: '20436', name: 'Principles of Information Systems Development', meeting: 'Wed 18:15–20:45', warn: 'Deferral request "Handled"', course: 'isd' },
];

const PENDING: CourseRow[] = [
  { code: '30112', name: 'Introduction to Statistics B', meeting: 'Thu 18:15–20:45 (on the calendar)', course: 'stat' },
  { code: '10523', name: 'Ethics in Management', meeting: '12.11, 18:00–20:30' },
  { code: '20551', name: 'Introduction to Artificial Intelligence', meeting: '9.11, 18:00–21:00' },
];

const NOT_REGISTERED: CourseRow[] = [
  { code: '20465', name: 'Systems Programming Lab', meeting: '—', warn: 'Not in the query' },
];

const GRADE_IMPROVEMENT: { code: string; name: string; status: 'ok' | 'action' | 'waiting'; text: string }[] = [
  { code: '10627', name: 'Price Theory A', status: 'ok', text: 'Approved (10.9)' },
  { code: '20606', name: 'Programming and Data Analysis in Python', status: 'ok', text: 'Approved (10.9)' },
  { code: '20277', name: 'Database Systems', status: 'action', text: 'Offered in 2026c, registration active. Exam 1.12.2026, 16:30–20:30. Not yet registered for an exam date – register.' },
  { code: '30204', name: 'Statistical Inference', status: 'waiting', text: 'Passed to the Center for Academic Achievement, no final decision yet. Earlier reply: a paid grade improvement can be requested in 2027a.' },
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

// ── UI helpers ──────────────────────────────────────────────────────────────

const isDeliverable = (k: ItemKind) => k === 'assignment' || k === 'exam';

function kindOrder(k: ItemKind): number {
  return k === 'exam' ? 0 : k === 'assignment' ? 1 : k === 'session' ? 2 : 3;
}

function weekStartISO(iso: string): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weekLabel(weekISO: string, thisWeek: string): string {
  const diff = Math.round((parseISO(weekISO).getTime() - parseISO(thisWeek).getTime()) / (7 * 86400000));
  if (diff === 0) return 'This week';
  if (diff === 1) return 'Next week';
  const d = parseISO(weekISO);
  return `Week of ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}

function itemTitle(i: TimelineItem): string {
  if (i.kind === 'session') return i.custom ? i.label : `${COURSES[i.course].short} session`;
  if (i.kind === 'assignment' && !i.custom) return `${COURSES[i.course].short} · ${i.label}`;
  return i.label;
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-card rounded-3xl shadow-card border border-border/40 ${className}`}>{children}</div>;
}

function CardHeader({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-accent text-primary flex items-center justify-center shrink-0">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-foreground leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function Bar({ value, total }: { value: number; total: number }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: 'linear-gradient(90deg, hsl(var(--primary) / 0.75), hsl(var(--primary)))' }}
      />
    </div>
  );
}

function Ring({ value, total, size = 64 }: { value: number; total: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg width={size} height={size} className="-rotate-90 shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth={7} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth={7}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.2,0,0,1)' }}
      />
    </svg>
  );
}

function StatCard({ icon, label, value, total, hint }: { icon: ReactNode; label: string; value: number; total: number; hint?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-card border border-border/50 shadow-sm-custom px-4 py-3.5">
      <div className="relative">
        <Ring value={value} total={total} />
        <span className="absolute inset-0 flex items-center justify-center text-primary">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
          <span className="text-sm text-muted-foreground tabular-nums">of {total}</span>
        </div>
        {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      </div>
    </div>
  );
}

/** The one big, labelled toggle used for both sessions and assignments. */
function DoneToggle({ item, done, onToggle, compact = false }: { item: TimelineItem; done: boolean; onToggle: () => void; compact?: boolean }) {
  const isSession = item.kind === 'session';
  const onText = isSession ? 'Watched' : 'Submitted';
  const offText = isSession ? 'Mark watched' : 'Mark submitted';
  return (
    <button
      onClick={onToggle}
      aria-pressed={done}
      title={done ? `Undo "${onText}"` : offText}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl text-xs transition-base shrink-0 active:scale-[0.97]
        ${compact ? 'h-8 px-2.5' : 'h-9 px-3.5 min-w-[132px]'}
        ${done
          ? 'bg-primary text-primary-foreground shadow-sm-custom hover:opacity-90'
          : 'bg-card text-foreground border border-border hover:border-primary/50 hover:bg-accent/50'}`}
    >
      {done ? <Check size={14} strokeWidth={2.5} /> : isSession ? <Eye size={14} /> : <Circle size={14} />}
      <span>{done ? onText : offText}</span>
    </button>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

type Tab = 'timeline' | 'sessions' | 'admin';
type Filter = 'all' | 'assignment' | 'session';
type NewKind = 'session' | 'assignment';

export function UniversityStudies() {
  const [state, setState] = useState<StudiesState>(loadState);
  const [tab, setTab] = useState<Tab>('timeline');
  const [filter, setFilter] = useState<Filter>('all');
  const [showPast, setShowPast] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newDate, setNewDate] = useState(todayISO());
  const [newLabel, setNewLabel] = useState('');
  const [newCourse, setNewCourse] = useState<CourseKey>('psy');
  const [newKind, setNewKind] = useState<NewKind>('session');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);
  useReloadOnExternalChange(STORAGE_KEY, () => setState(loadState()));

  const today = todayISO();
  const thisWeek = weekStartISO(today);

  const allItems = useMemo(
    () => [...SEED_ITEMS, ...state.custom]
      .filter(i => !state.hidden[i.id])
      .sort((a, b) => a.date.localeCompare(b.date) || kindOrder(a.kind) - kindOrder(b.kind)),
    [state.custom, state.hidden],
  );

  const assignments = allItems.filter(i => isDeliverable(i.kind));
  const sessions = allItems.filter(i => i.kind === 'session');
  const isDone = (i: TimelineItem) => !!state.itemDone[i.id];
  const doneCount = assignments.filter(isDone).length;
  const watchedCount = sessions.filter(isDone).length;
  const sessionsSoFar = sessions.filter(i => i.date <= today).length;
  const nextDeadline = assignments.find(i => i.date >= today && !isDone(i));
  const nextSession = sessions.find(i => i.date >= today);
  const catchUp = allItems.filter(i => i.date < today && (isDeliverable(i.kind) || i.kind === 'session') && !isDone(i));
  const urgentOpen = URGENT.filter(u => !state.urgentDone[u.id]).length;

  const toggleUrgent = (id: string) =>
    setState(s => ({ ...s, urgentDone: { ...s.urgentDone, [id]: !s.urgentDone[id] } }));
  const toggleItem = (id: string) =>
    setState(s => ({ ...s, itemDone: { ...s.itemDone, [id]: !s.itemDone[id] } }));
  const removeItem = (item: TimelineItem) =>
    setState(s => item.custom
      ? { ...s, custom: s.custom.filter(c => c.id !== item.id) }
      : { ...s, hidden: { ...s.hidden, [item.id]: true } });
  const restoreHidden = () => setState(s => ({ ...s, hidden: {} }));

  const addCustom = (opts?: { course?: CourseKey; kind?: NewKind; date?: string; markDone?: boolean }) => {
    const kind = opts?.kind ?? newKind;
    const course = opts?.course ?? newCourse;
    const date = opts?.date ?? newDate;
    const label = newLabel.trim() || (kind === 'session' ? `${COURSES[course].short} session` : '');
    if (!date || !label) return;
    const item: TimelineItem = {
      id: `custom_${genId()}`, date, kind, course, label, custom: true,
      time: kind === 'session' ? SESSION_TIME[course] : undefined,
    };
    setState(s => ({
      ...s,
      custom: [...s.custom, item],
      itemDone: opts?.markDone ? { ...s.itemDone, [item.id]: true } : s.itemDone,
    }));
    setNewLabel('');
    setAdding(false);
  };

  // Timeline: catch-up first, then by week.
  const visible = allItems.filter(i => {
    if (filter === 'assignment' && !(isDeliverable(i.kind) || i.kind === 'milestone')) return false;
    if (filter === 'session' && i.kind !== 'session') return false;
    if (i.date < today) return showPast;
    return true;
  });
  const catchUpVisible = catchUp.filter(i =>
    filter === 'all' || (filter === 'session' ? i.kind === 'session' : i.kind !== 'session'));

  const weeks = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    visible.forEach(i => {
      const k = weekStartISO(i.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(i);
    });
    return [...map.entries()];
  }, [visible]);

  const hiddenCount = Object.values(state.hidden).filter(Boolean).length;
  const nextDays = nextDeadline ? daysUntil(nextDeadline.date) : null;
  const sessionCourses = (Object.keys(COURSES) as CourseKey[]).filter(k => sessions.some(s => s.course === k));

  const renderRow = (item: TimelineItem) => {
    const done = isDone(item);
    const n = daysUntil(item.date);
    const isToday = n === 0;
    const d = parseISO(item.date);
    const checkable = item.kind !== 'milestone';
    const late = n < 0 && !done && checkable;
    return (
      <div
        key={item.id}
        className={`group flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-2 px-3 sm:px-4 py-3 rounded-2xl border transition-base
          ${isToday ? 'bg-accent/50 border-primary/25' : 'bg-card border-border/50 hover:shadow-sm-custom hover:border-border'}`}
      >
        <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 ${isToday ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'}`}>
          <span className="text-base font-semibold leading-none tabular-nums">{d.getDate()}</span>
          <span className={`text-[10px] mt-0.5 ${isToday ? 'opacity-80' : 'text-muted-foreground'}`}>{DAYS[d.getDay()]}</span>
        </div>
        <div className="flex-1 min-w-[150px]">
          <div className="flex items-center gap-2">
            {item.kind === 'session' ? <Video size={14} className="text-muted-foreground shrink-0" />
              : item.kind === 'exam' ? <AlertTriangle size={14} className="text-primary shrink-0" />
              : item.kind === 'milestone' ? <GraduationCap size={14} className="text-muted-foreground shrink-0" />
              : <FileText size={14} className="text-muted-foreground shrink-0" />}
            <span dir="auto" className={`text-sm text-foreground ${item.kind === 'exam' ? 'font-semibold' : ''} ${done ? 'text-muted-foreground line-through decoration-muted-foreground/40' : ''}`}>
              {itemTitle(item)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            <span>{COURSES[item.course].name}</span>
            {item.time && <span className="inline-flex items-center gap-1 tabular-nums"><Clock size={11} />{item.time}</span>}
            {isToday ? <span className="text-primary">Today</span>
              : late ? <span className="text-[hsl(var(--status-red))]">{item.kind === 'session' ? 'Not watched yet' : 'Overdue'} · {relLabel(n)}</span>
              : n > 0 && n <= 7 && !done ? <span>{relLabel(n)}</span> : null}
          </div>
          {item.note && <p className="text-xs text-muted-foreground mt-1.5 pl-3 border-l-2 border-primary/30">{item.note}</p>}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {checkable && <DoneToggle item={item} done={done} onToggle={() => toggleItem(item.id)} />}
          <button
            onClick={() => removeItem(item)}
            title="Remove from the list"
            className="p-2 rounded-xl text-muted-foreground/40 hover:text-destructive hover:bg-muted/60 transition-base [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const addForm = (
    <div className="rounded-2xl bg-muted/40 border border-border/50 p-3 mb-5 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-card rounded-xl p-1 border border-border/50">
        {(['session', 'assignment'] as NewKind[]).map(k => (
          <button
            key={k}
            onClick={() => setNewKind(k)}
            className={`px-3 h-8 text-xs rounded-lg transition-base ${newKind === k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {k === 'session' ? 'Session' : 'Assignment'}
          </button>
        ))}
      </div>
      <input
        type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
        className="h-10 px-3 text-sm bg-card rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <select
        value={newCourse} onChange={e => setNewCourse(e.target.value as CourseKey)}
        className="h-10 px-3 text-sm bg-card rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        {(Object.keys(COURSES) as CourseKey[]).map(k => <option key={k} value={k}>{COURSES[k].short}</option>)}
      </select>
      <input
        type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && addCustom()}
        placeholder={newKind === 'session' ? 'Name (optional), e.g. Recorded lecture 3' : 'e.g. Assignment 13'}
        dir="auto"
        className="flex-1 min-w-[180px] h-10 px-3 text-sm bg-card rounded-xl border border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/50"
      />
      <button onClick={() => addCustom()} className="h-10 px-4 text-sm bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base inline-flex items-center gap-1.5">
        <Plus size={15} /> Add
      </button>
      {newKind === 'session' && (
        <button onClick={() => addCustom({ markDone: true })} className="h-10 px-4 text-sm bg-card border border-border rounded-xl hover:border-primary/50 transition-base inline-flex items-center gap-1.5">
          <Check size={15} /> Add as watched
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── Hero ─────────────────────────────────────────────────── */}
      <Card className="relative overflow-hidden p-5 sm:p-7">
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(circle at 0% 0%, hsl(var(--primary) / 0.10), transparent 55%), radial-gradient(circle at 100% 100%, hsl(var(--primary) / 0.06), transparent 50%)' }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-5 mb-6">
          <div className="flex items-center gap-4">
            <span className="w-14 h-14 rounded-2xl text-primary-foreground flex items-center justify-center shadow-card" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.85), hsl(var(--primary)))' }}>
              <GraduationCap size={26} />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-foreground tracking-tight">{SEMESTER_LABEL}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Open University · ends 31 January 2027 · data as of {AS_OF}</p>
            </div>
          </div>
          {nextDeadline && nextDays !== null && (
            <div className="flex items-center gap-4 rounded-2xl bg-card/90 backdrop-blur border border-border/60 shadow-sm-custom pl-4 pr-5 py-3">
              <div className="w-12 h-12 rounded-xl bg-accent text-primary flex flex-col items-center justify-center">
                {nextDays === 0 ? <span className="text-xs leading-none">Today</span> : (<>
                  <span className="text-lg font-semibold leading-none tabular-nums">{nextDays}</span>
                  <span className="text-[10px] mt-0.5">{nextDays === 1 ? 'day' : 'days'}</span>
                </>)}
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Next deadline</div>
                <div className="text-sm text-foreground mt-0.5" dir="auto">{itemTitle(nextDeadline)}</div>
                <div className="text-xs text-muted-foreground">{fmtDM(nextDeadline.date)} · {DAYS[parseISO(nextDeadline.date).getDay()]}</div>
              </div>
            </div>
          )}
        </div>
        <div className="relative grid gap-3 grid-cols-1 sm:grid-cols-3">
          <StatCard icon={<Video size={18} />} label="Sessions watched" value={watchedCount} total={sessions.length}
            hint={nextSession ? `Next: ${COURSES[nextSession.course].short}, ${fmtDM(nextSession.date)}` : `${sessionsSoFar} held so far`} />
          <StatCard icon={<FileText size={18} />} label="Assignments submitted" value={doneCount} total={assignments.length} />
          <StatCard icon={<ListChecks size={18} />} label="Admin items handled" value={URGENT.length - urgentOpen} total={URGENT.length}
            hint={urgentOpen ? `${urgentOpen} still open` : 'All done'} />
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 bg-card rounded-2xl p-1.5 shadow-sm-custom border border-border/50">
          {([
            ['timeline', 'Timeline', <CalendarDays key="i" size={15} />],
            ['sessions', 'Sessions', <Video key="i" size={15} />],
            ['admin', 'Courses & admin', <BookOpen key="i" size={15} />],
          ] as [Tab, string, ReactNode][]).map(([k, label, icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`inline-flex items-center gap-2 h-10 px-3 sm:px-4 text-sm whitespace-nowrap rounded-xl transition-base ${tab === k ? 'bg-primary text-primary-foreground shadow-sm-custom' : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'}`}
            >
              {icon}
              {k === 'admin' ? (<><span className="hidden sm:inline">{label}</span><span className="sm:hidden">Courses</span></>) : label}
              {k === 'admin' && urgentOpen > 0 && (
                <span className={`text-[11px] tabular-nums px-1.5 rounded-md ${tab === k ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{urgentOpen}</span>
              )}
            </button>
          ))}
        </div>
        {tab !== 'admin' && (
          <button
            onClick={() => setAdding(a => !a)}
            className="inline-flex items-center gap-1.5 h-10 px-4 text-sm rounded-xl bg-card border border-border/60 shadow-sm-custom text-foreground hover:border-primary/50 transition-base"
          >
            <Plus size={15} /> Add a session or assignment
          </button>
        )}
      </div>

      {/* ── Timeline tab ─────────────────────────────────────────── */}
      {tab === 'timeline' && (
        <Card className="p-4 sm:p-6">
          <CardHeader
            icon={<CalendarDays size={18} />}
            title="What's coming up"
            subtitle="Mark each session when you've watched it, and each assignment when it's submitted"
            right={
              <div className="inline-flex items-center gap-1 bg-muted/70 rounded-xl p-1">
                {(['all', 'session', 'assignment'] as Filter[]).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 h-8 text-xs rounded-lg transition-base ${filter === f ? 'bg-card text-foreground shadow-sm-custom' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {f === 'all' ? 'Everything' : f === 'session' ? 'Sessions' : 'Assignments'}
                  </button>
                ))}
              </div>
            }
          />
          {adding && addForm}

          {catchUpVisible.length > 0 && !showPast && (
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2.5 px-1">To catch up · {catchUpVisible.length}</h3>
              <div className="space-y-2">{catchUpVisible.map(renderRow)}</div>
            </div>
          )}

          <div className="flex flex-col gap-6">
            {weeks.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <CalendarDays size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Nothing here</p>
              </div>
            )}
            {weeks.map(([week, items]) => (
              <div key={week}>
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2.5 px-1 flex items-center gap-2">
                  {weekLabel(week, thisWeek)}
                  <span className="flex-1 h-px bg-border/70" />
                  <span className="normal-case tracking-normal tabular-nums">{items.filter(isDone).length}/{items.filter(i => i.kind !== 'milestone').length} done</span>
                </h3>
                <div className="space-y-2">{items.map(renderRow)}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 mt-6 pt-4 border-t border-border/60 text-sm">
            <button onClick={() => setShowPast(p => !p)} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-base">
              {showPast ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              {showPast ? 'Hide past weeks' : 'Show past weeks'}
            </button>
            {hiddenCount > 0 && (
              <button onClick={restoreHidden} className="text-muted-foreground hover:text-foreground transition-base">
                Restore {hiddenCount} removed
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Sessions tab ─────────────────────────────────────────── */}
      {tab === 'sessions' && (
        <div className="flex flex-col gap-4">
          {adding && <Card className="p-4">{addForm}</Card>}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {sessionCourses.map(k => {
              const list = sessions.filter(s => s.course === k);
              const watched = list.filter(isDone).length;
              const c = COURSES[k];
              return (
                <Card key={k} className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.code}{c.meeting ? ` · ${c.meeting}` : ''}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-semibold tabular-nums text-foreground">{watched}<span className="text-sm text-muted-foreground font-normal"> / {list.length}</span></div>
                      <div className="text-[11px] text-muted-foreground">watched</div>
                    </div>
                  </div>
                  <Bar value={watched} total={list.length} />
                  <div className="mt-4 space-y-1.5">
                    {list.map(s => {
                      const done = isDone(s);
                      const n = daysUntil(s.date);
                      return (
                        <div key={s.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-base ${done ? 'bg-accent/40' : n === 0 ? 'bg-accent/60' : 'hover:bg-muted/40'}`}>
                          <span className="w-16 text-sm tabular-nums text-foreground">{DAYS[parseISO(s.date).getDay()]} {fmtDM(s.date)}</span>
                          <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate" dir="auto">
                            {s.custom ? s.label : n === 0 ? 'Today' : n < 0 && !done ? `Not watched yet · ${relLabel(n)}` : n > 0 ? relLabel(n) : ''}
                          </span>
                          <DoneToggle item={s} done={done} onToggle={() => toggleItem(s.id)} compact />
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => { setNewCourse(k); setNewKind('session'); setNewLabel(''); setNewDate(today); setAdding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                    className="mt-3 w-full h-9 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl hover:border-primary/50 transition-base inline-flex items-center justify-center gap-1.5"
                  >
                    <Plus size={13} /> Add an earlier or recorded session
                  </button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Courses & admin tab ──────────────────────────────────── */}
      {tab === 'admin' && (
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 items-start">
          <Card className="p-5 sm:p-6">
            <CardHeader icon={<ListChecks size={18} />} title="Admin to-do" subtitle={urgentOpen ? `${urgentOpen} still open` : 'All handled'} />
            <div className="space-y-2">
              {URGENT.map(u => {
                const done = !!state.urgentDone[u.id];
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUrgent(u.id)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3.5 rounded-2xl border transition-base ${done ? 'bg-muted/30 border-transparent' : 'bg-card border-border/60 hover:border-primary/40 hover:shadow-sm-custom'}`}
                  >
                    <span className={`mt-0.5 w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-base ${done ? 'bg-primary border-transparent text-primary-foreground' : 'border-border bg-card'}`}>
                      {done && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span className="flex-1">
                      <span className={`block text-sm text-foreground ${done ? 'line-through text-muted-foreground' : ''}`}>{u.title}</span>
                      <span className="block text-xs text-muted-foreground mt-1 leading-relaxed">{u.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex flex-col gap-6">
            <Card className="p-5 sm:p-6">
              <CardHeader icon={<BookOpen size={18} />} title="Courses" />
              <div className="flex flex-col gap-5">
                {([['Enrolled & studying', ENROLLED], ['Registration incomplete', PENDING], ['Not registered', NOT_REGISTERED]] as [string, CourseRow[]][]).map(([title, rows]) => (
                  <div key={title}>
                    <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">{title}</h3>
                    <div className="space-y-1.5">
                      {rows.map(r => {
                        const list = r.course ? sessions.filter(s => s.course === r.course) : [];
                        const asg = r.course ? assignments.filter(a => a.course === r.course) : [];
                        return (
                          <div key={r.code} className="px-4 py-3 rounded-2xl bg-muted/35">
                            <div className="flex flex-wrap items-baseline gap-x-3">
                              <span className="text-sm text-foreground flex-1 min-w-[160px]">{r.name}</span>
                              <span className="text-xs text-muted-foreground tabular-nums">{r.code}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1"><Clock size={11} />{r.meeting}</span>
                              {r.warn && <span className="inline-flex items-center gap-1"><AlertTriangle size={11} />{r.warn}</span>}
                              {list.length > 0 && <span className="inline-flex items-center gap-1 tabular-nums"><Video size={11} />{list.filter(isDone).length}/{list.length} watched</span>}
                              {asg.length > 0 && <span className="inline-flex items-center gap-1 tabular-nums"><FileText size={11} />{asg.filter(isDone).length}/{asg.length} submitted</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground px-1">The course home page also lists a Price Theory C session on 12.11, 17:00–20:00.</p>
              </div>
            </Card>

            <Card className="p-5 sm:p-6">
              <CardHeader icon={<CalendarClock size={18} />} title="Grade improvement" />
              <div className="space-y-1.5">
                {GRADE_IMPROVEMENT.map(g => (
                  <div key={g.code} className="px-4 py-3 rounded-2xl bg-muted/35">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground flex-1 min-w-[140px]">{g.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{g.code}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-lg ${g.status === 'ok' ? 'bg-accent text-primary' : g.status === 'action' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {g.status === 'ok' ? 'Approved' : g.status === 'action' ? 'Action needed' : 'Waiting'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.text}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
