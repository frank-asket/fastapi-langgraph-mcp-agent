"""Application lifespan: LangGraph SQLite checkpointer."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.config import get_settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def core_lifespan(app: FastAPI):
    settings = get_settings()
    db_path = Path(settings.checkpoint_sqlite_path).expanduser()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn_str = str(db_path.resolve())
    if settings.auth_enabled and len(settings.session_secret) < 16:
        logger.warning("SESSION_SECRET is short — use a long random value for session signing in production.")
    if settings.clerk_only_auth:
        if not settings.clerk_jwt_configured:
            logger.error(
                "CLERK_ONLY_AUTH is on but CLERK_JWT_ISSUER / CLERK_JWKS_URL is missing — workflow routes are effectively open.",
            )
        if not (settings.clerk_publishable_key or "").strip():
            logger.warning("CLERK_ONLY_AUTH is on but CLERK_PUBLISHABLE_KEY is missing — /chat cannot embed Clerk sign-in.")
    if (settings.clerk_publishable_key or "").strip() and not settings.clerk_jwt_configured:
        logger.warning("CLERK_PUBLISHABLE_KEY is set but CLERK_JWT_ISSUER / JWKS is missing — backend cannot verify session tokens.")
    async with AsyncSqliteSaver.from_conn_string(conn_str) as saver:
        app.state.checkpointer = saver
        logger.info("LangGraph thread memory (SQLite): %s", conn_str)
        yield
