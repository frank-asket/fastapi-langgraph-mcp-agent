"""Shared helpers for LangChain message bodies and learner-visible display text."""

from __future__ import annotations

from typing import Any

from app.constants import ATTACH_MARK_END, PROFILE_MARK_END, TIMETABLE_MARK_END


def lc_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
            else:
                parts.append(str(block))
        return "".join(parts)
    return str(content)


def display_user_content(raw: str) -> str:
    if PROFILE_MARK_END in raw:
        raw = raw.split(PROFILE_MARK_END, 1)[1].strip()
    if TIMETABLE_MARK_END in raw:
        raw = raw.split(TIMETABLE_MARK_END, 1)[1].strip()
    if ATTACH_MARK_END in raw:
        raw = raw.split(ATTACH_MARK_END, 1)[1].strip()
    return raw
