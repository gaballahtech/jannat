import { useEffect, useRef, useState } from 'react';

/* Clean, real URLs via the History API (no hash):
   /                            → home
   /shop                        → all products
   /shop/hoodies                → category filter (also: jackets, pants, tees, accessories)
   /shop/saved                  → wishlist
   /product/utility-hoodie      → product page (?color=Beige&size=M preserves selection)
   /search?q=hoodie             → search results
   /admin/overview …            → dashboard tabs

   NOTE for deployment: static hosts must rewrite ALL paths to /index.html
   (vercel.json + public/_redirects are included for Vercel/Netlify).
   Old `#/...` links auto-redirect to their clean equivalent. */

export type Route =
  | { view: 'home' }
  | { view: 'shop'; category: string; saved: boolean; sort: string }
  | { view: 'product'; id: string; color?: string; size?: string }
  | { view: 'search'; q: string }
  | { view: 'admin'; tab: string }
  | { view: 'notfound'; path: string };

function rawPath(): string {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search || '/';
}

export function parsePath(path: string): Route {
  const qi = path.indexOf('?');
  const pathPart = qi >= 0 ? path.slice(0, qi) : path;
  const queryPart = qi >= 0 ? path.slice(qi + 1) : '';
  const q = new URLSearchParams(queryPart);
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);

  if (segs[0] === 'product' && segs[1]) {
    return {
      view: 'product',
      id: segs[1],
      color: q.get('color') ?? undefined,
      size: q.get('size') ?? undefined,
    };
  }
  if (segs[0] === 'shop') {
    const c = (segs[1] ?? 'all').toLowerCase();
    return {
      view: 'shop',
      category: c === 'saved' ? 'all' : c,
      saved: c === 'saved',
      sort: q.get('sort') ?? 'featured',
    };
  }
  if (segs[0] === 'search') {
    return { view: 'search', q: q.get('q') ?? '' };
  }
  if (segs[0] === 'admin') {
    return { view: 'admin', tab: (segs[1] ?? 'overview').toLowerCase() };
  }
  if (segs.length === 0) return { view: 'home' };
  if (segs[0] === 'product' && !segs[1]) return { view: 'notfound', path };
  return { view: 'notfound', path };
}

const ROUTE_EVENT = 'pearlin:route';

export function navigate(to: string, opts?: { replace?: boolean }) {
  if (typeof window === 'undefined') return;
  const url = to;
  const current = rawPath();
  if (opts?.replace) {
    window.history.replaceState(null, '', url);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  } else if (current === url) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    window.history.pushState(null, '', url);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }
}

/** Pathname without query — used to decide when to scroll to top. */
function pathOf(full: string): string {
  const qi = full.indexOf('?');
  return qi >= 0 ? full.slice(0, qi) : full;
}

export function useRoute(): Route {
  const [path, setPath] = useState<string>(() => rawPath());
  const lastPathRef = useRef<string>(pathOf(rawPath()));
  useEffect(() => {
    const onChange = () => {
      const p = rawPath();
      const base = pathOf(p);
      // Only jump to top when the page itself changed —
      // query-only changes (color, size, sort, typing) keep scroll position.
      if (base !== lastPathRef.current) {
        lastPathRef.current = base;
        window.scrollTo({ top: 0 });
      }
      setPath(p);
    };
    window.addEventListener('popstate', onChange);
    window.addEventListener(ROUTE_EVENT, onChange);
    return () => {
      window.removeEventListener('popstate', onChange);
      window.removeEventListener(ROUTE_EVENT, onChange);
    };
  }, []);
  return parsePath(path);
}

/* ---------- path builders ---------- */

export const homePath = '/';

export function shopPath(category = 'all', sort?: string): string {
  const s = sort && sort !== 'featured' ? `?sort=${encodeURIComponent(sort)}` : '';
  return `/shop${category === 'all' ? '' : `/${encodeURIComponent(category)}`}${s}`;
}

export const savedPath = '/shop/saved';

export function productPath(id: string, color?: string, size?: string): string {
  const q = new URLSearchParams();
  if (color) q.set('color', color);
  if (size) q.set('size', size);
  const qs = q.toString();
  return `/product/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`;
}

export function searchPath(q: string): string {
  return q ? `/search?q=${encodeURIComponent(q)}` : '/search';
}

export const adminPath = (tab = 'overview') => `/admin/${tab}`;

/* ---------- in-app link interception ---------- */

let intercepted = false;

/** Makes plain <a href="/…"> links navigate without a full page reload.
 *  External links, new-tab links and downloads are left alone. */
export function initLinkInterception() {
  if (intercepted || typeof document === 'undefined') return;
  intercepted = true;
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement | null)?.closest?.('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || !href.startsWith('/')) return;
    if (href.startsWith('//')) return;
    const target = a.getAttribute('target');
    if (target && target !== '_self') return;
    if (a.hasAttribute('download')) return;
    e.preventDefault();
    navigate(href);
  });
}

/** One-time upgrade: old `#/...` bookmarks land on their clean equivalent. */
export function consumeLegacyHash() {
  if (typeof window === 'undefined') return;
  const h = window.location.hash;
  if (h && h.startsWith('#/')) {
    const clean = h.slice(1) || '/';
    window.history.replaceState(null, '', clean);
    window.dispatchEvent(new Event(ROUTE_EVENT));
  }
}

/* ---------- home section jumps (NEW IN / CONTACT) ---------- */

let pendingSection: string | null = null;

export function goHome(section?: string) {
  pendingSection = section ?? null;
  if (typeof window === 'undefined') return;
  if (pathOf(rawPath()) === '/') {
    const s = pendingSection;
    pendingSection = null;
    if (s) scrollToSection(s);
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    navigate('/');
  }
}

/** Consumed once by the home view right after it mounts. */
export function consumePendingSection(): string | null {
  const s = pendingSection;
  pendingSection = null;
  return s;
}

export function scrollToSection(id: string) {
  // Wait a tick so the target section is painted before scrolling.
  window.setTimeout(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
}
