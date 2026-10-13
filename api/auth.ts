import {
  clearSessionCookie,
  createSession,
  destroySession,
  hashPassword,
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sessionCookie,
  sql,
  verifyPassword,
  type ServerReq,
  type ServerRes,
} from './_lib/db.js';

/* Single-function auth router (Vercel Hobby allows 12 functions per deploy).
   GET  /api/auth?action=status — {mode:'server',hasOwner} or {mode:'local'}
   POST /api/auth?action=setup — first owner only (403 after)
   POST /api/auth?action=login
   POST /api/auth?action=logout
   GET  /api/auth?action=me */

function actionOf(req: ServerReq): string {
  const q = req.query?.action;
  return (Array.isArray(q) ? q[0] : q) ?? '';
}

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  const action = actionOf(req);

  if (req.method === 'GET' && action === 'status') {
    try {
      const rows = (await sql()`select count(*)::int as n from owners`) as { n: number }[];
      return json(res, 200, { mode: 'server', hasOwner: (rows[0]?.n ?? 0) > 0 });
    } catch {
      return json(res, 200, { mode: 'local' });
    }
  }

  if (req.method === 'GET' && action === 'me') {
    const owner = await requireOwner(req);
    if (!owner) return json(res, 401, { error: 'Not logged in.' });
    return json(res, 200, { ok: true, owner: { email: owner.email } });
  }

  if (req.method === 'POST' && action === 'setup') {
    const { email, password } = await readBody<{ email?: unknown; password?: unknown }>(req);
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return json(res, 400, { error: 'Valid email required.' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return json(res, 400, { error: 'Password must be at least 8 characters.' });
    }
    const existing = (await sql()`select id from owners limit 1`) as { id: string }[];
    if (existing.length > 0) return json(res, 403, { error: 'Owner already exists — log in instead.' });
    const rows = (await sql()`insert into owners (email, password_hash)
      values (${email.trim().toLowerCase()}, ${await hashPassword(password)})
      returning id, email`) as { id: string; email: string }[];
    const { token, maxAge } = await createSession(rows[0].id);
    res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
    return json(res, 201, { ok: true, owner: { email: rows[0].email } });
  }

  if (req.method === 'POST' && action === 'login') {
    const { email, password } = await readBody<{ email?: unknown; password?: unknown }>(req);
    if (typeof email !== 'string' || typeof password !== 'string') {
      return json(res, 400, { error: 'Email and password required.' });
    }
    const rows = (await sql()`select id, email, password_hash from owners
      where email = ${email.trim().toLowerCase()} limit 1`) as {
      id: string;
      email: string;
      password_hash: string;
    }[];
    const owner = rows[0];
    if (!owner || !(await verifyPassword(password, owner.password_hash))) {
      return json(res, 401, { error: 'Wrong email or password.' });
    }
    const { token, maxAge } = await createSession(owner.id);
    res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
    return json(res, 200, { ok: true, owner: { email: owner.email } });
  }

  if (req.method === 'POST' && action === 'logout') {
    await destroySession(req);
    res.setHeader('Set-Cookie', clearSessionCookie());
    return json(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
