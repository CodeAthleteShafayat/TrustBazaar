"""Admin routes — gated to users with users.is_admin = true."""
from datetime import datetime, timezone
from decimal import Decimal
from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err

bp = Blueprint("admin", __name__)


def admin_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        uid = get_jwt_identity()
        sb = get_supabase()
        user = sb.table("users").select("is_admin").eq("id", uid).maybe_single().execute()
        if not user.data or not user.data.get("is_admin"):
            return err("forbidden", "Admin access required", 403)
        return fn(*args, **kwargs)
    return wrapper


@bp.get("/disputes")
@jwt_required()
@admin_required
def list_disputes():
    sb = get_supabase()
    res = sb.table("disputes").select("*, evidence(*)").order("created_at", desc=True).execute()
    return jsonify(data=res.data or [])


@bp.post("/disputes/<uuid:dispute_id>/resolve")
@jwt_required()
@admin_required
def resolve_dispute(dispute_id):
    body = request.get_json(force=True) or {}
    decision = body.get("decision")
    if decision not in ("refund", "release", "split"):
        return err("validation_error", "decision must be refund|release|split", 400)
    admin_notes = body.get("admin_notes", "")
    sb = get_supabase()

    res = sb.table("disputes").update({
        "status": "resolved",
        "resolution": decision,
        "admin_notes": admin_notes,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
        "split_buyer": body.get("split_buyer"),
        "split_seller": body.get("split_seller"),
    }).eq("id", str(dispute_id)).execute()
    if not res.data:
        return err("not_found", "Dispute not found", 404)
    dispute = res.data[0]

    if dispute.get("order_id"):
        if decision == "refund":
            sb.table("orders").update({"status": "refunded", "escrow": "refunded"}).eq("id", dispute["order_id"]).execute()
            o = sb.table("orders").select("buyer_id, amount").eq("id", dispute["order_id"]).maybe_single().execute()
            if o.data:
                sb.table("wallet_ledger").insert({
                    "user_id": o.data["buyer_id"], "type": "refund",
                    "amount": o.data["amount"], "reference": f"order:{dispute['order_id']}",
                }).execute()
        else:
            sb.table("orders").update({"status": "completed", "escrow": "released"}).eq("id", dispute["order_id"]).execute()
            o = sb.table("orders").select("seller_id, net_to_seller").eq("id", dispute["order_id"]).maybe_single().execute()
            if o.data:
                sb.table("wallet_ledger").insert({
                    "user_id": o.data["seller_id"], "type": "release",
                    "amount": o.data["net_to_seller"], "reference": f"order:{dispute['order_id']}",
                }).execute()

    if dispute.get("rental_id"):
        r = sb.table("rentals").select("renter_id, owner_id, deposit_amount, net_to_owner").eq("id", dispute["rental_id"]).maybe_single().execute()
        if r.data:
            if decision == "refund":
                sb.table("rentals").update({"status": "refunded", "deposit_status": "refunded"}).eq("id", dispute["rental_id"]).execute()
                sb.table("wallet_ledger").insert([
                    {"user_id": r.data["renter_id"], "type": "refund", "amount": r.data["deposit_amount"], "reference": f"rental:{dispute['rental_id']}"},
                    {"user_id": r.data["owner_id"], "type": "release", "amount": r.data["net_to_owner"], "reference": f"rental:{dispute['rental_id']}"},
                ]).execute()
            elif decision == "release":
                sb.table("rentals").update({"status": "completed", "deposit_status": "forfeited"}).eq("id", dispute["rental_id"]).execute()
                sb.table("wallet_ledger").insert({
                    "user_id": r.data["owner_id"], "type": "release",
                    "amount": r.data["deposit_amount"], "reference": f"rental-deduct:{dispute['rental_id']}",
                }).execute()
            else:
                sb.table("rentals").update({"status": "completed", "deposit_status": "partial"}).eq("id", dispute["rental_id"]).execute()
                buyer_amt = Decimal(str(body.get("split_buyer", r.data["deposit_amount"])))
                seller_amt = Decimal(str(body.get("split_seller", "0")))
                sb.table("wallet_ledger").insert([
                    {"user_id": r.data["renter_id"], "type": "refund", "amount": str(buyer_amt), "reference": f"rental:{dispute['rental_id']}"},
                    {"user_id": r.data["owner_id"], "type": "release", "amount": str(seller_amt), "reference": f"rental:{dispute['rental_id']}"},
                ]).execute()

    return jsonify(data=dispute)


@bp.get("/commission")
@jwt_required()
@admin_required
def list_commission():
    sb = get_supabase()
    res = sb.table("commission_config").select("*").execute()
    return jsonify(data=res.data or [])


@bp.post("/commission")
@jwt_required()
@admin_required
def upsert_commission():
    body = request.get_json(force=True) or {}
    category = body.get("category")
    if not category:
        return err("validation_error", "category required", 400)
    sb = get_supabase()
    res = sb.table("commission_config").upsert({
        "category": category,
        "sale_rate": body.get("sale_rate", 0.05),
        "deposit_rate": body.get("deposit_rate", 0.40),
    }).execute()
    return jsonify(data=res.data[0])


@bp.get("/users")
@jwt_required()
@admin_required
def list_users():
    sb = get_supabase()
    res = sb.table("users").select(
        "id, email, display_name, phone, trust_score, trust_tier, is_admin, joined_at"
    ).order("joined_at", desc=True).execute()
    return jsonify(data=res.data or [])


@bp.get("/listings")
@jwt_required()
@admin_required
def list_all_listings():
    """Every listing regardless of status — the public /listings endpoint only returns 'active'."""
    sb = get_supabase()
    res = sb.table("listings").select(
        "id, seller_id, title, category, listing_type, price, rent_per_day, status, created_at, "
        "users:seller_id(display_name, email)"
    ).order("created_at", desc=True).execute()
    out = []
    for row in (res.data or []):
        row["seller"] = row.pop("users", None)
        out.append(row)
    return jsonify(data=out)


@bp.delete("/listings/<uuid:listing_id>")
@jwt_required()
@admin_required
def admin_remove_listing(listing_id):
    """Admin override — remove any listing regardless of ownership (moderation)."""
    sb = get_supabase()
    res = sb.table("listings").update({"status": "archived"}).eq("id", str(listing_id)).execute()
    if not res.data:
        return err("not_found", "Listing not found", 404)
    return jsonify(ok=True)
