/* Shared product-input sanitizer (used by POST + PUT). */

function cleanStr(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

export type CleanProduct = {
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
};

export function cleanProductInput(b: Record<string, unknown>): CleanProduct {
  const sizes = Array.isArray(b.sizes)
    ? b.sizes.filter((s): s is string => typeof s === 'string').slice(0, 10)
    : [];
  const variants = Array.isArray(b.variants)
    ? b.variants
        .filter(
          (v): v is Record<string, unknown> =>
            !!v && typeof v === 'object' && typeof (v as Record<string, unknown>).name === 'string',
        )
        .slice(0, 12)
        .map((v) => ({
          name: cleanStr(v.name, 40),
          hex: /^#[0-9a-fA-F]{6}$/.test(String(v.hex)) ? String(v.hex) : '#999999',
          image: cleanStr(v.image, 2000),
        }))
        .filter((v) => v.name.length > 0 && v.image.length > 0)
    : [];
  const inventory =
    b.inventory && typeof b.inventory === 'object'
      ? Object.fromEntries(
          Object.entries(b.inventory as Record<string, unknown>)
            .filter(([k, n]) => typeof k === 'string' && Number.isFinite(Number(n)))
            .map(([k, n]) => [k.slice(0, 80), Math.max(0, Math.floor(Number(n)))])
            .slice(0, 200),
        )
      : {};
  return {
    name: cleanStr(b.name, 120).toUpperCase(),
    price: Math.max(0, Math.floor(Number(b.price) || 0)),
    category_id: cleanStr(b.category ?? b.category_id, 60).toLowerCase(),
    description: cleanStr(b.description, 2000),
    fabric: cleanStr(b.fabric, 300) || null,
    tag: cleanStr(b.tag, 20).toUpperCase() || null,
    sold: Math.max(0, Math.floor(Number(b.sold) || 0)),
    sizes,
    variants,
    inventory,
    pairs_with: Array.isArray(b.pairsWith ?? b.pairs_with)
      ? ((b.pairsWith ?? b.pairs_with) as unknown[])
          .filter((x): x is string => typeof x === 'string')
          .slice(0, 2)
      : [],
  };
}
