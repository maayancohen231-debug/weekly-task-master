import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, ArrowLeft, CalendarDays, GraduationCap } from 'lucide-react';

const STORAGE_KEY = 'academic-board-data';

type CellState = 'empty' | 'done' | 'delayed' | 'cancelled';

interface Course { id: string; name: string; }
interface BoardRow { id: string; label: string; }
interface BoardEvent { id: string; name: string; date: string; }

interface AcademicData {
  courses: Course[];
  rows: BoardRow[];
  cells: Record<string, CellState>;
  events: BoardEvent[];
}

const DEFAULT_DATA: AcademicData = {
  courses: [
    { id: 'c1', name: 'Course 1' },
    { id: 'c2', name: 'Course 2' },
    { id: 'c3', name: 'Course 3' },
  ],
  rows: [
    { id: 'r1', label: 'Lesson 1' },
    { id: 'r2', label: 'Lesson 2' },
    { id: 'r3', label: 'Exercise 1' },
  ],
  cells: {},
  events: [],
};

const CELL_CYCLE: CellState[] = ['empty', 'done', 'delayed', 'cancelled'];

function nextCell(s: CellState): CellState {
  return CELL_CYCLE[(CELL_CYCLE.indexOf(s) + 1) % CELL_CYCLE.length];
}

function parseDateSort(date: string): number {
  const [dd, mm] = date.split('.').map(Number);
  if (!mm || !dd) return 9999;
  return mm * 100 + dd;
}

function genId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const CELL_BG: Record<CellState, string> = {
  empty: '',
  done: 'bg-[hsl(var(--status-green-bg))]',
  delayed: 'bg-[hsl(var(--status-red-bg))]',
  cancelled: 'bg-muted',
};

function CellIcon({ state }: { state: CellState }) {
  if (state === 'empty') return null;
  if (state === 'done') return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[hsl(var(--status-green))]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2,8 6,12 14,4" />
    </svg>
  );
  if (state === 'delayed') return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 text-[hsl(var(--status-red))]" fill="currentColor">
      <circle cx="8" cy="8" r="5" />
    </svg>
  );
  // cancelled
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4 text-muted-foreground/40" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="4" y1="4" x2="12" y2="12" />
      <line x1="12" y1="4" x2="4" y2="12" />
    </svg>
  );
}

interface Props {
  onBack: () => void;
}

