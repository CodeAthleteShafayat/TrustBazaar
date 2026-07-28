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


@bp.patch("/users/<uuid:user_id>")
@jwt_required()
@admin_required
def admin_update_user(user_id):
    """Admin edit — display_name/phone/is_admin only. trust_score is intentionally not
    editable here: trust_score.py recomputes and overwrites it on every profile view, so a
    manual edit would silently vanish the next time anyone looks at the profile."""
    uid = get_jwt_identity()
    body = request.get_json(force=True) or {}
    allowed = {"display_name", "phone", "is_admin"}
    safe = {k: v for k, v in body.items() if k in allowed}
    if not safe:
        return err("validation_error", "No editable fields provided", 400)
    if str(user_id) == uid and safe.get("is_admin") is False:
        return err("validation_error", "Cannot remove your own admin access", 400)
    sb = get_supabase()
    res = sb.table("users").update(safe).eq("id", str(user_id)).execute()
    if not res.data:
        return err("not_found", "User not found", 404)
    return jsonify(data=res.data[0])


@bp.get("/listings")
@jwt_required()
@admin_required
def list_all_listings():
    """Every listing regardless of status — the public /listings endpoint only returns 'active'."""
    sb = get_supabase()
    res = sb.table("listings").select(
        "id, seller_id, title, description, category, listing_type, price, rent_per_day, "
        "deposit_required, deposit_rate, status, location, created_at, "
        "users:seller_id(display_name, email)"
    ).order("created_at", desc=True).execute()
    out = []
    for row in (res.data or []):
        row["seller"] = row.pop("users", None)
        out.append(row)
    return jsonify(data=out)


@bp.patch("/listings/<uuid:listing_id>")
@jwt_required()
@admin_required
def admin_update_listing(listing_id):
    """Admin override — edit any listing regardless of ownership (moderation/correction)."""
    body = request.get_json(force=True) or {}
    allowed = {
        "title", "description", "category", "price", "listing_type",
        "rent_per_day", "deposit_required", "deposit_rate", "status", "location",
    }
    safe = {k: v for k, v in body.items() if k in allowed}
    if not safe:
        return err("validation_error", "No editable fields provided", 400)
    sb = get_supabase()
    res = sb.table("listings").update(safe).eq("id", str(listing_id)).execute()
    if not res.data:
        return err("not_found", "Listing not found", 404)
    return jsonify(data=res.data[0])


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


@bp.get("/stats")
@jwt_required()
@admin_required
def admin_stats():
    sb = get_supabase()
    users_count = len(sb.table("users").select("id").execute().data or [])
    active_listings = len(sb.table("listings").select("id").eq("status", "active").execute().data or [])
    open_disputes = len(sb.table("disputes").select("id").in_("status", ["open", "under_review"]).execute().data or [])

    completed_orders = sb.table("orders").select("amount").eq("status", "completed").execute().data or []
    completed_rentals = sb.table("rentals").select("rental_fee").eq("status", "completed").execute().data or []
    gmv = sum(Decimal(str(o["amount"])) for o in completed_orders) + sum(Decimal(str(r["rental_fee"])) for r in completed_rentals)

    return jsonify(data={
        "users": users_count,
        "active_listings": active_listings,
        "open_disputes": open_disputes,
        "gmv": str(gmv),
    })
