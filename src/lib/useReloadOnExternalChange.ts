import { useEffect, useRef } from 'react';
import { onCloudApplied } from '@/services/cloudSync';

/**
 * Reloads a screen's saved data when it changes outside this screen: saved by
 * another open tab, or brought in from the cloud (another device). Without it,
 * the screen keeps its older copy and its next save erases the newer data.
 */
export function useReloadOnExternalChange(storageKey: string, reload: () => void): void {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey && e.newValue != null) reloadRef.current();
    };
    window.addEventListener('storage', onStorage);
    const off = onCloudApplied(() => reloadRef.current());
    return () => {
      window.removeEventListener('storage', onStorage);
      off();
    };
  }, [storageKey]);
}
