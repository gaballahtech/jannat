import { ArrowRight, Truck } from 'lucide-react';
import { formatEGP } from '../data/store';
import { getShippingFee } from '../admin/adminData';
import WaCta from './WaCta';

export default function AnnouncementBanner() {
  const shippingFee = getShippingFee();
  return (
    <section className="bg-[#7c5f36] text-white">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center gap-2.5 px-4 py-4 sm:px-6 md:flex-row md:justify-between md:gap-4 md:py-5 lg:px-10">
        <div className="flex flex-col items-center gap-2.5 text-center md:flex-row md:gap-3 md:text-left">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-[#7c5f36] md:h-9 md:w-9 dark:bg-white dark:text-[#7c5f36]">
            <Truck className="h-5 w-5 md:h-4 md:w-4" />
          </span>
          <div>
            <p className="text-[12px] font-normal leading-relaxed tracking-[0.18em] md:tracking-[0.24em]">
              SHIPPING TO ALL GOVERNORATES — {formatEGP(shippingFee)} FLAT
            </p>
            <p className="mt-1 text-[11px] tracking-[0.12em] text-white/85">
              Online payment · Delivery within a week
            </p>
          </div>
        </div>
        {/* Useful on desktop only — on mobile WhatsApp actions already exist everywhere */}
        <WaCta
          mode="name"
          message={(info) => `Hi jannat! I'm ${info.name}. I want to order.`}
          title="QUICK HELLO"
          submitLabel="CONTINUE TO WHATSAPP"
          className="group hidden items-center gap-2 text-[12px] font-normal tracking-[0.24em] md:flex"
        >
          ORDER ON WHATSAPP
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white text-[#7c5f36] transition-transform group-hover:translate-x-1 dark:bg-white dark:text-[#7c5f36]">
            <ArrowRight className="h-4 w-4" />
          </span>
        </WaCta>
      </div>
    </section>
  );
}
