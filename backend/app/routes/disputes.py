"""Disputes routes — list, view, party reads."""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err

bp = Blueprint("disputes", __name__)


@bp.get("")
@jwt_required()
def list_my_disputes():
    uid = get_jwt_identity()
    sb = get_supabase()
    by_orders = sb.table("disputes").select("*, order_id, rental_id, evidence(*)").contains("order_id", []).execute()  # placeholder, fallback below
    res = sb.table("disputes").select("*, evidence(*)").or_(
        f"raised_by.eq.{uid},order_id.in.("
        f"select id from orders where buyer_id='{uid}' or seller_id='{uid}'"
        f"),rental_id.in.(select id from rentals where renter_id='{uid}' or owner_id='{uid}')"
    ).execute()
    return jsonify(data=res.data or [])


@bp.get("/<uuid:dispute_id>")
@jwt_required()
def get_dispute(dispute_id):
    uid = get_jwt_identity()
    sb = get_supabase()
    res = sb.table("disputes").select("*, evidence(*)").eq("id", str(dispute_id)).maybe_single().execute()
    if not res.data:
        return err("not_found", "Dispute not found", 404)
    return jsonify(data=res.data)
