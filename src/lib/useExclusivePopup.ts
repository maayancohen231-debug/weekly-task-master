import { useEffect, useRef, type RefObject } from 'react';

// Only one popup may be open anywhere in the app at a time. Every popup
// (edit form, calendar/color picker, rename box, invite box, quick-add,
// small dropdowns, modals) registers here while it is open; opening a new
// one closes whichever was open before. Without this, opening e.g. the
// calendar picker left an event's edit form open next to it, and the two
// overlapped.
//
// Options:
// - `ref`: the popup's own element (trigger included). A press anywhere
//   outside it closes the popup.
// - `escape` (default true): Escape closes the popup.
// - `keepOnOutside`: when it returns true, an outside press leaves the
//   popup open (e.g. quick-add with text already typed, so nothing is lost).
let current: { id: object; close: () => void } | null = null;

export function useExclusivePopup(
  isOpen: boolean,
  close: () => void,
  opts: { ref?: RefObject<HTMLElement | null>; extraRef?: RefObject<HTMLElement | null>; escape?: boolean; keepOnOutside?: () => boolean } = {},
) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const idRef = useRef({});
  useEffect(() => {
    if (!isOpen) return;
    const me = idRef.current;
    if (current && current.id !== me) current.close();
    current = { id: me, close: () => closeRef.current() };

    const onDown = (e: PointerEvent) => {
      const el = optsRef.current.ref?.current;
      if (!el || el.contains(e.target as Node)) return;
      // A popup rendered in a portal (outside `ref`) counts as inside too.
      if (optsRef.current.extraRef?.current?.contains(e.target as Node)) return;
      if (optsRef.current.keepOnOutside?.()) return;
      closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && optsRef.current.escape !== false) closeRef.current();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      if (current?.id === me) current = null;
    };
  }, [isOpen]);
}
