import { Heart } from 'lucide-react';
import { useMemo } from 'react';
import { useCatalog, useCategories } from '../catalog/CatalogContext';
import { navigate, shopPath, useRoute } from '../router';
import { useShop } from '../store/CartContext';
import ProductCard from './ProductCard';
import Dropdown from './Dropdown';
import NotFound from './NotFound';

const ALL = { id: 'all', label: 'ALL' };

export default function ShopPage() {
  const { wishlist } = useShop();
  const products = useCatalog();
  const dynCats = useCategories();
  const cats = useMemo(() => [ALL, ...dynCats], [dynCats]);
  const route = useRoute();
  // Mounted only for /shop… — the fallback keeps hooks unconditional.
  const shop = route.view === 'shop' ? route : null;

  const cat = shop?.category ?? 'all';
  const wishOnly = shop?.saved ?? false;
  const sort = shop?.sort ?? 'featured';
  const validCat = cat === 'all' || cats.some((c) => c.id === cat);

  const items = useMemo(() => {
    const base = wishOnly
      ? products.filter((p) => wishlist.includes(p.id))
      : cat === 'all'
        ? [...products]
        : products.filter((p) => p.category === cat);
    if (sort === 'low') base.sort((a, b) => a.price - b.price);
    if (sort === 'high') base.sort((a, b) => b.price - a.price);
    return base;
  }, [products, cat, sort, wishOnly, wishlist]);

  if (!shop) return null;

  // Unknown category link → real 404, never an empty dead page.
  if (!wishOnly && !validCat) {
    return <NotFound title="Category not found" hint="This shelf doesn't exist — but the shop is full." />;
  }

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
      <p className="text-[11px] font-normal tracking-[0.3em] text-black/60 dark:text-white/60">
        HOODIES · JACKETS · ESSENTIALS — DELIVERED IN EGYPT
      </p>
      <h1 className="font-display mt-3 text-5xl font-normal uppercase tracking-tight sm:text-6xl">
        {wishOnly ? 'Wishlist' : validCat ? (cat === 'all' ? 'Shop all' : catLabel(cat, cats)) : 'Shop all'}
      </h1>

      <div className="mt-9 flex flex-col gap-4 border-y border-black/10 dark:border-white/10 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="no-scrollbar flex gap-2.5 overflow-x-auto pb-1">
          {cats.map((c) => (
            <a
              key={c.id}
              href={shopPath(c.id, sort)}
              className={`whitespace-nowrap rounded-full px-6 py-3 text-[11px] font-normal tracking-[0.2em] transition ${
                !wishOnly && cat === c.id
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-[#F4F4F4] text-black hover:bg-black hover:text-white dark:bg-white/[0.07] dark:text-[#f2f2f2] dark:hover:bg-white dark:hover:text-black'
              }`}
            >
              {c.label}
            </a>
          ))}
          <a
            href={wishOnly ? shopPath('all', sort) : '/shop/saved'}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-6 py-3 text-[11px] font-normal tracking-[0.2em] transition ${
              wishOnly
                ? 'bg-black text-white dark:bg-white dark:text-black'
                : 'border border-black/20 bg-white text-black hover:border-black dark:border-white/20 dark:bg-[#101010] dark:text-[#f2f2f2] dark:hover:border-white'
            }`}
          >
            <Heart className="h-3.5 w-3.5" fill={wishOnly ? 'currentColor' : 'none'} />
            SAVED ({wishlist.length})
          </a>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] tracking-[0.2em] text-black/60 dark:text-white/60">
            {items.length} ITEMS
          </span>
          <Dropdown
            value={sort}
            onChange={(v) => navigate(shopPath(wishOnly ? 'saved' : cat, v), { replace: true })}
            label="Sort products"
            variant="pill"
            options={[
              { value: 'featured', label: 'FEATURED' },
              { value: 'low', label: 'PRICE: LOW → HIGH' },
              { value: 'high', label: 'PRICE: HIGH → LOW' },
            ]}
          />
        </div>
      </div>

      {items.length === 0 && !wishOnly && (
        <div className="flex flex-col items-center py-20 text-center">
          <p className="font-display text-3xl font-normal uppercase">Nothing here yet</p>
          <p className="mt-2 max-w-xs text-[13px] tracking-[0.08em] text-black/60 dark:text-white/60">
            {validCat
              ? 'No products in this category — check back soon.'
              : 'This shelf is empty right now.'}
          </p>
          <a
            href="/shop"
            className="mt-6 rounded-full bg-black px-8 py-3.5 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
          >
            SHOP ALL
          </a>
        </div>
      )}
      {items.length === 0 && wishOnly ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Heart className="h-10 w-10 text-black/15 dark:text-white/15" />
          <p className="mt-4 text-[13px] font-normal tracking-[0.2em]">NOTHING SAVED YET</p>
          <p className="mt-1 max-w-xs text-[12px] tracking-wider text-black/60 dark:text-white/60">
            Tap the heart on any piece you like — it’ll wait for you here until you’re ready.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </section>
  );
}

function catLabel(id: string, cats: { id: string; label: string }[]): string {
  const c = cats.find((x) => x.id === id);
  return c ? titleCase(c.label) : 'Shop all';
}

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
