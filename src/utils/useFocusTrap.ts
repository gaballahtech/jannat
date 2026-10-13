import { useEffect } from 'react';

/* Keyboard accessibility for overlays: trap Tab focus inside the container
   while open, so keyboard users can't tab out into the page behind. */
export function useFocusTrap(active: boolean, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = Array.from(el.querySelectorAll<HTMLElement>(selector)).filter(
        (n) => n.offsetParent !== null,
      );
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // Move focus inside on open for screen readers.
    const first = el.querySelector<HTMLElement>(selector);
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [active, ref]);
}
