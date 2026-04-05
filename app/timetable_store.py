"""SQLite store for class timetables, notification prefs, in-app feed, and send deduplication."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from threading import Lock
from typing import Any
from uuid import uuid4

_lock = Lock()


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS timetable_prefs (
            owner_id TEXT PRIMARY KEY,
            timezone TEXT NOT NULL DEFAULT 'Africa/Accra',
            notify_email INTEGER NOT NULL DEFAULT 1,
            notify_in_app INTEGER NOT NULL DEFAULT 1,
            study_prep_minutes INTEGER NOT NULL DEFAULT 45,
            rest_after_minutes INTEGER NOT NULL DEFAULT 15,
            focus_reminder_local TEXT,
            goals_summary TEXT,
            notification_email TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS timetable_slots (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            weekday INTEGER NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            title TEXT NOT NULL,
            location TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_timetable_slots_owner ON timetable_slots(owner_id);
        CREATE TABLE IF NOT EXISTS timetable_notify_log (
            owner_id TEXT NOT NULL,
            slot_id TEXT NOT NULL,
            notify_date TEXT NOT NULL,
            kind TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (owner_id, slot_id, notify_date, kind)
        );
        CREATE TABLE IF NOT EXISTS timetable_in_app (
            id TEXT PRIMARY KEY,
            owner_id TEXT NOT NULL,
            title TEXT NOT NULL,
            body TEXT NOT NULL,
            kind TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            read_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_timetable_inapp_owner ON timetable_in_app(owner_id, read_at);
        """
    )
    conn.commit()
    _migrate_timetable_prefs(conn)
    return conn


def _migrate_timetable_prefs(conn: sqlite3.Connection) -> None:
    cols = {str(row[1]) for row in conn.execute("PRAGMA table_info(timetable_prefs)").fetchall()}
    if "include_timetable_in_coach" not in cols:
        conn.execute(
            "ALTER TABLE timetable_prefs ADD COLUMN include_timetable_in_coach INTEGER NOT NULL DEFAULT 1",
        )
        conn.commit()


def _row_prefs(r: sqlite3.Row | None) -> dict[str, Any]:
    if not r:
        return {
            "timezone": "Africa/Accra",
            "notify_email": True,
            "notify_in_app": True,
            "study_prep_minutes": 45,
            "rest_after_minutes": 15,
            "focus_reminder_local": None,
            "goals_summary": None,
            "notification_email": None,
            "include_timetable_in_coach": True,
        }
    return {
        "timezone": r["timezone"],
        "notify_email": bool(r["notify_email"]),
        "notify_in_app": bool(r["notify_in_app"]),
        "study_prep_minutes": int(r["study_prep_minutes"]),
        "rest_after_minutes": int(r["rest_after_minutes"]),
        "focus_reminder_local": r["focus_reminder_local"],
        "goals_summary": r["goals_summary"],
        "notification_email": r["notification_email"],
        "include_timetable_in_coach": bool(r["include_timetable_in_coach"]),
    }


def get_prefs(path: Path, owner_id: str) -> dict[str, Any]:
    with _lock:
        conn = _connect(path)
        try:
            r = conn.execute("SELECT * FROM timetable_prefs WHERE owner_id = ?", (owner_id,)).fetchone()
            return _row_prefs(r)
        finally:
            conn.close()


def upsert_prefs(path: Path, owner_id: str, data: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                """INSERT INTO timetable_prefs (
                       owner_id, timezone, notify_email, notify_in_app,
                       study_prep_minutes, rest_after_minutes, focus_reminder_local,
                       goals_summary, notification_email, include_timetable_in_coach, updated_at
                   ) VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
                   ON CONFLICT(owner_id) DO UPDATE SET
                     timezone = excluded.timezone,
                     notify_email = excluded.notify_email,
                     notify_in_app = excluded.notify_in_app,
                     study_prep_minutes = excluded.study_prep_minutes,
                     rest_after_minutes = excluded.rest_after_minutes,
                     focus_reminder_local = excluded.focus_reminder_local,
                     goals_summary = excluded.goals_summary,
                     notification_email = excluded.notification_email,
                     include_timetable_in_coach = excluded.include_timetable_in_coach,
                     updated_at = datetime('now')""",
                (
                    owner_id,
                    data["timezone"],
                    1 if data["notify_email"] else 0,
                    1 if data["notify_in_app"] else 0,
                    data["study_prep_minutes"],
                    data["rest_after_minutes"],
                    data.get("focus_reminder_local"),
                    data.get("goals_summary"),
                    data.get("notification_email"),
                    1 if data.get("include_timetable_in_coach", True) else 0,
                ),
            )
            conn.commit()
            r = conn.execute("SELECT * FROM timetable_prefs WHERE owner_id = ?", (owner_id,)).fetchone()
            return _row_prefs(r)
        finally:
            conn.close()


