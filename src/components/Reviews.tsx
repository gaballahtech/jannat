import { Truck, Ruler, BadgeCheck, MessageCircleHeart } from 'lucide-react';
import { formatEGP } from '../data/store';
import { getShippingFee } from '../admin/adminData';

/* Trust strip: ONLY claims that are already true on this site.
   Sits right under the hero where undecided shoppers need reassurance. */
export function TrustStrip() {
  const shippingFee = getShippingFee();
  const items = [
    { icon: Truck, top: 'ALL GOVERNORATES', sub: `${formatEGP(shippingFee)} flat · within a week` },
    { icon: MessageCircleHeart, top: 'WHATSAPP SUPPORT', sub: 'Real human, 7 days a week' },
    { icon: Ruler, top: 'SIZE FINDER', sub: 'Height + weight + tape guide' },
    { icon: BadgeCheck, top: 'ONLINE PAYMENT', sub: 'Confirmed 1-to-1 on WhatsApp' },
  ];
  return (
    <section aria-label="Why shop with pearlin" className="border-y border-black/10 dark:border-white/10 bg-white dark:bg-[#101010]">
      <div className="mx-auto grid max-w-[1400px] grid-cols-2 gap-y-5 px-4 py-6 sm:px-6 lg:grid-cols-4 lg:px-10">
        {items.map((it) => (
          <div key={it.top} className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
              <it.icon className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-[11px] font-normal tracking-[0.18em]">{it.top}</span>
              <span className="mt-0.5 block text-[11px] tracking-[0.06em] text-black/50 dark:text-white/50">
                {it.sub}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
