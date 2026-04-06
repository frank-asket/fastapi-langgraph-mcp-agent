"""Thompson sampling over pedagogy arms; prefixes merged into the user message."""

from __future__ import annotations

import random
import re
from pathlib import Path
from typing import Literal

from app.adaptive_learning_store import (
    all_arms_stats,
    clear_thread_last_arm,
    get_thread_last_arm as store_get_last_arm,
    record_observation,
    set_thread_last_arm as store_set_last_arm,
)
from app.config import Settings
from app.schemas import LearnerProfile

PedagogyArm = Literal["hints", "scaffold", "worked_example", "metacognitive", "full"]

ARMS_FULL: tuple[PedagogyArm, ...] = ("hints", "scaffold", "worked_example", "metacognitive", "full")
ARMS_HINTS_MODE: tuple[PedagogyArm, ...] = ("hints", "scaffold", "metacognitive")

_PEDAGOGY_PREFIX: dict[PedagogyArm, str] = {
    "hints": (
        "[Adaptive pedagogy arm: **hints** — very short nudges and guiding questions only; "
        "no long worked solutions unless they explicitly ask.]\n\n"
    ),
    "scaffold": (
        "[Adaptive pedagogy arm: **scaffold** — break the problem into 2–4 numbered micro-steps; "
        "pause for understanding between steps.]\n\n"
    ),
    "worked_example": (
      "[Adaptive pedagogy arm: **worked_example** — start with one **parallel worked example**, "
      "then give the learner a similar question to try using the same method.]\n\n"
    ),
    "metacognitive": (
        "[Adaptive pedagogy arm: **metacognitive** — ask what they tried, where they got stuck, "
        "and what they think the goal is before teaching.]\n\n"
    ),
    "full": "",
}


def _slug(s: str | None) -> str:
    if not s:
        return "na"
    t = re.sub(r"[^\w\s-]", "", str(s).lower())[:48].strip()
    return t.replace(" ", "_") if t else "na"


def state_bucket(agent_lane: str, profile: LearnerProfile | None) -> str:
    lvl = (profile.education_level if profile else "unknown").strip().lower()
    subj = _slug(profile.subject_focus if profile else None)
    lane = (agent_lane or "general").strip().lower()
    return f"{lane}|{lvl}|{subj}"


def allowed_arms(coaching_mode: str | None) -> tuple[PedagogyArm, ...]:
    if (coaching_mode or "").lower() == "hints":
        return ARMS_HINTS_MODE
    return ARMS_FULL


def pedagogy_prefix(arm: PedagogyArm) -> str:
    return _PEDAGOGY_PREFIX.get(arm, "")


def select_arm_thompson(path: Path, owner_id: str, bucket: str, arms: tuple[PedagogyArm, ...]) -> PedagogyArm:
    """Thompson sampling with Beta(1+s, 1+f) per arm."""
    stats = all_arms_stats(path, owner_id, bucket, list(arms))
    samples: list[tuple[float, PedagogyArm]] = []
    for arm in arms:
        s, f = stats[arm]
        alpha, beta = 1.0 + s, 1.0 + f
        samples.append((random.betavariate(alpha, beta), arm))
    samples.sort(key=lambda x: -x[0])
    return samples[0][1]


def apply_learning_feedback(
    settings: Settings,
    owner_id: str,
    thread_id: str,
    *,
    helpful: bool,
) -> bool:
    """Update bandit for the last arm used in this thread. Returns False if no prior arm."""
    if not settings.adaptive_learning_enabled:
        return False
    path = Path(settings.adaptive_learning_db_path).expanduser().resolve()
    last = store_get_last_arm(path, thread_id, owner_id)
    if not last:
        return False
    bucket, arm = last
    record_observation(path, owner_id, bucket, arm, success=helpful)
    clear_thread_last_arm(path, thread_id, owner_id)
    return True


def prepare_pedagogy_for_turn(
    settings: Settings,
    *,
    owner_id: str,
    thread_id: str,
    agent_lane: str,
    profile: LearnerProfile | None,
    coaching_mode: str | None,
) -> tuple[str, PedagogyArm | None]:
    """Return (message_prefix, arm_or_none). No-op when feature disabled."""
    if not settings.adaptive_learning_enabled:
        return "", None
    path = Path(settings.adaptive_learning_db_path).expanduser().resolve()
    bucket = state_bucket(agent_lane, profile)
    arms = allowed_arms(coaching_mode)
    arm = select_arm_thompson(path, owner_id, bucket, arms)
    store_set_last_arm(path, thread_id, owner_id, bucket, arm)
    return pedagogy_prefix(arm), arm
