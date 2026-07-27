"""Wallet routes — balance + ledger + payout request (mocked)."""
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err

bp = Blueprint("wallet", __name__)


@bp.get("")
@jwt_required()
def get_wallet():
    uid = get_jwt_identity()
    sb = get_supabase()
    ledger = sb.table("wallet_ledger").select("*").eq("user_id", uid).order("created_at", desc=True).execute().data or []
    available = sum(Decimal(str(r["amount"])) for r in ledger if r["type"] in ("release", "refund"))
    pending = Decimal("0")  # MVP: pending = escrow-held orders/rentals; calculated separately
    return jsonify(data={
        "available": str(available.quantize(Decimal('0.01'))),
        "pending": str(pending),
        "ledger": [
            {**r, "amount": str(r["amount"])} for r in ledger
        ],
    })


@bp.post("/payout")
@jwt_required()
def request_payout():
    uid = get_jwt_identity()
    body = request.get_json(force=True) or {}
    amount = Decimal(str(body.get("amount", "0")))
    if amount <= 0:
        return err("validation_error", "amount > 0 required", 400)

    sb = get_supabase()
    ledger = sb.table("wallet_ledger").select("*").eq("user_id", uid).execute().data or []
    available = sum(Decimal(str(r["amount"])) for r in ledger if r["type"] in ("release", "refund"))
    if amount > available:
        return err("insufficient_funds", "Insufficient wallet balance", 422)

    # Mocked in MVP — in Phase 2 this hits SSLCommerz payout or Stripe Connect.
    res = sb.table("wallet_ledger").insert({
        "user_id": uid,
        "type": "debit",
        "amount": str(amount),
        "reference": "payout:mock",
    }).execute()
    return jsonify(data={"payout_id": res.data[0]["id"], "status": "mocked"})
