-- 012_auto_release_order.sql — time-gated escrow release.
--
-- complete_order_atomic() (011) only fires when the buyer explicitly
-- confirms. If nobody acts, the order sits at status='paid'/'shipped'
-- forever even after release_at passes, even though the UI promises a
-- "Ready to release" auto-release once the window elapses. This function
-- is the system-triggered counterpart: called lazily from the Flask read
-- path (GET /orders, GET /orders/<id>) once release_at <= now().
--
-- Uses the identical wallet_ledger reference key as complete_order_atomic
-- ('order:<id>:release') so the two are mutually idempotent under the
-- uq_wallet_ledger_type_ref unique index — whichever fires first wins, and
-- the loser's insert is caught as a no-op duplicate, never double-paying
-- the seller.
create or replace function public.release_expired_order_atomic(
  p_order_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
     for update;

  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Order not found');
  end if;

  -- Idempotent no-op: already settled, not eligible, or window not yet due.
  if v_order.status not in ('paid','shipped')
     or v_order.escrow <> 'held'
     or v_order.release_at is null
     or now() < v_order.release_at
  then
    return to_jsonb(v_order);
  end if;

  update public.orders
     set status       = 'completed',
         escrow       = 'released',
         completed_at = now()
   where id = p_order_id
   returning * into v_order;

  begin
    insert into public.wallet_ledger (user_id, type, amount, reference)
    values (
      v_order.seller_id,
      'release',
      v_order.net_to_seller,
      'order:' || v_order.id::text || ':release'
    );
  exception when unique_violation then
    null;
  end;

  return to_jsonb(v_order);
end;
$$;
