"""Admin routes — gated to users with users.is_admin = true."""
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
    admin_notes = body.get("admin_notes", "")
    sb = get_supabase()

    # Persist admin notes via a cheap update on the dispute row first —
    # this is non-financial metadata only. The financial resolution is
    # delegated entirely to resolve_dispute_atomic so dispute state, the
    # order/rental state machine, and wallet_ledger commits as one
    # Postgres transaction.
    sb.table("disputes").update({
        "admin_notes": admin_notes,
    }).eq("id", str(dispute_id)).eq("status", "open").execute()

    rpc_res = sb.rpc("resolve_dispute_atomic", {
        "p_dispute_id":   str(dispute_id),
        "p_decision":     decision,
        "p_split_buyer":  body.get("split_buyer"),
        "p_split_seller": body.get("split_seller"),
    }).execute()
    if not rpc_res.data or (isinstance(rpc_res.data, dict) and rpc_res.data.get("error")):
        err_code = (rpc_res.data or {}).get("error") or "conflict"
        err_msg = (rpc_res.data or {}).get("message") or "Could not resolve dispute"
        status_map = {"not_found": 404, "validation_error": 400}
        return err(err_code, err_msg, status_map.get(err_code, 409))

    return jsonify(data=rpc_res.data)


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
