import { rowToProduct, slugId, type DbProduct } from '../_lib/catalog.js';
import {
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sql,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';
import { cleanProductInput } from './_shared.js';

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  const owner = await requireOwner(req);
  if (!owner) return json(res, 401, { error: 'Not logged in.' });

  if (req.method === 'GET') {
    const rows = (await sql()`select * from products order by created_at desc`) as DbProduct[];
    return json(res, 200, { products: rows.map(rowToProduct) });
  }

  if (req.method === 'POST') {
    const b = await readBody<Record<string, unknown>>(req);
    const p = cleanProductInput(b);
    if (!p.name) return json(res, 400, { error: 'Name required.' });
    if (p.variants.length === 0) return json(res, 400, { error: 'At least one variant with photo required.' });
    if (p.sizes.length === 0) return json(res, 400, { error: 'At least one size required.' });
    const cats = (await sql()`select id from categories where id = ${p.category_id}`) as { id: string }[];
    if (cats.length === 0) return json(res, 400, { error: 'Unknown category.' });
    const base = slugId(typeof b.id === 'string' && b.id ? b.id : p.name);
    let id = base;
    for (let i = 2; i < 100; i++) {
      const hit = (await sql()`select id from products where id = ${id}`) as { id: string }[];
      if (hit.length === 0) break;
      id = `${base}-${i}`;
    }
    const stock = Object.values(p.inventory).reduce<number>((a, n) => a + n, 0);
    const created = typeof b.createdAt === 'string' ? b.createdAt : new Date().toISOString();
    const rows = (await sql()`insert into products
      (id, name, price, category_id, description, fabric, tag, sold, sizes, variants, inventory, pairs_with, stock, created_at)
      values (${id}, ${p.name}, ${p.price}, ${p.category_id}, ${p.description}, ${p.fabric}, ${p.tag},
        ${p.sold}, ${JSON.stringify(p.sizes)}::jsonb, ${JSON.stringify(p.variants)}::jsonb,
        ${JSON.stringify(p.inventory)}::jsonb, ${JSON.stringify(p.pairs_with)}::jsonb, ${stock}, ${created}::timestamptz)
      returning *`) as DbProduct[];
    return json(res, 201, { product: rowToProduct(rows[0]) });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
