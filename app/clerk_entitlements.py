"""SQLite store for Clerk webhook-driven subscription fields (optional)."""

from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any

logger = logging.getLogger(__name__)

_lock = Lock()


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS clerk_entitlements (
            clerk_user_id TEXT PRIMARY KEY,
            subscription_status TEXT,
            subscription_plan TEXT,
            payload_json TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"""
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS clerk_welcome_email_sent (
            clerk_user_id TEXT PRIMARY KEY,
            sent_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"""
    )
    conn.commit()
    return conn


def try_claim_welcome_email_send(path: Path, clerk_user_id: str) -> bool:
    """Reserve a send slot; return True if this worker should send (first time)."""
    with _lock:
        conn = _connect(path)
        try:
            cur = conn.execute(
                "INSERT OR IGNORE INTO clerk_welcome_email_sent (clerk_user_id) VALUES (?)",
                (clerk_user_id,),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def release_welcome_email_claim(path: Path, clerk_user_id: str) -> None:
    """Remove claim so a retried webhook can resend after a delivery failure."""
    with _lock:
        conn = _connect(path)
        try:
            conn.execute("DELETE FROM clerk_welcome_email_sent WHERE clerk_user_id = ?", (clerk_user_id,))
            conn.commit()
        finally:
            conn.close()


def get_entitlement(path: Path, clerk_user_id: str) -> dict[str, Any] | None:
    with _lock:
        conn = _connect(path)
        try:
            row = conn.execute(
                """SELECT subscription_status, subscription_plan, payload_json, updated_at
                   FROM clerk_entitlements WHERE clerk_user_id = ?""",
                (clerk_user_id,),
            ).fetchone()
            if not row:
                return None
            return {
                "clerk_user_id": clerk_user_id,
                "subscription_status": row[0],
                "subscription_plan": row[1],
                "payload_json": row[2],
                "updated_at": row[3],
            }
        finally:
            conn.close()


def upsert_entitlement(
    path: Path,
    clerk_user_id: str,
    *,
    subscription_status: str | None,
    subscription_plan: str | None,
    payload: dict[str, Any] | None,
) -> None:
    payload_json = json.dumps(payload) if payload is not None else None
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                """INSERT INTO clerk_entitlements
                   (clerk_user_id, subscription_status, subscription_plan, payload_json, updated_at)
                   VALUES (?, ?, ?, ?, datetime('now'))
                   ON CONFLICT(clerk_user_id) DO UPDATE SET
                     subscription_status = excluded.subscription_status,
                     subscription_plan = excluded.subscription_plan,
                     payload_json = excluded.payload_json,
                     updated_at = datetime('now')""",
                (clerk_user_id, subscription_status, subscription_plan, payload_json),
            )
            conn.commit()
        finally:
            conn.close()


def apply_clerk_event(payload: dict[str, Any]) -> None:
    """Update local entitlements from a verified Clerk webhook JSON body."""
    from app.config import get_settings

    settings = get_settings()
    path = Path(settings.clerk_entitlements_db_path).expanduser().resolve()
    evt = payload.get("type")
    data = payload.get("data")
    if not isinstance(data, dict):
        return

    if evt in ("user.created", "user.updated"):
        uid = data.get("id")
        if not uid:
            return
        meta = data.get("public_metadata") if isinstance(data.get("public_metadata"), dict) else {}
        status = meta.get("subscription_status")
        if status is None:
            status = meta.get("subscriptionStatus")
        plan = meta.get("plan") or meta.get("subscription_plan")
        upsert_entitlement(
            path,
            str(uid),
            subscription_status=str(status) if status is not None else None,
            subscription_plan=str(plan) if plan is not None else None,
            payload=data,
        )

    if evt == "user.created":
        try:
            from app.clerk_welcome import send_welcome_email_for_clerk_user

            send_welcome_email_for_clerk_user(settings, data)
        except Exception:
            logger.exception("Clerk user.created welcome email path failed")
