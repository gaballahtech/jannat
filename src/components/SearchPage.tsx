import { ArrowRight, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCatalog, useCategories } from '../catalog/CatalogContext';
import { navigate, searchPath, shopPath, useRoute } from '../router';
import ProductCard from './ProductCard';
import WaCta from './WaCta';

export default function SearchPage() {
  const products = useCatalog();
  const cats = useCategories();
  const route = useRoute();
  const initial = route.view === 'search' ? route.q : '';
  // Local input state for smooth typing; the URL (?q=) is the shareable source of truth.
  const [draft, setDraft] = useState(initial);
  const q = route.view === 'search' ? route.q : '';
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the input in sync when arriving via back/forward or a shared link.
  useEffect(() => {
    setDraft(q);
  }, [q]);

  // Focus on load for keyboard users only — on touch phones autofocus would
  // pop the keyboard up and cover the page before anything is read.
  useEffect(() => {
    if (window.matchMedia('(pointer: fine)').matches) inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.category.includes(needle) ||
        p.variants.some((v) => v.name.toLowerCase().includes(needle)),
    );
  }, [products, q]);

  const popular = useMemo(() => products.slice(0, 4), [products]);

  const onType = (v: string) => {
    setDraft(v);
    // Replace (not push) so typing doesn't flood browser history.
    navigate(searchPath(v.trim()), { replace: true });
  };

  return (
    <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
      <p className="text-[11px] font-normal tracking-[0.3em] text-black/60 dark:text-white/60">SEARCH JANNAT</p>
      <div className="mt-5 flex items-center gap-3 border-b-2 border-black dark:border-white pb-4">
        <Search className="h-6 w-6 shrink-0" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          aria-label="Search products"
          value={draft}
          onChange={(e) => onType(e.target.value)}
          placeholder="Hoodie, cargo, jacket..."
          className="font-display w-full bg-transparent text-2xl font-normal uppercase outline-none placeholder:text-black/20 dark:placeholder:text-white/60 sm:text-4xl"
        />
        {draft && (
          <button
            onClick={() => onType('')}
            aria-label="Clear search"
            className="rounded-full border border-black/15 dark:border-white/15 p-2 transition hover:bg-black hover:text-white dark:hover:text-black dark:hover:bg-white dark:hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {q.trim() === '' ? (
        <div className="mt-10">
          <p className="text-[11px] font-normal tracking-[0.24em] text-black/60 dark:text-white/60">POPULAR RIGHT NOW</p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            {['Hoodie', 'Cargo', 'Jacket', 'Black', 'T-shirt'].map((term) => (
              <a
                key={term}
                href={searchPath(term)}
                className="rounded-full bg-[#F4F4F4] dark:bg-white/[0.07] px-6 py-3 text-[11px] font-normal tracking-[0.2em] transition hover:bg-black hover:text-white dark:hover:text-black dark:hover:bg-white dark:hover:text-black"
              >
                {term.toUpperCase()}
              </a>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7">
            {popular.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="mt-10">
            <p className="mb-4 text-[11px] font-normal tracking-[0.24em] text-black/60 dark:text-white/60">
              SHOP BY CATEGORY
            </p>
            <div className="flex flex-wrap gap-2.5">
              {cats.map((c) => (
                <a
                  key={c.id}
                  href={shopPath(c.id)}
                  className="rounded-full border border-black/20 dark:border-white/20 px-6 py-3 text-[11px] font-normal tracking-[0.2em] transition hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:text-black dark:hover:bg-white dark:hover:text-black"
                >
                  {c.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10">
          <p className="text-[11px] tracking-[0.22em] text-black/60 dark:text-white/60">
            {results.length} RESULT{results.length === 1 ? '' : 'S'} FOR “{q.trim().toUpperCase()}”
            {' — '}
            <a href={searchPath(q.trim())} className="font-normal text-black dark:text-[#f2f2f2] underline underline-offset-4">
              COPY THIS LINK TO SHARE
            </a>
          </p>
          {results.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-3xl font-normal uppercase">Nothing found</p>
              <p className="mt-2 text-[13px] tracking-[0.12em] text-black/60 dark:text-white/60">
                Try “hoodie”, “cargo” or “jacket”.
              </p>
              <a
                href="/shop"
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-black px-8 py-3.5 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
              >
                BROWSE EVERYTHING <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
          <div className="mt-10 border-t border-black/10 dark:border-white/10 pt-6">
            <p className="text-[12px] tracking-[0.12em] text-black/60 dark:text-white/60">
              Can’t find your size or color?{' '}
              <WaCta
                mode="name"
                message={(info) => `Hi jannat! I'm ${info.name}. I'm looking for: ${q.trim()}`}
                title="ASK US"
                submitLabel="ASK ON WHATSAPP"
                className="font-normal text-black dark:text-[#f2f2f2] underline underline-offset-4"
              >
                Ask us on WhatsApp
              </WaCta>{' '}
                — we reply in minutes.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
