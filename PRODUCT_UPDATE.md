# TrustBazaar — Product & Engineering Status

**Last updated:** 2026-07-28, by Claude (Anthropic) working with Shafayat.
**Purpose of this file:** ground truth for any AI agent (or human) picking up this repo cold. Read this before trusting migration files, code comments, or your own assumptions about what's "done" — several things in this repo look finished but were silently broken until this session, in ways that produced no errors until you actually exercised the flow. Verify against the running app / live DB before making claims, don't just read the code and assume.

---

## 1. What TrustBazaar is

A trust-first marketplace MVP: users buy/sell/rent items with money held in escrow, a Trust Score that moves with every completed deal, and a dispute-resolution flow for when things go wrong. See `PRD.md` and `DEV_CONTRACT.md` for the original product spec — those are the intent; this file is the as-built reality.

## 2. Stack

- **Frontend:** React 18 + TypeScript + Vite, Tailwind, React Router, TanStack Query, Zustand (`frontend/`)
- **Backend:** Flask 3 + Flask-JWT-Extended, `backend/`, dev server on port 5001
- **Database/Auth:** Supabase (Postgres + Supabase Auth). Backend talks to Postgres via `supabase-py` using the **service-role key** (bypasses RLS). Frontend never talks to Supabase directly — everything goes through the Flask API.
- **Dev proxy:** Vite proxies `/api/*` → `http://localhost:5001` (see `frontend/vite.config.ts`). This means the frontend does **not** need `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set for local dev to work — it never calls Supabase directly.

## 3. Running it locally

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in real Supabase project values — ask Shafayat for them, not committed to git
python run.py           # serves on :5001

# Frontend
cd frontend
npm install
npm run dev              # serves on :5173, proxies /api to :5001
```

`backend/.env` is gitignored — it holds `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`. **Get the real values from Shafayat directly** (Slack/WhatsApp/whatever) — do not invent placeholder-looking values and assume the app works, it won't connect to any real data.

Demo accounts (seeded, password `demo1234` for all): `buyer@demo.com`, `seller@demo.com`, `renter@demo.com`, `admin@demo.com` (this one has `is_admin = true`).

## 4. What's verified working right now (this session, 2026-07-28)

Verified end-to-end against the **live Supabase DB**, not just read from source:

- Signup → creates a real Supabase Auth user + `public.users` row (via DB trigger) → returns a working session token
- Login → same
- `/auth/me` with the token from either signup or login
- Create listing (persists to `listings` table)
- Buy a listing (creates an `orders` row, escrow held) — **this was broken and is now fixed, see §5.2, don't reintroduce the bug**
- Rent a listing, return it, and have the owner confirm return + release the deposit (full lifecycle: `active` → `returned` → `completed`) — **this whole chain was broken and is now fixed, see §5.3 and §5.4, don't reintroduce these bugs**
- `GET /api/listings/mine` — new endpoint, returns a seller's own listings across all statuses
- Admin routes (`/api/admin/*`) correctly reject non-admins with 403 and allow `is_admin=true` users
- Frontend Dashboard page (`/dashboard`) renders my listings/orders/rentals/wallet/trust score
- Related products section on listing pages (same-category listings, excludes current one)
- Checkout review page (`/checkout/:id`) — item summary, live commission/seller-payout preview (`GET /listings/:id` now returns `commission_rate`, computed the same way `create_order`/`create_rental` compute it, so the preview can't drift from what's actually charged), explicit "Pay" action instead of charging instantly on the listing page's Buy click. Still backed by `MockPaymentProvider` — see §9 for SSLCommerz status.
- `create_order` now rejects buying a `rent`-type listing outright (previously only blocked on `status != active`, never checked `listing_type` — found while testing the checkout flow)

**Not verified this session** — exists in code, looks reasonable on read, but nobody exercised it end-to-end recently: disputes (`routes/disputes.py` + admin dispute resolution), wallet payouts (`routes/wallet.py`), trust score computation (`services/trust_score_engine.py`), photo upload (`routes/upload.py`). Don't assume these are bug-free just because they compile and have no obvious issues on read — the bugs in §5 also looked fine on read, and the rentals one (§5.3) sat undetected through an entire prior session of "verified working" claims because nobody actually completed a rental purchase, only read the code.

## 5. Two critical bugs fixed this session — know these before touching auth/db code

### 5.1 Signup/login were returning Supabase's own session token, not a token the backend accepts

