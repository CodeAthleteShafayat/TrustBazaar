-- 003_orders.sql — buy-flow orders, escrow state
do $$ begin
  create type order_status as enum ('paid','shipped','completed','disputed','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type escrow_status as enum ('held','released','refunded');
exception when duplicate_object then null; end $$;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  buyer_id uuid not null references public.users(id) on delete restrict,
  seller_id uuid not null references public.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount >= 0),
  commission numeric(12,2) not null default 0 check (commission >= 0),
  net_to_seller numeric(12,2) generated always as (amount - commission) stored,
  status order_status not null default 'paid',
  escrow escrow_status not null default 'held',
  paid_at timestamptz not null default now(),
  shipped_at timestamptz,
  release_at timestamptz not null,
  completed_at timestamptz,
  demo_fast_forward_seconds int not null default 30
);

create index if not exists idx_orders_buyer on public.orders(buyer_id);
create index if not exists idx_orders_seller on public.orders(seller_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_orders_release_at on public.orders(release_at) where escrow = 'held';
