"""FastAPI gateway: compose middleware, MCP mount, and route modules."""

from __future__ import annotations

import logging

from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastmcp.utilities.lifespan import combine_lifespans
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.config import get_settings
from app.constants import STATIC_DIR
from app.lifespan import core_lifespan
from app.limiting import limiter
from app.mcp_http import mcp_app
from app.routers import account_routes, health, site, timetable_routes, webhooks, workflow_routes

_log = logging.getLogger(__name__)

app = FastAPI(
    title="Study Coach API — AI tutoring for African education",
    version="0.1.0",
    lifespan=combine_lifespans(core_lifespan, mcp_app.lifespan),
    description="Vertical AI platform: personalized tutoring, document intelligence, and LangGraph + MCP workflows for Ghanaian and African learners.",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
_sec = get_settings()
app.add_middleware(
    SessionMiddleware,
    secret_key=_sec.session_secret,
    https_only=_sec.session_cookie_secure,
    same_site="lax",
    max_age=14 * 24 * 3600,
)
app.add_middleware(SlowAPIMiddleware)
app.mount("/agent", mcp_app)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

_settings_for_cors = get_settings()
_cors_origins = _settings_for_cors.cors_origin_list
_cors_regex = _settings_for_cors.cors_allow_origin_regex
if _cors_origins or _cors_regex:
    _cors_methods = [m.strip().upper() for m in _settings_for_cors.cors_allow_methods.split(",") if m.strip()]
    _cors_hdr_raw = (_settings_for_cors.cors_allow_headers or "").strip()
    _cors_headers = ["*"] if _cors_hdr_raw == "*" else [h.strip() for h in _cors_hdr_raw.split(",") if h.strip()]
    _cors_expose = [h.strip() for h in _settings_for_cors.cors_expose_headers.split(",") if h.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_cors_origins or [],
        allow_origin_regex=_cors_regex,
        allow_credentials=_settings_for_cors.cors_allow_credentials,
        allow_methods=_cors_methods or ["GET"],
        allow_headers=_cors_headers or ["*"],
        expose_headers=_cors_expose or None,
    )
    _log.info(
        "CORS enabled: %d explicit origin(s)%s",
        len(_cors_origins),
        f", regex configured" if _cors_regex else "",
    )

app.include_router(site.router)
app.include_router(account_routes.router)
app.include_router(health.router)
app.include_router(webhooks.router)
app.include_router(workflow_routes.router)
app.include_router(timetable_routes.router)
