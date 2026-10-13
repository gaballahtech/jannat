import { ArrowRight, Heart, Menu, Search, ShoppingBag, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getContact } from '../admin/adminData';
import { goHome, useRoute } from '../router';
import { useShop } from '../store/CartContext';
import { TikTokIcon, WhatsAppIcon } from './icons';
import Logo from './Logo';
import WaCta from './WaCta';

export default function Header() {
  const contact = getContact();
  const { count, openCart, wishlist } = useShop();
  const route = useRoute();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Stable page key — the route object is rebuilt every render, and using it
  // directly would close the menu on ANY re-render (toast, cart badge…).
  const pageKey =
    route.view === 'product'
      ? `product:${route.id}`
      : route.view === 'shop'
        ? `shop:${route.category}:${route.saved}`
        : route.view === 'search'
          ? 'search'
          : route.view === 'admin'
            ? `admin:${route.tab}`
            : route.view;

  // Close the mobile menu when the page itself changes.
  useEffect(() => {
    setMobileOpen(false);
  }, [pageKey]);

  const goSection = (id: string) => {
    setMobileOpen(false);
    goHome(id);
  };

  const navLink = 'group relative text-[12px] font-normal tracking-[0.22em] text-black/80 transition hover:text-black dark:text-white/80 dark:hover:text-white';
  const navUnderline =
    'absolute -bottom-1 left-0 h-[2px] w-0 bg-black transition-all duration-300 group-hover:w-full dark:bg-white';

  const iconBtn =
    'rounded-full p-2 transition hover:bg-black hover:text-white active:bg-black active:text-white dark:hover:bg-white dark:hover:text-black dark:active:bg-white dark:active:text-black';

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-[#0b0b0b]/95">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <button
            className="rounded-full p-2.5 hover:bg-black/5 active:bg-black/10 lg:hidden dark:hover:bg-white/10 dark:active:bg-white/15"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <a href="/" aria-label="Jannat — home" className="shrink-0">
            <Logo className="h-9 w-9 sm:h-10 sm:w-10" />
          </a>
          <span className="hidden rounded-full bg-[#F4F4F4] px-2.5 py-1 text-[10px] font-normal tracking-[0.18em] text-black/60 sm:inline dark:bg-white/10 dark:text-white/60">
            EGYPT
          </span>
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          <a href="/shop" className={navLink}>
            SHOP
            <span className={navUnderline} />
          </a>
          <button onClick={() => goHome('arrivals')} className={navLink}>
            NEW IN
            <span className={navUnderline} />
          </button>
          <button onClick={() => goHome('contact')} className={navLink}>
            CONTACT
            <span className={navUnderline} />
          </button>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <WaCta
            mode="name"
            message={(info) => `Hi jannat! I'm ${info.name}.`}
            title="QUICK HELLO"
            submitLabel="CONTINUE TO WHATSAPP"
            ariaLabel="WhatsApp"
            className={`hidden sm:block ${iconBtn}`}
          >
            <WhatsAppIcon />
          </WaCta>
          <a
            href={contact.tiktok}
            target="_blank"
            rel="noreferrer"
            aria-label="TikTok"
            className={`hidden sm:block ${iconBtn}`}
          >
            <TikTokIcon />
          </a>
          <span className="mx-1 hidden h-4 w-px bg-black/15 sm:block dark:bg-white/15" />
          <a
            href="/shop/saved"
            aria-label="Wishlist"
            className={`relative ${iconBtn} p-2.5`}
          >
            <Heart className="h-[18px] w-[18px]" fill={wishlist.length > 0 ? 'currentColor' : 'none'} />
            {wishlist.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-normal text-white dark:bg-white dark:text-black">
                {wishlist.length}
              </span>
            )}
          </a>
          <a
            href="/search"
            aria-label="Search"
            className={`${iconBtn} p-2.5`}
          >
            <Search className="h-[18px] w-[18px]" />
          </a>
          <button
            onClick={openCart}
            aria-label="Bag"
            className={`relative ${iconBtn} p-2.5`}
          >
            <ShoppingBag className="h-[18px] w-[18px]" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black px-1 text-[10px] font-normal text-white dark:bg-white dark:text-black">
                {count}
              </span>
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-black/10 bg-white px-6 py-4 lg:hidden dark:border-white/10 dark:bg-[#0b0b0b]">
          <div className="flex flex-col gap-1">
            <a
              href="/shop"
              className="group flex items-center justify-between py-3 text-left text-sm font-normal tracking-[0.2em]"
            >
              SHOP
              <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </a>
            <button
              onClick={() => goSection('arrivals')}
              className="group flex items-center justify-between py-3 text-left text-sm font-normal tracking-[0.2em]"
            >
              NEW IN
              <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </button>
            <button
              onClick={() => goSection('contact')}
              className="group flex items-center justify-between py-3 text-left text-sm font-normal tracking-[0.2em]"
            >
              CONTACT
              <ArrowRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
            </button>
            <div className="mt-2 flex gap-2 border-t border-black/10 pt-4 dark:border-white/10">
              <WaCta
                mode="name"
                message={(info) => `Hi jannat! I'm ${info.name}.`}
                title="QUICK HELLO"
                submitLabel="CONTINUE TO WHATSAPP"
                ariaLabel="WhatsApp"
                className="rounded-full bg-black p-3 text-white dark:bg-white dark:text-black"
              >
                <WhatsAppIcon />
              </WaCta>
              <a href={contact.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok" className="rounded-full bg-black p-3 text-white dark:bg-white dark:text-black">
                <TikTokIcon />
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

// Re-exported so existing importers keep working.
export { TikTokIcon, WhatsAppIcon };
