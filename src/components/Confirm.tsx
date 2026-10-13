import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFocusTrap } from '../utils/useFocusTrap';
import { useLockBody } from '../utils/useLockBody';

export type ConfirmOpts = {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
};

type Req = { opts: ConfirmOpts; resolve: (v: boolean) => void };

let current: Req | null = null;
const listeners = new Set<(r: Req | null) => void>();

/** Site-styled confirm dialog. Awaits the user's choice — no browser popups. */
export function askConfirm(opts: ConfirmOpts): Promise<boolean> {
  // If a dialog is already open, resolve the old one as cancelled first.
  if (current) {
    const prev = current;
    current = null;
    listeners.forEach((l) => l(null));
    prev.resolve(false);
  }
  return new Promise((resolve) => {
    current = { opts, resolve };
    listeners.forEach((l) => l(current));
  });
}

function settle(v: boolean) {
  const r = current;
  current = null;
  listeners.forEach((l) => l(null));
  r?.resolve(v);
}

export function ConfirmHost() {
  const [req, setReq] = useState<Req | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(req !== null, panelRef);
  useLockBody(req !== null);

  useEffect(() => {
    listeners.add(setReq);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') settle(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      listeners.delete(setReq);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <AnimatePresence>
      {req && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => settle(false)}
            className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-[2px]"
          />
          <div className="pointer-events-none fixed inset-0 z-[91] flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center">
            <motion.div
              ref={panelRef}
              initial={{ y: 40, opacity: 0, scale: 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.98 }}
              transition={{ type: 'tween', duration: 0.22 }}
              role="alertdialog"
              aria-modal="true"
              aria-label={req.opts.title}
              className="pointer-events-auto w-full max-w-sm rounded-[24px] bg-white p-6 text-center sm:p-7"
            >
              <span
                className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${
                  req.opts.danger ? 'bg-red-700 text-white' : 'bg-black text-white'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </span>
              <h2 className="font-display mt-4 text-2xl font-normal uppercase">{req.opts.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed tracking-[0.04em] text-black/60">
                {req.opts.message}
              </p>
              <div className="mt-6 flex gap-2.5">
                <button
                  onClick={() => settle(false)}
                  className="flex-1 rounded-full border border-black/20 py-3.5 text-[12px] font-normal tracking-[0.2em] transition hover:border-black"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => settle(true)}
                  autoFocus
                  className={`flex-[2] rounded-full py-3.5 text-[12px] font-normal tracking-[0.2em] text-white transition ${
                    req.opts.danger ? 'bg-red-700 hover:bg-red-800' : 'bg-black hover:bg-neutral-800'
                  }`}
                >
                  {req.opts.confirmLabel ?? 'CONFIRM'}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
