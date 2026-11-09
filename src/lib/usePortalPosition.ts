import { useLayoutEffect, useRef, useState } from 'react';
import { useExclusivePopup } from './useExclusivePopup';

// Shared by any popover that lives inside the week grid's deeply-nested
// absolutely-positioned task/event blocks — a plain `position: absolute`
// child there has no stacking context of its own above SIBLING day
// columns, so it can paint underneath whatever the next day's content
// happens to render instead of on top (confirmed live: a calendar/color
// picker showing buried behind a neighboring day, read as "I can't see
// the list"). A portal to document.body sidesteps this entirely — render
// the popover as a page-level sibling, `position: fixed` at the trigger
// button's real screen coordinates, so it's never subject to any day
// column's local paint order again.
export function usePortalPosition() {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const measure = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 4, right: Math.max(8, window.innerWidth - rect.right) });
  };
  // Re-measure on scroll (the whole week grid is one scrollable surface,
  // and it's entirely plausible to scroll while a popover is open) —
  // capture:true so this catches scroll events bubbling from ANY
  // descendant scrollable ancestor, not just the window itself.
  useLayoutEffect(() => {
    if (!pos) return;
    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pos]);
  // Close on any press outside the popover/trigger, or on Escape — without
  // this the only way out was re-clicking the exact trigger button, which
  // may already be hidden (hover-only icon row), leaving the popover stuck.
  useLayoutEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPos(null); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [!!pos]);
  useExclusivePopup(!!pos, () => setPos(null));
  return { btnRef, popRef, pos, open: measure, close: () => setPos(null) };
}
