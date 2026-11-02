import { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, X, Loader2 } from 'lucide-react';
import { usePortalPosition } from '@/lib/usePortalPosition';
import { fetchEventAttendees, setEventAttendees, type GCalAttendee } from '@/services/googleCalendar';

// Emails she has invited before, newest first — offered as autocomplete so
// inviting the same few people again is a couple of keystrokes, not retyping.
const RECENT_KEY = 'recentInviteEmails';
const RECENT_MAX = 30;

function loadRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}
function rememberRecent(emails: string[]) {
  try {
    const next = [...emails, ...loadRecent().filter(e => !emails.includes(e))].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* storage unavailable — autocomplete just stays empty */ }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STATUS_LABEL: Record<string, string> = {
  accepted: 'Yes',
  declined: 'No',
  tentative: 'Maybe',
  needsAction: 'Invited',
};

interface InvitePeopleButtonProps {
  calendarId: string;
  eventId: string;
  className?: string;
}

/**
 * Invite people to the real Google Calendar event behind a block — Google
 * itself sends the invitation email (sendUpdates=all), exactly as if she'd
 * added the guest in Google Calendar.
 */
export function InvitePeopleButton({ calendarId, eventId, className }: InvitePeopleButtonProps) {
  const picker = usePortalPosition();
  const [attendees, setAttendees] = useState<GCalAttendee[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = `invite-recent-${eventId}`;

  const open = async () => {
    picker.open();
    setError(null);
    setDraft('');
    setAttendees(null);
    try {
      setAttendees(await fetchEventAttendees(calendarId, eventId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load guests');
      setAttendees([]);
    }
  };

  const save = async (next: GCalAttendee[]) => {
    setBusy(true);
    setError(null);
    try {
      setAttendees(await setEventAttendees(calendarId, eventId, next));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update guests');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    // Accept several at once — pasted "a@x.com, b@y.com" or one per line.
    const emails = draft.split(/[\s,;]+/).map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) return;
    const bad = emails.filter(e => !EMAIL_RE.test(e));
    if (bad.length) { setError(`Not an email: ${bad.join(', ')}`); return; }
    const current = attendees ?? [];
    const fresh = emails.filter(e => !current.some(a => a.email.toLowerCase() === e));
    if (fresh.length === 0) { setDraft(''); return; }
    if (await save([...current, ...fresh.map(email => ({ email }))])) {
      rememberRecent(fresh);
      setDraft('');
    }
  };

  const remove = (email: string) => save((attendees ?? []).filter(a => a.email !== email));

  return (
    <>
      <button
        ref={picker.btnRef}
        onClick={(e) => { e.stopPropagation(); picker.pos ? picker.close() : open(); }}
        title="Invite people"
        className={className}
      >
        <UserPlus size={11} />
      </button>
      {picker.pos && createPortal(
        <div
          ref={picker.popRef}
          style={{ position: 'fixed', top: picker.pos.top, right: picker.pos.right }}
          className="z-[200] bg-card rounded-xl shadow-overlay border border-border p-2 flex flex-col gap-1.5 w-64"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-semibold text-foreground px-0.5">Invite people</p>
          <div className="flex gap-1">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') invite(); }}
              list={listId}
              type="text"
              inputMode="email"
              dir="ltr"
              autoFocus
              placeholder="name@email.com"
              className="flex-1 min-w-0 px-2 py-1.5 bg-muted border-none rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <datalist id={listId}>
              {loadRecent().map(e => <option key={e} value={e} />)}
            </datalist>
            <button
              onClick={invite}
              disabled={busy || !draft.trim()}
              className="px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-md transition-base disabled:opacity-40"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : 'Invite'}
            </button>
          </div>
          {error && <p className="text-[10px] text-destructive px-0.5">{error}</p>}
          {attendees === null ? (
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground px-0.5"><Loader2 size={10} className="animate-spin" /> Loading guests…</p>
          ) : attendees.filter(a => !a.organizer).length > 0 ? (
            <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto scroll-thin">
              {attendees.filter(a => !a.organizer).map(a => (
                <div key={a.email} className="flex items-center gap-1.5 px-1.5 py-1 rounded-lg hover:bg-muted text-[11px]">
                  <span className="flex-1 min-w-0 truncate text-foreground/85" dir="ltr" title={a.email}>{a.displayName || a.email}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{STATUS_LABEL[a.responseStatus ?? 'needsAction']}</span>
                  <button
                    onClick={() => remove(a.email)}
                    disabled={busy}
                    title="Remove (Google sends them a cancellation)"
                    className="shrink-0 p-0.5 text-muted-foreground/50 hover:text-destructive rounded transition-base"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/70 px-0.5">No guests yet. Google emails each person an invitation.</p>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
