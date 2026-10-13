import { useEffect } from 'react';

/* Locks background page scroll while an overlay (drawer/modal/sheet) is open.
   Restores the exact previous state on close — safe with nested overlays
   thanks to reference counting. */
let locks = 0;
let prevOverflow = '';

export function useLockBody(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;
    if (locks === 0) {
      prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    locks += 1;
    return () => {
      locks = Math.max(0, locks - 1);
      if (locks === 0) document.body.style.overflow = prevOverflow;
    };
  }, [active]);
}
