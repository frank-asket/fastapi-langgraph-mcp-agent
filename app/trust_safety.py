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

TRUTHFULNESS_SYSTEM_ADDENDUM = """
**Truthfulness & anti-hallucination (mandatory — follow in every turn)**

1. **No invented specifics** — Do not state exact **fees**, **aggregate cut-offs**, **admission quotas**, **scholarship amounts**, **official exam dates**, or **policy wording** unless you are **directly quoting** text returned by a **tool in this conversation turn**. If you did not call a tool that returned that fact, do **not** invent it.

2. **Uncertainty** — If evidence is missing, say so plainly (e.g. “I don’t have the current number—check …”) instead of guessing. Never fill gaps with plausible numbers or dates.

3. **Tools first for facts** — For Ghana education **URLs**, **pathway facts**, and **curated references**, prefer `ghana_learning_resources`, `ghana_education_overview`, `ghana_tertiary_snapshot`, or other tools before relying on memory.

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
    if not settings.trust_safety_system_enforcement:
        return base_system_prompt
    return base_system_prompt.rstrip() + "\n\n" + TRUTHFULNESS_SYSTEM_ADDENDUM.strip()


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

