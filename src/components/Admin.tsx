import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarDays,
  Check,
  Download,
  ExternalLink,
  FileText,
  ImagePlus,
  Minus,
  Package,
  Phone,
  Plus,
  Receipt,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { adminPath, navigate, useRoute } from '../router';
import { useCatalogRefresh, useCatalog as useCatalogList } from '../catalog/CatalogContext';
import { normalizeDigits, onlyDigits, onlyPhoneChars } from '../utils/numbers';
import { useFocusTrap } from '../utils/useFocusTrap';
import { useLockBody } from '../utils/useLockBody';
import { askConfirm, ConfirmHost } from './Confirm';
import Dropdown from './Dropdown';
import PinGate from './admin/PinGate';
import ServerAuth from './admin/ServerGate';
import { FitInvoice } from './admin/InvoiceViews';
import OwnerGuide from './admin/OwnerGuide';
import { apiLogout, apiMe, fetchAuthStatus } from '../lib/api';
import {
  LOW_STOCK,
  KNOWN_SIZES,
  PRODUCTS,
  SIZES,
  formatEGP,
  type Product,
  type ProductVariant,
} from '../data/store';
import { renderInvoicePng } from '../admin/invoiceCanvas';
import {
  blankVariant,
  calcTotals,
  addCategory,
  cellKey,
  cellQty,
  ensureMatrix,
  checkPin,
  deleteCategory,
  deleteProduct,
  defaultShipping,
  exportBackup,
  findAdminProduct,
  getCategories,
  getHome,
  getInvoices,
  getOverrides,
  getSettings,
  isUnlocked,
  mergeCatalog as mergeCatalogSafe,
  normalizeWhatsapp,
  peekInvoiceNumber,
  importBackup,
  renameCategory,
  saveHome,
  saveInvoice,
  saveOverride,
  saveSettings,
  setPin,
  setUnlocked,
  slugId,
  voidInvoice,
  type BizSettings,
  type Invoice,
} from '../admin/adminData';
import { idbDel, refKey } from '../admin/db';
import { cloudinaryConfigured, storeProductImage } from '../lib/cloudinary';

/* PIN gate, invoice views and owner guide live in ./admin/*.
   See src/components/admin/PinGate.tsx, InvoiceViews.tsx, OwnerGuide.tsx. */

/* ================= product editor ================= */

type VariantDraft = ProductVariant & { _file?: File | null; _preview: string; _key: string };

type FormState = {
  id: string | null;
  name: string;
  price: string;
  category: string;
  tag: string;
  sold: string;
  description: string;
  fabric: string;
  sizes: string[];
  variants: VariantDraft[];
  /** Draft matrix keyed `${variantKey}|${size}` → pieces. */
  cells: Record<string, number>;
  /** Stock before editing — warns if the new matrix silently drops pieces. */
  origStock: number;
  /** Hand-picked "complete the look" product ids (max 2). */
  pairs: string[];
};

const uid = () => Math.random().toString(36).slice(2, 9);

/** Live grand total of the draft matrix (shown in the editor header). */
const matrixTotal = (form: FormState) =>
  form.sizes.reduce(
    (s, sz) =>
      s + form.variants.reduce((a, v) => a + (Number(form.cells[`${v._key}|${sz}`]) || 0), 0),
    0,
  );

function draftFromProduct(p: Product): FormState {
  // Keep the ORIGINAL image refs (idb:… or https://…) for saving;
  // the live catalog only carries resolved display URLs (blob:…) which must never be stored.
  const orig = getOverrides()[p.id]?.variants ?? [];
  const stat = PRODUCTS.find((x) => x.id === p.id)?.variants ?? [];
  const full = ensureMatrix(p);
  const variants = p.variants.map((v, i) => ({
    name: v.name,
    hex: v.hex,
    image: orig[i]?.image ?? stat[i]?.image ?? v.image,
    _file: null,
    _preview: v.image, // resolved URL from live catalog — display only
    _key: uid(),
  }));
  const cells: Record<string, number> = {};
  for (const v of variants)
    for (const s of full.sizes) cells[`${v._key}|${s}`] = full.inventory[cellKey(v.name, s)] ?? 0;
  return {
    id: p.id,
    name: p.name,
    price: String(p.price),
    category: p.category,
    tag: p.tag ?? '',
    sold: String(p.sold),
    description: p.description,
    fabric: p.fabric ?? '',
    sizes: [...full.sizes],
    variants,
    cells,
    origStock: full.stock,
    pairs: Array.isArray(full.pairsWith) ? full.pairsWith.filter((x) => x !== p.id).slice(0, 2) : [],
  };
}

const blankForm = (): FormState => ({
  id: null,
  name: '',
  price: '',
  category: 'hoodies',
  tag: '',
  sold: '0',
  description: '',
  fabric: '',
  sizes: ['S', 'M', 'L', 'XL'],
  variants: [{ ...blankVariant(), _file: null, _preview: '', _key: uid() }],
  cells: {},
  origStock: 0,
  pairs: [],
});

