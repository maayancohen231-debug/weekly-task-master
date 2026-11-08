import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle, BookOpen, CalendarClock, Check, ChevronDown, ChevronUp,
  Clock, FileText, GraduationCap, Plus, Trash2, Users,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// University Studies — Semester 2027a (Open University)
// Seeded from the "סמסטר 2027א – סיכום משאילתא" summary (as of 8.11.2026).
// User state (checked items, done assignments, custom items) is kept in
// localStorage; the seed itself is static so it can be updated in code.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'university-studies-2027a';
const SEMESTER_LABEL = 'סמסטר 2027א';
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
  psy:  { code: '10136', name: 'מבוא לפסיכולוגיה', short: 'פסיכולוגיה', meeting: 'שישי 08:30–11:00', color: '262 45% 58%' },
  pers: { code: '10269', name: 'אישיות: תאוריה ומחקר', short: 'אישיות', meeting: 'חמישי 19:15–21:15', color: '330 50% 58%' },
  econ: { code: '10284', name: 'מושגי יסוד באקונומטריקה', short: 'אקונומטריקה', meeting: 'שני 18:00–21:00', color: '205 60% 48%' },
  isd:  { code: '20436', name: 'עקרונות פיתוח מערכות מידע', short: 'עפמ"מ', meeting: 'רביעי 18:15–20:45', color: '28 75% 52%' },
  stat: { code: '30112', name: 'מבוא לסטטיסטיקה ב', short: 'סטטיסטיקה', meeting: 'חמישי 18:15–20:45', color: '170 45% 38%' },
  db:   { code: '20277', name: 'מערכות בסיסי־נתונים', short: 'בסיסי נתונים', color: '0 55% 52%' },
  other:{ code: '', name: 'אחר', short: 'אחר', color: '220 10% 50%' },
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
  ['8.11', A, 'psy', 'ממ"ן 04', 'בלוח 8.11, בעמוד הראשי 13.11 – לבדוק באתר הקורס'],
  ['9.11', S, 'econ', 'מפגש'],
  ['12.11', S, 'stat', 'מפגש'], ['12.11', S, 'pers', 'מפגש'],
  ['13.11', S, 'psy', 'מפגש'],
  ['15.11', A, 'econ', 'ממ"ן 03'], ['15.11', A, 'psy', 'ממ"ן 05'],
  ['16.11', S, 'econ', 'מפגש'], ['16.11', A, 'stat', 'ממ"ן 01'],
  ['18.11', S, 'isd', 'מפגש'],
  ['19.11', S, 'stat', 'מפגש'], ['19.11', S, 'pers', 'מפגש'],
  ['20.11', A, 'isd', 'ממ"ן 01'],
  ['22.11', A, 'psy', 'ממ"ן 06'],
  ['23.11', S, 'econ', 'מפגש'],
  ['26.11', S, 'stat', 'מפגש'],
  ['27.11', S, 'psy', 'מפגש'],
  ['28.11', A, 'econ', 'ממ"ן 02'],
  ['29.11', A, 'psy', 'ממ"ן 07'],
  // December 2026
  ['1.12', 'exam', 'db', 'בחינה – מערכות בסיסי־נתונים (20277)', 'כולל תוספת זמן. לוודא הרשמה למועד!'],
  ['2.12', S, 'isd', 'מפגש'],
  ['3.12', S, 'stat', 'מפגש'], ['3.12', S, 'pers', 'מפגש'],
  ['5.12', A, 'pers', 'ממ"ן 02'],
  ['6.12', A, 'psy', 'ממ"ן 08'],
  ['7.12', S, 'econ', 'מפגש'],
  ['11.12', S, 'psy', 'מפגש'], ['11.12', A, 'isd', 'ממ"ן 04'],
  ['13.12', A, 'psy', 'ממ"ן 09'],
  ['14.12', S, 'econ', 'מפגש'],
  ['16.12', A, 'stat', 'ממ"ן 02'],
  ['17.12', S, 'pers', 'מפגש'],
  ['18.12', A, 'psy', 'ממ"ן 01'],
  ['21.12', S, 'econ', 'מפגש'],
  ['23.12', S, 'isd', 'מפגש'],
  ['24.12', S, 'stat', 'מפגש'], ['24.12', A, 'stat', 'ממ"ן 03'],
  ['25.12', S, 'psy', 'מפגש'],
  ['27.12', A, 'psy', 'ממ"ן 10'],
  ['30.12', A, 'econ', 'ממ"ן 04'],
  ['31.12', A, 'econ', 'ממ"ן 07'], ['31.12', S, 'stat', 'מפגש'],
  // January 2027
  ['1.1', A, 'isd', 'ממ"ן 02'],
  ['3.1', A, 'psy', 'ממ"ן 11'],
  ['4.1', S, 'econ', 'מפגש'],
  ['7.1', S, 'stat', 'מפגש'], ['7.1', S, 'pers', 'מפגש'],
  ['8.1', S, 'psy', 'מפגש'],
  ['10.1', A, 'econ', 'ממ"ן 05'],
  ['13.1', S, 'isd', 'מפגש'],
  ['14.1', S, 'stat', 'מפגש'], ['14.1', A, 'stat', 'ממ"ן 04'], ['14.1', S, 'pers', 'מפגש'],
  ['15.1', A, 'isd', 'ממ"ן 05'],
  ['16.1', A, 'pers', 'ממ"ן 04'],
  ['17.1', A, 'psy', 'ממ"ן 12'],
  ['22.1', S, 'psy', 'מפגש'],
  ['27.1', S, 'isd', 'מפגש'],
  ['29.1', S, 'psy', 'מפגש'],
  ['30.1', A, 'econ', 'ממ"ן 06'], ['30.1', A, 'pers', 'ממ"ן 06'], ['30.1', A, 'stat', 'ממ"ן 05'],
  ['31.1', A, 'psy', 'ממ"ן 02'], ['31.1', A, 'isd', 'ממ"ן 03'],
  ['31.1', 'milestone', 'other', 'סוף הסמסטר'],
];

