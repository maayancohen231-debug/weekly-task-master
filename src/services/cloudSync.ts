/**
 * Cloud storage (R-199): everything she saves in the planner is also kept in
 * her own Google Drive, in the app's private "appDataFolder" (invisible in
 * her Drive, only this app can read it). So the same tasks show on every
 * device, and clearing the browser no longer erases them.
 *
 * How it works:
 * - The app keeps working from localStorage exactly as before.
 * - A snapshot of the synced keys is pushed to Drive a few seconds after any
 *   change, and pulled on load and whenever the tab comes back into view.
 * - If both this device and the cloud changed since the last sync, the two
 *   are merged (nothing is dropped: tasks are united by id), never one
 *   silently overwriting the other.
 */
import { connectWithExtraScope, getValidToken } from '@/services/googleCalendar';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'weekly-task-master-data.json';
const FLAG_KEY = 'cloud_sync_on';
const META_KEY = 'cloud_sync_meta';
const PLANNER_KEY = 'weekly-planner-data';
const TITLE_OVERRIDES_KEY = 'weeklyTaskMaster.eventTitleOverrides';

/** The localStorage keys that hold her own data (not view prefs, not tokens). */
export const SYNCED_KEYS = [
  PLANNER_KEY,
  'goals-gantt-v2',
  'university-studies-2027a',
  'academic-board-data',
  TITLE_OVERRIDES_KEY,
] as const;

type Keys = Record<string, string | null>;
interface CloudFile { v: 1; savedAt: string; keys: Keys }
interface Meta { fileId?: string; cloudSavedAt?: string; syncedHash?: string }

export type CloudStatus =
  | { state: 'off' }
  | { state: 'syncing' }
  | { state: 'ok'; at: string }
  | { state: 'error'; message: string };

// ── small helpers ────────────────────────────────────────────────────────────

function readMeta(): Meta {
  try { return JSON.parse(localStorage.getItem(META_KEY) ?? '{}'); } catch { return {}; }
}
function writeMeta(m: Meta) {
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `${s.length}:${(h >>> 0).toString(36)}`;
}

function snapshot(): Keys {
  const keys: Keys = {};
  for (const k of SYNCED_KEYS) keys[k] = localStorage.getItem(k);
  return keys;
}
const hashKeys = (keys: Keys) => hash(JSON.stringify(SYNCED_KEYS.map(k => keys[k] ?? null)));
const isEmpty = (keys: Keys) => SYNCED_KEYS.every(k => keys[k] == null);

function applyKeys(keys: Keys) {
  for (const k of SYNCED_KEYS) {
    const v = keys[k];
    if (v == null) continue; // never delete local data because the cloud lacks a key
    if (localStorage.getItem(k) !== v) localStorage.setItem(k, v);
  }
}

// ── merging (both sides changed) ─────────────────────────────────────────────

type AnyObj = Record<string, any>;

function unionById<T extends AnyObj>(local: T[] = [], cloud: T[] = [], sameAs?: (a: T, b: T) => boolean): T[] {
  const ids = new Set(local.map(x => x?.id));
  const extra = cloud.filter(c => !ids.has(c?.id) && !(sameAs && local.some(l => sameAs(l, c))));
  return [...local, ...extra];
}

/** Two devices each auto-create the weekly/daily copy of a repeating task with
 * their own random id; treat those as the same task so a merge doesn't double it. */
function sameRepeatingTask(a: AnyObj, b: AnyObj): boolean {
  const rep = (t: AnyObj) => t?.isDaily || t?.isWeekly;
  return (rep(a) || rep(b)) && a.dayId === b.dayId && a.content === b.content;
}

function mergeRecordOfArrays(local: AnyObj = {}, cloud: AnyObj = {}, sameAs?: (a: AnyObj, b: AnyObj) => boolean): AnyObj {
  const out: AnyObj = {};
  for (const key of new Set([...Object.keys(cloud), ...Object.keys(local)])) {
    out[key] = unionById(local[key] ?? [], cloud[key] ?? [], sameAs);
  }
  return out;
}

