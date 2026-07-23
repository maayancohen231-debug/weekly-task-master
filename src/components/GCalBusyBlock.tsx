import { Lock } from 'lucide-react';
import type { GCalBusyEvent } from '@/services/googleCalendar';

interface GCalBusyBlockProps {
  event: GCalBusyEvent;
  top: number;
  height: number;
  left: string;
  width: string;
  zIndex?: number;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** "#rrggbb" -> "rgba(r,g,b,alpha)", falling back to a neutral gray if missing/invalid. */
function hexToRgba(hex: string | undefined, alpha: number): string {
  const match = hex?.match(/^#?([0-9a-f]{6})$/i);
  if (!match) return `rgba(120,120,120,${alpha})`;
  const int = parseInt(match[1], 16);
  const r = (int >> 16) & 255, g = (int >> 8) & 255, b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function GCalBusyBlock({ event, top, height, left, width, zIndex = 5 }: GCalBusyBlockProps) {
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
      className="rounded-lg border border-border/40 px-2 py-1 overflow-hidden shadow-sm-custom"
    >
      <div className="flex items-center gap-1 min-w-0">
        <Lock size={9} className="shrink-0 opacity-50 text-foreground" />
        <span className="text-[11px] leading-tight truncate flex-1 text-foreground/90">{event.title}</span>
      </div>
      {!compact && (
        <span className="text-[10px] text-muted-foreground">{formatEventTime(event.start)} – {formatEventTime(event.end)}</span>
      )}
    </div>
  );
}
