"""OTP service — interface + MockOtpService for MVP.

MVP returns code '123456' for any target and logs to stdout.
Phase 2 swaps for TwilioAdapter / SmtpAdapter.
"""
import logging

log = logging.getLogger(__name__)

MOCK_CODE = "123456"


class OtpService:
    def request(self, *, channel: str, target: str) -> str: ...


class MockOtpService(OtpService):
    def request(self, *, channel: str, target: str) -> str:
        log.warning("[OTP] channel=%s target=%s code=%s (MOCK)", channel, target, MOCK_CODE)
        return MOCK_CODE


_service: OtpService = MockOtpService()


def get_otp_service() -> OtpService:
    return _service


def verify(code: str) -> bool:
    return code == MOCK_CODE