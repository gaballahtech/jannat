import { json, type ServerReq, type ServerRes } from './_lib/db.js';

export default function handler(_req: ServerReq, res: ServerRes): void {
  json(res, 200, { ok: true, service: 'pearlin-api' });
}
