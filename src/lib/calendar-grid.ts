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
  /** This is the one long "background" event of its cluster. */
  isPrimary: boolean;
  /** This item's cluster has a primary (set on every item in that cluster, including the primary itself). */
  hasPrimary: boolean;
}

const SIDE_BY_SIDE_GAP_PCT = 3;
const PRIMARY_WIDTH_PCT = 78;
const SECONDARY_STRIP_LEFT_PCT = 62;

/**
 * Turns an overlap-cluster position from layoutOverlaps into an on-screen
 * position.
 *
 * Clusters with one clearly-longer "background" event (e.g. a 2-hour block
 * with a couple of short 15-30min ones happening at some point during it)
 * give that event most of the column width; the short ones share a narrow
 * strip layered on top of it instead of all splitting the column equally —
 * cramming a 2-hour event into a 1/6 slice just because six unrelated short
 * events also occur somewhere within its span wastes the one that actually
 * needs the room. Clusters of comparably-sized genuinely-concurrent events
 * (two overlapping meetings, say) still split evenly, Google Calendar style.
 */
export function cascadePosition(layout: Pick<OverlapLayout, 'col' | 'totalCols' | 'isPrimary' | 'hasPrimary'>): { leftPct: number; widthPct: number; z: number } {
  const { col, totalCols, isPrimary, hasPrimary } = layout;

  if (isPrimary) return { leftPct: 0, widthPct: PRIMARY_WIDTH_PCT, z: 5 };

  if (hasPrimary) {
    const stripWidth = 100 - SECONDARY_STRIP_LEFT_PCT;
    if (totalCols <= 1) return { leftPct: SECONDARY_STRIP_LEFT_PCT, widthPct: stripWidth, z: 10 };
    const slotPct = stripWidth / totalCols;
    const leftPct = SECONDARY_STRIP_LEFT_PCT + col * slotPct;
    const widthPct = Math.max(slotPct - SIDE_BY_SIDE_GAP_PCT, slotPct * 0.7);
    return { leftPct, widthPct, z: 10 + col };
  }

  if (totalCols <= 1) return { leftPct: 0, widthPct: 100, z: 5 };
  const slotPct = 100 / totalCols;
  const leftPct = col * slotPct;
  const widthPct = Math.max(slotPct - SIDE_BY_SIDE_GAP_PCT, slotPct * 0.7);
  return { leftPct, widthPct, z: 5 + col };
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

  // Greedy column assignment (interval-graph coloring) over whatever set of
  // items it's given — used both for a whole cluster and, when there's a
  // primary, for just its secondaries among themselves.
  const assignColumns = (items: OverlapInterval[]): { cols: Map<string, number>; totalCols: number } => {
    const columnEnds: number[] = [];
    const cols = new Map<string, number>();
    for (const item of items) {
      let col = columnEnds.findIndex(end => end <= item.startMin);
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[col] = item.endMin;
      }
      cols.set(item.id, col);
    }
    return { cols, totalCols: columnEnds.length };
  };

  const flushCluster = () => {
    if (clusterItems.length === 1) {
      const item = clusterItems[0];
      result.set(item.id, { col: 0, totalCols: 1, isPrimary: false, hasPrimary: false });
      return;
    }

    const durationOf = (it: OverlapInterval) => it.endMin - it.startMin;
    const maxDuration = Math.max(...clusterItems.map(durationOf));
    const primaryCandidates = clusterItems.filter(it => durationOf(it) === maxDuration);
    const secondDuration = Math.max(0, ...clusterItems.filter(it => durationOf(it) !== maxDuration).map(durationOf));
    // Only promote a single, unambiguous, meaningfully-longer event — ties or
    // a cluster of comparably-sized events falls through to a plain equal split.
    const usePrimary = primaryCandidates.length === 1 && maxDuration >= 60 && maxDuration >= secondDuration * 1.5;

    if (usePrimary) {
      const primary = primaryCandidates[0];
      result.set(primary.id, { col: 0, totalCols: 1, isPrimary: true, hasPrimary: true });
      const secondaries = clusterItems.filter(it => it.id !== primary.id);
      const { cols, totalCols } = assignColumns(secondaries);
      for (const item of secondaries) {
        result.set(item.id, { col: cols.get(item.id)!, totalCols, isPrimary: false, hasPrimary: true });
      }
      return;
    }

    const { cols, totalCols } = assignColumns(clusterItems);
    for (const item of clusterItems) {
      result.set(item.id, { col: cols.get(item.id)!, totalCols, isPrimary: false, hasPrimary: false });
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
