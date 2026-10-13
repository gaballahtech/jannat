import { rowToProduct, type DbProduct } from './_lib/catalog.js';
import { json, methodNotAllowed, sql, type ServerReq, type ServerRes } from './_lib/db.js';

/* Public storefront bundle: products + categories + settings + home in one round trip.
   No auth — everything here is visible in the shop by design. */
export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  const [products, categories, settings] = await Promise.all([
    sql()`select * from products order by created_at desc`,
    sql()`select id, label from categories order by position, label`,
    sql()`select key, value from settings`,
  ]);
  const settingsObj: Record<string, unknown> = {};
  for (const s of settings as { key: string; value: unknown }[]) settingsObj[s.key] = s.value;
  json(res, 200, {
    products: (products as DbProduct[]).map(rowToProduct),
    categories: categories as { id: string; label: string }[],
    settings: settingsObj,
    home: (settingsObj.home as { hero: { productId: string; variant: string }[] } | undefined) ?? {
      hero: [],
    },
  });
}
