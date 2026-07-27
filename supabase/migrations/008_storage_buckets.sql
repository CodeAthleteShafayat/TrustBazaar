-- 008_storage_buckets.sql — Supabase Storage buckets: listing photos + dispute evidence
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('dispute-evidence', 'dispute-evidence', true)
on conflict (id) do nothing;
