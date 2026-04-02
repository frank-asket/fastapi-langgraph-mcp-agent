"""Optional school / pilot access code + session identity."""

from __future__ import annotations

import hmac
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, Request

from app.config import Settings


def access_codes_match(provided: str, expected: str) -> bool:
    a, b = provided.strip().encode("utf-8"), expected.strip().encode("utf-8")
    if len(a) != len(b):
        return False
    return hmac.compare_digest(a, b)


def ensure_session_learner_id(request: Request) -> str:
    """Stable per-browser session id (set after access check)."""
    sid = request.session.get("learner_session_id")
    if not sid:
        sid = str(uuid4())
        request.session["learner_session_id"] = sid
    return str(sid)


def verify_app_access(request: Request, settings: Settings) -> str | None:
    """Return learner_session_id when auth satisfied; None when auth disabled."""
    if not settings.auth_enabled:
        return None

    if request.session.get("access_ok") is True:
        return ensure_session_learner_id(request)

    header = request.headers.get("X-App-Access-Code")
    code = settings.app_access_code or ""
    if header and access_codes_match(header, code):
        request.session["access_ok"] = True
        return ensure_session_learner_id(request)

    raise HTTPException(
        status_code=401,
        detail="Missing access. Open /gate in the browser or send header "
        "X-App-Access-Code matching APP_ACCESS_CODE.",
    )


def session_auth_info(settings: Settings) -> dict[str, Any]:
    return {
        "auth_enabled": settings.auth_enabled,
        "bind_threads_to_session": settings.bind_threads_to_session,
        "gate_url": "/gate" if settings.auth_enabled else None,
    }
