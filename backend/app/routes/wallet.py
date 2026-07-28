"""Wallet routes — balance + ledger + payout request (mocked)."""
from decimal import Decimal
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..extensions import get_supabase
from ..utils.errors import err

bp = Blueprint("wallet", __name__)


# Inflows (credits) and outflows (debits) per the wallet_ledger enum in
# 006_wallet.sql. Used for the read-only balance view in get_wallet; the
# authoritative computation is in payout_atomic().
_INFLOW_TYPES = ("credit", "release", "refund")
_OUTFLOW_TYPES = ("debit", "hold")


def _available_from_rows(rows: list[dict]) -> Decimal:
    available = Decimal("0")
    for r in rows:
        amt = Decimal(str(r["amount"]))
        if r["type"] in _INFLOW_TYPES:
            available += amt
        elif r["type"] in _OUTFLOW_TYPES:
            available -= amt
    return available


@bp.get("")
@jwt_required()
def get_wallet():
    uid = get_jwt_identity()
    sb = get_supabase()
    ledger = sb.table("wallet_ledger").select("*").eq("user_id", uid).order("created_at", desc=True).execute().data or []
    available = _available_from_rows(ledger)
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
    try:
        amount = Decimal(str(body.get("amount", "0")))
    except Exception:
        return err("validation_error", "amount must be numeric", 400)
    if amount <= 0:
        return err("validation_error", "amount > 0 required", 400)

    sb = get_supabase()

    # Single Postgres transaction under a per-user advisory lock: reads
    # the ledger, computes available, inserts a debit row — all atomic.
    # Two concurrent payouts from the same user serialise on the lock, so
    # the second sees the first's debit and recomputes a (lower) balance.
    rpc_res = sb.rpc("payout_atomic", {
        "p_user_id": uid,
        "p_amount": str(amount),
    }).execute()

    if not rpc_res.data or (isinstance(rpc_res.data, dict) and rpc_res.data.get("error")):
        err_code = (rpc_res.data or {}).get("error") or "payout_failed"
        err_msg = (rpc_res.data or {}).get("message") or "Payout failed"
        status = 422 if err_code == "insufficient_funds" else 400
        return err(err_code, err_msg, status)

    # Mocked in MVP — in Phase 2 this hits SSLCommerz payout or Stripe Connect.
    return jsonify(data={"payout_id": rpc_res.data["payout_id"], "status": "mocked"})
