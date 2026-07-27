"""Orders routes — buy flow + escrow state machine."""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err
from ..services.payment_provider import get_payment_provider
from ..services.escrow_state_machine import is_valid_order_transition, commission_for_category

bp = Blueprint("orders", __name__)


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


def _attach_listing(order: dict) -> dict:
    sb = get_supabase()
    if order.get("listing_id"):
        try:
            res = sb.table("listings").select(_LISTING_SHORT).eq("id", order["listing_id"]).maybe_single().execute()
            order["listing"] = _listing_short(res.data) if res.data else None
        except Exception:
            order["listing"] = None
    else:
        order["listing"] = None
    return order


def _serialize_order(row: dict) -> dict:
    out = {
        "id": row["id"],
        "listing_id": row["listing_id"],
        "buyer_id": row["buyer_id"],
        "seller_id": row["seller_id"],
        "amount": str(row["amount"]),
        "commission": str(row["commission"]),
        "net_to_seller": str(row["net_to_seller"]) if row.get("net_to_seller") is not None else None,
        "status": row["status"],
        "escrow": row["escrow"],
        "paid_at": row.get("paid_at"),
        "shipped_at": row.get("shipped_at"),
        "release_at": row.get("release_at"),
        "completed_at": row.get("completed_at"),
        "demo_fast_forward_seconds": row.get("demo_fast_forward_seconds", 30),
    }
    # Pass through pre-fetched listing when joined (for list endpoints).
    if "listing" in row:
        out["listing"] = row["listing"]
    return out


@bp.post("")
@jwt_required()
def create_order():
    body = request.get_json(force=True) or {}
    listing_id = body.get("listing_id")
    if not listing_id:
        return err("validation_error", "listing_id required", 400)
    uid = get_jwt_identity()
    sb = get_supabase()

    listing = sb.table("listings").select("*").eq("id", listing_id).maybe_single().execute()
    if not listing.data or listing.data["status"] != "active":
        return err("conflict", "Listing not available", 409)
    if listing.data["listing_type"] != "sale":
        return err("validation_error", "Listing is not for sale", 400)
    if listing.data["seller_id"] == uid:
        return err("validation_error", "Cannot buy your own listing", 400)

    configs = sb.table("commission_config").select("*").execute().data or []
    commission_rate = commission_for_category(listing.data["category"], configs)
    amount = Decimal(str(listing.data["price"]))
    commission = (amount * commission_rate).quantize(Decimal("0.01"))

    charge = get_payment_provider().charge(
        user_id=uid, amount=amount, reference=f"listing:{listing_id}",
    )
    if not charge.success:
        return err("payment_failed", "Payment provider declined", 402)

    release_at = datetime.now(timezone.utc) + timedelta(
        seconds=current_app.config["DEMO_FAST_FORWARD_SECONDS"]  # MVP: 30s; prod: RELEASE_WINDOW_DAYS
    )

    payload = {
        "listing_id": listing_id,
        "buyer_id": uid,
        "seller_id": listing.data["seller_id"],
        "amount": str(amount),
        "commission": str(commission),
        "status": "paid",
        "escrow": "held",
        "release_at": release_at.isoformat(),
        "demo_fast_forward_seconds": current_app.config["DEMO_FAST_FORWARD_SECONDS"],
    }
    res = sb.table("orders").insert(payload).execute()
    order = res.data[0]
    sb.table("listings").update({"status": "sold"}).eq("id", listing_id).execute()
    return jsonify(data=_serialize_order(order)), 201


@bp.get("")
@jwt_required()
def list_orders():
    uid = get_jwt_identity()
    role = request.args.get("role", "buyer")
    sb = get_supabase()
    col = "buyer_id" if role == "buyer" else "seller_id"
    res = (
        sb.table("orders")
        .select(f"*, listing:listings!listing_id({_LISTING_SHORT})")
        .eq(col, uid)
        .order("paid_at", desc=True)
        .execute()
    )
    return jsonify(data=[_serialize_order(o) for o in (res.data or [])])