`POST /auth/signup` and `POST /auth/login` used to hand the frontend Supabase Auth's own session JWT (ES256-signed by Supabase). But every protected Flask route uses `@jwt_required()` from Flask-JWT-Extended, which only accepts HS256 tokens signed with the app's own `JWT_SECRET_KEY`. So a "successful" login produced a token that failed on the very next authenticated call, with `"The specified alg value is not allowed"`.

**Fix:** `routes/auth.py` now mints its own local token via `create_access_token(identity=res.user.id)` after a successful Supabase Auth call, same pattern the OTP flow always used. If you ever see that "alg value is not allowed" error again, this is the first place to check — someone probably reintroduced a raw Supabase token somewhere.

### 5.2 The shared Supabase admin client must never have `.auth.*` called on it

This one is subtle and will bite you if you're not careful. `backend/app/extensions.py` holds a single, process-wide `supabase_admin` client built with the **service-role key**, specifically so it bypasses Postgres RLS for backend writes (orders, rentals, wallet_ledger, disputes have *no* RLS insert policy for regular users by design — see `supabase/migrations/009_rls_policies.sql` — the backend is supposed to be the only writer).

`supabase-py`'s GoTrue client silently swaps that shared client's underlying PostgREST session to whichever user's JWT last called `.auth.sign_in_with_password()` or `.auth.sign_up()` **on that same client instance**. Because `supabase_admin` is a singleton reused across every request, calling those methods on it inside the login/signup routes permanently downgraded it from "service role, bypasses RLS" to "some random user's own restricted session" — for every user's request, not just the one who logged in — until the next login/signup call swapped it again.

Symptom: buying/renting/disputing would randomly start failing with `postgrest.exceptions.APIError: ... new row violates row-level security policy for table "orders"` (500 error), and it would only start happening *after* someone logged in — making it look intermittent/environment-specific when it was 100% reproducible once you knew the trigger.

**Fix:** `extensions.py` now exposes `get_supabase_auth_client()` — a fresh, throwaway client built with the **anon key**, created new per call, used only for `.auth.sign_up()` / `.auth.sign_in_with_password()`. `get_supabase()` (the shared service-role singleton) is now used only for `.table()` operations and must stay that way.

**Rule going forward:** if you ever need to call `sb.auth.*` anywhere in the backend, use `get_supabase_auth_client()`, never `get_supabase()`. If a future refactor touches `extensions.py`, keep these separate.

### 5.3 `create_rental` crashed on every listing that required a deposit

`listings.deposit_required` is a **boolean** column ("does this rental need a deposit at all") — see §6, the naming is misleading. `routes/rentals.py`'s `create_rental` used to do `Decimal(str(listing.data["deposit_required"]))` as if that column held a money amount. `Decimal(str(True))` raises `decimal.InvalidOperation` — so any rental attempt on a listing with `deposit_required = true` (i.e. every seeded rental listing) 500'd immediately. This sat there un-noticed through the "Two critical bugs" section above being written and believed complete, because nobody actually completed a rental purchase — only read the code and the (passing) parts of the flow.

