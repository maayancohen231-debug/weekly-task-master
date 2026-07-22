/**
 * Google Calendar API Service
 *
 * SETUP REQUIRED:
 * 1. Go to https://console.cloud.google.com
 * 2. Create project → Enable "Google Calendar API"
 * 3. Credentials → OAuth 2.0 Client ID (Web app)
 *    Authorized origins: http://localhost:5173
 * 4. Paste your Client ID below
 */

export const GOOGLE_CLIENT_ID = '45693353250-orevcu10pnhfg4nlbidmp1nlj8nmtoto.apps.googleusercontent.com';

const SCOPE = 'https://www.googleapis.com/auth/calendar';
const TOKEN_KEY = 'gcal_token';
const SYNC_KEY = 'gcal_synced_events';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GCalToken {
  access_token: string;
  expires_at: number; // ms since epoch
}

export interface GCalCalendar {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  selected?: boolean;
}

export interface GCalBusyEvent {
  id: string;
  title: string;
  start: string; // ISO datetime
  end: string; // ISO datetime
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
}

export interface GCalEventResult {
  id: string;
  htmlLink: string;
  calendarId: string;
  calendarName: string;
}

export interface SyncedEventInfo {
  eventId: string;
  calendarId: string;
  calendarName: string;
  htmlLink: string;
  syncedAt: string;
}

// TokenClient shape from Google Identity Services
interface TokenClient {
  requestAccessToken: (opts?: { prompt?: string }) => void;
}

// ── Token storage ─────────────────────────────────────────────────────────────

export function getStoredToken(): GCalToken | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as GCalToken;
    return token;
  } catch { return null; }
}

export function isTokenValid(): boolean {
  const token = getStoredToken();
  if (!token) return false;
  return token.expires_at > Date.now() + 60_000; // 1 min buffer
}

function storeToken(response: { access_token: string; expires_in: number }): GCalToken {
  const token: GCalToken = {
    access_token: response.access_token,
    expires_at: Date.now() + response.expires_in * 1000,
  };
  localStorage.setItem(TOKEN_KEY, JSON.stringify(token));
  return token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Synced events storage ─────────────────────────────────────────────────────

export function loadSyncedEvents(): Record<string, SyncedEventInfo> {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY) ?? '{}'); }
  catch { return {}; }
}

export function saveSyncedEvent(taskId: string, info: SyncedEventInfo): void {
  const data = loadSyncedEvents();
  data[taskId] = info;
  localStorage.setItem(SYNC_KEY, JSON.stringify(data));
}

// ── GIS script loader ─────────────────────────────────────────────────────────

let _scriptLoaded = false;
function loadGISScript(): Promise<void> {
  if (_scriptLoaded || (window as any).google?.accounts?.oauth2) {
    _scriptLoaded = true;
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="accounts.google.com/gsi"]');
    if (existing) {
      existing.addEventListener('load', () => { _scriptLoaded = true; resolve(); });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => { _scriptLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
}

// ── OAuth token client ────────────────────────────────────────────────────────

let _tokenClient: TokenClient | null = null;
let _tokenResolve: ((token: GCalToken) => void) | null = null;
let _tokenReject: ((err: Error) => void) | null = null;

async function getTokenClient(): Promise<TokenClient> {
  await loadGISScript();
  if (_tokenClient) return _tokenClient;

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) throw new Error('Google Identity Services not available');

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    callback: (resp: { access_token?: string; expires_in?: number; error?: string }) => {
      if (resp.error || !resp.access_token) {
        _tokenReject?.(new Error(resp.error ?? 'OAuth failed'));
      } else {
        const token = storeToken({ access_token: resp.access_token, expires_in: resp.expires_in ?? 3600 });
        _tokenResolve?.(token);
      }
      _tokenResolve = null;
      _tokenReject = null;
    },
  });

  return _tokenClient!;
}

