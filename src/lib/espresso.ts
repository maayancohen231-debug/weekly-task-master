import { useCallback, useEffect, useState } from 'react';

/**
 * "Espresso" look (R-439): every event is coloured by the category of the
 * Google calendar it lives in, with fixed colours. Her answer (20.11): the
 * fixed palette wins over Google's own calendar colour, and there is no
 * per-block colour picker any more.
 */
export type EspressoCategory = 'duvdevan' | 'studies' | 'personal' | 'friends' | 'trips' | 'punct';

export interface CategoryStyle {
  id: EspressoCategory;
  label: string;
  bg: string;
  fg: string;
  /** Inner hairline for the very light category, which disappears without it. */
  ring?: string;
}

export const ESPRESSO_CATEGORIES: CategoryStyle[] = [
  { id: 'duvdevan', label: 'Duvdevan', bg: '#CBB4A0', fg: '#3A241C' },
  { id: 'studies', label: 'Studies', bg: '#E6D7C3', fg: '#3A241C' },
  { id: 'personal', label: 'Personal', bg: '#EFE8DC', fg: '#3A241C', ring: '#DDD0BC' },
  { id: 'friends', label: 'Friends & family', bg: '#916549', fg: '#FFFFFF' },
  { id: 'trips', label: 'Trips & travel', bg: '#59392D', fg: '#FFFFFF' },
  { id: 'punct', label: 'PUNCT', bg: '#3A241C', fg: '#FFFFFF' },
];

const BY_ID = Object.fromEntries(ESPRESSO_CATEGORIES.map(c => [c.id, c])) as Record<EspressoCategory, CategoryStyle>;

const RULES: Array<[EspressoCategory, RegExp]> = [
  ['punct', /punct|פונקט/i],
  ['duvdevan', /duvdevan|דובדבן|חוסן|mindwell|open ?space|service time/i],
  ['studies', /stud|univers|לימוד|psycholog|אקדמ/i],
  ['trips', /trip|travel|טיול|נסיע/i],
  ['friends', /friend|fam|birthday|shabbat|חבר|משפח|יום הולדת|שבת/i],
];

/** Category of a calendar, by its name. Anything unrecognised is Personal. */
export function categoryOf(calendarName: string | undefined | null): EspressoCategory {
  if (!calendarName) return 'personal';
  for (const [cat, re] of RULES) if (re.test(calendarName)) return cat;
  return 'personal';
}

export function categoryStyle(calendarName: string | undefined | null): CategoryStyle {
  return BY_ID[categoryOf(calendarName)];
}

const HIDDEN_KEY = 'wtm-hidden-categories';

function readHidden(): Set<EspressoCategory> {
  try {
    const raw = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((x): x is EspressoCategory => x in BY_ID) : []);
  } catch {
    return new Set();
  }
}

/** "My calendars" checkboxes: which categories are hidden, kept in this browser. */
export function useHiddenCategories() {
  const [hidden, setHidden] = useState<Set<EspressoCategory>>(readHidden);
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === HIDDEN_KEY) setHidden(readHidden()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const toggle = useCallback((cat: EspressoCategory) => {
    setHidden(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next])); } catch { /* private mode */ }
      return next;
    });
  }, []);
  return { hidden, toggle };
}
