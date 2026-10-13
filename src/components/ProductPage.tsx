import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Flame, Heart, MessageCircle, Minus, Plus, Ruler, Truck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  LOW_STOCK,
  SIZES,
  formatEGP,
} from '../data/store';
import { cellQty, getPromo, getShippingFee } from '../admin/adminData';
import { MISSING_IMAGE, useCatalog } from '../catalog/CatalogContext';
import { navigate, productPath, useRoute } from '../router';
import { useShop } from '../store/CartContext';
import { WhatsAppIcon } from './Header';
import ProductCard from './ProductCard';
import SizeFinder from './SizeFinder';
import WaCta from './WaCta';

function initialSelection(
  routeColor: string | undefined,
  routeSize: string | undefined,
  id: string,
  products: ReturnType<typeof useCatalog>,
) {
  const p = products.find((x) => x.id === id);
  const szs = p && p.sizes.length > 0 ? p.sizes : [...SIZES];
  let vIdx = 0;
  let size = szs.includes('M') ? 'M' : (szs[0] ?? 'M');
  if (p) {
    if (routeColor) {
      const found = p.variants.findIndex(
        (v) => v.name.toLowerCase() === routeColor.toLowerCase(),
      );
      if (found >= 0) vIdx = found;
    }
    if (routeSize) {
      const up = routeSize.toUpperCase();
      if (szs.includes(up)) size = up;
    }
    // land on an in-stock combo when possible
    const vName = p.variants[vIdx]?.name ?? '';
    if (cellQty(p, vName, size) <= 0) {
      const alt = szs.find((s) => cellQty(p, vName, s) > 0);
      if (alt) size = alt;
    }
  }
  return { vIdx, size };
}

