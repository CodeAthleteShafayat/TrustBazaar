-- 007_trust_score.sql — history of Trust Score recalculations
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

-- Trigger: on resolution of dispute or completion of order/rental, append a recalculation row.
-- (Full recalculation runs in Python; this only records the event.)
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
