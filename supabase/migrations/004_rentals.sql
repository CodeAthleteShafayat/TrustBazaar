-- 004_rentals.sql — rental bookings + deposit holds
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
