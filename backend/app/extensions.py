from supabase import create_client, Client
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

jwt = JWTManager()
cors = CORS()
# In-memory storage is fine for a single-process demo deployment; if this ever runs
# behind multiple worker processes/dynos, point storage_uri at Redis instead so limits
# are shared across them.
limiter = Limiter(key_func=get_remote_address, default_limits=[])

# supabase_admin uses the service-role key and bypasses RLS — only used server-side.
# It is a single shared instance reused across every request, so it must NEVER have
# .auth.sign_up/.auth.sign_in_with_password called on it: supabase-py's GoTrue client
# silently swaps the underlying PostgREST session to the just-authenticated user's own
# (RLS-restricted) JWT, which downgrades every subsequent .table() call on this shared
# client — for every user, not just the one who logged in — until someone else logs in.
# Auth-only calls must go through get_supabase_auth_client() instead, which is a fresh,
# throwaway anon-key client per call and never touches supabase_admin's session.
supabase_admin: Client | None = None
_supabase_url: str | None = None
_supabase_anon_key: str | None = None


def init_supabase(url: str, service_role_key: str) -> Client:
    global supabase_admin
    supabase_admin = create_client(url, service_role_key)
    return supabase_admin


def init_supabase_if_configured(url: str, service_role_key: str, anon_key: str | None = None) -> Client | None:
    """Initialize only if creds look real (skip for offline/test boot)."""
    global supabase_admin, _supabase_url, _supabase_anon_key
    _supabase_url = url
    _supabase_anon_key = anon_key
    if not url or url == "http://localhost" or not service_role_key or service_role_key in ("anon", "service", "y"):
        return None
    supabase_admin = create_client(url, service_role_key)
    return supabase_admin


def get_supabase() -> Client:
    if supabase_admin is None:
        raise RuntimeError("Supabase client not initialized — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY")
    return supabase_admin


def get_supabase_auth_client() -> Client:
    """Fresh, per-call client for sign_up/sign_in_with_password — see note on supabase_admin above."""
    if not _supabase_url or not _supabase_anon_key:
        raise RuntimeError("Supabase auth client not initialized — set SUPABASE_URL + SUPABASE_ANON_KEY")
    return create_client(_supabase_url, _supabase_anon_key)
