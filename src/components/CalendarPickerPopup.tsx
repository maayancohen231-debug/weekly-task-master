import { useState, useEffect, useRef } from 'react';
import { X, Calendar, Loader2, AlertCircle } from 'lucide-react';
import {
  fetchCalendars, matchCalendarName,
  requestToken, isTokenValid, isConfigured,
} from '@/services/googleCalendar';
import type { GCalCalendar } from '@/services/googleCalendar';

interface CalendarPickerPopupProps {
  taskContent: string;
  onAssign: (calendarId: string, calendarName: string) => void;
  onCancel: () => void;
}

type Step = 'loading' | 'form' | 'error';

export function CalendarPickerPopup({ taskContent, onAssign, onCancel }: CalendarPickerPopupProps) {
  const [step, setStep] = useState<Step>('loading');
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        if (!isConfigured()) throw new Error('Client ID not configured');
        if (!isTokenValid()) {
          await requestToken('consent');
        }
        const cals = await fetchCalendars();
        if (cals.length === 0) throw new Error('No calendars found');
        const matched = matchCalendarName(taskContent, cals);
        setCalendars(cals);
        setSelectedCalendarId((matched ?? cals[0]).id);
        setStep('form');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load calendars');
        setStep('error');
      }
    };
    load();
  }, [taskContent]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onCancel();
  };

  const handleAssign = () => {
    if (!selectedCalendarId) return;
    const cal = calendars.find(c => c.id === selectedCalendarId);
    onAssign(selectedCalendarId, cal?.summary ?? '');
  };

  const selectedCal = calendars.find(c => c.id === selectedCalendarId);

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
    >
      <div className="bg-card rounded-2xl shadow-overlay w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Calendar size={17} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Which calendar?</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-base">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Task</p>
          <p className="text-sm font-semibold text-foreground line-clamp-2">{taskContent}</p>
        </div>

        <div className="px-5 py-4 min-h-[120px] flex flex-col justify-center">
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Connecting to Google Calendar...</p>
            </div>
          )}

          {step === 'error' && (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <AlertCircle size={28} className="text-destructive" />
              <p className="text-sm font-semibold text-foreground">Something went wrong</p>
              <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-xl font-mono">
                {errorMsg}
              </p>
              <button
                onClick={onCancel}
                className="mt-2 px-4 py-2 text-sm bg-muted hover:bg-muted/80 text-foreground rounded-xl transition-base"
              >
                Close
              </button>
            </div>
          )}

          {step === 'form' && (
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
          )}
        </div>

        {step === 'form' && (
          <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground rounded-xl transition-base">
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedCalendarId}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-base"
            >
              <Calendar size={14} />
              Assign
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