function deepMerge(cloud: any, local: any): any {
  if (local && cloud && typeof local === 'object' && typeof cloud === 'object' && !Array.isArray(local) && !Array.isArray(cloud)) {
    const out: AnyObj = { ...cloud };
    for (const [k, v] of Object.entries(local)) out[k] = deepMerge(cloud[k], v);
    return out;
  }
  return local === undefined ? cloud : local;
}

export function mergePlanner(localRaw: string, cloudRaw: string): string {
  const l: AnyObj = JSON.parse(localRaw);
  const c: AnyObj = JSON.parse(cloudRaw);
  const merged: AnyObj = {
    ...c,
    ...l,
    tasksByWeek: mergeRecordOfArrays(l.tasksByWeek, c.tasksByWeek, sameRepeatingTask),
    goalsByWeek: mergeRecordOfArrays(l.goalsByWeek, c.goalsByWeek),
    dailyGoalNames: unionById(l.dailyGoalNames, c.dailyGoalNames, (a, b) => a.name === b.name),
    dailyGoalDoneByWeek: deepMerge(c.dailyGoalDoneByWeek ?? {}, l.dailyGoalDoneByWeek ?? {}),
    libraryTasks: unionById(l.libraryTasks, c.libraryTasks),
    learnedCalendarKeywords: { ...(c.learnedCalendarKeywords ?? {}), ...(l.learnedCalendarKeywords ?? {}) },
    deletedRecurringKeys: [...new Set([...(c.deletedRecurringKeys ?? []), ...(l.deletedRecurringKeys ?? [])])],
  };
  return JSON.stringify(merged);
}

export function mergeKeys(local: Keys, cloud: Keys): Keys {
  const out: Keys = {};
  for (const k of SYNCED_KEYS) {
    const l = local[k], c = cloud[k];
    if (l == null || c == null || l === c) { out[k] = l ?? c ?? null; continue; }
    try {
      if (k === PLANNER_KEY) out[k] = mergePlanner(l, c);
      else if (k === TITLE_OVERRIDES_KEY) out[k] = JSON.stringify({ ...JSON.parse(c), ...JSON.parse(l) });
      else out[k] = l; // gantt / studies: this device's version
    } catch {
      out[k] = l;
    }
  }
  return out;
}

// ── Drive calls ──────────────────────────────────────────────────────────────

async function drive(url: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidToken();
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg: string = body?.error?.message ?? `Drive error ${res.status}`;
    if (/has not been used|is disabled|accessNotConfigured/i.test(msg)) {
      throw new Error('צריך להפעיל את Google Drive API בפרויקט של Google Cloud.');
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error('אין הרשאה לשמירה בענן. צריך ללחוץ שוב על "שמירה בענן".');
    }
    throw new Error(msg);
  }
  return res;
}

async function findFile(meta: Meta): Promise<string | null> {
  if (meta.fileId) return meta.fileId;
  const q = encodeURIComponent(`name='${FILE_NAME}'`);
  const res = await drive(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&orderBy=modifiedTime desc`);
  const data = await res.json();
  return data.files?.[0]?.id ?? null;
}

async function readFile(id: string): Promise<CloudFile | null> {
  try {
    const res = await drive(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { cache: 'no-store' });
    const data = await res.json();
    return data && data.keys ? data as CloudFile : null;
  } catch (err: any) {
    if (/not found|404/i.test(String(err?.message))) return null;
    throw err;
  }
}

async function writeFile(id: string | null, file: CloudFile): Promise<string> {
  const body = JSON.stringify(file);
  if (id) {
    await drive(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return id;
  }
  const boundary = 'wtm' + Math.random().toString(36).slice(2);
  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${boundary}--`;
  const res = await drive('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: multipart,
  });
  return (await res.json()).id;
}

// ── public API ───────────────────────────────────────────────────────────────

let status: CloudStatus = isCloudOn() ? { state: 'syncing' } : { state: 'off' };
const statusListeners = new Set<(s: CloudStatus) => void>();
const appliedListeners = new Set<() => void>();
let running: Promise<void> | null = null;
let again = false;

