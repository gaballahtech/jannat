# jannat — Owner manual (`/admin`)

Open `/admin`, enter your dashboard password (created on first visit).
Everything below needs no code. Data lives in **this browser** until the
database backend is connected — export a backup after every change day.

## The 5 tabs

| Tab | Use it for |
|---|---|
| Overview | Revenue/units at a glance, shop settings (WhatsApp number, shipping fee, promo), password change, **Export/Import backup** |
| Products | Add/edit products: name, price, colors + photos, sizes, per-color×size stock, "complete the look" picks |
| Categories | Add/rename/delete shelves (hoodies, jackets, …). Deleting a used category is blocked — move its products first |
| Homepage | The 3 hero slides: pick product + color per slot |
| Invoices | Build an invoice per WhatsApp order: buyer, lines from the live catalog, discount/shipping → Save (decrements stock), PNG export, Void restores stock |

## Daily flow

1. Order arrives on WhatsApp → **Invoices → New** → pick buyer + lines → Save.
2. Stock drops automatically. Low stock (≤ 5) shows `ONLY X LEFT` on the site.
3. New photos upload to Cloudinary as compressed WebP when `VITE_CLOUDINARY_*`
   is set (see `.env.example`); otherwise they stay on this device only
   (`JANNAT` placeholder elsewhere).

## Files (for the developer)

```
src/components/Admin.tsx            shell: auth, tabs, Dashboard, Overview/Products/
                                    Categories/Homepage/Invoices tabs, ProductEditor
src/components/admin/PinGate.tsx    password gate (device-level lock, NOT real auth)
src/components/admin/InvoiceViews.tsx InvoiceCard (PNG target) + FitInvoice preview
                                    — keep in sync with src/admin/invoiceCanvas.ts
src/components/admin/OwnerGuide.tsx "How to run your store" box on Overview
src/admin/adminData.ts              localStorage data layer (keys jannat-admin-*)
src/admin/db.ts                     IndexedDB image blobs (fallback when Cloudinary unset)
src/lib/cloudinary.ts               browser WebP compress + unsigned upload
```

## Before real commercial use

- Connect the database (replace `adminData.ts` + `CatalogContext.tsx` + `db.ts`).
- Real multi-user auth replaces the PIN gate.
- Split `Admin.tsx` tabs further if it grows again; `Admin` is already
  lazy-loaded so shoppers never download it.
