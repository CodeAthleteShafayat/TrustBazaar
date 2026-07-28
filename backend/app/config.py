import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

FLASK_ENV = os.environ.get("FLASK_ENV", "development")
IS_PRODUCTION = FLASK_ENV == "production"


def _require_secret(name: str, dev_default: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    if IS_PRODUCTION:
        # Fail fast at startup rather than silently running with a secret that's
        # public knowledge (it's sitting in this file's git history) — that would
        # let anyone forge valid JWTs / sign session cookies.
        raise RuntimeError(
            f"{name} must be set via environment variable when FLASK_ENV=production. "
            f"Refusing to start with the insecure development default."
        )
    return dev_default


class Config:
    FLASK_ENV = FLASK_ENV
    IS_PRODUCTION = IS_PRODUCTION
    DEBUG = not IS_PRODUCTION

    SECRET_KEY = _require_secret("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY") or SECRET_KEY
    # No refresh-token flow exists yet, so a short-lived access token just logs
    # everyone out constantly with no way back in short of re-entering credentials.
    # 7 days is a deliberate MVP tradeoff, not an oversight — revisit if/when a
    # refresh flow is added.
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)

    SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://localhost")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "anon")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "service")
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    DEMO_FAST_FORWARD_SECONDS = int(os.environ.get("DEMO_FAST_FORWARD_SECONDS", 30))
    RELEASE_WINDOW_DAYS = int(os.environ.get("RELEASE_WINDOW_DAYS", 3))
    DEPOSIT_CLAIM_WINDOW_HOURS = int(os.environ.get("DEPOSIT_CLAIM_WINDOW_HOURS", 48))
    PORT = int(os.environ.get("PORT", 5000))

    # Global cap on request body size — defense in depth beyond the per-file check in
    # routes/upload.py, so no endpoint (not just upload) can be sent an unbounded body.
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10MB