export function AcademicBoard({ onBack }: Props) {
  const [data, setData] = useState<AcademicData>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...DEFAULT_DATA, ...(JSON.parse(raw) as AcademicData) };
    } catch { /* ignore */ }
    return DEFAULT_DATA;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');

  const sortedEvents = useMemo(
    () => [...data.events].sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date)),
    [data.events]
  );

  // ── Courses ──────────────────────────────────────────────────────
  const addCourse = () => {
    setData(d => ({ ...d, courses: [...d.courses, { id: genId(), name: `Course ${d.courses.length + 1}` }] }));
  };

  const deleteCourse = (courseId: string) => {
    setData(d => {
      const cells = { ...d.cells };
      d.rows.forEach(r => delete cells[`${r.id}_${courseId}`]);
      return { ...d, courses: d.courses.filter(c => c.id !== courseId), cells };
    });
  };

  const commitCourse = () => {
    if (editingCourseId && editValue.trim()) {
      setData(d => ({ ...d, courses: d.courses.map(c => c.id === editingCourseId ? { ...c, name: editValue.trim() } : c) }));
    }
    setEditingCourseId(null);
  };

  // ── Rows ─────────────────────────────────────────────────────────
  const addRow = () => {
    setData(d => ({ ...d, rows: [...d.rows, { id: genId(), label: `Row ${d.rows.length + 1}` }] }));
  };

  const deleteRow = (rowId: string) => {
    setData(d => {
      const cells = { ...d.cells };
      d.courses.forEach(c => delete cells[`${rowId}_${c.id}`]);
      return { ...d, rows: d.rows.filter(r => r.id !== rowId), cells };
    });
  };

  const commitRow = () => {
    if (editingRowId && editValue.trim()) {
      setData(d => ({ ...d, rows: d.rows.map(r => r.id === editingRowId ? { ...r, label: editValue.trim() } : r) }));
    }
    setEditingRowId(null);
  };

  // ── Cells ────────────────────────────────────────────────────────
  const cycleCell = (rowId: string, courseId: string) => {
    const key = `${rowId}_${courseId}`;
    setData(d => ({ ...d, cells: { ...d.cells, [key]: nextCell(d.cells[key] ?? 'empty') } }));
  };

  // ── Events ───────────────────────────────────────────────────────
  const addEvent = () => {
    if (!newEventName.trim() || !newEventDate.trim()) return;
    setData(d => ({ ...d, events: [...d.events, { id: genId(), name: newEventName.trim(), date: newEventDate.trim() }] }));
    setNewEventName('');
    setNewEventDate('');
  };

  const deleteEvent = (id: string) => {
    setData(d => ({ ...d, events: d.events.filter(e => e.id !== id) }));
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      {/* Accent strip */}
      <div className="h-1 w-full shrink-0" style={{ background: 'hsl(340 60% 80%)' }} />

      {/* Header */}
      <header className="bg-card shadow-card px-6 py-3 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-base text-sm"
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2">
            <GraduationCap size={20} className="text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">Academic Board</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6">

        {/* ── Course Table ─────────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  {/* Label column header */}
                  <th className="sticky left-0 bg-secondary/40 z-10 px-4 py-3 text-left font-semibold text-muted-foreground min-w-[180px] border-r border-border">
                    Task Type
                  </th>

                  {data.courses.map(course => (
                    <th key={course.id} className="px-3 py-2 text-center font-semibold text-foreground min-w-[130px] border-r border-border/50 group">
                      <div className="flex items-center justify-center gap-1">
                        {editingCourseId === course.id ? (
                          <input
                            autoFocus
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={commitCourse}
                            onKeyDown={e => { if (e.key === 'Enter') commitCourse(); }}
                            className="w-full text-center bg-background border border-primary/30 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                          />
                        ) : (
                          <span
                            onClick={() => { setEditingCourseId(course.id); setEditValue(course.name); }}
                            className="cursor-pointer hover:text-primary transition-base px-1"
                            title="Click to edit"
                          >
                            {course.name}
                          </span>
                        )}
                        <button
                          onClick={() => deleteCourse(course.id)}
                          className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-0.5 text-muted-foreground/30 hover:text-destructive rounded transition-base shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </th>
                  ))}

                  {/* Add course */}
                  <th className="px-3 py-2 text-left">
                    <button
                      onClick={addCourse}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-base whitespace-nowrap"
                    >
                      <Plus size={13} />
                      Add Course
                    </button>
                  </th>
                </tr>
              </thead>

              <tbody>
                {data.rows.map((row, rowIdx) => {
                  const evenRow = rowIdx % 2 === 0;
                  const rowBg = evenRow ? 'bg-card' : 'bg-muted/10';
                  return (
                    <tr key={row.id} className={`border-b border-border/50 group/row ${rowBg}`}>
                      {/* Row label */}
                      <td className={`sticky left-0 z-10 px-4 py-3 border-r border-border ${rowBg}`}>
                        <div className="flex items-center justify-between gap-2">
                          {editingRowId === row.id ? (
                            <input
                              autoFocus
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onBlur={commitRow}
                              onKeyDown={e => { if (e.key === 'Enter') commitRow(); }}
                              className="flex-1 bg-background border border-primary/30 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                            />
                          ) : (
                            <span
                              onClick={() => { setEditingRowId(row.id); setEditValue(row.label); }}
                              className="flex-1 text-sm font-medium text-foreground cursor-pointer hover:text-primary transition-base"
                              title="Click to edit"
                            >
                              {row.label}
                            </span>
                          )}
                          <button
                            onClick={() => deleteRow(row.id)}
                            className="opacity-0 group-hover/row:opacity-100 p-0.5 text-muted-foreground/30 hover:text-destructive rounded transition-base shrink-0"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>

                      {/* Cells */}
                      {data.courses.map(course => {
                        const key = `${row.id}_${course.id}`;
                        const state = data.cells[key] ?? 'empty';
                        return (
                          <td
                            key={course.id}
                            onClick={() => cycleCell(row.id, course.id)}
                            className={`px-3 py-3 text-center border-r border-border/50 cursor-pointer transition-base hover:brightness-95 select-none ${CELL_BG[state]}`}
                          >
                            <div className="flex items-center justify-center h-5">
                              <CellIcon state={state} />
                            </div>
                          </td>
                        );
                      })}
                      <td />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add row */}
          <button
            onClick={addRow}
            className="w-full px-4 py-3 text-sm text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-base flex items-center gap-2 justify-center border-t border-border/50"
          >
            <Plus size={14} />
            Add Row
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground px-1">
          <span className="font-semibold text-foreground/60">Legend:</span>
          {[
            { state: 'empty' as CellState, label: 'Not started' },
            { state: 'done' as CellState, label: 'Done' },
            { state: 'delayed' as CellState, label: 'Delayed' },
            { state: 'cancelled' as CellState, label: 'Cancelled' },
          ].map(({ state, label }) => (
            <div key={state} className="flex items-center gap-1.5">
              <span className={`w-6 h-6 rounded border border-border/60 inline-flex items-center justify-center ${CELL_BG[state]}`}>
                <CellIcon state={state} />
              </span>
              <span>{label}</span>
            </div>
          ))}
          <span className="text-muted-foreground/40 ml-2">• Click a cell to cycle through states</span>
          <span className="text-muted-foreground/40">• Click a course/row name to edit it</span>
        </div>

        {/* ── Upcoming Events ──────────────────────────────────── */}
        <div className="bg-card rounded-2xl shadow-card p-5 max-w-md">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Upcoming Events</h2>
          </div>

          {/* Add form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newEventName}
              onChange={e => setNewEventName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              placeholder="Event name..."
              className="flex-1 px-3 py-2 text-sm bg-muted/60 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/40"
            />
            <input
              type="text"
              value={newEventDate}
              onChange={e => setNewEventDate(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addEvent()}
              placeholder="DD.MM"
              className="w-20 px-3 py-2 text-sm bg-muted/60 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-center placeholder:text-muted-foreground/40"
            />
            <button
              onClick={addEvent}
              className="p-2 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base shrink-0"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Events list */}
          <div className="space-y-1">
            {sortedEvents.length === 0 && (
              <p className="text-xs text-muted-foreground/40 text-center py-4">No events yet</p>
            )}
            {sortedEvents.map(event => (
              <div
                key={event.id}
                className="group flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-base"
              >
                <span className="text-sm text-foreground">{event.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                    {event.date}
                  </span>
                  <button
                    onClick={() => deleteEvent(event.id)}
                    className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-0.5 text-muted-foreground/30 hover:text-destructive rounded transition-base"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}
