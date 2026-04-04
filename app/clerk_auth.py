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


def verify_clerk_session_jwt(token: str, settings: Settings) -> dict[str, Any]:
    jwks = clerk_jwks_url(settings)
    if not jwks:
        raise HTTPException(status_code=500, detail="Clerk JWKS URL is not configured.")
    try:
        client = _get_jwks_client(jwks)
        signing_key = client.get_signing_key_from_jwt(token)
        issuer = (settings.clerk_jwt_issuer or "").strip().rstrip("/") or None
        audience = (settings.clerk_jwt_audience or "").strip() or None
        decode_kw: dict[str, Any] = {"algorithms": ["RS256"]}
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
        logger.info("Clerk JWT verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid or expired Clerk session token.") from e

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
    allowed = {x.strip() for x in settings.clerk_subscription_active_values.split(",") if x.strip()}
    claim_name = (settings.clerk_subscription_jwt_claim or "").strip()
    use_jwt = bool(claim_name)
    use_db = settings.clerk_enforce_entitlements_db
    if not use_jwt and not use_db:
        logger.warning(
            "CLERK_ENFORCE_SUBSCRIPTION is enabled but neither CLERK_SUBSCRIPTION_JWT_CLAIM "
            "nor CLERK_ENFORCE_ENTITLEMENTS_DB is set — skipping subscription check.",
        )
        return

    jwt_ok = True
    if use_jwt:
        val = claims.get(claim_name)
        jwt_ok = str(val) in allowed if val is not None else False

    db_ok = True
    if use_db:
        from pathlib import Path

        from app.clerk_entitlements import get_entitlement

        uid = owner_id.removeprefix("clerk:")
        row = get_entitlement(Path(settings.clerk_entitlements_db_path).expanduser().resolve(), uid)
        st = (row or {}).get("subscription_status")
        db_ok = str(st) in allowed if st is not None else False

    if use_jwt and use_db:
        if not (jwt_ok and db_ok):
            raise HTTPException(
                status_code=403,
                detail="An active subscription is required (JWT claim and account record).",
            )
    elif use_jwt and not jwt_ok:
        raise HTTPException(status_code=403, detail="An active subscription is required.")
    elif use_db and not db_ok:
        raise HTTPException(
            status_code=403,
            detail="An active subscription is required — sync billing with Clerk webhooks.",
        )
