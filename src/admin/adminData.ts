/* Admin data layer — small JSON records in localStorage (one key per concern,
   never one giant blob), images in IndexedDB (see db.ts).
   NOTE: this is device-local storage. It works today with zero servers;
   when the business grows, swap these functions for Supabase/Firebase calls —
   every consumer goes through this module + CatalogContext, so the UI won't change. */

import { PRODUCTS, SHIPPING_FEE, type Product, type ProductVariant } from '../data/store';
import { blobToDataUrl, dataUrlToBlob, idbAll, idbClear, idbDel, idbSet, refKey } from './db';

/* ================= categories (admin-managed) ================= */

export type Category = { id: string; label: string };

const CATS_KEY = 'pearlin-admin-cats-v1';

export function defaultCategories(): Category[] {
  return [
    { id: 'hoodies', label: 'HOODIES' },
    { id: 'jackets', label: 'JACKETS' },
    { id: 'pants', label: 'PANTS' },
    { id: 'tees', label: 'T-SHIRTS' },
    { id: 'accessories', label: 'ACCESSORIES' },
  ];
}

export function getCategories(): Category[] {
  const v = read<Category[]>(CATS_KEY, []);
  if (!Array.isArray(v) || v.length === 0) return defaultCategories();
  const clean = v.filter((c) => c && typeof c.id === 'string' && typeof c.label === 'string');
  return clean.length > 0 ? clean : defaultCategories();
}

export function saveCategories(cats: Category[]) {
  write(CATS_KEY, cats);
}

function slugCat(label: string, taken: Set<string>): string {
  let slug = label
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (!slug) slug = `cat-${Date.now().toString(36)}`;
  let id = slug;
  let n = 2;
  while (taken.has(id)) id = `${slug}-${n++}`;
  return id;
}

export function addCategory(label: string): Category | null {
  const name = label.trim();
  if (!name) return null;
  const cats = getCategories();
  const cat = { id: slugCat(name, new Set(cats.map((c) => c.id))), label: name.toUpperCase() };
  saveCategories([...cats, cat]);
  return cat;
}

export function renameCategory(id: string, label: string): boolean {
  const name = label.trim();
  if (!name) return false;
  saveCategories(getCategories().map((c) => (c.id === id ? { ...c, label: name.toUpperCase() } : c)));
  return true;
}

/** Refuses when products still use the category (move them first). */
export function deleteCategory(id: string): { ok: boolean; count: number } {
  const count = mergeCatalog().filter((p) => p.category === id).length;
  if (count > 0) return { ok: false, count };
  saveCategories(getCategories().filter((c) => c.id !== id));
  return { ok: true, count: 0 };
}

export function categoryLabel(id: string): string {
  return getCategories().find((c) => c.id === id)?.label ?? id.toUpperCase();
}

/* ================= homepage control (admin-managed merchandising) ================= */

export type HeroSlide = { productId: string; variant: string };
export type HomeSettings = {
  /** Hero slider slots (product + color shown per slide). */
  hero: HeroSlide[];
};

const HOME_KEY = 'pearlin-admin-home-v1';

export function defaultHome(): HomeSettings {
  return {
    hero: [
      { productId: 'tech-cargo-hoodie', variant: 'Black' },
      { productId: 'utility-hoodie', variant: 'Beige' },
      { productId: 'shell-jacket', variant: 'Camel' },
    ],
  };
}

export function getHome(): HomeSettings {
  const v = read<Partial<HomeSettings>>(HOME_KEY, {});
  const d = defaultHome();
  const hero = Array.isArray(v?.hero) && v.hero.length > 0 ? v.hero : d.hero;
  return {
    hero: hero
      .filter((s) => s && typeof s.productId === 'string')
      .slice(0, 3)
      .map((s) => ({ productId: s.productId, variant: s.variant || '' })),
  };
}

export function saveHome(h: HomeSettings) {
  write(HOME_KEY, h);
}

export type AdminProduct = Product; // stock lives on Product now
export type InvoiceItem = {
  productId: string;
  name: string;
  variant: string;
  size: string;
  qty: number;
  price: number;
};
export type Invoice = {
  id: string;
  number: string;
  createdAt: string; // ISO — issue date (auto today, editable)
  buyerName: string;
  buyerPhone: string;
  buyerCity: string; // governorate / city
  buyerAddress: string; // street / area / landmark
  notes: string;
  paymentMethod: string; // e.g. "Online transfer"
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // EGP amount off (e.g. PEARLIN10 honored manually)
  shipping: number;
  total: number; // subtotal - discount + shipping
};

