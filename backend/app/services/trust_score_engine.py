"""Trust Score engine — MVP weighted scorer.

Weights: completed_txns 50% + dispute_outcomes 25% + rental_returns 15% + account_age 10%.
Tier thresholds: Unrated (no txns), New (<40), Reliable (40-69), Trusted (70-89), Top Rated (90+).
Anti-gaming down-weighting deferred to Phase 2.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterable

TIERS = [
    (0, 39, "New"),
    (40, 69, "Reliable"),
    (70, 89, "Trusted"),
    (90, 100, "Top Rated"),
]


def _tier(score: int | None) -> str:
    if score is None:
        return "Unrated"
    for lo, hi, name in TIERS:
        if lo <= score <= hi:
            return name
    return "Unrated"


def _account_age_factor(joined_at: str) -> float:
    months = max(0, (datetime.now(timezone.utc) - datetime.fromisoformat(joined_at.replace("Z", "+00:00"))).days / 30)
    return min(months / 12.0, 1.0) * 100


def calculate(
    *,
    joined_at: str,
    completed_orders: Iterable[dict],
    disputed_orders: Iterable[dict],
    resolved_disputes_lost: int,
    completed_rentals_clean: int,
    completed_rentals_total: int,
) -> dict:
    completed_orders = list(completed_orders)
    disputed_orders = list(disputed_orders)
    total = len(completed_orders) + len(disputed_orders)

    if total == 0 and completed_rentals_total == 0:
        return {"score": None, "tier": "Unrated", "breakdown": {"reason": "no_activity"}}

    completed_txns_pct = (
        len(completed_orders) / total * 100 if total else 100
    )

    if total:
        dispute_loss_pct = max(0, 100 - (resolved_disputes_lost / total * 100))
    else:
        dispute_loss_pct = 100

    rental_pct = (
        completed_rentals_clean / completed_rentals_total * 100 if completed_rentals_total else 100
    )

    age_factor = _account_age_factor(joined_at)

    score = round(
        completed_txns_pct * 0.50
        + dispute_loss_pct * 0.25
        + rental_pct * 0.15
        + age_factor * 0.10
    )
    score = max(0, min(100, score))

    return {
        "score": score,
        "tier": _tier(score),
        "breakdown": {
            "completed_txns": round(completed_txns_pct, 1),
            "dispute_outcomes": round(dispute_loss_pct, 1),
            "rental_returns": round(rental_pct, 1),
            "account_age": round(age_factor, 1),
        },
    }


def tier_for(score: int | None) -> str:
    return _tier(score)