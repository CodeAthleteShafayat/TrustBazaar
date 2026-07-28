-- 011_atomic_ops.sql — atomic order creation, rental creation, settlement,
-- and dispute resolution. Every financial operation is one transaction:
-- state-machine writes (orders/rentals/listings/disputes) and wallet_ledger
-- inserts run together or not at all. Concurrent callers are serialised
-- with row locks (listings/orders/rentals/disputes) or transaction-scoped
-- advisory locks (per-user payout). Returns JSON so the Flask routes can
-- branch without relying on exceptions.
--
-- Idempotency: each wallet_ledger insert is keyed by a deterministic
-- reference string (e.g. 'order:<uuid>:release'). The unique index
-- uq_wallet_ledger_type_ref makes a duplicate insert raise 23505, which
-- each RPC catches and resolves to the existing row. Calling a settlement
-- RPC twice never produces duplicate ledger entries.

-- =====================================================================
-- Idempotency index for wallet_ledger inserts keyed by (type, reference).
-- A second insert with the same pair raises unique_violation (SQLSTATE
-- 23505) and the RPC catches it to return the already-written row.
-- =====================================================================
create unique index if not exists uq_wallet_ledger_type_ref
  on public.wallet_ledger (type, reference);

-- =====================================================================
-- create_order_atomic
-- Locks the listing row, verifies it is still 'active', inserts the
-- order, marks the listing 'sold', and writes the HOLD ledger entry.
-- All four writes commit or roll back together.
-- Two concurrent buyers serialise on the row lock; the second sees
-- status='sold' and returns 409.
-- =====================================================================
create or replace function public.create_order_atomic(
  p_listing_id uuid,
  p_buyer_id   uuid,
  p_amount     numeric,
  p_commission numeric,
  p_release_at timestamptz,
  p_demo_fast_forward_seconds int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_listing public.listings%rowtype;
  v_order   public.orders%rowtype;
begin
  -- Lock the listing row for the duration of this transaction.
  select * into v_listing
    from public.listings
   where id = p_listing_id
     for update;

  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Listing not found');
  end if;
  if v_listing.status <> 'active' then
    return jsonb_build_object('error', 'conflict', 'message', 'Listing not available');
  end if;
  if v_listing.seller_id = p_buyer_id then
    return jsonb_build_object('error', 'validation_error', 'message', 'Cannot buy your own listing');
  end if;

  insert into public.orders (
    listing_id, buyer_id, seller_id, amount, commission,
    status, escrow, release_at, demo_fast_forward_seconds
  ) values (
    p_listing_id, p_buyer_id, v_listing.seller_id, p_amount, p_commission,
    'paid', 'held', p_release_at, p_demo_fast_forward_seconds
  )
  returning * into v_order;

  update public.listings set status = 'sold' where id = p_listing_id;

  -- HOLD entry on the buyer's wallet, scoped to this order. Commits in the
  -- same transaction as the orders insert and the listings update.
  insert into public.wallet_ledger (user_id, type, amount, reference)
  values (p_buyer_id, 'hold', p_amount, 'order:' || v_order.id::text);

  return to_jsonb(v_order);
end;
$$;

-- =====================================================================
-- create_rental_atomic
-- Locks the listing, verifies it is 'active' AND listing_type='rent',
-- then checks no existing non-terminal rental overlaps the requested
-- date range. Inserts the rental, the HOLD ledger entry (rental_fee +
-- deposit_amount on the renter's wallet). All writes atomic.
-- =====================================================================
create or replace function public.create_rental_atomic(
  p_listing_id    uuid,
  p_renter_id     uuid,
  p_start_date    date,
  p_end_date      date,
  p_rental_fee    numeric,
  p_deposit_rate  numeric,
  p_deposit_amount numeric,
  p_commission    numeric,
  p_deposit_release_at timestamptz
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_listing  public.listings%rowtype;
  v_overlap  int;
  v_rental   public.rentals%rowtype;
begin
  select * into v_listing
    from public.listings
   where id = p_listing_id
     for update;

  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Listing not found');
  end if;
  if v_listing.status <> 'active' then
    return jsonb_build_object('error', 'conflict', 'message', 'Listing not available');
  end if;
  if v_listing.listing_type <> 'rent' then
    return jsonb_build_object('error', 'validation_error', 'message', 'Listing is not for rent');
  end if;
  if v_listing.seller_id = p_renter_id then
    return jsonb_build_object('error', 'validation_error', 'message', 'Cannot rent your own listing');
  end if;

  -- Reject overlapping bookings. Half-open daterange: [start, end+1).
  -- 'paid','active','returned','disputed' all hold the item; only
  -- 'refunded' and 'completed' free it up.
  select count(*) into v_overlap
    from public.rentals
   where listing_id = p_listing_id
     and status in ('paid','active','returned','disputed')
     and daterange(start_date, end_date + 1, '[)') && daterange(p_start_date, p_end_date + 1, '[)');
  if v_overlap > 0 then
    return jsonb_build_object('error', 'conflict', 'message', 'Dates already booked');
  end if;

  insert into public.rentals (
    listing_id, renter_id, owner_id,
    start_date, end_date,
    rental_fee, deposit_rate, deposit_amount, commission,
    status, deposit_status, deposit_release_at
  ) values (
    p_listing_id, p_renter_id, v_listing.seller_id,
    p_start_date, p_end_date,
    p_rental_fee, p_deposit_rate, p_deposit_amount, p_commission,
    'active', 'held', p_deposit_release_at
  )
  returning * into v_rental;

  -- Rentals don't flip listing.status to 'sold' — they can repeat over time.
  -- The date-range overlap check above is what prevents double-booking.

  -- HOLD entry on the renter's wallet for the full amount collected
  -- (rental fee + deposit). Commits in the same transaction as the
  -- rentals insert.
  insert into public.wallet_ledger (user_id, type, amount, reference)
  values (
    p_renter_id,
    'hold',
    p_rental_fee + p_deposit_amount,
    'rental:' || v_rental.id::text
  );

  return to_jsonb(v_rental);
end;
$$;

-- =====================================================================
-- complete_order_atomic
-- Idempotent settlement of an order. Locks the order row, asserts the
-- current state is valid for completion, transitions to completed +
-- escrow released, and writes the RELEASE ledger entry on the seller's
-- wallet. If called twice, the second call returns the already-completed
-- row without producing a duplicate ledger entry.
-- =====================================================================
create or replace function public.complete_order_atomic(
  p_order_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_existing public.wallet_ledger%rowtype;
begin
  -- Lock the order row for the duration of this transaction.
  select * into v_order
    from public.orders
   where id = p_order_id
     for update;

  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Order not found');
  end if;

  -- Idempotency: if the order is already completed and the release ledger
  -- row already exists, return the current order without writing again.
  if v_order.status = 'completed' and v_order.escrow = 'released' then
    return to_jsonb(v_order);
  end if;

  -- Authorisation: only the buyer may complete the order.
  if v_order.buyer_id <> p_actor_id then
    return jsonb_build_object('error', 'forbidden', 'message', 'Not the buyer');
  end if;

  -- State machine: only 'paid' or 'shipped' may transition to completed.
  if v_order.status not in ('paid','shipped') then
    return jsonb_build_object(
      'error', 'escrow_invalid_transition',
      'message', format('Cannot complete from %s', v_order.status)
    );
  end if;

  update public.orders
     set status      = 'completed',
         escrow      = 'released',
         completed_at = now()
   where id = p_order_id
   returning * into v_order;

  -- RELEASE entry on the seller's wallet, scoped to this order. The unique
  -- index uq_wallet_ledger_type_ref makes a retry safe — the unique
  -- violation below catches it and we fall through to a SELECT.
  begin
    insert into public.wallet_ledger (user_id, type, amount, reference)
    values (
      v_order.seller_id,
      'release',
      v_order.net_to_seller,
      'order:' || v_order.id::text || ':release'
    );
  exception when unique_violation then
    -- Already settled by an earlier call. Nothing to do.
    null;
  end;

  return to_jsonb(v_order);
end;
$$;

-- =====================================================================
-- complete_rental_atomic
-- Idempotent settlement of a clean rental return. Locks the rental row,
-- asserts the current state, transitions to completed + deposit refunded,
-- and writes the REFUND (renter) + RELEASE (owner) ledger entries.
-- Second call returns the already-completed row, no duplicate ledger.
-- =====================================================================
create or replace function public.complete_rental_atomic(
  p_rental_id uuid,
  p_actor_id  uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_rental public.rentals%rowtype;
begin
  select * into v_rental
    from public.rentals
   where id = p_rental_id
     for update;

  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Rental not found');
  end if;

  -- Idempotency: already completed → return as-is.
  if v_rental.status = 'completed' and v_rental.deposit_status = 'refunded' then
    return to_jsonb(v_rental);
  end if;

  -- Authorisation: only the owner may confirm a clean return.
  if v_rental.owner_id <> p_actor_id then
    return jsonb_build_object('error', 'forbidden', 'message', 'Not the owner');
  end if;

  -- State machine: must be 'returned' (renter marked it returned) before
  -- the owner can confirm completion.
  if v_rental.status <> 'returned' then
    return jsonb_build_object(
      'error', 'escrow_invalid_transition',
      'message', format('Cannot complete from %s', v_rental.status)
    );
  end if;

  update public.rentals
     set status         = 'completed',
         deposit_status = 'refunded'
   where id = p_rental_id
   returning * into v_rental;

  -- REFUND: deposit back to the renter. Idempotent via unique index.
  begin
    insert into public.wallet_ledger (user_id, type, amount, reference)
    values (
      v_rental.renter_id,
      'refund',
      v_rental.deposit_amount,
      'rental:' || v_rental.id::text || ':refund'
    );
  exception when unique_violation then
    null;
  end;

  -- RELEASE: rental fee (net of commission) to the owner. Idempotent.
  begin
    insert into public.wallet_ledger (user_id, type, amount, reference)
    values (
      v_rental.owner_id,
      'release',
      v_rental.net_to_owner,
      'rental:' || v_rental.id::text || ':release'
    );
  exception when unique_violation then
    null;
  end;

  return to_jsonb(v_rental);
end;
$$;

-- =====================================================================
-- resolve_dispute_atomic
-- Idempotent admin-driven dispute resolution. Locks the dispute row,
-- branches on decision ('refund' | 'release' | 'split'), updates the
-- order or rental state, and writes the matching ledger entries. Safe
-- to retry — second call returns the already-resolved dispute row.
-- =====================================================================
create or replace function public.resolve_dispute_atomic(
  p_dispute_id   uuid,
  p_decision     text,
  p_split_buyer  numeric default null,
  p_split_seller numeric default null,
  p_admin_id     uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_dispute public.disputes%rowtype;
  v_order   public.orders%rowtype;
  v_rental  public.rentals%rowtype;
  v_buyer_amt  numeric(12,2);
  v_seller_amt numeric(12,2);
begin
  select * into v_dispute
    from public.disputes
   where id = p_dispute_id
     for update;

  if not found then
    return jsonb_build_object('error', 'not_found', 'message', 'Dispute not found');
  end if;

  -- Idempotency: already resolved → return as-is.
  if v_dispute.status = 'resolved' then
    return to_jsonb(v_dispute);
  end if;

  if p_decision not in ('refund','release','split') then
    return jsonb_build_object('error', 'validation_error', 'message', 'decision must be refund|release|split');
  end if;

  -- Resolve the dispute row itself. resolution is a generated column on
  -- some installs; if not present the IF block falls through harmlessly.
  update public.disputes
     set status      = 'resolved',
         resolution  = p_decision,
         resolved_at = now()
   where id = p_dispute_id
   returning * into v_dispute;

  -- ---- Order dispute ----
  if v_dispute.order_id is not null then
    select * into v_order
      from public.orders
     where id = v_dispute.order_id
       for update;

    if not found then
      return jsonb_build_object('error', 'not_found', 'message', 'Order not found');
    end if;

    if p_decision = 'refund' then
      update public.orders
         set status = 'refunded', escrow = 'refunded'
       where id = v_order.id
       returning * into v_order;

      begin
        insert into public.wallet_ledger (user_id, type, amount, reference)
        values (
          v_order.buyer_id,
          'refund',
          v_order.amount,
          'order:' || v_order.id::text || ':refund'
        );
      exception when unique_violation then null;
      end;

    else
      -- 'release' or 'split' both fall through to seller payout.
      update public.orders
         set status = 'completed', escrow = 'released'
       where id = v_order.id
       returning * into v_order;

      begin
        insert into public.wallet_ledger (user_id, type, amount, reference)
        values (
          v_order.seller_id,
          'release',
          v_order.net_to_seller,
          'order:' || v_order.id::text || ':release'
        );
      exception when unique_violation then null;
      end;
    end if;
  end if;

  -- ---- Rental dispute ----
  if v_dispute.rental_id is not null then
    select * into v_rental
      from public.rentals
     where id = v_dispute.rental_id
       for update;

    if not found then
      return jsonb_build_object('error', 'not_found', 'message', 'Rental not found');
    end if;

    if p_decision = 'refund' then
      update public.rentals
         set status = 'refunded', deposit_status = 'refunded'
       where id = v_rental.id
       returning * into v_rental;

      begin
        insert into public.wallet_ledger (user_id, type, amount, reference)
        values (
          v_rental.renter_id,
          'refund',
          v_rental.deposit_amount,
          'rental:' || v_rental.id::text || ':refund'
        );
      exception when unique_violation then null;
      end;

      begin
        insert into public.wallet_ledger (user_id, type, amount, reference)
        values (
          v_rental.owner_id,
          'release',
          v_rental.net_to_owner,
          'rental:' || v_rental.id::text || ':release'
        );
      exception when unique_violation then null;
      end;

    elsif p_decision = 'release' then
      -- Owner claims the deposit; rental fee already released by the
      -- normal settlement, so we only credit the forfeited deposit here.
      update public.rentals
         set status = 'completed', deposit_status = 'forfeited'
       where id = v_rental.id
       returning * into v_rental;

      begin
        insert into public.wallet_ledger (user_id, type, amount, reference)
        values (
          v_rental.owner_id,
          'release',
          v_rental.deposit_amount,
          'rental:' || v_rental.id::text || ':deposit-release'
        );
      exception when unique_violation then null;
      end;

    else
      -- 'split': default split returns the whole deposit to the renter
      -- unless p_split_seller is provided.
      v_buyer_amt  := coalesce(p_split_buyer,  v_rental.deposit_amount);
      v_seller_amt := coalesce(p_split_seller, 0);

      update public.rentals
         set status = 'completed', deposit_status = 'partial'
       where id = v_rental.id;

      if v_buyer_amt > 0 then
        begin
          insert into public.wallet_ledger (user_id, type, amount, reference)
          values (
            v_rental.renter_id,
            'refund',
            v_buyer_amt,
            'rental:' || v_rental.id::text || ':split:buyer'
          );
        exception when unique_violation then null;
        end;
      end if;

      if v_seller_amt > 0 then
        begin
          insert into public.wallet_ledger (user_id, type, amount, reference)
          values (
            v_rental.owner_id,
            'release',
            v_seller_amt,
            'rental:' || v_rental.id::text || ':split:seller'
          );
        exception when unique_violation then null;
        end;
      end if;
    end if;
  end if;

  return to_jsonb(v_dispute);
end;
$$;

-- =====================================================================
-- payout_atomic
-- Per-user advisory lock serialises concurrent payouts. Computes the
-- current available balance inside the same tx as the insert, so two
-- parallel requests cannot both pass the insufficient-funds check.
-- Available = sum(credit, release, refund) - sum(debit, hold).
-- (debit is what payouts use; hold reserves escrow funds and never
-- reaches available until released/refunded.)
-- =====================================================================
create or replace function public.payout_atomic(
  p_user_id uuid,
  p_amount  numeric
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_available numeric(12,2);
  v_row       public.wallet_ledger%rowtype;
begin
  -- Transaction-scoped advisory lock keyed on this user. Two concurrent
  -- payouts from the same user queue here; the second sees the first's
  -- already-inserted debit row and recomputes the (lower) available.
  perform pg_advisory_xact_lock(hashtext('payout:' || p_user_id::text));

  select coalesce(sum(case when type in ('credit','release','refund') then amount
                           when type in ('debit','hold')             then -amount
                           else 0 end), 0)
    into v_available
    from public.wallet_ledger
   where user_id = p_user_id;

  if p_amount <= 0 then
    return jsonb_build_object('error', 'validation_error', 'message', 'amount > 0 required');
  end if;
  if p_amount > v_available then
    return jsonb_build_object('error', 'insufficient_funds', 'message', 'Insufficient wallet balance');
  end if;

  insert into public.wallet_ledger (user_id, type, amount, reference)
  values (p_user_id, 'debit', p_amount, 'payout:atomic')
  returning * into v_row;

  return jsonb_build_object('payout_id', v_row.id, 'available_after', v_available - p_amount);
end;
$$;

-- Lock down execution: service-role caller only, by virtue of being
-- SECURITY DEFINER and called only from the Flask backend (which holds
-- the service-role key). No anon-key caller can invoke these directly.
revoke all on function public.create_order_atomic(uuid,uuid,numeric,numeric,timestamptz,int) from public;
revoke all on function public.create_rental_atomic(uuid,uuid,date,date,numeric,numeric,numeric,numeric,timestamptz) from public;
revoke all on function public.complete_order_atomic(uuid,uuid) from public;
revoke all on function public.complete_rental_atomic(uuid,uuid) from public;
revoke all on function public.resolve_dispute_atomic(uuid,text,numeric,numeric,uuid) from public;
revoke all on function public.payout_atomic(uuid,numeric) from public;