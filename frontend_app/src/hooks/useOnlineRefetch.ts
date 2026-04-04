import { useEffect } from 'react';

/**
 * Re-calls the given function when the app comes back online
 * and the offline write queue has been flushed.
 *
 * Listens for the `journada:online-ready` custom event dispatched
 * by useOnlineSync after it finishes replaying queued writes.
 */
export function useOnlineRefetch(fn: () => void) {
  useEffect(() => {
    window.addEventListener('journada:online-ready', fn);
    return () => window.removeEventListener('journada:online-ready', fn);
  }, [fn]);
}
