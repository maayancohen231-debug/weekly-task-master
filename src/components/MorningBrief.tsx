import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useExclusivePopup } from '@/lib/useExclusivePopup';
import { Sun, X, Mail, CalendarX, ListTodo, RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';
import type { Task } from '@/lib/task-types';
import { DAY_INDEX_TO_ID, getWeekKey, getWeekSunday } from '@/lib/task-types';
import { BANK_ID } from '@/lib/calendar-grid';
import { connectGmail, fetchWeekEvents, isGmailConnected } from '@/services/googleCalendar';
import { fetchOpenEmails, type OpenEmail } from '@/services/gmail';

const MAIL_CACHE_KEY = 'morningBrief:mail';
export const BRIEF_SHOWN_KEY = 'morningBrief:shownOn';

interface MailItem extends OpenEmail { needsReply: boolean; summary: string; action: string; urgent: boolean }
interface Meeting { threadId: string; title: string; date: string | null; time: string | null }
interface MailCache { day: string; fetchedAt: string; items: MailItem[]; meetings: Meeting[] }

export function localDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadCache(): MailCache | null {
  try {
    const c = JSON.parse(localStorage.getItem(MAIL_CACHE_KEY) ?? 'null') as MailCache | null;
    return c && c.day === localDayKey() ? c : null;
  } catch { return null; }
}

function isOpen(t: Task, dayId: string): boolean {
  if (t.isCalendarOnly) return false;
  const status = t.isDaily ? (t.dailyStatuses?.[dayId] ?? 'none') : t.status;
  return status !== 'green';
}

function senderName(from: string): string {
  const name = from.replace(/<[^>]+>/, '').replace(/"/g, '').trim();
  return name || from;
}

function hebrewDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
}

interface Props {
  tasksByWeek: Record<string, Task[]>;
  onClose: () => void;
  onGoogleConnected: () => void;
}

export function MorningBrief({ tasksByWeek, onClose, onGoogleConnected }: Props) {
  useExclusivePopup(true, onClose);
  const now = new Date();
  const todayId = DAY_INDEX_TO_ID[now.getDay()];
  const todayIdx = now.getDay();

  const { today, earlier, lastWeek, bank } = useMemo(() => {
    const sunday = getWeekSunday(now);
    const week = tasksByWeek[getWeekKey(sunday)] ?? [];
    const prevSunday = new Date(sunday);
    prevSunday.setDate(prevSunday.getDate() - 7);
    const prev = tasksByWeek[getWeekKey(prevSunday)] ?? [];
    const dayIndex = (id: string) => Object.entries(DAY_INDEX_TO_ID).find(([, v]) => v === id)?.[0];
    const byTime = (a: Task, b: Task) => (a.startTime ?? '99').localeCompare(b.startTime ?? '99') || a.sortOrder - b.sortOrder;
    return {
      today: week.filter(t => (t.isDaily || t.dayId === todayId) && isOpen(t, todayId)).sort(byTime),
      earlier: week.filter(t => !t.isDaily && t.dayId !== BANK_ID && Number(dayIndex(t.dayId) ?? 99) < todayIdx && isOpen(t, t.dayId)),
      lastWeek: prev.filter(t => !t.isDaily && !t.isWeekly && t.dayId !== BANK_ID && isOpen(t, t.dayId)),
      bank: week.filter(t => t.dayId === BANK_ID && isOpen(t, t.dayId)),
    };
  }, [tasksByWeek]); // eslint-disable-line react-hooks/exhaustive-deps

  const [gmailOn, setGmailOn] = useState(() => isGmailConnected());
  const [mail, setMail] = useState<MailCache | null>(() => loadCache());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { emails } = await fetchOpenEmails();
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(from); to.setDate(to.getDate() + 30);
      const events = await fetchWeekEvents(from.toISOString(), to.toISOString()).catch(() => []);
      const res = await fetch('/api/morning-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayISO: localDayKey(),
          emails: emails.map(({ threadId, from, subject, date, text }) => ({ threadId, from, subject, date, text })),
          events: events.map(e => ({ title: e.title, start: e.start })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Summary failed');
      const verdicts = new Map<string, { needsReply: boolean; summary: string; action: string; urgent: boolean }>(
        (data.emails ?? []).map((e: any) => [e.threadId, e]),
      );
      const items: MailItem[] = emails
        .map(e => {
          const v = verdicts.get(e.threadId);
          return { ...e, needsReply: v?.needsReply ?? false, summary: v?.summary ?? e.subject, action: v?.action ?? '', urgent: v?.urgent ?? false };
        })
        .filter(e => e.needsReply)
        .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.date.localeCompare(a.date));
      const cache: MailCache = { day: localDayKey(), fetchedAt: new Date().toISOString(), items, meetings: data.meetings ?? [] };
      localStorage.setItem(MAIL_CACHE_KEY, JSON.stringify(cache));
      setMail(cache);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      setError(/has not been used|disabled/i.test(msg)
        ? 'צריך להפעיל את Gmail API בפרויקט של Google Cloud.'
        : `לא הצלחתי לקרוא את המייל: ${msg}`);
      setGmailOn(isGmailConnected());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (gmailOn && !mail && !loading) loadMail();
  }, [gmailOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnect = async () => {
    setError(null);
    try {
      await connectGmail();
      onGoogleConnected();
      setGmailOn(true);
    } catch (err: any) {
      setError(`החיבור ל־Gmail לא הצליח: ${err?.message ?? err}`);
    }
  };

  const greeting = now.getHours() < 12 ? 'בוקר טוב' : now.getHours() < 18 ? 'צהריים טובים' : 'ערב טוב';
  const dateLine = now.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4" onClick={onClose}>
      <div
        dir="rtl"
        onClick={e => e.stopPropagation()}
        className="bg-card rounded-2xl shadow-elevated w-full max-w-xl max-h-[88vh] flex flex-col overflow-hidden"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-gradient-to-l from-amber-50 to-card dark:from-amber-950/20">
          <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
            <Sun size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-foreground">{greeting}</h3>
            <p className="text-xs text-muted-foreground">{dateLine} · זה מה שמחכה לך היום</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-muted-foreground/60 hover:text-foreground transition-base" aria-label="סגירה">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
          <Section icon={<ListTodo size={15} />} title="משימות להיום" count={today.length}>
            {today.length === 0 ? <Empty text="אין משימות פתוחות להיום." /> : (
              <ul className="flex flex-col gap-1">
                {today.map(t => (
                  <li key={t.id} className="flex items-center gap-2 text-sm text-foreground">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${t.status === 'red' ? 'bg-[hsl(var(--status-red))]' : t.status === 'yellow' ? 'bg-[hsl(var(--status-yellow))]' : 'bg-primary/60'}`} />
                    {t.startTime && <span className="text-xs text-muted-foreground tabular-nums" dir="ltr">{t.startTime}</span>}
                    <span className="truncate" dir="auto">{t.originalText ?? t.content}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {(earlier.length > 0 || lastWeek.length > 0 || bank.length > 0) && (
            <Section icon={<AlertTriangle size={15} />} title="נשאר להשלים" count={earlier.length + lastWeek.length}>
              <ul className="flex flex-col gap-1">
                {[...earlier, ...lastWeek].slice(0, 12).map(t => (
                  <li key={t.id} className="text-sm text-foreground truncate" dir="auto">
                    • {t.originalText ?? t.content}
                    {lastWeek.includes(t) && <span className="text-[11px] text-muted-foreground"> (משבוע שעבר)</span>}
                  </li>
                ))}
              </ul>
              {earlier.length + lastWeek.length > 12 && (
                <p className="text-xs text-muted-foreground mt-1">ועוד {earlier.length + lastWeek.length - 12}.</p>
              )}
              {bank.length > 0 && <p className="text-xs text-muted-foreground mt-1.5">ובבנק המשימות מחכות {bank.length} משימות בלי יום.</p>}
            </Section>
          )}

          <Section
            icon={<Mail size={15} />}
            title="מיילים שמחכים לתשובה ממך"
            count={mail?.items.length}
            action={gmailOn && (
              <button onClick={loadMail} disabled={loading} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50">
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                רענון
              </button>
            )}
          >
            {!gmailOn ? (
              <div className="rounded-xl bg-muted/60 p-3 text-sm text-foreground flex flex-col gap-2">
                <p>אחבר את המייל שלך בקריאה בלבד, ואסמן כל בוקר מה מחכה לתשובה ואילו פגישות סיכמת ולא נכנסו ליומן. שום מייל לא יישלח בשמך.</p>
                <button onClick={handleConnect} className="self-start px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-base">
                  חיבור Gmail
                </button>
              </div>
            ) : loading && !mail ? (
              <p className="text-sm text-muted-foreground">קוראת את המייל…</p>
            ) : mail && mail.items.length === 0 ? (
              <Empty text="אין מיילים שמחכים לך. 🎉" />
            ) : mail ? (
              <ul className="flex flex-col gap-2">
                {mail.items.map(e => (
                  <li key={e.threadId} className="rounded-xl border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate flex-1" dir="auto">{senderName(e.from)}</span>
                      {e.urgent && <span className="text-[10px] font-bold text-destructive bg-[hsl(var(--status-red-bg))] px-1.5 py-0.5 rounded-md">דחוף</span>}
                      <a href={e.link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary" title="פתיחה ב־Gmail">
                        <ExternalLink size={13} />
                      </a>
                    </div>
                    <p className="text-xs text-muted-foreground truncate" dir="auto">{e.subject}</p>
                    <p className="text-sm text-foreground mt-1" dir="auto">{e.summary}</p>
                    {e.action && <p className="text-xs text-primary font-medium mt-0.5" dir="auto">← {e.action}</p>}
                  </li>
                ))}
              </ul>
            ) : null}
            {error && <p className="text-xs text-destructive mt-2">{error}</p>}
          </Section>

          {gmailOn && mail && (
            <Section icon={<CalendarX size={15} />} title="פגישות שסיכמת ולא ביומן" count={mail.meetings.length}>
              {mail.meetings.length === 0 ? <Empty text="כל הפגישות מהמייל כבר ביומן." /> : (
                <ul className="flex flex-col gap-1">
                  {mail.meetings.map((m, i) => {
                    const src = mail.items.find(e => e.threadId === m.threadId);
                    return (
                      <li key={`${m.threadId}-${i}`} className="text-sm text-foreground">
                        • <span dir="auto">{m.title}</span>
                        <span className="text-xs text-muted-foreground"> · {hebrewDate(m.date)}{m.time ? ` ${m.time}` : ''}</span>
                        {src && <span className="text-xs text-muted-foreground"> · מתוך מייל של {senderName(src.from)}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
          )}

          {mail && (
            <p className="text-[11px] text-muted-foreground">
              המייל נבדק ב־{new Date(mail.fetchedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, count, action, children }: {
  icon: ReactNode; title: string; count?: number; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <h4 className="text-sm font-bold text-foreground">{title}</h4>
        {count !== undefined && count > 0 && (
          <span className="text-[11px] font-semibold bg-muted text-muted-foreground rounded-full px-2 py-0.5 tabular-nums">{count}</span>
        )}
        <span className="flex-1" />
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}
