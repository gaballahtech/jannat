import { MapPin } from 'lucide-react';
import { useCatalog, useCategories } from '../catalog/CatalogContext';
import { getContact, getShippingFee } from '../admin/adminData';
import { KNOWN_SIZES, formatEGP } from '../data/store';
import { TikTokIcon, WhatsAppIcon } from './Header';
import { InstagramIcon } from './icons';
import Logo from './Logo';
import WaCta from './WaCta';

const SHOP_LINKS_FALLBACK = [
  { label: 'Hoodies', href: '/shop/hoodies' },
  { label: 'Jackets', href: '/shop/jackets' },
  { label: 'Pants', href: '/shop/pants' },
  { label: 'T-Shirts', href: '/shop/tees' },
  { label: 'Accessories', href: '/shop/accessories' },
];

const COPYRIGHT_YEAR = new Date().getFullYear();

function titleCase(s: string): string {
  if (!s) return s;
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export default function Footer() {
  const cats = useCategories();
  const contact = getContact();
  const shippingFee = getShippingFee();
  const allSizes = useCatalog().flatMap((p) => p.sizes);
  const sizeRange = (() => {
    const order = [...KNOWN_SIZES];
    const present = order.filter((s) => allSizes.includes(s));
    if (present.length === 0) return null;
    if (present.length === 1) return present[0];
    return `${present[0]} — ${present[present.length - 1]}`;
  })();
  const shopLinks =
    cats.length > 0
      ? cats.map((c) => ({ label: titleCase(c.label), href: `/shop/${c.id}` }))
      : SHOP_LINKS_FALLBACK;

  return (
    <footer className="border-t border-black/10 bg-white dark:border-white/10 dark:bg-[#0b0b0b]">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-10 lg:py-20">
        <div>
          <Logo className="h-10 w-auto" />
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed tracking-wide text-black/55 dark:text-white/55">
            Heavyweight hoodies & essentials — delivered to all governorates. Online payment.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-[12px] tracking-[0.12em] text-black/55 dark:text-white/55">
            <MapPin className="h-3.5 w-3.5" /> Cairo, Egypt · {contact.whatsappDisplay}
          </p>
          <div className="mt-5 flex gap-2">
            <WaCta
              mode="name"
              message={(info) => `Hi pearlin! I'm ${info.name}.`}
              title="QUICK HELLO"
              submitLabel="CONTINUE TO WHATSAPP"
              ariaLabel="WhatsApp"
              className="grid h-11 w-11 place-items-center rounded-full bg-black text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <WhatsAppIcon />
            </WaCta>
            <a
              href={contact.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="grid h-11 w-11 place-items-center rounded-full bg-black text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <InstagramIcon className="h-4 w-4" />
            </a>
            <a
              href={contact.tiktok}
              target="_blank"
              rel="noreferrer"
              aria-label="TikTok"
              className="grid h-11 w-11 place-items-center rounded-full bg-black text-white transition hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              <TikTokIcon />
            </a>
          </div>
        </div>

        <div>
          <h4 className="text-[12px] font-normal tracking-[0.24em]">SHOP</h4>
          <ul className="mt-4 space-y-2.5 text-[13px] tracking-wider text-black/60 dark:text-white/60">
            {shopLinks.map((l) => (
              <li key={l.label}>
                <a href={l.href} className="transition hover:text-black hover:underline dark:hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="text-[12px] font-normal tracking-[0.24em]">HELP</h4>
          <ul className="mt-4 space-y-2.5 text-[13px] tracking-wider text-black/60 dark:text-white/60">
            <li>Delivery to all governorates ({formatEGP(shippingFee)} flat, within a week)</li>
            {sizeRange && <li>Sizes available: {sizeRange}</li>}
            <li>
              <WaCta
                mode="name"
                message={(info) => `Hi pearlin! I'm ${info.name}. I have a question.`}
                title="QUICK HELLO"
                submitLabel="CONTINUE TO WHATSAPP"
                className="hover:text-black hover:underline dark:hover:text-white"
              >
                Contact us on WhatsApp
              </WaCta>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-[1400px] px-4 py-5 text-center text-[11px] tracking-[0.18em] text-black/50 sm:px-6 lg:px-10 dark:text-white/50">
          © {COPYRIGHT_YEAR} PEARLIN · CAIRO, EGYPT. ALL RIGHTS RESERVED.
          {' · '}
          <a href="/admin" rel="nofollow" className="text-black/30 transition hover:text-black dark:text-white/30 dark:hover:text-white">
            ADMIN
          </a>
        </div>
      </div>
    </footer>
  );
}
