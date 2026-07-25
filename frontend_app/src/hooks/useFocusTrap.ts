import { useEffect, useRef } from 'react';

// Traps focus within a container while `active`, restores focus to the
// previously-focused element on deactivate, and invokes `onEscape` on Escape.
// Built for the seal reveal sheet, which needs modal-dialog semantics that the
// existing SessionDetailModal doesn't provide.
export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onEscape?: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;

    const prevFocused = document.activeElement as HTMLElement | null;

    const selector =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      Array.from(node.querySelectorAll<HTMLElement>(selector)).filter(
        el => el.offsetParent !== null,
      );

    // Move focus into the sheet on open.
    const first = focusables()[0];
    (first ?? node).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape?.();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0]!;
      const lastEl = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevFocused?.focus?.();
    };
  }, [active, onEscape]);

  return ref;
}
