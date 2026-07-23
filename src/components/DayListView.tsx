import { useCallback, useMemo, useState } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay, DragEndEvent, DragStartEvent, DragOverEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { DayColumn } from './DayColumn';
import { TaskItem } from './TaskItem';
import { translateText } from '@/lib/translate';
import { DAYS, formatDayDate } from '@/lib/task-types';
import type { Task, TaskColor } from '@/lib/task-types';

const DAY_IDS = DAYS.map(d => d.id);

// The list/columns view is a Sun-Thu work-week planner — Friday and Saturday
// only show up in the calendar view, which covers the full week.
const LIST_VIEW_DAYS = DAYS.filter(d => d.id !== 'fri' && d.id !== 'sat');

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

interface DayListViewProps {
  tasks: Task[];
  weekStart: Date;
  todayDayId: string | null;
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onToggleDaily: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onSplitTask: (id: string) => void;
}

/**
 * The original Trello-style list-per-day view, kept as an alternate way to
 * browse/edit the same week's tasks the calendar grid uses — grouped by
 * dayId (regardless of whether a task has a startTime), with manual
 * up/down + drag reordering instead of time-slot placement.
 */
export function DayListView({
  tasks, weekStart, todayDayId, setTasks,
  onDelete, onCycleStatus, onToggleDaily, onSetColor, onSplitTask,
}: DayListViewProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    LIST_VIEW_DAYS.forEach(d => { map[d.id] = []; });
    tasks.forEach(t => {
      if (t.isDaily) {
        LIST_VIEW_DAYS.forEach(d => {
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const addInlineTask = useCallback(async (dayId: string, text: string) => {
    if (!text.trim()) return;
    const translated = await translateText(text);
    const newId = genId();
    setTasks(prev => {
      const sortOrder = prev.filter(t => t.dayId === dayId && !t.isDaily).length;
      return [...prev, {
        id: newId, content: translated,
        originalText: /[֐-׿]/.test(text) ? text : undefined,
        status: 'none', color: 'none', dayId, isDaily: false, sortOrder,
      }];
    });
  }, [setTasks]);

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

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string);

  const handleDragOver = useCallback((e: DragOverEvent) => {
    const { active, over } = e;
    if (!over) return;
    const aid = active.id as string, oid = over.id as string;
    const realAid = getRealId(aid);
    const at = tasks.find(t => t.id === realAid);
    if (!at || at.isDaily) return;
    if ((DAY_IDS as string[]).includes(oid)) {
      if (at.dayId !== oid) setTasks(prev => prev.map(t => t.id === realAid ? { ...t, dayId: oid } : t));
      return;
    }
    const ot = tasks.find(t => t.id === getRealId(oid));
    if (ot && at.dayId !== ot.dayId) setTasks(prev => prev.map(t => t.id === realAid ? { ...t, dayId: ot.dayId } : t));
  }, [tasks, setTasks]);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    if (!over) return;
    const aid = active.id as string, oid = over.id as string;
    if (active.id !== over.id && !(DAY_IDS as string[]).includes(oid)) {
      const realAid = getRealId(aid), realOid = getRealId(oid);
      if (tasks.find(t => t.id === realAid)?.isDaily) return;
      setTasks(prev => {
        const oi = prev.findIndex(t => t.id === realAid), ni = prev.findIndex(t => t.id === realOid);
        return oi > -1 && ni > -1 ? arrayMove(prev, oi, ni) : prev;
      });
    }
  }, [tasks, setTasks]);

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const dayTasks of Object.values(tasksByDay)) {
      const found = dayTasks.find(t => t.id === activeId);
      if (found) return found;
    }
    return tasks.find(t => t.id === activeId) ?? null;
  }, [activeId, tasksByDay, tasks]);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
      <div className="flex-1 flex gap-2 overflow-x-auto pb-2 min-h-0 scroll-thin">
        {LIST_VIEW_DAYS.map((day, i) => (
          <DayColumn key={day.id} dayId={day.id} label={day.label}
            date={formatDayDate(weekStart, i)} tasks={tasksByDay[day.id]}
            isToday={todayDayId === day.id} onDelete={onDelete}
            onCycleStatus={onCycleStatus} onToggleDaily={onToggleDaily}
            onSetColor={onSetColor} onSplitTask={onSplitTask} onAddInline={addInlineTask}
            onMoveTask={moveTask}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
        {activeTask ? <TaskItem task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
