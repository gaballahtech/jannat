import {
  createSession,
  json,
  methodNotAllowed,
  readBody,
  sessionCookie,
  sql,
  verifyPassword,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const { email, password } = await readBody<{ email?: unknown; password?: unknown }>(req);
  if (typeof email !== 'string' || typeof password !== 'string') {
    return json(res, 400, { error: 'Email and password required.' });
  }
  const rows = await sql()`select id, email, password_hash from owners
    where email = ${email.trim().toLowerCase()} limit 1`;
  const owner = rows[0] as { id: string; email: string; password_hash: string } | undefined;
  // Same message either way — no account enumeration.
  if (!owner || !(await verifyPassword(password, owner.password_hash))) {
    return json(res, 401, { error: 'Wrong email or password.' });
  }
  const { token, maxAge } = await createSession(owner.id);
  res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
  json(res, 200, { ok: true, owner: { email: owner.email } });
}
