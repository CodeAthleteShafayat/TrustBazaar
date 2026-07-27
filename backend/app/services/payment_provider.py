"""Payment provider — interface + MockPaymentProvider for MVP.

Phase 2 swaps MockPaymentProvider for SSLCommerzAdapter or StripeAdapter
without changing any caller. See DEV_CONTRACT.md §9.
"""
from __future__ import annotations
from dataclasses import dataclass
from decimal import Decimal
import uuid


@dataclass
class ChargeResult:
    success: bool
    charge_id: str
    amount: Decimal
    raw: dict


class PaymentProvider:
    def charge(self, *, user_id: str, amount: Decimal, reference: str) -> ChargeResult: ...

    def refund(self, *, charge_id: str, amount: Decimal) -> ChargeResult: ...

    def release(self, *, charge_id: str, amount: Decimal, destination: str) -> ChargeResult: ...


class MockPaymentProvider(PaymentProvider):
    """Always succeeds. Logs to stdout. Used for MVP demos."""

    def charge(self, *, user_id, amount, reference) -> ChargeResult:
        charge_id = f"mock_{uuid.uuid4().hex[:12]}"
        return ChargeResult(True, charge_id, amount, {"mock": True, "user_id": user_id, "reference": reference})

    def refund(self, *, charge_id, amount) -> ChargeResult:
        return ChargeResult(True, charge_id, amount, {"mock_refund": True})

    def release(self, *, charge_id, amount, destination) -> ChargeResult:
        return ChargeResult(True, charge_id, amount, {"mock_release": True, "destination": destination})


# Singleton used by routes — swap in Phase 2 by replacing this assignment.
_provider: PaymentProvider = MockPaymentProvider()


def get_payment_provider() -> PaymentProvider:
    return _provider