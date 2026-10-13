import {
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sql,
  type ServerReq,
  type ServerRes,
} from '../../_lib/db.js';

function idOf(req: ServerReq): string {
  const q = req.query?.id;
  return (Array.isArray(q) ? q[0] : q) ?? '';
}

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  const owner = await requireOwner(req);
  if (!owner) return json(res, 401, { error: 'Not logged in.' });
  const id = idOf(req);
  if (!id) return json(res, 400, { error: 'Missing id.' });

  if (req.method === 'PUT') {
    const { label } = await readBody<{ label?: unknown }>(req);
    if (typeof label !== 'string' || !label.trim()) return json(res, 400, { error: 'Label required.' });
    const rows = (await sql()`update categories set label=${label.trim().toUpperCase()}
      where id=${id} returning id, label`) as { id: string; label: string }[];
    if (rows.length === 0) return json(res, 404, { error: 'Not found.' });
    return json(res, 200, { category: rows[0] });
  }

  if (req.method === 'DELETE') {
    // Refuse while products still use it — move them first (same rule as the old UI).
    const used = (await sql()`select count(*)::int as n from products where category_id=${id}`) as {
      n: number;
    }[];
    if ((used[0]?.n ?? 0) > 0) return json(res, 409, { error: `Move ${used[0].n} products first.` });
    const rows = (await sql()`delete from categories where id=${id} returning id`) as { id: string }[];
    if (rows.length === 0) return json(res, 404, { error: 'Not found.' });
    return json(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ['PUT', 'DELETE']);
}
