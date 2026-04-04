import { useState, useEffect, useCallback } from 'react';
import { getPending, clearPending } from '../lib/pendingSessions.ts';
import type { SessionSummary } from '../types/api.ts';

/**
 * Returns pending sessions (logged while offline, not yet synced).
 * Automatically clears when the online sync completes.
 */
export function usePendingSessions(): SessionSummary[] {
  const [pending, setPending] = useState<SessionSummary[]>(() => getPending());

  const refresh = useCallback(() => setPending(getPending()), []);

  useEffect(() => {
    window.addEventListener('journada:sessions-changed', refresh);
    return () => window.removeEventListener('journada:sessions-changed', refresh);
  }, [refresh]);

  useEffect(() => {
    const handleOnline = () => { clearPending(); };
    window.addEventListener('journada:online-ready', handleOnline);
    return () => window.removeEventListener('journada:online-ready', handleOnline);
  }, []);

  return pending;
}
