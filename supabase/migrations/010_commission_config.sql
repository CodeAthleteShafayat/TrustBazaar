-- 010_commission_config.sql — admin-editable commission + deposit rates
create table if not exists public.commission_config (
  category text primary key,
  sale_rate numeric(4,2) not null check (sale_rate between 0 and 1),
  deposit_rate numeric(4,2) not null check (deposit_rate between 0 and 1),
  updated_at timestamptz not null default now()
);

alter table public.commission_config enable row level security;

drop policy if exists commission_read on public.commission_config;
create policy commission_read on public.commission_config for select using (true);