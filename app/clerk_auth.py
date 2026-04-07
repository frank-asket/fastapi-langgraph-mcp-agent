"""Clerk session JWT verification (Authorization Bearer or __session cookie)."""

from __future__ import annotations

import logging
from typing import Any

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

from app.config import Settings

logger = logging.getLogger(__name__)

_jwks_clients: dict[str, PyJWKClient] = {}


def primary_email_from_clerk_claims(claims: dict[str, Any] | None) -> str | None:
    """Return a usable mailbox from Clerk session JWT claims (often ``email``), if present."""
    if not claims:
        return None
    raw = claims.get("email")
    if not isinstance(raw, str):
        return None
    s = raw.strip()
    if 3 <= len(s) <= 320 and "@" in s:
        return s
    return None


def clerk_jwks_url(settings: Settings) -> str | None:
    raw = (settings.clerk_jwks_url or "").strip().rstrip("/")
    if raw:
        return raw
    iss = (settings.clerk_jwt_issuer or "").strip().rstrip("/")
    if iss:
        return f"{iss}/.well-known/jwks.json"
    return None


def _get_jwks_client(url: str) -> PyJWKClient:
    if url not in _jwks_clients:
        _jwks_clients[url] = PyJWKClient(url)
    return _jwks_clients[url]


def clerk_session_token_from_request(request: Request) -> str | None:
    auth = (request.headers.get("Authorization") or "").strip()
    if auth.lower().startswith("bearer "):
        tok = auth[7:].strip()
        return tok or None
    c = request.cookies.get("__session")
    if c:
        s = str(c).strip()
        return s or None
    return None


def _clerk_token_unverified_payload(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token,
            options={
                "verify_signature": False,
                "verify_exp": False,
                "verify_nbf": False,
            },
        )
    except jwt.exceptions.PyJWTError:
        return {}


def _clerk_verify_failure_detail(exc: jwt.exceptions.PyJWTError, token: str, settings: Settings) -> str:
    issuer = (settings.clerk_jwt_issuer or "").strip().rstrip("/") or None
    audience = (settings.clerk_jwt_audience or "").strip() or None
    claims = _clerk_token_unverified_payload(token)
    tok_iss = claims.get("iss")
    tok_aud = claims.get("aud")

    if isinstance(exc, jwt.exceptions.ExpiredSignatureError):
        return (
            "Clerk session token expired. Sign out and sign in again, or check your system clock. "
            "(If the clock is correct, try a hard refresh.)"
        )
    if isinstance(exc, jwt.exceptions.InvalidAudienceError):
        return (
            "Clerk JWT audience mismatch. Default session tokens often have no `aud`; "
            "leave CLERK_JWT_AUDIENCE unset unless you use a custom JWT template with a fixed audience. "
            f"Token aud={tok_aud!r}, API expects CLERK_JWT_AUDIENCE={audience!r}."
        )
    if isinstance(exc, jwt.exceptions.InvalidIssuerError):
        return (
            "Clerk JWT issuer mismatch. Set CLERK_JWT_ISSUER to the `iss` claim from the session JWT "
            "(Clerk Dashboard → API Keys → show JWT issuer / Frontend API URL), with no trailing path. "
            f"Token iss={tok_iss!r}, API expects CLERK_JWT_ISSUER={issuer!r}."
        )

    hint = ""
    if issuer and tok_iss and str(tok_iss).rstrip("/") != issuer:
        hint = f" Token iss={tok_iss!r} does not match CLERK_JWT_ISSUER={issuer!r}."
    elif audience and tok_aud is not None:
        hint = (
            " If you did not configure a custom JWT template, unset CLERK_JWT_AUDIENCE "
            f"(token aud={tok_aud!r})."
        )
    return (
        "Invalid Clerk session token (signature or format). Check CLERK_JWT_ISSUER and CLERK_JWKS_URL "
        "match the same Clerk instance as NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY."
        + hint
    )


def verify_clerk_session_jwt(token: str, settings: Settings) -> dict[str, Any]:
    jwks = clerk_jwks_url(settings)
    if not jwks:
        raise HTTPException(
            status_code=503,
            detail=(
                "Clerk JWKS is not configured on this API. Set CLERK_JWT_ISSUER to your Clerk Frontend API URL "
                "(Dashboard → API Keys → JWT issuer; no trailing path) or set CLERK_JWKS_URL explicitly."
            ),
        )
    try:
        client = _get_jwks_client(jwks)
        signing_key = client.get_signing_key_from_jwt(token)
        issuer = (settings.clerk_jwt_issuer or "").strip().rstrip("/") or None
        audience = (settings.clerk_jwt_audience or "").strip() or None
        decode_kw: dict[str, Any] = {"algorithms": ["RS256"], "leeway": 60}
        jwt_opts: dict[str, bool] = {}
        if audience:
            decode_kw["audience"] = audience
        else:
            jwt_opts["verify_aud"] = False
        if issuer:
            decode_kw["issuer"] = issuer
        else:
            jwt_opts["verify_iss"] = False
        if jwt_opts:
            decode_kw["options"] = jwt_opts
        payload = jwt.decode(token, signing_key.key, **decode_kw)
    except jwt.exceptions.PyJWTError as e:
        logger.warning("Clerk JWT verification failed: %s", e)
        raise HTTPException(
            status_code=401,
            detail=_clerk_verify_failure_detail(e, token, settings),
        ) from e

    parties = settings.clerk_authorized_parties_set
    azp = payload.get("azp")
    if parties and azp is not None and str(azp) not in parties:
        raise HTTPException(status_code=401, detail="Unauthorized Clerk session (azp).")

    if settings.clerk_reject_org_pending_status:
        sts = payload.get("sts")
        if str(sts).lower() == "pending":
            raise HTTPException(
                status_code=403,
                detail="Finish organization setup in Clerk before using this API.",
            )
    return payload


def clerk_authenticate_request(request: Request, settings: Settings) -> dict[str, Any] | None:
    """Return dict with owner id and claims, or None if no Clerk token present."""
    if not settings.clerk_jwt_configured:
        return None
    token = clerk_session_token_from_request(request)
    if not token or token.count(".") != 2:
        return None
    claims = verify_clerk_session_jwt(token, settings)
    sub = claims.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Clerk token missing subject (sub).")
    return {"owner": f"clerk:{sub}", "claims": claims}


def ensure_clerk_subscription(
    request: Request,
    settings: Settings,
    owner_id: str | None,
) -> None:
    """Enforce subscription for Clerk-authenticated users when configured."""
    if not settings.clerk_enforce_subscription or not owner_id or not owner_id.startswith("clerk:"):
        return
    claims = getattr(request.state, "clerk_claims", None) or {}
    from app.subscription_view import evaluate_enforced_clerk_subscription

    ok, detail = evaluate_enforced_clerk_subscription(settings, owner_id, claims)
    if not ok:
        raise HTTPException(status_code=403, detail=detail or "An active subscription is required.")
