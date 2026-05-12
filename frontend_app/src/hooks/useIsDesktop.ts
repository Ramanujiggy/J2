import { useSyncExternalStore } from 'react';

const DESKTOP_MQ = '(min-width: 1024px)';

const mqSubscribe = (cb: () => void) => {
  const mql = window.matchMedia(DESKTOP_MQ);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
};

const mqSnapshot = () => window.matchMedia(DESKTOP_MQ).matches;
const mqServerSnapshot = () => false;

/** Returns true when viewport is >= 1024px (lg breakpoint). */
export function useIsDesktop() {
  return useSyncExternalStore(mqSubscribe, mqSnapshot, mqServerSnapshot);
}
