import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cellQty } from '../admin/adminData';
import { useCatalog, useCatalogReady } from '../catalog/CatalogContext';
import type { Product } from '../data/store';
import { goHome, navigate, productPath, savedPath, shopPath, useRoute } from '../router';

const CART_KEY = 'pearlin-cart-v1';

export type CartItem = {
  product: Product;
  variant: string;
  qty: number;
  size: string;
};

export type View = 'home' | 'shop' | 'product';

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isCartOpen: boolean;
  activeView: View;
  selectedProductId: string | null;
  toast: string | null;
  openCart: () => void;
  closeCart: () => void;
  setView: (v: View) => void;
  openProduct: (id: string) => void;
  add: (p: Product, variant?: string, size?: string, qty?: number, _silent?: boolean) => void;
  remove: (id: string, variant: string, size: string) => void;
  setQty: (id: string, variant: string, size: string, qty: number) => void;
  wishlist: string[];
  toggleWish: (id: string) => void;
  isWished: (id: string) => boolean;
  wishOnly: boolean;
  setWishOnly: (v: boolean) => void;
  goToWishlist: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const route = useRoute();
  const catalog = useCatalog();
  const catalogReady = useCatalogReady();
  const [hydrated, setHydrated] = useState(false);
  const toastTimer = useRef<number | null>(null);

  /* Persist the bag across reloads. Rehydrates against the LIVE catalog:
     dropped products vanish, quantities clamp to real stock. */
  useEffect(() => {
    if (!catalogReady || hydrated) return;
    try {
      const raw = localStorage.getItem(CART_KEY);
      if (raw) {
        const lines: unknown = JSON.parse(raw);
        if (Array.isArray(lines)) {
          const restored: CartItem[] = [];
          for (const l of lines) {
            const line = l as { id?: unknown; variant?: unknown; size?: unknown; qty?: unknown };
            if (typeof line.id !== 'string') continue;
            const p = catalog.find((x) => x.id === line.id);
            if (!p || typeof line.variant !== 'string' || typeof line.size !== 'string') continue;
            const max = cellQty(p, line.variant, line.size);
            if (max <= 0 || typeof line.qty !== 'number') continue;
            restored.push({ product: p, variant: line.variant, size: line.size, qty: Math.min(line.qty, max) });
          }
          if (restored.length > 0) setItems(restored);
        }
      }
    } catch {
      /* corrupted cart — start fresh */
    }
    setHydrated(true);
  }, [catalogReady, catalog, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(
        CART_KEY,
        JSON.stringify(
          items.map((i) => ({ id: i.product.id, variant: i.variant, size: i.size, qty: i.qty })),
        ),
      );
    } catch {
      /* private mode — bag just won't persist */
    }
  }, [items, hydrated]);

  /* Live ceiling for any cart line — single source of truth so no UI
     (card, page, bundle, drawer) can ever exceed real stock. */
  const liveMax = useCallback(
    (id: string, variant: string, size: string): number => {
      const p = catalog.find((x) => x.id === id);
      // Deleted product → nothing can be added.
      if (!p) return 0;
      return cellQty(p, variant, size);
    },
    [catalog],
  );

  /* Navigation state is the URL — every view, product, filter and search is a real link. */
  const activeView: View =
    route.view === 'product' ? 'product' : route.view === 'shop' ? 'shop' : 'home';
  const selectedProductId = route.view === 'product' ? route.id : null;
  const wishOnly = route.view === 'shop' && route.saved;
  const [wishlist, setWishlist] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('pearlin-wishlist');
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pearlin-wishlist', JSON.stringify(wishlist));
    } catch {
      /* storage unavailable — wishlist just won't persist */
    }
  }, [wishlist]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const add = useCallback(
    (p: Product, variant?: string, size = 'M', qty = 1, _silent?: boolean) => {
      const v = variant ?? p.variants[0]?.name ?? '';
      const max = liveMax(p.id, v, size);
      const current = items
        .filter((i) => i.product.id === p.id && i.size === size && i.variant === v)
        .reduce((s, i) => s + i.qty, 0);
      if (max <= 0) {
        flash('Sold out — restocking soon');
        return;
      }
      const room = max - current;
      if (room <= 0) {
        flash(`Only ${max} available`);
        setCartOpen(true);
        return;
      }
      const take = Math.min(qty, room);
      setItems((prev) => {
        const found = prev.find(
          (i) => i.product.id === p.id && i.size === size && i.variant === v,
        );
        if (found) {
          return prev.map((i) =>
            i.product.id === p.id && i.size === size && i.variant === v
              ? { ...i, qty: i.qty + take }
              : i,
          );
        }
        return [...prev, { product: p, variant: v, qty: take, size }];
      });
      setCartOpen(true);
      flash(take < qty ? `Only ${max} available` : `${p.name} added to bag`);
    },
    [flash, items, liveMax],
  );

  const remove = useCallback((id: string, variant: string, size: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.product.id === id && i.variant === variant && i.size === size)),
    );
  }, []);

  const setQty = useCallback(
    (id: string, variant: string, size: string, qty: number) => {
      const max = liveMax(id, variant, size);
      // max === 0 → product gone; drop the line. Otherwise cap to stock.
      const capped = max <= 0 ? 0 : Math.min(qty, max);
      setItems((prev) =>
        capped <= 0
          ? prev.filter((i) => !(i.product.id === id && i.variant === variant && i.size === size))
          : prev.map((i) =>
              i.product.id === id && i.variant === variant && i.size === size
                ? { ...i, qty: capped }
                : i,
            ),
      );
    },
    [liveMax],
  );

  const openProduct = useCallback((id: string) => {
    navigate(productPath(id));
  }, []);

  const setView = useCallback((v: View) => {
    if (v === 'shop') navigate(shopPath());
    else if (v === 'product') navigate(shopPath());
    else goHome();
  }, []);

  const setWishOnly = useCallback((v: boolean) => {
    navigate(v ? savedPath : shopPath());
  }, []);

  const toggleWish = useCallback(
    (id: string) => {
      setWishlist((prev) => {
        const has = prev.includes(id);
        flash(has ? 'Removed from wishlist' : 'Saved to wishlist');
        return has ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    [flash],
  );

  const isWished = useCallback((id: string) => wishlist.includes(id), [wishlist]);

  const goToWishlist = useCallback(() => {
    navigate(savedPath);
  }, []);

  const { count, subtotal } = useMemo(() => {
    return {
      count: items.reduce((s, i) => s + i.qty, 0),
      subtotal: items.reduce((s, i) => s + i.qty * i.product.price, 0),
    };
  }, [items]);

  const value: CartContextValue = {
    items,
    count,
    subtotal,
    isCartOpen,
    activeView,
    selectedProductId,
    toast,
    openCart: () => setCartOpen(true),
    closeCart: () => setCartOpen(false),
    setView,
    openProduct,
    add,
    remove,
    setQty,
    wishlist,
    toggleWish,
    isWished,
    wishOnly,
    setWishOnly,
    goToWishlist,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useShop() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useShop must be used within ShopProvider');
  return ctx;
}
