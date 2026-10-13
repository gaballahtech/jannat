import { adjustCell } from '../../_lib/catalog.js';
import {
  json,
  methodNotAllowed,
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

  if (req.method === 'DELETE') {
    // Void: restore every line's stock, then delete (voided sales shouldn't eat inventory).
    const rows = (await sql()`select items from invoices where id=${id}`) as {
      items: { productId: string; variant: string; size: string; qty: number }[];
    }[];
    if (rows.length === 0) return json(res, 404, { error: 'Not found.' });
    for (const l of rows[0].items ?? []) {
      await adjustCell(l.productId, l.variant, l.size, -Math.max(0, Math.floor(Number(l.qty) || 0)));
    }
    await sql()`delete from invoices where id=${id}`;
    return json(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ['DELETE']);
}
