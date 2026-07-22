export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 22;
export const SLOT_MINUTES = 30;
export const PX_PER_HOUR = 72;
export const PX_PER_MINUTE = PX_PER_HOUR / 60;

export const GRID_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i,
);

export const SLOTS_PER_DAY = ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES;

/** "HH:mm" -> minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** minutes since midnight -> "HH:mm". */
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Vertical pixel offset from the top of the grid for a given "HH:mm" time. */
export function minutesFromGridStart(time: string): number {
  return timeToMinutes(time) - GRID_START_HOUR * 60;
}

export function slotId(dayId: string, time: string): string {
  return `slot::${dayId}::${time}`;
}

export function isSlotId(id: string): boolean {
  return id.startsWith('slot::');
}

export function parseSlotId(id: string): { dayId: string; time: string } | null {
  if (!isSlotId(id)) return null;
  const [, dayId, time] = id.split('::');
  return { dayId, time };
}

export const BANK_ID = 'bank';

/** All slot start times ("HH:mm") for one day, at SLOT_MINUTES granularity. */
export const SLOT_TIMES: string[] = Array.from({ length: SLOTS_PER_DAY }, (_, i) =>
  minutesToTime(GRID_START_HOUR * 60 + i * SLOT_MINUTES),
);

export interface OverlapInterval {
  id: string;
  startMin: number;
  endMin: number;
}

export interface OverlapLayout {
  col: number;
  totalCols: number;
}

/**
 * Assigns each interval a column index and the total column count of its overlap
 * cluster, so concurrent blocks in the same day can be laid out side-by-side
 * (interval-graph coloring, same idea Google Calendar uses for concurrent events).
 */
export function layoutOverlaps(items: OverlapInterval[]): Map<string, OverlapLayout> {
  const result = new Map<string, OverlapLayout>();
  if (items.length === 0) return result;

  const sorted = [...items].sort((a, b) => a.startMin - b.startMin);

  // Group into clusters of transitively-overlapping intervals.
  let clusterEnd = sorted[0].endMin;
  let clusterItems: OverlapInterval[] = [sorted[0]];

  const flushCluster = () => {
    // Greedy column assignment within the cluster.
    const columnEnds: number[] = [];
    const cols = new Map<string, number>();
    for (const item of clusterItems) {
      let col = columnEnds.findIndex(end => end <= item.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[col] = item.endMin;
      }
      cols.set(item.id, col);
    }
    const totalCols = columnEnds.length;
    for (const item of clusterItems) {
      result.set(item.id, { col: cols.get(item.id)!, totalCols });
    }
  };

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (item.startMin < clusterEnd) {
      clusterItems.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      flushCluster();
      clusterItems = [item];
      clusterEnd = item.endMin;
    }
  }
  flushCluster();

  return result;
}
