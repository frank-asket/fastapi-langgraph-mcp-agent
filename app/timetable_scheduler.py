"""Evaluate timetables each tick: study-prep before class, rest after class, optional daily focus."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.config import Settings, get_settings
from app.timetable_store import (
    get_prefs,
    insert_in_app,
    list_owner_ids_with_slots,
    list_slots,
    try_log_notification,
)
from app.timetable_messaging import focus_copy, prep_copy, rest_copy, send_sendgrid_email
from app.timetable_notify_ai import NotifyKind, generate_timetable_nudge

logger = logging.getLogger(__name__)

# Firing window: server ticks ~60s; allow this span after the ideal instant.
WINDOW = timedelta(minutes=16)
DAILY_FOCUS_SLOT_ID = "__daily_focus__"


def _deliver(
    settings: Settings,
    path: Path,
    owner_id: str,
    prefs: dict,
    *,
    subject: str,
    plain: str,
    html_inner: str,
    kind: str,
) -> None:
    to_email = (prefs.get("notification_email") or "").strip()
    sg_ok = bool((settings.sendgrid_api_key or "").strip()) and bool(to_email) and prefs.get("notify_email")

    if prefs.get("notify_in_app"):
        try:
            insert_in_app(path, owner_id, subject, plain, kind)
        except Exception:
            logger.exception("timetable in-app insert failed for %s", owner_id)

    if sg_ok:
        try:
            send_sendgrid_email(
                settings,
                to_email=to_email,
                subject=subject,
                plain=plain,
                html_inner=html_inner,
            )
        except Exception:
            logger.exception("SendGrid send failed for %s", owner_id)


def process_timetable_notifications() -> None:
    settings = get_settings()
    if not settings.timetable_notifications_enabled:
        return

    path = Path(settings.timetable_db_path).expanduser().resolve()
    owners = list_owner_ids_with_slots(path)
    if not owners:
        return

    for owner_id in owners:
        try:
            _process_owner(settings, path, owner_id)
        except Exception:
            logger.exception("timetable tick failed for owner %s", owner_id)


def _nudge_copy(
    settings: Settings,
    *,
    kind: NotifyKind,
    slots: list[dict[str, Any]],
    prefs: dict[str, Any],
    tz_label: str,
    weekday: int,
    local_date: str,
    slot_row: dict[str, Any] | None,
) -> tuple[str, str, str]:
    """Return (subject, plain, html_inner); prefers AI when enabled and configured."""
    gs = prefs.get("goals_summary")
    prep_m = int(prefs.get("study_prep_minutes") or 45)
    rest_m = int(prefs.get("rest_after_minutes") or 15)
    focus_h = prefs.get("focus_reminder_local")

    ai = generate_timetable_nudge(
        settings,
        kind=kind,
        slots=slots,
        goals_summary=gs,
        timezone_label=tz_label,
        today_weekday=weekday,
        today_iso=local_date,
        slot_for_event=slot_row,
        study_prep_minutes=prep_m,
        rest_after_minutes=rest_m,
        focus_reminder_local=focus_h,
    )
    if ai:
        return ai

    if kind == "prep" and slot_row:
        return prep_copy(
            str(slot_row["title"]),
            str(slot_row["start_time"]),
            str(slot_row["end_time"]),
            gs,
        )
    if kind == "rest" and slot_row:
        return rest_copy(str(slot_row["title"]), rest_m, gs)
    return focus_copy(gs)


def _process_owner(settings: Settings, path: Path, owner_id: str) -> None:
    prefs = get_prefs(path, owner_id)
    if not prefs.get("notify_email") and not prefs.get("notify_in_app"):
        return

    tz_name = (prefs.get("timezone") or "Africa/Accra").strip() or "Africa/Accra"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        logger.warning("Unknown timetable timezone %r — using Africa/Accra", tz_name)
        tz = ZoneInfo("Africa/Accra")

    now = datetime.now(tz)
    today = now.date()
    weekday = now.weekday()
    local_date = today.isoformat()

    slots = list_slots(path, owner_id)

    for s in slots:
        if int(s["weekday"]) != weekday:
            continue
        try:
            st = datetime.strptime(str(s["start_time"]), "%H:%M").time()
            en = datetime.strptime(str(s["end_time"]), "%H:%M").time()
        except ValueError:
            continue

        start_dt = datetime.combine(today, st, tzinfo=tz)
        end_dt = datetime.combine(today, en, tzinfo=tz)
        if end_dt <= start_dt:
            continue

        prep_lead = timedelta(minutes=int(prefs.get("study_prep_minutes") or 45))
        prep_at = start_dt - prep_lead
        if prep_at <= now < prep_at + WINDOW:
            if try_log_notification(path, owner_id, str(s["id"]), local_date, "prep"):
                subj, plain, html = _nudge_copy(
                    settings,
                    kind="prep",
                    slots=slots,
                    prefs=prefs,
                    tz_label=tz_name,
                    weekday=weekday,
                    local_date=local_date,
                    slot_row=s,
                )
                _deliver(
                    settings,
                    path,
                    owner_id,
                    prefs,
                    subject=subj,
                    plain=plain,
                    html_inner=html,
                    kind="prep",
                )

        rest_after = timedelta(minutes=int(prefs.get("rest_after_minutes") or 15))
        rest_at = end_dt + rest_after
        if rest_at <= now < rest_at + WINDOW:
            if try_log_notification(path, owner_id, str(s["id"]), local_date, "rest"):
                subj, plain, html = _nudge_copy(
                    settings,
                    kind="rest",
                    slots=slots,
                    prefs=prefs,
                    tz_label=tz_name,
                    weekday=weekday,
                    local_date=local_date,
                    slot_row=s,
                )
                _deliver(
                    settings,
                    path,
                    owner_id,
                    prefs,
                    subject=subj,
                    plain=plain,
                    html_inner=html,
                    kind="rest",
                )

    focus_hm = prefs.get("focus_reminder_local")
    if focus_hm:
        try:
            hp, mp = str(focus_hm).split(":")
            h, m = int(hp), int(mp)
        except ValueError:
            h, m = -1, -1
        if h >= 0:
            trigger = datetime.combine(today, datetime.min.time().replace(hour=h, minute=m), tzinfo=tz)
            if trigger <= now < trigger + WINDOW:
                if try_log_notification(path, owner_id, DAILY_FOCUS_SLOT_ID, local_date, "focus"):
                    subj, plain, html = _nudge_copy(
                        settings,
                        kind="focus",
                        slots=slots,
                        prefs=prefs,
                        tz_label=tz_name,
                        weekday=weekday,
                        local_date=local_date,
                        slot_row=None,
                    )
                    _deliver(
                        settings,
                        path,
                        owner_id,
                        prefs,
                        subject=subj,
                        plain=plain,
                        html_inner=html,
                        kind="focus",
                    )
