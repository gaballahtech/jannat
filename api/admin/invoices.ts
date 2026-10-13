import { adjustCell } from '../_lib/catalog.js';
import {
  json,
  methodNotAllowed,
  readBody,
  requireOwner,
  sql,
  type ServerReq,
  type ServerRes,
} from '../_lib/db.js';

type Line = {
  productId: string;
  name: string;
  variant: string;
  size: string;
  qty: number;
  price: number;
};

function cleanLines(v: unknown): Line[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .slice(0, 50)
    .map((l) => ({
      productId: String(l.productId ?? '').slice(0, 80),
      name: String(l.name ?? '').slice(0, 120),
      variant: String(l.variant ?? '').slice(0, 40),
      size: String(l.size ?? '').slice(0, 20),
      qty: Math.max(1, Math.floor(Number(l.qty) || 1)),
      price: Math.max(0, Math.floor(Number(l.price) || 0)),
    }))
    .filter((l) => l.productId && l.qty > 0);
}

export default async function handler(req: ServerReq, res: ServerRes): Promise<void> {
  const owner = await requireOwner(req);
  if (!owner) return json(res, 401, { error: 'Not logged in.' });

  if (req.method === 'GET') {
    const rows = (await sql()`select * from invoices where voided = false order by created_at desc limit 200`) as Record<
      string,
      unknown
    >[];
    return json(res, 200, { invoices: rows });
  }

  if (req.method === 'POST') {
    const b = await readBody<Record<string, unknown>>(req);
    const items = cleanLines(b.items);
    if (items.length === 0) return json(res, 400, { error: 'At least one line required.' });
    const subtotal = items.reduce((s, l) => s + l.qty * l.price, 0);
    const discount = Math.max(0, Math.floor(Number(b.discount) || 0));
    const shipping = Math.max(0, Math.floor(Number(b.shipping) || 0));
    const total = Math.max(0, subtotal - discount) + shipping;
    const n = (await sql()`select nextval('invoice_seq') as n`) as { n: number }[];
    const number = `PR-${String(n[0].n).padStart(4, '0')}`;
    const rows = (await sql()`insert into invoices
      (number, buyer_name, buyer_phone, buyer_city, buyer_address, notes, items, subtotal, discount, shipping, total, payment_method)
      values (${number}, ${String(b.buyerName ?? '').slice(0, 120)}, ${String(b.buyerPhone ?? '').slice(0, 40)},
        ${String(b.buyerCity ?? '').slice(0, 120)}, ${String(b.buyerAddress ?? '').slice(0, 300)},
        ${String(b.notes ?? '').slice(0, 500)}, ${JSON.stringify(items)}::jsonb,
        ${subtotal}, ${discount}, ${shipping}, ${total}, ${String(b.paymentMethod ?? '').slice(0, 80)})
      returning *`) as Record<string, unknown>[];
    // A saved invoice is a completed sale → decrement exact cells.
    for (const l of items) {
      await adjustCell(l.productId, l.variant, l.size, l.qty);
    }
    return json(res, 201, { invoice: rows[0] });
  }

  return methodNotAllowed(res, ['GET', 'POST']);
}
