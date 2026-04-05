"""Truthfulness guardrails: system-prompt enforcement and optional user-facing verification footer.

This does not run external fact-checkers; it tightens model instructions and surfaces a verification
reminder on API responses. Suspicious patterns are optionally logged for monitoring.
"""

from __future__ import annotations

import logging
import re
from app.config import Settings

logger = logging.getLogger(__name__)

# --- Injected after MCP coach prompt (model-facing) -------------------------------------------

TIMETABLE_COACH_SYSTEM_HINT = """
**Timetable-aware coaching** — Some user messages include a labelled block with the learner's **saved weekly class timetable**
(recurring slots from the app). Use it to personalize **study plans**, **revision spacing**, **exam preparation pacing**,
and **workload balance**. Treat any **“heuristic workload”** lines as simple counts and day summaries—not statistical predictions,
grade forecasts, or official calendars. Never invent exam dates or institution rules; remind learners to verify with their school.
"""

TRUTHFULNESS_SYSTEM_ADDENDUM = """
**Truthfulness & anti-hallucination (mandatory — follow in every turn)**

1. **No invented specifics** — Do not state exact **fees**, **aggregate cut-offs**, **admission quotas**, **scholarship amounts**, **official exam dates**, or **policy wording** unless you are **directly quoting** text returned by a **tool in this conversation turn**. If you did not call a tool that returned that fact, do **not** invent it.

2. **Uncertainty** — If evidence is missing, say so plainly (e.g. “I don’t have the current number—check …”) instead of guessing. Never fill gaps with plausible numbers or dates.

3. **Tools first for facts** — For Ghana education **URLs**, **pathway facts**, and **curated references**, prefer `ghana_learning_resources`, `ghana_education_overview`, `ghana_tertiary_snapshot`, or other tools before relying on memory. For **what is examinable** in a named subject at **JHS / SHS**, call **`curriculum_topic_lookup`** first and ground statements in its returned `topics` / `notes` (each row includes a `source_mcp_id` for citation).

4. **User documents** — If the learner attached a file, ground factual claims about that file in the extracted text; don’t assume content that wasn’t extracted.

5. **Separate guidance from rules** — Label **general study advice** vs **institution-specific requirements**; the latter always needs verification with the school or official site.

6. **Safety** — Do not present rumours, forwarded-message claims, or unverified “official” announcements as fact. Point to **.gov.gh**, **.edu.gh**, **WAEC**, **GES/NaCCA**, or **GTEC** for verification.
"""

# --- Appended to assistant text returned to clients (user-facing) -----------------------------

DEFAULT_VERIFICATION_FOOTER = (
    "\n\n---\n"
    "*Educational support only. Policies, fees, cut-offs, and dates change—confirm with your school, "
    "**WAEC**, **GTEC**, or your institution’s official website. AI answers can be wrong; verify important facts.*"
)


def augment_system_prompt(base_system_prompt: str, settings: Settings) -> str:
    parts: list[str] = [base_system_prompt.rstrip()]
    if settings.workflow_timetable_context_enabled:
        parts.append(TIMETABLE_COACH_SYSTEM_HINT.strip())
    if settings.trust_safety_system_enforcement:
        parts.append(TRUTHFULNESS_SYSTEM_ADDENDUM.strip())
    return "\n\n".join(p for p in parts if p)


def verification_footer(settings: Settings) -> str:
    if not settings.trust_safety_reply_footer:
        return ""
    custom = (settings.trust_safety_reply_footer_text or "").strip()
    return custom if custom else DEFAULT_VERIFICATION_FOOTER


def augment_assistant_reply(text: str, settings: Settings) -> str:
    """Append verification footer once (idempotent). Empty body still gets footer when enabled."""
    footer = verification_footer(settings)
    if not footer:
        return text
    base = str(text).rstrip()
    marker = footer.strip()[:56]
    if marker and marker in base:
        return base
    if not base:
        return footer
    return base + footer


# --- Lightweight risk signals (logging only) --------------------------------------------------

