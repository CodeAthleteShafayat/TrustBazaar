"""Trust Score routes — fetch score for a user (public)."""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..services.trust_score_engine import calculate as calc_score, tier_for

bp = Blueprint("trust_score", __name__)


@bp.get("/me")
@jwt_required()
def my_score():
    uid = get_jwt_identity()
    return _score_response(uid)


@bp.get("/<uuid:user_id>")
def user_score(user_id):
    return _score_response(str(user_id))


def _score_response(user_id: str):
    sb = get_supabase()
    user = sb.table("users").select("id, joined_at, trust_score, trust_tier").eq("id", user_id).maybe_single().execute()
    if not user.data:
        return jsonify(data={"score": None, "tier": "Unrated", "breakdown": {}})

    orders = sb.table("orders").select("status").or_(f"buyer_id.eq.{user_id},seller_id.eq.{user_id}").execute().data or []
    disputed = [o for o in orders if o["status"] == "disputed"]
    completed = [o for o in orders if o["status"] == "completed"]

    rentals = sb.table("rentals").select("status, deposit_status").or_(f"renter_id.eq.{user_id},owner_id.eq.{user_id}").execute().data or []
    completed_rentals = [r for r in rentals if r["status"] == "completed"]
    clean_rentals = [r for r in completed_rentals if r["deposit_status"] == "refunded"]

    disputes_lost = sum(1 for d in (sb.table("disputes").select("resolution").eq("raised_by", user_id).execute().data or []) if d.get("resolution") == "refund")

    result = calc_score(
        joined_at=user.data["joined_at"],
        completed_orders=completed,
        disputed_orders=disputed,
        resolved_disputes_lost=disputes_lost,
        completed_rentals_clean=len(clean_rentals),
        completed_rentals_total=len(completed_rentals),
    )

    if result["score"] is not None:
        sb.table("users").update({"trust_score": result["score"], "trust_tier": result["tier"]}).eq("id", user_id).execute()
    return jsonify(data=result)
