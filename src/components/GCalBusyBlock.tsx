import { Lock } from 'lucide-react';
import type { GCalBusyEvent } from '@/services/googleCalendar';

interface GCalBusyBlockProps {
  event: GCalBusyEvent;
  top: number;
  height: number;
  left: string;
  width: string;
}

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function GCalBusyBlock({ event, top, height, left, width }: GCalBusyBlockProps) {
  const compact = height < 40;
  return (
    <div
      title={`${event.calendarName}: ${event.title}`}
      style={{ position: 'absolute', top, height, left, width }}
      className="rounded-lg border border-border/50 bg-[repeating-linear-gradient(135deg,hsl(var(--muted))_0px,hsl(var(--muted))_6px,transparent_6px,transparent_12px)] bg-muted/50 px-2 py-1 overflow-hidden text-muted-foreground"
    >
      <div className="flex items-center gap-1 min-w-0">
        <Lock size={10} className="shrink-0 opacity-60" />
        <span className="text-[11px] leading-tight truncate flex-1">{event.title}</span>
      </div>
      {!compact && (
        <span className="text-[10px] opacity-70">{formatEventTime(event.start)}</span>
      )}
    </div>
  );
}
