export type TaskStatus = 'none' | 'green' | 'yellow' | 'red';
export type TaskColor = 'none' | 'blue' | 'purple' | 'orange' | 'pink' | 'teal' | 'red' | 'amber' | 'green' | 'indigo' | 'rose';

export const DAYS = [
  { id: 'sun', label: 'Sunday' },
  { id: 'mon', label: 'Monday' },
  { id: 'tue', label: 'Tuesday' },
  { id: 'wed', label: 'Wednesday' },
  { id: 'thu', label: 'Thursday' },
] as const;

export interface Task {
  id: string;
  content: string;
  originalText?: string;
  status: TaskStatus;
  color: TaskColor;
  dayId: string;
  isDaily: boolean;
  dailyStatuses?: Record<string, TaskStatus>;
  sortOrder: number;
}

export interface LibraryTask {
  id: string;
  content: string;
  originalText?: string;
  color?: TaskColor;
}

export const TASK_COLORS: { id: TaskColor; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'blue', label: 'Blue' },
  { id: 'indigo', label: 'Indigo' },
  { id: 'purple', label: 'Purple' },
  { id: 'pink', label: 'Pink' },
  { id: 'rose', label: 'Rose' },
  { id: 'red', label: 'Red' },
  { id: 'orange', label: 'Orange' },
  { id: 'amber', label: 'Amber' },
  { id: 'green', label: 'Green' },
  { id: 'teal', label: 'Teal' },
];

export function nextStatus(status: TaskStatus): TaskStatus {
  const cycle: TaskStatus[] = ['none', 'green', 'yellow', 'red'];
  const idx = cycle.indexOf(status);
  return cycle[(idx + 1) % cycle.length];
}

export function getWeekSunday(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // shift back to Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekKey(weekStart: Date): string {
  // Use local date components (not UTC) to avoid timezone shifting the date
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDayDate(weekStart: Date, dayIndex: number): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex); // weekStart is already Monday
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getWeekRange(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const s = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const e = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${s} – ${e}`;
}