def list_slots(path: Path, owner_id: str) -> list[dict[str, Any]]:
    with _lock:
        conn = _connect(path)
        try:
            rows = conn.execute(
                """SELECT id, weekday, start_time, end_time, title, location
                   FROM timetable_slots WHERE owner_id = ? ORDER BY weekday, start_time""",
                (owner_id,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def insert_slot(
    path: Path,
    owner_id: str,
    *,
    weekday: int,
    start_time: str,
    end_time: str,
    title: str,
    location: str | None,
) -> dict[str, Any]:
    sid = str(uuid4())
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                """INSERT INTO timetable_slots (id, owner_id, weekday, start_time, end_time, title, location)
                   VALUES (?,?,?,?,?,?,?)""",
                (sid, owner_id, weekday, start_time, end_time, title, location),
            )
            conn.commit()
            r = conn.execute(
                "SELECT id, weekday, start_time, end_time, title, location FROM timetable_slots WHERE id = ?",
                (sid,),
            ).fetchone()
            return dict(r) if r else {}
        finally:
            conn.close()


def update_slot(
    path: Path,
    owner_id: str,
    slot_id: str,
    *,
    weekday: int,
    start_time: str,
    end_time: str,
    title: str,
    location: str | None,
) -> dict[str, Any] | None:
    with _lock:
        conn = _connect(path)
        try:
            cur = conn.execute(
                """UPDATE timetable_slots SET weekday=?, start_time=?, end_time=?, title=?, location=?,
                       updated_at=datetime('now')
                   WHERE id=? AND owner_id=?""",
                (weekday, start_time, end_time, title, location, slot_id, owner_id),
            )
            conn.commit()
            if cur.rowcount == 0:
                return None
            r = conn.execute(
                "SELECT id, weekday, start_time, end_time, title, location FROM timetable_slots WHERE id = ?",
                (slot_id,),
            ).fetchone()
            return dict(r) if r else None
        finally:
            conn.close()


def delete_slot(path: Path, owner_id: str, slot_id: str) -> bool:
    with _lock:
        conn = _connect(path)
        try:
            cur = conn.execute("DELETE FROM timetable_slots WHERE id=? AND owner_id=?", (slot_id, owner_id))
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def try_log_notification(path: Path, owner_id: str, slot_id: str, notify_date: str, kind: str) -> bool:
    """Return True if newly inserted (should send)."""
    with _lock:
        conn = _connect(path)
        try:
            try:
                conn.execute(
                    "INSERT INTO timetable_notify_log (owner_id, slot_id, notify_date, kind) VALUES (?,?,?,?)",
                    (owner_id, slot_id, notify_date, kind),
                )
                conn.commit()
                return True
            except sqlite3.IntegrityError:
                return False
        finally:
            conn.close()


def insert_in_app(path: Path, owner_id: str, title: str, body: str, kind: str) -> str:
    nid = str(uuid4())
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                """INSERT INTO timetable_in_app (id, owner_id, title, body, kind) VALUES (?,?,?,?,?)""",
                (nid, owner_id, title, body, kind),
            )
            conn.commit()
            return nid
        finally:
            conn.close()


def list_in_app(path: Path, owner_id: str, *, limit: int = 50, unread_only: bool = False) -> list[dict[str, Any]]:
    with _lock:
        conn = _connect(path)
        try:
            q = """SELECT id, title, body, kind, created_at, read_at FROM timetable_in_app
                   WHERE owner_id = ?"""
            args: list[Any] = [owner_id]
            if unread_only:
                q += " AND read_at IS NULL"
            q += " ORDER BY datetime(created_at) DESC LIMIT ?"
            args.append(limit)
            rows = conn.execute(q, args).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()


def mark_read(path: Path, owner_id: str, notification_id: str) -> bool:
    with _lock:
        conn = _connect(path)
        try:
            cur = conn.execute(
                """UPDATE timetable_in_app SET read_at = datetime('now')
                   WHERE id=? AND owner_id=? AND read_at IS NULL""",
                (notification_id, owner_id),
            )
            conn.commit()
            return cur.rowcount > 0
        finally:
            conn.close()


def mark_all_read(path: Path, owner_id: str) -> int:
    with _lock:
        conn = _connect(path)
        try:
            cur = conn.execute(
                """UPDATE timetable_in_app SET read_at = datetime('now')
                   WHERE owner_id=? AND read_at IS NULL""",
                (owner_id,),
            )
            conn.commit()
            return cur.rowcount
        finally:
            conn.close()


def list_owner_ids_with_slots(path: Path) -> list[str]:
    with _lock:
        conn = _connect(path)
        try:
            rows = conn.execute("SELECT DISTINCT owner_id FROM timetable_slots").fetchall()
            return [str(r[0]) for r in rows]
        finally:
            conn.close()
