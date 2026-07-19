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
  startTime?: string; // "HH:mm", 24h
  durationMinutes?: number;
  calendarId?: string;
}

export interface LibraryTask {
  id: string;
  content: string;
  originalText?: string;
  color?: TaskColor;
  startTime?: string; // "HH:mm", 24h
  durationMinutes?: number;
  calendarId?: string; // remembered calendar for repeat drags of this template
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

export const DAY_INDEX_TO_ID: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu' };

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

/** Combine a week's Sunday, a day offset, and an "HH:mm" time into a local "YYYY-MM-DDTHH:mm" string. */
export function formatLocalDateTime(weekStart: Date, dayIndex: number, time: string): string {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayIndex);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}T${time}`;
}

/** Map a real Date to a day id (sun..thu) within the given week, or null if outside the visible range. */
export function getDayIdForDate(date: Date, weekStart: Date): string | null {
  const start = new Date(weekStart);
  start.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d.getTime() - start.getTime()) / 86_400_000);
  return DAY_INDEX_TO_ID[diffDays] ?? null;
}
