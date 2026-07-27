# Dev Contract — TrustBazaar API

**Status:** MVP working copy. Source of truth for backend ↔ frontend wiring. Edit only by notice per `COLLABORATION.md` §5.

**Base URL (dev):** `http://localhost:5000/api`
**Auth:** `Authorization: Bearer <jwt>` (Supabase JWT)

---

## Conventions

- All requests/responses are JSON.
- Times are ISO 8601 UTC strings.
- Money is decimal string to avoid float rounding (e.g. `"49.99"`).
- IDs are UUID v4 strings.
- Errors follow `{ "error": { "code": "string", "message": "string" } }`.
- Success is the resource itself or `{ "data": ... }` for lists.

---

## 1. Auth

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| POST | `/auth/signup` | `{ email, password, display_name, phone? }` | `{ user, session }` | public |
| POST | `/auth/login` | `{ email, password }` | `{ user, session }` | public |
| POST | `/auth/otp/request` | `{ channel: "email"|"sms", target }` | `{ ok }` | public |
| POST | `/auth/otp/verify` | `{ target, code }` | `{ user, session }` | public |
| POST | `/auth/logout` | — | `{ ok }` | user |
| GET  | `/auth/me` | — | `{ user }` | user |

In MVP, `MockOtpService` returns `code = "123456"` and logs to console. Swappable for Twilio in Phase 2.

---

## 2. Listings

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| GET    | `/listings` | query: `q, category, listing_type, min_price, max_price, condition` | `{ data: [Listing] }` | public |
| GET    | `/listings/:id` | — | `{ data: Listing }` | public |
| POST   | `/listings` | `ListingCreate` | `{ data: Listing }` | user |
| PATCH  | `/listings/:id` | `ListingUpdate` (partial) | `{ data: Listing }` | owner |
| DELETE | `/listings/:id` | — | `{ ok }` | owner |

### ListingCreate
```json
{
  "title": "string",
  "category": "electronics|fashion|furniture|books|other",
  "condition": "new|used",
  "price": "decimal-string",
  "description": "string",
  "photos": ["https://..."],
  "listing_type": "sale|exchange|rent",
  "rental_price_per_day": "decimal-string|null",
  "declared_value": "decimal-string|null",
  "exchange_wants": "string|null"
}
```

### Listing
```json
{
  "id": "uuid", "seller_id": "uuid", "title": "...", "category": "...",
  "condition": "new|used", "price": "49.99", "description": "...",
  "photos": ["..."], "listing_type": "sale|exchange|rent",
  "rental_price_per_day": "5.00|null", "declared_value": "120.00|null",
  "exchange_wants": "...",
  "status": "active|sold|rented|removed",
  "seller": { "id": "...", "display_name": "...", "trust_score": 72, "trust_tier": "Trusted" },
  "created_at": "iso"
}
```

---

## 3. Orders (Buy flow + escrow)

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| POST   | `/orders`                  | `{ listing_id }` | `{ data: Order }` | user |
| GET    | `/orders`                  | query: `role=buyer|seller` | `{ data: [Order] }` | user |
| GET    | `/orders/:id`              | — | `{ data: Order }` | buyer or seller |
| POST   | `/orders/:id/ship`         | — | `{ data: Order }` | seller |
| POST   | `/orders/:id/confirm`      | — | `{ data: Order }` | buyer |
| POST   | `/orders/:id/dispute`      | `{ reason, evidence_urls: [] }` | `{ data: Dispute }` | buyer |
| POST   | `/orders/:id/fast-forward` | — | `{ data: Order }` | demo only — admin |

### Order
```json
{
  "id": "uuid", "listing_id": "uuid", "buyer_id": "uuid", "seller_id": "uuid",
  "amount": "120.00", "commission": "9.60", "net_to_seller": "110.40",
  "status": "paid|shipped|completed|disputed|refunded",
  "escrow": "held|released|refunded",
  "paid_at": "iso", "shipped_at": "iso|null", "release_at": "iso",
  "completed_at": "iso|null", "demo_fast_forward_seconds": 30
}
```

### Escrow state machine (enforced server-side)
```
paid ──(ship)──▶ shipped ──(confirm)──▶ completed
  │                  │                       │
  │                  └──(dispute)──▶ disputed ──(admin resolve)──▶ refunded|completed
  └─────────(no action by release_at)──▶ completed (auto-release)
```
Invalid transitions return `409 escrow_invalid_transition`.

---

