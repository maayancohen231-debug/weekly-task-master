import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChartGantt, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  GANTT_COLORS, GANTT_SEED,
  type GanttBar, type GanttData, type GanttYear,
} from '@/lib/goalsGanttSeed';

const STORAGE_KEY = 'goals-gantt-v1';
const YEAR_KEY = 'goals-gantt-year';
const GREG = ['ספט', 'אוק', 'נוב', 'דצמ', 'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג'];

function load(): GanttData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as GanttData;
      if (d?.version === 1 && Array.isArray(d.years)) return d;
    }
  } catch { /* ignore */ }
  return structuredClone(GANTT_SEED);
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

/** Month index (0 = Sep) of today inside this school year, or -1. */
function currentMonthIndex(year: GanttYear, now = new Date()): number {
  const idx = (now.getFullYear() - year.startYear) * 12 + now.getMonth() - 8;
  return idx >= 0 && idx < 12 ? idx : -1;
}

function gregLabel(year: GanttYear, i: number): string {
  const y = year.startYear + (i >= 4 ? 1 : 0);
  return `${GREG[i]} ${String(y).slice(2)}`;
}

/** First-fit packing of an area's bars into lanes, keeping her order for ties. */
function packLanes(bars: GanttBar[]): { bar: GanttBar; lane: number }[] {
  const sorted = bars.map((bar, i) => ({ bar, i })).sort((a, b) => a.bar.start - b.bar.start || a.i - b.i);
  const laneEnds: number[] = [];
  return sorted.map(({ bar }) => {
    let lane = laneEnds.findIndex(end => end < bar.start);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(bar.end); } else laneEnds[lane] = bar.end;
    return { bar, lane };
  });
}

type Draft = { id: string | null; areaId: string; label: string; start: number; end: number };

interface Props { onBack: () => void; }

