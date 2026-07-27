-- 002_listings.sql — sale / exchange / rent listings
do $$ begin
  create type listing_type as enum ('sale', 'exchange', 'rent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_condition as enum ('new', 'used');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_status as enum ('active', 'sold', 'rented', 'removed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type listing_category as enum (
    'electronics','fashion','furniture','books','other',
    'premium_electronics','smart_gadgets','high_value_flagged'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  category listing_category not null default 'other',
  condition listing_condition not null default 'used',
  price numeric(12,2) not null check (price >= 0),
  description text,
  photos text[] not null default '{}',
  listing_type listing_type not null default 'sale',
  rental_price_per_day numeric(12,2) check (rental_price_per_day is null or rental_price_per_day >= 0),
  declared_value numeric(12,2) check (declared_value is null or declared_value >= 0),
  exchange_wants text,
  status listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_listings_seller on public.listings(seller_id);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_listings_category on public.listings(category);
create index if not exists idx_listings_type on public.listings(listing_type);
create extension if not exists pg_trgm;
create index if not exists idx_listings_title_trgm on public.listings using gin (title gin_trgm_ops);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_listings_updated_at on public.listings;
create trigger trg_listings_updated_at before update on public.listings
  for each row execute function public.set_updated_at();
