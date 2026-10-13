import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export type DropdownOption = { value: string; label: string };

/* Fully custom dropdown — every pixel (closed button AND opened list)
   follows the site style. No native OS menus anywhere. */
export default function Dropdown({
  value,
  onChange,
  options,
  label,
  variant = 'pill',
  className = '',
  disabledValues = [],
}: {
  value: string;
  onChange: (v: string) => void;
  options: DropdownOption[];
  label: string;
  variant?: 'pill' | 'field' | 'compact';
  className?: string;
  /** Values shown but not selectable (e.g. sold-out sizes show their 0 count). */
  disabledValues?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const enabledIdx = options
    .map((o, i) => (disabledValues.includes(o.value) ? -1 : i))
    .filter((i) => i >= 0);

  useEffect(() => {
    if (!open) return;
    setActive(() => {
      const cur = options.findIndex((o) => o.value === value);
      return cur >= 0 ? cur : (enabledIdx[0] ?? -1);
    });
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((a) => {
          if (enabledIdx.length === 0) return a;
          const pos = enabledIdx.indexOf(a);
          const next =
            e.key === 'ArrowDown'
              ? enabledIdx[(pos + 1 + enabledIdx.length) % enabledIdx.length]
              : enabledIdx[(pos - 1 + enabledIdx.length) % enabledIdx.length];
          return next ?? a;
        });
      } else if (e.key === 'Enter') {
        const o = options[active];
        if (o && !disabledValues.includes(o.value)) {
          onChange(o.value);
          setOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Keep the highlighted option visible while arrowing.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const current = options.find((o) => o.value === value);

  const shapes = {
    pill: 'rounded-full px-4 py-2.5 text-[11px] font-normal tracking-[0.15em]',
    field: 'rounded-xl px-4 py-3 text-[13px] font-normal tracking-[0.06em]',
    compact: 'rounded-lg px-2.5 py-2 text-[11px] font-normal tracking-[0.04em]',
  } as const;

  return (
    <div ref={ref} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex w-full cursor-pointer items-center justify-between gap-2 border outline-none transition ${
          open
            ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
            : 'border-black/15 bg-white hover:border-black dark:border-white/15 dark:bg-[#101010] dark:hover:border-white'
        } ${shapes[variant]}`}
      >
        <span className="truncate">{current?.label ?? ''}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={label}
          ref={listRef}
          className="absolute left-0 top-full z-50 mt-2 max-h-64 min-w-full overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#101010] p-1.5 shadow-[0_24px_70px_-20px_rgba(0,0,0,0.45)]"
        >
          {options.map((o, i) => {
            const isActive = o.value === value;
            const disabled = !isActive && disabledValues.includes(o.value);
            const highlighted = i === active;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  disabled={disabled}
                  data-idx={i}
                  onMouseEnter={() => {
                    if (!disabled) setActive(i);
                  }}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left leading-snug transition ${
                    isActive
                      ? 'bg-black text-white dark:bg-white dark:text-black'
                      : disabled
                        ? 'cursor-not-allowed text-black/30 dark:text-white/30'
                        : highlighted
                          ? 'bg-black/[0.06] text-black dark:bg-white/10 dark:text-[#f2f2f2]'
                          : 'text-black hover:bg-black/[0.06] dark:text-[#f2f2f2] dark:hover:bg-white/10'
                  } ${variant === 'compact' ? 'text-[11px] font-normal' : 'text-[12px] font-normal tracking-[0.03em]'}`}
                >
                  <span className="grid w-4 shrink-0 place-items-center">
                    {isActive && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
