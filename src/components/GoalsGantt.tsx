import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowRight, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import {
  GANTT_SEED,
  type GanttBar, type GanttData, type GanttYear,
} from '@/lib/goalsGanttSeed';

// v2 = restyled board (R-089 fix, 2026-11-08). v1 data is left untouched in storage.
const STORAGE_KEY = 'goals-gantt-v2';
const YEAR_KEY = 'goals-gantt-year';
const GREG = ['ספט', 'אוק', 'נוב', 'דצמ', 'ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג'];
const GREG_LONG = ['ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר', 'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט'];

function load(): GanttData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw) as GanttData;
      if (d?.version === 2 && Array.isArray(d.years)) return d;
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

function monthName(year: GanttYear, i: number): string {
  return `${GREG[i]} ${String(year.startYear + (i >= 4 ? 1 : 0)).slice(2)}`;
}

function tint(hex: string, a: number): string {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16},${(v >> 8) & 255},${v & 255},${a})`;
}

const CSS = `
.gg{--bg:#f7f7f5;--card:#fff;--ink:#1f2328;--muted:#7a7f87;--faint:#a9adb3;--line:#ececea;--now:#fdf3f1;--nowInk:#c4553f;
  background:var(--bg);color:var(--ink);font-family:Heebo,system-ui,sans-serif;-webkit-font-smoothing:antialiased;min-height:100vh}
