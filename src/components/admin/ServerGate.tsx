import { useEffect, useState } from 'react';
import { apiLogin, apiSetup, fetchAuthStatus } from '../../lib/api';

/* Owner sign-in for server mode (Neon-backed sessions, httpOnly cookie).
   Username (not email) — simpler for a shop owner.
   First run ever shows the create-owner form instead — the setup endpoint
   403s once an owner exists, so this screen can never reappear by itself. */
export default function ServerAuth({ onAuthed }: { onAuthed: (username: string) => void }) {
  const [hasOwner, setHasOwner] = useState<boolean | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetchAuthStatus()
      .then((s) => {
        if (live) setHasOwner(s.mode === 'server' ? s.hasOwner : true);
      })
      .catch(() => {
        if (live) setHasOwner(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const submit = async () => {
    if (busy) return;
    setErr('');
    if (!/^[a-z0-9._-]{3,24}$/.test(username.trim().toLowerCase())) {
      return setErr('Username: 3–24 chars, letters/numbers/._- only.');
    }
    if (password.length < 8) return setErr('Password must be at least 8 characters.');
    setBusy(true);
    try {
      const r = hasOwner
        ? await apiLogin(username.trim(), password)
        : await apiSetup(username.trim(), password);
      onAuthed(r.owner.username);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (hasOwner === null) {
    return (
      <p className="mx-auto max-w-md px-6 py-24 text-center text-[12px] tracking-[0.24em] text-black/50 dark:text-white/50">
        CHECKING…
      </p>
    );
  }

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 py-16 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-black text-[11px] font-normal tracking-[0.14em] text-white dark:bg-white dark:text-black">
        P
      </span>
      <h1 className="font-display mt-6 text-4xl font-normal uppercase">Admin</h1>
      <p className="mt-2 text-[13px] tracking-[0.12em] text-black/55 dark:text-white/55">
        {hasOwner ? 'Sign in to manage your store.' : 'Pick your username — one time only.'}
      </p>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        type="text"
        autoComplete="username"
        placeholder="e.g. pearlin_owner"
        aria-label="Username"
        className="mt-6 w-full rounded-2xl border border-black/15 dark:border-white/15 px-5 py-4 text-center text-[16px] outline-none placeholder:text-black/25 focus:border-black dark:focus:border-white sm:text-xl"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        type="password"
        autoComplete={hasOwner ? 'current-password' : 'new-password'}
        placeholder={hasOwner ? 'Password' : 'Password (8+ characters)'}
        aria-label="Password"
        className="mt-3 w-full rounded-2xl border border-black/15 dark:border-white/15 px-5 py-4 text-center text-[16px] outline-none placeholder:text-black/25 focus:border-black dark:focus:border-white sm:text-xl"
      />
      {err && <p className="mt-3 text-[12px] font-normal tracking-[0.12em] text-red-700 dark:text-red-400">{err}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="mt-5 w-full rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.24em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {busy ? '…' : hasOwner ? 'SIGN IN' : 'CREATE OWNER'}
      </button>
      <p className="mt-4 max-w-xs text-[11px] leading-relaxed tracking-[0.08em] text-black/40 dark:text-white/65">
        Server account — works on all your devices. Sessions expire after 30 days.
      </p>
    </section>
  );
}
