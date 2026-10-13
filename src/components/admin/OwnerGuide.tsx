/* Owner quick-start, shown at the top of the dashboard overview tab.
   Plain language on purpose — the reader is a shop owner, not a developer. */
import { isServerOn } from '../../lib/api';

export default function OwnerGuide() {
  const server = isServerOn();
  const steps: [string, string][] = [
    ['1', 'Add products — Products tab → New → colors, photos, sizes, stock → Save.'],
    [
      '2',
      server
        ? 'Photos upload to Cloudinary and products save to your database — live on all devices instantly.'
        : 'Photos upload to Cloudinary automatically (or stay on this device if keys are missing).',
    ],
    ['3', 'Orders arrive on WhatsApp — then create the matching invoice under Invoices.'],
    [
      '4',
      server
        ? 'Neon backs up your database automatically — Export below is an extra JSON copy for your records.'
        : 'Export a backup regularly — Overview → Backup. Data lives in this browser until the database is connected.',
    ],
  ];
  return (
    <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-[#F8F8F8] dark:bg-white/[0.05] p-5 sm:p-6">
      <p className="text-[11px] font-normal tracking-[0.24em] text-black/60 dark:text-white/60">HOW TO RUN YOUR STORE</p>
      <ol className="mt-3 space-y-2.5">
        {steps.map(([n, text]) => (
          <li key={n} className="flex items-start gap-3 text-[13px] leading-relaxed text-black/70 dark:text-white/70">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black text-[11px] text-white dark:bg-white dark:text-black">
              {n}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
