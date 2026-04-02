"""FastAPI gateway: workflow streaming, optional access control, thread registry."""

from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator
from uuid import uuid4

import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastmcp.utilities.lifespan import combine_lifespans
from langchain_core.messages import AIMessage, AIMessageChunk, HumanMessage
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from sse_starlette.sse import EventSourceResponse
from starlette.middleware.sessions import SessionMiddleware

from app.access import access_codes_match, session_auth_info, verify_app_access
from app.agent_lanes import (
    DEFAULT_AGENT_LANE,
    VALID_AGENT_LANES,
    resolve_agent_lane,
)
from app.config import Settings, get_settings
from app.document_extract import (
    ALLOWED_DOCUMENT_SUFFIXES,
    extract_document_text,
    normalize_upload_filename,
)
from app.mcp_server.server import build_event_store, mcp
from app.thread_registry import assert_access, register_owner
from app.workflows.graph import get_workflow_graph

logger = logging.getLogger(__name__)

_STATIC = Path(__file__).resolve().parent / "static"
PROFILE_MARK_END = "---end-learner-profile---"
ATTACH_MARK_END = "---end-attached-document---"

_settings = get_settings()
event_store = build_event_store(_settings.redis_url)
mcp_app = mcp.http_app(path="/mcp", event_store=event_store)


def _limit_key(request: Request) -> str:
    settings = get_settings()
    if settings.auth_enabled:
        sid = request.session.get("learner_session_id")
        if sid:
            return f"sid:{sid}"
    return get_remote_address(request)


limiter = Limiter(key_func=_limit_key)


def dynamic_workflow_limit() -> str:
    return f"{get_settings().workflow_requests_per_minute}/minute"


def _lc_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(str(block.get("text", "")))
            else:
                parts.append(str(block))
        return "".join(parts)
    return str(content)


def _display_user_content(raw: str) -> str:
    if PROFILE_MARK_END in raw:
        raw = raw.split(PROFILE_MARK_END, 1)[1].strip()
    if ATTACH_MARK_END in raw:
        raw = raw.split(ATTACH_MARK_END, 1)[1].strip()
    return raw


@asynccontextmanager
async def core_lifespan(app: FastAPI):
    settings = get_settings()
    db_path = Path(settings.checkpoint_sqlite_path).expanduser()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn_str = str(db_path.resolve())
    if settings.auth_enabled and len(settings.session_secret) < 16:
        logger.warning("SESSION_SECRET is short — use a long random value when APP_ACCESS_CODE is set.")
    async with AsyncSqliteSaver.from_conn_string(conn_str) as saver:
        app.state.checkpointer = saver
        logger.info("LangGraph thread memory (SQLite): %s", conn_str)
        yield


app = FastAPI(
    title="Ghana education & digital literacy agent (FastAPI + LangGraph + MCP)",
    version="0.1.0",
    lifespan=combine_lifespans(core_lifespan, mcp_app.lifespan),
    description="Workflow API for Ghanaian schools & universities.",
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    SessionMiddleware,
    secret_key=get_settings().session_secret,
    https_only=False,
    same_site="lax",
    max_age=14 * 24 * 3600,
)
app.add_middleware(SlowAPIMiddleware)
app.mount("/agent", mcp_app)
app.mount("/static", StaticFiles(directory=str(_STATIC)), name="static")


class LearnerProfile(BaseModel):
    education_level: str = Field(
        ...,
        description="primary_jhs | shs | tertiary | educator_parent | other",
    )
    shs_track: str | None = Field(default=None)
    subject_focus: str | None = None
    region: str | None = None
    goals: str | None = Field(default=None, max_length=4000)


class WorkflowRequest(BaseModel):
    message: str = Field(..., min_length=1)
    thread_id: str | None = None
    learner_profile: LearnerProfile | None = None
    coaching_mode: str | None = Field(
        default="full",
        description="full | hints — hints prefers Socratic nudges over full solutions.",
    )
    agent_lane: str | None = Field(
        default="auto",
        description="auto | general | jhs | shs | tertiary | educator — specialist coach; auto uses learner_profile.",
    )


