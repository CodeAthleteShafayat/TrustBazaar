"""Rentals routes — booking, deposit, return, claim."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err
from ..services.payment_provider import get_payment_provider
from ..services.escrow_state_machine import is_valid_rental_transition, deposit_rate_for_category

bp = Blueprint("rentals", __name__)


def _serialize_rental(row: dict) -> dict:
    out = {
        "id": row["id"],
        "listing_id": row["listing_id"],
        "renter_id": row["renter_id"],
        "owner_id": row["owner_id"],
        "start_date": row["start_date"],
        "end_date": row["end_date"],
        "rental_fee": str(row["rental_fee"]),
        "deposit_rate": str(row["deposit_rate"]),
        "deposit_amount": str(row["deposit_amount"]),
        "commission": str(row["commission"]),
        "net_to_owner": str(row["net_to_owner"]) if row.get("net_to_owner") is not None else None,
        "status": row["status"],
        "deposit_status": row["deposit_status"],
        "paid_at": row.get("paid_at"),
        "returned_at": row.get("returned_at"),
        "deposit_release_at": row.get("deposit_release_at"),
    }
    if "listing" in row:
        out["listing"] = row["listing"]
    return out


_LISTING_SHORT = (
    "id, seller_id, title, category, listing_type, price, rent_per_day, photo_urls, status"
)


def _listing_short(row: dict | None) -> dict | None:
    if not row:
        return None
    return {
        "id": row["id"],
        "seller_id": row["seller_id"],
        "title": row["title"],
        "category": row.get("category"),
        "listing_type": row.get("listing_type"),
        "price": str(row["price"]) if row.get("price") is not None else None,
        "rent_per_day": str(row["rent_per_day"]) if row.get("rent_per_day") is not None else None,
        "photo_urls": row.get("photo_urls") or [],
        "status": row.get("status"),
    }


@bp.post("")
@jwt_required()
def create_rental():
    body = request.get_json(force=True) or {}
    listing_id = body.get("listing_id")
    start_date = body.get("start_date")
    end_date = body.get("end_date")
    if not (listing_id and start_date and end_date):
        return err("validation_error", "listing_id, start_date, end_date required", 400)

    uid = get_jwt_identity()
    sb = get_supabase()

    listing = sb.table("listings").select("*").eq("id", listing_id).maybe_single().execute()
    if not listing.data:
        return err("not_found", "Listing not found", 404)

    sd = datetime.fromisoformat(start_date).date()
    ed = datetime.fromisoformat(end_date).date()
    if ed < sd:
        return err("validation_error", "end_date must be on or after start_date", 400)

    days = (ed - sd).days + 1
    if days < 1 or days > 15:
        return err("validation_error", "Rentals must be between 1 and 15 days", 400)

    fee_per_day = Decimal(str(listing.data["rent_per_day"]))
    rental_fee = (fee_per_day * days).quantize(Decimal("0.01"))

    configs = sb.table("commission_config").select("*").execute().data or []
    # Prefer explicit per-listing deposit fields; fall back to category rate.
    deposit_rate = (
        Decimal(str(listing.data.get("deposit_rate")))
        if listing.data.get("deposit_rate") is not None
        else deposit_rate_for_category(listing.data["category"], configs)
    )
    # deposit_required is a boolean flag on the listing, not an amount — the
    # declared value the deposit is computed against is the listing's price.
    declared_value = Decimal(str(listing.data["price"])) if listing.data.get("deposit_required") else Decimal("0")
    deposit_amount = (declared_value * deposit_rate).quantize(Decimal("0.01"))

    rental_commission_rate = Decimal("0.10")
    commission = (rental_fee * rental_commission_rate).quantize(Decimal("0.01"))

    charge = get_payment_provider().charge(
        user_id=uid, amount=rental_fee + deposit_amount, reference=f"rental:{listing_id}",
    )
    if not charge.success:
        return err("payment_failed", "Payment failed", 402)

    deposit_release_at = (datetime.combine(ed, datetime.min.time()) + timedelta(hours=current_app.config["DEPOSIT_CLAIM_WINDOW_HOURS"])).astimezone(timezone.utc)

    # Single Postgres transaction: row-locks the listing, verifies
    # listing_type='rent', checks no existing non-terminal rental overlaps
    # the requested daterange, inserts the rental. Returns the rental row
    # or {error, message}.
    rpc_res = sb.rpc("create_rental_atomic", {
        "p_listing_id": listing_id,
        "p_renter_id": uid,
        "p_start_date": sd.isoformat(),
        "p_end_date": ed.isoformat(),
        "p_rental_fee": str(rental_fee),
        "p_deposit_rate": str(deposit_rate),
        "p_deposit_amount": str(deposit_amount),
        "p_commission": str(commission),
        "p_deposit_release_at": deposit_release_at.isoformat(),
    }).execute()

    if not rpc_res.data or (isinstance(rpc_res.data, dict) and rpc_res.data.get("error")):
        # Race: another renter took the dates, or listing was withdrawn, etc.
        # Refund the charge so we never leave payment collected against a
        # failed DB write.
        get_payment_provider().refund(charge_id=charge.charge_id, amount=rental_fee + deposit_amount)
        err_code = (rpc_res.data or {}).get("error") or "conflict"
        err_msg = (rpc_res.data or {}).get("message") or "Could not create rental"
        status = 409 if err_code == "conflict" else 400
        return err(err_code, err_msg, status)

    return jsonify(data=_serialize_rental(rpc_res.data)), 201


@bp.get("")
@jwt_required()
def list_rentals():
    uid = get_jwt_identity()
    role = request.args.get("role", "renter")
    sb = get_supabase()
    col = "renter_id" if role == "renter" else "owner_id"
    res = (
        sb.table("rentals")
        .select(f"*, listing:listings!listing_id({_LISTING_SHORT})")
        .eq(col, uid)
        .order("paid_at", desc=True)
        .execute()
    )
    return jsonify(data=[_serialize_rental(r) for r in (res.data or [])])


@bp.get("/<uuid:rental_id>")
@jwt_required()
def get_rental(rental_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    res = (
        sb.table("rentals")
        .select(f"*, listing:listings!listing_id({_LISTING_SHORT})")
        .eq("id", str(rental_id))
        .maybe_single()
        .execute()
    )
    if not res.data:
        return err("not_found", "Rental not found", 404)
    if uid not in (res.data["renter_id"], res.data["owner_id"]):
        return err("forbidden", "Not a party", 403)
    return jsonify(data=_serialize_rental(res.data))


@bp.post("/<uuid:rental_id>/return")
@jwt_required()
def mark_returned(rental_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    rental = sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute()
    if not rental.data:
        return err("not_found", "Rental not found", 404)
    if rental.data["renter_id"] != uid:
        return err("forbidden", "Not the renter", 403)
    if not is_valid_rental_transition(rental.data["status"], "returned"):
        return err("escrow_invalid_transition", f"Cannot mark returned from {rental.data['status']}", 409)

    sb.table("rentals").update({
        "status": "returned",
        "returned_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(rental_id)).execute()
    return jsonify(data=_serialize_rental(sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute().data))


@bp.post("/<uuid:rental_id>/confirm-return")
@jwt_required()
def confirm_return(rental_id):
    """Owner confirms clean return — refund full deposit.

    NOTE: always does a full refund — the frontend dialog also offers "partial" and
    "claim" deposit actions, but this endpoint doesn't read/honor deposit_action from
    the body at all yet. Not fixed here: the payout split for partial/claim is a
    business-rule decision, not a bug fix. See PRODUCT_UPDATE.md.
    """
    uid = get_jwt_identity()
    sb = get_supabase()
    # All state-machine + ledger work happens inside one Postgres transaction.
    # The RPC is idempotent: a second call returns the already-completed
    # rental without producing duplicate refund/release ledger entries.
    rpc_res = sb.rpc("complete_rental_atomic", {
        "p_rental_id": str(rental_id),
        "p_actor_id": uid,
    }).execute()
    if not rpc_res.data or (isinstance(rpc_res.data, dict) and rpc_res.data.get("error")):
        err_code = (rpc_res.data or {}).get("error") or "conflict"
        err_msg = (rpc_res.data or {}).get("message") or "Could not complete rental"
        status_map = {
            "forbidden": 403,
            "escrow_invalid_transition": 409,
            "not_found": 404,
        }
        return err(err_code, err_msg, status_map.get(err_code, 400))
    return jsonify(data=_serialize_rental(rpc_res.data))


@bp.post("/<uuid:rental_id>/claim")
@jwt_required()
def claim_deposit(rental_id):
    """Owner opens a deposit claim with evidence."""
    uid = get_jwt_identity()
    body = request.get_json(force=True) or {}
    sb = get_supabase()
    rental = sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute()
    if not rental.data:
        return err("not_found", "Rental not found", 404)
    if rental.data["owner_id"] != uid:
        return err("forbidden", "Not the owner", 403)
    if not is_valid_rental_transition(rental.data["status"], "disputed"):
        return err("escrow_invalid_transition", f"Cannot claim from {rental.data['status']}", 409)

    if not body.get("reason") or not body.get("amount"):
        return err("validation_error", "reason and amount required", 400)

    sb.table("rentals").update({"status": "disputed", "deposit_status": "partial"}).eq("id", str(rental_id)).execute()
    dispute = sb.table("disputes").insert({
        "rental_id": str(rental_id),
        "raised_by": uid,
        "reason": body["reason"],
        "status": "open",
    }).execute()

    for url in body.get("evidence_urls", []):
        sb.table("evidence").insert({"dispute_id": dispute.data[0]["id"], "uploader_id": uid, "file_url": url}).execute()

    return jsonify(data=dispute.data[0]), 201


@bp.post("/<uuid:rental_id>/fast-forward")
@jwt_required()
def fast_forward_rental(rental_id):
    """Demo-only: collapse deposit_release_at to now.

    Admin-only. Previously any authenticated user could call this and skip
    the deposit-claim window — a logged-in renter could collapse the time
    the owner has to file a deposit claim. Now requires users.is_admin = true.
    """
    uid = get_jwt_identity()
    sb = get_supabase()
    admin = sb.table("users").select("is_admin").eq("id", uid).maybe_single().execute()
    if not admin.data or not admin.data.get("is_admin"):
        return err("forbidden", "Admin access required", 403)

    sb.table("rentals").update({"deposit_release_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(rental_id)).execute()
    return jsonify(data=_serialize_rental(sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute().data))
