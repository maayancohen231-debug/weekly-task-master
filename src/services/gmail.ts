/**
 * Read-only Gmail access for the morning brief. Runs in the browser with the
 * same Google token as Calendar (gmail.readonly added via connectGmail), so
 * the token never reaches our server; only short email texts are sent to
 * /api/morning-brief for summarising.
 */
import { getValidToken, clearToken, markGmailDisconnected } from '@/services/googleCalendar';

export interface OpenEmail {
  threadId: string;
  from: string;
  subject: string;
  date: string; // ISO
  unread: boolean;
  text: string; // last message, quoted history stripped, truncated
  link: string;
}

const BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

async function gmailGet<T>(path: string): Promise<T> {
  const token = await getValidToken();
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    clearToken();
    throw new Error('Google session expired. Please reconnect.');
  }
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}));
    const msg: string = body?.error?.message ?? '';
    if (/insufficient|scope/i.test(msg)) markGmailDisconnected();
    throw new Error(msg || 'Gmail access denied');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Gmail error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface Part { mimeType?: string; body?: { data?: string }; parts?: Part[] }
interface Message {
  id: string;
  labelIds?: string[];
  internalDate?: string;
  snippet?: string;
  payload?: Part & { headers?: { name: string; value: string }[] };
}

function decodeB64Url(data: string): string {
  try {
    const bin = atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch { return ''; }
}

function findBody(part: Part | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decodeB64Url(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findBody(p, mime);
    if (found) return found;
  }
  return null;
}

/** Drops quoted history ("On … wrote:", "> …") so only the new message is summarised. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*(On .+wrote:|ב.+כתב\/?ה?:|-----Original Message-----|From: .+|מאת: .+)\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function emailAddress(header: string): string {
  const m = header.match(/<([^>]+)>/);
  return (m ? m[1] : header).trim().toLowerCase();
}

/**
 * Inbox threads from the last 10 days where the last message is from someone
 * else, i.e. she hasn't answered yet. Promotions/social/updates are skipped.
 */
export async function fetchOpenEmails(max = 25): Promise<{ me: string; emails: OpenEmail[] }> {
  const profile = await gmailGet<{ emailAddress: string }>('/profile');
  const me = profile.emailAddress.toLowerCase();
  const q = 'in:inbox newer_than:10d -category:promotions -category:social -category:updates -category:forums';
  const list = await gmailGet<{ threads?: { id: string }[] }>(`/threads?maxResults=${max}&q=${encodeURIComponent(q)}`);

  const threads = await Promise.allSettled(
    (list.threads ?? []).map(t => gmailGet<{ id: string; messages?: Message[] }>(`/threads/${t.id}?format=full`)),
  );

  const emails: OpenEmail[] = [];
  for (const r of threads) {
    if (r.status !== 'fulfilled') continue;
    const thread = r.value;
    const last = thread.messages?.[thread.messages.length - 1];
    if (!last?.payload) continue;
    const header = (name: string) =>
      last.payload!.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
    const from = header('From');
    if (!from || emailAddress(from) === me) continue; // she wrote last
    if (/no-?reply|do-?not-?reply|mailer-daemon/i.test(from)) continue;

    const plain = findBody(last.payload, 'text/plain');
    const html = plain ? null : findBody(last.payload, 'text/html');
    const raw = plain ?? (html ? htmlToText(html) : last.snippet ?? '');
    emails.push({
      threadId: thread.id,
      from,
      subject: header('Subject') || '(ללא נושא)',
      date: new Date(Number(last.internalDate ?? Date.now())).toISOString(),
      unread: (last.labelIds ?? []).includes('UNREAD'),
      text: stripQuoted(raw).slice(0, 1200),
      link: `https://mail.google.com/mail/?authuser=${encodeURIComponent(me)}#all/${thread.id}`,
    });
  }
  emails.sort((a, b) => b.date.localeCompare(a.date));
  return { me, emails };
}
