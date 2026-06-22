import { useState, useEffect } from 'react';
import { ChevronLeft, Plus, Trash2, Check, ListTodo } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaskList {
  id: string;
  name: string;
}

interface ListTask {
  id: string;
  listId: string;
  content: string;
  done: boolean;
}

interface ListsData {
  lists: TaskList[];
  tasks: ListTask[];
}

// ── Storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'custom-lists-data';

const DEFAULT_LIST: TaskList = { id: 'general', name: 'כללי' };

function loadData(): ListsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ListsData>;
      const lists = parsed.lists ?? [DEFAULT_LIST];
      // Ensure the general list always exists
      if (!lists.find(l => l.id === 'general')) {
        lists.unshift(DEFAULT_LIST);
      }
      return { lists, tasks: parsed.tasks ?? [] };
    }
  } catch { /* ignore */ }
  return { lists: [DEFAULT_LIST], tasks: [] };
}

function genId(): string {
  return Math.random().toString(36).substr(2, 9);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ListsPage({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<ListsData>(loadData);
  const [selectedListId, setSelectedListId] = useState<string>('general');
  const [newListName, setNewListName] = useState('');
  const [isAddingList, setIsAddingList] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const selectedList = data.lists.find(l => l.id === selectedListId) ?? data.lists[0];
  const currentTasks = data.tasks.filter(t => t.listId === selectedListId);

  // ── List actions ──────────────────────────────────────────────────────────

  const addList = () => {
    const name = newListName.trim();
    if (!name) return;
    const newList: TaskList = { id: genId(), name };
    setData(prev => ({ ...prev, lists: [...prev.lists, newList] }));
    setSelectedListId(newList.id);
    setNewListName('');
    setIsAddingList(false);
  };

  const deleteList = (id: string) => {
    if (id === 'general') return; // Can't delete general list
    if (!confirm(`למחוק את הרשימה "${data.lists.find(l => l.id === id)?.name}"?`)) return;
    setData(prev => ({
      lists: prev.lists.filter(l => l.id !== id),
      tasks: prev.tasks.filter(t => t.listId !== id),
    }));
    if (selectedListId === id) setSelectedListId('general');
  };

  // ── Task actions ──────────────────────────────────────────────────────────

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newTaskText.trim();
    if (!content) return;
    const task: ListTask = { id: genId(), listId: selectedListId, content, done: false };
    setData(prev => ({ ...prev, tasks: [...prev.tasks, task] }));
    setNewTaskText('');
  };

  const toggleTask = (id: string) => {
    setData(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t),
    }));
  };

  const deleteTask = (id: string) => {
    setData(prev => ({ ...prev, tasks: prev.tasks.filter(t => t.id !== id) }));
  };

  const pendingTasks = currentTasks.filter(t => !t.done);
  const doneTasks = currentTasks.filter(t => t.done);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col" dir="rtl">
      <div className="h-1 w-full shrink-0" style={{ background: 'hsl(340 60% 80%)' }} />

      <header className="bg-card shadow-card px-6 py-3 shrink-0 flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted/80 rounded-xl transition-base"
        >
          <ChevronLeft size={14} />
          <span>חזרה</span>
        </button>
        <h1 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <ListTodo size={20} />
          רשימות משימות
        </h1>
      </header>

      <main className="flex-1 flex min-h-0 overflow-hidden">
        {/* Sidebar — list names */}
        <aside className="w-64 shrink-0 bg-card border-l border-border flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">הרשימות שלי</p>
            <div className="space-y-1">
              {data.lists.map(list => {
                const count = data.tasks.filter(t => t.listId === list.id && !t.done).length;
                const isSelected = list.id === selectedListId;
                return (
                  <div
                    key={list.id}
                    className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-base ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted text-foreground'
                    }`}
                    onClick={() => setSelectedListId(list.id)}
                  >
                    <span className="text-sm truncate">{list.name}</span>
                    <div className="flex items-center gap-1.5">
                      {count > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                        }`}>
                          {count}
                        </span>
                      )}
                      {list.id !== 'general' && (
                        <button
                          onClick={e => { e.stopPropagation(); deleteList(list.id); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-base"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add new list */}
          <div className="p-4">
            {isAddingList ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={newListName}
                  onChange={e => setNewListName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addList(); if (e.key === 'Escape') setIsAddingList(false); }}
                  placeholder="שם הרשימה..."
                  className="w-full px-3 py-1.5 text-sm bg-muted rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20"
                  dir="auto"
                />
                <div className="flex gap-2">
                  <button
                    onClick={addList}
                    className="flex-1 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base"
                  >
                    הוסף
                  </button>
                  <button
                    onClick={() => { setIsAddingList(false); setNewListName(''); }}
                    className="flex-1 py-1.5 text-xs font-medium bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-base"
                  >
                    ביטול
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingList(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-base"
              >
                <Plus size={14} />
                <span>רשימה חדשה</span>
              </button>
            )}
          </div>
        </aside>

        {/* Main — tasks */}
        <div className="flex-1 flex flex-col overflow-hidden p-6 gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">{selectedList?.name}</h2>
            <span className="text-sm text-muted-foreground">
              {pendingTasks.length} נשאר · {doneTasks.length} הושלמו
            </span>
          </div>

          {/* Add task input */}
          <form onSubmit={addTask}>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskText}
                onChange={e => setNewTaskText(e.target.value)}
                placeholder="הוסף משימה..."
                dir="auto"
                className="flex-1 px-4 py-2.5 bg-card rounded-xl shadow-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 placeholder:text-muted-foreground/40 transition-base"
              />
              <button
                type="submit"
                disabled={!newTaskText.trim()}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-base disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
          </form>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {pendingTasks.length === 0 && doneTasks.length === 0 && (
              <div className="text-center text-muted-foreground text-sm py-16">
                <ListTodo size={32} className="mx-auto mb-3 opacity-30" />
                <p>אין משימות עדיין</p>
                <p className="text-xs mt-1 opacity-60">הוסיפי משימה ראשונה למעלה</p>
              </div>
            )}

            {pendingTasks.map(task => (
              <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
            ))}

            {doneTasks.length > 0 && (
              <>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">הושלמו</p>
                {doneTasks.map(task => (
                  <TaskRow key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                ))}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── TaskRow ───────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: ListTask;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="group flex items-center gap-3 px-4 py-3 bg-card rounded-xl shadow-card hover:shadow-md transition-base">
      <button
        onClick={() => onToggle(task.id)}
        className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-base ${
          task.done
            ? 'border-[hsl(var(--status-green))] bg-[hsl(var(--status-green))]'
            : 'border-border hover:border-[hsl(var(--status-green))]'
        }`}
      >
        {task.done && <Check size={11} className="text-white" strokeWidth={3} />}
      </button>
      <span
        dir="auto"
        className={`flex-1 text-sm transition-base ${
          task.done ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}
      >
        {task.content}
      </span>
      <button
        onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded-lg transition-base"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
