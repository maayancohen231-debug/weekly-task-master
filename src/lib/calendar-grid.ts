export const GRID_START_HOUR = 6;
export const GRID_END_HOUR = 24;
export const SLOT_MINUTES = 30;
export const PX_PER_HOUR = 36;
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

const CASCADE_WIDTH_PCT = 88;
const CASCADE_OFFSET_PCT = 13;

/**
 * Turns a column index / column count from layoutOverlaps into an on-screen
 * position — concurrent events keep the same width regardless of how many
 * overlap and stack on top of one another, each offset just enough that the
 * one(s) underneath still peek out from behind it (cascading/deck-of-cards
 * style), instead of splitting the column width N ways. Z-order follows
 * column index so later-starting events sit on top by default; components
 * are expected to bump z-index further on hover/interaction so a covered
 * block can still be brought fully to the front to read.
 */
export function cascadePosition(col: number, totalCols: number): { leftPct: number; widthPct: number; z: number } {
  if (totalCols <= 1) return { leftPct: 0, widthPct: 100, z: 5 };
  const maxLeft = 100 - CASCADE_WIDTH_PCT;
  const leftPct = Math.min(col * CASCADE_OFFSET_PCT, maxLeft);
  return { leftPct, widthPct: CASCADE_WIDTH_PCT, z: 5 + col };
}

const GRID_TOTAL_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/**
 * Converts a (possibly out-of-range) start/end minute pair — relative to grid
 * start — into an on-screen {top, height} in px, clamped to the visible grid
 * so an event starting before GRID_START_HOUR or ending after GRID_END_HOUR
 * never renders with a negative offset or spills past the column's bottom.
 * pxPerMinute defaults to the base (unzoomed) density but the caller passes
 * the current zoom-adjusted value so blocks stay aligned to the grid lines.
 */
export function clampToGridPx(startMin: number, endMin: number, pxPerMinute: number = PX_PER_MINUTE): { top: number; height: number } {
  const clampedStart = Math.max(0, Math.min(startMin, GRID_TOTAL_MINUTES));
  const clampedEnd = Math.max(0, Math.min(endMin, GRID_TOTAL_MINUTES));
  const top = clampedStart * pxPerMinute;
  const height = Math.max(2, (clampedEnd - clampedStart) * pxPerMinute - 2);
  return { top, height };
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
