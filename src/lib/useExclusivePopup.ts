import { useEffect, useRef } from 'react';

// Only one popup may be open anywhere in the app at a time. Every popup
// (edit form, calendar/color picker, rename box, invite box, quick-add,
// small dropdowns) registers here while it is open; opening a new one closes
// whichever was open before. Without this, opening e.g. the calendar picker
// left an event's edit form open next to it, and the two overlapped.
let current: { id: object; close: () => void } | null = null;

export function useExclusivePopup(isOpen: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  const idRef = useRef({});
  useEffect(() => {
    if (!isOpen) return;
    const me = idRef.current;
    if (current && current.id !== me) current.close();
    current = { id: me, close: () => closeRef.current() };
    return () => { if (current?.id === me) current = null; };
  }, [isOpen]);
}
