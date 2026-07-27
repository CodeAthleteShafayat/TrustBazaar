import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", SECRET_KEY)
    SUPABASE_URL = os.environ.get("SUPABASE_URL", "http://localhost")
    SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "anon")
    SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "service")
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
    DEMO_FAST_FORWARD_SECONDS = int(os.environ.get("DEMO_FAST_FORWARD_SECONDS", 30))
    RELEASE_WINDOW_DAYS = int(os.environ.get("RELEASE_WINDOW_DAYS", 3))
    DEPOSIT_CLAIM_WINDOW_HOURS = int(os.environ.get("DEPOSIT_CLAIM_WINDOW_HOURS", 48))
    PORT = int(os.environ.get("PORT", 5000))
