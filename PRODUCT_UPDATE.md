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
- Full dispute lifecycle: buyer disputes a shipped order → admin resolves it (refund/release/split) → order status + escrow update correctly → wallet ledger entry lands — **this was completely broken (100% failure rate) and is now fixed, see §5.7, don't reintroduce the field-name mismatch**
- Seller "remove my listing" and admin "remove any listing" — **both were broken (wrong status value, 500 on every call) and are now fixed, see §5.8**
- Frontend Dashboard page (`/dashboard`) renders my listings/orders/rentals/wallet/trust score
- Related products section on listing pages (same-category listings, excludes current one)
- Checkout review page (`/checkout/:id`) — item summary, live commission/seller-payout preview (`GET /listings/:id` now returns `commission_rate`, computed the same way `create_order`/`create_rental` compute it, so the preview can't drift from what's actually charged), explicit "Pay" action instead of charging instantly on the listing page's Buy click. Still backed by `MockPaymentProvider` — see §9 for SSLCommerz status.
- `create_order` now rejects buying a `rent`-type listing outright (previously only blocked on `status != active`, never checked `listing_type` — found while testing the checkout flow)
- OTP login: request → real per-target code → verify → valid token. The old universal-bypass code (`123456`, no binding to target) no longer works — see §10.1, this was a live account-takeover vector, not a minor bug.
- File upload: JPEG accepted and stored under a server-generated path, disallowed MIME types (tested with `.html`) rejected — see §10.6.
- Order escrow auto-release: a real stuck order (paid, release window long passed, buyer had no available action) correctly auto-released to `completed`/`released` with a single wallet ledger entry on next fetch — see §11.

**Not verified this session** — exists in code, looks reasonable on read, but nobody exercised it end-to-end recently: wallet payouts (`routes/wallet.py`), trust score computation (`services/trust_score_engine.py`). Don't assume these are bug-free just because they compile and have no obvious issues on read — several bugs fixed this session (§5, §10, §11) also looked fine on read, and the rentals one (§5.3) sat undetected through an entire prior session of "verified working" claims because nobody actually completed a rental purchase, only read the code. **Rentals also have the auto-release gap** described in §11 — not fixed, don't assume it's fine.

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

### 5.5 Users could get silently logged out just from normal navigation — found while testing mobile, not mobile-specific

`App.tsx` runs a background "is this session still good" check (`GET /auth/me`) whenever `token` changes, and used to do `.catch(() => clear())` — treating *any* failure of that request as "the session is invalid, log the user out." That's wrong: if the user navigates away (a hard refresh, clicking a link fast, even a Playwright test doing back-to-back `page.goto()`) while that request is still in flight, the browser cancels it, the fetch promise rejects, and the `.catch` fired anyway — wiping a perfectly valid session and `localStorage` along with it. This is not an edge case; it's triggered by ordinary fast browsing, and it silently signs people out with no error message.

**Fix:** `App.tsx` now only calls `clear()` when the error is a genuine `ApiError` with `status === 401` (a real "token rejected" response from the server) — see the `instanceof ApiError` check. Any other failure (network hiccup, aborted-by-navigation, 5xx) is left alone; the session stays intact and the next check will just retry.

**Also fixed alongside it (defense in depth, not the root cause):** `lib/auth.ts`'s zustand `persist` hydrates from `localStorage` asynchronously (a microtask), so `token` reads as `null` for a brief moment on every hard page load even when a valid session exists. Added a `hasHydrated` flag (`onRehydrateStorage`) and made `Protected`/`AdminProtected` in `App.tsx` wait for it before deciding whether to redirect to `/login`. This wasn't the actual cause of the logout bug above (that was purely the `.catch` issue), but it's a real, separate race that was worth closing while in this code.

**If a user ever reports "I keep getting logged out for no reason" again:** check `App.tsx`'s `.catch` first — don't assume it's fixed forever, and don't reintroduce a bare `.catch(() => clear())` anywhere in this codebase.

### 5.6 Mobile layout: `<Link>` wrapping a `<Card>` doesn't fill its column — cards overflowed off-screen

