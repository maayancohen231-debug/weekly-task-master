import { useRef, useState } from 'react';
import { CalendarPlus, Loader2, Send, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export interface QuickAddResult {
  ok: true;
  message: string;
  link?: string;
}

interface QuickAddPanelProps {
  onSubmit: (text: string) => Promise<QuickAddResult>;
  disabled: boolean;
}

export function QuickAddPanel({ onSubmit, disabled }: QuickAddPanelProps) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [feedback, setFeedback] = useState<{ message: string; link?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = async () => {
    if (!value.trim() || status === 'submitting') return;
    setStatus('submitting');
    setFeedback(null);
    try {
      const result = await onSubmit(value);
      setStatus('success');
      setFeedback({ message: result.message, link: result.link });
      setValue('');
    } catch (err) {
      setStatus('error');
      setFeedback({ message: err instanceof Error ? err.message : 'Something went wrong' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex flex-col gap-2 bg-card rounded-2xl shadow-card p-4">
      <div className="flex items-center gap-1.5">
        <CalendarPlus size={14} className="shrink-0 text-primary" />
        <p className="text-xs font-semibold text-foreground">Quick add</p>
      </div>

      {disabled ? (
        <p className="text-[11px] text-muted-foreground/50">Connect Google Calendar to use quick add.</p>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground/50">
            Type a date, time, and title — e.g. "11.8", "13:30", "Interview with Alice".
          </p>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); if (status !== 'idle') { setStatus('idle'); setFeedback(null); } }}
            onKeyDown={handleKeyDown}
            dir="auto"
            rows={3}
            placeholder={'11.8\n13:30\nInterview with Alice'}
            className="w-full px-3 py-2 bg-muted border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/30 resize-none"
          />
          <button
            onClick={submit}
            disabled={!value.trim() || status === 'submitting'}
            className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-40 transition-base"
          >
            {status === 'submitting' ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Add to calendar
          </button>

          {feedback && (
            <div
              className={`flex items-start gap-1.5 px-2.5 py-2 rounded-lg text-[11px] ${
                status === 'error'
                  ? 'bg-[hsl(var(--status-red-bg))] text-destructive'
                  : 'bg-[hsl(var(--status-green-bg))] text-[hsl(var(--status-green))]'
              }`}
            >
              {status === 'error' ? (
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 size={12} className="shrink-0 mt-0.5" />
              )}
              <span className="flex-1 break-words" dir="auto">
                {feedback.message}
                {feedback.link && (
                  <>
                    {' '}
                    <a href={feedback.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
                      view <ExternalLink size={10} />
                    </a>
                  </>
                )}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
