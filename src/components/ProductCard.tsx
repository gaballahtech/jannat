import { motion } from 'framer-motion';
import { Flame, Heart, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { formatEGP, LOW_STOCK, type Product } from '../data/store';
import { MISSING_IMAGE } from '../catalog/CatalogContext';
import { productPath } from '../router';
import { useShop } from '../store/CartContext';

export default function ProductCard({ product }: { product: Product }) {
  const { add, toggleWish, isWished } = useShop();
  const wished = isWished(product.id);
  const [variantIdx, setVariantIdx] = useState(0);
  const timer = useRef<number | null>(null);

  const variant = product.variants[variantIdx] ?? product.variants[0];
  const out = product.stock <= 0;
  const low = !out && product.stock <= LOW_STOCK;
  const showSold = product.sold > 0;

  /* Auto-cycle variant images while hovering (or touching) the photo */
  const startCycle = () => {
    if (product.variants.length < 2 || timer.current) return;
    timer.current = window.setInterval(() => {
      setVariantIdx((i) => (i + 1) % product.variants.length);
    }, 2200);
  };
  const stopCycle = () => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    setVariantIdx(0);
  };
  useEffect(() => {
    const t = timer.current;
    return () => {
      if (t) window.clearInterval(t);
    };
  }, []);

  const quickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    add(product, variant.name);
  };

  return (
    <motion.a
      href={productPath(product.id)}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      className="group block cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#0B0B0B] transition duration-300 hover:border-white/25 hover:shadow-[0_20px_60px_-20px_rgba(0,0,0,0.55)]"
    >
      <div className="p-2 pb-0">
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#F4F4F4] dark:bg-white/[0.07] ring-1 ring-white/25"
          onMouseEnter={startCycle}
          onMouseLeave={stopCycle}
          onTouchStart={startCycle}
          onTouchEnd={stopCycle}
          onTouchCancel={stopCycle}
        >
          {out ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-white px-3 py-1 text-[10px] font-normal tracking-[0.18em] text-black dark:bg-white dark:text-black">
              SOLD OUT
            </span>
          ) : (
            product.tag && (
              <span
                className={`absolute left-3 top-3 z-10 rounded-full px-3 py-1 text-[10px] font-normal tracking-[0.18em] ${
                  product.tag === 'NEW'
                    ? 'bg-white text-black dark:bg-white dark:text-black'
                    : 'border border-white/30 bg-black/80 text-white backdrop-blur'
                }`}
              >
                {product.tag}
              </span>
            )
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWish(product.id);
            }}
            aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
            className={`absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full backdrop-blur transition active:scale-90 ${
              wished ? 'bg-white text-black' : 'bg-black/45 text-white hover:bg-black/80'
            }`}
          >
            <Heart className="h-4 w-4" fill={wished ? 'currentColor' : 'none'} />
          </button>
          {product.variants.map((v, i) => (
            <img
              key={v.name}
              src={v.image}
              alt={`${product.name} — ${v.name}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={(e) => {
                if (e.currentTarget.src !== MISSING_IMAGE) e.currentTarget.src = MISSING_IMAGE;
              }}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 group-hover:scale-[1.04] ${
                i === variantIdx ? 'opacity-100' : 'opacity-0'
              } ${out ? 'saturate-[.55]' : ''}`}
            />
          ))}
          {/* Desktop only: overlay quick-add on hover — image stays clean on touch devices */}
          {!out && (
            <button
              onClick={quickAdd}
              aria-label={`Quick add ${product.name} in ${variant?.name ?? ''}`}
              className="absolute bottom-3 left-3 right-3 hidden items-center justify-center gap-2 rounded-full bg-black/85 py-3 text-[11px] font-normal tracking-[0.2em] text-white backdrop-blur transition-all duration-300 hover:bg-white hover:text-black lg:flex lg:translate-y-2 lg:opacity-0 lg:group-hover:translate-y-0 lg:group-hover:opacity-100"
            >
              <Plus className="h-4 w-4" /> QUICK ADD
            </button>
          )}
        </div>
      </div>
      <div className="px-5 pb-5 pt-4">
        <h3 className="truncate text-[13px] font-normal tracking-[0.14em] text-white">
          {product.name}
        </h3>
        <p className="mt-1.5 text-[13px] tracking-wider text-white/55">
          {formatEGP(product.price)}{' '}
          <span className="text-[11px] text-white/35">· {variant.name}</span>
        </p>
        <div
          className="mt-3 flex items-center justify-between gap-2"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <div className="flex gap-2">
            {product.variants.map((v, i) => (
              <button
                key={v.name}
                title={v.name}
                aria-label={v.name}
                onMouseEnter={() => setVariantIdx(i)}
                onClick={() => setVariantIdx(i)}
                className={`grid h-7 w-7 place-items-center rounded-full transition ${
                  i === variantIdx ? 'outline outline-2 outline-offset-2 outline-white/80' : ''
                }`}
              >
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-white/30"
                  style={{ background: v.hex }}
                />
              </button>
            ))}
          </div>
          <span className="flex shrink-0 items-center gap-1 text-[10px] font-normal tracking-[0.14em] text-white/45">
            {showSold ? (
              <>
                <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                {product.sold}+ SOLD
              </>
            ) : null}
            {low && (
              <span className="text-white">
                {showSold ? '· ' : ''}ONLY {product.stock} LEFT
              </span>
            )}
          </span>
        </div>
        {/* Mobile / touch: CTA lives below the photo so the product is fully visible */}
        {out ? (
          <div className="mt-4 flex w-full items-center justify-center rounded-full border border-white/15 py-3 text-[11px] font-normal tracking-[0.2em] text-white/50 lg:hidden">
            SOLD OUT
          </div>
        ) : (
          <button
            onClick={quickAdd}
            aria-label={`Quick add ${product.name} in ${variant?.name ?? ''}`}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/[0.06] py-3 text-[11px] font-normal tracking-[0.2em] text-white transition active:bg-white active:text-black lg:hidden"
          >
            <Plus className="h-4 w-4" /> QUICK ADD
          </button>
        )}
      </div>
    </motion.a>
  );
}
