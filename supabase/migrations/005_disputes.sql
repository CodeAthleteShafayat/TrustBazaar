-- 005_disputes.sql — disputes for orders + rentals
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
