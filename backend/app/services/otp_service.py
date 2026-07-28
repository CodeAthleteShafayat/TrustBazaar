"""OTP service — interface + MockOtpService for MVP.

MVP generates a random per-target code, stores it in memory with a short
expiry, and logs it to stdout instead of actually sending an SMS/email.
Phase 2 swaps MockOtpService for a TwilioAdapter/SmtpAdapter that sends it
for real — the request()/verify() contract stays the same either way.

SECURITY: verify() used to just check `code == "123456"` — a hardcoded
constant with no binding to who requested it, meaning anyone could log in
as any known email/phone with no proof of ownership at all. Fixed to
require a code that was actually issued for that specific target, within
its expiry window, consumed exactly once.
"""
import logging
import random
import time

log = logging.getLogger(__name__)

CODE_TTL_SECONDS = 10 * 60  # 10 minutes
_store: dict[str, tuple[str, float]] = {}  # target -> (code, expires_at)


class OtpService:
    def request(self, *, channel: str, target: str) -> str: ...


class MockOtpService(OtpService):
    def request(self, *, channel: str, target: str) -> str:
        code = f"{random.randint(0, 999999):06d}"
        _store[target] = (code, time.monotonic() + CODE_TTL_SECONDS)
        log.warning("[OTP] channel=%s target=%s code=%s (MOCK — not actually sent)", channel, target, code)
        return code


_service: OtpService = MockOtpService()


def get_otp_service() -> OtpService:
    return _service


def verify(target: str, code: str) -> bool:
    entry = _store.get(target)
    if not entry:
        return False
    stored_code, expires_at = entry
    if time.monotonic() > expires_at:
        _store.pop(target, None)
        return False
    if stored_code != code:
        return False
    _store.pop(target, None)  # one-time use
    return True
