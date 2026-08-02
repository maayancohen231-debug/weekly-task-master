import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { BANK_ID } from '@/lib/calendar-grid';
import type { Task, LibraryTask, TaskColor } from '@/lib/task-types';
import { TaskBankSidebar } from './TaskBankSidebar';
import { LibraryPanel } from './LibraryPanel';

type Tab = 'bank' | 'library';

interface TaskSidebarPanelProps {
  tasks: Task[];
  onAddTask: (text: string) => Promise<void>;
  onDelete: (id: string) => void;
  onCycleStatus: (id: string) => void;
  onToggleDaily: (id: string) => void;
  onSetColor: (id: string, color: TaskColor) => void;
  onSplitTask: (id: string) => void;
  libraryTasks: LibraryTask[];
  onAddLibraryTask: (task: LibraryTask) => void;
  onDeleteLibraryTask: (id: string) => void;
  onSetLibraryColor: (id: string, color: TaskColor) => void;
  onSetLibraryDuration: (id: string, durationMinutes: number | undefined) => void;
}

/**
 * Task Bank and Task Library used to be two separate cards stacked in the
 * sidebar; merged into tabs of one card to save vertical space. The bank's
 * drop zone (for unscheduling a task off the calendar) spans the whole card
 * regardless of which tab is open, so dropping there always works even while
 * viewing the Library tab.
 */
export function TaskSidebarPanel({
  tasks, onAddTask, onDelete, onCycleStatus, onToggleDaily, onSetColor, onSplitTask,
  libraryTasks, onAddLibraryTask, onDeleteLibraryTask, onSetLibraryColor, onSetLibraryDuration,
}: TaskSidebarPanelProps) {
  const { setNodeRef, isOver } = useDroppable({ id: BANK_ID });
  const [tab, setTab] = useState<Tab>('bank');

  return (
    <div
      ref={setNodeRef}
      className={`bg-card rounded-2xl shadow-card p-4 transition-base ${isOver ? 'ring-2 ring-primary/20 shadow-hover' : ''}`}
    >
      <div className="flex items-center gap-1 mb-3 border-b border-border/40">
        <button
          onClick={() => setTab('bank')}
          className={`px-2.5 py-1.5 text-sm font-bold border-b-2 -mb-px transition-base ${
            tab === 'bank' ? 'text-foreground border-primary' : 'text-muted-foreground/50 border-transparent hover:text-muted-foreground'
          }`}
        >
          Task Bank{tasks.length > 0 ? ` (${tasks.length})` : ''}
        </button>
        <button
          onClick={() => setTab('library')}
          className={`px-2.5 py-1.5 text-sm font-bold border-b-2 -mb-px transition-base ${
            tab === 'library' ? 'text-foreground border-primary' : 'text-muted-foreground/50 border-transparent hover:text-muted-foreground'
          }`}
        >
          Task Library{libraryTasks.length > 0 ? ` (${libraryTasks.length})` : ''}
        </button>
      </div>

      {tab === 'bank' ? (
        <TaskBankSidebar
          tasks={tasks}
          onAddTask={onAddTask}
          onDelete={onDelete}
          onCycleStatus={onCycleStatus}
          onToggleDaily={onToggleDaily}
          onSetColor={onSetColor}
          onSplitTask={onSplitTask}
        />
      ) : (
        <LibraryPanel
          bare
          libraryTasks={libraryTasks}
          onAddLibraryTask={onAddLibraryTask}
          onDeleteLibraryTask={onDeleteLibraryTask}
          onSetLibraryColor={onSetLibraryColor}
          onSetLibraryDuration={onSetLibraryDuration}
        />
      )}
    </div>
  );
}
