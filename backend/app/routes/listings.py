"""Listings routes — search, CRUD."""
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err
from ..services.escrow_state_machine import commission_for_category

bp = Blueprint("listings", __name__)

RENTAL_COMMISSION_RATE = Decimal("0.10")  # matches the flat rate rentals.py charges — see create_rental


# Columns that actually exist in public.listings per the real schema.
_LISTING_FIELDS = (
    "id, seller_id, title, description, category, listing_type, price, rent_per_day, "
    "deposit_required, deposit_rate, photo_urls, status, location, created_at, updated_at"
)

_USER_FIELDS = (
    "users:seller_id(id, display_name, trust_score, trust_tier, avatar_url)"
)


def _serialize_listing(row: dict, commission_rate: Decimal | None = None) -> dict:
    out = {
        "id": row["id"],
        "seller_id": row["seller_id"],
        "title": row["title"],
        "category": row["category"],
        "price": str(row["price"]) if row.get("price") is not None else None,
        "rent_per_day": str(row["rent_per_day"]) if row.get("rent_per_day") is not None else None,
        "deposit_required": str(row["deposit_required"]) if row.get("deposit_required") is not None else None,
        "deposit_rate": str(row["deposit_rate"]) if row.get("deposit_rate") is not None else None,
        "description": row.get("description"),
        "photo_urls": row.get("photo_urls") or [],
        "listing_type": row.get("listing_type"),
        "status": row.get("status"),
        "location": row.get("location"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "seller": (row.get("seller") or {}),
    }
    if commission_rate is not None:
        # Checkout preview only — informational, matches what create_order/create_rental
        # will actually charge/compute. Not present on list endpoints (avoids an extra
        # commission_config query per row).
        out["commission_rate"] = str(commission_rate)
    return out


@bp.get("")
def list_listings():
    sb = get_supabase()
    q = request.args.get("q")
    category = request.args.get("category")
    listing_type = request.args.get("listing_type")
    min_price = request.args.get("min_price")
    max_price = request.args.get("max_price")

    query = sb.table("listings").select(
        f"{_LISTING_FIELDS}, {_USER_FIELDS}"
    ).eq("status", "active")

    if q:
        query = query.ilike("title", f"%{q}%")
    if category:
        query = query.eq("category", category)
    if listing_type:
        query = query.eq("listing_type", listing_type)
    if min_price:
        query = query.gte("price", min_price)
    if max_price:
        query = query.lte("price", max_price)

    res = query.order("created_at", desc=True).limit(100).execute()
    out = []
    for row in (res.data or []):
        row["seller"] = row.pop("users") if row.get("users") else None
        out.append(_serialize_listing(row))
    return jsonify(data=out)


@bp.get("/mine")
@jwt_required()
def list_my_listings():
    uid = get_jwt_identity()
    sb = get_supabase()
    res = sb.table("listings").select(
        f"{_LISTING_FIELDS}, {_USER_FIELDS}"
    ).eq("seller_id", uid).order("created_at", desc=True).execute()
    out = []
    for row in (res.data or []):
        row["seller"] = row.pop("users") if row.get("users") else None
        out.append(_serialize_listing(row))
    return jsonify(data=out)


@bp.get("/<uuid:listing_id>")
def get_listing(listing_id):
    sb = get_supabase()
    res = sb.table("listings").select(
        f"{_LISTING_FIELDS}, {_USER_FIELDS}"
    ).eq("id", str(listing_id)).maybe_single().execute()
    if not res.data:
        return err("not_found", "Listing not found", 404)
    row = res.data
    row["seller"] = row.pop("users") if row.get("users") else None

    if row.get("listing_type") == "rent":
        commission_rate = RENTAL_COMMISSION_RATE
    else:
        configs = sb.table("commission_config").select("*").execute().data or []
        commission_rate = commission_for_category(row["category"], configs)

    return jsonify(data=_serialize_listing(row, commission_rate))


@bp.post("")
@jwt_required()
def create_listing():
    body = request.get_json(force=True) or {}
    uid = get_jwt_identity()
    sb = get_supabase()

    required = ["title", "category", "price"]
    for field in required:
        if not body.get(field):
            return err("validation_error", f"{field} required", 400)

    listing_type = body.get("listing_type", "sale")
    if listing_type not in ("sale", "rent"):
        return err("validation_error", "listing_type must be 'sale' or 'rent'", 400)

    if listing_type == "rent" and not body.get("rent_per_day"):
        return err("validation_error", "rent_per_day required for rent", 400)

    payload = {
        "seller_id": uid,
        "title": body["title"],
        "category": body["category"],
        "price": body["price"],
        "description": body.get("description", ""),
        "photo_urls": body.get("photo_urls") or body.get("photos") or [],
        "listing_type": listing_type,
    }
    if listing_type == "rent":
        payload["rent_per_day"] = body["rent_per_day"]
        if body.get("deposit_required") is not None:
            payload["deposit_required"] = body["deposit_required"]
        if body.get("deposit_rate") is not None:
            payload["deposit_rate"] = body["deposit_rate"]
    if body.get("location"):
        payload["location"] = body["location"]

    res = sb.table("listings").insert(payload).execute()
    if not res.data:
        return err("create_failed", "Failed to create listing", 400)
    return jsonify(data=_serialize_listing(res.data[0])), 201


@bp.patch("/<uuid:listing_id>")
@jwt_required()
def update_listing(listing_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    body = request.get_json(force=True) or {}
    body.pop("seller_id", None)
    body.pop("id", None)
    # whitelist editable fields only
    allowed = {
        "title", "category", "price", "description",
        "photo_urls", "listing_type", "rent_per_day",
        "deposit_required", "deposit_rate", "location", "status",
    }
    safe = {k: v for k, v in body.items() if k in allowed}
    if not safe:
        return err("validation_error", "No editable fields provided", 400)
    res = sb.table("listings").update(safe).eq("id", str(listing_id)).eq("seller_id", uid).execute()
    if not res.data:
        return err("forbidden", "Not the owner or listing missing", 403)
    return jsonify(data=_serialize_listing(res.data[0]))


@bp.delete("/<uuid:listing_id>")
@jwt_required()
def delete_listing(listing_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    res = sb.table("listings").update({"status": "removed"}).eq("id", str(listing_id)).eq("seller_id", uid).execute()
    if not res.data:
        return err("forbidden", "Not the owner or listing missing", 403)
    return jsonify(ok=True)
