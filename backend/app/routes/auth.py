"""Auth routes — signup, login, OTP request/verify, logout, me."""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from ..extensions import get_supabase, get_supabase_auth_client, limiter
from ..services.otp_service import get_otp_service, verify as verify_otp
from ..utils.errors import err

bp = Blueprint("auth", __name__)


@bp.post("/signup")
@limiter.limit("5 per hour")
def signup():
    body = request.get_json(force=True) or {}
    email = body.get("email")
    password = body.get("password")
    display_name = body.get("display_name")
    if not email or not password or not display_name:
        return err("validation_error", "email, password, display_name required", 400)
    if len(password) < 8:
        return err("validation_error", "Password must be at least 8 characters", 400)

    try:
        res = get_supabase_auth_client().auth.sign_up({
            "email": email,
            "password": password,
            "options": {"data": {"display_name": display_name}},
        })
    except Exception as e:
        return err("signup_failed", str(e), 400)
    if not res.user:
        return err("signup_failed", "Could not create account", 400)

    sb = get_supabase()
    token = create_access_token(identity=res.user.id)
    profile = sb.table("users").select(
        "id, email, display_name, phone, trust_score, trust_tier, avatar_url, joined_at, is_admin"
    ).eq("id", res.user.id).maybe_single().execute()
    user = profile.data or {"id": res.user.id, "email": res.user.email, "display_name": display_name}

    return jsonify(data={"access_token": token, "user": user})


@bp.post("/login")
@limiter.limit("10 per minute")
def login():
    body = request.get_json(force=True) or {}
    try:
        res = get_supabase_auth_client().auth.sign_in_with_password({"email": body.get("email"), "password": body.get("password")})
    except Exception:
        return err("login_failed", "Invalid credentials", 401)
    if not res.session or not res.user:
        return err("login_failed", "Invalid credentials", 401)

    sb = get_supabase()
    token = create_access_token(identity=res.user.id)
    profile = sb.table("users").select(
        "id, email, display_name, phone, trust_score, trust_tier, avatar_url, joined_at, is_admin"
    ).eq("id", res.user.id).maybe_single().execute()
    user = profile.data or {"id": res.user.id, "email": res.user.email}

    return jsonify(data={"access_token": token, "user": user})


@bp.post("/otp/request")
@limiter.limit("5 per minute")
def otp_request():
    body = request.get_json(force=True) or {}
    channel = body.get("channel", "email")
    target = body.get("target")
    if not target:
        return err("validation_error", "target required", 400)
    code = get_otp_service().request(channel=channel, target=target)
    # dev_code only appears outside production — MockOtpService doesn't actually send
    # anything, so exposing the code in the response was equivalent to no auth at all.
    if current_app.config["DEBUG"]:
        return jsonify(ok=True, dev_code=code)
    return jsonify(ok=True)


@bp.post("/otp/verify")
@limiter.limit("10 per minute")
def otp_verify():
    body = request.get_json(force=True) or {}
    target = body.get("target")
    code = body.get("code")
    if not target or not code:
        return err("validation_error", "target and code required", 400)
    if not verify_otp(target, code):
        return err("otp_invalid", "Code is invalid or expired", 401)

    sb = get_supabase()
    # Two separate exact-match lookups instead of a single interpolated .or_() filter —
    # target is attacker-controlled input; building a PostgREST filter string with an
    # f-string let commas/dots in it inject extra filter clauses. .eq() parameterizes
    # the value instead of splicing it into the filter DSL.
    user = sb.table("users").select("id, email").eq("email", target).maybe_single().execute()
    if not user.data:
        user = sb.table("users").select("id, email").eq("phone", target).maybe_single().execute()
    if not user.data:
        return err("not_found", "Account not found for that target", 404)
    token = create_access_token(identity=user.data["id"])
    return jsonify(data={"access_token": token, "user": user.data})


@bp.post("/logout")
@jwt_required()
def logout():
    return jsonify(ok=True)


@bp.get("/me")
@jwt_required()
def me():
    uid = get_jwt_identity()
    sb = get_supabase()
    user = sb.table("users").select("id, email, display_name, phone, trust_score, trust_tier, avatar_url, joined_at, is_admin").eq("id", uid).maybe_single().execute()
    return jsonify(data=user.data)
