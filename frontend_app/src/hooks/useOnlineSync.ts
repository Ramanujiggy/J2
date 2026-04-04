import { useEffect, useRef } from 'react';
import { flush, count } from '../lib/offlineQueue.ts';
import { toast } from './use-toast.ts';

/**
 * Flushes the offline write queue whenever the browser comes back online,
 * and also on mount (handles the case where the app is reopened while
 * already online but the queue has items from a previous offline session).
 */
export function useOnlineSync() {
  const isFlushing = useRef(false);

  useEffect(() => {
    const handleOnline = async () => {
      if (isFlushing.current) return;
      isFlushing.current = true;

      try {
        const pending = await count();
        if (pending > 0) {
          toast({ title: `Syncing ${pending} queued action${pending > 1 ? 's' : ''}…` });

          const { synced, failed } = await flush();

          if (synced > 0) {
            toast({ title: `${synced} action${synced > 1 ? 's' : ''} synced.` });
          }
          if (failed > 0) {
            toast({
              title: `${failed} action${failed > 1 ? 's' : ''} failed to sync.`,
              description: 'Please log in again if your session expired.',
              variant: 'destructive',
            });
          }
        }
      } finally {
        isFlushing.current = false;
        // Signal all pages to refetch fresh data (after queued writes are replayed)
        window.dispatchEvent(new Event('journada:online-ready'));
      }
    };

    window.addEventListener('online', handleOnline);
    // Also flush on mount in case we're already online with pending items
    handleOnline();
    return () => window.removeEventListener('online', handleOnline);
  }, []);
}
