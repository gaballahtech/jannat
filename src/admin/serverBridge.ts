/* Server/local bridge for the admin dashboard.
   Server mode (Neon via /api): every mutation hits the database, then the
   caller refreshes CatalogContext so the whole store updates instantly.
   Local mode (no backend): the original localStorage functions run instead.
   Tabs call these — never adminData.* or apiAdmin.* directly. */

import {
  addCategory,
  deleteCategory,
  deleteProduct,
  exportBackup,
  getCategories,
  getHome,
  getInvoices,
  getSettings,
  renameCategory,
  saveHome,
  saveInvoice,
  saveOverride,
  saveSettings,
  voidInvoice,
  type BizSettings,
  type Category,
  type HomeSettings,
  type Invoice,
} from './adminData';
import type { Product } from '../data/store';
import { apiAdmin, apiPassword, fetchCatalog, isServerOn } from '../lib/api';

export const isServer = (): boolean => isServerOn();

/* ---------- products ---------- */

export async function bridgeSaveProduct(record: Product, isNew: boolean): Promise<void> {
  if (!isServerOn()) {
    saveOverride(record);
    return;
  }
  if (isNew) await apiAdmin.createProduct(record as unknown as Record<string, unknown>);
  else await apiAdmin.updateProduct(record.id, record as unknown as Record<string, unknown>);
}

export async function bridgeDeleteProduct(id: string): Promise<void> {
  if (!isServerOn()) {
    await deleteProduct(id);
    return;
  }
  await apiAdmin.deleteProduct(id);
}

/* ---------- categories ---------- */

export async function bridgeAddCategory(label: string): Promise<Category | null> {
  if (!isServerOn()) return addCategory(label);
  const clean = label.trim();
  if (!clean) return null;
  const r = await apiAdmin.createCategory(clean);
  return r.category;
}

export async function bridgeRenameCategory(id: string, label: string): Promise<boolean> {
  if (!isServerOn()) return renameCategory(id, label);
  if (!label.trim()) return false;
  await apiAdmin.renameCategory(id, label);
  return true;
}

export async function bridgeDeleteCategory(id: string): Promise<{ ok: boolean; count: number; error?: string }> {
  if (!isServerOn()) return deleteCategory(id);
  try {
    await apiAdmin.deleteCategory(id);
    return { ok: true, count: 0 };
  } catch (e) {
    return { ok: false, count: -1, error: e instanceof Error ? e.message : 'Delete failed.' };
  }
}

export function bridgeListCategories(): Category[] {
  return getCategories();
}

/* ---------- settings & home ---------- */

export async function bridgeSaveSettings(biz: BizSettings): Promise<void> {
  if (!isServerOn()) {
    saveSettings(biz);
    return;
  }
  await apiAdmin.saveSetting('biz', biz);
}

export async function bridgeSaveHome(home: HomeSettings): Promise<void> {
  if (!isServerOn()) {
    saveHome(home);
    return;
  }
  await apiAdmin.saveSetting('home', home);
}

/* ---------- invoices ---------- */

function rowToInvoice(r: Record<string, unknown>): Invoice {
  const pick = (v: unknown, fb = ''): string => (typeof v === 'string' ? v : fb);
  const num = (v: unknown): number => Math.max(0, Math.floor(Number(v) || 0));
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    id: String(r.id ?? ''),
    number: String(r.number ?? ''),
    createdAt: typeof r.created_at === 'string' ? r.created_at : new Date().toISOString(),
    buyerName: pick(r.buyer_name),
    buyerPhone: pick(r.buyer_phone),
    buyerCity: pick(r.buyer_city),
    buyerAddress: pick(r.buyer_address),
    notes: pick(r.notes),
    paymentMethod: pick(r.payment_method),
    items: items
      .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
      .map((l) => ({
        productId: String(l.productId ?? ''),
        name: String(l.name ?? ''),
        variant: String(l.variant ?? ''),
        size: String(l.size ?? ''),
        qty: Math.max(1, Math.floor(Number(l.qty) || 1)),
        price: num(l.price),
      })),
    subtotal: num(r.subtotal),
    discount: num(r.discount),
    shipping: num(r.shipping),
    total: num(r.total),
  };
}

export async function bridgeListInvoices(): Promise<Invoice[]> {
  if (!isServerOn()) return getInvoices();
  const r = await apiAdmin.invoices();
  return r.invoices.map(rowToInvoice);
}

export async function bridgePeekNumber(): Promise<string> {
  const invoices = await bridgeListInvoices();
  let max = 0;
  for (const inv of invoices) {
    const m = /^PR-(\d+)$/.exec(inv.number);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PR-${String(max + 1).padStart(4, '0')}`;
}

export async function bridgeCreateInvoice(input: Omit<Invoice, 'id' | 'number'>): Promise<Invoice> {
  if (!isServerOn()) return saveInvoice(input);
  const r = await apiAdmin.createInvoice({
    ...input,
    createdAt: input.createdAt,
    buyerName: input.buyerName,
    buyerPhone: input.buyerPhone,
    buyerCity: input.buyerCity,
    buyerAddress: input.buyerAddress,
    notes: input.notes,
    paymentMethod: input.paymentMethod,
    items: input.items,
    subtotal: input.subtotal,
    discount: input.discount,
    shipping: input.shipping,
    total: input.total,
  });
  return rowToInvoice(r.invoice);
}

export async function bridgeVoidInvoice(id: string): Promise<void> {
  if (!isServerOn()) {
    voidInvoice(id);
    return;
  }
  await apiAdmin.voidInvoice(id);
}

/* ---------- backup & password ---------- */

export async function bridgeExportBackup(): Promise<{ sizeKb: number }> {
  if (!isServerOn()) {
    const { filename, url, sizeKb } = await exportBackup();
    const a = document.createElement('a');
    a.download = filename;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { sizeKb };
  }
  // Server snapshot: live catalog + invoices as one JSON file.
  const [bundle, inv] = await Promise.all([fetchCatalog(), apiAdmin.invoices()]);
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...bundle, invoices: inv.invoices }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.download = `jannat-server-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.href = url;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { sizeKb: Math.round(blob.size / 1024) };
}

export async function bridgeChangePassword(current: string, next: string): Promise<void> {
  await apiPassword(current, next);
}

export function bridgeHome(): HomeSettings {
  return getHome();
}

export function bridgeSettings(): BizSettings {
  return getSettings();
}
