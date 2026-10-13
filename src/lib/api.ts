/* Typed client for the pearlin server API (/api/*).
   Every call fails soft (throws) — callers decide fallback (usually: local data). */

export type ApiProduct = {
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

export type ApiCategory = { id: string; label: string };

export type CatalogBundle = {
  products: ApiProduct[];
  categories: ApiCategory[];
  settings: Record<string, unknown>;
  home: { hero: { productId: string; variant: string }[] };
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON (proxy error page, offline) */
  }
  if (!res.ok) {
    const msg =
      body && typeof body === 'object' && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body as T;
}

/* ---------- public ---------- */

export function fetchCatalog(signal?: AbortSignal): Promise<CatalogBundle> {
  return req<CatalogBundle>('/api/catalog', { signal });
}

/* ---------- server snapshot: lets the old sync getters (getSettings/getHome)
   serve database values without rewriting every component. ---------- */

let serverBiz: Record<string, unknown> | null = null;
let serverHome: { hero: { productId: string; variant: string }[] } | null = null;
let serverOn = false;

export function setServerSnapshot(bundle: Pick<CatalogBundle, 'settings'> & { home?: CatalogBundle['home'] }): void {
  const biz = bundle.settings['biz'];
  serverBiz = biz && typeof biz === 'object' ? (biz as Record<string, unknown>) : null;
  serverHome =
    bundle.home && Array.isArray(bundle.home.hero)
      ? { hero: bundle.home.hero.filter((s) => s && typeof s.productId === 'string') }
      : null;
  serverOn = true;
}

export function clearServerSnapshot(): void {
  serverBiz = null;
  serverHome = null;
  serverOn = false;
}

export function isServerOn(): boolean {
  return serverOn;
}

export function getServerBiz(): Record<string, unknown> | null {
  return serverBiz;
}

export function getServerHome(): { hero: { productId: string; variant: string }[] } | null {
  return serverHome;
}

/* ---------- owner auth (server mode) ---------- */

export type AuthStatus = { mode: 'server'; hasOwner: boolean } | { mode: 'local' };

export function fetchAuthStatus(signal?: AbortSignal): Promise<AuthStatus> {
  return req<AuthStatus>('/api/auth?action=status', { signal });
}

export function apiMe(): Promise<{ owner: { email: string } }> {
  return req('/api/auth?action=me');
}

export function apiLogin(email: string, password: string): Promise<{ owner: { email: string } }> {
  return req('/api/auth?action=login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function apiSetup(email: string, password: string): Promise<{ owner: { email: string } }> {
  return req('/api/auth?action=setup', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function apiLogout(): Promise<{ ok: boolean }> {
  return req('/api/auth?action=logout', { method: 'POST' });
}

/* ---------- admin writes (server mode) ---------- */

function write<T>(path: string, method: string, body?: unknown): Promise<T> {
  return req<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
}

export const apiAdmin = {
  products: () => req<{ products: ApiProduct[] }>('/api/admin/products'),
  createProduct: (p: Record<string, unknown>) =>
    write<{ product: ApiProduct }>('/api/admin/products', 'POST', p),
  updateProduct: (id: string, p: Record<string, unknown>) =>
    write<{ product: ApiProduct }>(`/api/admin/products/${encodeURIComponent(id)}`, 'PUT', p),
  deleteProduct: (id: string) =>
    write<{ ok: boolean }>(`/api/admin/products/${encodeURIComponent(id)}`, 'DELETE'),
  createCategory: (label: string) =>
    write<{ category: ApiCategory }>('/api/admin/categories', 'POST', { label }),
  renameCategory: (id: string, label: string) =>
    write<{ category: ApiCategory }>(`/api/admin/categories/${encodeURIComponent(id)}`, 'PUT', { label }),
  deleteCategory: (id: string) =>
    write<{ ok: boolean }>(`/api/admin/categories/${encodeURIComponent(id)}`, 'DELETE'),
  saveSetting: (key: string, value: unknown) =>
    write<{ ok: boolean }>('/api/admin/settings', 'PUT', { key, value }),
  invoices: () => req<{ invoices: Record<string, unknown>[] }>('/api/admin/invoices'),
  createInvoice: (inv: Record<string, unknown>) =>
    write<{ invoice: Record<string, unknown> }>('/api/admin/invoices', 'POST', inv),
  voidInvoice: (id: string) =>
    write<{ ok: boolean }>(`/api/admin/invoices/${encodeURIComponent(id)}`, 'DELETE'),
};
