import {
  clearSessionCookie,
  destroySession,
  json,
  methodNotAllowed,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  await destroySession(req);
  res.setHeader('Set-Cookie', clearSessionCookie());
  json(res, 200, { ok: true });
}
