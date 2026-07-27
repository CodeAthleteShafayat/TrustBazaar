from decimal import Decimal
from app.services.escrow_state_machine import (
    is_valid_order_transition,
    is_valid_rental_transition,
    commission_for_category,
    deposit_rate_for_category,
)
from app.services.trust_score_engine import calculate, tier_for


# ---------- order state machine ----------
def test_order_paid_to_shipped_is_valid():
    assert is_valid_order_transition("paid", "shipped") is True


def test_order_paid_to_completed_via_silence_is_valid():
    assert is_valid_order_transition("paid", "completed") is True


def test_order_completed_is_terminal():
    assert is_valid_order_transition("completed", "shipped") is False


def test_order_refunded_is_terminal():
    assert is_valid_order_transition("refunded", "completed") is False


def test_order_shipped_to_disputed_is_valid():
    assert is_valid_order_transition("shipped", "disputed") is True


def test_order_shipped_to_completed_is_valid():
    assert is_valid_order_transition("shipped", "completed") is True


# ---------- rental state machine ----------
def test_rental_paid_to_active():
    assert is_valid_rental_transition("paid", "active") is True


def test_rental_active_to_returned():
    assert is_valid_rental_transition("active", "returned") is True


def test_rental_returned_to_completed():
    assert is_valid_rental_transition("returned", "completed") is True


def test_rental_completed_is_terminal():
    assert is_valid_rental_transition("completed", "refunded") is False


# ---------- commission + deposit ----------
def test_commission_electronics_is_8pct():
    configs = [{"category": "electronics", "sale_rate": 0.08}]
    assert commission_for_category("electronics", configs) == Decimal("0.08")


def test_commission_unknown_category_falls_back():
    assert commission_for_category("unknown", []) == Decimal("0.05")


def test_deposit_premium_is_60pct():
    configs = [{"category": "premium_electronics", "deposit_rate": 0.60}]
    assert deposit_rate_for_category("premium_electronics", configs) == Decimal("0.60")


def test_deposit_default_is_40pct():
    assert deposit_rate_for_category("other", []) == Decimal("0.40")


# ---------- trust score ----------
def test_new_user_is_unrated():
    result = calculate(
        joined_at="2026-07-27T00:00:00+00:00",
        completed_orders=[],
        disputed_orders=[],
        resolved_disputes_lost=0,
        completed_rentals_clean=0,
        completed_rentals_total=0,
    )
    assert result["tier"] == "Unrated"
    assert result["score"] is None


def test_perfect_user_is_top_rated():
    from datetime import datetime, timezone, timedelta
    joined = (datetime.now(timezone.utc) - timedelta(days=365)).isoformat()
    result = calculate(
        joined_at=joined,
        completed_orders=[{}, {}, {}, {}, {}],
        disputed_orders=[],
        resolved_disputes_lost=0,
        completed_rentals_clean=3,
        completed_rentals_total=3,
    )
    assert result["score"] >= 90
    assert result["tier"] == "Top Rated"


def test_tier_thresholds():
    assert tier_for(None) == "Unrated"
    assert tier_for(0) == "New"
    assert tier_for(45) == "Reliable"
    assert tier_for(75) == "Trusted"
    assert tier_for(95) == "Top Rated"