.gg-wrap{max-width:1180px;margin:0 auto;padding:20px 28px 64px}
.gg-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:26px}
.gg-btn{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:10px;font-size:13px;color:var(--muted);background:transparent;transition:background .15s,color .15s}
.gg-btn:hover{background:#ecece9;color:var(--ink)}
.gg-tabs{display:flex;gap:2px;background:#ecece9;border-radius:10px;padding:3px;margin-inline-start:auto}
.gg-tab{padding:5px 14px;border-radius:8px;font-size:13px;font-weight:600;color:var(--muted);transition:background .15s,color .15s}
.gg-tab.on{background:var(--card);color:var(--ink);box-shadow:0 1px 2px rgba(0,0,0,.06)}
.gg-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:28px;flex-wrap:wrap}
.gg h1{font-size:26px;font-weight:700;margin:0 0 4px;letter-spacing:-.2px}
.gg-sub{color:var(--muted);font-size:14px}
.gg-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
.gg-legend span{display:inline-flex;align-items:center;gap:6px}
.gg-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.gg-board{background:var(--card);border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 0 0 1px var(--line);overflow-x:auto}
.gg-grid{display:grid;grid-template-columns:minmax(220px,320px) repeat(12,minmax(44px,1fr));min-width:900px;position:relative;padding-bottom:22px}
.gg-mh{font-size:12px;color:var(--faint);text-align:center;padding:14px 0 12px;border-bottom:1px solid var(--line);font-weight:500;position:relative;z-index:1;line-height:1.35;padding-inline:2px}
.gg-mh b{display:block;color:var(--muted);font-weight:600;font-size:13px}
.gg-mh.now b{color:var(--nowInk)}
.gg-mh.now::after{content:"";position:absolute;bottom:-1px;inset-inline:22%;height:2px;background:var(--nowInk);border-radius:2px}
.gg-corner{border-bottom:1px solid var(--line)}
.gg-nowcol{position:absolute;top:0;bottom:0;background:var(--now);pointer-events:none;z-index:0}
.gg-sec{grid-column:1 / -1;display:flex;align-items:center;gap:8px;padding:22px 24px 8px;font-size:13px;font-weight:600;position:relative;z-index:1}
.gg-sec small{color:var(--faint);font-weight:400}
.gg-add{opacity:0;display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:500;color:var(--muted);padding:2px 8px;border-radius:8px;transition:opacity .15s,background .15s}
.gg-sec:hover .gg-add,.gg-add:focus-visible{opacity:1}
.gg-add:hover{background:#f0f0ee;color:var(--ink)}
.gg-row{display:contents;cursor:pointer}
.gg-label{padding:9px 24px;position:relative;z-index:1;min-width:0;text-align:start}
.gg-label .t{font-size:14px;font-weight:500;line-height:1.35}
.gg-label .d{font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:1px}
.gg-track{grid-column:2 / -1;position:relative;z-index:1;display:grid;grid-template-columns:repeat(12,1fr);align-items:center}
.gg-bar{height:8px;border-radius:99px;margin:0 3px;transition:height .15s}
.gg-row:hover .gg-bar{height:12px}
.gg-row:hover .gg-label .t{color:#000}
.gg h2{font-size:15px;font-weight:600;margin:36px 0 12px}
.gg-habits{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.gg-hc{background:var(--card);border-radius:14px;padding:18px 20px;box-shadow:0 0 0 1px var(--line);position:relative}
.gg-hc h3{margin:0 0 10px;font-size:13px;color:var(--muted);font-weight:600}
.gg-hc ul{margin:0;padding:0;list-style:none}
.gg-hc li{font-size:14px;padding:5px 0;display:flex;gap:8px;align-items:baseline}
.gg-hc li::before{content:"";width:5px;height:5px;border-radius:50%;background:#c9ccd1;flex:none;transform:translateY(-2px)}
.gg-hc .gg-edit{position:absolute;top:12px;inset-inline-end:12px;opacity:0;padding:4px;border-radius:8px;color:var(--muted);transition:opacity .15s,background .15s}
.gg-hc:hover .gg-edit,.gg-hc .gg-edit:focus-visible{opacity:1}
.gg-hc .gg-edit:hover{background:#f0f0ee}
.gg-hint{margin-top:14px;font-size:12.5px;color:var(--faint)}
.gg-modal input,.gg-modal textarea,.gg-modal select{width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 12px;font-size:14px;background:#fff;font-family:inherit;color:var(--ink)}
.gg-modal input:focus,.gg-modal textarea:focus,.gg-modal select:focus{outline:none;box-shadow:0 0 0 2px rgba(196,85,63,.25)}
.gg-modal label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin-bottom:4px}
@media (max-width:760px){.gg-grid{grid-template-columns:minmax(150px,170px) repeat(12,48px);min-width:0}.gg-habits{grid-template-columns:1fr}.gg-wrap{padding:16px 14px 48px}.gg-label{padding:9px 14px}.gg-sec{padding:22px 14px 8px}}
@media (hover:none){.gg-add,.gg-hc .gg-edit{opacity:1}}
`;

type Draft = { id: string | null; areaId: string; label: string; detail: string; start: number; end: number };
type HabitDraft = { id: string; title: string; text: string };

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
  const [habitDraft, setHabitDraft] = useState<HabitDraft | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const nowHeadRef = useRef<HTMLDivElement>(null);
  const [nowBox, setNowBox] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* ignore */ }
  }, [data]);
  useEffect(() => {
    try { localStorage.setItem(YEAR_KEY, yearId); } catch { /* ignore */ }
  }, [yearId]);
  useEffect(() => {
    if (!draft && !habitDraft) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setDraft(null); setHabitDraft(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, habitDraft]);

  // Heebo, as in her design sample; loaded only for this page.
  useEffect(() => {
    const id = 'heebo-font';
    if (document.getElementById(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }, []);

  const year = data.years.find(y => y.id === yearId) ?? data.years[0];
  const nowIdx = currentMonthIndex(year);

  // Shaded column behind the current month, measured from its header cell.
  useLayoutEffect(() => {
    const place = () => {
      const h = nowHeadRef.current;
      setNowBox(h ? { left: h.offsetLeft, width: h.offsetWidth } : null);
    };
    place();
    const ro = new ResizeObserver(place);
    if (gridRef.current) ro.observe(gridRef.current);
    document.fonts?.ready.then(place).catch(() => {});
    return () => ro.disconnect();
  }, [year.id, nowIdx]);

  const updateYear = (fn: (y: GanttYear) => GanttYear) =>
    setData(d => ({ ...d, years: d.years.map(y => (y.id === year.id ? fn(y) : y)) }));

  const openBar = (bar: GanttBar) =>
    setDraft({ id: bar.id, areaId: bar.areaId, label: bar.label, detail: bar.detail ?? '', start: bar.start, end: bar.end });

  const saveDraft = () => {
    if (!draft || !draft.label.trim()) return;
    const start = Math.min(draft.start, draft.end);
    const end = Math.max(draft.start, draft.end);
    const detail = draft.detail.trim();
    const bar: GanttBar = {
      id: draft.id ?? genId(), areaId: draft.areaId, label: draft.label.trim(),
      ...(detail ? { detail } : {}), start, end,
    };
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

  const saveHabits = () => {
    if (!habitDraft) return;
    const items = habitDraft.text.split('\n').map(s => s.trim()).filter(Boolean);
    updateYear(y => ({
      ...y,
      habits: y.habits.map(h => (h.id === habitDraft.id ? { ...h, title: habitDraft.title.trim() || h.title, items } : h)),
    }));
    setHabitDraft(null);
  };

  const resetToFile = () => {
    if (!confirm('לחזור ללוח המקורי? שינויים שעשית כאן יימחקו.')) return;
    setData(structuredClone(GANTT_SEED));
  };

  const startMonth = Math.max(nowIdx, 0);

  return (
    <div dir="rtl" className="gg">
      <style>{CSS}</style>
      <div className="gg-wrap">
        <div className="gg-top">
          <button onClick={onBack} className="gg-btn">
            <ArrowRight size={15} /> חזרה ליומן
          </button>
          <div className="gg-tabs" role="tablist">
            {data.years.map(y => (
              <button
                key={y.id}
                role="tab"
                aria-selected={y.id === year.id}
                onClick={() => setYearId(y.id)}
                className={`gg-tab${y.id === year.id ? ' on' : ''}`}
              >
                {y.title}
              </button>
            ))}
          </div>
          <button onClick={resetToFile} className="gg-btn" title="חזרה ללוח המקורי">
            <RotateCcw size={13} /> לוח מקורי
          </button>
        </div>

        <header className="gg-head">
          <div>
            <h1>לוח מטרות {year.title}</h1>
            <div className="gg-sub">ספטמבר {year.startYear} – אוגוסט {year.startYear + 1}</div>
          </div>
          <div className="gg-legend">
            {year.areas.map(a => (
              <span key={a.id}><span className="gg-dot" style={{ background: a.color }} />{a.name}</span>
            ))}
          </div>
        </header>

        <div className="gg-board">
          <div className="gg-grid" ref={gridRef}>
            {nowBox && <div className="gg-nowcol" style={{ left: nowBox.left, width: nowBox.width }} />}
            <div className="gg-corner" />
            {year.hebMonths.map((heb, i) => (
              <div
                key={i}
                ref={i === nowIdx ? nowHeadRef : undefined}
                className={`gg-mh${i === nowIdx ? ' now' : ''}`}
                title={`${GREG_LONG[i]} ${year.startYear + (i >= 4 ? 1 : 0)}`}
              >
                <b>{GREG[i]}</b>{heb}
              </div>
            ))}

            {year.areas.map(area => {
              const bars = year.bars.filter(b => b.areaId === area.id);
              return (
                <Fragment key={area.id}>
                  <div className="gg-sec">
                    <span className="gg-dot" style={{ background: area.color }} />
                    {area.name}
                    {area.note && <small>· {area.note}</small>}
                    <button
                      className="gg-add"
                      onClick={() => setDraft({ id: null, areaId: area.id, label: '', detail: '', start: startMonth, end: startMonth })}
                      title={`מטרה חדשה ב${area.name}`}
                    >
                      <Plus size={13} /> מטרה
                    </button>
                  </div>
                  {bars.map(bar => (
                    <div
                      key={bar.id}
                      className="gg-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => openBar(bar)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openBar(bar); } }}
                    >
                      <div className="gg-label">
                        <div className="t">{bar.label}</div>
                        {bar.detail && <div className="d">{bar.detail}</div>}
                      </div>
                      <div className="gg-track">
                        <div
                          className="gg-bar"
                          style={{
                            gridColumn: `${bar.start + 1} / ${bar.end + 2}`,
                            background: nowIdx !== -1 && bar.end < nowIdx ? tint(area.color, 0.35) : area.color,
                          }}
                          title={`${bar.label} · ${GREG[bar.start]}${bar.end !== bar.start ? `–${GREG[bar.end]}` : ''}`}
                        />
                      </div>
                    </div>
                  ))}
                </Fragment>
              );
            })}
          </div>
        </div>
        <div className="gg-hint">לחיצה על מטרה לעריכה · נשמר בדפדפן הזה</div>

        {year.habits.length > 0 && (
          <>
            <h2>הרגלים קבועים · כל השנה</h2>
            <div className="gg-habits">
              {year.habits.map(h => (
                <div key={h.id} className="gg-hc">
                  <h3>{h.title}</h3>
                  <button
                    className="gg-edit"
                    onClick={() => setHabitDraft({ id: h.id, title: h.title, text: h.items.join('\n') })}
                    title="עריכה"
                    aria-label={`עריכת ${h.title}`}
                  >
                    <Pencil size={13} />
                  </button>
                  <ul>{h.items.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4" onClick={() => setDraft(null)}>
          <div dir="rtl" className="gg-modal bg-white rounded-2xl shadow-overlay w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">{draft.id ? 'עריכת מטרה' : 'מטרה חדשה'}</h3>
              <button onClick={() => setDraft(null)} className="p-1 rounded-lg text-[#7a7f87] hover:bg-[#f0f0ee]"><X size={16} /></button>
            </div>
            <label>מה</label>
            <input
              autoFocus
              value={draft.label}
              onChange={e => setDraft({ ...draft, label: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveDraft(); } }}
              className="mb-3"
            />
            <label>פירוט (לא חובה)</label>
            <input
              value={draft.detail}
              onChange={e => setDraft({ ...draft, detail: e.target.value })}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveDraft(); } }}
              className="mb-3"
            />
            <label>תחום</label>
            <select value={draft.areaId} onChange={e => setDraft({ ...draft, areaId: e.target.value })} className="mb-3">
              {year.areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {(['start', 'end'] as const).map(k => (
                <div key={k}>
                  <label>{k === 'start' ? 'מחודש' : 'עד חודש'}</label>
                  <select value={draft[k]} onChange={e => setDraft({ ...draft, [k]: Number(e.target.value) })}>
                    {GREG.map((_, i) => <option key={i} value={i}>{monthName(year, i)}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveDraft}
                disabled={!draft.label.trim()}
                className="px-4 py-2 rounded-xl bg-[#1f2328] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-base"
              >
                שמירה
              </button>
              <button onClick={() => setDraft(null)} className="px-4 py-2 rounded-xl text-sm text-[#7a7f87] hover:bg-[#f0f0ee] transition-base">ביטול</button>
              {draft.id && (
                <button onClick={deleteDraft} className="ms-auto flex items-center gap-1 px-3 py-2 rounded-xl text-sm text-[#c4553f] hover:bg-[#fdf3f1] transition-base">
                  <Trash2 size={14} /> מחיקה
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {habitDraft && (
        <div className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4" onClick={() => setHabitDraft(null)}>
          <div dir="rtl" className="gg-modal bg-white rounded-2xl shadow-overlay w-full max-w-md p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold">עריכת הרגלים</h3>
              <button onClick={() => setHabitDraft(null)} className="p-1 rounded-lg text-[#7a7f87] hover:bg-[#f0f0ee]"><X size={16} /></button>
            </div>
            <label>כותרת</label>
            <input value={habitDraft.title} onChange={e => setHabitDraft({ ...habitDraft, title: e.target.value })} className="mb-3" />
            <label>הרגל בכל שורה</label>
            <textarea
              autoFocus
              rows={6}
              value={habitDraft.text}
              onChange={e => setHabitDraft({ ...habitDraft, text: e.target.value })}
              className="mb-5"
            />
            <div className="flex items-center gap-2">
              <button onClick={saveHabits} className="px-4 py-2 rounded-xl bg-[#1f2328] text-white text-sm font-semibold hover:opacity-90 transition-base">שמירה</button>
              <button onClick={() => setHabitDraft(null)} className="px-4 py-2 rounded-xl text-sm text-[#7a7f87] hover:bg-[#f0f0ee] transition-base">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
