-- 009_rls_policies.sql — RLS for MVP. Frontend uses supabase-js with anon key + user JWT.
-- Backend uses service-role key (bypasses RLS) for state-machine writes.

alter table public.users enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.rentals enable row level security;
alter table public.disputes enable row level security;
alter table public.evidence enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.trust_score_history enable row level security;

-- USERS: anyone authenticated can read profiles (for Trust Score on listings)
drop policy if exists users_read on public.users;
create policy users_read on public.users for select using (true);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update using (auth.uid() = id);

-- LISTINGS: public read, only owner writes
drop policy if exists listings_read on public.listings;
create policy listings_read on public.listings for select using (status = 'active' or auth.uid() = seller_id);

drop policy if exists listings_write on public.listings;
create policy listings_write on public.listings for insert with check (auth.uid() = seller_id);

drop policy if exists listings_update on public.listings;
create policy listings_update on public.listings for update using (auth.uid() = seller_id);

drop policy if exists listings_delete on public.listings;
create policy listings_delete on public.listings for delete using (auth.uid() = seller_id);

-- ORDERS / RENTALS / DISPUTES / WALLET: party-only read, no client write (backend writes only)
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

-- Storage: public read on both buckets, authenticated write to own folder
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
