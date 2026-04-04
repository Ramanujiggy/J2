import type { SessionSummary } from '../types/api.ts';

const STORAGE_KEY = 'journada-pending-sessions';

/** Add a session to the pending list (logged while offline). */
export function addPending(session: SessionSummary): void {
  const existing = getPending();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, session]));
  window.dispatchEvent(new Event('journada:sessions-changed'));
}

/** Retrieve all pending sessions. */
export function getPending(): SessionSummary[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Clear all pending sessions (called after online sync). */
export function clearPending(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('journada:sessions-changed'));
}
