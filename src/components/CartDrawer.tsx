import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MapPin, Minus, Plus, Trash2, Truck, X } from 'lucide-react';
import { useRef } from 'react';
import { formatEGP } from '../data/store';
import { cellQty, getPromo, getShippingFee } from '../admin/adminData';
import { useCatalog } from '../catalog/CatalogContext';
import { useShop } from '../store/CartContext';
import { useFocusTrap } from '../utils/useFocusTrap';
import { useLockBody } from '../utils/useLockBody';
import { WhatsAppIcon } from './Header';
import WaCta from './WaCta';

export default function CartDrawer() {
  const { items, subtotal, count, isCartOpen, closeCart, setQty, remove } = useShop();
  const panelRef = useRef<HTMLElement>(null);
  useLockBody(isCartOpen);
  useFocusTrap(isCartOpen, panelRef);
  const catalog = useCatalog();
  const shippingFee = getShippingFee();
  const promo = getPromo();
  const total = subtotal + (items.length ? shippingFee : 0);

  /** Live ceiling per line — steppers can never exceed real stock. */
  const maxFor = (id: string, variant: string, size: string): number => {
    const p = catalog.find((x) => x.id === id);
    if (!p) return Number.MAX_SAFE_INTEGER;
    return cellQty(p, variant, size);
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]"
          />
          <motion.aside
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col rounded-l-[20px] bg-white dark:bg-[#101010] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-6 py-5">
              <h2 className="font-display text-lg font-normal uppercase tracking-tight">
                Bag ({count})
              </h2>
              <button
                onClick={closeCart}
                aria-label="Close cart"
                className="rounded-full p-2.5 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] px-6 py-3.5">
              <Truck className="h-4 w-4 shrink-0" />
              <p className="text-[11px] tracking-[0.12em] text-black/60 dark:text-white/60">
                Delivery to all governorates — flat{' '}
                <span className="font-normal text-black dark:text-[#f2f2f2]">{formatEGP(shippingFee)}</span> · within a
                week
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="font-display mt-4 text-2xl font-normal uppercase">Your bag is empty</p>
                  <p className="mt-1.5 text-[12px] tracking-wider text-black/50 dark:text-white/50">
                    Hoodies, pants & essentials.
                  </p>
                  <button
                    onClick={closeCart}
                    className="mt-6 rounded-full bg-black px-9 py-3.5 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
                  >
                    CONTINUE SHOPPING
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-5">
                  {items.map((i) => {
                    const v = i.product.variants.find((x) => x.name === i.variant);
                    const max = maxFor(i.product.id, i.variant, i.size);
                    const atMax = max !== Number.MAX_SAFE_INTEGER && i.qty >= max;
                    return (
                      <li key={`${i.product.id}-${i.variant}-${i.size}`} className="flex gap-4">
                        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-[#F4F4F4] dark:bg-white/[0.07] ring-1 ring-black/10 dark:ring-white/10">
                          <img
                            src={v?.image ?? i.product.variants[0].image}
                            alt={i.product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-[12px] font-normal tracking-[0.14em]">{i.product.name}</p>
                              <p className="mt-1 flex items-center gap-1.5 text-[11px] tracking-[0.15em] text-black/50 dark:text-white/50">
                                {v && (
                                  <span
                                    className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-black/20"
                                    style={{ background: v.hex }}
                                  />
                                )}
                                {i.variant.toUpperCase()} · SIZE {i.size}
                              </p>
                            </div>
                            <button
                              onClick={() => remove(i.product.id, i.variant, i.size)}
                              aria-label="Remove"
                              className="rounded-full p-2 text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white active:bg-black/5"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                            <div>
                              <div className="flex items-center rounded-full border border-black/15 dark:border-white/15">
                                <button
                                  onClick={() => setQty(i.product.id, i.variant, i.size, i.qty - 1)}
                                  className="p-3 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 disabled:opacity-30"
                                  aria-label="Decrease"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-8 text-center text-[13px] font-normal">{i.qty}</span>
                                <button
                                  onClick={() => setQty(i.product.id, i.variant, i.size, i.qty + 1)}
                                  disabled={atMax}
                                  title={atMax ? `Only ${max} available` : 'Increase'}
                                  className="p-3 hover:bg-black/5 dark:hover:bg-white/10 active:bg-black/10 dark:active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
                                  aria-label="Increase"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              {atMax && (
                                <p className="mt-1 text-[10px] font-normal tracking-[0.12em] text-black/45 dark:text-white/45">
                                  MAX {max} AVAILABLE
                                </p>
                              )}
                            </div>
                            <p className="text-[13px] font-normal tracking-wider">
                              {formatEGP(i.product.price * i.qty)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t border-black/10 dark:border-white/10 px-6 py-5">
                <div className="space-y-1.5 text-[13px] tracking-[0.12em]">
                  <div className="flex justify-between text-black/60 dark:text-white/60">
                    <span>Subtotal</span>
                    <span>{formatEGP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-black/60 dark:text-white/60">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> Shipping — Egypt
                    </span>
                    <span>{formatEGP(shippingFee)}</span>
                  </div>
                  <div className="flex justify-between pt-1 text-[15px] font-normal tracking-[0.12em]">
                    <span>TOTAL</span>
                    <span>{formatEGP(total)}</span>
                  </div>
                </div>
                <p className="mt-2 text-[11px] tracking-wider text-black/50 dark:text-white/50">
                  You’ll send the order on WhatsApp — online payment, confirmed with you there.
                </p>
                {promo.enabled && promo.percent > 0 && (
                  <p className="mt-2 rounded-xl border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] px-3 py-2.5 text-center text-[11px] tracking-[0.12em] text-black/60 dark:text-white/60">
                    Got a promo code? Mention <span className="font-normal text-black dark:text-[#f2f2f2]">{promo.code}</span>{' '}
                    on WhatsApp for <span className="font-normal text-black dark:text-[#f2f2f2]">{promo.percent}% off</span>.
                  </p>
                )}
                <WaCta
                  mode="full"
                  lines={items.map((i) => ({
                    name: i.product.name,
                    variant: i.variant,
                    size: i.size,
                    qty: i.qty,
                    price: i.product.price,
                  }))}
                  title="DELIVERY DETAILS"
                  submitLabel="SEND ORDER ON WHATSAPP"
                  className="group mt-4 flex w-full items-center justify-center gap-2 rounded-full border-2 border-black dark:border-white bg-transparent py-4 text-[12px] font-normal tracking-[0.22em] text-black dark:text-[#f2f2f2] transition hover:border-[#25D366] hover:bg-[#25D366] hover:text-white dark:hover:text-black"
                >
                  <WhatsAppIcon className="h-4 w-4" />
                  ORDER ON WHATSAPP
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </WaCta>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
