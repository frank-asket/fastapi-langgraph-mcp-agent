"""AI-authored timetable nudges: what to learn, how, when, and rest — from saved slots + goals."""

from __future__ import annotations

import html
import logging
from typing import Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import Settings
logger = logging.getLogger(__name__)

_WD = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")


class TimetableNudgePlan(BaseModel):
    """Structured coach copy for a single notification."""

    notification_title: str = Field(
        max_length=120,
        description="Short title for the notification / email subject line.",
    )
    what_to_learn: str = Field(
        max_length=900,
        description="What to focus on learning or reviewing now (concrete, tied to their timetable).",
    )
    how_to_learn: str = Field(
        max_length=900,
        description="One or two specific study techniques (e.g. recall, worked example, flashcards).",
    )
    when_to_learn: str = Field(
        max_length=700,
        description="When to do this relative to today's classes and free blocks (use their times).",
    )
    rest_and_recovery: str = Field(
        max_length=700,
        description="Rest breaks, hydration, movement, or wind-down — appropriate to this moment.",
    )


def _build_llm(settings: Settings) -> ChatOpenAI:
    model_name = (settings.timetable_notify_ai_model or settings.openai_model or "gpt-4o-mini").strip()
    model_kw: dict[str, Any] = {
        "model": model_name,
        "api_key": settings.openai_api_key,
        "use_responses_api": False,
        "temperature": 0.35,
        "max_retries": 1,
    }
    if settings.openai_base_url and str(settings.openai_base_url).strip():
        model_kw["base_url"] = str(settings.openai_base_url).strip().rstrip("/")
    return ChatOpenAI(**model_kw)


