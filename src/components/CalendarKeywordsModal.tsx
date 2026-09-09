import { useState } from 'react';
import { Tags, X, Trash2 } from 'lucide-react';
import type { GCalCalendar } from '@/services/googleCalendar';

interface Props {
  calendars: GCalCalendar[];
  learnedKeywords: Record<string, string>;
  onAdd: (keyword: string, calendarId: string) => void;
  onRemove: (keyword: string) => void;
  onClose: () => void;
}

export function CalendarKeywordsModal({ calendars, learnedKeywords, onAdd, onRemove, onClose }: Props) {
  const [word, setWord] = useState('');
  const [calendarId, setCalendarId] = useState(calendars[0]?.id ?? '');

  const submit = () => {
    const trimmed = word.trim();
    if (!trimmed || !calendarId) return;
    onAdd(trimmed, calendarId);
    setWord('');
  };

  const entries = Object.entries(learnedKeywords).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-elevated w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Tags size={14} className="text-primary" />
          <h3 className="flex-1 text-sm font-bold text-foreground">Calendar Keywords</h3>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground/50 hover:text-foreground transition-base" aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-muted-foreground">
          Any task whose text contains a word below auto-syncs to its matching calendar — no need to wait to be asked.
        </p>

        <div className="px-4 pt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <input
              value={word}
              onChange={(e) => setWord(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="e.g. gym, פאודה, לימודים"
              dir="auto"
              className="flex-1 min-w-0 px-2.5 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <select
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              className="shrink-0 max-w-[130px] px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {calendars.map(cal => (
                <option key={cal.id} value={cal.id}>{cal.summary}</option>
              ))}
            </select>
            <button
              onClick={submit}
              disabled={!word.trim() || !calendarId}
              className="shrink-0 px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-lg disabled:opacity-40 transition-base"
            >
              Add
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
          {entries.length === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-6">No keywords yet — add one above.</p>
          )}
          {entries.map(([keyword, calId]) => {
            const cal = calendars.find(c => c.id === calId);
            return (
              <div key={keyword} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition-base">
                <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate" dir="auto">{keyword}</span>
                <span className="shrink-0 flex items-center gap-1.5 text-[11px] text-muted-foreground max-w-[120px]">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cal?.backgroundColor ?? '#999' }} />
                  <span className="truncate">{cal?.summary ?? calId}</span>
                </span>
                <button onClick={() => onRemove(keyword)} className="shrink-0 p-1 rounded-full text-muted-foreground/50 hover:text-destructive transition-base" aria-label="Remove">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