function setStatus(s: CloudStatus) {
  status = s;
  statusListeners.forEach(fn => fn(s));
}

export function isCloudOn(): boolean {
  try { return localStorage.getItem(FLAG_KEY) === '1'; } catch { return false; }
}
export function getCloudStatus(): CloudStatus { return status; }
export function onCloudStatus(fn: (s: CloudStatus) => void): () => void {
  statusListeners.add(fn);
  return () => { statusListeners.delete(fn); };
}
/** Called after data from the cloud was written into localStorage. */
export function onCloudApplied(fn: () => void): () => void {
  appliedListeners.add(fn);
  return () => { appliedListeners.delete(fn); };
}

async function syncOnce(): Promise<void> {
  const meta = readMeta();
  const local = snapshot();
  const localHash = hashKeys(local);
  const localDirty = meta.syncedHash ? meta.syncedHash !== localHash : !isEmpty(local);

  const fileId = await findFile(meta);
  const cloud = fileId ? await readFile(fileId) : null;

  const push = async (keys: Keys) => {
    const file: CloudFile = { v: 1, savedAt: new Date().toISOString(), keys };
    const id = await writeFile(cloud ? fileId : null, file);
    writeMeta({ fileId: id, cloudSavedAt: file.savedAt, syncedHash: hashKeys(keys) });
  };

  if (!cloud) {
    if (!isEmpty(local)) await push(local);
    else writeMeta({ ...meta, fileId: undefined });
    return;
  }

  const cloudChanged = cloud.savedAt !== meta.cloudSavedAt;
  if (!cloudChanged) {
    if (localDirty) await push(local);
    else if (meta.fileId !== fileId) writeMeta({ ...meta, fileId: fileId! });
    return;
  }

  if (!localDirty) {
    applyKeys(cloud.keys);
    writeMeta({ fileId: fileId!, cloudSavedAt: cloud.savedAt, syncedHash: hashKeys(snapshot()) });
    appliedListeners.forEach(fn => fn());
    return;
  }

  const merged = mergeKeys(local, cloud.keys);
  applyKeys(merged);
  appliedListeners.forEach(fn => fn());
  await push(snapshot());
}

/** Pull + push now. Safe to call often; overlapping calls are folded into one more run. */
export function syncNow(): Promise<void> {
  if (!isCloudOn()) return Promise.resolve();
  if (running) { again = true; return running; }
  setStatus({ state: 'syncing' });
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
      setStatus({ state: 'ok', at: new Date().toISOString() });
    } catch (err: any) {
      if (/fileId|not found/i.test(String(err?.message))) writeMeta({ ...readMeta(), fileId: undefined });
      setStatus({ state: 'error', message: String(err?.message ?? err) });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** True when this device has changes the cloud hasn't got yet. */
export function hasUnsyncedChanges(): boolean {
  const meta = readMeta();
  const local = snapshot();
  return meta.syncedHash ? meta.syncedHash !== hashKeys(local) : !isEmpty(local);
}

/** One Google popup: adds the Drive "app data" permission (Calendar kept), then syncs. */
export async function connectCloud(): Promise<void> {
  await connectWithExtraScope(DRIVE_SCOPE);
  localStorage.setItem(FLAG_KEY, '1');
  await syncNow();
  if (status.state === 'error') throw new Error(status.message);
}

export function disconnectCloud(): void {
  localStorage.removeItem(FLAG_KEY);
  setStatus({ state: 'off' });
}

let started = false;
/** Starts background syncing: on load, every few seconds when something changed, and when the tab is shown again. */
export function startCloudSync(): void {
  if (started) return;
  started = true;
  void syncNow();
  setInterval(() => {
    if (isCloudOn() && !running && hasUnsyncedChanges()) void syncNow();
  }, 4000);
  // Pick up changes made on another device.
  setInterval(() => { if (isCloudOn() && document.visibilityState === 'visible') void syncNow(); }, 60_000);
  document.addEventListener('visibilitychange', () => {
    if (isCloudOn()) void syncNow();
  });
  window.addEventListener('focus', () => { if (isCloudOn()) void syncNow(); });
}
