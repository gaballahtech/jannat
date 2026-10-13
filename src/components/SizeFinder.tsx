import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BadgeCheck, Ruler, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { recommendSizeV2, type FitPref, type Gender } from '../data/sizing';
import { onlyDigits } from '../utils/numbers';
import { useFocusTrap } from '../utils/useFocusTrap';
import { useLockBody } from '../utils/useLockBody';

const FITS: { id: FitPref; label: string; hint: string }[] = [
  { id: 'slim', label: 'SLIM', hint: 'Fitted' },
  { id: 'regular', label: 'REGULAR', hint: 'Normal' },
  { id: 'oversized', label: 'OVERSIZED', hint: 'Baggy' },
];

function NumField({
  label,
  value,
  set,
  min,
  max,
  suffix,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-normal tracking-[0.18em] text-black/60 dark:text-white/60">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => set(onlyDigits(e.target.value, 3))}
          inputMode="numeric"
          className="min-w-0 flex-1 rounded-xl border border-black/15 dark:border-white/15 px-3 py-2.5 text-center text-[15px] font-normal outline-none focus:border-black dark:focus:border-white"
        />
        <span className="w-8 shrink-0 text-[11px] font-normal text-black/60 dark:text-white/65">{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={Number(value) || 0}
        onChange={(e) => set(e.target.value)}
        className="mt-1.5 w-full accent-black"
        aria-label={label}
      />
    </div>
  );
}

export default function SizeFinder({
  open,
  onClose,
  available,
  category,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  available: string[];
  category: string;
  onApply: (size: string) => void;
}) {
  const [gender, setGender] = useState<Gender>('male');
  const [mode, setMode] = useState<'quick' | 'precise'>('quick');
  const [height, setHeight] = useState('175');
  const [weight, setWeight] = useState('75');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [fit, setFit] = useState<FitPref>('regular');
  const [guide, setGuide] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useFocusTrap(open, panelRef);
  useLockBody(open);

  const advice = useMemo(
    () =>
      recommendSizeV2({
        gender,
        heightCm: Number(height) || 0,
        weightKg: Number(weight) || 0,
        chestCm: chest ? Number(chest) : undefined,
        waistCm: waist ? Number(waist) : undefined,
        hipsCm: hips ? Number(hips) : undefined,
        fit,
        available,
        category,
      }),
    [gender, height, weight, chest, waist, hips, fit, available, category],
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-[2px]"
          />
          <div className="pointer-events-none fixed inset-0 z-[71] flex items-end justify-center sm:items-center sm:p-6">
            <motion.div
              ref={panelRef}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'tween', duration: 0.28 }}
              className="pointer-events-auto max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[24px] bg-white dark:bg-[#101010] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[24px] sm:p-8"
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-normal tracking-[0.22em]">
                  <Ruler className="h-4 w-4" /> FIND MY SIZE
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close size finder"
                  className="rounded-full p-2 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Gender */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                {(['male', 'female'] as Gender[]).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`rounded-xl border py-3 text-[12px] font-normal tracking-[0.18em] transition active:scale-95 ${
                      gender === g
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-black/15 hover:border-black dark:border-white/15 dark:hover:border-white'
                    }`}
                  >
                    {g === 'male' ? 'MALE' : 'FEMALE'}
                  </button>
                ))}
              </div>

              {/* Mode */}
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-[#F4F4F4] dark:bg-white/[0.07] p-1.5">
                {(
                  [
                    ['quick', 'QUICK · GUESS'],
                    ['precise', 'PRECISE · TAPE'],
                  ] as const
                ).map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`rounded-xl py-2.5 text-[11px] font-normal tracking-[0.15em] transition ${
                      mode === m ? 'bg-black text-white dark:bg-white dark:text-black' : 'text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'precise' ? (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <NumField
                      label={gender === 'male' ? 'CHEST (CM)' : 'BUST (CM)'}
                      value={chest}
                      set={setChest}
                      min={70}
                      max={140}
                      suffix="cm"
                    />
                    <NumField
                      label="WAIST (CM)"
                      value={waist}
                      set={setWaist}
                      min={55}
                      max={130}
                      suffix="cm"
                    />
                  </div>
                  {gender === 'female' && (
                    <NumField label="HIPS (CM)" value={hips} set={setHips} min={75} max={150} suffix="cm" />
                  )}
                  <button
                    onClick={() => setGuide((g) => !g)}
                    className="text-[11px] font-normal tracking-[0.15em] text-black/55 dark:text-white/55 underline-offset-4 hover:text-black dark:hover:text-white hover:underline"
                  >
                    {guide ? 'HIDE MEASURING GUIDE −' : 'HOW TO MEASURE +'}
                  </button>
                  {guide && (
                    <ul className="space-y-1.5 rounded-2xl bg-[#F8F8F8] dark:bg-white/[0.05] p-4 text-[12px] leading-relaxed tracking-[0.04em] text-black/65 dark:text-white/65">
                      <li>
                        <b>{gender === 'male' ? 'Chest' : 'Bust'}:</b> tape around the fullest
                        part, under the arms, straight across the back.
                      </li>
                      <li>
                        <b>Waist:</b> around the narrowest point, above the navel — relaxed,
                        don't pull tight.
                      </li>
                      {gender === 'female' && (
                        <li>
                          <b>Hips:</b> around the fullest part of the hips, feet together.
                        </li>
                      )}
                      <li>Measure over a thin t-shirt, tape snug but not tight.</li>
                    </ul>
                  )}
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <NumField label="HEIGHT (CM)" value={height} set={setHeight} min={150} max={200} suffix="cm" />
                  <NumField label="WEIGHT (KG)" value={weight} set={setWeight} min={45} max={130} suffix="kg" />
                </div>
              )}

              {/* Shared: height/weight always refine length & fallback */}
              {mode === 'precise' && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <NumField label="HEIGHT (CM)" value={height} set={setHeight} min={150} max={200} suffix="cm" />
                  <NumField label="WEIGHT (KG)" value={weight} set={setWeight} min={45} max={130} suffix="kg" />
                </div>
              )}

              {/* Fit */}
              <div className="mt-5">
                <p className="text-[11px] font-normal tracking-[0.2em] text-black/60 dark:text-white/60">
                  HOW DO YOU LIKE IT?
                </p>
                <div className="mt-2.5 grid grid-cols-3 gap-2">
                  {FITS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setFit(f.id)}
                      className={`rounded-xl border px-2 py-3 transition active:scale-95 ${
                        fit === f.id
                          ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                          : 'border-black/15 hover:border-black dark:border-white/15 dark:hover:border-white'
                      }`}
                    >
                      <span className="block text-[12px] font-normal tracking-[0.12em]">{f.label}</span>
                      <span
                        className={`mt-0.5 block text-[10px] tracking-[0.08em] ${
                          fit === f.id ? 'text-white/60 dark:text-black/60' : 'text-black/60 dark:text-white/60'
                        }`}
                      >
                        {f.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Result */}
              <div className="mt-6 rounded-2xl bg-black p-5 text-center text-white dark:bg-white dark:text-black">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-[10px] font-normal tracking-[0.28em] text-white/55 dark:text-black/55">YOUR SIZE</p>
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-normal tracking-[0.15em] ${
                      advice.accuracy === 'high' ? 'bg-white text-black dark:bg-black dark:text-white' : 'bg-white/15 text-white/80 dark:bg-black/10 dark:text-black/70'
                    }`}
                  >
                    <BadgeCheck className="h-3 w-3" />
                    {advice.accuracy === 'high' ? 'HIGH ACCURACY' : 'ESTIMATE'}
                  </span>
                </div>
                <p className="font-display mt-1 text-5xl font-normal">{advice.size}</p>
                {advice.between && (
                  <p className="mt-1.5 text-[11px] font-normal tracking-[0.1em] text-white dark:text-black">
                    Between {advice.between[0]} and {advice.between[1]} — sized up for comfort
                  </p>
                )}
                <ul className="mx-auto mt-3 max-w-xs space-y-1">
                  {advice.steps.map((s) => (
                    <li key={s} className="text-[11px] tracking-[0.08em] text-white/60 dark:text-black/60">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => {
                  onApply(advice.size);
                  onClose();
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.22em] text-white transition hover:bg-neutral-800 dark:hover:bg-neutral-200 dark:bg-white dark:text-black"
              >
                USE SIZE {advice.size} <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-3 text-center text-[11px] leading-relaxed tracking-[0.06em] text-black/60 dark:text-white/60">
                Tape measurements + gender tables = our most precise answer. Still unsure? Ask us
                on WhatsApp with your numbers.
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
