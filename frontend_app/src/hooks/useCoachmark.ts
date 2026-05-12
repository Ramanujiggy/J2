// useCoachmark — fires a one-time dismissible modal on first visit to a
// surface. Persists the dismissed state in localStorage so it never fires
// again for this device.
//
// Pass a stable `key` per coachmark (e.g. 'calendar', 'intentions'). The
// hook prefixes it with 'coachmark.' for namespace hygiene.

import { useCallback, useEffect, useState } from 'react';

const STORAGE_PREFIX = 'coachmark.';

interface UseCoachmarkOptions {
  /** Skip showing if true — useful for gating coachmarks behind data ready / route ready. */
  skip?: boolean;
  /** Delay in ms before opening so the underlying surface paints first. */
  openDelayMs?: number;
}

export function useCoachmark(key: string, options: UseCoachmarkOptions = {}) {
  const { skip = false, openDelayMs = 220 } = options;
  const storageKey = STORAGE_PREFIX + key;

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (skip) return;
    if (typeof window === 'undefined') return;
    let dismissed: string | null = null;
    try { dismissed = window.localStorage.getItem(storageKey); } catch { /* private mode */ }
    if (dismissed) return;
    const id = window.setTimeout(() => setIsOpen(true), openDelayMs);
    return () => window.clearTimeout(id);
  }, [skip, storageKey, openDelayMs]);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    try { window.localStorage.setItem(storageKey, String(Date.now())); } catch { /* swallow */ }
  }, [storageKey]);

  return { isOpen, dismiss };
}
