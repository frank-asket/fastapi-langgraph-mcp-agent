"""LangGraph workflow execution, history, and streaming."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, AsyncIterator
from uuid import uuid4

from fastapi import HTTPException, Request, UploadFile
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from sse_starlette.sse import EventSourceResponse

from app.agent_lanes import DEFAULT_AGENT_LANE, resolve_agent_lane
from app.clerk_auth import ensure_clerk_subscription
from app.config import Settings, get_settings
from app.constants import ATTACH_MARK_END, PROFILE_MARK_END, TIMETABLE_MARK_END
from app.access import ensure_session_learner_id, verify_app_access
from app.adaptive_learning import apply_learning_feedback, prepare_pedagogy_for_turn
from app.document_extract import (
    ALLOWED_DOCUMENT_SUFFIXES,
    extract_document_text,
    normalize_upload_filename,
)
from app.schemas import HistoryMessage, HistoryResponse, LearnerProfile, WorkflowRequest, WorkflowResponse
from app.message_content import display_user_content, lc_content

from app.thread_registry import assert_access, register_owner
from app.timetable_context import timetable_context_for_owner
from app.trust_safety import augment_assistant_reply, log_if_suspicious_reply
from app.workflows.graph import get_workflow_graph

logger = logging.getLogger(__name__)


def learner_id_for_adaptive(request: Request, settings: Settings, owner_sid: str | None) -> str:
    if owner_sid:
        return owner_sid
    return ensure_session_learner_id(request)


def _unpack_stream_message_item(item: Any) -> Any:
    if isinstance(item, tuple) and len(item) == 3:
        return item[1]
    if isinstance(item, tuple) and len(item) == 2:
        return item[0]
    return item


def format_profile_block(p: LearnerProfile) -> str:
    lines = [
        "[Learner profile — personalize for Ghana GES/SHS/tertiary context; do not quiz them on this block unless helpful.]",
        f"- Education level: {p.education_level}",
    ]
    if p.shs_track and p.shs_track != "na":
        lines.append(f"- SHS / programme orientation: {p.shs_track}")
    if p.tertiary_institution and str(p.tertiary_institution).strip():
        lines.append(f"- Institution: {p.tertiary_institution.strip()}")
    if p.tertiary_programme and str(p.tertiary_programme).strip():
        lines.append(f"- Accredited programme: {p.tertiary_programme.strip()}")
    if p.subject_focus:
        lines.append(f"- Subject / focus: {p.subject_focus}")
    if p.region:
        lines.append(f"- Region: {p.region}")
    if p.goals:
        lines.append(f"- Goals: {p.goals.strip()}")
    return "\n".join(lines)


def coaching_prefix(mode: str | None) -> str:
    if (mode or "").lower() == "hints":
        return (
            "[Coaching mode: hints — give short hints, guiding questions, and next steps first. "
            "Provide a full worked solution only if the learner clearly asks for it or after they try once.]\n\n"
        )
    return ""


async def thread_has_messages(graph: Any, thread_id: str) -> bool:
    snap = await graph.aget_state({"configurable": {"thread_id": thread_id}})
    if not snap or not snap.values:
        return False
    msgs = snap.values.get("messages") or []
    return len(msgs) > 0


def registry_path() -> Path:
    return Path(get_settings().thread_registry_db_path).expanduser().resolve()


def enforce_thread_policy(settings: Settings, thread_id: str, owner_sid: str | None) -> None:
    if not settings.auth_enabled or not owner_sid or not settings.bind_threads_to_session:
        return
    assert_access(registry_path(), thread_id, owner_sid, bind=True)


def register_thread(settings: Settings, thread_id: str, owner_sid: str | None) -> None:
    if not settings.auth_enabled or not owner_sid or not settings.bind_threads_to_session:
        return
    register_owner(registry_path(), thread_id, owner_sid)


def format_attachment_block(filename: str, extracted_text: str) -> str:
    safe_name = normalize_upload_filename(filename)
    return (
        "[Attached document: "
        f"{safe_name} — text extracted on server; scanned PDFs may have no text layer.]\n"
        f"{extracted_text}\n"
        f"{ATTACH_MARK_END}\n"
    )


async def build_human_message(
    graph: Any,
    body: WorkflowRequest,
    thread_id: str,
    *,
    attachment_block: str | None = None,
    timetable_block: str | None = None,
    pedagogy_block: str | None = None,
) -> HumanMessage:
    human_text = body.message
    prefix_parts: list[str] = []
    if body.learner_profile and not await thread_has_messages(graph, thread_id):
        prefix_parts.append(format_profile_block(body.learner_profile) + f"\n{PROFILE_MARK_END}")
    if timetable_block:
        prefix_parts.append(timetable_block.rstrip() + f"\n{TIMETABLE_MARK_END}")
    if attachment_block:
        prefix_parts.append(attachment_block.rstrip())
    if prefix_parts:
        human_text = "\n".join(prefix_parts) + "\n" + human_text
    coach_prefix = coaching_prefix(body.coaching_mode)
    if pedagogy_block:
        coach_prefix += pedagogy_block
    human_text = coach_prefix + human_text
    return HumanMessage(content=human_text)


async def read_upload_bytes(upload: UploadFile, max_bytes: int) -> tuple[str, bytes]:
    filename = normalize_upload_filename(upload.filename)
    out = bytearray()
    while True:
        chunk = await upload.read(64 * 1024)
        if not chunk:
            break
        if len(out) + len(chunk) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File too large (max {max_bytes // (1024 * 1024)} MB).",
            )
        out.extend(chunk)
    return filename, bytes(out)


async def execute_workflow(
    request: Request,
    body: WorkflowRequest,
    *,
    attachment_block: str | None = None,
) -> WorkflowResponse:
    settings = get_settings()
    owner_sid = verify_app_access(request, settings)
    ensure_clerk_subscription(request, settings, owner_sid)

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    saver = getattr(request.app.state, "checkpointer", None)
    if saver is None:
        raise HTTPException(status_code=503, detail="Checkpoint backing store is not ready.")

    thread_id = body.thread_id or str(uuid4())
    enforce_thread_policy(settings, thread_id, owner_sid)

    learner_adaptive_id = learner_id_for_adaptive(request, settings, owner_sid)
    if body.learning_feedback:
        apply_learning_feedback(
            settings,
            learner_adaptive_id,
            thread_id,
            helpful=body.learning_feedback.signal == "helpful",
        )

    lane = resolve_agent_lane(body.agent_lane, body.learner_profile)
    pedagogy_block, pedagogy_arm = prepare_pedagogy_for_turn(
        settings,
        owner_id=learner_adaptive_id,
        thread_id=thread_id,
        agent_lane=lane,
        profile=body.learner_profile,
        coaching_mode=body.coaching_mode,
    )
    try:
        graph = await get_workflow_graph(settings, saver, lane)
        timetable_block = timetable_context_for_owner(settings, owner_sid)
        human_msg = await build_human_message(
            graph,
            body,
            thread_id,
            attachment_block=attachment_block,
            timetable_block=timetable_block,
            pedagogy_block=pedagogy_block or None,
        )
        result = await graph.ainvoke(
            {"messages": [human_msg]},
            config={"configurable": {"thread_id": thread_id}},
        )
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("Workflow invocation failed")
        raise HTTPException(status_code=503, detail=f"Agent failed: {e!s}") from e

    register_thread(settings, thread_id, owner_sid)

    msgs = result.get("messages", [])
    if not msgs:
        raise HTTPException(status_code=500, detail="Empty agent response")

    last = msgs[-1]
    content = last.content if isinstance(last, AIMessage) else getattr(last, "content", last)
    text = content if isinstance(content, str) else str(content)
    log_if_suspicious_reply(text, settings)
    text = augment_assistant_reply(text, settings)
    return WorkflowResponse(
        reply=text,
        thread_id=thread_id,
        agent_lane=lane,
        pedagogy_arm=pedagogy_arm,
    )


async def workflow_history_result(request: Request, thread_id: str) -> HistoryResponse:
    settings = get_settings()
    owner_sid = verify_app_access(request, settings)
    ensure_clerk_subscription(request, settings, owner_sid)

    saver = getattr(request.app.state, "checkpointer", None)
    if saver is None:
        raise HTTPException(status_code=503, detail="Checkpoint backing store is not ready.")
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    tid = thread_id.strip()
    if not tid:
        raise HTTPException(status_code=400, detail="thread_id is required")

    enforce_thread_policy(settings, tid, owner_sid)

    try:
        graph = await get_workflow_graph(settings, saver, DEFAULT_AGENT_LANE)
        snap = await graph.aget_state({"configurable": {"thread_id": tid}})
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.exception("workflow_history failed")
        raise HTTPException(status_code=503, detail=f"Could not load history: {e!s}") from e

    raw_msgs = (snap.values or {}).get("messages", []) if snap else []
    out: list[HistoryMessage] = []
    for m in raw_msgs:
        if isinstance(m, HumanMessage):
            out.append(
                HistoryMessage(
                    role="user",
                    content=display_user_content(lc_content(m.content)),
                )
            )
        elif isinstance(m, AIMessage):
            text = lc_content(m.content)
            if text.strip():
                text = augment_assistant_reply(text, settings)
                out.append(HistoryMessage(role="assistant", content=text))
    return HistoryResponse(thread_id=tid, messages=out)


async def workflow_upload_result(
    request: Request,
    file: UploadFile,
    message: str,
    thread_id: str | None,
    coaching_mode: str,
    agent_lane: str,
    learner_profile_json: str | None,
) -> WorkflowResponse:
    settings = get_settings()
    learner_profile = None
    if learner_profile_json and str(learner_profile_json).strip():
        try:
            learner_profile = LearnerProfile.model_validate_json(learner_profile_json)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(
                status_code=400,
                detail=f"Invalid learner_profile JSON: {e!s}",
            ) from e

    filename, raw = await read_upload_bytes(file, settings.max_upload_bytes)
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_DOCUMENT_SUFFIXES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {ext or '(none)'}. Allowed: {', '.join(sorted(ALLOWED_DOCUMENT_SUFFIXES))}.",
        )

    try:
        extracted = extract_document_text(
            filename,
            raw,
            max_chars=settings.max_attachment_extract_chars,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    user_msg = (message or "").strip()
    if not user_msg:
        user_msg = (
            "Please read the attached document. Summarize the main ideas, define key terms, "
            "and note anything that might be relevant for my studies or exams."
        )

    tid_clean = (thread_id or "").strip() or None
    body = WorkflowRequest(
        message=user_msg,
        thread_id=tid_clean,
        learner_profile=learner_profile,
        coaching_mode=coaching_mode,
        agent_lane=agent_lane,
    )
    block = format_attachment_block(filename, extracted)
    return await execute_workflow(request, body, attachment_block=block)


async def workflow_stream_response(request: Request, body: WorkflowRequest) -> EventSourceResponse:
    """Validate auth and runtime before streaming; failures are HTTP errors (not SSE)."""
    settings = get_settings()
    owner_sid = verify_app_access(request, settings)
    ensure_clerk_subscription(request, settings, owner_sid)

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    saver = getattr(request.app.state, "checkpointer", None)
    if saver is None:
        raise HTTPException(status_code=503, detail="Checkpoint backing store is not ready.")

    thread_id = body.thread_id or str(uuid4())
    enforce_thread_policy(settings, thread_id, owner_sid)

    learner_adaptive_id = learner_id_for_adaptive(request, settings, owner_sid)
    if body.learning_feedback:
        apply_learning_feedback(
            settings,
            learner_adaptive_id,
            thread_id,
            helpful=body.learning_feedback.signal == "helpful",
        )

    lane = resolve_agent_lane(body.agent_lane, body.learner_profile)
    pedagogy_block, pedagogy_arm = prepare_pedagogy_for_turn(
        settings,
        owner_id=learner_adaptive_id,
        thread_id=thread_id,
        agent_lane=lane,
        profile=body.learner_profile,
        coaching_mode=body.coaching_mode,
    )
    graph = await get_workflow_graph(settings, saver, lane)
    timetable_block = timetable_context_for_owner(settings, owner_sid)
    human_msg = await build_human_message(
        graph,
        body,
        thread_id,
        attachment_block=None,
        timetable_block=timetable_block,
        pedagogy_block=pedagogy_block or None,
    )
    config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}

    async def gen() -> AsyncIterator[dict[str, str]]:
        assembled: list[str] = []
        stream_subgraphs = bool(getattr(graph, "stream_subgraphs", False))
        try:
            async for raw in graph.astream(
                {"messages": [human_msg]},
                config,
                stream_mode="messages",
                subgraphs=stream_subgraphs,
            ):
                msg = _unpack_stream_message_item(raw)
                chunk = ""
                if isinstance(msg, AIMessageChunk):
                    c = msg.content
                    chunk = c if isinstance(c, str) else ""
                elif isinstance(msg, AIMessage):
                    c = msg.content
                    chunk = c if isinstance(c, str) else str(c)
                if chunk:
                    assembled.append(chunk)
                    yield {"event": "token", "data": json.dumps({"text": chunk})}
            full = "".join(assembled)
            if not full.strip():
                snap = await graph.aget_state(config)
                msgs_tail = (snap.values or {}).get("messages") or [] if snap else []
                if msgs_tail:
                    last = msgs_tail[-1]
                    if isinstance(last, AIMessage):
                        full = lc_content(last.content)
                        if full.strip():
                            yield {"event": "token", "data": json.dumps({"text": full})}
            log_if_suspicious_reply(full, settings)
            with_footer = augment_assistant_reply(full, settings)
            if len(with_footer) > len(full):
                yield {"event": "token", "data": json.dumps({"text": with_footer[len(full) :]})}
            yield {
                "event": "done",
                "data": json.dumps(
                    {
                        "thread_id": thread_id,
                        "agent_lane": lane,
                        "reply": with_footer,
                        "pedagogy_arm": pedagogy_arm,
                    }
                ),
            }
        except Exception as e:  # noqa: BLE001
            logger.exception("workflow_stream failed")
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}
        finally:
            register_thread(settings, thread_id, owner_sid)

    return EventSourceResponse(gen())

