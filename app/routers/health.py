"""Liveness and dependency checks."""

from typing import Any

import httpx
from fastapi import APIRouter, Request
from starlette.responses import Response

from app.config import get_settings
from app.limiting import limiter

router = APIRouter()


@router.get("/health")
@limiter.exempt
async def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/deps")
@limiter.exempt
async def health_deps(request: Request) -> dict[str, Any]:
    settings = get_settings()
    checks: dict[str, Any] = {
        "openai_configured": bool(settings.openai_api_key),
        "checkpointer_ready": getattr(request.app.state, "checkpointer", None) is not None,
        "auth_enabled": settings.auth_enabled,
        "clerk_jwt_configured": settings.clerk_jwt_configured,
        "mcp_reachable": None,
    }
    url = settings.resolved_mcp_http_url
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(url)
            checks["mcp_reachable"] = r.status_code < 500
    except Exception as e:  # noqa: BLE001
        checks["mcp_reachable"] = False
        checks["mcp_error"] = str(e)
    ok = checks["openai_configured"] and checks["checkpointer_ready"] and checks["mcp_reachable"] is not False
    checks["status"] = "ok" if ok else "degraded"
    return checks


@router.get("/favicon.ico", include_in_schema=False)
@limiter.exempt
async def favicon() -> Response:
    return Response(status_code=204)
