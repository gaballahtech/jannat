export type ProductVariant = {
  name: string;
  hex: string;
  image: string;
};

export type Product = {
  id: string;
  name: string;
  price: number; // EGP
  variants: ProductVariant[];
  tag?: string;
  category: string; // category id (admin-managed, see /admin → categories)
  description: string;
  fabric?: string;
  /** Units sold — shown as "X+ SOLD" on cards only when > 0.
      Real sales sync happens after the backend/database is connected. */
  sold: number;
  /** Live inventory. 0 = sold out. Managed from #/admin. */
  stock: number;
  /** Exact sizes this product comes in (subset of KNOWN_SIZES). */
  sizes: string[];
  /** Precise per-cell stock: key `${variantName}|${size}` → pieces. Sum = stock. */
  inventory: Record<string, number>;
  /** ISO date the product was added — drives New Arrivals order (newest first). */
  createdAt: string;
  /** Hand-picked "complete the look" product ids (max 2) — chosen in /admin.
      Missing or sold-out picks are hidden automatically. */
  pairsWith: string[];
};

const img = (id: string, w = 900) =>
  `https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;

/* ---------- Egypt defaults (live values come from /admin → business info) ---------- */
export const SHIPPING_FEE = 70; // EGP flat fallback, all governorates
/** At or below this stock, storefront shows "ONLY X LEFT". Managed from #/admin. */
export const LOW_STOCK = 5;

export const SIZES = ['S', 'M', 'L', 'XL'] as const;

/** All known sizes the admin can offer per product. */
export const KNOWN_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ONE SIZE'] as const;

export const CATEGORIES = [
  { id: 'all', label: 'ALL' },
  { id: 'hoodies', label: 'HOODIES' },
  { id: 'jackets', label: 'JACKETS' },
  { id: 'pants', label: 'PANTS' },
  { id: 'tees', label: 'T-SHIRTS' },
  { id: 'accessories', label: 'ACCESSORIES' },
] as const;

export const PRODUCTS: Product[] = [
  {
    id: 'utility-hoodie',
    sold: 0,
    createdAt: '2026-02-01',
    pairsWith: ['cargo-pants', 'bucket-hat'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'UTILITY HOODIE',
    price: 950,
    stock: 24,
    tag: 'BESTSELLER',
    category: 'hoodies',
    description:
      'Heavyweight 480gsm brushed fleece hoodie. Double-layer hood, kangaroo cargo pocket and tonal chest embroidery. Warm enough for Egypt winter nights.',
    fabric: '480 GSM brushed fleece — 80% cotton / 20% polyester',
    variants: [
      { name: 'Grey', hex: '#6b7280', image: img('photo-1556821840-3a63f95609a7') },
      { name: 'Beige', hex: '#c9bda6', image: img('photo-1685328403755-de1d57e12e63') },
      { name: 'Orange', hex: '#c9722e', image: img('photo-1509942774463-acf339cf87d5') },
    ],
  },
  {
    id: 'tech-cargo-hoodie',
    sold: 0,
    createdAt: '2026-09-20',
    pairsWith: ['cargo-pants', 'oversized-tee'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'TECH CARGO HOODIE',
    price: 1100,
    stock: 15,
    tag: 'NEW',
    category: 'hoodies',
    description:
      'Cargo hoodie with side utility pockets, adjustable shock-cord hem and matte black drawcords. Built for daily wear in the city.',
    fabric: '450 GSM loopback fleece — 100% cotton face',
    variants: [
      { name: 'Black', hex: '#111111', image: img('photo-1578681994506-b8f463449011') },
      { name: 'Mustard', hex: '#c99a2e', image: img('photo-1609873814058-a8928924184a') },
    ],
  },
  {
    id: 'oversized-hoodie',
    sold: 0,
    createdAt: '2026-06-20',
    pairsWith: ['cargo-pants', 'shoulder-bag'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'OVERSIZED HOODIE',
    price: 850,
    stock: 18,
    tag: 'NEW',
    category: 'hoodies',
    description:
      'Boxy oversized fit with dropped shoulders and wide ribbed cuffs. The everyday hoodie — soft, heavy, simple.',
    fabric: '420 GSM fleece — 80% cotton / 20% polyester',
    variants: [
      { name: 'Cream', hex: '#ece5d8', image: img('photo-1620799140408-edc6dcb6d633') },
    ],
  },
  {
    id: 'shell-jacket',
    sold: 0,
    createdAt: '2026-04-12',
    pairsWith: ['cargo-pants', 'bucket-hat'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'WINTER SHELL JACKET',
    price: 1450,
    stock: 8,
    category: 'jackets',
    description:
      'Water-resistant shell jacket with fleece lining, storm cuffs and 4 pockets. For rain and cold Alexandria / Cairo nights.',
    fabric: 'DWR-coated shell with fleece lining',
    variants: [
      { name: 'Camel', hex: '#b98d5e', image: img('photo-1591047139829-d91aecb6caea') },
    ],
  },
  {
    id: 'cargo-pants',
    sold: 0,
    createdAt: '2026-01-10',
    pairsWith: ['utility-hoodie', 'oversized-tee'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'CARGO PANTS',
    price: 750,
    stock: 20,
    category: 'pants',
    description:
      'Relaxed cargo pants with 6 pockets, adjustable ankle cords and durable ripstop fabric. Matches every hoodie.',
    fabric: 'Ripstop cotton twill',
    variants: [
      { name: 'Beige', hex: '#c4a189', image: img('photo-1594633312681-425c7b97ccd1') },
      { name: 'Denim Blue', hex: '#3b5a80', image: img('photo-1542272604-787c3835535d') },
      { name: 'Black', hex: '#111111', image: img('photo-1624378439575-d8705ad7ae80') },
    ],
  },
  {
    id: 'oversized-tee',
    sold: 0,
    createdAt: '2025-12-01',
    pairsWith: ['cargo-pants', 'bucket-hat'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'OVERSIZED T-SHIRT',
    price: 350,
    stock: 30,
    category: 'tees',
    description:
      'Heavy 260gsm oversized tee with boxy cut and ribbed collar. Pre-shrunk, doesn’t lose shape after washing.',
    fabric: '260 GSM combed cotton',
    variants: [
      { name: 'White', hex: '#f5f5f5', image: img('photo-1521572163474-6864f9cf17ab') },
      { name: 'Black', hex: '#111111', image: img('photo-1618354691373-d851c5c3a990') },
      { name: 'Sage', hex: '#9aa39b', image: img('photo-1523381210434-271e8be1f52b') },
    ],
  },
  {
    id: 'denim-jacket',
    sold: 0,
    createdAt: '2026-08-02',
    pairsWith: ['cargo-pants', 'oversized-tee'],
    sizes: ['S', 'M', 'L', 'XL'],
    inventory: {},
    name: 'FIELD JACKET',
    price: 1250,
    stock: 10,
    category: 'jackets',
    description:
      'Classic field jacket with flap pockets and relaxed fit. Rugged cotton twill that ages beautifully.',
    fabric: 'Heavy cotton twill',
    variants: [
      { name: 'Olive', hex: '#5a5a3a', image: img('photo-1544022613-e87ca75a784a') },
    ],
  },
  {
    id: 'bucket-hat',
    sold: 0,
    createdAt: '2025-12-15',
    pairsWith: ['utility-hoodie', 'oversized-tee'],
    sizes: ['ONE SIZE'],
    inventory: {},
    name: 'BUCKET HAT',
    price: 250,
    stock: 25,
    category: 'accessories',
    description: 'Cotton twill bucket hat. One size with inner drawcord — fits S to XL.',
    variants: [
      { name: 'Beige', hex: '#c9bda6', image: img('photo-1578681994506-b8f463449011') },
    ],
  },
  {
    id: 'shoulder-bag',
    sold: 0,
    createdAt: '2026-03-05',
    pairsWith: ['oversized-hoodie', 'oversized-tee'],
    sizes: ['ONE SIZE'],
    inventory: {},
    name: 'SHOULDER BAG',
    price: 450,
    stock: 12,
    category: 'accessories',
    description: 'Everyday crossbody bag with adjustable strap, fits phone, wallet and keys.',
    variants: [{ name: 'Black', hex: '#111111', image: img('photo-1553062407-98eeb64c6a62') }],
  },
];

/* ---------- formatting & whatsapp ---------- */
export const formatEGP = (v: number) => `EGP ${v.toLocaleString('en-EG')}`;

export type OrderLine = {
  name: string;
  variant?: string;
  size?: string;
  qty: number;
  price: number;
};

/* Customer details collected BEFORE WhatsApp (never the phone — WhatsApp already shows it). */
export type CustomerInfo = {
  name: string;
  governorate?: string;
  city?: string;
  address?: string;
};

export function buildWhatsAppOrderLink(
  lines: OrderLine[],
  shipping = SHIPPING_FEE,
  waNumber = '201203252464',
  customer?: CustomerInfo,
) {
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
  const who = customer?.name ? ` — ${customer.name}` : '';
  const where = [customer?.city, customer?.governorate].filter(Boolean).join(', ');
  const body = [
    `Hi pearlin! I want to order${who}:`,
    '',
    ...lines.map(
      (l) =>
        `- ${l.name}${l.variant ? ` (${l.variant})` : ''}${l.size ? ` — Size ${l.size}` : ''} x${l.qty} — ${formatEGP(l.price * l.qty)}`,
    ),
    '',
    `Subtotal: ${formatEGP(total)}`,
    `Shipping (all Egypt): ${formatEGP(shipping)}`,
    `Total: ${formatEGP(total + shipping)}`,
    'Payment: Online (we will confirm payment details here on WhatsApp)',
    '',
    ...(customer?.name ? [`Name: ${customer.name}`] : []),
    ...(where ? [`City: ${where}`] : []),
    ...(customer?.address ? [`Address: ${customer.address}`] : []),
  ].join('\n');
  return `https://wa.me/${waNumber}?text=${encodeURIComponent(body)}`;
}
