import { useEffect } from 'react';

/**
 * Locks body scroll when `locked` is true.
 * Uses position:fixed to handle iOS Safari, which ignores overflow:hidden alone.
 * Saves and restores scroll position so the page doesn't jump on close.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const scrollY = window.scrollY;
    const body = document.body;
    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    return () => {
      body.style.overflow = '';
      body.style.position = '';
      body.style.top = '';
      body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