Multiple pages (`Orders.tsx`, `Rentals.tsx`, `Dashboard.tsx`) wrap a whole `Card` in a `<Link>` to make the row clickable, e.g. `<Link to={...}><Card>...</Card></Link>`. React Router's `Link` renders an `<a>` tag, which is `display: inline` by default. An inline element doesn't give its block children a real width to fill, so instead of respecting its grid/flex column, the `Card` shrank-to-fit whatever content was inside it — and once that content included any `whitespace-nowrap` text (a date range, "created X ago", etc.) that couldn't shrink, the card just grew wider than the viewport and got clipped by `overflow-x-hidden` on the root layout div, invisibly. Screenshots of it looked like a plain "badge cut off" cosmetic bug; the real cause was one layer up.

Compounding this: even after adding `className="block"` to the `Link`, the card *still* overflowed, because the `motion.div` (framer-motion) wrapping each row is a direct CSS Grid item, and **grid items default to `min-width: auto`** (same footgun as flexbox's default) — meaning a grid item won't shrink below its content's intrinsic minimum width even when the track itself is sized correctly. Had to add `min-w-0` to the grid item itself, not just the flex children inside it, before the nowrap text was actually forced to respect the column width.

**Rule going forward:** any `<Link>` wrapping a block-level layout (a `Card`, a flex row meant to fill its container) needs `className="block"` explicitly — `ListingCard.tsx` already had this right (`className="group block"`), the others didn't. And any grid item or flex item containing text that must truncate/wrap needs `min-w-0` at *every* level of the nesting chain (the grid item, the flex wrapper, and the specific text element with `truncate`) — adding it at just one level looks like it should be enough and isn't; verify by checking the actual rendered `getBoundingClientRect()` width of each ancestor, not just by eyeballing a screenshot, since `overflow-x-hidden` on the root layout will silently clip the evidence rather than show a scrollbar.

### 5.7 The admin panel's dispute resolution was completely broken — 100% failure rate, not an edge case

`Admin.tsx` sent `{ resolution: "resolved_buyer" | "resolved_seller" | "resolved_split", refund_amount }` to `POST /admin/disputes/:id/resolve`. The backend (which is the side that actually matches the live DB's `dispute_status`/`dispute_resolution` enums — see `005_disputes.sql`) reads `body.get("decision")` and requires it to be exactly `"refund" | "release" | "split"`. Since the frontend never sent a `decision` key at all, every single resolve attempt hit the very first validation check and 400'd. There was no partial breakage here — the core feature of the admin panel had never worked, in any commit, until this session. The frontend's `Dispute` type was also wrong in the same way: it invented `status` values (`resolved_buyer` etc.) that don't exist in the DB enum (the real enum is just `open | under_review | resolved`, with the buyer/seller/split distinction living in a separate `resolution` column), and referenced a `description` field and `refund_amount` field that don't exist on the table at all (the real columns are `reason`, `split_buyer`, `split_seller`).

**Fix:** rewrote `Admin.tsx`'s resolve dialog and `client.ts`'s `Dispute` type to match the schema exactly (`decision` + `admin_notes` + `split_buyer`/`split_seller`, `status: "open"|"under_review"|"resolved"`). Verified end-to-end: created a real order → shipped it → disputed it → resolved it as admin → confirmed the order's `status`/`escrow` flipped to `refunded` and a matching `wallet_ledger` entry landed for the buyer.

**Also found and fixed while testing this:** `OrderDetail.tsx` showed the "Open dispute" button when `order.status === "paid"`, but the backend's state machine only allows the `disputed` transition from `"shipped"` (see `VALID_ORDER_TRANSITIONS` in `services/escrow_state_machine.py`) — clicking it before the seller shipped always 409'd. Narrowed the button to only show at `"shipped"`, matching the backend's existing (intentional-looking) rule rather than changing backend business logic to match the UI. If disputing before shipment (e.g. "seller never shipped") should actually be supported, that's a product decision for a human to make, not something to infer from a UI bug.

**Admin panel is now a real 4-tab console** (`Admin.tsx`), with a stats strip (users/active listings/open disputes/completed GMV via `GET /admin/stats`): Disputes (fixed), Commission (new UI — the backend endpoints existed with zero frontend before this), Users (search + edit dialog: `display_name`, `phone`, `is_admin` toggle), Listings (search + status filter + edit dialog: title/description/category/price/rent_per_day/status/location, plus archive). New backend endpoints: `GET/PATCH /admin/users/:id`, `GET/PATCH/DELETE /admin/listings/:id`, `GET /admin/stats`.

`trust_score` is deliberately **not** editable from the Users dialog — `routes/trust_score.py`'s `_score_response` recomputes and overwrites `users.trust_score`/`trust_tier` on *every* profile view (see the `sb.table("users").update(...)` at the end of that function), so a manual edit would silently vanish the next time anyone looked at the profile. If manual trust overrides are ever wanted, that needs a real design (a separate "locked" flag the engine respects), not a raw column edit.

`is_admin` editing has a server-side self-lock: an admin can't remove their own admin access via `PATCH /admin/users/:id` (checked in `admin_update_user`) — without it, a careless edit could lock every admin out of the console with no way back in short of a direct DB edit.

### 5.8 `listings.status` schema drift — "removed" isn't a real value; it's `"archived"`

The valid values (confirmed empirically against the live DB — a `CHECK` constraint, not a documented enum anywhere in the migrations folder) are **`active | sold | rented | archived`**. `routes/listings.py`'s `delete_listing` (the endpoint behind every seller's "remove my listing" button, including the Dashboard trash icon added earlier this session) was setting `status = "removed"`, which doesn't exist — every single call 500'd with a Postgres check-constraint violation (`23514`). This had been silently broken since the Dashboard listing-management UI was built; nobody had actually clicked delete on a real listing end-to-end until this session's admin panel work surfaced it. The new `admin_remove_listing` endpoint had the identical bug when it was first written (copy-pasted the same wrong value) and was caught immediately by testing rather than shipped broken.

**Fix:** both `delete_listing` (`routes/listings.py`) and `admin_remove_listing` (`routes/admin.py`) now set `status = "archived"`. Frontend `LISTING_STATUS_VARIANT` maps and the `Listing` type in `client.ts` updated to match (also dropped `"draft"`, which was in the old type but was never a real value either — confirmed by testing it against the live constraint, same way `"removed"` was disproven).

**If you need to know a real enum/constraint's valid values and the migrations folder doesn't match live behavior (§6 below) — don't guess from a type file or a migration; insert a disposable test row via the service-role client and try candidate values until one succeeds, then delete the row. That's how both drift bugs in this section were actually confirmed, not assumed.**

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
- **Mobile nav was completely broken until this session** — `Layout.tsx`'s header hid the entire nav (`hidden md:flex`, no fallback) below 768px, so logged-in users on a phone had no way to reach Dashboard/Orders/Rentals/Wallet/Admin at all except by typing the URL directly. Rebuilt with a hamburger menu (`menuOpen` state in `Layout.tsx`) that surfaces search + full nav + List item + sign out below the `lg` breakpoint. If you're touching `Layout.tsx`, verify at a real mobile viewport (375px) — see §5.6 for how easy it is for cards elsewhere on the page to silently overflow off-screen without a visible scrollbar (`overflow-x-hidden` on the root layout div clips the evidence).

## 9. Suggested next steps for whoever picks this up

- **SSLCommerz integration was requested but explicitly deferred**, not attempted blind: it's a redirect-based gateway (initiate → redirect to their hosted page → success/fail/cancel callback → IPN verification), a meaningfully different shape than `PaymentProvider.charge()`'s synchronous return-success-or-fail today. Needs real sandbox `store_id`/`store_password` from developer.sslcommerz.com before anyone should write the adapter — implementing against guessed request/response shapes would just be another unverified "looks done" trap like the ones in §5. Get credentials first, then build `SSLCommerzAdapter` against `PaymentProvider`'s interface, then add the redirect/callback routes.
- Cart stayed single-item-checkout by explicit choice (not multi-item) — see the checkout flow in §4/§8. If multi-item cart is wanted later, it's a real schema/backend change (orders currently map 1:1 to a listing), not a frontend-only add.
- Exercise the wallet payout flow end-to-end against the live DB the way §4 was verified — it's unverified, not necessarily broken (the rental flow and the dispute-resolution flow *were* in this category too and both turned out to be broken, see §5.3 and §5.7, so don't assume this one is fine either).
- The Users tab supports editing `display_name`/`phone`/`is_admin` but has no ban/suspend action and no way to force-reset a password — that's a scope decision made this session (see §5.7-adjacent notes above), not an oversight. If moderation/account-lockout actions are wanted, that's new product surface, not a bug fix.
- Reconcile `supabase/migrations/002_listings.sql` (and check the other migration files for the same drift) against the live schema, or delete/rewrite the stale ones so they stop being misleading.
- `MockPaymentProvider` (`services/payment_provider.py`) always succeeds and does nothing real — fine for demo, but don't assume any real payment integration exists.
- `.puku/` directory is a local AI-tool cache (embeddings DB etc.), gitignored, not part of the app.
- **Rentals have the identical missing-auto-release gap that orders had** (see §11) — `deposit_release_at` on a rental is never acted on by anything either. Not fixed this session (scope was the order flow specifically, triggered by a real user report); do the same lazy-eval-on-read fix in `routes/rentals.py` before relying on rental deposit auto-release. Be careful: `deposit_release_at` on rentals means something different from `release_at` on orders (it's the *deposit claim window after return*, not "release the rental fee") — don't copy the orders fix mechanically without re-reading what should actually happen at each point in the rental lifecycle.

## 10. Security audit + fixes (2026-07-28, pre-deployment)

The user asked for a security review before deploying (frontend → Vercel, backend → TBD). This wasn't a diff review — full audit of what shipped. One finding was critical and **live-exploitable at the time it was found** (proven against the running local backend, not theoretical):

### 10.1 OTP login was a complete authentication bypass — anyone could log in as anyone

`services/otp_service.py`'s `verify()` used to be `return code == "123456"` — a hardcoded constant with **zero binding to who requested it or which account**. Proof of exploit at the time: `curl -X POST /api/auth/otp/verify -d '{"target":"admin@demo.com","code":"123456"}'` returned a valid access token for the admin account, no password, no real code, nothing — just knowing an email address. The login page even displayed "Demo code: 123456" to every visitor, advertising it. This was reachable by anyone the moment the backend was ever exposed publicly; it was only "safe" by accident because nothing was deployed yet.

**Also discovered while fixing it:** the OTP feature was independently *broken* on top of being insecure — `client.ts`'s `requestOtp`/`verifyOtp` sent `{email}` while the backend expected `{target}`, and `Login.tsx` read `res.debug_code` while the backend only ever sent `res.dev_code`. So in practice the insecure universal-code path (calling the API directly, bypassing the broken frontend) was the *only* way OTP login ever worked at all.

**Fix** (`services/otp_service.py`): `MockOtpService` now generates a random 6-digit code per `request()` call, stores it in-memory keyed to the exact `target` string with a 10-minute expiry, and `verify(target, code)` checks it's the right code for that specific target, not expired, and consumes it (one-time use). `auth.py`'s `/otp/request` only includes `dev_code` in the response when `current_app.config["DEBUG"]` is true (see §10.2) — in production, nothing is ever returned, so the feature genuinely won't work end-to-end until a real SMS/email provider (Twilio/SMTP, per the original "Phase 2" comment) is wired up. That's an intentional fail-closed choice: a non-functional-but-safe OTP path beats a functional-but-exploitable one. Also fixed the field-name mismatches so the flow actually works in dev/demo mode now.

**Also fixed while in this file:** `/otp/verify`'s target lookup used to be `sb.table("users").select(...).or_(f"email.eq.{target},phone.eq.{target}")` — an f-string spliced directly into a PostgREST filter expression, with `target` being fully attacker-controlled. Replaced with two separate `.eq()` calls (parameterized, not string-built) so a `target` containing filter-syntax characters (commas, dots) can't manipulate which row gets matched.

### 10.2 Flask was running with `debug=True` unconditionally

Confirmed exploitable path: every 500 error this whole session rendered a full Werkzeug interactive debugger with source snippets, local variable values, and file paths — visible to whoever triggered the error, not just the developer. The debugger is also remote-code-execution-capable if its PIN (printed to server stdout, which many hosting platforms make accessible via a dashboard) is ever obtained.

**Fix:** `config.py` now derives `DEBUG` from `FLASK_ENV` (`DEBUG = not IS_PRODUCTION`); `run.py` reads `Config.DEBUG` instead of hardcoding `True`. Setting `FLASK_ENV=production` in the hosting platform's env vars is what actually turns this off — if that env var is ever missing in a real deployment, the app defaults to `development` (debug on), so **explicitly verify `FLASK_ENV=production` is set wherever this gets deployed**, don't assume it.

### 10.3 `SECRET_KEY`/`JWT_SECRET_KEY` silently fell back to `"dev-secret"`

That literal string is in this repo's git history on a public GitHub repo. If a production deploy ever forgot to set the real env var, anyone could forge valid JWTs — including ones claiming to be any user id, e.g. an admin — using a secret that's public knowledge.

**Fix:** `config.py`'s `_require_secret()` now raises `RuntimeError` at startup (refuses to boot) if `SECRET_KEY` isn't set via environment variable **and** `FLASK_ENV=production`. Local dev keeps the convenient fallback. This is fail-fast by design — a production deploy with a missing secret should crash immediately and loudly, not run silently insecure.

### 10.4 No rate limiting anywhere — brute force / credential stuffing / mass signup

Added `Flask-Limiter` (in-memory storage — fine for a single-process deploy; point `storage_uri` at Redis if this ever runs multi-worker, since in-memory limits aren't shared across processes). Applied: `/auth/login` 10/min, `/auth/signup` 5/hour, `/auth/otp/request` 5/min, `/auth/otp/verify` 10/min, `/upload/<bucket>` 20/min. All keyed by IP (`get_remote_address`). A `429` now returns the same `{error: {code, message}}` shape as every other error in this API (see the `@app.errorhandler(429)` in `__init__.py`) instead of Flask-Limiter's default plain-text response.

### 10.5 Dependency vulnerabilities (via `pip-audit` / `npm audit`)

Upgraded: `Flask` 3.0.3→3.1.3, `Flask-Cors` 4.0.1→6.0.5 (this one had **5** known CVEs — it's your CORS library, i.e. your main cross-origin defense, so this mattered more than most), `python-dotenv` 1.0.1→1.2.2, `react-router-dom` 6.30.4→7.18.1 (fixes an open-redirect bug in `<Link>`/`useNavigate` plus 3 others). Verified the CORS upgrade didn't change behavior (`Access-Control-Allow-Origin`/`-Methods` headers checked directly) and the router major-version bump didn't break anything (`tsc --noEmit` clean, dev server boots, this app only uses the classic `BrowserRouter`/`Routes`/`Route` API which v7 keeps fully supported).

**One remaining `npm audit` flag, deliberately not chased further:** `react-router-dom@7.18.1` (latest) still shows one high-severity advisory (GHSA-qwww-vcr4-c8h2, "RSC Mode CSRF Bypass"). It only applies to React Router's server-actions/RSC framework mode (`createBrowserRouter` with data loaders/actions, RSC bundler integration) — this app uses none of that, only the plain declarative `<Routes>`/`<Route>` API, so the vulnerable code path is never reached. Downgrading to the version `npm audit` suggests as a "fix" (7.11.0) is actually *worse* — it reintroduces the original open-redirect bugs this upgrade was meant to close. Latest is the correct choice here; don't let a future `npm audit fix --force` downgrade it.

**Not fixed, noted for later, dev-only impact:** `esbuild ≤0.24.2` (via `vite`) — "esbuild enables any website to send any requests to the dev server and read the response." Only exploitable if you're running `npm run dev` locally while browsing a malicious site simultaneously; doesn't affect the production build Vercel serves. Fixing it means a Vite 6→8 major bump, which wasn't worth the regression risk to chase in the same pass as everything else here.

### 10.6 File upload endpoint had no validation at all

`routes/upload.py` took `file.filename` — fully attacker-controlled — and spliced it directly into the storage path, with no file-type check and no size limit. **Fix:** MIME-type whitelist (JPEG/PNG/WebP/GIF only), 8MB per-file cap, and the filename is now always server-generated (`{uploader_uid}/{uuid4}.{ext}`) — client input never reaches the storage path, which also incidentally means one user can never collide with or overwrite another's upload. Added a global `MAX_CONTENT_LENGTH` (10MB) in `config.py` as a second layer independent of this one endpoint.

### 10.7 Other small hardening

- `POST /auth/signup` now rejects passwords under 8 characters server-side — previously only enforced client-side in `Signup.tsx`, trivially bypassed by calling the API directly.
- `JWT_ACCESS_TOKEN_EXPIRES` set explicitly to 7 days (was defaulting to Flask-JWT-Extended's 15-minute default with **no refresh-token flow implemented anywhere** — meaning every user would've been forcibly logged out every 15 minutes with no way back in short of re-entering credentials). 7 days is a deliberate MVP tradeoff given there's no refresh flow, not a "correct" answer — if a refresh-token flow gets built later, shorten this back down.

### 10.8 Deployment guidance given alongside this audit

- **Backend: not Vercel.** `requirements.txt` already ships `gunicorn`, meaning this was built to run as a persistent process, not a serverless function — that's Render/Railway/Fly.io territory. Added a `Procfile` (`web: gunicorn run:app --bind 0.0.0.0:$PORT`) for whichever of those gets picked.
- **Frontend: Vercel is fine.** No secrets, no XSS vectors, safe redirect handling found on inspection (`dangerouslySetInnerHTML`/`eval`/hardcoded-secret grep all came back empty). The one thing that must be set at deploy time: `VITE_API_URL` pointing at wherever the backend ends up — Vite's dev-server proxy (`vite.config.ts`) only exists locally, so without this env var the deployed frontend's `/api` calls go nowhere.
- Once both are deployed, update the backend's `FRONTEND_ORIGIN` env var to the real Vercel domain (CORS will reject the frontend otherwise) — this is a two-step, deploy-backend-then-frontend-then-update-backend-again sequence, not a one-shot.
- The Supabase **service-role key** (`SUPABASE_SERVICE_ROLE_KEY`) bypasses all RLS and is the single most powerful credential in this system. It must only ever exist as a backend environment secret on whichever platform is chosen — never in a `VITE_`-prefixed variable, never in the frontend bundle. Confirmed via `.env` never appearing in git history (checked the *full* history, not just current state) that this hasn't leaked so far.

## 11. Missing escrow auto-release mechanism — orders could get stuck at "paid"/"shipped" forever

Found via a real user report ("where is the release/dispute option" on an order stuck showing "Ready to release" with nothing clickable). `services/escrow_state_machine.py`'s `VALID_ORDER_TRANSITIONS` was designed to allow `"paid" → "completed"` directly, with the comment `# auto-release after window counts as -> completed` — and the UI (`EscrowTimer` countdown, "Ready to release" label) actively promises this happens. **Nothing anywhere ever triggered that transition.** No scheduled job exists (`app/tasks/` is empty despite `APScheduler` being a listed dependency) and `POST /orders/:id/fast-forward` only ever moved the `release_at` timestamp, never the order's actual status. An order whose seller never shipped, viewed by the buyer, had exactly one available action: a demo-only "Fast-forward" button that didn't do anything besides make the countdown say zero. Several real orders from this session's testing were stuck in this state — confirmed and fixed live (see below).

**Fix:** added `_maybe_auto_release()` in `routes/orders.py`, evaluated lazily whenever an order is read (`GET /orders`, `GET /orders/:id`) rather than via a real background worker — simpler and equally correct at this scale, no need to stand up a scheduler for a demo. If `status` is `paid` or `shipped`, `escrow` is `held`, and `release_at` has passed, it transitions the order to `completed`/`released`, sets `completed_at`, and inserts the seller's `wallet_ledger` release entry — the same effect `confirm_order` produces, just triggered by time instead of the buyer clicking a button. Guarded against double-crediting under concurrent reads via a conditional update (`.eq("status", order["status"])` — if another request already transitioned it, this one's update matches zero rows and no-ops).

Verified against the live DB: the reported stuck order (`54d5049a...`, ৳800, release window had passed ~8 minutes earlier) auto-released correctly on the next fetch, exactly one `wallet_ledger` entry was created (not duplicated on refetch), and four other genuinely-stuck orders from earlier testing got cleaned up the same way by listing them. Also confirmed fresh orders within their window are *not* prematurely released, and the normal manual ship→confirm flow still works unchanged.

**Rentals have the identical gap** (`deposit_release_at` is never acted on either) — not fixed in this pass, see the note in §9. Don't assume it's fine just because orders are now fixed.