@bp.get("/<uuid:order_id>")
@jwt_required()
def get_order(order_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    res = (
        sb.table("orders")
        .select(f"*, listing:listings!listing_id({_LISTING_SHORT})")
        .eq("id", str(order_id))
        .maybe_single()
        .execute()
    )
    if not res.data:
        return err("not_found", "Order not found", 404)
    if uid not in (res.data["buyer_id"], res.data["seller_id"]):
        return err("forbidden", "Not a party to this order", 403)
    return jsonify(data=_serialize_order(res.data))


@bp.post("/<uuid:order_id>/ship")
@jwt_required()
def ship_order(order_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    order = sb.table("orders").select("*").eq("id", str(order_id)).maybe_single().execute()
    if not order.data:
        return err("not_found", "Order not found", 404)
    if order.data["seller_id"] != uid:
        return err("forbidden", "Not the seller", 403)
    if not is_valid_order_transition(order.data["status"], "shipped"):
        return err("escrow_invalid_transition", f"Cannot ship from {order.data['status']}", 409)

    sb.table("orders").update({"status": "shipped", "shipped_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(order_id)).execute()
    return jsonify(data=_serialize_order(sb.table("orders").select("*").eq("id", str(order_id)).maybe_single().execute().data))


@bp.post("/<uuid:order_id>/confirm")
@jwt_required()
def confirm_order(order_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    order = sb.table("orders").select("*").eq("id", str(order_id)).maybe_single().execute()
    if not order.data:
        return err("not_found", "Order not found", 404)
    if order.data["buyer_id"] != uid:
        return err("forbidden", "Not the buyer", 403)
    if not is_valid_order_transition(order.data["status"], "completed"):
        return err("escrow_invalid_transition", f"Cannot confirm from {order.data['status']}", 409)

    sb.table("orders").update({
        "status": "completed",
        "escrow": "released",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(order_id)).execute()

    sb.table("wallet_ledger").insert({
        "user_id": order.data["seller_id"],
        "type": "release",
        "amount": order.data["net_to_seller"],
        "reference": f"order:{order_id}",
    }).execute()

    return jsonify(data=_serialize_order(sb.table("orders").select("*").eq("id", str(order_id)).maybe_single().execute().data))


@bp.post("/<uuid:order_id>/dispute")
@jwt_required()
def dispute_order(order_id):
    uid = get_jwt_identity()
    body = request.get_json(force=True) or {}
    sb = get_supabase()
    order = sb.table("orders").select("*").eq("id", str(order_id)).maybe_single().execute()
    if not order.data:
        return err("not_found", "Order not found", 404)
    if order.data["buyer_id"] != uid:
        return err("forbidden", "Not the buyer", 403)
    if not is_valid_order_transition(order.data["status"], "disputed"):
        return err("escrow_invalid_transition", f"Cannot dispute from {order.data['status']}", 409)

    if not body.get("reason"):
        return err("validation_error", "reason required", 400)

    sb.table("orders").update({"status": "disputed"}).eq("id", str(order_id)).execute()
    dispute = sb.table("disputes").insert({
        "order_id": str(order_id),
        "raised_by": uid,
        "reason": body["reason"],
        "status": "open",
    }).execute()

    for url in body.get("evidence_urls", []):
        sb.table("evidence").insert({"dispute_id": dispute.data[0]["id"], "uploader_id": uid, "file_url": url}).execute()

    return jsonify(data=dispute.data[0]), 201


@bp.post("/<uuid:order_id>/fast-forward")
@jwt_required()
def fast_forward(order_id):
    """Demo-only: collapse release_at to now so we can demo the auto-release path."""
    sb = get_supabase()
    sb.table("orders").update({"release_at": datetime.now(timezone.utc).isoformat()}).eq("id", str(order_id)).execute()
    return jsonify(data=_serialize_order(sb.table("orders").select("*").eq("id", str(order_id)).maybe_single().execute().data))
