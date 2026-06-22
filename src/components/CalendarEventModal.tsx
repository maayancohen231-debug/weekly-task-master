import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  fetchCalendars, createCalendarEvent, matchCalendarName, saveSyncedEvent,
  requestToken, isTokenValid, isConfigured,
} from '@/services/googleCalendar';
import type { GCalCalendar, SyncedEventInfo } from '@/services/googleCalendar';
import type { Task } from '@/lib/task-types';

interface CalendarEventModalProps {
  task: Task;
  onClose: () => void;
  onSynced: (taskId: string, info: SyncedEventInfo) => void;
}

type ModalStep = 'loading' | 'form' | 'creating' | 'success' | 'error';

function defaultDatetime(): string {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  // Format as "YYYY-MM-DDTHH:mm" for datetime-local input
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export function CalendarEventModal({ task, onClose, onSynced }: CalendarEventModalProps) {
  const [step, setStep] = useState<ModalStep>('loading');
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [datetime, setDatetime] = useState(defaultDatetime());
  const [description, setDescription] = useState('');
  const [detectedCalendarName, setDetectedCalendarName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ htmlLink: string; calendarName: string } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!isConfigured()) throw new Error('Client ID not configured');
        if (!isTokenValid()) {
          await requestToken('consent');
        }
        const cals = await fetchCalendars();
        const matched = matchCalendarName(task.content, cals);
        setCalendars(cals);
        setSelectedCalendarId(matched?.id ?? cals[0]?.id ?? '');
        setDetectedCalendarName(matched?.summary ?? '');
        setStep('form');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load calendars');
        setStep('error');
      }
    };
    load();
  }, [task.content]);

  const handleCreate = async () => {
    if (!selectedCalendarId || !datetime) return;
    setStep('creating');
    try {
      const event = await createCalendarEvent(selectedCalendarId, task.content, datetime, description);
      const cal = calendars.find(c => c.id === selectedCalendarId);
      const info: SyncedEventInfo = {
        eventId: event.id,
        calendarId: selectedCalendarId,
        calendarName: cal?.summary ?? '',
        htmlLink: event.htmlLink,
        syncedAt: new Date().toISOString(),
      };
      saveSyncedEvent(task.id, info);
      onSynced(task.id, info);
      setSuccessInfo({ htmlLink: event.htmlLink, calendarName: cal?.summary ?? '' });
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create event');
      setStep('error');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const selectedCal = calendars.find(c => c.id === selectedCalendarId);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="bg-card rounded-2xl shadow-overlay w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar size={17} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Add to Google Calendar</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
            <X size={16} />
          </button>
        </div>

        {/* Task name */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Task</p>
          <p className="text-sm font-semibold text-foreground line-clamp-2">{task.content}</p>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 min-h-[200px] flex flex-col justify-center">

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting to Google Calendar...</p>
            </div>
          )}

          {/* Creating */}
          {step === 'creating' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Creating event...</p>
            </div>
          )}

          {/* Error */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle size={28} className="text-destructive" />
              <p className="text-sm font-semibold text-foreground">Something went wrong</p>
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-xl font-mono">
                {errorMsg}
              </p>
              <button
                onClick={onClose}
                className="mt-2 px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-base"
              >
                Close
              </button>
            </div>
          )}

          {/* Success */}
          {step === 'success' && successInfo && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 size={28} className="text-[hsl(var(--status-green))]" />
              <p className="text-sm font-semibold text-foreground">Event created!</p>
              <p className="text-xs text-muted-foreground">
                Added to <span className="font-medium text-foreground">{successInfo.calendarName}</span>
              </p>
              <a
                href={successInfo.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 mt-1 text-sm font-medium bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base"
              >
                <ExternalLink size={14} />
                View in Google Calendar
              </a>
              <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-base">
                Close
              </button>
            </div>
          )}

          {/* Form */}
          {step === 'form' && (
            <>
              {/* Calendar selector */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Calendar
                  {detectedCalendarName && (
                    <span className="ml-2 normal-case text-primary font-semibold">
                      ✦ auto-detected
                    </span>
                  )}
                </label>
                <div className="relative">
                  {selectedCal?.backgroundColor && (
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full pointer-events-none"
                      style={{ background: selectedCal.backgroundColor }}
                    />
                  )}
                  <select
                    value={selectedCalendarId}
                    onChange={e => setSelectedCalendarId(e.target.value)}
                    className={`w-full py-2.5 pr-3 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none ${selectedCal?.backgroundColor ? 'pl-8' : 'pl-3'}`}
                  >
                    {calendars.map(cal => (
                      <option key={cal.id} value={cal.id}>{cal.summary}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date + time */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Date & Time <span className="normal-case text-muted-foreground/60">(30 min event)</span>
                </label>
                <input
                  type="datetime-local"
                  value={datetime}
                  onChange={e => setDatetime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Description (optional) */}
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                  Description <span className="normal-case text-muted-foreground/60">(optional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Add notes..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-secondary/50 border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/40"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl transition-base">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={!selectedCalendarId || !datetime}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-base"
            >
              <Calendar size={14} />
              Add to Calendar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
