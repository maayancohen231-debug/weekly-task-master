import { Lock, Trash2 } from 'lucide-react';
import type { GCalBusyEvent } from '@/services/googleCalendar';
import { hexToRgba } from '@/lib/task-styles';

interface GCalBusyBlockProps {
  event: GCalBusyEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  zIndex?: number;
  onDelete?: (event: GCalBusyEvent) => void;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function GCalBusyBlock({ event, top, height, left, width, zIndex = 5, onDelete }: GCalBusyBlockProps) {
  const compact = height < 40;
  const color = event.calendarColor;
  return (
    <div
      title={`${event.calendarName}: ${event.title}`}
      style={{
        position: 'absolute', top, height, left, width, zIndex,
        backgroundColor: hexToRgba(color, 0.85),
        borderLeft: `3px solid ${color ?? 'rgba(120,120,120,0.6)'}`,
      }}
      className="group rounded-lg border border-border/40 px-2 py-1 overflow-hidden shadow-sm-custom"
    >
      <div className="flex items-center gap-1 min-w-0">
        <Lock size={9} className="shrink-0 opacity-50 text-foreground" />
        <span className="text-[11px] leading-tight truncate flex-1 text-foreground/90">{event.title}</span>
      </div>
      {!compact && (
        <span className="text-[10px] text-muted-foreground">{formatEventTime(event.start)} – {formatEventTime(event.end)}</span>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(event); }}
          title="Delete from Google Calendar"
          className="absolute top-0.5 right-0.5 p-0.5 rounded opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 text-foreground/40 hover:text-destructive bg-inherit transition-base"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}
