import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, BookOpen, CalendarClock, Check, ChevronDown, ChevronUp,
  Clock, Eye, FileText, GraduationCap, Plus, Trash2, Users,
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

const isCheckable = (k: ItemKind) => k === 'assignment' || k === 'exam' || k === 'session';
const isDeliverable = (k: ItemKind) => k === 'assignment' || k === 'exam';

// ── Small UI pieces ─────────────────────────────────────────────────────────

function CourseChip({ course }: { course: CourseKey }) {
  const c = COURSES[course];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{ background: `hsl(${c.color} / 0.12)`, color: `hsl(${c.color})` }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: `hsl(${c.color})` }} />
      {c.short}
    </span>
  );
}

function KindIcon({ kind }: { kind: ItemKind }) {
  if (kind === 'assignment') return <FileText size={14} className="text-primary" />;
  if (kind === 'exam') return <AlertTriangle size={14} className="text-[hsl(var(--status-red))]" />;
  if (kind === 'milestone') return <GraduationCap size={14} className="text-muted-foreground" />;
  return <Users size={14} className="text-muted-foreground/60" />;
}

function Section({ icon, title, subtitle, right, children }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center">{icon}</span>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">{title}</h2>
            {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function ProgressBar({ value, total, color }: { value: number; total: number; color: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatTile({ icon, label, value, total, color, hint }: { icon: ReactNode; label: string; value: number; total?: number; color: string; hint?: string }) {
  return (
    <div className="flex-1 min-w-[150px] rounded-2xl bg-card/80 border border-border/60 px-4 py-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-1">
        {icon}{label}
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <span className="text-2xl font-bold tabular-nums text-foreground">{value}</span>
        {total !== undefined && <span className="text-sm text-muted-foreground tabular-nums">/ {total}</span>}
        {hint && <span className="text-[11px] text-muted-foreground ml-1">{hint}</span>}
      </div>
      {total !== undefined && <ProgressBar value={value} total={total} color={color} />}
    </div>
  );
}

function CourseTable({ rows, title, progress }: { rows: CourseRow[]; title: string; progress?: (k: CourseKey) => { done: number; total: number; watched: number; sessions: number } }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-2">{title}</h3>
      <div className="space-y-1.5">
        {rows.map(r => {
          const color = r.course ? COURSES[r.course].color : '220 10% 60%';
          const p = r.course && progress ? progress(r.course) : null;
          return (
            <div
              key={r.code}
              className="relative overflow-hidden px-3.5 py-2.5 rounded-xl bg-muted/30 border-l-[3px]"
              style={{ borderLeftColor: `hsl(${color})` }}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-foreground flex-1 min-w-[160px]">{r.name}</span>
                <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{r.code}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock size={11} />{r.meeting}</span>
                {r.warn && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--status-yellow))] bg-[hsl(var(--status-yellow-bg))] px-2 py-0.5 rounded-lg">
                    <AlertTriangle size={11} /> {r.warn}
                  </span>
                )}
                {p && (
                  <span className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums">
                    <span className="inline-flex items-center gap-1"><FileText size={11} />{p.done}/{p.total}</span>
                    <span className="inline-flex items-center gap-1"><Eye size={11} />{p.watched}/{p.sessions}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

type Filter = 'all' | 'assignment' | 'session';

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

  const assignments = allItems.filter(i => isDeliverable(i.kind));
  const sessions = allItems.filter(i => i.kind === 'session');
  const doneCount = assignments.filter(i => state.itemDone[i.id]).length;
  const watchedCount = sessions.filter(i => state.itemDone[i.id]).length;
  const sessionsSoFar = sessions.filter(i => i.date <= today).length;
  const nextDeadline = assignments.find(i => i.date >= today && !state.itemDone[i.id]);
  const overdue = assignments.filter(i => i.date < today && !state.itemDone[i.id]);
  const toWatch = sessions.filter(i => i.date < today && !state.itemDone[i.id]);
  const urgentOpen = URGENT.filter(u => !state.urgentDone[u.id]).length;

  const courseProgress = (k: CourseKey) => {
    const a = assignments.filter(i => i.course === k);
    const s = sessions.filter(i => i.course === k);
    return {
      done: a.filter(i => state.itemDone[i.id]).length, total: a.length,
      watched: s.filter(i => state.itemDone[i.id]).length, sessions: s.length,
    };
  };

  const visible = allItems.filter(i => {
    if (filter === 'assignment' && !(isDeliverable(i.kind) || i.kind === 'milestone')) return false;
    if (filter === 'session' && i.kind !== 'session') return false;
    if (!showPast && i.date < today) {
      // keep overdue assignments and sessions not yet watched visible
      return isCheckable(i.kind) && !state.itemDone[i.id];
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
  const nextDays = nextDeadline ? daysUntil(nextDeadline.date) : null;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <div
        className="rounded-2xl shadow-card p-5 sm:p-6"
        style={{ background: 'linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--card)) 70%)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
              <GraduationCap size={22} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">{SEMESTER_LABEL}</h2>
              <p className="text-xs text-muted-foreground">Open University · summary as of {AS_OF} · semester ends 31.1.2027</p>
            </div>
          </div>
          {nextDeadline && nextDays !== null && (
            <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/60 px-4 py-2.5 shadow-sm">
              <div className="text-center">
                <div className="text-xl font-bold text-primary tabular-nums leading-none">{nextDays}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{nextDays === 1 ? 'day' : 'days'}</div>
              </div>
              <div className="w-px self-stretch bg-border" />
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Next deadline</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <CourseChip course={nextDeadline.course} />
                  <span className="text-sm font-semibold text-foreground" dir="auto">{nextDeadline.label}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{fmtDM(nextDeadline.date)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<FileText size={12} />} label="Assignments submitted"
            value={doneCount} total={assignments.length} color="hsl(var(--status-green))"
          />
          <StatTile
            icon={<Eye size={12} />} label="Sessions watched"
            value={watchedCount} total={sessions.length} color="hsl(var(--task-blue))"
            hint={sessionsSoFar ? `${sessionsSoFar} held so far` : undefined}
          />
          <StatTile
            icon={<AlertTriangle size={12} />} label="Urgent items handled"
            value={URGENT.length - urgentOpen} total={URGENT.length} color="hsl(var(--status-yellow))"
          />
          {(overdue.length > 0 || toWatch.length > 0) && (
            <div className="flex-1 min-w-[150px] rounded-2xl bg-[hsl(var(--status-red-bg))] px-4 py-3 text-[hsl(var(--status-red))]">
              <div className="text-[11px] font-medium mb-1">Catch up</div>
              {overdue.length > 0 && <div className="text-sm font-bold">{overdue.length} overdue assignment{overdue.length === 1 ? '' : 's'}</div>}
              {toWatch.length > 0 && <div className="text-sm font-bold">{toWatch.length} session{toWatch.length === 1 ? '' : 's'} to watch</div>}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
        <div className="flex flex-col gap-6">
          {/* ── Urgent ──────────────────────────────────────────── */}
          <Section
            icon={<AlertTriangle size={16} className="text-[hsl(var(--status-red))]" />}
            title="Urgent Action Items"
            subtitle={urgentOpen ? `${urgentOpen} still open` : 'All handled'}
          >
            <div className="space-y-2">
              {URGENT.map(u => {
                const done = !!state.urgentDone[u.id];
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUrgent(u.id)}
                    className={`w-full text-left flex items-start gap-3 px-3.5 py-3 rounded-xl border transition-base ${done ? 'bg-muted/30 border-transparent opacity-60' : 'bg-[hsl(var(--status-red-bg))] border-[hsl(var(--status-red))]/15 hover:border-[hsl(var(--status-red))]/35'}`}
                  >
                    <span className={`mt-0.5 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center shrink-0 transition-base ${done ? 'bg-[hsl(var(--status-green))] border-transparent text-white' : 'border-[hsl(var(--status-red))]/50 bg-card'}`}>
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
            <div className="flex flex-col gap-5">
              <CourseTable title="Enrolled & studying" rows={ENROLLED} progress={courseProgress} />
              <CourseTable title='Registration incomplete ("Awaiting your action")' rows={PENDING} progress={courseProgress} />
              <CourseTable title="Not registered" rows={NOT_REGISTERED} />
              <p className="text-xs text-muted-foreground">The course home page also lists a Price Theory C session on 12.11, 17:00–20:00.</p>
            </div>
          </Section>

          {/* ── Grade improvement ───────────────────────────────── */}
          <Section icon={<CalendarClock size={16} className="text-primary" />} title="Grade Improvement">
            <div className="space-y-1.5">
              {GRADE_IMPROVEMENT.map(g => {
                const tone = g.status === 'ok'
                  ? { cls: 'bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]', text: 'Approved' }
                  : g.status === 'action'
                    ? { cls: 'bg-[hsl(var(--status-yellow-bg))] text-[hsl(var(--status-yellow))]', text: 'Action needed' }
                    : { cls: 'bg-muted text-muted-foreground', text: 'Waiting' };
                return (
                  <div key={g.code} className="px-3.5 py-2.5 rounded-xl bg-muted/30">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground flex-1 min-w-[140px]">{g.name}</span>
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{g.code}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${tone.cls}`}>{tone.text}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{g.text}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        </div>

        {/* ── Timeline ──────────────────────────────────────────── */}
        <Section
          icon={<Clock size={16} className="text-primary" />}
          title="Semester Timeline"
          subtitle="Tick an assignment when submitted, a session when watched"
          right={
            <div className="flex items-center gap-1 bg-muted rounded-xl p-0.5">
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
          <div className="flex flex-wrap gap-2 mb-4 p-2 rounded-xl bg-muted/40">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="px-2 py-1.5 text-xs bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={newCourse}
              onChange={e => setNewCourse(e.target.value as CourseKey)}
              className="px-2 py-1.5 text-xs bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {(Object.keys(COURSES) as CourseKey[]).map(k => (
                <option key={k} value={k}>{COURSES[k].short}</option>
              ))}
            </select>
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Add a deadline..."
              dir="auto"
              className="flex-1 min-w-[120px] px-3 py-1.5 text-xs bg-card rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
            />
            <button onClick={addCustom} title="Add" className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-base">
              <Plus size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-5">
            {grouped.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-6">Nothing to show</p>}
            {grouped.map(([month, items]) => (
              <div key={month}>
                <h3 className="sticky top-0 z-[1] text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5 py-1 bg-card">{month}</h3>
                <div className="space-y-1">
                  {items.map(item => {
                    const done = !!state.itemDone[item.id];
                    const n = daysUntil(item.date);
                    const isPast = n < 0;
                    const checkable = isCheckable(item.kind);
                    const isSession = item.kind === 'session';
                    const isOverdue = isDeliverable(item.kind) && isPast && !done;
                    const notWatched = isSession && isPast && !done;
                    const isToday = n === 0;
                    const d = parseISO(item.date);
                    const color = COURSES[item.course].color;
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-3 pl-0 pr-2.5 py-1.5 rounded-xl border transition-base
                          ${item.kind === 'exam' ? 'bg-[hsl(var(--status-red-bg))] border-[hsl(var(--status-red))]/20'
                            : isToday ? 'bg-accent/60 border-primary/20'
                            : 'border-transparent hover:bg-muted/30 hover:border-border/60'}
                          ${done ? 'opacity-55' : ''}`}
                      >
                        <span className="self-stretch w-[3px] rounded-full shrink-0" style={{ background: `hsl(${color} / ${isSession ? 0.35 : 0.9})` }} />
                        <div className="w-10 shrink-0 text-center leading-tight">
                          <div className="text-sm font-bold text-foreground tabular-nums">{d.getDate()}</div>
                          <div className="text-[10px] text-muted-foreground/70">{DAYS[d.getDay()]}</div>
                        </div>
                        {checkable ? (
                          <button
                            onClick={() => toggleItem(item.id)}
                            title={isSession
                              ? (done ? 'Mark as not watched' : 'Mark as watched')
                              : (done ? 'Mark as not submitted' : 'Mark as submitted')}
                            className={`w-[18px] h-[18px] border-2 flex items-center justify-center shrink-0 transition-base
                              ${isSession ? 'rounded-full' : 'rounded-md'}
                              ${done
                                ? `${isSession ? 'bg-[hsl(var(--task-blue))]' : 'bg-[hsl(var(--status-green))]'} border-transparent text-white`
                                : 'border-border bg-card hover:border-primary'}`}
                          >
                            {done && (isSession ? <Eye size={10} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />)}
                          </button>
                        ) : (
                          <span className="w-[18px] h-[18px] flex items-center justify-center shrink-0"><KindIcon kind={item.kind} /></span>
                        )}
                        <CourseChip course={item.course} />
                        <div className="flex-1 min-w-0">
                          <span dir="auto" className={`text-sm ${isSession ? 'text-muted-foreground' : 'font-semibold text-foreground'} ${done ? 'line-through' : ''}`}>
                            {item.label}
                          </span>
                          {isSession && done && <span className="ml-2 text-[10px] font-semibold text-[hsl(var(--task-blue))]">Watched</span>}
                          {item.note && <span className="block text-[11px] text-[hsl(var(--status-yellow))]">{item.note}</span>}
                        </div>
                        {item.time && <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0 hidden sm:inline">{item.time}</span>}
                        {isDeliverable(item.kind) && !done && n >= 0 && n <= 7 && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">{relLabel(n)}</span>
                        )}
                        {isOverdue && (
                          <span className="text-[10px] font-bold text-[hsl(var(--status-red))] bg-[hsl(var(--status-red-bg))] px-1.5 py-0.5 rounded-md shrink-0">Overdue</span>
                        )}
                        {notWatched && (
                          <span className="text-[10px] font-bold text-[hsl(var(--task-blue))] bg-[hsl(var(--task-blue-bg))] px-1.5 py-0.5 rounded-md shrink-0">To watch</span>
                        )}
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

          <p className="text-[11px] text-muted-foreground/70 mt-4">Assignment numbers don't always follow date order – this is how they appear in the query.</p>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs">
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
      </div>
    </div>
  );
}

function kindOrder(k: ItemKind): number {
  return k === 'exam' ? 0 : k === 'assignment' ? 1 : k === 'session' ? 2 : 3;
}
