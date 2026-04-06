"""Application lifespan: LangGraph checkpointer (SQLite or MemorySaver) + timetable notification ticker."""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from app.config import get_settings

logger = logging.getLogger(__name__)


async def _timetable_tick_loop() -> None:
    from app.timetable_scheduler import process_timetable_notifications

    while True:
        try:
            await asyncio.to_thread(process_timetable_notifications)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Timetable notification tick failed")
        await asyncio.sleep(60)


async def _cancel_tick_task(task: asyncio.Task | None) -> None:
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


@asynccontextmanager
async def core_lifespan(app: FastAPI):
    settings = get_settings()
    backend = (settings.checkpoint_backend or "sqlite").strip().lower()
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

    tick_task: asyncio.Task | None = None
    try:
        if backend == "memory":
            app.state.checkpointer = MemorySaver()
            logger.warning(
                "LangGraph checkpoint_backend=memory (MemorySaver): threads are NOT persisted across API restarts.",
            )
            if settings.timetable_notifications_enabled:
                tick_task = asyncio.create_task(_timetable_tick_loop())
                logger.info("Timetable notification scheduler (60s tick): enabled")
            yield
            return

        db_path = Path(settings.checkpoint_sqlite_path).expanduser()
        db_path.parent.mkdir(parents=True, exist_ok=True)
        conn_str = str(db_path.resolve())
        async with AsyncSqliteSaver.from_conn_string(conn_str) as saver:
            app.state.checkpointer = saver
            logger.info("LangGraph thread memory (SQLite): %s", conn_str)
            if settings.timetable_notifications_enabled:
                tick_task = asyncio.create_task(_timetable_tick_loop())
                logger.info("Timetable notification scheduler (60s tick): enabled")
            yield
    finally:
        await _cancel_tick_task(tick_task)