export function GoalsGantt({ onBack }: Props) {
  const [data, setData] = useState<GanttData>(load);
  const [yearId, setYearId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(YEAR_KEY);
      if (saved) return saved;
    } catch { /* ignore */ }
    const d = load();
    return (d.years.find(y => currentMonthIndex(y) !== -1) ?? d.years[d.years.length - 1]).id;
  });
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);
  useEffect(() => {
    try { localStorage.setItem(YEAR_KEY, yearId); } catch { /* ignore */ }
  }, [yearId]);
  useEffect(() => {
    if (!draft) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDraft(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft]);

  const year = data.years.find(y => y.id === yearId) ?? data.years[0];
  const nowIdx = currentMonthIndex(year);

  // Grid rows: header (1) then each area's lanes.
  const layout = useMemo(() => {
    let row = 2;
    return year.areas.map(area => {
      const placed = packLanes(year.bars.filter(b => b.areaId === area.id));
      const lanes = Math.max(1, ...placed.map(p => p.lane + 1));
      const block = { area, placed, firstRow: row, lanes };
      row += lanes;
      return block;
    });
  }, [year]);

  const updateYear = (fn: (y: GanttYear) => GanttYear) =>
    setData(d => ({ ...d, years: d.years.map(y => (y.id === year.id ? fn(y) : y)) }));

  const saveDraft = () => {
    if (!draft || !draft.label.trim()) return;
    const start = Math.min(draft.start, draft.end);
    const end = Math.max(draft.start, draft.end);
    const bar: GanttBar = { id: draft.id ?? genId(), areaId: draft.areaId, label: draft.label.trim(), start, end };
    updateYear(y => ({
      ...y,
      bars: draft.id ? y.bars.map(b => (b.id === draft.id ? bar : b)) : [...y.bars, bar],
    }));
    setDraft(null);
  };

  const deleteDraft = () => {
    if (!draft?.id) return;
    updateYear(y => ({ ...y, bars: y.bars.filter(b => b.id !== draft.id) }));
    setDraft(null);
  };

  const resetToFile = () => {
    if (!confirm('לחזור ללוח המקורי מהאקסל? שינויים שעשית כאן יימחקו.')) return;
    setData(structuredClone(GANTT_SEED));
  };

  return (
    <div dir="rtl" className="min-h-screen app-bg text-foreground font-sans flex flex-col">
      <div className="h-1 w-full shrink-0" style={{ background: 'hsl(340 60% 80%)' }} />

      <header className="bg-card shadow-card px-4 sm:px-6 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-base text-sm"
          >
            <ArrowRight size={16} />
            <span>חזרה ליומן</span>
          </button>
          <div className="flex items-center gap-2">
            <ChartGantt size={20} className="text-primary" />
            <h1 className="text-lg font-bold tracking-tight">גאנט · לוח מטרות</h1>
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 ms-auto">
            {data.years.map(y => (
              <button
                key={y.id}
                onClick={() => setYearId(y.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-base ${
                  y.id === year.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {y.title}
              </button>
            ))}
          </div>
          <button
            onClick={resetToFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
            title="חזרה ללוח המקורי מהאקסל"
          >
            <RotateCcw size={13} />
            <span>לוח מקורי</span>
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-xl font-bold">לוח מטרות {year.title}</h2>
          <span className="text-sm text-muted-foreground">
            ספטמבר {year.startYear} – אוגוסט {year.startYear + 1} · לחיצה על פס לעריכה
          </span>
        </div>

        <div className="bg-card rounded-2xl shadow-card overflow-x-auto">
          <div
            className="grid min-w-[1050px] [--lbl:118px] sm:[--lbl:190px]"
            style={{
              gridTemplateColumns: 'var(--lbl) repeat(12, minmax(78px, 1fr))',
              gridTemplateRows: `auto repeat(${layout.reduce((s, a) => s + a.lanes, 0)}, minmax(46px, auto))`,
            }}
          >
            {/* Header */}
            <div className="sticky right-0 z-20 bg-[#1E395F] text-white px-4 py-2 text-sm font-bold flex items-center" style={{ gridRow: 1, gridColumn: 1 }}>
              תחום
            </div>
            {year.hebMonths.map((heb, i) => (
              <div
                key={i}
                className={`px-1 py-2 text-center border-s border-white/10 ${i === nowIdx ? 'bg-[#C0605A]' : 'bg-[#233A52]'} text-white`}
                style={{ gridRow: 1, gridColumn: i + 2 }}
              >
                <div className="text-[13px] font-bold">{gregLabel(year, i)}</div>
                <div className="text-[11px] opacity-75 whitespace-nowrap">{heb}</div>
                {i === nowIdx && <div className="text-[10px] font-semibold mt-0.5">החודש</div>}
              </div>
            ))}

            {layout.map(({ area, placed, firstRow, lanes }, ai) => {
              const c = GANTT_COLORS[area.color];
              const rowSpan = `${firstRow} / span ${lanes}`;
              return [
                // Area label
                <div
                  key={`${area.id}-label`}
                  className={`sticky right-0 z-10 px-3 py-2 flex items-center justify-between gap-2 group ${ai > 0 ? 'border-t-4 border-white' : ''}`}
                  style={{ gridRow: rowSpan, gridColumn: 1, background: c.lane, color: c.text }}
                >
                  <span className="text-xs sm:text-sm font-bold leading-snug">
                    <span className="me-1">{area.emoji}</span>{area.name}
                  </span>
                  <button
                    onClick={() => setDraft({ id: null, areaId: area.id, label: '', start: Math.max(nowIdx, 0), end: Math.max(nowIdx, 0) })}
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-lg hover:bg-white/60 transition-base"
                    title="הוספת מטרה לתחום"
                  >
                    <Plus size={15} />
                  </button>
                </div>,
                // Month background cells (also click-to-add)
                ...Array.from({ length: 12 }, (_, i) => (
                  <button
                    key={`${area.id}-bg-${i}`}
                    onClick={() => setDraft({ id: null, areaId: area.id, label: '', start: i, end: i })}
                    className={`border-s border-border/60 hover:bg-muted/50 transition-base ${ai > 0 ? 'border-t-4 border-t-white' : ''} ${i === nowIdx ? 'bg-[#C0605A]/[0.06]' : ''}`}
                    style={{ gridRow: rowSpan, gridColumn: i + 2 }}
                    aria-label={`הוספה ב${GREG[i]}`}
                  />
                )),
                // Bars
                ...placed.map(({ bar, lane }) => (
                  <button
                    key={bar.id}
                    onClick={() => setDraft({ id: bar.id, areaId: bar.areaId, label: bar.label, start: bar.start, end: bar.end })}
                    className="relative z-[5] m-1 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium leading-snug text-start shadow-sm hover:shadow-hover hover:-translate-y-px transition-base"
                    style={{
                      gridRow: firstRow + lane,
                      gridColumn: `${bar.start + 2} / ${bar.end + 3}`,
                      background: c.bar,
                      color: c.text,
                      borderInlineStart: `4px solid ${c.accent}`,
                      marginTop: ai > 0 && lane === 0 ? 8 : undefined,
                    }}
                    title={bar.label}
                  >
                    {bar.label}
                  </button>
                )),
              ];
            })}
          </div>
        </div>
      </main>

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setDraft(null)}>
          <div dir="rtl" className="bg-card rounded-2xl shadow-overlay w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">{draft.id ? 'עריכת מטרה' : 'מטרה חדשה'}</h3>
              <button onClick={() => setDraft(null)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
            </div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">מה</label>
            <textarea
              autoFocus
              rows={2}
              value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveDraft(); } }}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <label className="block text-xs font-semibold text-muted-foreground mb-1">תחום</label>
            <select
              value={draft.areaId}
              onChange={e => setDraft({ ...draft, areaId: e.target.value })}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm mb-3"
            >
              {year.areas.map(a => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {(['start', 'end'] as const).map(k => (
                <div key={k}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{k === 'start' ? 'מחודש' : 'עד חודש'}</label>
                  <select
                    value={draft[k]}
                    onChange={e => setDraft({ ...draft, [k]: Number(e.target.value) })}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  >
                    {GREG.map((_, i) => <option key={i} value={i}>{gregLabel(year, i)}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveDraft}
                disabled={!draft.label.trim()}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-base"
              >
                שמירה
              </button>
              <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:bg-muted transition-base">ביטול</button>
              {draft.id && (
                <button onClick={deleteDraft} className="ms-auto flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-base">
                  <Trash2 size={14} /> מחיקה
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
