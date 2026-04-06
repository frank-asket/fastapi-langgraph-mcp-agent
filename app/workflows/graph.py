"""LangGraph agent: MCP-backed tools and prompts, checkpointed memory."""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, ToolMessage
from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.base import BaseCheckpointSaver
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent

from app.agent_lanes import DEFAULT_AGENT_LANE, MCP_PROMPT_BY_LANE, VALID_AGENT_LANES
from app.config import Settings
from app.trust_safety import augment_system_prompt
from app.workflows.builtin_tools import build_builtin_tools
from app.workflows.supervisor import build_supervisor_graph
from app.workflows.team_router import (
    RESEARCH_SUFFIX,
    REVIEW_SUFFIX,
    WRITE_SUFFIX,
    build_team_supervisor_graph,
)

logger = logging.getLogger(__name__)

# Increment to drop cached compiled graphs when MCP tools/prompts or this module's wiring changes.
MCP_TOOLSET_VERSION = 10

_graphs: dict[str, CompiledStateGraph] = {}
_graph_cache_version: int | None = None
_graph_lock = asyncio.Lock()


def _mcp_prompt_to_system_string(
    prompt_msgs: list[HumanMessage | AIMessage],
) -> str:
    if not prompt_msgs:
        return "You are a helpful assistant."
    parts: list[str] = []
    for m in prompt_msgs:
        c = m.content
        parts.append(c if isinstance(c, str) else str(c))
    return "\n".join(parts)


def _flatten_tool_message_content(content: Any) -> str:
    """MCP adapters return ToolMessage content as content blocks (list of dicts). OpenAI chat completions expects a string."""
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                kind = block.get("type")
                if kind == "text":
                    parts.append(str(block.get("text", "")))
                elif kind == "image":
                    parts.append("[image tool output]")
                elif kind == "file":
                    parts.append("[file tool output]")
                else:
                    parts.append(str(block))
            else:
                parts.append(str(block))
        return "\n".join(parts) if parts else ""
    return str(content)


def _messages_from_state(state: Any) -> list[BaseMessage]:
    if isinstance(state, dict):
        return list(state.get("messages") or [])
    msgs = getattr(state, "messages", None)
    return list(msgs) if msgs is not None else []


def _openai_tool_messages_compat(messages: list[BaseMessage]) -> list[BaseMessage]:
    out: list[BaseMessage] = []
    for m in messages:
        if isinstance(m, ToolMessage):
            if isinstance(m.content, list) or m.content is None:
                flat = _flatten_tool_message_content(m.content)
                out.append(
                    ToolMessage(
                        content=flat,
                        tool_call_id=m.tool_call_id,
                        name=m.name,
                        id=m.id,
                    )
                )
            else:
                out.append(m)
        else:
            out.append(m)
    return out


def pre_model_openai_message_compat(state: Any) -> dict[str, Any]:
    """Normalize LLM inputs: tool results must be strings for Chat Completions."""
    msgs = _messages_from_state(state)
    return {"llm_input_messages": _openai_tool_messages_compat(msgs)}


def _normalize_lane(lane: str) -> str:
    key = (lane or "").strip().lower()
    if key in VALID_AGENT_LANES:
        return key
    return DEFAULT_AGENT_LANE


def _graph_cache_slot(lane: str, settings: Settings) -> str:
    if settings.workflow_supervisor_enabled and settings.workflow_team_router_enabled:
        return f"{lane}::team"
    if settings.workflow_supervisor_enabled:
        return f"{lane}::sup"
    return f"{lane}::react"


