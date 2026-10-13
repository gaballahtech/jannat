import {
  createSession,
  hashPassword,
  json,
  methodNotAllowed,
  readBody,
  sessionCookie,
  sql,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';

/* First-run owner setup. Allowed ONLY when no owner exists yet —
   afterwards this endpoint always 403s (create more owners via SQL). */
export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const { email, password } = await readBody<{ email?: unknown; password?: unknown }>(req);
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return json(res, 400, { error: 'Valid email required.' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return json(res, 400, { error: 'Password must be at least 8 characters.' });
  }
  const existing = await sql()`select id from owners limit 1`;
  if (existing.length > 0) return json(res, 403, { error: 'Owner already exists — log in instead.' });
  const rows = await sql()`insert into owners (email, password_hash)
    values (${email.trim().toLowerCase()}, ${await hashPassword(password)})
    returning id, email`;
  const owner = rows[0] as { id: string; email: string };
  const { token, maxAge } = await createSession(owner.id);
  res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
  json(res, 201, { ok: true, owner: { email: owner.email } });
}
