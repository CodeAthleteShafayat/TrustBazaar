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
    if not listing.data or listing.data["listing_type"] != "rent":
        return err("conflict", "Listing not available for rent", 409)
    if listing.data["seller_id"] == uid:
        return err("validation_error", "Cannot rent your own listing", 400)

    sd = datetime.fromisoformat(start_date).date()
    ed = datetime.fromisoformat(end_date).date()
    if ed < sd:
        return err("validation_error", "end_date must be on or after start_date", 400)

    days = (ed - sd).days + 1
    fee_per_day = Decimal(str(listing.data["rent_per_day"]))
    rental_fee = (fee_per_day * days).quantize(Decimal("0.01"))

    configs = sb.table("commission_config").select("*").execute().data or []
    # Prefer explicit per-listing deposit fields; fall back to category rate.
    deposit_rate = (
        Decimal(str(listing.data.get("deposit_rate")))
        if listing.data.get("deposit_rate") is not None
        else deposit_rate_for_category(listing.data["category"], configs)
    )
    if listing.data.get("deposit_required") is not None:
        declared_value = Decimal(str(listing.data["deposit_required"]))
    else:
        # Use the rental fee as the implicit declared value when not set.
        declared_value = rental_fee
    deposit_amount = (declared_value * deposit_rate).quantize(Decimal("0.01"))

    rental_commission_rate = Decimal("0.10")
    commission = (rental_fee * rental_commission_rate).quantize(Decimal("0.01"))

    charge = get_payment_provider().charge(
        user_id=uid, amount=rental_fee + deposit_amount, reference=f"rental:{listing_id}",
    )
    if not charge.success:
        return err("payment_failed", "Payment failed", 402)

    deposit_release_at = (datetime.combine(ed, datetime.min.time()) + timedelta(hours=current_app.config["DEPOSIT_CLAIM_WINDOW_HOURS"])).astimezone(timezone.utc)

    payload = {
        "listing_id": listing_id,
        "renter_id": uid,
        "owner_id": listing.data["seller_id"],
        "start_date": sd.isoformat(),
        "end_date": ed.isoformat(),
        "rental_fee": str(rental_fee),
        "deposit_rate": str(deposit_rate),
        "deposit_amount": str(deposit_amount),
        "commission": str(commission),
        "status": "paid",
        "deposit_status": "held",
        "deposit_release_at": deposit_release_at.isoformat(),
    }
    res = sb.table("rentals").insert(payload).execute()
    return jsonify(data=_serialize_rental(res.data[0])), 201


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
    """Owner confirms clean return — refund full deposit."""
    uid = get_jwt_identity()
    sb = get_supabase()
    rental = sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute()
    if not rental.data:
        return err("not_found", "Rental not found", 404)
    if rental.data["owner_id"] != uid:
        return err("forbidden", "Not the owner", 403)
    if not is_valid_rental_transition(rental.data["status"], "completed"):
        return err("escrow_invalid_transition", f"Cannot complete from {rental.data['status']}", 409)

    sb.table("rentals").update({
        "status": "completed",
        "deposit_status": "refunded",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(rental_id)).execute()

    sb.table("wallet_ledger").insert([
        {"user_id": rental.data["renter_id"], "type": "refund", "amount": rental.data["deposit_amount"], "reference": f"rental:{rental_id}"},
        {"user_id": rental.data["owner_id"], "type": "release", "amount": rental.data["net_to_owner"], "reference": f"rental:{rental_id}"},
    ]).execute()
    return jsonify(data=_serialize_rental(sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute().data))


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
    """Demo-only: collapse deposit_release_at to now."""
    sb = get_supabase()
    sb.table("rentals").update({"deposit_release_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(rental_id)).execute()
    return jsonify(data=_serialize_rental(sb.table("rentals").select("*").eq("id", str(rental_id)).maybe_single().execute().data))