def _slots_summary(slots: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for s in sorted(slots, key=lambda x: (int(x["weekday"]), str(x["start_time"]))):
        wd = _WD[int(s["weekday"])] if 0 <= int(s["weekday"]) <= 6 else "?"
        loc = s.get("location") or ""
        loc_bit = f" @ {loc}" if loc else ""
        lines.append(f"- {wd} {s['start_time']}–{s['end_time']}: {s['title']}{loc_bit}")
    return "\n".join(lines) if lines else "(no slots)"


def _today_lines(slots: list[dict[str, Any]], weekday: int) -> str:
    day_slots = [s for s in slots if int(s["weekday"]) == weekday]
    day_slots.sort(key=lambda x: str(x["start_time"]))
    if not day_slots:
        return "(no classes this weekday in timetable)"
    out = []
    for s in day_slots:
        loc = s.get("location") or ""
        loc_bit = f" — {loc}" if loc else ""
        out.append(f"- {s['start_time']}–{s['end_time']}: {s['title']}{loc_bit}")
    return "\n".join(out)


NotifyKind = Literal["prep", "rest", "focus"]


__all__ = ["NotifyKind", "generate_timetable_nudge", "TimetableNudgePlan"]


_SYSTEM = """You are a supportive study coach. You receive the learner's saved weekly timetable (recurring \
slots), optional personal goals, and the type of nudge we are sending right now.

Write practical, honest guidance. You MUST cover all four areas in the structured response:
1) what_to_learn — what to review, practise, or prepare (grounded in the courses on their timetable).
2) how_to_learn — specific learning moves (active recall, spacing, one worked example, etc.).
3) when_to_learn — when to fit this in today using their real class times and gaps (plain language).
4) rest_and_recovery — breaks, movement, hydration, eye rest, or longer recovery after sessions.

Rules:
- Use ONLY the timetable slots and goals text provided. Do not invent exam dates, grades, institutional rules, \
or sessions not on the timetable.
- Do not claim official WAEC/GES policies unless explicitly quoted from goals (usually they are not).
- Keep each field to a few short sentences. No markdown, no bullet characters in fields. Plain English.
- Tone: warm, realistic, Ghana-friendly when goals mention Ghana; otherwise neutral international school tone.
"""


def generate_timetable_nudge(
    settings: Settings,
    *,
    kind: NotifyKind,
    slots: list[dict[str, Any]],
    goals_summary: str | None,
    timezone_label: str,
    today_weekday: int,
    today_iso: str,
    slot_for_event: dict[str, Any] | None,
    study_prep_minutes: int,
    rest_after_minutes: int,
    focus_reminder_local: str | None,
) -> tuple[str, str, str] | None:
    """
    Return (email_subject, plain_text, html_inner_fragment) or None on failure / disabled / no API key.
    """
    if not settings.timetable_notify_ai_enabled:
        return None
    if not (settings.openai_api_key or "").strip():
        return None

    weekly = _slots_summary(slots)
    today_block = _today_lines(slots, today_weekday)
    goals = (goals_summary or "").strip() or "Not provided — infer generic study habits from course titles only."

    if kind == "prep" and slot_for_event:
        ev = (
            f"Upcoming class block: {slot_for_event['title']} "
            f"{slot_for_event['start_time']}–{slot_for_event['end_time']}"
        )
        loc = slot_for_event.get("location")
        if loc:
            ev += f" ({loc})"
        moment = (
            f"NOTIFICATION TYPE: PREP before class.\n"
            f"Learner timezone: {timezone_label}. Today (local): {today_iso}, weekday index {today_weekday} "
            f"(0=Monday).\n"
            f"Configured prep window: about {study_prep_minutes} minutes before start.\n"
            f"{ev}\n"
        )
    elif kind == "rest" and slot_for_event:
        ev = (
            f"Just finished: {slot_for_event['title']} "
            f"{slot_for_event['start_time']}–{slot_for_event['end_time']}"
        )
        moment = (
            f"NOTIFICATION TYPE: REST after class.\n"
            f"Learner timezone: {timezone_label}. Today: {today_iso}.\n"
            f"Suggest recovery that fits ~{rest_after_minutes} minutes before their next commitment if relevant.\n"
            f"{ev}\n"
        )
    else:
        focus_h = focus_reminder_local or "not set"
        moment = (
            f"NOTIFICATION TYPE: DAILY FOCUS (morning/intention).\n"
            f"Learner timezone: {timezone_label}. Today: {today_iso}.\n"
            f"Configured daily focus reminder local time hint: {focus_h}\n"
        )

    user = f"""{moment}
--- Weekly timetable (recurring) ---
{weekly}

--- Today's schedule (same weekday as now) ---
{today_block}

--- Learner goals / notes (may be empty) ---
{goals}
"""

    llm = _build_llm(settings)
    structured = llm.with_structured_output(TimetableNudgePlan)
    try:
        plan = structured.invoke(
            [
                SystemMessage(content=_SYSTEM),
                HumanMessage(content=user),
            ]
        )
    except Exception:
        logger.exception("Timetable notify AI invoke failed (kind=%s)", kind)
        return None

    if not isinstance(plan, TimetableNudgePlan):
        return None

    subj = plan.notification_title.strip()[:120]
    if not subj:
        return None

    plain = (
        f"{plan.what_to_learn.strip()}\n\n"
        f"How to learn: {plan.how_to_learn.strip()}\n\n"
        f"When: {plan.when_to_learn.strip()}\n\n"
        f"Rest & recovery: {plan.rest_and_recovery.strip()}"
    )

    inner = _render_ai_html(plan)
    return subj, plain, inner


def _render_ai_html(plan: TimetableNudgePlan) -> str:
    def p(label: str, body: str) -> str:
        b = html.escape(body.strip(), quote=False)
        return f"<p><strong>{html.escape(label)}</strong><br/>{b}</p>"

    h1 = html.escape(plan.notification_title.strip()[:120])
    parts = [
        '<div class="wrap"><div class="card">',
        f"<h1>{h1}</h1>",
        p("What to learn", plan.what_to_learn),
        p("How to learn", plan.how_to_learn),
        p("When to learn", plan.when_to_learn),
        p("Rest & recovery", plan.rest_and_recovery),
        '<p class="meta">— Your Study Coach (Klingbo), from your timetable</p>',
        "</div>",
        '<p class="footer">Suggestions based on your saved timetable; verify deadlines with your school.</p></div>',
    ]
    return "\n".join(parts)