/* Business profile printed on every invoice. Fill in your real data. */
export type BizSettings = {
  address: string;
  paymentDefault: string;
  terms: string;
  whatsapp: string; // digits with country code, e.g. 201203252464
  instagram: string; // full URL
  tiktok: string; // full URL
  shippingFee: number; // EGP flat, all governorates
  promoCode: string;
  promoPercent: number;
  promoEnabled: boolean;
};

const DEFAULT_BIZ: BizSettings = {
  address: 'Cairo, Egypt',
  paymentDefault: 'Online transfer',
  terms: 'Payment due on receipt. Please check your items on delivery.',
  whatsapp: '201203252464',
  instagram: 'https://www.instagram.com/pearlin.eg/',
  tiktok: 'https://www.tiktok.com/@pearlin.eg',
  shippingFee: 70,
  promoCode: 'PEARLIN10',
  promoPercent: 10,
  promoEnabled: true,
};

export function getSettings(): BizSettings {
  const v = read<Partial<BizSettings>>('pearlin-admin-settings-v1', {});
  return { ...DEFAULT_BIZ, ...(v && typeof v === 'object' ? v : {}) };
}

export function saveSettings(s: BizSettings) {
  write('pearlin-admin-settings-v1', s);
}

/** Shared totals math — builder, canvas and preview must never disagree. */
export function calcTotals(subtotal: number, discount: number, shipping: number) {
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const taxable = subtotal - safeDiscount;
  const total = Math.round((taxable + Math.max(0, shipping)) * 100) / 100;
  return { discount: safeDiscount, taxable, total };
}

const K = {
  products: 'pearlin-admin-products-v1',
  deleted: 'pearlin-admin-deleted-v1',
  invoices: 'pearlin-admin-invoices-v1',
  counter: 'pearlin-admin-counter-v1',
  pin: 'pearlin-admin-pin',
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota/private mode — admin edits just won't persist */
  }
}

/* ---------- products ---------- */

export function getOverrides(): Record<string, AdminProduct> {
  const v = read<Record<string, AdminProduct>>(K.products, {});
  return v && typeof v === 'object' ? v : {};
}

export function saveOverride(p: AdminProduct) {
  const all = getOverrides();
  all[p.id] = p;
  write(K.products, all);
}

export function getDeleted(): string[] {
  const v = read<string[]>(K.deleted, []);
  return Array.isArray(v) ? v : [];
}

/** Delete a product (tombstone + remove its uploaded images from IndexedDB). */
export async function deleteProduct(id: string) {
  const overrides = getOverrides();
  const rec = overrides[id];
  if (rec) {
    for (const v of rec.variants) {
      const k = refKey(v.image);
      if (k) await idbDel(k);
    }
    delete overrides[id];
    write(K.products, overrides);
  }
  const deleted = getDeleted();
  if (!deleted.includes(id)) {
    deleted.push(id);
    write(K.deleted, deleted);
  }
}

/** Static catalog + admin overrides − tombstones + admin-added products.
 *  Every product leaves here with a complete sizes[] + inventory matrix. */
export function mergeCatalog(): AdminProduct[] {
  const overrides = getOverrides();
  const deleted = new Set(getDeleted());
  const base = PRODUCTS.filter((p) => !deleted.has(p.id)).map((p) =>
    ensureMatrix(overrides[p.id] ?? p),
  );
  const customs = Object.values(overrides)
    .filter((o) => !deleted.has(o.id) && !PRODUCTS.some((p) => p.id === o.id))
    .map(ensureMatrix);
  return [...base, ...customs];
}

/* ================= inventory matrix (variant × size) ================= */

export const cellKey = (variant: string, size: string) => `${variant}||${size}`;

export function cellQty(p: Pick<Product, 'inventory'>, variant: string, size: string): number {
  return Math.max(0, Math.floor(Number(p.inventory?.[cellKey(variant, size)]) || 0));
}

