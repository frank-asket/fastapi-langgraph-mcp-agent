"""Format the learner's saved timetable for injection into /workflow coach turns."""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from app.config import Settings
from app.timetable_store import get_prefs, list_slots

_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_MAX_SLOT_LINES = 55


def timetable_context_for_owner(settings: Settings, owner_id: str | None) -> str | None:
    """Return a plain-text block for the model, or None if disabled / no owner / empty timetable."""
    if not owner_id or not settings.workflow_timetable_context_enabled:
        return None
    path = Path(settings.timetable_db_path).expanduser().resolve()
    prefs = get_prefs(path, owner_id)
    slots = list_slots(path, owner_id)
    if not slots:
        return None
    return _format_block(prefs, slots)


def _format_block(prefs: dict, slots: list[dict]) -> str:
    lines: list[str] = [
        "[Learner's saved weekly timetable — recurring class blocks from their Study Coach app. "
        "Use this for realistic study plans, revision spacing, exam prep pacing, and workload balance. "
        "This is not an official exam timetable and does not include WAEC/GTEC exam dates; "
        "tell the learner to confirm deadlines with their school.]",
        f"- Notification timezone (for in-app nudges): {prefs.get('timezone') or 'Africa/Accra'}",
    ]
    gs = (prefs.get("goals_summary") or "").strip()
    if gs:
        lines.append(f"- Goals summary (from app): {gs}")

    by_day: dict[int, list[dict]] = {i: [] for i in range(7)}
    for s in slots:
        try:
            wd = int(s.get("weekday", -1))
        except (TypeError, ValueError):
            continue
        if 0 <= wd <= 6:
            by_day[wd].append(s)
    for d in by_day:
        by_day[d].sort(key=lambda x: (str(x.get("start_time") or ""), str(x.get("title") or "")))

    rendered = 0
    for wd in range(7):
        day_slots = by_day[wd]
        if not day_slots:
            continue
        lines.append(f"- {_WEEKDAYS[wd]}:")
        for s in day_slots:
            if rendered >= _MAX_SLOT_LINES:
                rest = len(slots) - rendered
                if rest > 0:
                    lines.append(
                        f"  - … and {rest} more slot(s); learner can view/edit all in Studio → Timetable.",
                    )
                lines.extend(_heuristic_tail(slots))
                return "\n".join(lines)
            st = str(s.get("start_time") or "")
            en = str(s.get("end_time") or "")
            title = str(s.get("title") or "Session").strip()
            loc = (s.get("location") or "").strip()
            loc_bit = f" @ {loc}" if loc else ""
            lines.append(f"  - {st}–{en} {title}{loc_bit}")
            rendered += 1

    lines.extend(_heuristic_tail(slots))
    return "\n".join(lines)


def _heuristic_tail(slots: list[dict]) -> list[str]:
    n = len(slots)
    counts: Counter[int] = Counter()
    for s in slots:
        try:
            wd = int(s.get("weekday", -1))
        except (TypeError, ValueError):
            continue
        if 0 <= wd <= 6:
            counts[wd] += 1
    busiest = [f"{_WEEKDAYS[d]} ({counts[d]} sessions)" for d, _ in counts.most_common(4) if counts[d] > 0]
    out = [
        f"- Heuristic workload: {n} recurring session(s)/week.",
    ]
    if busiest:
        out.append(f"- Busiest days (by class count): {', '.join(busiest)}.")
    out.append(
        "- Coaching note: use this snapshot to suggest prep/rest around listed times and spaced review; "
        "do not claim grade predictions or official exam schedules not supplied by the user.",
    )
    return out
