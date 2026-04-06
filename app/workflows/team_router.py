"""Multi-agent team graph: orchestrator routes to researcher / writer / reviewer / coach ReAct subgraphs."""

from __future__ import annotations

import logging
from typing import Annotated, Any, Literal

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from app.message_content import display_user_content, lc_content
from app.workflows.supervisor import safety_reply, scan_user_risk

logger = logging.getLogger(__name__)

CoachNode = Any


def _replace_user_risk_tags(_old: list[str], new: list[str]) -> list[str]:
    return list(new)


def _replace_team_route(_old: str, new: str) -> str:
    return new


class TeamSupervisorState(TypedDict):
    messages: Annotated[list[Any], add_messages]
    user_risk_tags: Annotated[list[str], _replace_user_risk_tags]
    team_route: Annotated[str, _replace_team_route]


class _TeamRouteDec(BaseModel):
    route: str = Field(description="Exactly one of: research, write, review, coach")


def _latest_human_display_text(state: TeamSupervisorState) -> str:
    for m in reversed(state.get("messages") or []):
        if isinstance(m, HumanMessage):
            return display_user_content(lc_content(m.content))
    return ""


def route_after_scan_team(
    state: TeamSupervisorState,
) -> Literal["safety_reply", "orchestrate"]:
    return "safety_reply" if (state.get("user_risk_tags") or []) else "orchestrate"


def route_after_orchestrator(
    state: TeamSupervisorState,
) -> Literal["researcher", "writer", "reviewer", "coach"]:
    r = (state.get("team_route") or "coach").strip().lower()
    if r in ("research", "researcher"):
        return "researcher"
    if r in ("write", "writer"):
        return "writer"
    if r in ("review", "reviewer"):
        return "reviewer"
    return "coach"


def build_orchestrator_runnable(model: ChatOpenAI):
    structured = model.with_structured_output(_TeamRouteDec)
    sys_txt = """You are the orchestrator for a learning coach. Read the learner's latest message and pick ONE specialist:
- research — facts, sources, literature review, "look up", structured notes, comparisons
- write — drafting essays, paragraphs, summaries, rewriting for clarity
- review — critique drafts, proofread, check reasoning, suggest improvements
- coach — default tutoring, homework help, problem solving, general Q&A

If unsure, choose coach."""

    def orchestrator(state: TeamSupervisorState) -> dict[str, str]:
        text = _latest_human_display_text(state)
        if not text.strip():
            return {"team_route": "coach"}
        try:
            out = structured.invoke(
                [SystemMessage(content=sys_txt), HumanMessage(content=text[:12_000])],
            )
            raw = (out.route or "coach").strip().lower()
            if raw in ("research", "researcher"):
                rnorm = "research"
            elif raw in ("write", "writer"):
                rnorm = "write"
            elif raw in ("review", "reviewer"):
                rnorm = "review"
            else:
                rnorm = "coach"
            return {"team_route": rnorm}
        except Exception:
            logger.exception("Team orchestrator structured output failed; falling back to coach")
            return {"team_route": "coach"}

    return orchestrator


RESEARCH_SUFFIX = (
    "\n\n[Team role: Research specialist — prioritize accurate structure, sources to consult, "
    "and concise factual outlines. Flag uncertainty clearly.]"
)
WRITE_SUFFIX = (
    "\n\n[Team role: Writer specialist — produce clear drafts and outlines; match the learner's level.]"
)
REVIEW_SUFFIX = (
    "\n\n[Team role: Reviewer specialist — critique reasoning, clarity, and completeness; suggest concrete edits.]"
)


def build_team_supervisor_graph(
    *,
    researcher: CoachNode,
    writer: CoachNode,
    reviewer: CoachNode,
    coach: CoachNode,
    orchestrator_model: ChatOpenAI,
) -> StateGraph:
    """Supervisor scan + orchestrator + four ReAct subgraphs (shared parent checkpoint)."""
    g = StateGraph(TeamSupervisorState)
    g.add_node("scan_user_risk", scan_user_risk)
    g.add_node("safety_reply", safety_reply)
    g.add_node("orchestrator", build_orchestrator_runnable(orchestrator_model))
    g.add_node("researcher", researcher)
    g.add_node("writer", writer)
    g.add_node("reviewer", reviewer)
    g.add_node("coach", coach)

    g.add_edge(START, "scan_user_risk")
    g.add_conditional_edges(
        "scan_user_risk",
        route_after_scan_team,
        {"safety_reply": "safety_reply", "orchestrate": "orchestrator"},
    )
    g.add_conditional_edges(
        "orchestrator",
        route_after_orchestrator,
        {
            "researcher": "researcher",
            "writer": "writer",
            "reviewer": "reviewer",
            "coach": "coach",
        },
    )
    g.add_edge("safety_reply", END)
    g.add_edge("researcher", END)
    g.add_edge("writer", END)
    g.add_edge("reviewer", END)
    g.add_edge("coach", END)
    return g
