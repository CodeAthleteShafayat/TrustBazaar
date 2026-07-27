-- SEED_DEMO_FIXED.sql — demo data tuned for the @demo.com accounts we just created.
-- Run AFTER CLEAN_MIGRATIONS.sql succeeds.
-- Pre-req: the 4 auth users buyer@demo.com, seller@demo.com, renter@demo.com, admin@demo.com exist
-- (the public.handle_new_user() trigger will have auto-created matching public.users rows).

do $$
declare
  buyer_id uuid;
  seller_id uuid;
  renter_id uuid;
  admin_id uuid;
  l1 uuid; l2 uuid; l3 uuid; l4 uuid; l5 uuid;
  l6 uuid; l7 uuid; l8 uuid; l9 uuid; l10 uuid;
begin
  select id into buyer_id  from auth.users where email = 'buyer@demo.com';
  select id into seller_id from auth.users where email = 'seller@demo.com';
  select id into renter_id from auth.users where email = 'renter@demo.com';
  select id into admin_id  from auth.users where email = 'admin@demo.com';

  if buyer_id is null or seller_id is null or renter_id is null then
    raise notice 'Demo users not yet created — sign them up first, then re-run.';
    return;
  end if;

  -- Backfill phone numbers + trust scores for the demo accounts
  update public.users set phone = '+8801700000001', trust_score = 45, trust_tier = 'Reliable'  where id = buyer_id;
  update public.users set phone = '+8801700000002', trust_score = 95, trust_tier = 'Top Rated' where id = seller_id;
  update public.users set phone = '+8801700000003', trust_score = 72, trust_tier = 'Trusted'   where id = renter_id;
  if admin_id is not null then
    update public.users set phone = '+8801700000004', is_admin = true, trust_score = 100, trust_tier = 'Top Rated' where id = admin_id;
  end if;

  -- 10 listings across categories — schema: photo_urls (text[]), rent_per_day, deposit_required, deposit_rate, status, listing_type in ('sale','rent'), no 'condition' col, no 'declared_value' col
  -- Prices in BDT (Taka), ranging 100–15000.
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status, rent_per_day, deposit_required, deposit_rate)
  values
    (seller_id, 'Sony A7 IV mirrorless camera',          'premium_electronics', 'rent',  15000.00, 'Lightly used, body only. Original box.',     ARRAY['https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=800'], 'active', 850.00, true,  0.60) returning id into l1;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Leather wallet — brown',                'fashion',             'sale',    800.00, 'Genuine leather, gently used.',            ARRAY['https://images.unsplash.com/photo-1627123424574-724758594e93?w=800'], 'active') returning id into l2;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'IKEA Markus office chair',              'furniture',           'sale',   2800.00, 'Black mesh back, good condition.',         ARRAY['https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=800'], 'active') returning id into l3;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Clean Code — Robert C. Martin',         'books',               'sale',    500.00, 'Softcover, no markings.',                  ARRAY['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800'], 'active') returning id into l4;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status, rent_per_day, deposit_required, deposit_rate)
  values
    (seller_id, 'DJI Mini 3 Pro drone',                  'premium_electronics', 'rent',  12000.00, 'Includes 3 batteries, no flyaway history.', ARRAY['https://images.unsplash.com/photo-1473968512647-3e447244af8f?w=800'], 'active', 600.00, true, 0.60) returning id into l5;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Apple Watch Series 8 — 45mm',           'smart_gadgets',       'sale',   7500.00, 'Midnight aluminum, sport band.',           ARRAY['https://images.unsplash.com/photo-1546868871-7041f6a1d193?w=800'], 'active') returning id into l6;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Handmade ceramic mugs (set of 4)',      'other',              'sale',   1200.00, 'Speckled stoneware, dishwasher safe.',     ARRAY['https://images.unsplash.com/photo-1514228748747-15422f59d6d4?w=800'], 'active') returning id into l7;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Open to exchange — acoustic guitar',    'other',              'sale',   4500.00, 'Looking for an electric guitar or amp.',   ARRAY['https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=800'], 'active') returning id into l8;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status, rent_per_day, deposit_required, deposit_rate)
  values
    (seller_id, 'Meta Quest 3 — 128GB',                  'smart_gadgets',       'rent',   9500.00, 'Includes charging dock and silicone cover.', ARRAY['https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800'], 'active', 450.00, true, 0.60) returning id into l9;
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Sony WH-1000XM4 headphones',            'electronics',         'sale',  6000.00, 'Original pads replaced last month.',       ARRAY['https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800'], 'active') returning id into l10;

  -- Preowned essentials + campus rentals — feeds the "Related products" section on listing pages.
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Preowned study chair',                  'furniture',           'sale',  1200.00, 'Sturdy wooden study chair, light wear, no wobble.', ARRAY['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800'], 'active');
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Preowned study table',                  'furniture',           'sale',  2800.00, 'Compact study table, some scuffs on the surface, sturdy legs.', ARRAY['https://images.unsplash.com/photo-1538688525198-9b88f6f53126?w=800'], 'active');
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Ceiling fan (used)',                    'electronics',         'sale',  1500.00, '56-inch ceiling fan, works perfectly, removed during room renovation.', ARRAY['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800'], 'active');
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Water filter (used)',                   'other',               'sale',  2200.00, 'Tabletop water filter with new candle installed last month.', ARRAY['https://images.unsplash.com/photo-1560423243-8f7d5288b3ba?w=800'], 'active');
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status)
  values
    (seller_id, 'Study lamp — LED',                      'electronics',         'sale',   450.00, 'Adjustable LED study lamp, 3 brightness levels, USB powered.', ARRAY['https://images.unsplash.com/photo-1524634126442-357e0eac3c14?w=800'], 'active');
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status, rent_per_day, deposit_required, deposit_rate)
  values
    (seller_id, 'Bicycle — for rent',                    'other',               'rent',  6000.00, 'Single-speed campus bicycle, good tires, basket included.', ARRAY['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800'], 'active', 80.00, true, 0.50);
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status, rent_per_day, deposit_required, deposit_rate)
  values
    (seller_id, 'Textbook — for rent',                   'books',               'rent',   500.00, 'Semester textbook, available for rent by chapter or full term.', ARRAY['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=800'], 'active', 15.00, true, 0.30);
  insert into public.listings (seller_id, title, category, listing_type, price, description, photo_urls, status, rent_per_day, deposit_required, deposit_rate)
  values
    (seller_id, 'Campus presentation kit — for rent',    'electronics',         'rent',  8000.00, 'Mini projector + HDMI cable + wireless presenter remote, ready for group presentations.', ARRAY['https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800'], 'active', 300.00, true, 0.50);

  -- 2 in-flight orders (dashboard has content immediately)
  insert into public.orders (listing_id, buyer_id, seller_id, amount, commission, status, escrow, paid_at, release_at)
  values
    (l2, buyer_id, seller_id, 800.00, 40.00,  'shipped', 'held', now() - interval '1 hour',    now() + interval '2 days 23 hours'),
    (l3, buyer_id, seller_id, 2800.00, 140.00, 'paid',    'held', now() - interval '10 minutes', now() + interval '3 days');

  -- 1 active rental
  insert into public.rentals (listing_id, renter_id, owner_id, start_date, end_date, rental_fee, deposit_rate, deposit_amount, commission, status, deposit_status, paid_at, deposit_release_at)
  values
    (l1, renter_id, seller_id, current_date, current_date + 3, 2550.00, 0.60, 9000.00, 255.00, 'active', 'held', now(), (current_date + 3) + interval '2 days');

  -- Wallet ledger seed (so seller wallet shows history)
  insert into public.wallet_ledger (user_id, type, amount, reference) values
    (seller_id, 'credit', 1500.00, 'seed:completed-order'),
    (seller_id, 'credit', 400.00,  'seed:completed-order'),
    (seller_id, 'credit', 700.00,  'seed:completed-rental'),
    (buyer_id,  'debit',  800.00,  'seed:order l2');
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