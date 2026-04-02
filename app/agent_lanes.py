"""Multi-agent lanes: specialist system prompts (MCP) keyed by coarse education band."""

from __future__ import annotations

# Values accepted in API / UI (excluding "auto").
VALID_AGENT_LANES: frozenset[str] = frozenset(
    {"general", "jhs", "shs", "tertiary", "educator"}
)
DEFAULT_AGENT_LANE = "general"

# MCP @mcp.prompt function names (must match server.py).
MCP_PROMPT_BY_LANE: dict[str, str] = {
    "general": "common_prompt",
    "jhs": "jhs_coach_prompt",
    "shs": "shs_coach_prompt",
    "tertiary": "tertiary_coach_prompt",
    "educator": "educator_coach_prompt",
}


def education_level_to_lane(level: str | None) -> str:
    """Map assessment `education_level` to an agent lane."""
    if not level:
        return DEFAULT_AGENT_LANE
    key = str(level).strip().lower()
    if key in ("primary_jhs", "jhs", "primary", "basic"):
        return "jhs"
    if key in ("shs", "senior_high", "secondary"):
        return "shs"
    if key in ("tertiary", "university", "college"):
        return "tertiary"
    if key in ("educator_parent", "educator", "teacher", "parent"):
        return "educator"
    return DEFAULT_AGENT_LANE


def resolve_agent_lane(
    agent_lane: str | None,
    learner_profile: object | None,
) -> str:
    """
    Pick specialist lane: explicit `agent_lane` wins unless "auto" / empty.
    Else infer from `learner_profile.education_level`. Else general coach.
    """
    if agent_lane is not None:
        raw = str(agent_lane).strip().lower()
        if raw and raw != "auto":
            if raw in VALID_AGENT_LANES:
                return raw
            # Unknown label — fall through like auto (profile / default).
    if learner_profile is not None:
        level = getattr(learner_profile, "education_level", None)
        return education_level_to_lane(str(level) if level is not None else None)
    return DEFAULT_AGENT_LANE
