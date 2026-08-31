import { useDraggable } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, Trash2, Pencil } from 'lucide-react';
import type { GCalBusyEvent } from '@/services/googleCalendar';
import { hexToRgba } from '@/lib/task-styles';
import { PX_PER_MINUTE as BASE_PX_PER_MINUTE, PRIMARY_TEXT_SAFE_PCT } from '@/lib/calendar-grid';
import { usePortalPosition } from '@/lib/usePortalPosition';
import { getDisplayTitle, getOwnOverride, setTitleOverride } from '@/lib/eventTitleOverrides';

const MIN_DURATION_MINUTES = 15;
const RESIZE_SNAP_MINUTES = 15;

interface GCalBusyBlockProps {
  event: GCalBusyEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  zIndex?: number;
  onDelete?: (event: GCalBusyEvent) => void;
  onResize?: (event: GCalBusyEvent, durationMinutes: number) => void;
  isOverlay?: boolean;
  pxPerMinute?: number;
  hasOverlappingSecondary?: boolean;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function GCalBusyBlock({
  event, top, height, left, width, zIndex = 5, onDelete, onResize, isOverlay = false, pxPerMinute = BASE_PX_PER_MINUTE,
  hasOverlappingSecondary = false,
}: GCalBusyBlockProps) {
  const [resizeDeltaPx, setResizeDeltaPx] = useState<number | null>(null);
  const [isFront, setIsFront] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `busy_${event.id}` });
  // A recurring/fixed event she doesn't control the wording of (a
  // third-party service's naming, a shared work calendar's convention)
  // can still be renamed HERE, per explicit request — she wants this in
  // her own hands, not a code change she has to ask for every time. See
  // eventTitleOverrides.ts; keyed by the real title so it survives across
  // every occurrence of a recurring event, not just the one clicked.
  const renamePicker = usePortalPosition();
  const [renameDraft, setRenameDraft] = useState('');
  // Bumped after saving a rename purely to force this component to
  // re-read getDisplayTitle() — the override lives in localStorage, which
  // isn't itself reactive state React would otherwise notice changed.
  const [renameVersion, setRenameVersion] = useState(0);
  const displayTitle = useMemo(() => getDisplayTitle(event.title), [event.title, renameVersion]);
  const openRename = () => { setRenameDraft(getOwnOverride(event.title)); renamePicker.open(); };
  const saveRename = () => { setTitleOverride(event.title, renameDraft); setRenameVersion(v => v + 1); renamePicker.close(); };
  const displayHeight = resizeDeltaPx !== null ? Math.max(20, height + resizeDeltaPx) : height;
  const compact = displayHeight < 40;
  const color = event.calendarColor;
  // See CalendarTaskBlock: side-by-side overlapping blocks are narrower than
  // the column, so bring-to-front also expands to full width to be readable.
  const front = isFront && !isDragging && resizeDeltaPx === null;
  // See CalendarTaskBlock: a primary with a secondary on it must never
  // expand over the full row (or outrank the secondary's z-index) on hover
  // — the secondary sits almost entirely inside its footprint already, so
  // either would bury it with no way to reach it.
  const expandOnFront = front && !hasOverlappingSecondary;

  const style: React.CSSProperties = isOverlay
    ? { width: 180, height: Math.max(height, 32) }
    : {
      position: 'absolute',
      top,
      // See CalendarTaskBlock: the hover delete button needs room that a very
      // short event's own height doesn't have — only grow it while "front".
      height: front ? Math.max(displayHeight, 34) : displayHeight,
      left: expandOnFront ? '0%' : left,
      width: expandOnFront ? '100%' : width,
      opacity: isDragging ? 0.35 : 1,
      zIndex: isDragging || resizeDeltaPx !== null ? 100 : expandOnFront ? 50 : zIndex,
      // Near-opaque so a block with a higher z-index (an overlap secondary)
      // fully occludes whatever renders underneath instead of bleeding through.
      backgroundColor: hexToRgba(color, 0.97),
      borderLeft: `3px solid ${color ?? 'rgba(120,120,120,0.6)'}`,
    };

  const handleResizeStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onResize) return;
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const startDuration = Math.max(MIN_DURATION_MINUTES, Math.round((new Date(event.end).getTime() - new Date(event.start).getTime()) / 60000));
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const handleMove = (ev: PointerEvent) => {
      setResizeDeltaPx(ev.clientY - startY);
    };
    const handleUp = (ev: PointerEvent) => {
      target.releasePointerCapture(e.pointerId);
      target.removeEventListener('pointermove', handleMove);
      target.removeEventListener('pointerup', handleUp);
      setResizeDeltaPx(null);
      const deltaMinutes = (ev.clientY - startY) / pxPerMinute;
      const snapped = Math.max(
        MIN_DURATION_MINUTES,
        Math.round((startDuration + deltaMinutes) / RESIZE_SNAP_MINUTES) * RESIZE_SNAP_MINUTES,
      );
      if (snapped !== startDuration) onResize(event, snapped);
    };
    target.addEventListener('pointermove', handleMove);
    target.addEventListener('pointerup', handleUp);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
      onClick={() => setIsFront(true)}
      onMouseEnter={() => setIsFront(true)}
      onMouseLeave={() => setIsFront(false)}
      title={`${event.calendarName}: ${displayTitle || '(No title)'}`}
      className={`group rounded-lg border border-border/40 ring-1 ring-card px-2 py-1 overflow-hidden shadow-sm-custom ${isDragging ? '' : 'transition-base'} ${
        isOverlay ? 'shadow-overlay scale-[1.02]' : 'cursor-grab active:cursor-grabbing hover:shadow-hover'
      }`}
    >
      <div
        className="flex items-center gap-1 min-w-0"
        // See CalendarTaskBlock: a secondary sitting on top of this block starts
        // partway across the row, so the title needs a matching cutoff or a
        // chunk of it gets visually chopped out by the chip instead of wrapping.
        style={hasOverlappingSecondary && !front ? { maxWidth: `${PRIMARY_TEXT_SAFE_PCT}%` } : undefined}
      >
        <Lock size={9} className="shrink-0 opacity-50 text-foreground" />
        <span className={`text-[11px] leading-tight flex-1 text-foreground/90 ${compact ? 'truncate' : 'break-words'} ${displayTitle ? '' : 'italic opacity-50'}`}>{displayTitle || '(No title)'}</span>
      </div>
      {!compact && (
        <span className="text-[10px] text-foreground/70">{formatEventTime(event.start)} – {formatEventTime(event.end)}</span>
      )}
      {!isOverlay && (
        <div className="absolute top-0.5 right-0.5 flex items-center gap-0.5 opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            ref={renamePicker.btnRef}
            onClick={(e) => { e.stopPropagation(); openRename(); }}
            title="Rename how this shows here (doesn't touch the real Google Calendar event)"
            className="p-0.5 rounded-md shadow-sm-custom text-foreground/40 hover:text-foreground bg-card/95 transition-base"
          >
            <Pencil size={11} />
          </button>
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(event); }}
              title="Delete from Google Calendar"
              className="p-0.5 rounded-md shadow-sm-custom text-foreground/40 hover:text-destructive bg-card/95 transition-base"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      )}
      {renamePicker.pos && createPortal(
        <div
          style={{ position: 'fixed', top: renamePicker.pos.top, right: renamePicker.pos.right }}
          className="z-[200] bg-card rounded-xl shadow-overlay border border-border p-2 flex flex-col gap-1.5 w-56"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') renamePicker.close(); }}
            dir="auto"
            autoFocus
            placeholder={event.title || 'Display name...'}
            className="w-full px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-[10px] text-muted-foreground/70">Only changes how it shows here — the real Google Calendar event is untouched.</p>
          <div className="flex gap-1.5">
            <button onClick={saveRename} className="flex-1 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md transition-base">
              Save
            </button>
            <button onClick={() => renamePicker.close()} className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground rounded-md transition-base">
              Cancel
            </button>
          </div>
        </div>,
        document.body,
      )}

      {onResize && !isOverlay && (
        <div
          onPointerDown={handleResizeStart}
          onClick={(e) => e.stopPropagation()}
          title="Drag to resize"
          className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 flex items-center justify-center transition-base"
        >
          <span className="w-6 h-0.5 rounded-full bg-foreground/30" />
        </div>
      )}
    </div>
  );
}
