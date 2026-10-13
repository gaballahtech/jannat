# pearlin — Hoodies & Essentials | Egypt

Single-page storefront for a Cairo-based heavyweight streetwear brand.
Browse → bag → WhatsApp checkout (`wa.me` order link with lines + shipping + total).
Egypt-specific: 70 EGP flat shipping, 27 governorates / 396 cities, Arabic-digit
normalization, size finder, WhatsApp-first support.

Live demo stack: React 19 + Vite 8 + Tailwind v4 + framer-motion + lucide-react + TypeScript.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm run build    # tsc -b && vite build → dist/
npm run preview  # serve dist/
```

Requires Node 20+.

## How it works

```
index.html → src/main.tsx → src/App.tsx
  CatalogProvider (live products + categories)
  └─ ShopProvider (bag / wishlist / toast, localStorage persist)
     └─ Shell (Announcement + Header + route + Footer + CartDrawer + Toast)
```

Custom History-API router (`src/router.ts`, no react-router):

| URL | View |
|---|---|
| `/` | Home (Hero + TrustStrip + Bestsellers + New + Contact) |
| `/shop`, `/shop/:category` | Shop with filter pills + sort |
| `/shop/saved` | Wishlist |
| `/product/:id?color&size` | Product page, shareable combos |
| `/search?q=` | Live search, shareable URL |
| `/admin/:tab` | Owner dashboard (PIN, `noindex`) |
| anything else | 404 `NotFound` |

Checkout is **WhatsApp-only**: `WaCta` collects name + governorate → city →
address, then opens `buildWhatsAppOrderLink()` (`src/data/store.ts`).
No payment gateway — online payment is confirmed 1-to-1 on WhatsApp.

## Project layout

```
public/          logo-black/white, favicon, robots.txt, sitemap.xml, _redirects
src/
  main.tsx       StrictMode + #root guard
  App.tsx        Shell, titles, robots noindex for /admin, ErrorBoundary
  router.ts      parsePath, navigate, path builders, link interception
  catalog/       CatalogContext — seeds + admin overrides, idb: image resolve
  store/         CartContext — bag/wishlist, live stock ceilings
  data/          store.ts (products), egypt.ts (govs/cities), sizing.ts
  admin/         localStorage data layer, IndexedDB images, invoice PNG
  utils/         numbers (Arabic digits), useLockBody, useFocusTrap
  components/    Header, Hero, ShopPage, ProductPage, CartDrawer, WaCta, …
  components/Admin.tsx  owner dashboard (products, stock matrix, invoices…)
```

## Backend status (intentionally frontend-only for now)

All truth is **device-local** until a real database is connected:

- `localStorage` keys `pearlin-admin-*`, `pearlin-cart-v1`, `pearlin-wishlist`
- `IndexedDB pearlin/images` for admin uploads (other devices see a
  `PEARLIN` placeholder via `MISSING_IMAGE`)
- Manual JSON backup/restore in `/admin → overview`

When the backend lands, replace `src/admin/adminData.ts` +
`src/catalog/CatalogContext.tsx` + `src/admin/db.ts` with API calls.
`sold` counts are currently `0` (no fake social proof) — real sales figures
should come from the backend. Image hotlinks are Unsplash placeholders with
`loading=lazy` + `onError` fallback; self-host before launch.

## Production checklist

- [x] Real 404, ErrorBoundary, dynamic titles, `robots noindex` on `/admin`
- [x] SEO: canonical, OG/Twitter, JSON-LD `ClothingStore`, `sitemap.xml`
- [x] No fake `X+ SOLD` (hidden when `0`), dynamic copyright year
- [x] A11y: labels, `aria-expanded`, keyboard dropdown, focus trap on overlays
- [ ] Set real domain (currently `https://pearlin-eg.com` in `index.html`,
      `public/robots.txt`, `public/sitemap.xml`)
- [ ] Self-host product photos, add `srcset`, real OG image
- [ ] Connect database, auth, order tracking (replaces localStorage/IndexedDB)
- [ ] Split `Admin.tsx` bundle (currently ~500 kB warning — `import()` per tab)

## Deploy

Vercel: `vercel.json` rewrites everything to `/index.html`.
Netlify: `public/_redirects` (`/* /index.html 200`).
