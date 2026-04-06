"""SQLite: per-learner bandit counts and last arm per thread."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from threading import Lock

_lock = Lock()


def _connect(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS adaptive_bandit_stats (
            owner_id TEXT NOT NULL,
            bucket TEXT NOT NULL,
            arm TEXT NOT NULL,
            successes INTEGER NOT NULL DEFAULT 0,
            failures INTEGER NOT NULL DEFAULT 0,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (owner_id, bucket, arm)
        );
        CREATE TABLE IF NOT EXISTS adaptive_thread_last_arm (
            thread_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            bucket TEXT NOT NULL,
            arm TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (thread_id, owner_id)
        );
        """
    )
    conn.commit()
    return conn


def get_bandit_row(path: Path, owner_id: str, bucket: str, arm: str) -> tuple[int, int]:
    with _lock:
        conn = _connect(path)
        try:
            r = conn.execute(
                "SELECT successes, failures FROM adaptive_bandit_stats WHERE owner_id=? AND bucket=? AND arm=?",
                (owner_id, bucket, arm),
            ).fetchone()
            if not r:
                return (0, 0)
            return int(r[0]), int(r[1])
        finally:
            conn.close()


def all_arms_stats(path: Path, owner_id: str, bucket: str, arms: list[str]) -> dict[str, tuple[int, int]]:
    out: dict[str, tuple[int, int]] = {a: (0, 0) for a in arms}
    with _lock:
        conn = _connect(path)
        try:
            rows = conn.execute(
                "SELECT arm, successes, failures FROM adaptive_bandit_stats WHERE owner_id=? AND bucket=?",
                (owner_id, bucket),
            ).fetchall()
            for arm, s, f in rows:
                if arm in out:
                    out[arm] = (int(s), int(f))
        finally:
            conn.close()
    return out


def record_observation(path: Path, owner_id: str, bucket: str, arm: str, *, success: bool) -> None:
    with _lock:
        conn = _connect(path)
        try:
            if success:
                conn.execute(
                    """INSERT INTO adaptive_bandit_stats(owner_id, bucket, arm, successes, failures, updated_at)
                       VALUES (?,?,?,1,0,datetime('now'))
                       ON CONFLICT(owner_id, bucket, arm) DO UPDATE SET
                         successes = successes + 1,
                         updated_at = datetime('now')""",
                    (owner_id, bucket, arm),
                )
            else:
                conn.execute(
                    """INSERT INTO adaptive_bandit_stats(owner_id, bucket, arm, successes, failures, updated_at)
                       VALUES (?,?,?,0,1,datetime('now'))
                       ON CONFLICT(owner_id, bucket, arm) DO UPDATE SET
                         failures = failures + 1,
                         updated_at = datetime('now')""",
                    (owner_id, bucket, arm),
                )
            conn.commit()
        finally:
            conn.close()


def set_thread_last_arm(path: Path, thread_id: str, owner_id: str, bucket: str, arm: str) -> None:
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                """INSERT INTO adaptive_thread_last_arm(thread_id, owner_id, bucket, arm, updated_at)
                   VALUES (?,?,?,?,datetime('now'))
                   ON CONFLICT(thread_id, owner_id) DO UPDATE SET
                     bucket = excluded.bucket,
                     arm = excluded.arm,
                     updated_at = datetime('now')""",
                (thread_id, owner_id, bucket, arm),
            )
            conn.commit()
        finally:
            conn.close()


def get_thread_last_arm(path: Path, thread_id: str, owner_id: str) -> tuple[str, str] | None:
    with _lock:
        conn = _connect(path)
        try:
            r = conn.execute(
                "SELECT bucket, arm FROM adaptive_thread_last_arm WHERE thread_id=? AND owner_id=?",
                (thread_id, owner_id),
            ).fetchone()
            if not r:
                return None
            return str(r[0]), str(r[1])
        finally:
            conn.close()


def clear_thread_last_arm(path: Path, thread_id: str, owner_id: str) -> None:
    with _lock:
        conn = _connect(path)
        try:
            conn.execute(
                "DELETE FROM adaptive_thread_last_arm WHERE thread_id=? AND owner_id=?",
                (thread_id, owner_id),
            )
            conn.commit()
        finally:
            conn.close()
