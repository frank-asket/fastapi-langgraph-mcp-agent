"""Supervisor graph: scan user turns for risk signals, then route to safety reply or MCP ReAct coach."""

from __future__ import annotations

from typing import Annotated, Any, Literal

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict

from app.message_content import display_user_content, lc_content
from app.trust_safety import compose_user_safety_reply, user_message_risk_tags

CoachNode = Any  # compiled react subgraph


def _replace_user_risk_tags(_old: list[str], new: list[str]) -> list[str]:
    return list(new)


class SupervisorState(TypedDict):
    messages: Annotated[list[Any], add_messages]
    #: Recomputed each turn by scan_user_risk (replaced, not accumulated).
    user_risk_tags: Annotated[list[str], _replace_user_risk_tags]


def _latest_human_display_text(state: SupervisorState) -> str:
    for m in reversed(state.get("messages") or []):
        if isinstance(m, HumanMessage):
            return display_user_content(lc_content(m.content))
    return ""


def scan_user_risk(state: SupervisorState) -> dict[str, list[str]]:
    text = _latest_human_display_text(state)
    return {"user_risk_tags": user_message_risk_tags(text)}


def route_after_scan(
    state: SupervisorState,
) -> Literal["safety_reply", "coach"]:
    return "safety_reply" if (state.get("user_risk_tags") or []) else "coach"


def safety_reply(state: SupervisorState) -> dict[str, list[AIMessage]]:
    body = compose_user_safety_reply(state.get("user_risk_tags") or [])
    return {"messages": [AIMessage(content=body)]}


def build_supervisor_graph(coach_subgraph: CoachNode) -> StateGraph:
    """Wrap the MCP-backed ReAct graph: shared parent state + coach as a subgraph node."""
    g = StateGraph(SupervisorState)
    g.add_node("scan_user_risk", scan_user_risk)
    g.add_node("safety_reply", safety_reply)
    g.add_node("coach", coach_subgraph)
    g.add_edge(START, "scan_user_risk")
    g.add_conditional_edges(
        "scan_user_risk",
        route_after_scan,
        {"safety_reply": "safety_reply", "coach": "coach"},
    )
    g.add_edge("safety_reply", END)
    g.add_edge("coach", END)
    return g