export function stockTotal(p: Pick<Product, 'inventory'>): number {
  return Object.values(p.inventory ?? {}).reduce((s, n) => s + (Math.max(0, Math.floor(Number(n) || 0))), 0);
}

function defaultSizesFor(category: string): string[] {
  return category === 'accessories' ? ['ONE SIZE'] : ['S', 'M', 'L', 'XL'];
}

/** Fill missing sizes/inventory deterministically.
 *  NEVER silently discards pieces: counts that no longer match any
 *  variant×size cell ("orphans" — e.g. after a rename or size change) are
 *  redistributed evenly across the new matrix, so the grand total is preserved. */
export function ensureMatrix<T extends Product>(p: T): T & { sizes: string[]; inventory: Record<string, number> } {
  const sizes = Array.isArray(p.sizes) && p.sizes.length > 0 ? [...p.sizes] : defaultSizesFor(p.category);
  const old = p.inventory && typeof p.inventory === 'object' ? p.inventory : {};
  // normalize old keys (case-insensitive) so renames still match
  const normOld: Record<string, number> = {};
  for (const [k, n] of Object.entries(old)) {
    const q = Math.max(0, Math.floor(Number(n) || 0));
    if (q > 0) {
      const lk = k.toLowerCase();
      normOld[lk] = (normOld[lk] ?? 0) + q;
    }
  }
  const inventory: Record<string, number> = {};
  for (const v of p.variants)
    for (const s of sizes) {
      const k = cellKey(v.name, s);
      const lk = k.toLowerCase();
      const q = normOld[lk] ?? 0;
      inventory[k] = q;
      if (q > 0) delete normOld[lk];
    }
  // orphan stock (renamed colors, removed sizes) → redistribute, never drop
  let orphan = Object.values(normOld).reduce((a, n) => a + n, 0);
  if (Object.keys(old).length === 0) {
    orphan = Math.max(0, Math.floor(Number(p.stock) || 0)); // legacy seed path
  }
  const keys = Object.keys(inventory);
  if (orphan > 0 && keys.length > 0) {
    const base = Math.floor(orphan / keys.length);
    let rest = orphan - base * keys.length;
    for (const k of keys) {
      inventory[k] += base + (rest > 0 ? 1 : 0);
      if (rest > 0) rest -= 1;
    }
  }
  const stock = Object.values(inventory).reduce((s, n) => s + n, 0);
  const pairsWith = Array.isArray((p as { pairsWith?: unknown }).pairsWith)
    ? (p.pairsWith as string[]).filter((x): x is string => typeof x === 'string')
    : [];
  return { ...p, sizes, inventory, stock, pairsWith };
}

export function findAdminProduct(id: string): AdminProduct | undefined {
  return mergeCatalog().find((p) => p.id === id);
}

/** Sell (+) or restock (−) one exact cell. Clamps at zero, keeps totals in sync. */
export function changeStockCell(id: string, variant: string, size: string, qtySold: number) {
  const cur = findAdminProduct(id);
  if (!cur) return;
  const full = ensureMatrix(cur);
  const k = cellKey(variant, size);
  const before = full.inventory[k] ?? 0;
  const soldDelta = qtySold > 0 ? Math.min(before, qtySold) : qtySold;
  const next = {
    ...full,
    inventory: { ...full.inventory, [k]: Math.max(0, before - qtySold) },
  };
  next.stock = stockTotal(next);
  next.sold = Math.max(0, next.sold + soldDelta);
  saveOverride(next);
}

export function slugId(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'item';
  return `custom-${slug}-${Date.now().toString(36)}`;
}

export const blankVariant = (): ProductVariant & { _file?: File | null } => ({
  name: '',
  hex: '#111111',
  image: '',
});

/* ---------- invoices ---------- */

export function getInvoices(): Invoice[] {
  const v = read<Invoice[]>(K.invoices, []);
  return Array.isArray(v) ? v : [];
}

function getCounter(): number {
  return read<number>(K.counter, 0);
}

export function peekInvoiceNumber(): string {
  return `PR-${String(getCounter() + 1).padStart(4, '0')}`;
}

