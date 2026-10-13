import { json, methodNotAllowed, requireOwner, type ServerReq, type ServerRes } from '../_lib/db.js';

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const owner = await requireOwner(req);
  if (!owner) return json(res, 401, { error: 'Not logged in.' });
  json(res, 200, { ok: true, owner: { email: owner.email } });
}
