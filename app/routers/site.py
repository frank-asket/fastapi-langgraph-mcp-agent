"""Browser redirects to Next.js, access gate, and service map.

Legacy marketing/assessment/chat HTML lived under ``app/static``; those pages are served
by the Next.js app. Only ``static/gate.html`` remains for APP_ACCESS_CODE cookie sessions.
"""

from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.access import access_codes_match, session_auth_info
from app.agent_lanes import DEFAULT_AGENT_LANE, VALID_AGENT_LANES
from app.config import get_settings
from app.constants import STATIC_DIR
from app.limiting import dynamic_gate_limit, limiter

router = APIRouter()

_API_UI_STUB = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Study Coach API</title></head>
<body style="margin:0;min-height:100dvh;font-family:system-ui,sans-serif;background:#0f1411;color:#c4cfc7;padding:2rem">
<h1 style="color:#fff">Study Coach — API</h1>
<p>Web UI is built with Next.js under <code style="color:#d4a84b">frontend/</code>.</p>
<p>Set <code style="color:#d4a84b">STUDY_COACH_FRONTEND_URL</code> (e.g. <code>http://127.0.0.1:3000</code>) to redirect
<code>/</code>, <code>/assessment</code>, and <code>/chat</code> to that app.</p>
<p><a href="/docs" style="color:#d4a84b">API docs</a>
<span style="opacity:0.5"> · </span>
<a href="/service" style="color:#d4a84b">Service map</a></p>
</body></html>"""


def _frontend_redirect(path: str) -> RedirectResponse | None:
    settings = get_settings()
    base = settings.study_coach_frontend_base
    if not base:
        return None
    p = path if path.startswith("/") else f"/{path}"
    return RedirectResponse(f"{base}{p}", status_code=302)


def _resolve_post_gate_destination(next_raw: str) -> str:
    """Return absolute URL if frontend is configured, otherwise a path on this host."""
    settings = get_settings()
    base = settings.study_coach_frontend_base
    dest = (next_raw or "").strip() or "/studio/chat"
    if not dest.startswith("/"):
        dest = "/studio/chat"
    if dest == "/chat":
        dest = "/studio/chat"
    if base:
        return f"{base}{dest}"
    return dest


@router.get("/", response_class=HTMLResponse, include_in_schema=False, response_model=None)
@limiter.exempt
async def landing() -> HTMLResponse | RedirectResponse:
    redir = _frontend_redirect("/")
    if redir:
        return redir
    return HTMLResponse(_API_UI_STUB)


@router.get("/service")
@limiter.exempt
async def service_info() -> dict[str, Any]:
    settings = get_settings()
    fe = settings.study_coach_frontend_base
    chat_hint = f"{fe}/studio/chat" if fe else None
    return {
        "service": "study-coach",
        "landing": "/",
        "assessment": "/assessment",
        "gate": "/gate" if settings.auth_enabled else None,
        "docs": "/docs",
        "chat_ui": chat_hint or "/chat",
        "chat_ui_note": "Browser UI is the Next.js app (/studio/chat); legacy GET /chat on this API redirects when STUDY_COACH_FRONTEND_URL is set.",
        "frontend_url": fe,
        "health": "/health",
        "health_detail": "/health/deps",
        "workflow": "/workflow",
        "workflow_upload": "/workflow/upload",
        "workflow_stream": "/workflow/stream",
        "workflow_history": "/workflow/history",
        "checkpoint_sqlite": settings.checkpoint_sqlite_path,
        "thread_registry_db": settings.thread_registry_db_path,
        "mcp_http": "/agent/mcp",
        "mcp_client_url_hint": settings.resolved_mcp_http_url,
        "agent_lanes": sorted(VALID_AGENT_LANES),
        "agent_lane_default": DEFAULT_AGENT_LANE,
        "cors_enabled": bool(settings.cors_origin_list),
        "global_rate_limit_per_minute": settings.global_requests_per_minute,
        "gate_posts_per_minute": settings.gate_posts_per_minute,
        "workflow_requests_per_minute": settings.workflow_requests_per_minute,
        **session_auth_info(settings),
    }


@router.get("/gate", response_class=HTMLResponse, include_in_schema=False, response_model=None)
@limiter.exempt
async def gate_page() -> HTMLResponse | RedirectResponse:
    settings = get_settings()
    if not settings.auth_enabled:
        redir = _frontend_redirect("/studio/chat")
        return redir if redir else RedirectResponse("/docs", status_code=302)
    if settings.clerk_only_auth:
        redir = _frontend_redirect("/studio/chat")
        return redir if redir else RedirectResponse("/docs", status_code=302)
    if not (settings.app_access_code or "").strip():
        if settings.clerk_jwt_configured:
            gate_body = (
                "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'/>"
                "<title>Access — Study Coach</title></head>"
                "<body style='margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;"
                "font-family:system-ui,sans-serif;background:#0f1411;color:#c4cfc7;padding:2rem'>"
                "<div style='max-width:460px;background:#171e19;border:1px solid #2a352e;border-radius:16px;padding:1.5rem'>"
                "<h1 style='margin:0 0 0.75rem;font-size:1.15rem;color:#fff'>Clerk sign-in</h1>"
                "<p style='margin:0 0 1rem;line-height:1.5;color:#8c9a90;font-size:0.9rem'>"
                "No <code>APP_ACCESS_CODE</code> is configured. Use Clerk on your frontend and call this API "
                "with the session token in <code>Authorization: Bearer &lt;token&gt;</code> "
                "(cross-origin) or the <code>__session</code> cookie on same-site deployments. "
                "Set <code>APP_ACCESS_CODE</code> if you still want a simple browser gate.</p>"
                "<p style='margin:0'><a href='/' style='color:#d4a84b'>← API home</a></p></div></body></html>"
            )
        else:
            gate_body = (
                "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'/>"
                "<title>Access — Study Coach</title></head>"
                "<body style='margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;"
                "font-family:system-ui,sans-serif;background:#0f1411;color:#c4cfc7;padding:2rem'>"
                "<div style='max-width:420px;background:#171e19;border:1px solid #2a352e;border-radius:16px;padding:1.5rem'>"
                "<h1 style='margin:0 0 0.75rem;font-size:1.15rem;color:#fff'>API key mode</h1>"
                "<p style='margin:0 0 1rem;line-height:1.5;color:#8c9a90;font-size:0.9rem'>"
                "No browser access code is configured. Use "
                "<code style='color:#d4a84b'>X-API-Key</code> or "
                "<code style='color:#d4a84b'>Authorization: Bearer …</code> on API calls, "
                "or set <code>APP_ACCESS_CODE</code> or Clerk (<code>CLERK_JWT_ISSUER</code>) for end users.</p>"
                "<p style='margin:0'><a href='/' style='color:#d4a84b'>← API home</a></p></div></body></html>"
            )
        return HTMLResponse(gate_body, status_code=200)
    path = STATIC_DIR / "gate.html"
    if not path.is_file():
        raise HTTPException(status_code=404)
    return HTMLResponse(path.read_text(encoding="utf-8"))


@router.post("/gate/session")
@limiter.limit(dynamic_gate_limit)
async def gate_session(
    request: Request,
    access_code: str = Form(...),
    next: str = Form("/studio/chat"),
) -> RedirectResponse:
    settings = get_settings()
    dest = _resolve_post_gate_destination(next)
    if not settings.auth_enabled:
        return RedirectResponse(dest, status_code=302)
    if settings.clerk_only_auth:
        return RedirectResponse(dest, status_code=303)
    expected = (settings.app_access_code or "").strip()
    if not expected:
        return RedirectResponse("/gate?e=2", status_code=302)
    if not access_codes_match(access_code, expected):
        return RedirectResponse("/gate?e=1", status_code=302)
    request.session["access_ok"] = True
    if not request.session.get("learner_session_id"):
        request.session["learner_session_id"] = str(uuid4())
    return RedirectResponse(dest, status_code=303)


@router.get("/assessment", response_class=HTMLResponse, include_in_schema=False, response_model=None)
@limiter.exempt
async def assessment_ui() -> HTMLResponse | RedirectResponse:
    redir = _frontend_redirect("/assessment")
    if redir:
        return redir
    return HTMLResponse(_API_UI_STUB)


@router.get("/chat", response_class=HTMLResponse, include_in_schema=False, response_model=None)
@limiter.exempt
async def chat_ui() -> HTMLResponse | RedirectResponse:
    redir = _frontend_redirect("/studio/chat")
    if redir:
        return redir
    return HTMLResponse(_API_UI_STUB)
