import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { PRODUCTS, type Product } from '../data/store';
import { idbForget, idbUrl, refKey } from '../admin/db';
import { getCategories, mergeCatalog, type Category } from '../admin/adminData';

/* Live catalog: static seeds + admin overrides, with `idb:` image refs
   resolved to object URLs. Every storefront component reads from here,
   so admin edits appear instantly across the whole site. */

type CatalogValue = {
  products: Product[];
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const CatalogContext = createContext<CatalogValue>({
  products: PRODUCTS,
  categories: [],
  loading: true,
  refresh: async () => {},
});

/* Neutral placeholder when an uploaded image can't be resolved on THIS device
   (admin uploads live in the owner's browser only — see audit notes). */
export const MISSING_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='800'%3E%3Crect width='100%25' height='100%25' fill='%23e9e9e9'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='30' letter-spacing='6' fill='%23999999' text-anchor='middle'%3EPEARLIN%3C/text%3E%3C/svg%3E";

async function resolveImages(list: Product[]): Promise<Product[]> {
  return Promise.all(
    list.map(async (p) => ({
      ...p,
      variants: await Promise.all(
        p.variants.map(async (v) => {
          const key = refKey(v.image);
          if (!key) return v;
          const url = await idbUrl(key);
          return url ? { ...v, image: url } : { ...v, image: MISSING_IMAGE };
        }),
      ),
    })),
  );
}

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(() => getCategoriesSafe());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const merged = mergeCatalog();
      setProducts(await resolveImages(merged));
      setCategories(getCategories());
    } catch {
      /* keep last good catalog */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the tab fresh if the admin saves in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('pearlin-admin-')) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  return (
    <CatalogContext.Provider value={{ products, categories, loading, refresh }}>
      {children}
    </CatalogContext.Provider>
  );
}

function getCategoriesSafe(): Category[] {
  try {
    return getCategories();
  } catch {
    return [];
  }
}

export function useCatalog(): Product[] {
  return useContext(CatalogContext).products;
}

export function useCategories(): Category[] {
  const cats = useContext(CatalogContext).categories;
  return cats.length > 0 ? cats : getCategoriesSafe();
}

export function useCatalogRefresh(): () => Promise<void> {
  return useContext(CatalogContext).refresh;
}

export function useCatalogReady(): boolean {
  return !useContext(CatalogContext).loading;
}

export { idbForget };
