import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCatalog } from '../catalog/CatalogContext';
import { getHome } from '../admin/adminData';
import { formatEGP } from '../data/store';
import { productPath } from '../router';
import { WhatsAppIcon } from './Header';
import WaCta from './WaCta';

export default function Hero() {
  const products = useCatalog();
  // Slides come from #/admin → homepage (product + color per slot).
  const slides = useMemo(() => {
    const home = getHome();
    const resolved = home.hero
      .map((s) => {
        const p = products.find((x) => x.id === s.productId);
        if (!p) return null;
        const v = p.variants.find((x) => x.name === s.variant) ?? p.variants[0];
        if (!v) return null;
        return {
          id: `${p.id}-${v.name}`,
          image: v.image,
          label: `${p.name} — ${v.name.toUpperCase()} — ${formatEGP(p.price)}`,
          url: productPath(p.id, v.name),
          name: p.name,
        };
      })
      .filter(
        (x): x is { id: string; image: string; label: string; url: string; name: string } =>
          x !== null,
      );
    if (resolved.length > 0) return resolved;
    const fb = products[0];
    const fbv = fb?.variants[0];
    return fb && fbv
      ? [
          {
            id: fb.id,
            image: fbv.image,
            label: fb.name,
            url: productPath(fb.id, fbv.name),
            name: fb.name,
          },
        ]
      : [];
  }, [products]);
  const [index, setIndex] = useState(0);
  const len = Math.max(1, slides.length);
  const slide = slides[Math.min(index, Math.max(0, slides.length - 1))];

  const next = () => setIndex((i) => (i + 1) % len);
  const prev = () => setIndex((i) => (i - 1 + len) % len);
  if (!slide) return null;

  return (
    <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-stretch gap-12 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10 lg:pb-24 lg:pt-16">
      <div className="flex flex-col justify-center">
        <motion.h1
          key={`h-${index}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="font-display text-[13vw] font-normal uppercase leading-[0.95] tracking-tight sm:text-7xl lg:text-[92px]"
        >
          Heavyweight
          <br />
          hoodies.
          <br />
          <em className="font-normal normal-case italic text-[#7c5f36] dark:text-[#d3b183]">Made for Egypt.</em>
        </motion.h1>
        <p className="mt-7 max-w-md text-[14px] leading-relaxed tracking-wider text-black/60 dark:text-white/60">
          Premium hoodies & essentials, delivered to your door anywhere in Egypt. Order in 1
          minute on WhatsApp.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <a
            href="/shop"
            className="group inline-flex items-center gap-3 rounded-full bg-black px-9 py-4 text-[12px] font-normal tracking-[0.22em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
          >
            SHOP HOODIES
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </a>
          <WaCta
            mode="name"
            message={(info) => `Hi jannat! I'm ${info.name}. I want to order.`}
            title="QUICK HELLO"
            submitLabel="CONTINUE TO WHATSAPP"
            className="inline-flex items-center gap-2 rounded-full border-2 border-black dark:border-white px-9 py-4 text-[12px] font-normal tracking-[0.22em] transition hover:border-[#25D366] hover:bg-[#25D366] hover:text-white dark:hover:text-black"
          >
            <WhatsAppIcon className="h-4 w-4" />
            ORDER ON WHATSAPP
          </WaCta>
        </div>

        <div className="mt-14 flex items-center gap-8 border-t border-black/10 dark:border-white/10 pt-6 text-[11px] tracking-[0.2em] text-black/60 dark:text-white/60">
          <span>CAIRO · EGYPT</span>
          <span className="hidden sm:inline">ONLINE PAYMENT</span>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-5">
          <div className="min-w-0 flex-1">
            {/* Clean photo — nothing covers the garment. Click opens the product. */}
            <a
              href={slide.url}
              aria-label={`View ${slide.name}`}
              className="group relative block overflow-hidden rounded-[20px] bg-[#F4F4F4] dark:bg-white/[0.07] ring-1 ring-black/10 dark:ring-white/10"
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={slide.id}
                  src={slide.image}
                  alt={slide.label}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="h-[420px] w-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.03] sm:h-[520px] lg:h-[620px]"
                />
              </AnimatePresence>
              <span className="absolute right-4 top-4 hidden items-center gap-2 rounded-full bg-black/85 px-4 py-2 text-[10px] font-normal tracking-[0.22em] text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100 lg:inline-flex">
                VIEW PRODUCT <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </a>
            {/* Caption lives UNDER the photo — pearl dots + counter beside it */}
            <div className="mt-3.5 flex items-center justify-between gap-3">
              <AnimatePresence mode="wait">
                <motion.p
                  key={slide.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="truncate text-[11px] font-normal tracking-[0.18em] text-black/65 dark:text-white/65"
                >
                  {slide.label}
                </motion.p>
              </AnimatePresence>
              <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
                {slides.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Slide ${i + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === index ? 'w-6 bg-black dark:bg-white' : 'w-2 bg-black/20 hover:bg-black/50 dark:bg-white/20 dark:hover:bg-white/50'
                    }`}
                  />
                ))}
                <span className="ml-1 text-[10px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                  0{index + 1} / 0{slides.length}
                </span>
              </div>
            </div>
          </div>

          <div className="hidden flex-col items-center justify-between py-2 sm:flex">
            <span className="vertical-text text-[11px] font-normal tracking-[0.35em] text-black/60 dark:text-white/60">
              WINTER 2026
            </span>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={prev}
                aria-label="Previous"
                className="rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#101010] p-3.5 transition hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                onClick={next}
                aria-label="Next"
                className="rounded-full bg-black p-3.5 text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile slide controls with pearl dots */}
        <div className="mt-4 flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-2 rounded-full bg-[#F4F4F4] dark:bg-white/[0.07] px-4 py-2.5">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === index ? 'w-6 bg-black dark:bg-white' : 'w-2 bg-black/20 dark:bg-white/20'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-2.5">
            <button
              onClick={prev}
              aria-label="Previous"
              className="rounded-full border border-black/15 dark:border-white/15 bg-white dark:bg-[#101010] p-3.5 transition active:bg-black dark:active:bg-white active:text-white dark:active:text-black dark:active:bg-white dark:active:text-black"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="rounded-full bg-black p-3.5 text-white transition active:bg-neutral-800 dark:bg-white dark:text-black"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
