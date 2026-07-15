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
    // A queued write was replayed and permanently rejected (4xx) by the
    // server — offlineQueue.flush() already dropped it from the queue
    // (retrying a permanent failure forever is wrong); this just tells the
    // user their entry didn't make it, instead of it vanishing silently.
    const handleRejected = (e: Event) => {
      const detail = (e as CustomEvent<{ url: string; status: number }>).detail;
      toast({
        title: "One offline entry couldn't sync and was rejected by the server.",
        description: detail ? `${detail.url} (${detail.status})` : undefined,
        variant: 'destructive',
      });
    };

    const handleOnline = async () => {
      if (isFlushing.current) return;
      isFlushing.current = true;

      try {
        const pending = await count();
        if (pending > 0) {
          toast({ title: `Syncing ${pending} queued action${pending > 1 ? 's' : ''}…` });

          const { synced, failed } = await flush();

          if (synced > 0) {
            toast({ variant: 'success', title: `${synced} action${synced > 1 ? 's' : ''} synced.` });
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
    window.addEventListener('journada:offline-sync-rejected', handleRejected);
    // Also flush on mount in case we're already online with pending items
    handleOnline();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('journada:offline-sync-rejected', handleRejected);
    };
  }, []);
}