function ProductEditor({
  initial,
  all,
  onClose,
  onSaved,
}: {
  initial: FormState;
  all: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  useLockBody(true); // editor mounts as a modal
  useFocusTrap(true, panelRef);
  const set = (patch: Partial<FormState>) => setF((p) => ({ ...p, ...patch }));

  const pickFile = (key: string, file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setF((p) => ({
      ...p,
      variants: p.variants.map((v) => (v._key === key ? { ...v, _file: file, _preview: url } : v)),
    }));
  };

  const save = async () => {
    setErr('');
    const price = Number(f.price);
    const sold = Math.max(0, Math.floor(Number(f.sold) || 0));
    if (!f.name.trim()) return setErr('Product name is required.');
    if (!price || price <= 0) return setErr('Price must be a positive number.');
    if (f.sizes.length === 0) return setErr('Pick at least one size.');
    if (f.variants.length === 0) return setErr('Add at least one color variant.');
    for (const v of f.variants) {
      if (!v.name.trim()) return setErr('Every variant needs a color name.');
      if (!v._file && !v.image) return setErr(`Upload a photo for color “${v.name || '?'}”.`);
    }
    // duplicate color names would collapse matrix cells
    const names = f.variants.map((v) => v.name.trim().toLowerCase());
    if (new Set(names).size !== names.length)
      return setErr('Color names must be unique (each color × size has its own count).');
    setSaving(true);
    try {
      const id = f.id ?? slugId(f.name);
      const variants: ProductVariant[] = [];
      for (let i = 0; i < f.variants.length; i++) {
        const v = f.variants[i];
        let ref = v.image;
        if (v._file) {
          // remove replaced local upload (Cloudinary URLs need no cleanup)
          const oldKey = refKey(v.image);
          ref = await storeProductImage(v._file, `img_${id}_${i}_${Date.now()}`);
          if (oldKey) await idbDel(oldKey);
        }
        variants.push({ name: v.name.trim(), hex: v.hex, image: ref });
      }
      // translate draft cells (keyed by internal id) to stored keys (color|size)
      const nameByKey: Record<string, string> = {};
      f.variants.forEach((v, i) => {
        nameByKey[v._key] = variants[i].name;
      });
      const inventory: Record<string, number> = {};
      for (const v of f.variants)
        for (const s of f.sizes)
          inventory[cellKey(nameByKey[v._key], s)] = Math.max(
            0,
            Math.floor(Number(f.cells[`${v._key}|${s}`]) || 0),
          );
      const stock = Object.values(inventory).reduce((a, n) => a + n, 0);
      if (stock === 0) {
        const ok = await askConfirm({
          title: 'Zero stock?',
          message: 'Total stock is ZERO — this product will show as SOLD OUT everywhere. Save anyway?',
          confirmLabel: 'SAVE ANYWAY',
          danger: true,
        });
        if (!ok) {
          setSaving(false);
          return;
        }
      }
      const record: Product = {
        id,
        name: f.name.trim().toUpperCase(),
        price,
        variants,
        tag: f.tag || undefined,
        category: f.category,
        description: f.description.trim(),
        fabric: f.fabric.trim() || undefined,
        sold,
        stock,
        sizes: [...f.sizes],
        inventory,
        // New products are "added now" (front of New Arrivals); edits keep the original date.
        createdAt: f.id
          ? (findAdminProduct(f.id)?.createdAt ?? new Date().toISOString())
          : new Date().toISOString(),
        pairsWith: f.pairs.filter((x) => x !== id).slice(0, 2),
      };
      saveOverride(record);
      onSaved();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const input =
    'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[16px] outline-none placeholder:text-black/35 focus:border-black sm:text-[13px]';
  const label = 'mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={f.id ? 'Edit product' : 'New product'}
        className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-[24px] bg-white p-6 sm:rounded-[24px] sm:p-8"
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-normal uppercase">
            {f.id ? 'Edit product' : 'New product'}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-2.5 hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <p className="-mb-1 flex items-center gap-2.5 text-[12px] font-normal tracking-[0.22em] sm:col-span-2">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">1</span>
            BASIC INFO — NAME, PRICE & DETAILS
          </p>
          <div className="sm:col-span-2">
            <label className={label}>NAME</label>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="UTILITY HOODIE" className={input} />
          </div>
          <div>
            <label className={label}>PRICE (EGP)</label>
            <input value={f.price} onChange={(e) => set({ price: onlyDigits(e.target.value) })} inputMode="numeric" placeholder="950" className={input} />
          </div>
          <div>
            <label className={label}>CATEGORY</label>
            <Dropdown
              value={f.category}
              onChange={(v) => set({ category: v })}
              label="Category"
              variant="field"
              className="w-full"
              options={getCategories().map((c) => ({
                value: c.id,
                label: c.label,
              }))}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>
              <span className="mr-2 inline-grid h-5 w-5 place-items-center rounded-full bg-black align-middle text-[10px] text-white">3</span>
              SIZES YOU HAVE — TAP TO TOGGLE
            </label>
            <div className="flex flex-wrap gap-2">
              {KNOWN_SIZES.map((s) => {
                const on = f.sizes.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      set({
                        sizes: on ? f.sizes.filter((x) => x !== s) : [...f.sizes, s],
                      })
                    }
                    className={`rounded-full border px-5 py-2.5 text-[11px] font-normal tracking-[0.12em] transition active:scale-95 ${
                      on
                        ? 'border-black bg-black text-white'
                        : 'border-black/15 bg-white hover:border-black'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={label}>SOLD SO FAR (AUTO-COUNTS)</label>
            <input value={f.sold} onChange={(e) => set({ sold: onlyDigits(e.target.value) })} inputMode="numeric" className={input} />
          </div>
          <div>
            <label className={label}>BADGE (OPTIONAL)</label>
            <Dropdown
              value={f.tag}
              onChange={(v) => set({ tag: v })}
              label="Badge"
              variant="field"
              className="w-full"
              options={[
                { value: '', label: 'None' },
                { value: 'NEW', label: 'NEW' },
                { value: 'BESTSELLER', label: 'BESTSELLER' },
              ]}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>DESCRIPTION</label>
            <textarea value={f.description} onChange={(e) => set({ description: e.target.value })} rows={3} placeholder="Heavyweight fleece hoodie…" className={input} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>FABRIC (OPTIONAL)</label>
            <input value={f.fabric} onChange={(e) => set({ fabric: e.target.value })} placeholder="480 GSM brushed fleece" className={input} />
          </div>
        </div>

        {/* variants */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2.5 text-[11px] font-normal tracking-[0.2em] text-black/60">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">2</span>
              COLORS & PHOTOS ({f.variants.length})
            </p>
            <button
              onClick={() => set({ variants: [...f.variants, { ...blankVariant(), _file: null, _preview: '', _key: uid() }] })}
              className="flex items-center gap-1.5 rounded-full border border-black/20 px-4 py-2 text-[11px] font-normal tracking-[0.15em] transition hover:border-black hover:bg-black hover:text-white"
            >
              <Plus className="h-3.5 w-3.5" /> ADD COLOR
            </button>
          </div>
          <p className="mt-2 text-[11px] tracking-[0.08em] text-black/45">
            {cloudinaryConfigured()
              ? 'Photos upload to Cloudinary (compressed WebP, shared on all devices).'
              : 'Cloudinary not set — photos stay on this device only. Add VITE_CLOUDINARY_* in .env.'}
          </p>
          <div className="mt-3 space-y-3">
            {f.variants.map((v) => (
              <div key={v._key} className="flex gap-3 rounded-2xl border border-black/10 bg-[#F8F8F8] p-3">
                <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-[#e8e8e8]">
                  {v._preview ? (
                    <img src={v._preview} alt={v.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-black/30">
                      <ImagePlus className="h-6 w-6" />
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={v.name}
                      onChange={(e) =>
                        set({ variants: f.variants.map((x) => (x._key === v._key ? { ...x, name: e.target.value } : x)) })
                      }
                      placeholder="Color name (Black)"
                      className={`${input} py-2.5!`}
                    />
                    <input
                      type="color"
                      value={v.hex}
                      onChange={(e) =>
                        set({ variants: f.variants.map((x) => (x._key === v._key ? { ...x, hex: e.target.value } : x)) })
                      }
                      className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-black/15 bg-white p-1"
                      title="Swatch color"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-black/25 bg-white px-3 py-2.5 text-[11px] font-normal tracking-[0.12em] text-black/60 transition hover:border-black hover:text-black">
                    <ImagePlus className="h-4 w-4" />
                    {v._preview ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => pickFile(v._key, e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                {f.variants.length > 1 && (
                  <button
                    onClick={() => set({ variants: f.variants.filter((x) => x._key !== v._key) })}
                    aria-label="Remove color"
                    className="self-start rounded-full p-2 text-black/40 hover:bg-black/5 hover:text-black"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Stock matrix: exact pieces per color × size */}
        <div className="mt-6">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-2.5 text-[11px] font-normal tracking-[0.2em] text-black/60">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">4</span>
              HOW MANY PIECES OF EACH?
            </p>
            <span className="rounded-full bg-black px-4 py-1.5 text-[10px] font-normal tracking-[0.15em] text-white">
              TOTAL {matrixTotal(f)}
            </span>
          </div>
          {f.sizes.length === 0 || f.variants.length === 0 ? (
            <p className="mt-3 rounded-xl bg-[#F8F8F8] px-4 py-3 text-[12px] tracking-[0.06em] text-black/50">
              Pick sizes above and add at least one color to fill the stock table.
            </p>
          ) : (
            <div className="no-scrollbar mt-3 overflow-x-auto rounded-2xl border border-black/10">
              <table className="w-full min-w-[420px] border-collapse bg-white text-center">
                <thead>
                  <tr className="bg-[#F8F8F8]">
                    <th className="sticky left-0 bg-[#F8F8F8] px-3 py-2.5 text-left text-[10px] font-normal tracking-[0.15em] text-black/50">
                      COLOR ↓ · SIZE →
                    </th>
                    {f.sizes.map((s) => (
                      <th key={s} className="px-2 py-2.5 text-[10px] font-normal tracking-[0.12em]">
                        {s}
                      </th>
                    ))}
                    <th className="px-2 py-2.5 text-[10px] font-normal tracking-[0.12em] text-black/50">
                      ROW
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {f.variants.map((v) => {
                    const rowTotal = f.sizes.reduce(
                      (a, s) => a + (Number(f.cells[`${v._key}|${s}`]) || 0),
                      0,
                    );
                    return (
                      <tr key={v._key} className="border-t border-black/10">
                        <td className="sticky left-0 max-w-[110px] bg-white px-3 py-2 text-left">
                          <span className="flex items-center gap-1.5 text-[11px] font-normal tracking-[0.08em]">
                            <span
                              className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/25"
                              style={{ background: v.hex }}
                            />
                            <span className="truncate">{v.name.trim().toUpperCase() || '—'}</span>
                          </span>
                        </td>
                        {f.sizes.map((s) => (
                          <td key={s} className="px-1 py-1.5">
                            <input
                              value={f.cells[`${v._key}|${s}`] ?? 0}
                              onChange={(e) => {
                                const n = Math.max(
                                  0,
                                  Math.floor(Number(onlyDigits(e.target.value, 5)) || 0),
                                );
                                set({ cells: { ...f.cells, [`${v._key}|${s}`]: n } });
                              }}
                              inputMode="numeric"
                              aria-label={`${v.name.trim() || 'color'} size ${s} pieces`}
                              className="w-16 rounded-lg border border-black/15 bg-[#F8F8F8] py-3 text-center text-[16px] font-normal outline-none focus:border-black focus:bg-white sm:w-14 sm:py-2 sm:text-[13px]"
                            />
                          </td>
                        ))}
                        <td className="px-2 text-[12px] font-normal">{rowTotal}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-[11px] tracking-[0.06em] text-black/45">
            Write how many pieces you have of each color in each size. Total updates by itself.
            {f.origStock > matrixTotal(f) && (
              <span className="font-normal text-red-700">
                {' '}
                Heads up: total dropped from {f.origStock} to {matrixTotal(f)} — removed
                colors/sizes discarded the difference. Re-add it if that was a mistake.
              </span>
            )}
          </p>
        </div>

        {/* Complete-the-look pairings: hand-picked, max 2 */}
        <div className="mt-6">
          <p className="flex items-center gap-2.5 text-[11px] font-normal tracking-[0.2em] text-black/60">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">5</span>
            GOES WELL WITH — PICK UP TO 2 ({f.pairs.length}/2)
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {all
              .filter((p) => p.id !== f.id)
              .map((p) => {
                const on = f.pairs.includes(p.id);
                const full = on || f.pairs.length < 2;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!full}
                    onClick={() =>
                      set({
                        pairs: on ? f.pairs.filter((x) => x !== p.id) : [...f.pairs, p.id].slice(0, 2),
                      })
                    }
                    className={`flex items-center gap-3 rounded-xl border bg-white p-2.5 text-left transition active:scale-[0.99] ${
                      on
                        ? 'border-black'
                        : full
                          ? 'border-black/10 hover:border-black'
                          : 'cursor-not-allowed border-black/10 opacity-40'
                    }`}
                  >
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${
                        on ? 'border-black bg-black text-white' : 'border-black/25 text-transparent'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    {p.variants[0]?.image && (
                      <img
                        src={p.variants[0].image}
                        alt={p.name}
                        className="h-12 w-10 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-normal tracking-[0.08em]">
                        {p.name}
                      </span>
                      <span className="text-[11px] tracking-wider text-black/50">
                        {formatEGP(p.price)} · {p.stock > 0 ? `${p.stock} in stock` : 'sold out'}
                      </span>
                    </span>
                  </button>
                );
              })}
          </div>
          <p className="mt-2 text-[11px] tracking-[0.06em] text-black/45">
            Shown on this product's page. Sold-out or deleted picks hide automatically — if none
            are available, the whole section hides itself.
          </p>
        </div>

        {err && <p className="mt-4 text-[12px] font-normal tracking-[0.1em] text-red-700">{err}</p>}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-black/20 py-4 text-[12px] font-normal tracking-[0.2em] transition hover:border-black"
          >
            CANCEL
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-[2] rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {saving ? 'SAVING…' : f.id ? 'SAVE CHANGES' : 'ADD PRODUCT'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Cross-tab quick actions: overview buttons set an intent that the target
   tab consumes on mount (tabs mount fresh on every switch). */
let adminIntent: { action: 'new-product' | 'new-invoice' | 'edit-product'; id?: string } | null = null;
function requestAdminIntent(action: NonNullable<typeof adminIntent>) {
  adminIntent = action;
}
function consumeAdminIntent(): typeof adminIntent {
  const a = adminIntent;
  adminIntent = null;
  return a;
}

type Tab = 'overview' | 'products' | 'categories' | 'homepage' | 'invoices';

const TABS: [Tab, string][] = [
  ['overview', 'OVERVIEW'],
  ['products', 'PRODUCTS'],
  ['categories', 'CATEGORIES'],
  ['homepage', 'HOMEPAGE'],
  ['invoices', 'INVOICES'],
];

const TAB_IDS: Tab[] = TABS.map(([id]) => id);

function isTab(v: string): v is Tab {
  return (TAB_IDS as string[]).includes(v);
}

/* Local calendar date (YYYY-MM-DD) — toISOString() is UTC and shows
   yesterday's date on Egyptian evenings (UTC+2/+3). */
function todayLocal(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function Admin() {
  // Server mode (database connected) → real username/password sessions.
  // Local mode (no backend yet) → the legacy device PIN.
  const [server, setServer] = useState<'checking' | 'on' | 'off'>('checking');
  const [serverUser, setServerUser] = useState<string | null>(null);
  const [authed, setAuthed] = useState(() => isUnlocked());

  useEffect(() => {
    let live = true;
    fetchAuthStatus().then(
      (s) => {
        if (!live) return;
        if (s.mode === 'server') {
          setServer('on');
          apiMe().then(
            (r) => live && setServerUser(r.owner.username),
            () => live && setServerUser(null),
          );
        } else {
          setServer('off');
        }
      },
      () => live && setServer('off'),
    );
    return () => {
      live = false;
    };
  }, []);

  if (server === 'checking') {
    return (
      <p className="mx-auto max-w-md px-6 py-24 text-center text-[12px] tracking-[0.24em] text-black/50">
        LOADING…
      </p>
    );
  }
  if (server === 'on') {
    if (!serverUser) return <ServerAuth onAuthed={(u) => setServerUser(u)} />;
    return (
      <Dashboard
        onLock={() => {
          apiLogout().catch(() => {});
          setServerUser(null);
        }}
      />
    );
  }
  if (!authed) return <PinGate onUnlock={() => setAuthed(true)} />;
  return <Dashboard onLock={() => { setUnlocked(false); setAuthed(false); }} />;
}

function Dashboard({ onLock }: { onLock: () => void }) {
  const products = useCatalogList();
  const refresh = useCatalogRefresh();
  const route = useRoute();
  const routeTab: Tab = route.view === 'admin' && isTab(route.tab) ? route.tab : 'overview';
  const [tab, setTab] = useState<Tab>(routeTab);

  // URL is the source of truth — back/forward buttons and shared links work.
  useEffect(() => {
    if (route.view === 'admin' && isTab(route.tab)) {
      setTab(route.tab);
    }
  }, [route]);

  const goTab = (t: Tab) => navigate(adminPath(t));

  // Auto-lock after 15 minutes without any interaction (shared devices).
  useEffect(() => {
    let t = 0;
    const kick = () => {
      window.clearTimeout(t);
      t = window.setTimeout(onLock, 15 * 60 * 1000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, kick, { passive: true }));
    kick();
    return () => {
      window.clearTimeout(t);
      events.forEach((e) => window.removeEventListener(e, kick));
    };
  }, [onLock]);

  return (
    <section className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-10">
      <ConfirmHost />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-normal tracking-[0.3em] text-black/50">PEARLIN · OWNER ONLY</p>
          <h1 className="font-display mt-1 text-4xl font-normal uppercase sm:text-5xl">Dashboard</h1>
          <p className="mt-1.5 text-[13px] tracking-[0.04em] text-black/50">
            Everything for your store, in one place — no code needed.
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/"
            className="rounded-full border border-black/20 px-5 py-2.5 text-[11px] font-normal tracking-[0.18em] transition hover:border-black"
          >
            VIEW STORE
          </a>
          <button
            onClick={onLock}
            className="rounded-full bg-black px-5 py-2.5 text-[11px] font-normal tracking-[0.18em] text-white transition hover:bg-neutral-800"
          >
            LOCK
          </button>
        </div>
      </div>

      <div className="no-scrollbar mt-7 flex gap-2.5 overflow-x-auto border-y border-black/10 py-4">
        {TABS.map(([id, label]) => (
          <a
            key={id}
            href={adminPath(id)}
            onClick={(e) => {
              e.preventDefault();
              goTab(id);
            }}
            className={`whitespace-nowrap rounded-full px-6 py-3 text-[11px] font-normal tracking-[0.2em] transition ${
              tab === id ? 'bg-black text-white' : 'bg-[#F4F4F4] hover:bg-black hover:text-white'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {tab === 'overview' && (
        <OverviewTab products={products} goTab={goTab} />
      )}
      {tab === 'products' && <ProductsTab products={products} refresh={refresh} />}
      {tab === 'categories' && <CategoriesTab refresh={refresh} />}
      {tab === 'homepage' && <HomepageTab />}
      {tab === 'invoices' && <InvoicesTab refresh={refresh} />}
    </section>
  );
}

/* ================= overview ================= */

function OverviewTab({
  products,
  goTab,
}: {
  products: Product[];
  goTab: (t: Tab) => void;
}) {
  const [invoices, setInvoices] = useState(() => getInvoices());
  const [pinA, setPinA] = useState('');
  const [pinB, setPinB] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [biz, setBiz] = useState<BizSettings>(() => getSettings());
  const [bizMsg, setBizMsg] = useState('');
  const [backupMsg, setBackupMsg] = useState('');
  const [backupBusy, setBackupBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExportBackup = async () => {
    setBackupMsg('');
    setBackupBusy(true);
    try {
      const { filename, url, sizeKb } = await exportBackup();
      const a = document.createElement('a');
      a.download = filename;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setBackupMsg(`Backup saved (${sizeKb} KB) — keep a copy off this device.`);
    } catch {
      setBackupMsg('Backup failed on this browser.');
    } finally {
      setBackupBusy(false);
    }
  };

  const doImportBackup = async (file: File | undefined) => {
    if (!file) return;
    setBackupMsg('');
    const proceed = await askConfirm({
      title: 'Restore backup?',
      message: 'EVERYTHING current (products, stock, invoices, settings) will be replaced.',
      confirmLabel: 'RESTORE',
      danger: true,
    });
    if (!proceed) {
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setBackupBusy(true);
    try {
      const parsed = JSON.parse(await file.text());
      await importBackup(parsed);
      setBackupMsg('Backup restored — reloading…');
      window.setTimeout(() => window.location.reload(), 800);
    } catch {
      setBackupMsg('That file is not a valid pearlin backup.');
      setBackupBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const revenue = invoices.reduce((s, i) => s + i.total, 0);
  const units = invoices.reduce((s, i) => s + i.items.reduce((a, l) => a + l.qty, 0), 0);
  const low = products.filter((p) => p.stock <= LOW_STOCK);

  const changePin = async () => {
    setPinMsg('');
    if (!(await checkPin(pinA.trim()))) return setPinMsg('Current password is wrong.');
    if (pinB.trim().length < 4) return setPinMsg('New password must be 4+ characters.');
    await setPin(pinB.trim());
    setPinA('');
    setPinB('');
    setPinMsg('Password changed.');
  };

  const stats: [string, string][] = [
    ['MONEY IN (INVOICES)', formatEGP(revenue)],
    ['INVOICES', String(invoices.length)],
    ['PIECES SOLD', String(units)],
    ['PRODUCTS IN STORE', String(products.length)],
  ];

  return (
    <div className="mt-8">
      <OwnerGuide />
      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => {
              requestAdminIntent({ action: 'new-invoice' });
              goTab('invoices');
            }}
            className="flex items-center justify-center gap-2.5 rounded-2xl bg-black py-5 text-[12px] font-normal tracking-[0.22em] text-white transition hover:bg-neutral-800"
          >
            <Receipt className="h-5 w-5" /> NEW INVOICE
          </button>
          <button
            onClick={() => {
              requestAdminIntent({ action: 'new-product' });
              goTab('products');
            }}
            className="flex items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-black/25 py-5 text-[12px] font-normal tracking-[0.22em] transition hover:border-black hover:bg-black hover:text-white"
          >
            <Plus className="h-5 w-5" /> ADD PRODUCT
          </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-[#0B0B0B] p-5 text-white sm:p-6">
            <p className="text-[10px] font-normal tracking-[0.2em] text-white/45">{label}</p>
            <p className="font-display mt-2 text-2xl font-normal sm:text-3xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-black/10 p-5 sm:p-6">
          <h3 className="text-[12px] font-normal tracking-[0.22em]">
            RUNNING LOW ({low.length})
          </h3>
          {low.length === 0 ? (
            <p className="mt-3 flex items-center gap-2 text-[13px] text-black/60">
              <Check className="h-4 w-4" /> Everything is stocked up.
            </p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {low.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl bg-[#F8F8F8] p-3">
                  <img src={p.variants[0]?.image} alt={p.name} className="h-12 w-10 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-normal tracking-[0.1em]">{p.name}</p>
                    <p className={`text-[11px] font-normal tracking-[0.12em] ${p.stock === 0 ? 'text-red-700' : 'text-black/55'}`}>
                      {p.stock === 0 ? 'SOLD OUT' : `${p.stock} LEFT`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      requestAdminIntent({ action: 'edit-product', id: p.id });
                      goTab('products');
                    }}
                    className="rounded-full bg-black px-4 py-2 text-[10px] font-normal tracking-[0.15em] text-white transition hover:bg-neutral-800"
                  >
                    MANAGE
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-black/10 p-5 sm:p-6">
          <h3 className="text-[12px] font-normal tracking-[0.22em]">CHANGE PASSWORD</h3>
          <input
            value={pinA}
            onChange={(e) => setPinA(e.target.value.slice(0, 16))}
            type="text"
            autoComplete="off"
            placeholder="Current password"
            className="mt-3 w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] font-normal tracking-[0.15em] outline-none focus:border-black"
          />
          <input
            value={pinB}
            onChange={(e) => setPinB(e.target.value.slice(0, 16))}
            type="text"
            autoComplete="off"
            placeholder="New password"
            className="mt-2.5 w-full rounded-xl border border-black/15 px-4 py-3 text-[15px] font-normal tracking-[0.15em] outline-none focus:border-black"
          />
          {pinMsg && <p className="mt-2 text-[12px] font-normal text-black/60">{pinMsg}</p>}
          <button
            onClick={changePin}
            className="mt-3 w-full rounded-full border border-black/20 py-3 text-[11px] font-normal tracking-[0.2em] transition hover:border-black hover:bg-black hover:text-white"
          >
            UPDATE PASSWORD
          </button>
          <button
            onClick={() => setInvoices(getInvoices())}
            className="mt-2 w-full py-2 text-[11px] tracking-[0.15em] text-black/45 underline-offset-4 hover:text-black hover:underline"
          >
            Refresh invoice stats
          </button>
        </div>

        <div className="rounded-2xl border border-black/10 p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-[12px] font-normal tracking-[0.22em]">BACKUP & RESTORE</h3>
          <p className="mt-1.5 text-[12px] leading-relaxed tracking-[0.04em] text-black/55">
            All dashboard data lives in this browser. Export a backup file regularly and keep a
            copy elsewhere — restores products, stock, photos, invoices and settings.
          </p>
          {backupMsg && <p className="mt-2 text-[12px] font-normal text-black/70">{backupMsg}</p>}
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={doExportBackup}
              disabled={backupBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-black py-3.5 text-[11px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4" /> {backupBusy ? 'WORKING…' : 'EXPORT BACKUP'}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={backupBusy}
              className="flex-1 rounded-full border border-black/20 py-3.5 text-[11px] font-normal tracking-[0.2em] transition hover:border-black hover:bg-black hover:text-white disabled:opacity-50"
            >
              RESTORE FROM FILE
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => doImportBackup(e.target.files?.[0])}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 p-5 sm:p-6 lg:col-span-2">
          <h3 className="text-[12px] font-normal tracking-[0.22em]">
            BUSINESS INFO — PRINTED ON EVERY INVOICE
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">ADDRESS</label>
              <input
                value={biz.address}
                onChange={(e) => setBiz({ ...biz, address: e.target.value })}
                placeholder="Cairo, Egypt"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                DEFAULT PAYMENT METHOD
              </label>
              <input
                value={biz.paymentDefault}
                onChange={(e) => setBiz({ ...biz, paymentDefault: e.target.value })}
                placeholder="Online transfer"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                TERMS LINE (INVOICE FOOTER)
              </label>
              <input
                value={biz.terms}
                onChange={(e) => setBiz({ ...biz, terms: e.target.value })}
                placeholder="Payment due on receipt…"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                WHATSAPP NUMBER (ORDERS GO HERE)
              </label>
              <input
                value={biz.whatsapp}
                onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value.replace(/[^\d+\s]/g, '') })}
                inputMode="tel"
                placeholder="0120… or 20120…"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                INSTAGRAM URL
              </label>
              <input
                value={biz.instagram}
                onChange={(e) => setBiz({ ...biz, instagram: e.target.value })}
                placeholder="https://instagram.com/…"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                TIKTOK URL
              </label>
              <input
                value={biz.tiktok}
                onChange={(e) => setBiz({ ...biz, tiktok: e.target.value })}
                placeholder="https://tiktok.com/…"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                SHIPPING FEE (EGP, ALL GOVERNORATES)
              </label>
              <input
                value={String(biz.shippingFee)}
                onChange={(e) => setBiz({ ...biz, shippingFee: Number(onlyDigits(e.target.value)) || 0 })}
                inputMode="numeric"
                className="w-full rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60">
                PROMO CODE
              </label>
              <div className="flex gap-2">
                <input
                  value={biz.promoCode}
                  onChange={(e) => setBiz({ ...biz, promoCode: e.target.value.toUpperCase().slice(0, 16) })}
                  placeholder="PEARLIN10"
                  className="min-w-0 flex-[2] rounded-xl border border-black/15 px-4 py-3 text-[13px] outline-none focus:border-black"
                />
                <div className="flex min-w-0 flex-1 items-center rounded-xl border border-black/15 bg-white px-3 transition focus-within:border-black">
                  <input
                    value={String(biz.promoPercent)}
                    onChange={(e) => setBiz({ ...biz, promoPercent: Number(onlyDigits(e.target.value, 3)) || 0 })}
                    inputMode="numeric"
                    placeholder="10"
                    title="Discount percent — just type the number"
                    className="min-w-0 flex-1 bg-transparent py-3 text-center text-[13px] font-normal outline-none"
                  />
                  <span className="shrink-0 text-[13px] font-normal text-black">%</span>
                </div>
                <button
                  onClick={() => setBiz({ ...biz, promoEnabled: !biz.promoEnabled })}
                  className={`shrink-0 rounded-full px-5 text-[11px] font-normal tracking-[0.15em] transition ${
                    biz.promoEnabled ? 'bg-black text-white' : 'border border-black/20 text-black/50'
                  }`}
                >
                  {biz.promoEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] tracking-[0.06em] text-black/45">
                Shown on the site — you apply the discount manually on WhatsApp.
              </p>
            </div>
          </div>
          {bizMsg && <p className="mt-2 text-[12px] font-normal text-black/60">{bizMsg}</p>}
          <button
            onClick={() => {
              const clean = { ...biz, whatsapp: normalizeWhatsapp(biz.whatsapp) };
              saveSettings(clean);
              setBiz(clean);
              setBizMsg('Business info saved — new invoices will use it.');
            }}
            className="mt-3 w-full rounded-full bg-black py-3.5 text-[11px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 sm:w-auto sm:px-10"
          >
            SAVE BUSINESS INFO
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= categories ================= */

function CategoriesTab({ refresh }: { refresh: () => Promise<void> }) {
  const [cats, setCats] = useState(() => getCategories());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const [neu, setNeu] = useState('');

  useEffect(() => {
    const m: Record<string, number> = {};
    for (const p of mergeCatalogSafe()) m[p.category] = (m[p.category] ?? 0) + 1;
    setCounts(m);
  }, [cats]);

  const save = async () => {
    setCats(getCategories());
    setLabels({});
    setMsg('');
    await refresh();
  };

  const doAdd = async () => {
    setMsg('');
    const c = addCategory(neu);
    if (!c) return setMsg('Type a category name first.');
    setNeu('');
    await save();
  };

  const doRename = async (id: string) => {
    const v = (labels[id] ?? '').trim();
    if (!v) return;
    renameCategory(id, v);
    await save();
  };

  const doDelete = async (id: string, label: string) => {
    setMsg('');
    const yes = await askConfirm({
      title: 'Delete category?',
      message: `Remove “${label}” from the store?`,
      confirmLabel: 'DELETE',
      danger: true,
    });
    if (!yes) return;
    const r = deleteCategory(id);
    if (!r.ok) {
      setMsg(
        `Cannot delete “${label}” — ${r.count} product${r.count > 1 ? 's' : ''} still use it. Move them to another category first.`,
      );
      return;
    }
    await save();
  };

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doAdd()}
          placeholder="New category name (e.g. DRESSES)"
          className="flex-1 rounded-2xl border border-black/15 px-5 py-4 text-[13px] font-normal tracking-[0.1em] outline-none placeholder:font-normal placeholder:text-black/35 focus:border-black"
        />
        <button
          onClick={doAdd}
          className="flex items-center justify-center gap-2 rounded-2xl bg-black px-8 py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800"
        >
          <Plus className="h-4 w-4" /> ADD
        </button>
      </div>
      {msg && <p className="mt-3 text-[12px] font-normal tracking-[0.08em] text-red-700">{msg}</p>}

      <ul className="mt-5 space-y-3">
        {cats.map((c) => (
          <li
            key={c.id}
            className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex gap-2">
                <input
                  value={labels[c.id] ?? c.label}
                  onChange={(e) => setLabels((m) => ({ ...m, [c.id]: e.target.value.toUpperCase() }))}
                  className="min-w-0 flex-1 rounded-xl border border-black/15 bg-[#F8F8F8] px-4 py-2.5 text-[13px] font-normal tracking-[0.1em] outline-none focus:border-black"
                />
                <button
                  onClick={() => doRename(c.id)}
                  disabled={(labels[c.id] ?? c.label) === c.label}
                  className="shrink-0 rounded-full bg-black px-6 py-2.5 text-[11px] font-normal tracking-[0.18em] text-white transition hover:bg-neutral-800 disabled:opacity-30"
                >
                  SAVE
                </button>
              </div>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] tracking-[0.12em] text-black/45">
                <span>
                  Link: <span className="font-normal text-black/70">#/shop/{c.id}</span> ·{' '}
                  {counts[c.id] ?? 0} product{(counts[c.id] ?? 0) === 1 ? '' : 's'}
                </span>
                <a
                  href={`#/shop/${c.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-normal text-black underline underline-offset-4 hover:opacity-70"
                >
                  OPEN <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </div>
            <button
              onClick={() => doDelete(c.id, c.label)}
              aria-label={`Delete ${c.label}`}
              className="self-start rounded-full border border-black/20 p-2.5 text-black/50 transition hover:border-red-700 hover:bg-red-700 hover:text-white sm:self-center"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed tracking-[0.06em] text-black/45">
        Renaming updates the whole site instantly (chips, footer, titles). IDs stay fixed so shared
        links never break. A category can only be deleted when no products use it.
      </p>
    </div>
  );
}

// mergeCatalog without image work — just counts.

/* ================= homepage merchandising ================= */

function HomepageTab() {
  const products = useCatalogList();
  const [home, setHome] = useState(() => getHome());
  const [msg, setMsg] = useState('');

  const persist = (h: typeof home) => {
    setHome(h);
    saveHome(h);
    setMsg('Homepage updated — it’s live on the store now.');
    window.clearTimeout((persist as unknown as { _t?: number })._t);
    (persist as unknown as { _t?: number })._t = window.setTimeout(() => setMsg(''), 2500);
  };

  const setSlide = (i: number, productId: string, variant?: string) => {
    const hero = home.hero.map((s, j) => {
      if (j !== i) return s;
      const p = products.find((x) => x.id === productId);
      const v = variant ?? p?.variants[0]?.name ?? '';
      return { productId, variant: v };
    });
    persist({ ...home, hero });
  };

  return (
    <div className="mt-8 space-y-4">
      {msg && (
        <p className="rounded-xl bg-black px-4 py-3 text-center text-[12px] font-normal tracking-[0.08em] text-white">
          {msg}
        </p>
      )}

      {/* Hero slides */}
      <div className="rounded-2xl border border-black/10 p-5 sm:p-6">
        <h3 className="text-[12px] font-normal tracking-[0.22em]">HERO SLIDER (3 SLOTS)</h3>
        <p className="mt-1 text-[12px] tracking-[0.06em] text-black/50">
          Pick the product — and its color — shown in each hero slide.
        </p>
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => {
            const slot = home.hero[i] ?? { productId: '', variant: '' };
            const p = products.find((x) => x.id === slot.productId);
            return (
              <div key={i} className="flex flex-col gap-2.5 rounded-2xl bg-[#F8F8F8] p-3 sm:flex-row sm:items-center">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black text-[12px] font-normal text-white">
                  {i + 1}
                </span>
                {p && (
                  <img
                    src={
                      p.variants.find((v) => v.name === slot.variant)?.image ??
                      p.variants[0]?.image
                    }
                    alt={p.name}
                    className="h-16 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <Dropdown
                  value={slot.productId}
                  onChange={(id) => setSlide(i, id)}
                  label={`Hero slide ${i + 1} product`}
                  variant="field"
                  className="min-w-0 flex-[2]"
                  options={products.map((x) => ({ value: x.id, label: x.name }))}
                />
                <Dropdown
                  value={slot.variant}
                  onChange={(v) => setSlide(i, slot.productId, v)}
                  label={`Hero slide ${i + 1} color`}
                  variant="field"
                  className="min-w-0 flex-1"
                  options={(p?.variants ?? []).map((v) => ({ value: v.name, label: v.name }))}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto rules */}
      <div className="rounded-2xl bg-[#0B0B0B] p-5 text-white sm:p-6">
        <h3 className="text-[12px] font-normal tracking-[0.22em] text-white/60">AUTOMATIC SECTIONS</h3>
        <ul className="mt-3 space-y-2 text-[13px] leading-relaxed tracking-[0.04em] text-white/75">
          <li>
            <b className="text-white">New Arrivals</b> — always the 5 most recently added
            products, by date added. Add a product and it jumps to the front.
          </li>
          <li>
            <b className="text-white">Bestsellers</b> — always the 4 highest-selling products, by
            units sold. Every invoice re-ranks them automatically.
          </li>
        </ul>
      </div>
    </div>
  );
}

/* ================= products ================= */

function ProductsTab({ products, refresh }: { products: Product[]; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<FormState | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    const intent = consumeAdminIntent();
    if (intent?.action === 'new-product') setEditing(blankForm());
    else if (intent?.action === 'edit-product' && intent.id) {
      const p = products.find((x) => x.id === intent.id);
      if (p) setEditing(draftFromProduct(p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle),
    );
  }, [products, q]);

  const remove = async (p: Product) => {
    const yes = await askConfirm({
      title: 'Delete product?',
      message: `Remove “${p.name}” from the store? This cannot be undone.`,
      confirmLabel: 'DELETE',
      danger: true,
    });
    if (!yes) return;
    await deleteProduct(p.id);
    await refresh();
  };

  return (
    <div className="mt-8">
      <button
        onClick={() => setEditing(blankForm())}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/20 py-5 text-[12px] font-normal tracking-[0.22em] transition hover:border-black hover:bg-black hover:text-white sm:w-auto sm:px-10"
      >
        <Plus className="h-4 w-4" /> ADD NEW PRODUCT
      </button>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products…"
          className="w-full rounded-2xl border border-black/10 bg-[#F8F8F8] py-3.5 pl-11 pr-4 text-[13px] outline-none placeholder:text-black/35 focus:border-black"
        />
      </div>

      {visible.length === 0 ? (
        <p className="py-10 text-center text-[12px] tracking-[0.15em] text-black/45">
          No products match “{q}”.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {visible.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
          >
            <img
              src={p.variants[0]?.image}
              alt={p.name}
              className="h-28 w-24 shrink-0 rounded-xl bg-[#F4F4F4] object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-normal tracking-[0.12em]">{p.name}</p>
              <p className="mt-1 text-[12px] tracking-wider text-black/55">
                {formatEGP(p.price)} · {p.category.toUpperCase()} · {p.variants.length} color
                {p.variants.length > 1 ? 's' : ''} · {p.sold}+ sold
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
                <span className="rounded-full bg-black px-4 py-1.5 text-[11px] font-normal tracking-[0.15em] text-white">
                  IN STOCK: {p.stock} {p.stock === 1 ? 'PIECE' : 'PIECES'}
                </span>
                {p.stock <= LOW_STOCK && (
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-normal tracking-[0.15em] ${
                      p.stock === 0 ? 'bg-red-700 text-white' : 'border border-black/25 text-black/60'
                    }`}
                  >
                    {p.stock === 0 ? 'SOLD OUT' : `ONLY ${p.stock} LEFT`}
                  </span>
                )}
                <span className="text-[11px] tracking-[0.1em] text-black/40">
                  Tap EDIT to change colors, sizes & pieces
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <a
                href={`#/product/${p.id}`}
                target="_blank"
                rel="noreferrer"
                title="Preview on store (new tab)"
                className="inline-flex items-center gap-1.5 rounded-full border border-black/20 px-5 py-2.5 text-[11px] font-normal tracking-[0.18em] transition hover:border-black hover:bg-black hover:text-white"
              >
                VIEW <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setEditing(draftFromProduct(p))}
                className="flex-1 rounded-full border border-black/20 px-6 py-2.5 text-[11px] font-normal tracking-[0.18em] transition hover:border-black hover:bg-black hover:text-white sm:flex-none"
              >
                EDIT
              </button>
              <button
                onClick={() => remove(p)}
                aria-label={`Delete ${p.name}`}
                className="rounded-full border border-black/20 p-2.5 text-black/50 transition hover:border-red-700 hover:bg-red-700 hover:text-white"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
        </ul>
      )}

      {editing && (
        <ProductEditor
          initial={editing}
          all={products}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}

/* ================= invoices ================= */

type LineDraft = { productId: string; variant: string; size: string; qty: number };

function InvoicesTab({ refresh }: { refresh: () => Promise<void> }) {
  const products = useCatalogList();
  const [invoices, setInvoices] = useState<Invoice[]>(() => getInvoices());
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);

  // builder state
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [pick, setPick] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerCity, setBuyerCity] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [date, setDate] = useState(() => todayLocal());
  const [notes, setNotes] = useState('');
  const [shipping, setShipping] = useState(() => String(defaultShipping()));
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState(() => getSettings().paymentDefault);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState<Invoice | null>(null);
  const [exportErr, setExportErr] = useState('');
  const [exportOk, setExportOk] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');

  const visibleInvoices = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return invoices;
    const digits = needle.replace(/\D/g, '');
    return invoices.filter(
      (inv) =>
        inv.number.toLowerCase().includes(needle) ||
        inv.buyerName.toLowerCase().includes(needle) ||
        (digits ? inv.buyerPhone.replace(/\D/g, '').includes(digits) : false),
    );
  }, [invoices, q]);

  const doExport = async (inv: Invoice) => {
    if (busy) return;
    setExportErr('');
    setExportOk('');
    setBusy(true);
    // Drawn pixel-by-pixel on canvas (not cloned from DOM) — deterministic output.
    const thumbs = new Map<string, string | undefined>();
    for (const p of products)
      for (const v of p.variants) thumbs.set(`${p.id}|${v.name}`, v.image);
    try {
      const blob = await renderInvoicePng(inv, thumbs);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.download = `pearlin-invoice-${inv.number}.png`;
      a.href = url;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setExportOk(`Invoice ${inv.number} saved — check your downloads.`);
    } catch {
      setExportErr(
        'Image export failed on this browser — try Chrome, or take a screenshot of the invoice.',
      );
    } finally {
      setBusy(false);
    }
  };

  const resetBuilder = () => {
    setLines([]);
    setPick('');
    setBuyerName('');
    setBuyerPhone('');
    setBuyerCity('');
    setBuyerAddress('');
    setDate(todayLocal());
    setNotes('');
    setShipping(String(defaultShipping()));
    setDiscount('0');
    setPaymentMethod(getSettings().paymentDefault);
    setErr('');
    setSaved(null);
  };

  useEffect(() => {
    if (consumeAdminIntent()?.action === 'new-invoice') {
      resetBuilder();
      setCreating(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLine = () => {
    const p = products.find((x) => x.id === pick);
    if (!p) return;
    if (p.stock <= 0) {
      setErr(`“${p.name}” is out of stock — restock it in PRODUCTS first.`);
      return;
    }
    const szs = p.sizes.length > 0 ? p.sizes : [...SIZES];
    const v0 = p.variants[0]?.name ?? '';
    const first = szs.find((s) => cellQty(p, v0, s) > 0) ?? szs[0] ?? 'M';
    setErr('');
    setLines((ls) => [...ls, { productId: p.id, variant: v0, size: first, qty: 1 }]);
    setPick('');
  };

  /** All sizes always listed with live counts — the list can never look empty.
      Zero-stock sizes are visible but not selectable. */
  const sizeOptions = (p: Product, variant: string) => {
    const szs = p.sizes.length > 0 ? p.sizes : [...SIZES];
    return {
      options: szs.map((s) => ({ value: s, label: `${s} (${cellQty(p, variant, s)} left)` })),
      disabled: szs.filter((s) => cellQty(p, variant, s) <= 0),
    };
  };

  const setLineVariant = (i: number, v: string) => {
    setLines((ls) =>
      ls.map((x, j) => {
        if (j !== i) return x;
        const p = products.find((y) => y.id === x.productId);
        const szs = p && p.sizes.length > 0 ? p.sizes : [...SIZES];
        const keep =
          p && cellQty(p, v, x.size) > 0
            ? x.size
            : (p ? szs.find((s) => cellQty(p, v, s) > 0) : undefined) ?? x.size;
        return { ...x, variant: v, size: keep };
      }),
    );
  };

  const lineTotal = (l: LineDraft) => {
    const p = products.find((x) => x.id === l.productId);
    return (p?.price ?? 0) * l.qty;
  };
  const subtotal = lines.reduce((s, l) => s + lineTotal(l), 0);
  const ship = Math.max(0, Number(shipping) || 0);
  const totals = calcTotals(subtotal, Number(discount) || 0, ship);

  const save = async () => {
    setErr('');
    if (lines.length === 0) return setErr('Add at least one item to the invoice.');
    if (!buyerName.trim()) return setErr('Buyer name is required.');
    if (normalizeDigits(buyerPhone).replace(/\D/g, '').length < 8)
      return setErr('Enter a valid buyer phone number.');
    // Smart guard: no line may exceed its exact cell stock.
    for (const l of lines) {
      const p = products.find((x) => x.id === l.productId);
      const have = p ? cellQty(p, l.variant, l.size) : 0;
      if (l.qty > have)
        return setErr(
          `Only ${have} left of ${p?.name ?? 'item'} (${l.variant} / ${l.size}) — lower the quantity.`,
        );
    }
    const inv = saveInvoice({
      createdAt: new Date(date || Date.now()).toISOString(),
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      buyerCity: buyerCity.trim(),
      buyerAddress: buyerAddress.trim(),
      notes: notes.trim(),
      paymentMethod: paymentMethod.trim() || getSettings().paymentDefault,
      items: lines.map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return {
          productId: p.id,
          name: p.name,
          variant: l.variant,
          size: l.size,
          qty: l.qty,
          price: p.price,
        };
      }),
      subtotal,
      discount: totals.discount,
      shipping: ship,
      total: totals.total,
    });
    await refresh();
    setInvoices(getInvoices());
    setSaved(inv);
  };

  const removeInvoice = async (inv: Invoice) => {
    const yes = await askConfirm({
      title: `Delete ${inv.number}?`,
      message: 'Its pieces go back to stock. This cannot be undone.',
      confirmLabel: 'DELETE INVOICE',
      danger: true,
    });
    if (!yes) return;
    voidInvoice(inv.id);
    setInvoices(getInvoices());
    await refresh();
    if (detail?.id === inv.id) setDetail(null);
  };

  /** Repeat customer? Prefill the builder from an old invoice (new number on save). */
  const duplicateInvoice = (inv: Invoice) => {
    resetBuilder();
    setLines(
      inv.items.map((l) => ({ productId: l.productId, variant: l.variant, size: l.size, qty: l.qty })),
    );
    setBuyerName(inv.buyerName);
    setBuyerPhone(inv.buyerPhone);
    setBuyerCity(inv.buyerCity ?? '');
    setBuyerAddress(inv.buyerAddress ?? '');
    setDate(todayLocal());
    setNotes(inv.notes);
    setShipping(String(inv.shipping));
    setDiscount(String(inv.discount ?? 0));
    setPaymentMethod(inv.paymentMethod || getSettings().paymentDefault);
    setDetail(null);
    setCreating(true);
  };

  const input =
    'w-full rounded-xl border border-black/15 bg-white px-4 py-3 text-[16px] outline-none placeholder:text-black/35 focus:border-black sm:text-[13px]';
  const label = 'mb-1.5 block text-[11px] font-normal tracking-[0.2em] text-black/60';

  if (detail) {
    return (
      <div className="mt-8">
        <button
          onClick={() => setDetail(null)}
          className="flex items-center gap-1.5 text-[12px] font-normal tracking-[0.2em] text-black/60 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> ALL INVOICES
        </button>
        <FitInvoice invoice={detail} />
        {exportErr && (
          <p className="mt-3 text-[12px] font-normal tracking-[0.08em] text-red-700">{exportErr}</p>
        )}
        {exportOk && (
          <p className="mt-3 rounded-xl bg-black px-4 py-3 text-center text-[12px] font-normal tracking-[0.08em] text-white">
            {exportOk}
          </p>
        )}
        <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
          <button
            onClick={() => doExport(detail)}
            disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> {busy ? 'PREPARING…' : 'SAVE AS IMAGE (PNG)'}
          </button>
          <button
            onClick={() => removeInvoice(detail)}
            className="flex items-center justify-center gap-2 rounded-full border border-black/20 px-8 py-4 text-[12px] font-normal tracking-[0.2em] transition hover:border-red-700 hover:bg-red-700 hover:text-white"
          >
            <Trash2 className="h-4 w-4" /> DELETE
          </button>
        </div>
      </div>
    );
  }

  if (creating || saved) {
    const preview: Invoice = saved ?? {
      id: 'draft',
      number: peekInvoiceNumber(),
      createdAt: new Date(date || Date.now()).toISOString(),
      buyerName: buyerName || '—',
      buyerPhone,
      buyerCity,
      buyerAddress,
      notes,
      paymentMethod: paymentMethod || getSettings().paymentDefault,
      items: lines.map((l) => {
        const p = products.find((x) => x.id === l.productId)!;
        return { productId: p.id, name: p.name, variant: l.variant, size: l.size, qty: l.qty, price: p.price };
      }),
      subtotal,
      discount: totals.discount,
      shipping: ship,
      total: totals.total,
    };
    return (
      <div className="mt-8">
        <button
          onClick={() => {
            setCreating(false);
            resetBuilder();
          }}
          className="flex items-center gap-1.5 text-[12px] font-normal tracking-[0.2em] text-black/60 hover:text-black"
        >
          <ArrowLeft className="h-4 w-4" /> {saved ? 'ALL INVOICES' : 'CANCEL'}
        </button>

        {saved ? (
          <div className="mt-4 rounded-2xl bg-black p-5 text-white sm:p-6">
            <p className="flex items-center gap-2 text-[13px] font-normal tracking-[0.15em]">
              <Check className="h-5 w-5" /> INVOICE {saved.number} SAVED — STOCK UPDATED
            </p>
            <p className="mt-1 text-[12px] tracking-[0.08em] text-white/60">
              {saved.buyerName} · {formatEGP(saved.total)} · download it as an image:
            </p>
          </div>
        ) : (
          <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-2xl border border-black/10 p-5 sm:p-6">
              <h3 className="flex items-center gap-2.5 text-[12px] font-normal tracking-[0.22em]">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">1</span>
                ITEMS
              </h3>
              <div className="mt-3 flex gap-2">
                <Dropdown
                  value={pick}
                  onChange={setPick}
                  label="Pick a product"
                  variant="field"
                  className="min-w-0 flex-1"
                  options={[
                    { value: '', label: 'Pick a product…' },
                    ...products.map((p) => ({
                      value: p.id,
                      label: `${p.name} — ${formatEGP(p.price)} (stock ${p.stock})`,
                    })),
                  ]}
                />
                <button
                  onClick={addLine}
                  disabled={!pick}
                  aria-label="Add item"
                  className="grid w-12 shrink-0 place-items-center rounded-xl bg-black text-white transition hover:bg-neutral-800 disabled:opacity-40"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <ul className="mt-3 space-y-2.5">
                {lines.map((l, i) => {
                  const p = products.find((x) => x.id === l.productId)!;
                  const max = Math.max(0, cellQty(p, l.variant, l.size));
                  return (
                    <li key={i} className="rounded-xl bg-[#F8F8F8] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12px] font-normal tracking-[0.08em]">{p.name}</p>
                        <button
                          onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                          aria-label="Remove item"
                          className="rounded-full p-1.5 text-black/40 hover:text-black"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <Dropdown
                          value={l.variant}
                          onChange={(v) => setLineVariant(i, v)}
                          label="Color"
                          variant="compact"
                          className="min-w-0"
                          options={p.variants.map((v) => ({
                            value: v.name,
                            label: `${v.name} (${p.sizes.reduce((a, s) => a + cellQty(p, v.name, s), 0)})`,
                          }))}
                        />
                        <Dropdown
                          value={l.size}
                          onChange={(v) =>
                            setLines((ls) =>
                              ls.map((x, j) =>
                                j === i ? { ...x, size: v, qty: Math.min(x.qty, Math.max(1, cellQty(p, l.variant, v))) } : x,
                              ),
                            )
                          }
                          label="Size"
                          variant="compact"
                          className="min-w-0"
                          options={sizeOptions(p, l.variant).options}
                          disabledValues={sizeOptions(p, l.variant).disabled}
                        />
                        <div
                          className="flex items-center justify-between rounded-lg border border-black/15 bg-white px-2"
                          title={`Max ${max} in stock`}
                        >
                          <button
                            onClick={() =>
                              setLines((ls) =>
                                ls.map((x, j) => (j === i ? { ...x, qty: Math.max(1, x.qty - 1) } : x)),
                              )
                            }
                            className="p-1 disabled:opacity-30"
                            aria-label="Decrease"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="text-center text-[12px] font-normal">
                            {l.qty}
                            <span className="block text-[9px] font-normal text-black/45">max {max}</span>
                          </span>
                          <button
                            onClick={() =>
                              setLines((ls) =>
                                ls.map((x, j) => (j === i ? { ...x, qty: Math.min(max, x.qty + 1) } : x)),
                              )
                            }
                            disabled={l.qty >= max}
                            className="p-1 disabled:opacity-30"
                            aria-label="Increase"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 text-right text-[12px] font-normal">
                        {formatEGP(lineTotal(l))}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <h3 className="mt-6 flex items-center gap-2.5 text-[12px] font-normal tracking-[0.22em]">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">2</span>
                BUYER & PAYMENT
              </h3>
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div>
                  <label className={label}>BUYER NAME</label>
                  <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Buyer name" className={input} />
                </div>
                <div>
                  <label className={label}>PHONE</label>
                  <input value={buyerPhone} onChange={(e) => setBuyerPhone(onlyPhoneChars(e.target.value))} inputMode="tel" placeholder="01xxxxxxxxx" className={input} />
                </div>
                <div>
                  <label className={label}>CITY / GOVERNORATE</label>
                  <input value={buyerCity} onChange={(e) => setBuyerCity(e.target.value)} placeholder="Cairo, Giza, Alex…" className={input} />
                </div>
                <div>
                  <label className={label}>ADDRESS (STREET / AREA)</label>
                  <input value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} placeholder="Street, landmark…" className={input} />
                </div>
                <div>
                  <label className={label}>ISSUE DATE</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} />
                </div>
                <div>
                  <label className={label}>PAYMENT METHOD</label>
                  <input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} placeholder="Online transfer" className={input} />
                </div>
                <div>
                  <label className={label}>SHIPPING (EGP)</label>
                  <input value={shipping} onChange={(e) => setShipping(onlyDigits(e.target.value))} inputMode="numeric" className={input} />
                </div>
                <div>
                  <label className={label}>DISCOUNT (EGP)</label>
                  <input value={discount} onChange={(e) => setDiscount(onlyDigits(e.target.value))} inputMode="numeric" placeholder="0" className={input} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label}>NOTES (OPTIONAL)</label>
                  <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the buyer should know…" className={input} />
                </div>
              </div>

              {err && <p className="mt-3 text-[12px] font-normal tracking-[0.1em] text-red-700">{err}</p>}
              <h3 className="mt-5 flex items-center gap-2.5 text-[12px] font-normal tracking-[0.22em]">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-[11px] text-white">3</span>
                REVIEW & SAVE
              </h3>
              <button
                onClick={save}
                className="mt-4 w-full rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.22em] text-white transition hover:bg-neutral-800"
              >
                SAVE INVOICE — {formatEGP(totals.total)}
              </button>
              <p className="mt-2 text-center text-[11px] tracking-[0.08em] text-black/45">
                Saving decrements stock automatically.
              </p>
            </div>

            <div className="min-w-0">
              <p className="mb-2 text-[11px] font-normal tracking-[0.2em] text-black/55">
                LIVE PREVIEW ({preview.number})
              </p>
              <FitInvoice invoice={preview} />
            </div>
          </div>
        )}

        {saved && (
          <div className="mt-4">
            <FitInvoice invoice={saved} />
            {exportErr && (
              <p className="mt-3 text-[12px] font-normal tracking-[0.08em] text-red-700">{exportErr}</p>
            )}
            {exportOk && (
              <p className="mt-3 rounded-xl bg-black px-4 py-3 text-center text-[12px] font-normal tracking-[0.08em] text-white">
                {exportOk}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => doExport(saved)}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-full bg-black py-4 text-[12px] font-normal tracking-[0.2em] text-white transition hover:bg-neutral-800 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> {busy ? 'PREPARING…' : 'SAVE AS IMAGE (PNG)'}
              </button>
              <button
                onClick={() => {
                  resetBuilder();
                  setCreating(true);
                  setInvoices(getInvoices());
                }}
                className="rounded-full border border-black/20 px-8 py-4 text-[12px] font-normal tracking-[0.2em] transition hover:border-black hover:bg-black hover:text-white"
              >
                NEW INVOICE
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <button
        onClick={() => {
          resetBuilder();
          setCreating(true);
        }}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/20 py-5 text-[12px] font-normal tracking-[0.22em] transition hover:border-black hover:bg-black hover:text-white sm:w-auto sm:px-10"
      >
        <Plus className="h-4 w-4" /> NEW INVOICE
      </button>

      {invoices.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <FileText className="h-10 w-10 text-black/15" />
          <p className="mt-4 text-[13px] font-normal tracking-[0.2em]">NO INVOICES YET</p>
          <p className="mt-1 max-w-xs text-[12px] tracking-wider text-black/50">
            Create your first invoice — stock decrements automatically on save.
          </p>
        </div>
      ) : (
        <>
          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-black/35" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by buyer, number or phone…"
              className="w-full rounded-2xl border border-black/10 bg-[#F8F8F8] py-3.5 pl-11 pr-4 text-[13px] outline-none placeholder:text-black/35 focus:border-black"
            />
          </div>
          {visibleInvoices.length === 0 ? (
            <p className="py-10 text-center text-[12px] tracking-[0.15em] text-black/45">
              No invoices match “{q}”.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {visibleInvoices.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-4 sm:flex-row sm:items-center sm:p-5"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black text-white">
                <Receipt className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-normal tracking-[0.12em]">
                  {inv.number} · {formatEGP(inv.total)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12px] tracking-wide text-black/55">
                  <span className="flex items-center gap-1">
                    <User className="h-3.5 w-3.5" /> {inv.buyerName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {inv.buyerPhone}
                  </span>
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" />{' '}
                    {new Date(inv.createdAt).toLocaleDateString('en-GB')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />{' '}
                    {inv.items.reduce((s, l) => s + l.qty, 0)} pcs
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setDetail(inv)}
                  className="rounded-full border border-black/20 px-6 py-2.5 text-[11px] font-normal tracking-[0.18em] transition hover:border-black hover:bg-black hover:text-white"
                >
                  VIEW
                </button>
                <button
                  onClick={() => duplicateInvoice(inv)}
                  title="New invoice prefilled from this one"
                  className="rounded-full border border-black/20 px-6 py-2.5 text-[11px] font-normal tracking-[0.18em] transition hover:border-black hover:bg-black hover:text-white"
                >
                  COPY
                </button>
                <button
                  onClick={() => removeInvoice(inv)}
                  aria-label={`Void ${inv.number}`}
                  className="rounded-full border border-black/20 p-2.5 text-black/50 transition hover:border-red-700 hover:bg-red-700 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
            </ul>
          )}
        </>
      )}

      <div className="mt-6 flex items-center gap-2 rounded-2xl bg-[#F8F8F8] p-4 text-[12px] tracking-[0.08em] text-black/55">
        <BadgeDollarSign className="h-4 w-4 shrink-0 text-black" />
        Total invoiced so far: <span className="font-normal text-black">{formatEGP(invoices.reduce((s, i) => s + i.total, 0))}</span>
      </div>
    </div>
  );
}
