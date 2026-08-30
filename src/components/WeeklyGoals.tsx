import { useState } from 'react';
import { Plus, Target, Trash2, Calendar, CheckSquare, Square } from 'lucide-react';
import type { Task } from '@/lib/task-types';
import { DAYS } from '@/lib/task-types';

export interface WeeklyGoal {
  id: string;
  name: string;
  targetCount: number;
}

interface WeeklyGoalsProps {
  goals: WeeklyGoal[];
  tasks: Task[];
  onAddGoal: (name: string, target: number) => void;
  onDeleteGoal: (id: string) => void;
}

function countScheduled(tasks: Task[], goalName: string): { scheduled: number; done: number } {
  const lower = goalName.toLowerCase();
  let scheduled = 0, done = 0;
  tasks.forEach(t => {
    if (t.content.toLowerCase().includes(lower)) {
      if (t.isDaily) {
        DAYS.forEach(d => {
          scheduled++;
          // 'none' default, not t.status — see DayListView's tasksByDay.
          if ((t.dailyStatuses?.[d.id] ?? 'none') === 'green') done++;
        });
      } else {
        scheduled++;
        if (t.status === 'green') done++;
      }
    }
  });
  return { scheduled, done };
}

export function WeeklyGoals({ goals, tasks, onAddGoal, onDeleteGoal }: WeeklyGoalsProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState(3);

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddGoal(newName.trim(), newTarget);
    setNewName('');
    setNewTarget(3);
    setIsAdding(false);
  };

  return (
    <div className="bg-card rounded-2xl shadow-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Target size={14} className="text-primary" />
          <h3 className="text-xs font-bold text-foreground">Weekly Goals</h3>
        </div>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 text-muted-foreground/40 hover:text-primary rounded-lg transition-base"
        >
          <Plus size={14} />
        </button>
      </div>

      {isAdding && (
        <div className="mb-3 space-y-2 p-2 bg-muted/30 rounded-xl">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Goal keyword..."
            dir="auto"
            autoFocus
            className="w-full px-2 py-1.5 text-xs bg-card rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-muted-foreground">Target:</label>
            <input
              type="number"
              value={newTarget}
              onChange={e => setNewTarget(parseInt(e.target.value) || 1)}
              min={1} max={20}
              className="w-12 px-1.5 py-1 text-xs bg-card rounded-lg border border-border text-center focus:outline-none"
            />
            <button
              onClick={handleAdd}
              className="ml-auto px-3 py-1 text-[10px] font-semibold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-base"
            >
              Add
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2.5">
        {goals.map(goal => {
          const { scheduled, done } = countScheduled(tasks, goal.name);
          const left = Math.max(0, goal.targetCount - scheduled);
          return (
            <div key={goal.id} className="group">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-foreground" dir="auto">{goal.name}</p>
                <button
                  onClick={() => onDeleteGoal(goal.id)}
                  className="opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 p-0.5 text-muted-foreground/30 hover:text-destructive transition-base"
                >
                  <Trash2 size={10} />
                </button>
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar size={10} />
                  <span>{scheduled} Scheduled</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-[hsl(var(--status-green))]">
                  <CheckSquare size={10} />
                  <span>{done} Done</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-primary/70">
                  <Square size={10} />
                  <span>{left} Left</span>
                </div>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && !isAdding && (
          <p className="text-[10px] text-muted-foreground/40 text-center py-2">No goals yet</p>
        )}
      </div>
    </div>
  );
}
