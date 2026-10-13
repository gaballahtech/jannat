-- jannat backend — initial schema + seed.
-- Run once in the Neon SQL editor (or psql). Safe to re-run: seeds use ON CONFLICT DO NOTHING.
-- Needs: pgcrypto for gen_random_uuid (allowlisted on Neon).

create extension if not exists pgcrypto;

-- ---------- owners & sessions (real server-side auth) ----------
create table if not exists owners (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  token text primary key,
  owner_id uuid not null references owners (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_owner_idx on sessions (owner_id);
create index if not exists sessions_expires_idx on sessions (expires_at);

-- ---------- catalog ----------
create table if not exists categories (
  id text primary key,
  label text not null,
  position int not null default 0
);

create table if not exists products (
  id text primary key,
  name text not null,
  price int not null check (price >= 0),
  category_id text not null references categories (id),
  description text not null default '',
  fabric text,
  tag text,
  sold int not null default 0,
  sizes jsonb not null default '[]',
  variants jsonb not null default '[]',
  inventory jsonb not null default '{}',
  pairs_with jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on products (category_id);
create index if not exists products_created_idx on products (created_at desc);

-- ---------- shop settings (single-row-per-key store) ----------
create table if not exists settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------- invoices ----------
create sequence if not exists invoice_seq start 1;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  buyer_name text not null default '',
  buyer_phone text not null default '',
  buyer_city text not null default '',
  buyer_address text not null default '',
  notes text not null default '',
  items jsonb not null default '[]',
  subtotal int not null default 0,
  discount int not null default 0,
  shipping int not null default 0,
  total int not null default 0,
  payment_method text not null default '',
  created_at timestamptz not null default now(),
  voided boolean not null default false
);
create index if not exists invoices_created_idx on invoices (created_at desc);

-- ================= seed =================

insert into categories (id, label, position) values
  ('hoodies', 'HOODIES', 1),
  ('jackets', 'JACKETS', 2),
  ('pants', 'PANTS', 3),
  ('tees', 'T-SHIRTS', 4),
  ('accessories', 'ACCESSORIES', 5)
on conflict (id) do nothing;

insert into settings (key, value) values
  ('biz', '{"address":"Cairo, Egypt","paymentDefault":"Online transfer","terms":"Payment due on receipt. Please check your items on delivery.","whatsapp":"201229081831","instagram":"","tiktok":"https://www.tiktok.com/@2jannat.samy1","shippingFee":70,"promoCode":"JANNAT10","promoPercent":10,"promoEnabled":true}'),
  ('home', '{"hero":[{"productId":"tech-cargo-hoodie","variant":"Black"},{"productId":"utility-hoodie","variant":"Beige"},{"productId":"shell-jacket","variant":"Camel"}]}')
on conflict (key) do nothing;

-- NOTE: image URLs are the current Unsplash placeholders.
-- Replace variant images with real Cloudinary URLs from /admin after handover.
insert into products (id, name, price, category_id, description, fabric, tag, sold, sizes, variants, inventory, pairs_with, created_at) values
  ('utility-hoodie', 'UTILITY HOODIE', 950, 'hoodies',
   'Heavyweight 480gsm brushed fleece hoodie. Double-layer hood, kangaroo cargo pocket and tonal chest embroidery. Warm enough for Egypt winter nights.',
   '480 GSM brushed fleece — 80% cotton / 20% polyester', 'BESTSELLER', 0,
   '["S","M","L","XL"]',
   '[{"name":"Grey","hex":"#6b7280","image":"https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=900&auto=format&fit=crop"},{"name":"Beige","hex":"#c9bda6","image":"https://images.unsplash.com/photo-1685328403755-de1d57e12e63?q=80&w=900&auto=format&fit=crop"},{"name":"Orange","hex":"#c9722e","image":"https://images.unsplash.com/photo-1509942774463-acf339cf87d5?q=80&w=900&auto=format&fit=crop"}]',
   '{"Grey||S": 2, "Grey||M": 2, "Grey||L": 2, "Grey||XL": 2, "Beige||S": 2, "Beige||M": 2, "Beige||L": 2, "Beige||XL": 2, "Orange||S": 2, "Orange||M": 2, "Orange||L": 2, "Orange||XL": 2}', '["cargo-pants","bucket-hat"]', '2026-02-01T00:00:00Z'),
  ('tech-cargo-hoodie', 'TECH CARGO HOODIE', 1100, 'hoodies',
   'Cargo hoodie with side utility pockets, adjustable shock-cord hem and matte black drawcords. Built for daily wear in the city.',
   '450 GSM loopback fleece — 100% cotton face', 'NEW', 0,
   '["S","M","L","XL"]',
   '[{"name":"Black","hex":"#111111","image":"https://images.unsplash.com/photo-1578681994506-b8f463449011?q=80&w=900&auto=format&fit=crop"},{"name":"Mustard","hex":"#c99a2e","image":"https://images.unsplash.com/photo-1609873814058-a8928924184a?q=80&w=900&auto=format&fit=crop"}]',
   '{"Black||S": 2, "Black||M": 2, "Black||L": 2, "Black||XL": 2, "Mustard||S": 2, "Mustard||M": 2, "Mustard||L": 2, "Mustard||XL": 1}', '["cargo-pants","oversized-tee"]', '2026-09-20T00:00:00Z'),
  ('oversized-hoodie', 'OVERSIZED HOODIE', 850, 'hoodies',
   'Boxy oversized fit with dropped shoulders and wide ribbed cuffs. The everyday hoodie — soft, heavy, simple.',
   '420 GSM fleece — 80% cotton / 20% polyester', 'NEW', 0,
   '["S","M","L","XL"]',
   '[{"name":"Cream","hex":"#ece5d8","image":"https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?q=80&w=900&auto=format&fit=crop"}]',
   '{"Cream||S": 5, "Cream||M": 5, "Cream||L": 4, "Cream||XL": 4}', '["cargo-pants","shoulder-bag"]', '2026-06-20T00:00:00Z'),
  ('shell-jacket', 'WINTER SHELL JACKET', 1450, 'jackets',
   'Water-resistant shell jacket with fleece lining, storm cuffs and 4 pockets. For rain and cold Alexandria / Cairo nights.',
   'DWR-coated shell with fleece lining', null, 0,
   '["S","M","L","XL"]',
   '[{"name":"Camel","hex":"#b98d5e","image":"https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=900&auto=format&fit=crop"}]',
   '{"Camel||S": 2, "Camel||M": 2, "Camel||L": 2, "Camel||XL": 2}', '["cargo-pants","bucket-hat"]', '2026-04-12T00:00:00Z'),
  ('cargo-pants', 'CARGO PANTS', 750, 'pants',
   'Relaxed cargo pants with 6 pockets, adjustable ankle cords and durable ripstop fabric. Matches every hoodie.',
   'Ripstop cotton twill', null, 0,
   '["S","M","L","XL"]',
   '[{"name":"Beige","hex":"#c4a189","image":"https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?q=80&w=900&auto=format&fit=crop"},{"name":"Denim Blue","hex":"#3b5a80","image":"https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=900&auto=format&fit=crop"},{"name":"Black","hex":"#111111","image":"https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?q=80&w=900&auto=format&fit=crop"}]',
   '{"Beige||S": 2, "Beige||M": 2, "Beige||L": 2, "Beige||XL": 2, "Denim Blue||S": 2, "Denim Blue||M": 2, "Denim Blue||L": 2, "Denim Blue||XL": 2, "Black||S": 1, "Black||M": 1, "Black||L": 1, "Black||XL": 1}', '["utility-hoodie","oversized-tee"]', '2026-01-10T00:00:00Z'),
  ('oversized-tee', 'OVERSIZED T-SHIRT', 350, 'tees',
   'Heavy 260gsm oversized tee with boxy cut and ribbed collar. Pre-shrunk, doesn''t lose shape after washing.',
   '260 GSM combed cotton', null, 0,
   '["S","M","L","XL"]',
   '[{"name":"White","hex":"#f5f5f5","image":"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=900&auto=format&fit=crop"},{"name":"Black","hex":"#111111","image":"https://images.unsplash.com/photo-1618354691373-d851c5c3a990?q=80&w=900&auto=format&fit=crop"},{"name":"Sage","hex":"#9aa39b","image":"https://images.unsplash.com/photo-1523381210434-271e8be1f52b?q=80&w=900&auto=format&fit=crop"}]',
   '{"White||S": 3, "White||M": 3, "White||L": 3, "White||XL": 3, "Black||S": 3, "Black||M": 3, "Black||L": 2, "Black||XL": 2, "Sage||S": 2, "Sage||M": 2, "Sage||L": 2, "Sage||XL": 2}', '["cargo-pants","bucket-hat"]', '2025-12-01T00:00:00Z'),
  ('denim-jacket', 'FIELD JACKET', 1250, 'jackets',
   'Classic field jacket with flap pockets and relaxed fit. Rugged cotton twill that ages beautifully.',
   'Heavy cotton twill', null, 0,
   '["S","M","L","XL"]',
   '[{"name":"Olive","hex":"#5a5a3a","image":"https://images.unsplash.com/photo-1544022613-e87ca75a784a?q=80&w=900&auto=format&fit=crop"}]',
   '{"Olive||S": 3, "Olive||M": 3, "Olive||L": 2, "Olive||XL": 2}', '["cargo-pants","oversized-tee"]', '2026-08-02T00:00:00Z'),
  ('bucket-hat', 'BUCKET HAT', 250, 'accessories',
   'Cotton twill bucket hat. One size with inner drawcord — fits S to XL.',
   null, null, 0,
   '["ONE SIZE"]',
   '[{"name":"Beige","hex":"#c9bda6","image":"https://images.unsplash.com/photo-1578681994506-b8f463449011?q=80&w=900&auto=format&fit=crop"}]',
   '{"Beige||ONE SIZE": 25}', '["utility-hoodie","oversized-tee"]', '2025-12-15T00:00:00Z'),
  ('shoulder-bag', 'SHOULDER BAG', 450, 'accessories',
   'Everyday crossbody bag with adjustable strap, fits phone, wallet and keys.',
   null, null, 0,
   '["ONE SIZE"]',
   '[{"name":"Black","hex":"#111111","image":"https://images.unsplash.com/photo-1553062407-98eeb64c6a62?q=80&w=900&auto=format&fit=crop"}]',
   '{"Black||ONE SIZE": 12}', '["oversized-hoodie","oversized-tee"]', '2026-03-05T00:00:00Z')
on conflict (id) do nothing;