async def get_workflow_graph(
    settings: Settings,
    checkpointer: BaseCheckpointSaver,
    agent_lane: str = DEFAULT_AGENT_LANE,
) -> CompiledStateGraph:
    """Lazily build compiled graph per specialist lane (shared tools, different MCP system prompt)."""
    global _graphs, _graph_cache_version
    lane = _normalize_lane(agent_lane)
    slot = _graph_cache_slot(lane, settings)
    async with _graph_lock:
        if _graph_cache_version != MCP_TOOLSET_VERSION:
            _graphs = {}
            _graph_cache_version = MCP_TOOLSET_VERSION

        cached = _graphs.get(slot)
        if cached is not None:
            return cached

        if not settings.openai_api_key:
            msg = "OPENAI_API_KEY is not set"
            raise RuntimeError(msg)

        prompt_name = MCP_PROMPT_BY_LANE.get(lane, MCP_PROMPT_BY_LANE[DEFAULT_AGENT_LANE])

        client = MultiServerMCPClient(
            {
                "agent": {
                    "transport": "http",
                    "url": settings.resolved_mcp_http_url,
                    "timeout": timedelta(seconds=120),
                }
            }
        )
        mcp_tools = await client.get_tools()
        builtins = build_builtin_tools(settings) if settings.builtin_tools_enabled else []
        tools = list(builtins) + list(mcp_tools)
        prompt_msgs = await client.get_prompt("agent", prompt_name)
        system_prompt = augment_system_prompt(
            _mcp_prompt_to_system_string(prompt_msgs),
            settings,
        )

        model_kw: dict[str, Any] = {
            "model": settings.openai_model,
            "api_key": settings.openai_api_key,
            # Avoid Responses API path; use Chat Completions (stable for tool loops).
            "use_responses_api": False,
        }
        if settings.openai_base_url and str(settings.openai_base_url).strip():
            model_kw["base_url"] = str(settings.openai_base_url).strip().rstrip("/")
        model = ChatOpenAI(**model_kw)
        coach_subgraph = create_react_agent(
            model,
            tools,
            prompt=system_prompt,
            checkpointer=None,
            pre_model_hook=pre_model_openai_message_compat,
        )
        use_team = settings.workflow_supervisor_enabled and settings.workflow_team_router_enabled
        if use_team:
            researcher = create_react_agent(
                model,
                tools,
                prompt=system_prompt + RESEARCH_SUFFIX,
                checkpointer=None,
                pre_model_hook=pre_model_openai_message_compat,
            )
            writer = create_react_agent(
                model,
                tools,
                prompt=system_prompt + WRITE_SUFFIX,
                checkpointer=None,
                pre_model_hook=pre_model_openai_message_compat,
            )
            reviewer = create_react_agent(
                model,
                tools,
                prompt=system_prompt + REVIEW_SUFFIX,
                checkpointer=None,
                pre_model_hook=pre_model_openai_message_compat,
            )
            compiled = build_team_supervisor_graph(
                researcher=researcher,
                writer=writer,
                reviewer=reviewer,
                coach=coach_subgraph,
                orchestrator_model=model,
            ).compile(checkpointer=checkpointer)
            setattr(compiled, "stream_subgraphs", True)
            graph = compiled
            mode = "supervisor+team"
        elif settings.workflow_supervisor_enabled:
            compiled = build_supervisor_graph(coach_subgraph).compile(checkpointer=checkpointer)
            setattr(compiled, "stream_subgraphs", True)
            graph = compiled
            mode = "supervisor+react"
        else:
            graph = create_react_agent(
                model,
                tools,
                prompt=system_prompt,
                checkpointer=checkpointer,
                pre_model_hook=pre_model_openai_message_compat,
            )
            setattr(graph, "stream_subgraphs", False)
            mode = "react"
        _graphs[slot] = graph
        logger.info(
            "Compiled LangGraph %s lane=%s prompt=%s (%d tools: %d builtin + %d MCP, %s)",
            mode,
            lane,
            prompt_name,
            len(tools),
            len(builtins),
            len(mcp_tools),
            settings.resolved_mcp_http_url,
        )
        return graph


async def reset_workflow_graph_cache() -> None:
    """Clear cached graphs (e.g. for tests)."""
    global _graphs, _graph_cache_version
    async with _graph_lock:
        _graphs = {}
        _graph_cache_version = None
