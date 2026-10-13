import { ArrowUpRight } from 'lucide-react';
import { getContact } from '../admin/adminData';
import { TikTokIcon, WhatsAppIcon } from './Header';
import { InstagramIcon } from './icons';
import WaCta from './WaCta';

export default function SocialConnect() {
  const contact = getContact();
  return (
    <section id="contact" className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
      <div className="mb-10 text-center">
        <p className="text-[11px] font-normal tracking-[0.3em] text-black/60 dark:text-white/60">CONTACT — EGYPT</p>
        <h2 className="font-display mt-3 text-3xl font-normal uppercase tracking-tight sm:text-4xl">
          Order direct. <em className="font-normal normal-case italic">Talk to us.</em>
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 lg:gap-7">
        {/* WhatsApp */}
        <div className="flex flex-col justify-between rounded-[20px] border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] p-8 transition hover:border-black/25 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
          <div>
            <span className="grid h-13 w-13 place-items-center rounded-full bg-black p-3.5 text-white dark:bg-white dark:text-black">
              <WhatsAppIcon className="h-5 w-5" />
            </span>
            <h3 className="font-display mt-6 text-2xl font-normal uppercase">WhatsApp</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed tracking-wide text-black/60 dark:text-white/60">
              Order & support, 7 days a week.
              <br />
              <span className="font-normal text-black dark:text-[#f2f2f2]">{contact.whatsappDisplay}</span>
            </p>
          </div>
          <WaCta
            mode="name"
            message={(info) => `Hi pearlin! I'm ${info.name}. I have a question.`}
            title="QUICK HELLO"
            submitLabel="CHAT ON WHATSAPP"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
          >
            CHAT ON WHATSAPP <ArrowUpRight className="h-4 w-4" />
          </WaCta>
        </div>

        {/* Instagram */}
        <div className="flex flex-col justify-between rounded-[20px] bg-[#0A0A0A] p-8 text-white ring-1 ring-white/10">
          <div>
            <span className="grid h-13 w-13 place-items-center rounded-full bg-white p-3.5 text-black dark:bg-white dark:text-black">
              <InstagramIcon className="h-5 w-5" />
            </span>
            <h3 className="font-display mt-6 text-2xl font-normal uppercase">Instagram</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed tracking-wide text-white/60">
              New pieces & updates.
              <br />
              <span className="font-normal text-white">{contact.instagramHandle}</span>
            </p>
          </div>
          <a
            href={contact.instagram}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-4 text-[12px] font-normal tracking-[0.2em] text-black transition hover:bg-neutral-200 dark:bg-white dark:text-black"
          >
            FOLLOW ON INSTAGRAM <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        {/* TikTok */}
        <div className="flex flex-col justify-between rounded-[20px] border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] p-8 transition hover:border-black/25 hover:shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]">
          <div>
            <span className="grid h-13 w-13 place-items-center rounded-full bg-black p-3.5 text-white dark:bg-white dark:text-black">
              <TikTokIcon className="h-5 w-5" />
            </span>
            <h3 className="font-display mt-6 text-2xl font-normal uppercase">TikTok</h3>
            <p className="mt-2.5 text-[13px] leading-relaxed tracking-wide text-black/60 dark:text-white/60">
              Videos & new pieces.
              <br />
              <span className="font-normal text-black dark:text-[#f2f2f2]">{contact.tiktokHandle}</span>
            </p>
          </div>
          <a
            href={contact.tiktok}
            target="_blank"
            rel="noreferrer"
            className="mt-7 inline-flex items-center justify-center gap-2 rounded-full bg-black px-6 py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
          >
            WATCH ON TIKTOK <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