export default function ProductPage({ productId }: { productId: string }) {
  const { add, openCart, toggleWish, isWished } = useShop();
  const route = useRoute();
  const routeColor = route.view === 'product' ? route.color : undefined;
  const routeSize = route.view === 'product' ? route.size : undefined;
  const products = useCatalog();
  const product = useMemo(
    () => products.find((p) => p.id === productId),
    [products, productId],
  );

  // Unknown product link (old/shared URL) → back to the shop, never a dead page.
  useEffect(() => {
    if (products.length > 0 && !product) navigate('/shop', { replace: true });
  }, [product, products.length]);

  const init = useMemo(
    () => initialSelection(routeColor, routeSize, productId, products),
    [routeColor, routeSize, productId, products],
  );
  const [variantIdx, setVariantIdx] = useState(init.vIdx);
  const [size, setSize] = useState<string>(init.size);
  const [qty, setQtyLocal] = useState(1);
  const [showSticky, setShowSticky] = useState(false);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [finderOpen, setFinderOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > 650);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const variant = product?.variants[variantIdx] ?? product?.variants[0];
  const sizes = product && product.sizes.length > 0 ? product.sizes : [...SIZES];
  const oneSizeOnly = sizes.length === 1 && sizes[0] === 'ONE SIZE';
  /* Smart stock: exact cell for the chosen color+size, plus product total. */
  const cell = product && variant ? cellQty(product, variant.name, size) : 0;
  const totalLeft = product?.stock ?? 0;
  const outOfStock = totalLeft <= 0;
  const comboGone = !outOfStock && cell <= 0;
  const lowCell = !outOfStock && !comboGone && cell <= Math.max(3, LOW_STOCK);
  const maxQty = Math.max(1, Math.min(9, cell));
  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.id !== product.id && p.category === product.category)
      .concat(products.filter((p) => p.id !== product.id && p.category !== product.category))
      .slice(0, 4);
  }, [products, product]);

  /* Complete-the-look: ADMIN-PICKED pairings only (see /admin product editor).
     Missing (deleted) or sold-out picks vanish; if nothing valid remains,
     the whole section hides itself. */
  const bundleItems = useMemo(() => {
    if (!product) return [];
    const picks = Array.isArray(product.pairsWith) ? product.pairsWith : [];
    return picks
      .map((id) => products.find((x) => x.id === id))
      .filter((x): x is (typeof products)[number] => !!x && x.stock > 0)
      .map((x) => {
        const szs = x.sizes.length > 0 ? x.sizes : [...SIZES];
        const v0 = x.variants[0];
        const sz = v0 ? szs.find((s) => cellQty(x, v0.name, s) > 0) : undefined;
        return sz && v0 ? { product: x, variant: v0.name, size: sz } : null;
      })
      .filter((x): x is { product: (typeof products)[number]; variant: string; size: string } => x !== null)
      .slice(0, 2);
  }, [products, product]);
  useEffect(() => {
    setChecked(Object.fromEntries(bundleItems.map((b) => [b.product.id, true])));
  }, [bundleItems]);

  if (!product || !variant) return null;
  const wished = isWished(product.id);

  // Keep the URL in sync (replace, so back-button stays clean) — every
  // color/size combo is a real shareable link like /product/x?color=Beige&size=L.
  // Smart switch: if the new color has 0 in the current size, jump to its first available size.
  const pickVariant = (i: number) => {
    if (!product) return;
    const v = product.variants[i];
    if (!v) return;
    const szs = product.sizes.length > 0 ? product.sizes : [...SIZES];
    const keep = cellQty(product, v.name, size) > 0 ? size : (szs.find((s) => cellQty(product, v.name, s) > 0) ?? size);
    setVariantIdx(i);
    setSize(keep);
    setQtyLocal(1);
    navigate(productPath(product.id, v.name, keep), { replace: true });
  };
  const pickSize = (s: string) => {
    if (!product || !variant) return;
    setSize(s);
    setQtyLocal(1);
    navigate(productPath(product.id, variant.name, s), { replace: true });
  };
  const selectedBundle = bundleItems.filter((b) => checked[b.product.id] ?? true);
  const bundleTotal =
    product.price * qty + selectedBundle.reduce((s, b) => s + b.product.price, 0);
  const bundleCount = 1 + selectedBundle.length;

  const addBundle = () => {
    add(product, variant.name, size, qty, true);
    selectedBundle.forEach((b) => add(b.product, b.variant, b.size, 1, true));
    openCart();
  };

  const shippingFee = getShippingFee();
  const promo = getPromo();

  return (
    <>
      <section className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        {/* breadcrumb */}
        <div className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-normal tracking-[0.2em] text-black/50 dark:text-white/50">
          <a href="/shop" className="flex items-center gap-1.5 hover:text-black dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> SHOP
          </a>
          <span>/</span>
          <span className="uppercase">{product.category}</span>
          <span>/</span>
          <span className="text-black dark:text-[#f2f2f2]">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Gallery */}
          <div>
            <motion.div
              key={variant.name}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="relative overflow-hidden rounded-[20px] bg-[#F4F4F4] dark:bg-white/[0.07] ring-1 ring-black/10 dark:ring-white/10"
            >
              <img
                src={variant.image}
                alt={`${product.name} — ${variant.name}`}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== MISSING_IMAGE) e.currentTarget.src = MISSING_IMAGE;
                }}
                className="aspect-[4/5] w-full object-cover"
              />
              {product.tag && (
                <span
                  className={`absolute left-4 top-4 rounded-full px-4 py-1.5 text-[10px] font-normal tracking-[0.2em] ${
                    product.tag === 'NEW'
                      ? 'bg-white text-black ring-1 ring-black/10 dark:bg-white dark:text-black dark:ring-white/20'
                      : 'bg-black/85 text-white backdrop-blur'
                  }`}
                >
                  {product.tag}
                </span>
              )}
            </motion.div>
            {/* thumbnails = color images */}
            <div className="mt-4 grid grid-cols-4 gap-3">
              {product.variants.map((v, i) => (
                <button
                  key={v.name}
                  onClick={() => pickVariant(i)}
                  className={`relative overflow-hidden rounded-xl bg-[#F4F4F4] ring-1 transition ${
                    i === variantIdx
                      ? 'ring-2 ring-black ring-offset-2 dark:ring-white dark:ring-offset-black'
                      : 'opacity-70 ring-black/10 hover:opacity-100 dark:ring-white/10'
                  }`}
                  title={v.name}
                >
                  <img
                    src={v.image}
                    alt={v.name}
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      if (e.currentTarget.src !== MISSING_IMAGE) e.currentTarget.src = MISSING_IMAGE;
                    }}
                    className="aspect-square w-full object-cover"
                  />
                  {i === variantIdx && (
                    <span className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-black">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div>
            <p className="text-[11px] font-normal tracking-[0.3em] text-black/50 dark:text-white/50">
              {product.category.toUpperCase()} — EGYPT
            </p>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display mt-3 text-4xl font-normal uppercase tracking-tight sm:text-5xl">
                {product.name}
              </h1>
              <button
                onClick={() => toggleWish(product.id)}
                aria-label={wished ? 'Remove from wishlist' : 'Save to wishlist'}
                title={wished ? 'Saved — tap to remove' : 'Save for later'}
                className={`mt-3 grid h-12 w-12 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
                  wished ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black' : 'border-black/15 hover:border-black dark:border-white/15 dark:hover:border-white'
                }`}
              >
                <Heart className="h-5 w-5" fill={wished ? 'currentColor' : 'none'} />
              </button>
            </div>
            <p className="mt-4 text-xl font-normal tracking-wider">{formatEGP(product.price)}</p>
            {product.sold > 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-normal tracking-[0.2em] text-black/50 dark:text-white/50">
                <Flame className="h-3.5 w-3.5" aria-hidden="true" /> {product.sold}+ SOLD
              </p>
            )}
            <p className="mt-4 max-w-lg text-[14px] leading-relaxed tracking-wide text-black/60 dark:text-white/60">
              {product.description}
            </p>
            {product.fabric && (
              <p className="mt-2 text-[12px] tracking-[0.12em] text-black/45 dark:text-white/45">{product.fabric}</p>
            )}

            {/* Colors */}
            <div className="mt-8">
              <p className="text-[12px] font-normal tracking-[0.22em]">
                COLOR — <span className="text-black/60 dark:text-white/60">{variant.name.toUpperCase()}</span>
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {product.variants.map((v, i) => (
                  <button
                    key={v.name}
                    onClick={() => pickVariant(i)}
                    className={`flex items-center gap-2 rounded-full border px-5 py-3 transition sm:py-2.5 ${
                      i === variantIdx
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-black/15 bg-white hover:border-black dark:border-white/15 dark:bg-[#101010] dark:hover:border-white'
                    } text-[11px] font-normal tracking-[0.15em]`}
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full ring-1 ring-black/25 dark:ring-white/25"
                      style={{ background: v.hex }}
                    />
                    {v.name.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Sizes — only the product's real sizes; empty cells are struck through */}
            <div className="mt-7">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[12px] font-normal tracking-[0.22em]">SIZE — {size}</p>
                {!oneSizeOnly && (
                  <button
                    onClick={() => setFinderOpen(true)}
                    className="flex items-center gap-1.5 rounded-full border border-black/20 dark:border-white/20 px-4 py-2 text-[11px] font-normal tracking-[0.15em] transition hover:border-black dark:hover:border-white hover:bg-black hover:text-white dark:hover:text-black dark:hover:bg-white dark:hover:text-black"
                  >
                    <Ruler className="h-3.5 w-3.5" /> FIND MY SIZE
                  </button>
                )}
              </div>
              <div className="mt-3.5 flex flex-wrap gap-2.5">
                {sizes.map((s) => {
                  const left = cellQty(product, variant.name, s);
                  const gone = left <= 0;
                  return (
                    <button
                      key={s}
                      onClick={() => !gone && pickSize(s)}
                      disabled={gone}
                      title={gone ? `${s} — sold out in ${variant.name}` : `${left} left in ${s}`}
                      className={`relative h-12 min-w-14 rounded-xl border px-3 text-[13px] font-normal transition active:scale-95 ${
                        size === s
                          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                          : gone
                            ? 'cursor-not-allowed border-black/10 text-black/25 line-through dark:border-white/10 dark:text-white/25'
                            : 'border-black/15 hover:border-black dark:border-white/15 dark:hover:border-white'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3.5 flex flex-col items-start gap-2.5">
                <WaCta
                  mode="name"
                  message={(info) =>
                    `Hi pearlin! I'm ${info.name}. I need size help for ${product.name} (${variant.name}). My height: __ cm, weight: __ kg. Which size fits me?`
                  }
                  title="SIZE HELP"
                  submitLabel="ASK ON WHATSAPP"
                  className="inline-flex items-center gap-1.5 text-[11px] font-normal tracking-[0.15em] text-black/60 dark:text-white/60 underline-offset-4 hover:text-black dark:hover:text-white hover:underline"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  BETWEEN SIZES? WE HELP YOU PICK ON WHATSAPP
                </WaCta>
                {lowCell && (
                  <p className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-1.5 text-[10px] font-normal tracking-[0.2em] text-white dark:bg-white dark:text-black">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white dark:bg-[#101010]" />
                    ONLY {cell} LEFT IN {variant.name.toUpperCase()} / {size}
                  </p>
                )}
                {comboGone && (
                  <p className="inline-flex items-center gap-2 rounded-full border border-black/20 dark:border-white/20 px-4 py-1.5 text-[10px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                    SOLD OUT IN {variant.name.toUpperCase()} / {size} — PICK ANOTHER SIZE
                  </p>
                )}
              </div>
            </div>

            {/* Qty + Add */}
            <div className="mt-8 flex gap-3">
              <div className="flex shrink-0 items-center rounded-full border border-black/20 dark:border-white/20">
                <button
                  onClick={() => setQtyLocal((q) => Math.max(1, q - 1))}
                  className="p-4 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 sm:p-3.5"
                  aria-label="Decrease"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-normal">{qty}</span>
                <button
                  onClick={() => setQtyLocal((q) => Math.min(maxQty, q + 1))}
                  className="p-4 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 sm:p-3.5"
                  aria-label="Increase"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => {
                  if (outOfStock || comboGone) return;
                  add(product, variant.name, size, qty);
                  openCart();
                }}
                disabled={outOfStock || comboGone}
                className="min-w-0 flex-1 rounded-full bg-black px-2 py-3.5 text-[11px] font-normal tracking-[0.14em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black sm:text-[12px] sm:tracking-[0.22em] dark:bg-white dark:text-black"
              >
                {outOfStock
                  ? 'SOLD OUT'
                  : comboGone
                    ? 'PICK AN AVAILABLE SIZE'
                    : `ADD TO BAG — ${formatEGP(product.price * qty)}`}
              </button>
            </div>
            {outOfStock ? (
              <WaCta
                mode="name"
                message={(info) =>
                  `Hi pearlin! I'm ${info.name}. Please tell me when ${product.name} (${variant.name}) is back in stock.`
                }
                title="RESTOCK ALERT"
                submitLabel="NOTIFY ME"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-black dark:border-white bg-transparent py-4 text-[12px] font-normal tracking-[0.22em] text-black dark:text-[#f2f2f2] transition hover:border-[#25D366] hover:bg-[#25D366] hover:text-white dark:hover:text-black"
              >
                <WhatsAppIcon className="h-4 w-4" />
                ASK ABOUT RESTOCK
                <ArrowRight className="h-4 w-4" />
              </WaCta>
            ) : (
              <WaCta
                mode="full"
                lines={[
                  {
                    name: product.name,
                    variant: variant.name,
                    size,
                    qty,
                    price: product.price,
                  },
                ]}
                title="DELIVERY DETAILS"
                submitLabel="SEND ORDER ON WHATSAPP"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border-2 border-black dark:border-white bg-transparent py-4 text-[12px] font-normal tracking-[0.22em] text-black dark:text-[#f2f2f2] transition hover:border-[#25D366] hover:bg-[#25D366] hover:text-white dark:hover:text-black"
              >
                <WhatsAppIcon className="h-4 w-4" />
                ORDER NOW ON WHATSAPP
                <ArrowRight className="h-4 w-4" />
              </WaCta>
            )}
            {promo.enabled && promo.percent > 0 && (
              <p className="mt-3 rounded-xl border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] px-3 py-3 text-center text-[11px] tracking-[0.12em] text-black/60 dark:text-white/60">
                Got a promo code? Mention <span className="font-normal text-black dark:text-[#f2f2f2]">{promo.code}</span> on
                WhatsApp for <span className="font-normal text-black dark:text-[#f2f2f2]">{promo.percent}% off</span>.
              </p>
            )}

            {/* perks */}
            <div className="mt-7 space-y-2.5 border-t border-black/10 dark:border-white/10 pt-6 text-[12px] tracking-[0.1em] text-black/60 dark:text-white/60">
              <p className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-black dark:text-[#f2f2f2]" /> Delivery to all governorates —{' '}
                {formatEGP(shippingFee)} flat · within a week
              </p>
              <p className="flex items-center gap-2.5">
                <Check className="h-4 w-4 text-black dark:text-[#f2f2f2]" /> Online payment — confirmed on WhatsApp
              </p>
            </div>
          </div>
        </div>

        {/* Complete the look — this product + hand-picked pairings, one click.
            Only renders when at least one pairing is live AND the current
            combo is available (otherwise the box would promise the impossible). */}
        {bundleItems.length > 0 && !outOfStock && !comboGone && (
          <div className="mt-16 rounded-[20px] border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] p-5 sm:p-8">
          <p className="text-[11px] font-normal tracking-[0.3em] text-black/50 dark:text-white/50">ONE-CLICK BUNDLE</p>
          <h2 className="font-display mt-2 text-2xl font-normal uppercase tracking-tight sm:text-3xl">
            Complete the look
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* This product — always included, with your current picks */}
            <div className="flex items-center gap-3 rounded-xl border border-black dark:border-white bg-white dark:bg-[#101010] p-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-black dark:border-white bg-black text-white dark:bg-white dark:text-black">
                <Check className="h-3.5 w-3.5" />
              </span>
              <img
                src={variant.image}
                alt={product.name}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== MISSING_IMAGE) e.currentTarget.src = MISSING_IMAGE;
                }}
                className="h-16 w-14 shrink-0 rounded-lg object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-normal tracking-[0.12em]">
                  {product.name} <span className="text-black/45 dark:text-white/45">(THIS ITEM)</span>
                </span>
                <span className="text-[12px] tracking-wider text-black/55 dark:text-white/55">
                  {formatEGP(product.price)} · {variant.name} / {size} × {qty}
                </span>
              </span>
            </div>
            {bundleItems.map((b) => {
              const on = checked[b.product.id] ?? true;
              const bImg =
                b.product.variants.find((v) => v.name === b.variant)?.image ??
                b.product.variants[0]?.image;
              return (
                <div
                  key={b.product.id}
                  className={`flex items-center gap-3 rounded-xl border bg-white p-3 transition ${
                    on ? 'border-black' : 'border-black/10 opacity-60'
                  }`}
                >
                  <button
                    onClick={() => setChecked((p) => ({ ...p, [b.product.id]: !on }))}
                    aria-label={on ? `Remove ${b.product.name} from bundle` : `Add ${b.product.name} to bundle`}
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition active:scale-95 ${
                      on ? 'border-black bg-black text-white' : 'border-black/25 text-transparent hover:border-black'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={productPath(b.product.id, b.variant)}
                    className="flex min-w-0 flex-1 items-center gap-3"
                    title={`View ${b.product.name}`}
                  >
                    {bImg && (
                      <img
                        src={bImg}
                        alt={b.product.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== MISSING_IMAGE) e.currentTarget.src = MISSING_IMAGE;
                        }}
                        className="h-16 w-14 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-normal tracking-[0.12em] underline-offset-4 hover:underline">
                        {b.product.name}
                      </span>
                      <span className="text-[12px] tracking-wider text-black/55 dark:text-white/55">
                        {formatEGP(b.product.price)} · {b.variant} / {b.size}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-black/35 dark:text-white/35" />
                  </a>
                </div>
              );
            })}
          </div>
          <button
            onClick={addBundle}
            className="mt-4 w-full rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.22em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
          >
            {`ADD ${bundleCount} ITEM${bundleCount > 1 ? 'S' : ''} — ${formatEGP(bundleTotal)}`}
          </button>
          </div>
        )}

        {/* Related */}
        <div className="mt-20">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="font-display text-2xl font-normal uppercase tracking-tight sm:text-3xl">
              You may also like
            </h2>
            <a
              href="/shop"
              className="text-[12px] font-normal tracking-[0.22em] underline-offset-4 hover:underline"
            >
              VIEW ALL
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4 lg:gap-7">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <SizeFinder
        open={finderOpen}
        onClose={() => setFinderOpen(false)}
        available={sizes}
        category={product.category}
        onApply={(s) => pickSize(s)}
      />

      {/* Sticky mobile buy bar */}
      <AnimatePresence>
        {showSticky && !outOfStock && !comboGone && (
          <motion.div
            initial={{ y: 90 }}
            animate={{ y: 0 }}
            exit={{ y: 90 }}
            transition={{ type: 'tween', duration: 0.25 }}
            className="fixed inset-x-0 bottom-0 z-40 rounded-t-[20px] border-t border-black/10 dark:border-white/10 bg-white/97 dark:bg-[#0b0b0b]/97 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] backdrop-blur lg:hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <img
                src={variant.image}
                alt={product.name}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (e.currentTarget.src !== MISSING_IMAGE) e.currentTarget.src = MISSING_IMAGE;
                }}
                className="h-12 w-10 shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-normal tracking-[0.12em]">{product.name}</p>
                <p className="text-[11px] tracking-wider text-black/55 dark:text-white/55">
                  {variant.name} · {size} · {formatEGP(product.price * qty)}
                </p>
              </div>
              <button
                onClick={() => {
                  add(product, variant.name, size, qty);
                  openCart();
                }}
                className="shrink-0 rounded-full bg-black px-7 py-3.5 text-[11px] font-normal tracking-[0.2em] text-white transition active:bg-neutral-800 dark:bg-white dark:text-black"
              >
                ADD +
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
