"""Escrow state machine — enforces valid order/rental transitions."""
from decimal import Decimal

VALID_ORDER_TRANSITIONS = {
    "paid": {"shipped", "completed"},       # auto-release after window counts as -> completed
    "shipped": {"completed", "disputed"},
    "disputed": {"refunded", "completed"},
    "completed": set(),
    "refunded": set(),
}

VALID_RENTAL_TRANSITIONS = {
    "paid": {"active"},
    "active": {"returned", "disputed"},
    "returned": {"refunded", "disputed", "completed"},
    "disputed": {"refunded", "completed"},
    "refunded": set(),
    "completed": set(),
}


def is_valid_order_transition(current: str, target: str) -> bool:
    return target in VALID_ORDER_TRANSITIONS.get(current, set())


def is_valid_rental_transition(current: str, target: str) -> bool:
    return target in VALID_RENTAL_TRANSITIONS.get(current, set())


def commission_for_category(category: str, configs: list[dict]) -> Decimal:
    for c in configs:
        if c["category"] == category:
            return Decimal(str(c["sale_rate"]))
    return Decimal("0.05")


def deposit_rate_for_category(category: str, configs: list[dict]) -> Decimal:
    for c in configs:
        if c["category"] == category:
            return Decimal(str(c["deposit_rate"]))
    return Decimal("0.40")