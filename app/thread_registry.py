"""SQLite registry: optionally bind learning thread_id to a browser session id."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from threading import Lock

_lock = Lock()


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS thread_owner (
            thread_id TEXT PRIMARY KEY,
            owner_session_id TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )"""
    )
    conn.commit()
    return conn


def get_owner(path: Path, thread_id: str) -> str | None:
    with _lock:
        conn = _connect(path)
        try:
            row = conn.execute(
                "SELECT owner_session_id FROM thread_owner WHERE thread_id = ?",
                (thread_id,),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()


def register_owner(path: Path, thread_id: str, owner_session_id: str) -> None:
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                """INSERT OR IGNORE INTO thread_owner (thread_id, owner_session_id)
                   VALUES (?, ?)""",
                (thread_id, owner_session_id),
            )
            conn.commit()
        finally:
            conn.close()


def assert_access(
    path: Path,
    thread_id: str,
    owner_session_id: str,
    *,
    bind: bool,
) -> None:
    if not bind:
        return
    existing = get_owner(path, thread_id)
    if existing is None:
        return
    if existing != owner_session_id:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=403,
            detail="This learning ID belongs to another signed-in session. "
            "Use BIND_THREADS_TO_SESSION=false for shared-class devices, or resume on the same browser.",
        )
