# jannat backend — Neon Postgres + Vercel Functions

The shop is static hosting + serverless API (`/api/*`) on Postgres.
No Supabase, no ORM — plain SQL over `@neondatabase/serverless` (HTTP, pooled).

## One-time setup (you do this in dashboards, ~10 min)

1. **Neon:** console.neon.tech → New Project `jannat` (any EU region) → SQL Editor.
2. Paste `db/migrations/001_init.sql` → Run. Then `002_stock.sql` → Run.
   Seeds: 5 categories, shop settings, hero slots, all 9 products with stock.
3. Neon → Connection Details → **pooled** connection string (has `-pooler`).
4. **Vercel:** project → Settings → Environment Variables → add for
   Production **and** Preview:
   - `DATABASE_URL` = the pooled string (sensitive)
   - (Cloudinary keys from before stay as they are)
5. Redeploy (Deployments → Redeploy), then open `/admin` → **create the owner
   account** (email + 8+ char password). That form appears exactly once —
   `/api/auth?action=setup` 403s forever after.
6. Verify: `/api/health` → `{"ok":true}`, `/api/catalog` → products JSON.
   The storefront now reads the database on every device; the owner login
   works on all devices (30-day httpOnly sessions).

## API map

| Route | Auth | What |
|---|---|---|
| `GET /api/health` | — | liveness |
| `GET /api/auth?action=status` | — | `{mode:'server',hasOwner}` or `{mode:'local'}` |
| `POST /api/auth?action=setup` | once | create first owner (403 after) |
| `POST /api/auth?action=login` | — | scrypt verify → session cookie |
| `POST /api/auth?action=logout` | cookie | destroy session |
| `GET /api/auth?action=me` | cookie | session check |
| `GET /api/catalog` | — | products + categories + settings + home in one shot |
| `GET/POST /api/admin/products` | cookie | list / create (slug + unique id) |
| `PUT/DELETE /api/admin/products/[id]` | cookie | update (stock recomputed) / delete |
| `GET/POST /api/admin/categories` | cookie | list / create |
| `PUT/DELETE /api/admin/categories/[id]` | cookie | rename / delete (refuses while products use it) |
| `GET/PUT /api/admin/settings` | cookie | all settings / upsert one key (`biz`, `home`, …) |
| `GET/POST /api/admin/invoices` | cookie | list / create (`PR-0001…` via sequence, decrements exact stock cells, bumps `sold`) |
| `DELETE /api/admin/invoices/[id]` | cookie | void (restores stock) |

Passwords: scrypt (salt:hash), never logged. Sessions: 32-byte opaque tokens,
httpOnly + SameSite=Lax (+Secure in prod). All admin input is length-capped and
validated; unknown categories rejected; stock math mirrors the old local code
(`variant||size` cells, floor at 0, `sold` tracks real units moved).

## Frontend behavior

- `CatalogContext` fetches `/api/catalog` first; any failure → local
  seeds/overrides (offline + pre-migration both keep working).
- `getSettings()`/`getHome()` prefer the server snapshot when present.
- `/admin`: server reachable → email/password (`ServerGate`); unreachable →
  legacy device PIN (`PinGate`). No behavior change for shoppers.

## Files

```
db/migrations/001_init.sql    schema + seed (run in Neon SQL editor)
db/migrations/002_stock.sql   denormalized stock totals
api/_lib/db.ts                neon client, scrypt auth, session cookies
api/_lib/catalog.ts           row→Product mapper, cell math, slug ids
api/health.ts api/catalog.ts
api/auth.ts (setup/login/logout/me/status via ?action=)
api/admin/products.ts api/admin/products/[id].ts
api/admin/categories.ts api/admin/categories/[id].ts
api/admin/settings.ts
api/admin/invoices.ts api/admin/invoices/[id].ts
src/lib/api.ts                typed fetch client + server snapshot
```

## Local dev

`vercel env pull` (gets DATABASE_URL into `.env.local`, gitignored) →
`vercel dev` (runs both the SPA and `/api`). Plain `vite` also works —
the app falls back to local mode without env.
