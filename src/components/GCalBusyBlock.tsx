import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { Lock, Trash2 } from 'lucide-react';
import type { GCalBusyEvent } from '@/services/googleCalendar';
import { hexToRgba } from '@/lib/task-styles';
import { PX_PER_MINUTE } from '@/lib/calendar-grid';

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
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function GCalBusyBlock({
  event, top, height, left, width, zIndex = 5, onDelete, onResize, isOverlay = false,
}: GCalBusyBlockProps) {
  const [resizeDeltaPx, setResizeDeltaPx] = useState<number | null>(null);
  const [isFront, setIsFront] = useState(false);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `busy_${event.id}` });
  const displayHeight = resizeDeltaPx !== null ? Math.max(20, height + resizeDeltaPx) : height;
  const compact = displayHeight < 40;
  const color = event.calendarColor;

  const style: React.CSSProperties = isOverlay
    ? { width: 180, height: Math.max(height, 32) }
    : {
      position: 'absolute',
      top, height: displayHeight, left, width,
      transform: transform ? CSS.Translate.toString(transform) : undefined,
      opacity: isDragging ? 0.35 : 1,
      zIndex: isDragging || resizeDeltaPx !== null ? 100 : isFront ? 50 : zIndex,
      backgroundColor: hexToRgba(color, 0.85),
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
      const deltaMinutes = (ev.clientY - startY) / PX_PER_MINUTE;
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
      title={`${event.calendarName}: ${event.title}`}
      className={`group rounded-lg border border-border/40 ring-1 ring-card px-2 py-1 overflow-hidden shadow-sm-custom transition-base ${
        isOverlay ? 'shadow-overlay scale-[1.02]' : 'cursor-grab active:cursor-grabbing hover:shadow-hover'
      }`}
    >
      <div className="flex items-center gap-1 min-w-0">
        <Lock size={9} className="shrink-0 opacity-50 text-foreground" />
        <span className="text-[11px] leading-tight truncate flex-1 text-foreground/90">{event.title}</span>
      </div>
      {!compact && (
        <span className="text-[10px] text-muted-foreground">{formatEventTime(event.start)} – {formatEventTime(event.end)}</span>
      )}
      {onDelete && !isOverlay && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(event); }}
          title="Delete from Google Calendar"
          className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 text-foreground/40 hover:text-destructive bg-inherit transition-base"
        >
          <Trash2 size={11} />
        </button>
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