class WorkflowResponse(BaseModel):
    reply: str
    thread_id: str
    agent_lane: str = Field(description="Resolved specialist lane for this turn.")


class HistoryMessage(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    thread_id: str
    messages: list[HistoryMessage]


def _format_profile_block(p: LearnerProfile) -> str:
    lines = [
        "[Learner profile — personalize for Ghana GES/SHS/tertiary context; do not quiz them on this block unless helpful.]",
        f"- Education level: {p.education_level}",
    ]
    if p.shs_track and p.shs_track != "na":
        lines.append(f"- SHS / programme orientation: {p.shs_track}")
    if p.subject_focus:
        lines.append(f"- Subject / focus: {p.subject_focus}")
    if p.region:
        lines.append(f"- Region: {p.region}")
    if p.goals:
        lines.append(f"- Goals: {p.goals.strip()}")
    return "\n".join(lines)


def _coaching_prefix(mode: str | None) -> str:
    if (mode or "").lower() == "hints":
        return (
            "[Coaching mode: hints — give short hints, guiding questions, and next steps first. "
            "Provide a full worked solution only if the learner clearly asks for it or after they try once.]\n\n"
        )
    return ""


async def _thread_has_messages(graph: Any, thread_id: str) -> bool:
    snap = await graph.aget_state({"configurable": {"thread_id": thread_id}})
    if not snap or not snap.values:
        return False
    msgs = snap.values.get("messages") or []
    return len(msgs) > 0


def _registry_path() -> Path:
    return Path(get_settings().thread_registry_db_path).expanduser().resolve()


def _enforce_thread_policy(
    settings: Settings,
    thread_id: str,
    owner_sid: str | None,
) -> None:
    if not settings.auth_enabled or not owner_sid or not settings.bind_threads_to_session:
        return
    assert_access(_registry_path(), thread_id, owner_sid, bind=True)


def _register_thread(settings: Settings, thread_id: str, owner_sid: str | None) -> None:
    if not settings.auth_enabled or not owner_sid or not settings.bind_threads_to_session:
        return
    register_owner(_registry_path(), thread_id, owner_sid)


def _format_attachment_block(filename: str, extracted_text: str) -> str:
    safe_name = normalize_upload_filename(filename)
    return (
        "[Attached document: "
        f"{safe_name} — text extracted on server; scanned PDFs may have no text layer.]\n"
        f"{extracted_text}\n"
        f"{ATTACH_MARK_END}\n"
    )


async def _build_human_message(
    graph: Any,
    body: WorkflowRequest,
    thread_id: str,
    *,
    attachment_block: str | None = None,
) -> HumanMessage:
    human_text = body.message
    prefix_parts: list[str] = []
    if body.learner_profile and not await _thread_has_messages(graph, thread_id):
        prefix_parts.append(_format_profile_block(body.learner_profile) + f"\n{PROFILE_MARK_END}")
    if attachment_block:
        prefix_parts.append(attachment_block.rstrip())
    if prefix_parts:
        human_text = "\n".join(prefix_parts) + "\n" + human_text
    human_text = _coaching_prefix(body.coaching_mode) + human_text
    return HumanMessage(content=human_text)


async def _read_upload_bytes(upload: UploadFile, max_bytes: int) -> tuple[str, bytes]:
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


async def _execute_workflow(
    request: Request,
    body: WorkflowRequest,
    *,
    attachment_block: str | None = None,
) -> WorkflowResponse:
    settings = get_settings()
    owner_sid = verify_app_access(request, settings)

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    saver = getattr(request.app.state, "checkpointer", None)
    if saver is None:
        raise HTTPException(status_code=503, detail="Checkpoint backing store is not ready.")

    thread_id = body.thread_id or str(uuid4())
    _enforce_thread_policy(settings, thread_id, owner_sid)

    lane = resolve_agent_lane(body.agent_lane, body.learner_profile)
    try:
        graph = await get_workflow_graph(settings, saver, lane)
        human_msg = await _build_human_message(
            graph,
            body,
            thread_id,
            attachment_block=attachment_block,
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

    _register_thread(settings, thread_id, owner_sid)

    msgs = result.get("messages", [])
    if not msgs:
        raise HTTPException(status_code=500, detail="Empty agent response")

    last = msgs[-1]
    content = last.content if isinstance(last, AIMessage) else getattr(last, "content", last)
    text = content if isinstance(content, str) else str(content)
    return WorkflowResponse(reply=text, thread_id=thread_id, agent_lane=lane)


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def landing() -> HTMLResponse:
    path = _STATIC / "index.html"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="index.html not found")
    return HTMLResponse(path.read_text(encoding="utf-8"))


@app.get("/service")
async def service_info() -> dict[str, Any]:
    settings = get_settings()
    return {
        "service": "education-digital-literacy-agent",
        "landing": "/",
        "assessment": "/assessment",
        "gate": "/gate" if settings.auth_enabled else None,
        "docs": "/docs",
        "chat_ui": "/chat",
        "health": "/health",
        "health_detail": "/health/deps",
        "workflow": "/workflow",
        "workflow_upload": "/workflow/upload",
        "workflow_stream": "/workflow/stream",
        "workflow_history": "/workflow/history",
        "checkpoint_sqlite": settings.checkpoint_sqlite_path,
        "thread_registry_db": settings.thread_registry_db_path,
        "mcp_http": "/agent/mcp",
        "mcp_client_url_hint": settings.resolved_mcp_http_url,
        "agent_lanes": sorted(VALID_AGENT_LANES),
        "agent_lane_default": DEFAULT_AGENT_LANE,
        **session_auth_info(settings),
    }


@app.get("/gate", response_class=HTMLResponse, include_in_schema=False)
async def gate_page() -> HTMLResponse:
    if not get_settings().auth_enabled:
        return RedirectResponse("/chat", status_code=302)
    path = _STATIC / "gate.html"
    if not path.is_file():
        raise HTTPException(status_code=404)
    return HTMLResponse(path.read_text(encoding="utf-8"))


@app.post("/gate/session")
async def gate_session(
    request: Request,
    access_code: str = Form(...),
    next: str = Form("/chat"),
) -> RedirectResponse:
    settings = get_settings()
    if not settings.auth_enabled:
        return RedirectResponse(next or "/chat", status_code=302)
    expected = settings.app_access_code or ""
    if not access_codes_match(access_code, expected):
        return RedirectResponse("/gate?e=1", status_code=302)
    request.session["access_ok"] = True
    if not request.session.get("learner_session_id"):
        request.session["learner_session_id"] = str(uuid4())
    dest = next if next.startswith("/") else "/chat"
    return RedirectResponse(dest, status_code=303)


@app.get("/assessment", response_class=HTMLResponse, include_in_schema=False)
async def assessment_ui() -> HTMLResponse:
    path = _STATIC / "assessment.html"
    if not path.is_file():
        raise HTTPException(status_code=404)
    return HTMLResponse(path.read_text(encoding="utf-8"))


@app.get("/chat", response_class=HTMLResponse, include_in_schema=False)
async def chat_ui() -> HTMLResponse:
    path = _STATIC / "chat.html"
    if not path.is_file():
        raise HTTPException(status_code=404)
    return HTMLResponse(path.read_text(encoding="utf-8"))


@app.get("/favicon.ico", include_in_schema=False)
async def favicon() -> Response:
    return Response(status_code=204)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/health/deps")
async def health_deps(request: Request) -> dict[str, Any]:
    settings = get_settings()
    checks: dict[str, Any] = {
        "openai_configured": bool(settings.openai_api_key),
        "checkpointer_ready": getattr(request.app.state, "checkpointer", None) is not None,
        "auth_enabled": settings.auth_enabled,
        "mcp_reachable": None,
    }
    url = settings.resolved_mcp_http_url
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(url)
            checks["mcp_reachable"] = r.status_code < 500
    except Exception as e:  # noqa: BLE001
        checks["mcp_reachable"] = False
        checks["mcp_error"] = str(e)
    ok = checks["openai_configured"] and checks["checkpointer_ready"] and checks["mcp_reachable"] is not False
    checks["status"] = "ok" if ok else "degraded"
    return checks


@app.get("/workflow/history", response_model=HistoryResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow_history(request: Request, thread_id: str) -> HistoryResponse:
    settings = get_settings()
    owner_sid = verify_app_access(request, settings)

    saver = getattr(request.app.state, "checkpointer", None)
    if saver is None:
        raise HTTPException(status_code=503, detail="Checkpoint backing store is not ready.")
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    tid = thread_id.strip()
    if not tid:
        raise HTTPException(status_code=400, detail="thread_id is required")

    _enforce_thread_policy(settings, tid, owner_sid)

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
                    content=_display_user_content(_lc_content(m.content)),
                )
            )
        elif isinstance(m, AIMessage):
            text = _lc_content(m.content)
            if text.strip():
                out.append(HistoryMessage(role="assistant", content=text))
    return HistoryResponse(thread_id=tid, messages=out)