## 4. Rentals

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| POST   | `/rentals`                  | `{ listing_id, start_date, end_date }` | `{ data: Rental }` | user |
| GET    | `/rentals`                  | query: `role=renter|owner` | `{ data: [Rental] }` | user |
| GET    | `/rentals/:id`              | — | `{ data: Rental }` | renter or owner |
| POST   | `/rentals/:id/return`       | — | `{ data: Rental }` | renter (marks returned to owner) |
| POST   | `/rentals/:id/confirm-return` | — | `{ data: Rental }` | owner (no damage) |
| POST   | `/rentals/:id/claim`        | `{ reason, evidence_urls: [], amount }` | `{ data: Dispute }` | owner (deposit claim) |
| POST   | `/rentals/:id/fast-forward` | — | `{ data: Rental }` | demo only |

### Rental
```json
{
  "id": "uuid", "listing_id": "uuid", "renter_id": "uuid", "owner_id": "uuid",
  "start_date": "2026-08-01", "end_date": "2026-08-08",
  "rental_fee": "40.00", "deposit_rate": "0.40", "deposit_amount": "48.00",
  "commission": "4.00", "net_to_owner": "36.00",
  "status": "paid|active|returned|disputed|refunded",
  "deposit_status": "held|refunded|partial|forfeited"
}
```

### Deposit rate table (server-side from `commission_config`)
| Category | Rate |
|---|---|
| `other` (default) | 40% |
| `premium_electronics` | 60% |
| `smart_gadgets` | 60% |
| `high_value_flagged` | up to 75% (admin-set) |

---

## 5. Disputes

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| GET  | `/disputes` | — | `{ data: [Dispute] }` | admin |
| GET  | `/disputes/:id` | — | `{ data: Dispute }` | parties or admin |
| POST | `/disputes/:id/resolve` | `{ decision: "refund"|"release"|"split", split_buyer?: "decimal", split_seller?: "decimal", admin_notes }` | `{ data: Dispute }` | admin |

### Dispute
```json
{
  "id": "uuid", "order_id": "uuid|null", "rental_id": "uuid|null",
  "raised_by": "uuid", "reason": "...",
  "status": "open|under_review|resolved",
  "resolution": "refund|release|split|null",
  "admin_notes": "...",
  "evidence": [{ "file_url": "...", "file_type": "image|video", "uploaded_at": "iso" }],
  "created_at": "iso", "resolved_at": "iso|null"
}
```

---

## 6. Trust Score

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| GET | `/trust-score/:user_id` | — | `{ data: { score, tier, breakdown } }` | public |
| GET | `/trust-score/me` | — | `{ data: { score, tier, breakdown } }` | user |

### Tier thresholds
| Score | Tier |
|---|---|
| null (new user, no completed txns) | Unrated |
| < 40 | New |
| 40–69 | Reliable |
| 70–89 | Trusted |
| 90+ | Top Rated |

### MVP breakdown
- `completed_txns` 50% — % of completed orders without dispute
- `dispute_outcomes` 25% — disputes won vs lost (neutral = full credit)
- `rental_returns` 15% — on-time + clean returns vs late/damaged
- `account_age` 10% — capped at 12 months

---

## 7. Wallet

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| GET  | `/wallet` | — | `{ data: { available, pending, ledger: [Tx] } }` | user |
| POST | `/wallet/payout` | `{ amount }` | `{ data: { payout_id } }` | user (mocked in MVP) |

### Tx (wallet_ledger row)
```json
{ "id": "uuid", "type": "credit|debit|hold|release|refund", "amount": "...", "reference": "order:uuid|rental:uuid", "created_at": "iso" }
```

---

## 8. Admin

| Method | Path | Body | Returns | Auth |
|---|---|---|---|---|
| GET  | `/admin/disputes` | — | `{ data: [Dispute] }` | admin |
| POST | `/admin/disputes/:id/resolve` | same as §5 | `{ data: Dispute }` | admin |
| GET  | `/admin/commission` | — | `{ data: [CommissionConfig] }` | admin |
| POST | `/admin/commission` | `{ category, sale_rate, deposit_rate }` | `{ data: CommissionConfig }` | admin |
| POST | `/admin/listings/:id/flag` | `{ reason }` | `{ data: Listing }` | admin |

> **MVP note:** admin endpoints are open (no auth gate). Phase 2 must add JWT role claim + RLS enforcement before real users.

---

## 9. Webhooks (Phase 2)

Payment gateway will POST `/webhooks/payment` with signed payload. Out of scope for MVP — `MockPaymentProvider` synchronously returns success.

---

## 10. Errors

| HTTP | code | when |
|---|---|---|
| 400 | `validation_error` | bad body |
| 401 | `unauthorized` | no/bad JWT |
| 403 | `forbidden` | not owner / not admin |
| 404 | `not_found` | resource missing |
| 409 | `escrow_invalid_transition` | bad state move |
| 409 | `conflict` | e.g. listing already sold |
| 422 | `insufficient_funds` | wallet < payout amount |
| 429 | `rate_limited` | Phase 2 only |
| 500 | `internal` | bug — log + Sentry (Phase 2) |