import { rowToProduct, type DbProduct } from '../../_lib/catalog.js';
import {
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sql,
  type ServerReq,
  type ServerRes,
} from '../../_lib/db.js';
import { cleanProductInput } from '../_shared.js';

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
    const b = await readBody<Record<string, unknown>>(req);
    const p = cleanProductInput(b);
    if (!p.name) return json(res, 400, { error: 'Name required.' });
    const cats = (await sql()`select id from categories where id = ${p.category_id}`) as { id: string }[];
    if (cats.length === 0) return json(res, 400, { error: 'Unknown category.' });
    const stock = Object.values(p.inventory).reduce<number>((a, n) => a + n, 0);
    const rows = (await sql()`update products set name=${p.name}, price=${p.price},
      category_id=${p.category_id}, description=${p.description}, fabric=${p.fabric}, tag=${p.tag},
      sold=${p.sold}, sizes=${JSON.stringify(p.sizes)}::jsonb, variants=${JSON.stringify(p.variants)}::jsonb,
      inventory=${JSON.stringify(p.inventory)}::jsonb, pairs_with=${JSON.stringify(p.pairs_with)}::jsonb,
      stock=${stock}, updated_at=now() where id=${id} returning *`) as DbProduct[];
    if (rows.length === 0) return json(res, 404, { error: 'Not found.' });
    return json(res, 200, { product: rowToProduct(rows[0]) });
  }

  if (req.method === 'DELETE') {
    // Invoices keep name/price copies of their lines, so deleting a product is safe.
    const rows = (await sql()`delete from products where id=${id} returning id`) as { id: string }[];
    if (rows.length === 0) return json(res, 404, { error: 'Not found.' });
    return json(res, 200, { ok: true });
  }

  return methodNotAllowed(res, ['PUT', 'DELETE']);
}
