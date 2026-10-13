import { Eye, EyeOff, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  checkPin,
  hasPin,
  pinWaitSec,
  recordPinFail,
  resetPinAttempts,
  setPin,
  setUnlocked,
} from '../../admin/adminData';

/* Device-level PIN gate for the owner dashboard.
   NOTE: not real security (clearing site data bypasses it) —
   true multi-user auth comes with the server backend. */
export default function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const setup = !hasPin();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  // Visible by default so you always see what you type; tap the eye to mask it.
  const [show, setShow] = useState(true);
  // Letters + numbers allowed (max 16 chars).
  const clean = (v: string) => v.slice(0, 16);
  const [busy, setBusy] = useState(false);
  // Live countdown while brute-force lockout is active.
  const [wait, setWait] = useState(() => pinWaitSec());
  useEffect(() => {
    if (wait <= 0) return;
    const t = window.setInterval(() => setWait(pinWaitSec()), 1000);
    return () => window.clearInterval(t);
  }, [wait > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    if (busy) return;
    const locked = pinWaitSec();
    if (locked > 0) {
      setWait(locked);
      return setErr(`Too many wrong tries — wait ${locked}s.`);
    }
    setErr('');
    if (setup) {
      if (a.trim().length < 4)
        return setErr('Password must be at least 4 characters (letters & numbers allowed).');
      if (a !== b) return setErr('Passwords do not match.');
      setBusy(true);
      try {
        await setPin(a.trim());
        resetPinAttempts();
        setUnlocked(true);
        onUnlock();
      } finally {
        setBusy(false);
      }
    } else {
      setBusy(true);
      try {
        if (await checkPin(a.trim())) {
          resetPinAttempts();
          setUnlocked(true);
          onUnlock();
        } else {
          const w = recordPinFail();
          if (w > 0) {
            setWait(w);
            setErr(`Wrong password. Locked for ${w}s.`);
          } else {
            setErr('Wrong password. Try again.');
          }
        }
      } finally {
        setBusy(false);
      }
    }
  };

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
        <Lock className="h-6 w-6" />
      </span>
      <h1 className="font-display mt-6 text-4xl font-normal uppercase">Admin</h1>
      <p className="mt-2 text-[13px] tracking-[0.12em] text-black/55 dark:text-white/55">
        {setup ? 'Create a password to lock your dashboard.' : 'Enter your password to continue.'}
      </p>
      <div className="relative mt-6 w-full">
        <input
          value={a}
          onChange={(e) => setA(clean(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          type={show ? 'text' : 'password'}
          placeholder={setup ? 'New password' : 'Password'}
          autoComplete="off"
          className="w-full rounded-2xl border border-black/15 dark:border-white/15 py-4 pl-5 pr-12 text-center text-xl font-normal tracking-[0.2em] outline-none placeholder:text-black/25 dark:placeholder:text-white/60 placeholder:tracking-[0.1em] focus:border-black dark:focus:border-white"
        />
        <button
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide PIN' : 'Show PIN'}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2.5 text-black/60 dark:text-white/60 transition hover:text-black dark:hover:text-white"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
      {setup && (
        <input
          value={b}
          onChange={(e) => setB(clean(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          type={show ? 'text' : 'password'}
          placeholder="Confirm password"
          autoComplete="off"
          className="mt-3 w-full rounded-2xl border border-black/15 dark:border-white/15 px-5 py-4 text-center text-xl font-normal tracking-[0.2em] outline-none placeholder:text-black/25 dark:placeholder:text-white/60 placeholder:tracking-[0.1em] focus:border-black dark:focus:border-white"
        />
      )}
      {err && <p className="mt-3 text-[12px] font-normal tracking-[0.12em] text-red-700 dark:text-red-400">{err}</p>}
      <button
        onClick={submit}
        disabled={busy || wait > 0}
        className="mt-5 w-full rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.24em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {wait > 0 ? `WAIT ${wait}S` : setup ? 'CREATE & UNLOCK' : 'UNLOCK'}
      </button>
      <p className="mt-4 max-w-xs text-[11px] leading-relaxed tracking-[0.08em] text-black/60 dark:text-white/65">
        Device-level lock only — anyone with this browser can clear site data. Real multi-user
        security needs a server backend later.
      </p>
    </section>
  );
}
