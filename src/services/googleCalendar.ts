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
const REFRESH_TOKEN_KEY = 'gcal_refresh_token';
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

// CodeClient shape from Google Identity Services (authorization-code / "offline" flow)
interface CodeClient {
  requestCode: () => void;
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

/** Clears the short-lived access token only — used for a silent-refresh failure, keeps the refresh token so recovery can retry. */
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/** Full disconnect — clears both the access token and the persistent refresh token. */
export function clearAllTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
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

// ── OAuth code client (authorization-code flow — the only Google flow that
// issues a refresh token, needed so the user isn't forced to reconnect every
// time an access token expires) ────────────────────────────────────────────

let _codeClient: CodeClient | null = null;
let _codeResolve: ((code: string) => void) | null = null;
let _codeReject: ((err: Error) => void) | null = null;

async function getCodeClient(): Promise<CodeClient> {
  await loadGISScript();
  if (_codeClient) return _codeClient;

  const google = (window as any).google;
  if (!google?.accounts?.oauth2) throw new Error('Google Identity Services not available');

  _codeClient = google.accounts.oauth2.initCodeClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: SCOPE,
    ux_mode: 'popup',
    callback: (resp: { code?: string; error?: string }) => {
      if (resp.error || !resp.code) {
        _codeReject?.(new Error(resp.error ?? 'OAuth failed'));
      } else {
        _codeResolve?.(resp.code);
      }
      _codeResolve = null;
      _codeReject = null;
    },
  });

  return _codeClient!;
}

// Cached across the page's lifetime — the server config doesn't change
// mid-session, and this lets connect() decide up front which single popup to
// show instead of discovering mid-flow that the persistent path can't work.
let _persistentConfigured: boolean | null = null;
async function checkPersistentConfigured(): Promise<boolean> {
  if (_persistentConfigured !== null) return _persistentConfigured;
  try {
    const res = await fetch('/api/google/exchange');
    const data = await res.json();
    _persistentConfigured = res.ok && data.configured === true;
  } catch {
    _persistentConfigured = false;
  }
  return _persistentConfigured;
}

/**
 * Full "connect" flow. When the server-side piece is configured
 * (GOOGLE_CLIENT_SECRET set), shows the Google consent popup and exchanges
 * the resulting authorization code server-side (POST /api/google/exchange,
 * the only place that touches the client secret) for an access token and —
 * critically — a refresh token, which lets every later token renewal happen
 * silently via refreshAccessToken() with no popup and no dependency on
 * third-party cookies. Otherwise falls back to the classic single-popup
 * implicit flow — checked *before* opening any popup, specifically to avoid
 * ever needing a second, browser-blocked popup mid-flow.
 */
export async function connectPersistent(): Promise<GCalToken> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google Client ID not configured. Edit src/services/googleCalendar.ts.');
  }

  if (!(await checkPersistentConfigured())) {
    return requestToken('consent');
  }

  const client = await getCodeClient();
  const code = await new Promise<string>((resolve, reject) => {
    _codeResolve = resolve;
    _codeReject = reject;
    client.requestCode();
  });

  const res = await fetch('/api/google/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, origin: window.location.origin }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? 'Token exchange failed');
  }
  const data = await res.json();

  if (data.refresh_token) storeRefreshToken(data.refresh_token);
  return storeToken({ access_token: data.access_token, expires_in: data.expires_in ?? 3600 });
}

/** Silently mints a fresh access token from the stored refresh token — no popup, no third-party-cookie dependency. */
export async function refreshAccessToken(): Promise<GCalToken> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) throw new Error('No refresh token stored');

  const res = await fetch('/api/google/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const data = await res.json();
  if (!res.ok) {
    // invalid_grant here means the refresh token itself is dead (revoked, or
    // hit Google's 7-day cap for an unverified/Testing-status OAuth client)
    // — no amount of retrying will fix it, only a full reconnect will.
    clearAllTokens();
    throw new Error(data.error ?? 'Refresh failed');
  }
  return storeToken({ access_token: data.access_token, expires_in: data.expires_in ?? 3600 });
}