export function saveInvoice(input: Omit<Invoice, 'id' | 'number'>): Invoice {
  const n = getCounter() + 1;
  write(K.counter, n);
  const inv: Invoice = {
    ...input,
    id: `inv-${Date.now().toString(36)}-${n}`,
    number: `PR-${String(n).padStart(4, '0')}`,
  };
  const all = getInvoices();
  all.unshift(inv);
  write(K.invoices, all);
  // A saved invoice is a completed sale → decrement the EXACT cell of every line.
  for (const line of inv.items) changeStockCell(line.productId, line.variant, line.size, line.qty);
  return inv;
}

/** Delete an invoice and give its stock back (voided sales shouldn't eat inventory). */
export function voidInvoice(id: string) {
  const all = getInvoices();
  const inv = all.find((i) => i.id === id);
  if (!inv) return;
  for (const line of inv.items) changeStockCell(line.productId, line.variant, line.size, -line.qty);
  write(
    K.invoices,
    all.filter((i) => i.id !== id),
  );
}

export function defaultShipping(): number {
  const n = Number(getSettings().shippingFee);
  return n > 0 ? n : SHIPPING_FEE;
}

export function getShippingFee(): number {
  return defaultShipping();
}

export function getPromo(): { code: string; percent: number; enabled: boolean } {
  const s = getSettings();
  return {
    code: (s.promoCode || 'PEARLIN10').toUpperCase(),
    percent: Math.max(0, Number(s.promoPercent) || 0),
    enabled: s.promoEnabled !== false,
  };
}

/** Normalize any Egyptian mobile format to international digits (e.g. 0120… → 20120…). */
export function normalizeWhatsapp(v: string): string {
  const d = v.replace(/\D/g, '');
  if (/^01\d{9}$/.test(d)) return `2${d.slice(1)}`;
  return d;
}

function egyptDisplay(wa: string): string {
  if (/^20\d{10}$/.test(wa)) {
    const r = wa.slice(2);
    return `+20 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6)}`;
  }
  return wa ? `+${wa}` : '';
}

function handleFromUrl(url: string, fallback: string): string {
  try {
    const seg = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
    const clean = seg.replace(/^@/, '');
    return clean ? `@${clean}` : fallback;
  } catch {
    return fallback;
  }
}

/** Live contact info — every WhatsApp/social button on the site reads this. */
export function getContact() {
  const s = getSettings();
  const wa = normalizeWhatsapp(s.whatsapp || '') || '201203252464';
  const instagram = s.instagram?.trim() || 'https://www.instagram.com/pearlin.eg/';
  const tiktok = s.tiktok?.trim() || 'https://www.tiktok.com/@pearlin.eg';
  return {
    whatsapp: wa,
    whatsappDisplay: egyptDisplay(wa),
    whatsappLink: (text: string) => `https://wa.me/${wa}?text=${encodeURIComponent(text)}`,
    instagram,
    instagramHandle: handleFromUrl(instagram, '@pearlin.eg'),
    tiktok,
    tiktokHandle: handleFromUrl(tiktok, '@pearlin.eg'),
  };
}

/* ---------- PIN lock (casual-access deterrent, NOT real security) ----------
   Hardened: SHA-256 hashed (never plaintext), brute-force lockout, and callers
   auto-lock on inactivity. A bot hammering the PIN hits escalating waits. */

async function hashPin(pin: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`pearlin-admin:${pin}`),
      );
      return `sha256:${[...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')}`;
    }
  } catch {
    /* non-secure context — fall through */
  }
  return `plain:${pin}`;
}

export function hasPin(): boolean {
  try {
    return !!localStorage.getItem(K.pin);
  } catch {
    return false;
  }
}

/** Verifies + silently migrates legacy plaintext PINs to SHA-256. */
export async function checkPin(pin: string): Promise<boolean> {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(K.pin);
  } catch {
    return false;
  }
  if (!stored) return false;
  if (stored.startsWith('sha256:')) {
    return (await hashPin(pin)) === stored;
  }
  const legacy = stored.startsWith('plain:') ? stored.slice(6) : stored;
  if (pin !== legacy) return false;
  try {
    localStorage.setItem(K.pin, await hashPin(pin)); // upgrade on success
  } catch {
    /* ignore */
  }
  return true;
}

export async function setPin(pin: string) {
  try {
    localStorage.setItem(K.pin, await hashPin(pin));
  } catch {
    /* ignore */
  }
}

