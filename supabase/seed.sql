-- seed.sql — demo data. Run AFTER migrations + creating 3 real users via Supabase Auth.
-- The seed expects three auth users with emails: demo-buyer@example.com, demo-seller@example.com, demo-renter@example.com
-- Replace the UUIDs below with the real IDs from auth.users after signup.

do $$
declare
  buyer_id uuid;
  seller_id uuid;
  renter_id uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid;
  l6 uuid; l7 uuid; l8 uuid; l9 uuid; l10 uuid;
begin
  select id into buyer_id from auth.users where email = 'demo-buyer@example.com';
  select id into seller_id from auth.users where email = 'demo-seller@example.com';
  select id into renter_id from auth.users where email = 'demo-renter@example.com';

  if buyer_id is null or seller_id is null or renter_id is null then
    raise notice 'Demo users not yet created — sign them up first, then re-run seed.sql';
    return;
  end if;

  -- Trust Score snapshots
  update public.users set trust_score = 95, trust_tier = 'Top Rated' where id = seller_id;
  update public.users set trust_score = 45, trust_tier = 'Reliable' where id = buyer_id;
  update public.users set trust_score = 72, trust_tier = 'Trusted'  where id = renter_id;

  -- 10 listings across categories
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type, rental_price_per_day, declared_value)
  values
    (seller_id, 'Sony A7 IV mirrorless camera',          'premium_electronics', 'used', 1800.00, 'Lightly used, body only. Original box.', ARRAY['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800'], 'rent', 35.00, 1800.00) returning id into l1;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'Leather wallet — brown',                'fashion',             'used',   25.00, 'Genuine leather, gently used.',          ARRAY['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800'], 'sale') returning id into l2;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'IKEA Markus office chair',              'furniture',           'used',   90.00, 'Black mesh back, good condition.',       ARRAY['https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800'], 'sale') returning id into l3;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'Clean Code — Robert C. Martin',         'books',               'used',   18.00, 'Softcover, no markings.',               ARRAY['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800'], 'sale') returning id into l4;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type, rental_price_per_day, declared_value)
  values
    (seller_id, 'DJI Mini 3 Pro drone',                   'premium_electronics', 'used',  720.00, 'Includes 3 batteries, no flyaway history.', ARRAY['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800'], 'rent', 25.00, 720.00) returning id into l5;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'Apple Watch Series 8 — 45mm',           'smart_gadgets',       'used',  280.00, 'Midnight aluminum, sport band.',         ARRAY['https://images.unsplash.com/photo-1546868871-7041f6a1d193?w=800'], 'sale') returning id into l6;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'Handmade ceramic mugs (set of 4)',       'other',               'new',    32.00, 'Speckled stoneware, dishwasher safe.',   ARRAY['https://images.unsplash.com/photo-1514228748747-15422f59d6d4?w=800'], 'sale') returning id into l7;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'Open to exchange — acoustic guitar',    'other',               'used',  150.00, 'Looking for an electric guitar or amp.', ARRAY['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800'], 'exchange') returning id into l8;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type, rental_price_per_day, declared_value)
  values
    (seller_id, 'Meta Quest 3 — 128GB',                   'smart_gadgets',       'used',  420.00, 'Includes charging dock and silicone cover.', ARRAY['https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800'], 'rent', 18.00, 420.00) returning id into l9;
  insert into public.listings (seller_id, title, category, condition, price, description, photos, listing_type)
  values
    (seller_id, 'Sony WH-1000XM4 headphones',            'electronics',         'used',  180.00, 'Original pads replaced last month.',     ARRAY['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800'], 'sale') returning id into l10;

  -- 2 in-flight orders (so the dashboard has content immediately)
  insert into public.orders (listing_id, buyer_id, seller_id, amount, commission, status, escrow, paid_at, release_at)
  values
    (l2, buyer_id, seller_id, 25.00, 1.25, 'shipped', 'held', now() - interval '1 hour', now() + interval '2 days 23 hours'),
    (l3, buyer_id, seller_id, 90.00, 4.50, 'paid',    'held', now() - interval '10 minutes', now() + interval '3 days');

  -- 1 active rental
  insert into public.rentals (listing_id, renter_id, owner_id, start_date, end_date, rental_fee, deposit_rate, deposit_amount, commission, status, deposit_status, paid_at, deposit_release_at)
  values
    (l1, renter_id, seller_id, current_date, current_date + 3, 105.00, 0.60, 1080.00, 10.50, 'active', 'held', now(), (current_date + 3) + interval '2 days');

  -- Wallet ledger seed (so seller wallet shows history)
  insert into public.wallet_ledger (user_id, type, amount, reference) values
    (seller_id, 'credit', 47.50, 'seed:completed-order'),
    (seller_id, 'credit', 12.75, 'seed:completed-order'),
    (seller_id, 'credit', 22.40, 'seed:completed-rental'),
    (buyer_id,  'debit',  25.00, 'seed:order l2');
end $$;

-- Default commission config
insert into public.commission_config (category, sale_rate, deposit_rate) values
  ('electronics',         0.08, 0.60),
  ('fashion',             0.05, 0.40),
  ('furniture',           0.05, 0.40),
  ('books',               0.05, 0.40),
  ('other',               0.05, 0.40),
  ('premium_electronics', 0.08, 0.60),
  ('smart_gadgets',       0.08, 0.60),
  ('high_value_flagged',  0.08, 0.75)
on conflict (category) do nothing;
