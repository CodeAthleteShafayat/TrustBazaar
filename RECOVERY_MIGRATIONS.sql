-- ============================================================
-- RECOVERY_MIGRATIONS.sql
-- Apply this AFTER cancelling the partially-run ALL_MIGRATIONS.sql.
-- Everything from line 84 onwards of the original cascade failed
-- (gin_trgm_ops didn't exist yet). This single block brings the
-- schema up to current state in one shot.
--
-- Idempotent: safe to re-run.
-- ============================================================

-- ----- missing piece from line 84: listings trgm index -----
-- pg_trgm isn't loaded yet because line 85 never ran.
-- Create the extension FIRST, then the index.
create extension if not exists pg_trgm;
create index if not exists idx_listings_title_trgm on public.listings using gin (title gin_trgm_ops);

-- ===== 003_orders.sql =====
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

-- ===== 004_rentals.sql =====
do $$ begin
  create type rental_status as enum ('paid','active','returned','disputed','refunded','completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type deposit_status as enum ('held','refunded','partial','forfeited');
exception when duplicate_object then null; end $$;

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete restrict,
  renter_id uuid not null references public.users(id) on delete restrict,
  owner_id uuid not null references public.users(id) on delete restrict,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  rental_fee numeric(12,2) not null check (rental_fee >= 0),
  deposit_rate numeric(4,2) not null check (deposit_rate between 0 and 1),
  deposit_amount numeric(12,2) not null check (deposit_amount >= 0),
  commission numeric(12,2) not null default 0 check (commission >= 0),
  net_to_owner numeric(12,2) generated always as (rental_fee - commission) stored,
  status rental_status not null default 'paid',
  deposit_status deposit_status not null default 'held',
  paid_at timestamptz not null default now(),
  returned_at timestamptz,
  deposit_release_at timestamptz not null
);

create index if not exists idx_rentals_renter on public.rentals(renter_id);
create index if not exists idx_rentals_owner on public.rentals(owner_id);
create index if not exists idx_rentals_status on public.rentals(status);
create index if not exists idx_rentals_deposit_release on public.rentals(deposit_release_at) where deposit_status = 'held';

-- ===== 005_disputes.sql =====
do $$ begin
  create type dispute_status as enum ('open','under_review','resolved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_resolution as enum ('refund','release','split');
exception when duplicate_object then null; end $$;

create table if not exists public.disputes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete cascade,
  raised_by uuid not null references public.users(id) on delete restrict,
  reason text not null,
  status dispute_status not null default 'open',
  resolution dispute_resolution,
  split_buyer numeric(12,2),
  split_seller numeric(12,2),
  admin_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (order_id is not null or rental_id is not null)
);

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  uploader_id uuid not null references public.users(id) on delete restrict,
  file_url text not null,
  file_type text not null default 'image',
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_disputes_status on public.disputes(status);
create index if not exists idx_disputes_order on public.disputes(order_id);
create index if not exists idx_disputes_rental on public.disputes(rental_id);
create index if not exists idx_evidence_dispute on public.evidence(dispute_id);

-- ===== 006_wallet.sql =====
do $$ begin
  create type ledger_type as enum ('credit','debit','hold','release','refund');
exception when duplicate_object then null; end $$;

create table if not exists public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type ledger_type not null,
  amount numeric(12,2) not null check (amount > 0),
  reference text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wallet_user on public.wallet_ledger(user_id, created_at desc);

-- ===== 007_trust_score.sql =====
create table if not exists public.trust_score_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score int not null check (score between 0 and 100),
  tier text not null,
  breakdown jsonb not null,
  trigger_event text not null,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_trust_history_user on public.trust_score_history(user_id, recorded_at desc);

create or replace function public.log_trust_score_change()
returns trigger language plpgsql as $$
declare uid uuid;
begin
  if tg_table_name = 'orders' then uid := coalesce(new.buyer_id, new.seller_id);
  elsif tg_table_name = 'rentals' then uid := coalesce(new.renter_id, new.owner_id);
  else uid := new.user_id;
  end if;

  insert into public.trust_score_history (user_id, score, tier, breakdown, trigger_event)
  values (uid, 0, 'PendingRecalc', '{}'::jsonb, tg_table_name || ':' || coalesce(new.status::text, 'unknown'));

  return new;
end $$;

drop trigger if exists trg_orders_recalc on public.orders;
create trigger trg_orders_recalc after update of status on public.orders
  for each row when (old.status is distinct from new.status)
  execute function public.log_trust_score_change();

drop trigger if exists trg_rentals_recalc on public.rentals;
create trigger trg_rentals_recalc after update of status on public.rentals
  for each row when (old.status is distinct from new.status)
  execute function public.log_trust_score_change();

-- ===== 008_storage_buckets.sql =====
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', true)
on conflict (id) do nothing;

-- ===== 009_rls_policies.sql =====
alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.rentals enable row level security;
alter table public.disputes enable row level security;
alter table public.evidence enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.trust_score_history enable row level security;

drop policy if exists users_read on public.users;
create policy users_read on public.users for select using (true);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update using (auth.uid() = id);

drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select using (status = 'active' or auth.uid() = seller_id);

drop policy if exists listings_write on public.listings;
create policy listings_write on public.listings for insert with check (auth.uid() = seller_id);

drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update using (auth.uid() = seller_id);

drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete using (auth.uid() = seller_id);

drop policy if exists orders_read_party on public.orders;
create policy orders_read_party on public.orders for select using (auth.uid() = buyer_id or auth.uid() = seller_id);

drop policy if exists rentals_read_party on public.rentals;
create policy rentals_read_party on public.rentals for select using (auth.uid() = renter_id or auth.uid() = owner_id);

drop policy if exists disputes_read_party on public.disputes;
create policy disputes_read_party on public.disputes for select using (
  auth.uid() = raised_by
  or auth.uid() in (select buyer_id from public.orders where orders.id = disputes.order_id)
  or auth.uid() in (select seller_id from public.orders where orders.id = disputes.order_id)
  or auth.uid() in (select renter_id from public.rentals where rentals.id = disputes.rental_id)
  or auth.uid() in (select owner_id from public.rentals where rentals.id = disputes.rental_id)
);

drop policy if exists evidence_read_party on public.evidence;
create policy evidence_read_party on public.evidence for select using (
  exists (select 1 from public.disputes d where d.id = evidence.dispute_id)
);

drop policy if exists wallet_read_self on public.wallet_ledger;
create policy wallet_read_self on public.wallet_ledger for select using (auth.uid() = user_id);

drop policy if exists trust_history_read on public.trust_score_history;
create policy trust_history_read on public.trust_score_history for select using (auth.uid() = user_id);

drop policy if exists "listing_photos_read" on storage.objects;
create policy "listing_photos_read" on storage.objects for select using (bucket_id = 'listing-photos');

drop policy if exists "listing_photos_write" on storage.objects;
create policy "listing_photos_write" on storage.objects for insert with check (
  bucket_id = 'listing-photos' and auth.uid() = owner
);

drop policy if exists "dispute_evidence_read" on storage.objects;
create policy "dispute_evidence_read" on storage.objects for select using (bucket_id = 'dispute-evidence');

drop policy if exists "dispute_evidence_write" on storage.objects;
create policy "dispute_evidence_write" on storage.objects for insert with check (
  bucket_id = 'dispute-evidence' and auth.uid() = owner
);

-- ===== 010_commission_config.sql =====
create table if not exists public.commission_config (
  category text primary key,
  sale_rate numeric(4,2) not null check (sale_rate between 0 and 1),
  deposit_rate numeric(4,2) not null check (deposit_rate between 0 and 1),
  updated_at timestamptz not null default now()
);

alter table public.commission_config enable row level security;

drop policy if exists commission_read on public.commission_config;
create policy commission_read on public.commission_config for select using (true);

-- ===== Backfill: demo accounts created in auth.users BEFORE public.users trigger existed =====
-- (Only matters if 001_users.sql's trigger didn't fire because public.users didn't exist yet.)
-- Idempotent: uses ON CONFLICT DO NOTHING.
insert into public.users (id, email, display_name, is_admin, trust_score, trust_tier)
select au.id, au.email,
       coalesce(au.raw_user_meta_data->>'display_name', split_part(au.email, '@', 1)),
       case when au.email = 'admin@demo.com' then true else false end,
       case au.email
         when 'buyer@demo.com'  then 45
         when 'seller@demo.com' then 95
         when 'renter@demo.com' then 72
         when 'admin@demo.com'  then 88
         else null
       end,
       case au.email
         when 'buyer@demo.com'  then 'Building'
         when 'seller@demo.com' then 'Trusted'
         when 'renter@demo.com' then 'Reliable'
         when 'admin@demo.com'  then 'Trusted'
         else 'Unrated'
       end
from auth.users au
where au.email in ('buyer@demo.com','seller@demo.com','renter@demo.com','admin@demo.com')
on conflict (id) do nothing;