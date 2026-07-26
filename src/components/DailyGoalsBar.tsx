import { useRef, useState } from 'react';
import { Plus, Target, Trash2, CheckSquare, Square, ChevronDown, ChevronUp } from 'lucide-react';
import type { DailyGoal } from '@/lib/task-types';

interface DayInfo {
  id: string;
  label: string;
  date: string;
}

interface DailyGoalsBarProps {
  days: DayInfo[];
  goals: DailyGoal[];
  onAddGoal: (name: string) => void;
  onToggleGoalDay: (goalId: string, dayId: string) => void;
  onDeleteGoal: (goalId: string) => void;
}

const NAME_COL_WIDTH = 140;

export function DailyGoalsBar({ days, goals, onAddGoal, onToggleGoalDay, onDeleteGoal }: DailyGoalsBarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const openEditor = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const submit = () => {
    if (!name.trim()) return;
    onAddGoal(name.trim());
    setName('');
    setIsAdding(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') { setIsAdding(false); setName(''); }
  };

  return (
    <div className="shrink-0 bg-card rounded-2xl shadow-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <Target size={13} className="text-primary" />
        <h3 className="text-xs font-bold text-foreground">Daily Goals</h3>
        <span className="text-[10px] text-muted-foreground/50">repeats every day</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={openEditor}
            className="p-1 text-muted-foreground/40 hover:text-primary rounded-lg transition-base"
            title="Add a daily goal"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setIsCollapsed(v => !v)}
            className="p-1 text-muted-foreground/40 hover:text-foreground rounded-lg transition-base"
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <>
          {isAdding && (
            <div className="px-3 pb-2 flex items-center gap-1.5">
              <input
                ref={inputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                dir="auto"
                placeholder="Goal name..."
                className="flex-1 px-2.5 py-1.5 text-xs bg-muted border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40"
              />
              <button onClick={submit} disabled={!name.trim()} className="px-3 py-1.5 text-[11px] font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-40 transition-base">
                Add
              </button>
              <button onClick={() => { setIsAdding(false); setName(''); }} className="px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground rounded-lg transition-base">
                Cancel
              </button>
            </div>
          )}

          {goals.length === 0 ? (
            <p className="px-3 pb-3 text-[11px] text-muted-foreground/40 italic">No daily goals yet — add one above</p>
          ) : (
            <div className="border-t border-border/50">
              <div className="flex">
                <div style={{ width: NAME_COL_WIDTH }} className="shrink-0" />
                {days.map(day => (
                  <div key={day.id} className="flex-1 min-w-[90px] text-center border-l border-border/50 px-1 py-1.5">
                    <p className="text-[10px] font-semibold text-foreground">{day.label}</p>
                    <p className="text-[9px] text-muted-foreground">{day.date}</p>
                  </div>
                ))}
              </div>
              <div className="divide-y divide-border/30 border-t border-border/50">
                {goals.map(goal => (
                  <div key={goal.id} className="group flex items-center hover:bg-muted/30 transition-base">
                    <div style={{ width: NAME_COL_WIDTH }} className="shrink-0 flex items-center gap-1 px-2.5 py-1.5">
                      <p className="flex-1 min-w-0 text-[11px] font-medium text-foreground truncate" dir="auto" title={goal.name}>
                        {goal.name}
                      </p>
                      <button
                        onClick={() => onDeleteGoal(goal.id)}
                        className="shrink-0 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-0.5 text-muted-foreground/40 hover:text-destructive rounded transition-base"
                        title="Delete goal"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    {days.map(day => {
                      const done = goal.doneByDay[day.id] ?? false;
                      return (
                        <button
                          key={day.id}
                          onClick={() => onToggleGoalDay(goal.id, day.id)}
                          className="flex-1 min-w-[90px] border-l border-border/50 flex items-center justify-center py-1.5 transition-base"
                          title={`${goal.name} — ${day.label}`}
                        >
                          {done
                            ? <CheckSquare size={13} className="text-[hsl(var(--status-green))]" />
                            : <Square size={13} className="text-muted-foreground/25" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