/** Get a valid token, refreshing silently if expired — prefers the persistent refresh-token flow, falls back to the old GIS silent-reissue trick for a session that hasn't upgraded to it yet. */
export async function getValidToken(): Promise<string> {
  if (isTokenValid()) return getStoredToken()!.access_token;

  if (getStoredRefreshToken()) {
    const token = await refreshAccessToken();
    return token.access_token;
  }

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

/**
 * Fetch existing events across every calendar the user has access to, within
 * a time range. Deliberately does NOT filter by `selected` — that flag is
 * just Google Calendar's own sidebar show/hide toggle, unrelated to whether
 * a calendar's events are real and current. Filtering on it silently hid
 * events on any calendar the user had toggled off for their own viewing,
 * which is exactly the kind of gap this planner exists to prevent.
 */
// Cosmetic display renames for synced event titles she doesn't control
// the wording of (e.g. a third-party service's own auto-generated summary
// text) — purely how this app SHOWS the title, never touches the actual
// Google Calendar event. Events resync from Google Calendar on every
// fetch, so editing one occurrence by hand wouldn't stick; add a new entry
// here instead for any future "call it X instead" request. Matched
// case-insensitively against the raw summary.
const TITLE_OVERRIDES: [match: RegExp, replacement: string][] = [
  [/^Preply lesson\s*-\s*Carly Tamlyn D\.?$/i, 'שיעור אנגלית- Carly'],
];
function applyTitleOverride(summary: string): string {
  for (const [match, replacement] of TITLE_OVERRIDES) {
    if (match.test(summary)) return replacement;
  }
  return summary;
}

export async function fetchWeekEvents(timeMinISO: string, timeMaxISO: string): Promise<GCalBusyEvent[]> {
  const calendars = await fetchCalendars();

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
          title: ev.summary ? applyTitleOverride(ev.summary) : '(No title)',
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
    // "Fauda Base+ Expert" — already exists as a calendar in her Google
    // account (from course registration emails); this just teaches the
    // matcher to route Fauda-related tasks there.
    calKey: 'fauda',
    keywords: ['fauda', 'פאודה'],
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
    // More specific than the bare "חוסן"/"hosen" keyword below — checked first
    // so "מחלקת חוסן" routes to the חוסן department calendar, not Duvdevan.
    calKey: 'חוסן',
    keywords: ['מחלקת חוסן', 'אירועי חוסן', 'resilience department'],
  },
  {
    calKey: 'duvdevan',
    keywords: ['duvdevan', 'דובדבן', 'cherry', 'חוסן', 'hosen', 'hoshen'],
  },
  {
    calKey: 'friends',
    keywords: ['friend', 'hangout', 'social', 'with itay', 'with ariel', 'with noco', 'with stav', 'חברה', 'חברים'],
  },
  {
    calKey: 'personal growth',
    keywords: ['goal', 'habit', 'initiative', 'growth', 'pitch', 'startup', 'regulo'],
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

/**
 * Resolves a calendar from the user's own learned keyword->calendar picks
 * (highest priority — these came from her explicitly choosing) or the
 * built-in keyword rules. Returns undefined when neither matches, meaning
 * the caller should ask rather than silently fall back to a default.
 */
export function resolveLearnedOrRuleMatch(
  taskContent: string,
  calendars: GCalCalendar[],
  learnedKeywords: Record<string, string> = {},
): GCalCalendar | undefined {
  const lower = taskContent.toLowerCase();

  for (const [keyword, calendarId] of Object.entries(learnedKeywords)) {
    if (keyword && lower.includes(keyword)) {
      const cal = calendars.find(c => c.id === calendarId);
      if (cal) return cal;
    }
  }

  for (const rule of CALENDAR_RULES) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      const cal = findCalByKey(rule.calKey, calendars);
      if (cal) return cal;
    }
  }

  return undefined;
}

export function matchCalendarName(
  taskContent: string,
  calendars: GCalCalendar[],
  learnedKeywords: Record<string, string> = {},
): GCalCalendar {
  return (
    resolveLearnedOrRuleMatch(taskContent, calendars, learnedKeywords) ??
    // Default: "In My Busy Era" or primary calendar
    findCalByKey(DEFAULT_CALENDAR_KEY, calendars) ??
    calendars.find(c => c.primary) ??
    calendars[0]
  );
}

export function isConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID);
}
