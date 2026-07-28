"""OTP service.

Generates a cryptographically random 6-digit code per (channel, target),
stores only its SHA-256 hash alongside the target and an expiry. Codes are
single-use and bound to the target they were issued for; verification of
code '123456' or any other constant is no longer accepted.

Storage is in-memory (process-wide). This matches the rest of the MVP,
which keeps no Redis; if/when we move to multi-process, swap for the same
interface backed by Supabase/Redis.
"""
import hashlib
import hmac
import logging
import secrets
import time

log = logging.getLogger(__name__)

CODE_LENGTH = 6
TTL_SECONDS = 300          # 5 minutes
MAX_ATTEMPTS = 5           # per (channel, target, code) slot


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


class OtpService:
    def request(self, *, channel: str, target: str) -> None:
        """Generate and store a new OTP for (channel, target).

        Returns the plaintext code only via the logging sink — never to the
        caller. The transport layer (Twilio/SMTP — future work) is the only
        thing that should see the plaintext.
        """
        ...

    def verify(self, *, channel: str, target: str, code: str) -> bool:
        """Constant-time comparison of the supplied code against the active
        slot for (channel, target). Returns True iff matched, unexpired, and
        not already consumed. On success the slot is invalidated.
        """
        ...


class InMemoryOtpService(OtpService):
    """Default implementation. Single-process, in-memory."""

    def __init__(self) -> None:
        # key: (channel, target) -> {code_hash, expires_at, attempts, used}
        self._slots: dict[tuple[str, str], dict] = {}

    def request(self, *, channel: str, target: str) -> None:
        # Invalidate any previous slot for this (channel, target).
        self._slots.pop((channel, target), None)
        code = "".join(secrets.choice("0123456789") for _ in range(CODE_LENGTH))
        self._slots[(channel, target)] = {
            "code_hash": _hash_code(code),
            "expires_at": time.time() + TTL_SECONDS,
            "attempts": 0,
            "used": False,
        }
        # Transport (future: Twilio/SMTP) would send `code` here. For MVP
        # we log so an operator can deliver it out-of-band. Never returned
        # to the API caller.
        log.info("[OTP] issued channel=%s target=%s (deliver out-of-band)", channel, target)

    def verify(self, *, channel: str, target: str, code: str) -> bool:
        slot = self._slots.get((channel, target))
        if not slot:
            return False
        if slot["used"]:
            return False
        if time.time() > slot["expires_at"]:
            # Expired slots are discarded so retries must re-request.
            self._slots.pop((channel, target), None)
            return False
        if slot["attempts"] >= MAX_ATTEMPTS:
            self._slots.pop((channel, target), None)
            return False

        slot["attempts"] += 1
        candidate = _hash_code(code)
        if not hmac.compare_digest(candidate, slot["code_hash"]):
            return False

        slot["used"] = True
        self._slots.pop((channel, target), None)
        return True


_service: OtpService = InMemoryOtpService()


def get_otp_service() -> OtpService:
    return _service