function seedDate(dm: string): string {
  const [d, m] = dm.split('.').map(Number);
  const year = m >= 10 ? 2026 : 2027;
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const SEED_ITEMS: TimelineItem[] = SEED_ROWS.map(([dm, kind, course, label, note]) => {
  const date = seedDate(dm);
  return {
    id: `${date}_${course}_${kind}_${label}`,
    date, kind, course, label, note,
    time: kind === 'exam' ? '16:30–20:30' : kind === 'session' ? SESSION_TIME[course] : undefined,
  };
});

// ── Static summary sections ─────────────────────────────────────────────────

const URGENT: { id: string; title: string; detail: string }[] = [
  { id: 'u-db-exam', title: 'להירשם לבחינה ב־20277 מערכות בסיסי־נתונים', detail: 'הבחינה ב־1.12.2026, 16:30–20:30 (כולל תוספת זמן). בעמוד "הערכות חלופיות" כתוב "טרם נרשמת למועד הבחינה".' },
  { id: 'u-deferral', title: 'לבדוק את בקשות הדחייה (20436, 10284)', detail: 'ב־5.11 הוגשו בקשות "דחיית קורס", סטטוס "טופל". ייתכן שהקורסים נדחו, אף שהם מופיעים כ"בלימוד".' },
  { id: 'u-psy-maman', title: 'לברר תאריך ממ"ן 04 בפסיכולוגיה', detail: 'בלוח מופיע 8.11, בעמוד הראשי 13.11 – לבדוק באתר הקורס.' },
  { id: 'u-pending', title: 'להשלים הרשמה – 3 קורסים "ממתין לטיפולך"', detail: '30112 מבוא לסטטיסטיקה ב, 10523 מוסר בניהול, 20551 מבוא לבינה מלאכותית.' },
  { id: 'u-20465', title: 'מעבדה בתכנות מערכות (20465) – לא רשומה', detail: 'לא מופיעה בשאילתא בכלל. אם הוגשה בקשה – כנראה לא נקלטה או נשלחה בערוץ אחר (למשל מייל).' },
];

interface CourseRow { code: string; name: string; meeting: string; warn?: string; }

const ENROLLED: CourseRow[] = [
  { code: '10136', name: 'מבוא לפסיכולוגיה', meeting: 'שישי 08:30–11:00' },
  { code: '10269', name: 'אישיות: תאוריה ומחקר', meeting: 'חמישי 19:15–21:15' },
  { code: '10284', name: 'מושגי יסוד באקונומטריקה', meeting: 'שני 18:00–21:00', warn: 'בקשת דחייה בסטטוס "טופל"' },
  { code: '20436', name: 'עקרונות פיתוח מערכות מידע (עפמ"מ)', meeting: 'רביעי 18:15–20:45', warn: 'בקשת דחייה בסטטוס "טופל"' },
];

const PENDING: CourseRow[] = [
  { code: '30112', name: 'מבוא לסטטיסטיקה ב', meeting: 'חמישי 18:15–20:45 (מופיע בלוח)' },
  { code: '10523', name: 'מוסר בניהול', meeting: '12.11, 18:00–20:30' },
  { code: '20551', name: 'מבוא לבינה מלאכותית', meeting: '9.11, 18:00–21:00' },
];

const NOT_REGISTERED: CourseRow[] = [
  { code: '20465', name: 'מעבדה בתכנות מערכות', meeting: '—', warn: 'לא מופיעה בשאילתא' },
];

const GRADE_IMPROVEMENT: { code: string; name: string; status: 'ok' | 'action' | 'waiting'; text: string }[] = [
  { code: '10627', name: 'תורת המחירים א', status: 'ok', text: 'אושר (10.9)' },
  { code: '20606', name: 'תכנות וניתוח נתונים בפייתון', status: 'ok', text: 'אושר (10.9)' },
  { code: '20277', name: 'מערכות בסיסי־נתונים', status: 'action', text: 'מוצע ב־2026ג, הרשמה פעילה. בחינה 1.12.2026, 16:30–20:30. "טרם נרשמת למועד הבחינה" – להירשם' },
  { code: '30204', name: 'הסקה סטטיסטית', status: 'waiting', text: 'הועבר למרכז להישגים לימודיים, אין החלטה סופית. בפנייה קודמת: אפשר לבקש שיפור ציון בתשלום ב־2027א' },
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

const HE_DAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
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
      dir="rtl"
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold whitespace-nowrap"
      style={{ background: `hsl(${c.color} / 0.12)`, color: `hsl(${c.color})` }}
    >
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

function Section({ icon, title, right, children }: { icon: ReactNode; title: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card rounded-2xl shadow-card p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          {icon}
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
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
      <h3 className="text-xs font-semibold text-muted-foreground mb-2" dir="rtl">{title}</h3>
      <div className="space-y-1" dir="rtl">
        {rows.map(r => (
          <div key={r.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-muted/30">
            <span className="text-xs font-mono text-muted-foreground tabular-nums">{r.code}</span>
            <span className="text-sm font-medium text-foreground flex-1 min-w-[140px]">{r.name}</span>
            <span className="text-xs text-muted-foreground">{r.meeting}</span>
            {r.warn && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[hsl(var(--status-yellow))] bg-[hsl(var(--status-yellow-bg))] px-2 py-0.5 rounded-lg">
                <AlertTriangle size={11} /> {r.warn}
              </span>
            )}
          </div>
        ))}
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

  const assignments = allItems.filter(i => i.kind === 'assignment' || i.kind === 'exam');
  const doneCount = assignments.filter(i => state.itemDone[i.id]).length;
  const nextDeadline = assignments.find(i => i.date >= today && !state.itemDone[i.id]);
  const overdue = assignments.filter(i => i.date < today && !state.itemDone[i.id]);
  const urgentOpen = URGENT.filter(u => !state.urgentDone[u.id]).length;

  const visible = allItems.filter(i => {
    if (filter === 'assignment' && !(i.kind === 'assignment' || i.kind === 'exam' || i.kind === 'milestone')) return false;
    if (filter === 'session' && i.kind !== 'session') return false;
    if (!showPast && i.date < today) {
      // keep overdue, unfinished assignments visible
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
    <div className="flex flex-col gap-6">
      {/* ── Overview ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl shadow-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap size={20} className="text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">University Studies · <span dir="rtl">{SEMESTER_LABEL}</span></h2>
              <p className="text-xs text-muted-foreground">Open University · summary as of {AS_OF} · semester ends 31.1.2027</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat label="Urgent open" value={urgentOpen} tone={urgentOpen ? 'red' : 'green'} />
            <Stat label="Assignments done" value={`${doneCount}/${assignments.length}`} tone="green" />
            {overdue.length > 0 && <Stat label="Overdue" value={overdue.length} tone="red" />}
            {nextDeadline && (
              <div className="px-3 py-1.5 rounded-xl bg-accent text-accent-foreground text-xs">
                <span className="opacity-70">Next: </span>
                <span className="font-semibold" dir="rtl">{COURSES[nextDeadline.course].short} {nextDeadline.label}</span>
                <span className="opacity-70"> · {fmtDM(nextDeadline.date)} ({relLabel(daysUntil(nextDeadline.date))})</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
        <div className="flex flex-col gap-6">
          {/* ── Urgent ──────────────────────────────────────────── */}
          <Section icon={<AlertTriangle size={16} className="text-[hsl(var(--status-red))]" />} title="Urgent Action Items">
            <div className="space-y-2" dir="rtl">
              {URGENT.map(u => {
                const done = !!state.urgentDone[u.id];
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUrgent(u.id)}
                    className={`w-full text-right flex items-start gap-3 px-3 py-2.5 rounded-xl transition-base ${done ? 'bg-muted/30 opacity-60' : 'bg-[hsl(var(--status-red-bg))] hover:brightness-[0.98]'}`}
                  >
                    <span className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${done ? 'bg-[hsl(var(--status-green))] border-transparent text-white' : 'border-[hsl(var(--status-red))]/50 bg-card'}`}>
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
              <CourseTable title="רשומה ובלימוד" rows={ENROLLED} />
              <CourseTable title='הרשמה לא הושלמה ("ממתין לטיפולך")' rows={PENDING} />
              <CourseTable title="לא רשומה" rows={NOT_REGISTERED} />
              <p className="text-xs text-muted-foreground" dir="rtl">בעמוד הראשי מופיע גם מפגש בתורת המחירים ג ב־12.11, 17:00–20:00.</p>
            </div>
          </Section>

          {/* ── Grade improvement ───────────────────────────────── */}
          <Section icon={<CalendarClock size={16} className="text-primary" />} title="Grade Improvement">
            <div className="space-y-1" dir="rtl">
              {GRADE_IMPROVEMENT.map(g => (
                <div key={g.code} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-muted/30">
                  <span className="text-base leading-5">{g.status === 'ok' ? '✅' : g.status === 'action' ? '⚠️' : '⏳'}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">{g.code}</span>
                      <span className="text-sm font-medium text-foreground">{g.name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{g.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Timeline ──────────────────────────────────────────── */}
        <Section
          icon={<Clock size={16} className="text-primary" />}
          title="Semester Timeline"
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
          <p className="text-[11px] text-muted-foreground/70 mb-3" dir="rtl">המספור של הממ"נים לא תמיד עוקב לפי התאריכים – כך זה מופיע בשאילתא.</p>

          {/* Add custom deadline */}
          <div className="flex flex-wrap gap-2 mb-4">
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="px-2 py-1.5 text-xs bg-muted/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={newCourse}
              onChange={e => setNewCourse(e.target.value as CourseKey)}
              className="px-2 py-1.5 text-xs bg-muted/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              dir="rtl"
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
              placeholder="Add deadline..."
              dir="auto"
              className="flex-1 min-w-[120px] px-3 py-1.5 text-xs bg-muted/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
            />
            <button onClick={addCustom} className="p-1.5 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base">
              <Plus size={14} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {grouped.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-6">Nothing to show</p>}
            {grouped.map(([month, items]) => (
              <div key={month}>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground/70 mb-1.5">{month}</h3>
                <div className="space-y-0.5">
                  {items.map(item => {
                    const done = !!state.itemDone[item.id];
                    const n = daysUntil(item.date);
                    const isPast = n < 0;
                    const checkable = item.kind === 'assignment' || item.kind === 'exam';
                    const isOverdue = checkable && isPast && !done;
                    const isToday = n === 0;
                    const d = parseISO(item.date);
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-base
                          ${item.kind === 'exam' ? 'bg-[hsl(var(--status-red-bg))]' : isToday ? 'bg-accent/60' : 'hover:bg-muted/30'}
                          ${(done || (isPast && !isOverdue)) ? 'opacity-50' : ''}`}
                      >
                        <div className="w-14 shrink-0 text-xs tabular-nums">
                          <span className="font-bold text-foreground">{fmtDM(item.date)}</span>
                          <span className="text-muted-foreground/60 ml-1" dir="rtl">{HE_DAYS[d.getDay()]}</span>
                        </div>
                        {checkable ? (
                          <button
                            onClick={() => toggleItem(item.id)}
                            title={done ? 'Mark as not submitted' : 'Mark as submitted'}
                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-base ${done ? 'bg-[hsl(var(--status-green))] border-transparent text-white' : 'border-border bg-card hover:border-primary'}`}
                          >
                            {done && <Check size={12} strokeWidth={3} />}
                          </button>
                        ) : (
                          <span className="w-4 h-4 flex items-center justify-center shrink-0"><KindIcon kind={item.kind} /></span>
                        )}
                        <CourseChip course={item.course} />
                        <div className="flex-1 min-w-0" dir="rtl">
                          <span className={`text-sm ${item.kind === 'session' ? 'text-muted-foreground' : 'font-medium text-foreground'} ${done ? 'line-through' : ''}`}>
                            {item.label}
                          </span>
                          {item.note && <span className="block text-[11px] text-[hsl(var(--status-yellow))]">{item.note}</span>}
                        </div>
                        {item.time && <span className="text-[11px] text-muted-foreground/70 tabular-nums shrink-0 hidden sm:inline">{item.time}</span>}
                        {checkable && !done && n >= 0 && n <= 7 && (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md shrink-0">{relLabel(n)}</span>
                        )}
                        {isOverdue && (
                          <span className="text-[10px] font-bold text-[hsl(var(--status-red))] bg-[hsl(var(--status-red-bg))] px-1.5 py-0.5 rounded-md shrink-0">Overdue</span>
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

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50 text-xs">
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

function Stat({ label, value, tone }: { label: string; value: number | string; tone: 'red' | 'green' }) {
  const cls = tone === 'red'
    ? 'bg-[hsl(var(--status-red-bg))] text-[hsl(var(--status-red))]'
    : 'bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]';
  return (
    <div className={`px-3 py-1.5 rounded-xl text-xs ${cls}`}>
      <span className="font-bold tabular-nums">{value}</span>
      <span className="opacity-80 ml-1">{label}</span>
    </div>
  );
}