/** Request a new access token (shows popup if needed). */
export async function requestToken(prompt = ''): Promise<GCalToken> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID not configured. Edit src/services/googleCalendar.ts.');
  }
  const client = await getTokenClient();
  return new Promise((resolve, reject) => {
    _tokenResolve = resolve;
    _tokenReject = reject;
    client.requestAccessToken({ prompt });
  });
}

/** Get a valid token, refreshing silently if expired. */
export async function getValidToken(): Promise<string> {
  if (isTokenValid()) return getStoredToken()!.access_token;
  // Try silent refresh first (no prompt)
  try {
    const token = await Promise.race([
      requestToken(''),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000)),
    ]);
    return token.access_token;
  } catch {
    throw new Error('Session expired. Please reconnect Google Calendar.');
  }
}

// ── Calendar API calls ────────────────────────────────────────────────────────

async function gcalFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();
  const url = path.startsWith('http') ? path : `https://www.googleapis.com/calendar/v3${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  if (res.status === 401) {
    clearToken();
    throw new Error('Google Calendar session expired. Please reconnect.');
  }
  if (res.status === 429) throw new Error('Google Calendar quota exceeded. Try again later.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `API error ${res.status}`);
  }
  return res;
}

/** Fetch the user's calendar list. */
export async function fetchCalendars(): Promise<GCalCalendar[]> {
  const res = await gcalFetch('/users/me/calendarList?maxResults=50');
  const data = await res.json();
  return (data.items ?? []) as GCalCalendar[];
}

/** Fetch existing events across the user's visible calendars within a time range. */
export async function fetchWeekEvents(timeMinISO: string, timeMaxISO: string): Promise<GCalBusyEvent[]> {
  const calendars = (await fetchCalendars()).filter(c => c.selected !== false);

  const results = await Promise.allSettled(
    calendars.map(async (cal) => {
      const params = new URLSearchParams({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '50',
      });
      const res = await gcalFetch(`/calendars/${encodeURIComponent(cal.id)}/events?${params}`);
      const data = await res.json();
      const items = (data.items ?? []) as Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string } }>;
      return items
        .filter(ev => ev.start?.dateTime && ev.end?.dateTime) // skip all-day events
        .map((ev): GCalBusyEvent => ({
          id: ev.id,
          title: ev.summary ?? '(No title)',
          start: ev.start!.dateTime!,
          end: ev.end!.dateTime!,
          calendarId: cal.id,
          calendarName: cal.summary,
          calendarColor: cal.backgroundColor,
        }));
    })
  );

  const events: GCalBusyEvent[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') events.push(...r.value);
    else console.warn('[googleCalendar] failed to fetch events for a calendar:', r.reason);
  }
  return events;
}

/** Create an event on the given calendar (defaults to 30 minutes). */
export async function createCalendarEvent(
  calendarId: string,
  title: string,
  startDateTime: string, // ISO local datetime e.g. "2026-03-22T10:00"
  description = '',
  durationMinutes = 30,
): Promise<{ id: string; htmlLink: string }> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const body = {
    summary: title,
    description: description || undefined,
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
  };

  const res = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Reschedule an existing event's start/end time (used when a block is dragged to a new slot). */
export async function updateCalendarEvent(
  calendarId: string,
  eventId: string,
  startDateTime: string, // ISO local datetime e.g. "2026-03-22T10:00"
  durationMinutes = 30,
): Promise<{ id: string; htmlLink: string }> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const body = {
    start: { dateTime: start.toISOString(), timeZone: tz },
    end: { dateTime: end.toISOString(), timeZone: tz },
  };

  const res = await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return res.json();
}

/** Delete a synced event (used when a task is unscheduled or removed). */
export async function deleteCalendarEvent(calendarId: string, eventId: string): Promise<void> {
  try {
    await gcalFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
    });
  } catch (err) {
    // Event may already be gone (deleted directly in Google Calendar) — not fatal.
    console.warn('[googleCalendar] failed to delete event:', eventId, err);
  }
}

// ── Calendar name → keyword matching ─────────────────────────────────────────

// Each rule maps keywords (found in task content) to a calendar identifier.
// The identifier is matched against calendar summaries using a fuzzy includes check
// so emoji variants and exact casing don't matter.
const CALENDAR_RULES: Array<{ calKey: string; keywords: string[] }> = [
  {
    calKey: 'fitness',
    keywords: ['gym', 'workout', 'sport', 'exercise', 'fitness', 'health', 'nutrition', 'run', 'swim', 'yoga', 'pilates', 'crossfit', 'be fit'],
  },
  {
    calKey: 'fam',
    keywords: ['family', 'mom', 'dad', 'sister', 'brother', 'grandma', 'grandpa', 'home', 'parent', 'sibling', 'ima', 'aba'],
  },
  {
    calKey: 'trips',
    keywords: ['trip', 'travel', 'flight', 'hotel', 'vacation', 'airport', 'thailand', 'abroad', 'mitzpe', 'tzora', 'טיול', 'נסיעה'],
  },
  {
    calKey: 'studies',
    keywords: ['study', 'exam', 'university', 'course', 'assignment', 'lecture', 'school', 'academic', 'semester', 'degree', 'english practice', 'business english', 'python exam', 'price theory', 'microeconomics', 'לימוד', 'בחינה'],
  },
  {
    calKey: 'mindwell',
    keywords: ['mindwell', 'therapy', 'mental health', 'wellbeing', 'ptsd', 'protocol', 'טיפול', 'therapist'],
  },
  {
    calKey: 'duvdevan',
    keywords: ['duvdevan', 'דובדבן', 'cherry'],
  },
  {
    calKey: 'friends',
    keywords: ['friend', 'hangout', 'social', 'with itay', 'with ariel', 'with noco', 'with stav', 'חברה', 'חברים'],
  },
  {
    calKey: 'personal growth',
    keywords: ['goal', 'habit', 'initiative', 'growth', 'pitch', 'startup', 'regulo', 'hoshen', 'hosen', 'חוסן'],
  },
  {
    calKey: 'psychology',
    keywords: ['psychology', 'torah', 'religious', 'study group', 'ginat', 'פסיכולוגיה', 'תורה'],
  },
  {
    calKey: 'service time',
    keywords: ['volunteer', 'service', 'community', 'reserve', 'casualty', 'wounded', 'injured', 'מילואים', 'שירות'],
  },
  {
    calKey: 'חוסן',
    keywords: ['מחלקת חוסן', 'אירועי חוסן', 'resilience department'],
  },
  {
    calKey: 'shabbat',
    keywords: ['shabbat', 'holiday', 'jewish', 'yom tov', 'שבת', 'חג'],
  },
  {
    calKey: 'birthdays',
    keywords: ['birthday', 'celebration', 'born', 'יום הולדת'],
  },
  {
    calKey: 'open space',
    keywords: ['hobby', 'fun', 'creative', 'free time', 'sunset', 'gratitude', 'תחביב'],
  },
];

/** Find a calendar whose summary contains the key (case-insensitive, emoji-tolerant). */
function findCalByKey(key: string, calendars: GCalCalendar[]): GCalCalendar | undefined {
  const k = key.toLowerCase();
  return calendars.find(c => c.summary.toLowerCase().includes(k));
}

const DEFAULT_CALENDAR_KEY = 'busy era';

export function matchCalendarName(taskContent: string, calendars: GCalCalendar[]): GCalCalendar {
  const lower = taskContent.toLowerCase();

  for (const rule of CALENDAR_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      const cal = findCalByKey(rule.calKey, calendars);
      if (cal) return cal;
    }
  }

  // Default: "In My Busy Era" or primary calendar
  return (
    findCalByKey(DEFAULT_CALENDAR_KEY, calendars) ??
    calendars.find(c => c.primary) ??
    calendars[0]
  );
}

export function isConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}
