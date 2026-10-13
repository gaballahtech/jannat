import { json, methodNotAllowed, sql, type ServerReq, type ServerRes } from '../_lib/db.js';

/* Lets the frontend choose the right gate: server login/setup vs legacy local PIN. */
export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  try {
    const rows = (await sql()`select count(*)::int as n from owners`) as { n: number }[];
    json(res, 200, { mode: 'server', hasOwner: (rows[0]?.n ?? 0) > 0 });
  } catch {
    // No DATABASE_URL / tables yet — frontend falls back to local mode.
    json(res, 200, { mode: 'local' });
  }
}