/* ----- brute-force throttle: 5 wrong tries → escalating lockout ----- */
type AttState = { count: number; lockedUntil: number };
const ATT_KEY = 'pearlin-admin-attempts';
const MAX_FREE_TRIES = 5;

function readAtt(): AttState {
  try {
    const raw = localStorage.getItem(ATT_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<AttState>;
      if (typeof v.count === 'number' && typeof v.lockedUntil === 'number') return v as AttState;
    }
  } catch {
    /* ignore */
  }
  return { count: 0, lockedUntil: 0 };
}

function writeAtt(s: AttState) {
  try {
    localStorage.setItem(ATT_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Seconds the user must wait before the next try (0 = free to try). */
export function pinWaitSec(): number {
  const s = readAtt();
  return Math.max(0, Math.ceil((s.lockedUntil - Date.now()) / 1000));
}

export function recordPinFail(): number {
  const s = readAtt();
  s.count += 1;
  let wait = 0;
  if (s.count >= MAX_FREE_TRIES) {
    // 1min, 2min, 4min… capped at 10min — bots give up, humans barely notice once
    wait = Math.min(60 * 2 ** Math.min(s.count - MAX_FREE_TRIES, 3), 600);
    s.lockedUntil = Date.now() + wait * 1000;
  }
  writeAtt(s);
  return wait;
}

export function resetPinAttempts() {
  writeAtt({ count: 0, lockedUntil: 0 });
}

const UNLOCK_KEY = 'pearlin-admin-unlocked';

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function setUnlocked(v: boolean) {
  try {
    if (v) sessionStorage.setItem(UNLOCK_KEY, '1');
    else sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

/* ================= full backup / restore =================
   One JSON file with EVERYTHING (products, stock, images, invoices,
   settings, categories, homepage). Keep a copy off-device — browser data
   can be wiped. Images are embedded as compressed dataURLs. */

export type BackupFile = {
  app: 'pearlin-backup';
  version: 1;
  exportedAt: string;
  localStorage: Record<string, string>;
  images: { key: string; dataUrl: string }[];
};

const BACKUP_LS_KEYS = [
  'pearlin-admin-products-v1',
  'pearlin-admin-deleted-v1',
  'pearlin-admin-invoices-v1',
  'pearlin-admin-counter-v1',
  'pearlin-admin-pin',
  'pearlin-admin-settings-v1',
  'pearlin-admin-cats-v1',
  'pearlin-admin-home-v1',
  'pearlin-wishlist',
];

export async function exportBackup(): Promise<{ filename: string; url: string; sizeKb: number }> {
  const localStorage: Record<string, string> = {};
  for (const k of BACKUP_LS_KEYS) {
    try {
      const v = window.localStorage.getItem(k);
      if (v != null) localStorage[k] = v;
    } catch {
      /* skip unreadable */
    }
  }
  const images: { key: string; dataUrl: string }[] = [];
  for (const { key, blob } of await idbAll()) {
    try {
      images.push({ key, dataUrl: await blobToDataUrl(blob) });
    } catch {
      /* skip broken blob */
    }
  }
  const file: BackupFile = {
    app: 'pearlin-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    localStorage,
    images,
  };
  const json = JSON.stringify(file);
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const d = new Date();
  const stamp = `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, '0')}-${`${d.getDate()}`.padStart(2, '0')}`;
  return { filename: `pearlin-backup-${stamp}.json`, url, sizeKb: Math.round(json.length / 1024) };
}

export async function importBackup(file: BackupFile): Promise<void> {
  if (!file || file.app !== 'pearlin-backup' || file.version !== 1) {
    throw new Error('Not a pearlin backup file.');
  }
  if (file.localStorage && typeof file.localStorage === 'object') {
    for (const [k, v] of Object.entries(file.localStorage)) {
      if (typeof v === 'string') {
        try {
          window.localStorage.setItem(k, v);
        } catch {
          /* quota — keep going */
        }
      }
    }
  }
  await idbClear();
  if (Array.isArray(file.images)) {
    for (const { key, dataUrl } of file.images) {
      if (typeof key !== 'string' || typeof dataUrl !== 'string') continue;
      try {
        await idbSet(key, await dataUrlToBlob(dataUrl));
      } catch {
        /* skip broken image */
      }
    }
  }
}
