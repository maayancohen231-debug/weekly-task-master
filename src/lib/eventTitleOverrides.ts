// Lets her rename how ANY synced Google Calendar event displays here,
// even a recurring/fixed one she doesn't control the wording of (a
// third-party service's own auto-generated summary, a work calendar's
// naming convention, etc.) — purely cosmetic, never touches the real
// event. Per explicit request: a code-only rename (hardcoded, needs a
// developer to change) wasn't enough; she wants to do this herself going
// forward. Keyed by the ORIGINAL title text (case-insensitive, trimmed)
// rather than the event id, since an id changes per-occurrence for a
// recurring event but the summary text stays the same — one rename here
// covers every past and future occurrence of that same title.
const STORAGE_KEY = 'weeklyTaskMaster.eventTitleOverrides';

// Seeded defaults so an already-agreed rename works out of the box
// without her needing to redo it via the UI — her own override (below)
// always takes priority over these if she ever sets one for the same
// title.
const DEFAULT_OVERRIDES: Record<string, string> = {
  'preply lesson - carly tamlyn d.': 'English Lesson - Carly',
};

function normalize(title: string): string {
  return title.trim().toLowerCase();
}

function loadOverrides(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getDisplayTitle(originalTitle: string): string {
  const key = normalize(originalTitle);
  const overrides = loadOverrides();
  return overrides[key] ?? DEFAULT_OVERRIDES[key] ?? originalTitle;
}

/** Returns the custom override for this title, if she's set one herself (not counting the seeded defaults) — used to pre-fill the rename input with what she actually typed, not the resolved display text. */
export function getOwnOverride(originalTitle: string): string {
  return loadOverrides()[normalize(originalTitle)] ?? '';
}

/** Passing an empty/whitespace-only value removes her override, reverting to the seeded default (if any) or the real title. */
export function setTitleOverride(originalTitle: string, customTitle: string): void {
  const overrides = loadOverrides();
  const key = normalize(originalTitle);
  const clean = customTitle.trim();
  if (clean) overrides[key] = clean;
  else delete overrides[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
}
