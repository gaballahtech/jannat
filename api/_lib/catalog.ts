import { sql } from './db.js';

/* DB row → storefront Product shape (mirrors src/data/store.ts + adminData.ensureMatrix).
   Stock is always the sum of the inventory matrix — never trusted blindly. */

export type DbProduct = {
  id: string;
  name: string;
  price: number;
  category_id: string;
  description: string;
  fabric: string | null;
  tag: string | null;
  sold: number;
  sizes: string[];
  variants: { name: string; hex: string; image: string }[];
  inventory: Record<string, number>;
  pairs_with: string[];
  created_at: string;
};

export const cellKey = (variant: string, size: string): string => `${variant}||${size}`;

function num(n: unknown): number {
  const v = Math.floor(Number(n) || 0);
  return v < 0 ? 0 : v;
}

function cleanInventory(input: unknown, variants: string[], sizes: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  const src = (input && typeof input === 'object' ? input : {}) as Record<string, number>;
  for (const v of variants) {
    for (const s of sizes) {
      out[cellKey(v, s)] = num(src[cellKey(v, s)]);
    }
  }
  return out;
}

export type Product = {
  id: string;
  name: string;
  price: number;
  variants: { name: string; hex: string; image: string }[];
  tag?: string;
  category: string;
  description: string;
  fabric?: string;
  sold: number;
  stock: number;
  sizes: string[];
  inventory: Record<string, number>;
  createdAt: string;
  pairsWith: string[];
};

export function rowToProduct(r: DbProduct): Product {
  const sizes = Array.isArray(r.sizes) ? r.sizes.filter((s): s is string => typeof s === 'string') : [];
  const variants = Array.isArray(r.variants)
    ? r.variants.filter(
        (v): v is { name: string; hex: string; image: string } =>
          !!v && typeof v.name === 'string' && typeof v.hex === 'string' && typeof v.image === 'string',
      )
    : [];
  const names = variants.map((v) => v.name);
  const inventory = cleanInventory(r.inventory, names, sizes);
  const stock = Object.values(inventory).reduce((a, n) => a + n, 0);
  const pairsWith = Array.isArray(r.pairs_with)
    ? r.pairs_with.filter((x): x is string => typeof x === 'string').slice(0, 2)
    : [];
  return {
    id: r.id,
    name: r.name,
    price: num(r.price),
    variants,
    ...(r.tag ? { tag: r.tag } : {}),
    category: r.category_id,
    description: r.description ?? '',
    ...(r.fabric ? { fabric: r.fabric } : {}),
    sold: num(r.sold),
    stock,
    sizes,
    inventory,
    createdAt: typeof r.created_at === 'string' ? r.created_at.slice(0, 10) : '',
    pairsWith,
  };
}

/** Adjust one matrix cell by delta (negative restores). Returns fresh row. */
export async function adjustCell(
  productId: string,
  variant: string,
  size: string,
  delta: number,
): Promise<void> {
  const rows = (await sql()`select inventory, stock, sold from products where id = ${productId} for update`) as {
    inventory: Record<string, number>;
    stock: number;
    sold: number;
  }[];
  const row = rows[0];
  if (!row) return;
  const inv = { ...(row.inventory ?? {}) };
  const k = cellKey(variant, size);
  const before = num(inv[k]);
  // Selling floors at 0; restocking always adds. Sold tracks real units moved.
  const after = delta > 0 ? Math.max(0, before - delta) : before - delta;
  inv[k] = Math.max(0, after);
  const moved = delta > 0 ? Math.min(before, delta) : delta;
  const stock = Object.values(inv).reduce((a, n) => a + num(n), 0);
  const sold = Math.max(0, num(row.sold) + moved);
  await sql()`update products set inventory = ${JSON.stringify(inv)}::jsonb,
    stock = ${stock}, sold = ${sold}, updated_at = now() where id = ${productId}`;
}

export function slugId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || `p-${Date.now().toString(36)}`
  );
}
