"""Disputes routes — list, view, party reads.

Authorization rules: only the raiser, the parties of the underlying order
(buyer/seller) or rental (renter/owner), or an admin may read a dispute.
Anyone else gets 403.
"""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err

bp = Blueprint("disputes", __name__)


def _is_admin(uid: str) -> bool:
    sb = get_supabase()
    res = sb.table("users").select("is_admin").eq("id", uid).maybe_single().execute()
    return bool(res.data and res.data.get("is_admin"))


def _party_ids(dispute: dict) -> list[str]:
    """Return all user IDs that are parties to this dispute's underlying order/rental."""
    sb = get_supabase()
    ids: list[str] = []
    if dispute.get("raised_by"):
        ids.append(dispute["raised_by"])
    order_id = dispute.get("order_id")
    rental_id = dispute.get("rental_id")
    if order_id:
        res = sb.table("orders").select("buyer_id, seller_id").eq("id", order_id).maybe_single().execute()
        if res.data:
            ids.extend([res.data["buyer_id"], res.data["seller_id"]])
    if rental_id:
        res = sb.table("rentals").select("renter_id, owner_id").eq("id", rental_id).maybe_single().execute()
        if res.data:
            ids.extend([res.data["renter_id"], res.data["owner_id"]])
    return ids


@bp.get("")
@jwt_required()
def list_my_disputes():
    uid = get_jwt_identity()
    sb = get_supabase()
    if _is_admin(uid):
        res = sb.table("disputes").select("*, evidence(*)").order("created_at", desc=True).execute()
        return jsonify(data=res.data or [])

    # Non-admins: collect dispute IDs they are a party of, then fetch by id.
    # Avoid the previous unsafe PostgREST `or_(...)` string interpolation that
    # embedded uid into raw subquery SQL — that was both a SQL-injection risk
    # and over-broad (it surfaced disputes raised by anyone sharing the same
    # linked order/rental pool).
    party_ids = {uid}
    order_ids = [r["id"] for r in (sb.table("orders").select("id").or_(f"buyer_id.eq.{uid},seller_id.eq.{uid}").execute().data or [])]
    rental_ids = [r["id"] for r in (sb.table("rentals").select("id").or_(f"renter_id.eq.{uid},owner_id.eq.{uid}").execute().data or [])]

    filters = [f"raised_by.eq.{uid}"]
    if order_ids:
        filters.append("order_id.in.(" + ",".join(order_ids) + ")")
    if rental_ids:
        filters.append("rental_id.in.(" + ",".join(rental_ids) + ")")

    res = sb.table("disputes").select("*, evidence(*)").or_(",".join(filters)).order("created_at", desc=True).execute()
    return jsonify(data=res.data or [])


@bp.get("/<uuid:dispute_id>")
@jwt_required()
def get_dispute(dispute_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    res = sb.table("disputes").select("*, evidence(*)").eq("id", str(dispute_id)).maybe_single().execute()
    if not res.data:
        return err("not_found", "Dispute not found", 404)
    if not _is_admin(uid) and uid not in _party_ids(res.data):
        return err("forbidden", "Not a party to this dispute", 403)
    return jsonify(data=res.data)
