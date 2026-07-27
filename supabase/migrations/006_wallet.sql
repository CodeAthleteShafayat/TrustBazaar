-- 006_wallet.sql — wallet_ledger (double-entry-ish: credit, debit, hold, release, refund)
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
