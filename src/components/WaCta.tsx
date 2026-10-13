import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, MapPin, User, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { getContact, getShippingFee } from '../admin/adminData';
import { GOVERNORATES } from '../data/egypt';
import { buildWhatsAppOrderLink, type CustomerInfo, type OrderLine } from '../data/store';
import Dropdown from './Dropdown';
import { WhatsAppIcon } from './icons';
import { useFocusTrap } from '../utils/useFocusTrap';
import { useLockBody } from '../utils/useLockBody';

const LS_KEY = 'pearlin-customer';

function loadSaved(): CustomerInfo {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const v = JSON.parse(raw) as Partial<CustomerInfo>;
      if (v && typeof v.name === 'string') return v as CustomerInfo;
    }
  } catch {
    /* ignore */
  }
  return { name: '' };
}

/* Every WhatsApp entry point on the site goes through this gate:
   - mode "full" (buying): name + governorate → city → exact address
   - mode "name" (chatting): name only
   Phone is NEVER asked — WhatsApp already shows the sender's number. */
export default function WaCta({
  mode,
  lines,
  message,
  title,
  submitLabel,
  className = '',
  ariaLabel,
  children,
}: {
  mode: 'full' | 'name';
  lines?: OrderLine[];
  message?: (info: CustomerInfo) => string;
  title: string;
  submitLabel: string;
  className?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [gov, setGov] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [err, setErr] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  useLockBody(open);
  useFocusTrap(open, panelRef);

  const openGate = () => {
    const saved = loadSaved();
    setName(saved.name ?? '');
    setGov(saved.governorate ?? '');
    setCity(saved.city ?? '');
    setAddress(saved.address ?? '');
    setErr('');
    setOpen(true);
  };

  const govObj = GOVERNORATES.find((g) => g.name === gov);

  const submit = () => {
    const n = name.trim();
    if (n.length < 2) return setErr('Please tell us your name first.');
    const info: CustomerInfo = { name: n };
    if (mode === 'full') {
      if (!gov) return setErr('Choose your governorate.');
      if (!city) return setErr('Choose your city.');
      if (address.trim().length < 4)
        return setErr('Write your street / building / landmark so delivery finds you.');
      info.governorate = govObj ? `${govObj.name} (${govObj.nameAr})` : gov;
      info.city = city;
      info.address = address.trim();
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(info));
    } catch {
      /* ignore */
    }
    const contact = getContact();
    const url = lines
      ? buildWhatsAppOrderLink(lines, getShippingFee(), contact.whatsapp, info)
      : contact.whatsappLink(message ? message(info) : `Hi pearlin! I'm ${info.name}.`);
    setOpen(false);
    window.open(url, '_blank', 'noopener');
  };

  const input =
    'w-full rounded-xl border border-black/15 bg-white px-4 py-3.5 text-[14px] outline-none placeholder:text-black/35 focus:border-black dark:border-white/15 dark:bg-[#101010] dark:placeholder:text-white/60 dark:focus:border-white';

  return (
    <>
      <button type="button" onClick={openGate} className={className} aria-label={ariaLabel}>
        {children}
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[75] bg-black/55 backdrop-blur-[2px]"
            />
            <div className="pointer-events-none fixed inset-0 z-[76] flex items-end justify-center sm:items-center sm:p-6">
              <motion.div
                ref={panelRef}
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'tween', duration: 0.28 }}
                className="pointer-events-auto w-full max-w-md rounded-t-[24px] bg-white dark:bg-[#101010] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[24px] sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[13px] font-normal tracking-[0.2em]">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-black text-white dark:bg-white dark:text-black">
                      <WhatsAppIcon className="h-4 w-4" />
                    </span>
                    {title}
                  </h2>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                    className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-6">
                  <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                    <User className="h-3.5 w-3.5" /> YOUR NAME
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submit()}
                    placeholder="e.g. Ahmed Samy"
                    autoFocus
                    className={input}
                  />
                </div>

                {mode === 'full' && (
                  <>
                    <div className="mt-4">
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                        <MapPin className="h-3.5 w-3.5" /> GOVERNORATE
                      </label>
                      <Dropdown
                        value={gov}
                        onChange={(v) => {
                          setGov(v);
                          setCity('');
                        }}
                        label="Governorate"
                        variant="field"
                        className="w-full"
                        options={GOVERNORATES.map((g) => ({
                          value: g.name,
                          label: `${g.name} · ${g.nameAr}`,
                        }))}
                      />
                    </div>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                        CITY
                      </label>
                      <Dropdown
                        value={city}
                        onChange={setCity}
                        label="City"
                        variant="field"
                        className="w-full"
                        options={(govObj?.cities ?? []).map((c) => ({ value: c, label: c }))}
                      />
                      {!gov && (
                        <p className="mt-1.5 text-[11px] tracking-[0.06em] text-black/60 dark:text-white/65">
                          Pick a governorate first.
                        </p>
                      )}
                    </div>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                        EXACT ADDRESS
                      </label>
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                        placeholder="Street, building, floor, landmark…"
                        className={input}
                      />
                    </div>
                  </>
                )}

                {err && (
                  <p className="mt-3 text-[12px] font-normal tracking-[0.06em] text-red-700 dark:text-red-400">{err}</p>
                )}
                <button
                  onClick={submit}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
                >
                  {submitLabel} <ArrowRight className="h-4 w-4" />
                </button>
                <p className="mt-3 text-center text-[11px] tracking-[0.06em] text-black/60 dark:text-white/60">
                  No phone needed — WhatsApp already shows your number.
                </p>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