_NUMERIC_CUTOFF_PATTERNS = (
    re.compile(
        r"\b(?:cut[\s-]*off|cutoff|aggregate)\b.{0,40}\b\d{1,2}\b",
        re.IGNORECASE | re.DOTALL,
    ),
    re.compile(r"\bWASSCE\b.{0,30}\b\d{1,2}\b\s*(?:aggregate|agg\.?)\b", re.IGNORECASE),
    re.compile(r"\bGH[¢€]?\s?\d{2,}(?:,\d{3})*(?:\.\d+)?\b", re.IGNORECASE),
    re.compile(r"\b(?:fee|tuition)\s+(?:is|of|at)\s+(?:GH[¢€]?\s?)?\d", re.IGNORECASE),
)


def log_if_suspicious_reply(text: str, settings: Settings) -> None:
    """Log when reply looks like it may contain specific claims to audit (no blocking)."""
    if not settings.trust_safety_log_risk_signals:
        return
    if not text or len(text) < 40:
        return
    matched: list[str] = []
    for rx in _NUMERIC_CUTOFF_PATTERNS:
        if rx.search(text):
            matched.append(rx.pattern[:50])
    if matched:
        logger.info(
            "trust_safety risk_signal patterns=%s preview=%r",
            matched,
            text[:200].replace("\n", " "),
        )


# --- User-turn risk (supervisor / safety officer routes before main coach) --------------------

_USER_RISK_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    (
        "academic_fraud",
        re.compile(
            r"(?:buy|pay(?:ing)?|purchase|sell(?:ing)?).{0,48}(?:grade|wassce|bece|result|certificate|aggregate)|"
            r"(?:upgrade|change|fix).{0,24}(?:aggregate|grade|result|wassce)|"
            r"(?:fake|false).{0,20}certificate|"
            r"(?:exam|paper).{0,20}(?:leak|leaked)|"
            r"\bleaked\s+paper\b",
            re.IGNORECASE,
        ),
    ),
    (
        "momo_scam_vectors",
        re.compile(
            r"(?:share|send|tell|give).{0,60}\b(?:pin|otp|password)\b|"
            r"\b(?:momo|mobile\s*money)\b.{0,40}\b(?:pin|otp|password)\b|"
            r"\b(?:pin|otp|password)\b.{0,40}\b(?:momo|mtn|vodafone|telecel)\b|"
            r"(?:agent).{0,40}(?:pin|otp).{0,20}(?:whatsapp|telegram)",
            re.IGNORECASE,
        ),
    ),
)


def user_message_risk_tags(text: str) -> list[str]:
    """Return stable risk tags for the latest user message (empty if no match)."""
    if not text or not str(text).strip():
        return []
    s = str(text).strip()
    found: list[str] = []
    seen: set[str] = set()
    for tag, rx in _USER_RISK_PATTERNS:
        if tag in seen:
            continue
        if rx.search(s):
            found.append(tag)
            seen.add(tag)
    return found


def compose_user_safety_reply(tags: list[str]) -> str:
    """Deterministic coach reply when the safety gate fires (no main agent loop)."""
    parts: list[str] = [
        "**I can’t help with anything that could break exam rules or put your money at risk.** "
        "Academic results must reflect **your own work**; certificates and aggregates must come through **official channels** "
        "(school, **WAEC**, **GES**, your institution)—not informal payments or “upgrades”.",
    ]
    if "momo_scam_vectors" in tags or "academic_fraud" in tags:
        parts.append(
            "**Mobile money:** never share your **MoMo PIN** or **OTP** with anyone who contacts you online, "
            "even if they claim to be an agent or teacher. Real problems are solved through **official short codes**, "
            "the **network app**, or in person at a trusted outlet—with a **trusted adult** if you are under 18."
        )
    if "academic_fraud" in tags:
        parts.append(
            "**Exams & certificates:** “Leaked papers” and paid “grade fixes” are usually **fraud** and can carry "
            "serious consequences. If you are stressed about results, talk to a **teacher, parent, or counsellor** about "
            "**remediation, resits, or TVET/alternative pathways**—all through legitimate processes."
        )
    parts.append(
        "If you meant something else, rephrase your **study question** (subject, level, and what you’re stuck on) "
        "and I’ll help you learn the content step by step."
    )
    return "\n\n".join(parts)

