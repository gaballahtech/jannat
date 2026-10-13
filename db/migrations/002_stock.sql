-- Denormalized stock total (sum of inventory matrix) for fast filtering.
-- Always recomputed from inventory on write; rowToProduct recomputes on read too.
alter table products add column if not exists stock int not null default 0;

update products set stock = (
  select coalesce(sum((value::text)::int), 0)
  from jsonb_each_text(inventory)
  where (value::text) ~ '^[0-9]+$'
);
