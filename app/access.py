"""Optional school / pilot access code + session identity + API keys."""

from __future__ import annotations

import hashlib
import hmac
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request

from app.clerk_auth import clerk_authenticate_request
from app.config import Settings


def access_codes_match(provided: str, expected: str) -> bool:
    a, b = provided.strip().encode("utf-8"), expected.strip().encode("utf-8")
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


def _api_key_fingerprint(secret: str) -> str:
    return "api:" + hashlib.sha256(secret.encode("utf-8")).hexdigest()[:24]


def api_key_owner(request: Request, settings: Settings) -> str | None:
    """Stable owner id for thread binding when request authenticates with a configured API key."""
    keys = settings.api_key_list
    if not keys:
        return None
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        token = auth[7:].strip()
        for k in keys:
            if access_codes_match(token, k):
                return _api_key_fingerprint(k)
    header_key = request.headers.get("X-API-Key") or request.headers.get("X-Api-Key")
    if header_key is not None:
        hk = header_key.strip()
        for k in keys:
            if access_codes_match(hk, k):
                return _api_key_fingerprint(k)
    return None


def ensure_session_learner_id(request: Request) -> str:
    """Stable per-browser session id (set after access check)."""
    sid = request.session.get("learner_session_id")
    if not sid:
        sid = str(uuid4())
        request.session["learner_session_id"] = sid
    return str(sid)


def verify_app_access(request: Request, settings: Settings) -> str | None:
    """Return session, Clerk user, or API-key owner id when auth satisfied; None when auth disabled."""
    if not settings.auth_enabled:
        return None

    request.state.clerk_claims = None

    if settings.clerk_only_auth:
        if not settings.clerk_jwt_configured:
            raise HTTPException(
                status_code=503,
                detail=(
                    "CLERK_ONLY_AUTH is enabled but Clerk is not configured on this API. "
                    "Set CLERK_JWT_ISSUER (or CLERK_JWKS_URL) to match the same Clerk instance as the frontend publishable key."
                ),
            )
        clerk_user = clerk_authenticate_request(request, settings)
        if clerk_user:
            request.state.clerk_claims = clerk_user["claims"]
            return clerk_user["owner"]
        raise HTTPException(
            status_code=401,
            detail="Sign in with Clerk and retry with a valid session token (Authorization: Bearer or __session cookie).",
        )

    key_owner = api_key_owner(request, settings)
    if key_owner:
        return key_owner

    clerk_user = clerk_authenticate_request(request, settings)
    if clerk_user:
        request.state.clerk_claims = clerk_user["claims"]
        return clerk_user["owner"]

    if request.session.get("access_ok") is True:
        return ensure_session_learner_id(request)

    header = request.headers.get("X-App-Access-Code")
    code = (settings.app_access_code or "").strip()
    if code and header and access_codes_match(header, code):
        request.session["access_ok"] = True
        return ensure_session_learner_id(request)

    raise HTTPException(
        status_code=401,
        detail=(
            "Missing access. Sign in with Clerk (session cookie or Authorization: Bearer session JWT), "
            "open /gate when APP_ACCESS_CODE is set, "
            "or send X-App-Access-Code / X-API-Key as configured."
        ),
    )


def session_auth_info(settings: Settings) -> dict[str, Any]:
    return {
        "auth_enabled": settings.auth_enabled,
        "bind_threads_to_session": settings.bind_threads_to_session,
        "gate_url": None if settings.clerk_only_auth else ("/gate" if settings.auth_enabled else None),
        "browser_gate_configured": bool((settings.app_access_code or "").strip()),
        "api_key_auth_configured": bool(settings.api_key_list),
        "clerk_jwt_configured": settings.clerk_jwt_configured,
        "clerk_only_auth": settings.clerk_only_auth,
        "clerk_publishable_key_configured": bool((settings.clerk_publishable_key or "").strip()),
        "clerk_webhook_path": "/webhooks/clerk" if (settings.clerk_webhook_secret or "").strip() else None,
        "clerk_subscription_enforced": settings.clerk_enforce_subscription,
    }