**Fix:** the deposit is now computed as `listing.price * listing.deposit_rate` when `deposit_required` is true, `0` otherwise — consistent with how deposits are computed/displayed everywhere else in the app (see `ListingDetail.tsx`'s `depositAmount`). Also added a 1–15 day rental duration bound (`RENTAL` days must be `1 <= days <= 15`), enforced both server-side (`create_rental`) and client-side (date pickers in the "Reserve rental dates" dialog).

**Lesson for whoever reads this next:** "the code compiles and the happy-path columns line up" is not the same as "this endpoint has been called." Prefer curling the actual endpoint with a real payload over reading the function and reasoning about it — this bug and the two above all looked completely fine on read.

### 5.4 The rental return/deposit-release flow was a dead end — fixed, but with a known gap left open

Fixing §5.3 made `create_rental` succeed, which immediately surfaced that the *rest* of the rental lifecycle didn't work either:

- `create_rental` set the initial status to `"paid"`. Per `VALID_RENTAL_TRANSITIONS` in `services/escrow_state_machine.py`, `"returned"` is only reachable from `"active"` — and **nothing anywhere in the codebase** (no route, no scheduled task — `app/tasks/` exists but is empty despite `APScheduler` being a dependency) ever transitioned a rental from `"paid"` to `"active"`. So `mark_returned()` could never succeed, meaning renters could never return an item and owners could never get the deposit released. The frontend made this worse by gating the "Mark as returned" button on `status === "paid"` — showing it at the one point where clicking it would fail, and hiding it once the (unreachable) `"active"` state was hit.
  **Fix:** `create_rental` now starts rentals directly at `"active"` (there's no separate "handover" step in this MVP — matches how the seed data already portrayed it). `RentalDetail.tsx`'s button now gates on `"active"` to match.
- `confirm_return` tried to write a `completed_at` column that **does not exist** on the live `rentals` table (same class of drift as §6 — `orders` has `completed_at`, `rentals` doesn't). 500'd every time. Removed the write.
- `RentalDetail.tsx` compared `deposit_status` to `"claimed"` for the danger-badge color; the real enum value is `"forfeited"`. Cosmetic, but the badge could never actually turn red. Fixed.
- **Left as a known gap, not fixed:** `confirm_return` always does a full deposit refund. The "Reserve/Confirm return" dialog in the frontend offers "Partial refund" and "Claim full deposit" options and sends `deposit_action` + `partial_amount` in the request body, but the backend endpoint never reads the body at all — those options are silently ignored. Implementing the actual payout split for partial/claim is a business-rule decision (how is a disputed claim mediated vs. an owner-asserted partial deduction with no renter pushback?), not a bug fix, so I didn't invent one. Whoever picks this up should either wire it up or remove those options from the dialog until it's designed.

Verified end-to-end via curl: create rental → renter marks returned → owner confirms return (full refund) → status lands on `completed`/`deposit_status: refunded`, wallet ledger entries created for both parties.

## 6. Known schema drift — don't trust `supabase/migrations/002_listings.sql` blindly

The live `listings` table's actual columns are: `photo_urls` (not `photos`), `rent_per_day` (not `rental_price_per_day`), `deposit_required` (boolean flag, not an amount — confusingly named), `deposit_rate`, and there is **no** `condition` or `declared_value` column. `supabase/migrations/002_listings.sql` describes an older/different shape that does not match what's actually live.

`SEED_DEMO_FIXED.sql` matches the real live schema (it has a comment saying so) — `SEED_DEMO.sql` and `supabase/seed.sql` do not and would fail if run against the current DB. If you need to know the real shape of a table, check `backend/app/routes/listings.py`'s `_LISTING_FIELDS` / `_serialize_listing`, or query the live DB directly — don't take the migrations folder at face value. This drift predates this session; nobody has reconciled it yet.

## 7. Currency

Prices are BDT (৳), not USD. Range convention for demo listings: ৳100–৳15,000. The formatter is `fmtMoney()` in `frontend/src/lib/utils.ts` — it's the single source of truth for money display, don't hardcode `$` anywhere.

## 8. Frontend routes/pages of note

- `/dashboard` — the logged-in home base (added this session): my listings (with edit/remove), recent orders/rentals, wallet balance, trust score. This is where login/signup now redirect by default (previously `/browse`).
- `/create` — list an item; also handles editing via `/create?edit=<listingId>` (added this session)
- `/admin` — dispute queue + commission config, now actually gated behind `user.is_admin` both client-side (route guard + nav link visibility in `Layout.tsx`) and server-side (`admin_required` decorator in `routes/admin.py`). Previously anyone logged in could reach it.
- `/checkout/:id` — review-before-pay step for buying (added this session); the "Reserve rental" dialog on the listing page already served this purpose for renting, so it wasn't touched.

## 9. Suggested next steps for whoever picks this up

- **SSLCommerz integration was requested but explicitly deferred**, not attempted blind: it's a redirect-based gateway (initiate → redirect to their hosted page → success/fail/cancel callback → IPN verification), a meaningfully different shape than `PaymentProvider.charge()`'s synchronous return-success-or-fail today. Needs real sandbox `store_id`/`store_password` from developer.sslcommerz.com before anyone should write the adapter — implementing against guessed request/response shapes would just be another unverified "looks done" trap like the ones in §5. Get credentials first, then build `SSLCommerzAdapter` against `PaymentProvider`'s interface, then add the redirect/callback routes.
- Cart stayed single-item-checkout by explicit choice (not multi-item) — see the checkout flow in §4/§8. If multi-item cart is wanted later, it's a real schema/backend change (orders currently map 1:1 to a listing), not a frontend-only add.
- Exercise the dispute flow and wallet payout flow end-to-end against the live DB the way §4 was verified — they're unverified, not necessarily broken (the rental flow *was* in this category and turned out to be broken, see §5.3, so don't assume these are fine either).
- Reconcile `supabase/migrations/002_listings.sql` (and check the other migration files for the same drift) against the live schema, or delete/rewrite the stale ones so they stop being misleading.
- `MockPaymentProvider` (`services/payment_provider.py`) always succeeds and does nothing real — fine for demo, but don't assume any real payment integration exists.
- `.puku/` directory is a local AI-tool cache (embeddings DB etc.), gitignored, not part of the app.
