"""Rate limiting (SlowAPI) keyed by IP, session, or gate."""

import hashlib

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings


def _limit_key(request: Request) -> str:
    path = request.url.path
    method = request.method.upper()
    if path == "/gate/session" and method == "POST":
        return "gate:" + get_remote_address(request)
    settings = get_settings()
    if settings.auth_enabled:
        sid = request.session.get("learner_session_id")
        if sid:
            return f"sid:{sid}"
    return get_remote_address(request)


def _global_rate_limit_string() -> str:
    return f"{get_settings().global_requests_per_minute}/minute"


def _make_limiter() -> Limiter:
    settings = get_settings()
    default_limits: list = []
    if settings.global_requests_per_minute > 0:
        default_limits.append(_global_rate_limit_string)
    kw: dict = {
        "key_func": _limit_key,
        "default_limits": default_limits,
        "headers_enabled": settings.rate_limit_headers_enabled,
    }
    if settings.rate_limit_storage_uri:
        kw["storage_uri"] = settings.rate_limit_storage_uri
    return Limiter(**kw)


limiter = _make_limiter()


def dynamic_workflow_limit() -> str:
    return f"{get_settings().workflow_requests_per_minute}/minute"


def email_export_limit_key(request: Request) -> str:
    """Stabilize hourly email-export caps per signed-in user (Bearer) or session / IP."""
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer ") and len(auth) > 24:
        return "email_export:" + hashlib.sha256(auth[7:256].encode()).hexdigest()[:24]
    sid = request.session.get("learner_session_id")
    if sid:
        return f"email_export:sid:{sid}"
    return "email_export:ip:" + get_remote_address(request)


def dynamic_coach_email_export_limit() -> str:
    return f"{get_settings().coach_email_exports_per_hour}/hour"


def dynamic_gate_limit() -> str:
    return f"{get_settings().gate_posts_per_minute}/minute"