@app.post("/workflow", response_model=WorkflowResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow(request: Request, body: WorkflowRequest) -> WorkflowResponse:
    return await _execute_workflow(request, body)


@app.post("/workflow/upload", response_model=WorkflowResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow_upload(
    request: Request,
    file: UploadFile = File(..., description="Document: txt, pdf, docx, rtf, odt, html, csv, md, …"),
    message: str = Form(""),
    thread_id: str | None = Form(None),
    coaching_mode: str = Form("full"),
    agent_lane: str = Form("auto"),
    learner_profile_json: str | None = Form(None),
) -> WorkflowResponse:
    """Send a document plus optional message; text is extracted server-side and prepended to the user turn."""
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

    filename, raw = await _read_upload_bytes(file, settings.max_upload_bytes)
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
    block = _format_attachment_block(filename, extracted)
    return await _execute_workflow(request, body, attachment_block=block)


@app.post("/workflow/stream")
@limiter.limit(dynamic_workflow_limit)
async def workflow_stream(request: Request, body: WorkflowRequest) -> EventSourceResponse:
    settings = get_settings()
    owner_sid = verify_app_access(request, settings)

    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY is not configured.")

    saver = getattr(request.app.state, "checkpointer", None)
    if saver is None:
        raise HTTPException(status_code=503, detail="Checkpoint backing store is not ready.")

    thread_id = body.thread_id or str(uuid4())
    _enforce_thread_policy(settings, thread_id, owner_sid)

    lane = resolve_agent_lane(body.agent_lane, body.learner_profile)
    graph = await get_workflow_graph(settings, saver, lane)
    human_msg = await _build_human_message(graph, body, thread_id, attachment_block=None)
    config: dict[str, Any] = {"configurable": {"thread_id": thread_id}}

    async def gen() -> AsyncIterator[dict[str, str]]:
        try:
            async for msg, _meta in graph.astream(
                {"messages": [human_msg]},
                config,
                stream_mode="messages",
            ):
                chunk = ""
                if isinstance(msg, AIMessageChunk):
                    c = msg.content
                    chunk = c if isinstance(c, str) else ""
                elif isinstance(msg, AIMessage):
                    c = msg.content
                    chunk = c if isinstance(c, str) else str(c)
                if chunk:
                    yield {"event": "token", "data": json.dumps({"text": chunk})}
            yield {
                "event": "done",
                "data": json.dumps({"thread_id": thread_id, "agent_lane": lane}),
            }
        except Exception as e:  # noqa: BLE001
            logger.exception("workflow_stream failed")
            yield {"event": "error", "data": json.dumps({"detail": str(e)})}
        finally:
            _register_thread(settings, thread_id, owner_sid)

    return EventSourceResponse(gen())
