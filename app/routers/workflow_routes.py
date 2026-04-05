"""POST/GET workflow API (chat agent, uploads, history, SSE)."""

from __future__ import annotations

import html
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from starlette.responses import Response

from app.access import verify_app_access
from app.clerk_auth import ensure_clerk_subscription, primary_email_from_clerk_claims
from app.config import get_settings
from app.limiting import (
    dynamic_coach_email_export_limit,
    dynamic_workflow_limit,
    email_export_limit_key,
    limiter,
)
from app.schemas import (
    EmailCoachExportRequest,
    EmailCoachExportResponse,
    HistoryResponse,
    WorkflowRequest,
    WorkflowResponse,
    WorkflowThreadsResponse,
    WorkflowThreadMeta,
)
from app.thread_registry import list_threads_for_owner
from app.timetable_messaging import send_sendgrid_email
from app.timetable_store import get_prefs, upsert_prefs
from app.workflow_ops import (
    execute_workflow,
    registry_path,
    workflow_history_result,
    workflow_stream_response,
    workflow_upload_result,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _workflow_session_owner(request: Request) -> str:
    """Stable owner id for the current session / Clerk user / API key (same as workflow routes)."""
    settings = get_settings()
    owner = verify_app_access(request, settings)
    if owner is None:
        if not settings.auth_enabled:
            from app.access import ensure_session_learner_id

            return ensure_session_learner_id(request)
        raise HTTPException(
            status_code=401,
            detail="Sign in (or use configured access) for this action.",
        )
    ensure_clerk_subscription(request, settings, owner)
    return owner


@router.post("/workflow/email-export", response_model=EmailCoachExportResponse)
@limiter.limit(dynamic_coach_email_export_limit, key_func=email_export_limit_key)
async def workflow_email_export(
    request: Request,
    response: Response,
    body: EmailCoachExportRequest,
) -> EmailCoachExportResponse:
    """Email assistant text to the learner's **notification_email** (timetable prefs), via SendGrid."""
    settings = get_settings()
    owner = _workflow_session_owner(request)

    max_chars = settings.coach_email_export_max_body_chars
    text = body.body.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Message body is empty.")
    if len(text) > max_chars:
        raise HTTPException(
            status_code=413,
            detail=f"Message too long for email (max {max_chars} characters).",
        )

    if not (settings.sendgrid_api_key or "").strip():
        raise HTTPException(
            status_code=503,
            detail="Email is not configured on the server (SENDGRID_API_KEY).",
        )

    path = Path(settings.timetable_db_path).expanduser().resolve()
    prefs = get_prefs(path, owner)
    to_email = (prefs.get("notification_email") or "").strip()
    from_claims = False
    if not to_email:
        claims = getattr(request.state, "clerk_claims", None) or {}
        cand = primary_email_from_clerk_claims(claims if isinstance(claims, dict) else None)
        if cand:
            to_email = cand
            from_claims = True
    if not to_email:
        raise HTTPException(
            status_code=400,
            detail=(
                "No email address available for this account. Open Studio → Account / Notification settings, "
                "enter **Email for SendGrid**, save, then try again — or ensure your Clerk session token "
                "includes the **email** claim."
            ),
        )
    if from_claims and owner.startswith("clerk:"):
        try:
            merged = dict(prefs)
            merged["notification_email"] = to_email
            upsert_prefs(path, owner, merged)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to backfill notification_email from Clerk JWT")

    subject = (body.subject or "").strip() or "Your Study Coach message"
    esc = html.escape(text)
    html_inner = f"""
<div class="wrap"><div class="card">
  <h1>Message from Study Coach</h1>
  <p style="white-space:pre-wrap;font-family:system-ui,Segoe UI,sans-serif;font-size:14px;line-height:1.5;">{esc}</p>
  <p class="meta">Sent from Klingbo Study Coach — this inbox is not monitored for replies.</p>
</div>
<p class="footer">Educational support only; verify important facts with official sources.</p></div>
"""

    ok = send_sendgrid_email(
        settings,
        to_email=to_email,
        subject=subject,
        plain=text + "\n\n— Klingbo Study Coach",
        html_inner=html_inner,
    )
    if not ok:
        logger.warning("workflow_email_export SendGrid failed owner=%s", owner[:32] if owner else "")
        raise HTTPException(
            status_code=502,
            detail="Email could not be sent. Try again later or contact support.",
        )
    return EmailCoachExportResponse(sent_to=to_email)


@router.get("/workflow/threads", response_model=WorkflowThreadsResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow_threads(
    request: Request,
    response: Response,
    limit: int = 40,
) -> WorkflowThreadsResponse:
    """List recent coach thread IDs registered for this user (requires ``BIND_THREADS_TO_SESSION`` + auth)."""
    settings = get_settings()
    owner = _workflow_session_owner(request)
    lim = max(1, min(limit, 100))
    if (
        not settings.auth_enabled
        or not owner
        or not settings.bind_threads_to_session
    ):
        return WorkflowThreadsResponse(threads=[])
    rows = list_threads_for_owner(registry_path(), owner, limit=lim)
    return WorkflowThreadsResponse(
        threads=[WorkflowThreadMeta(**r) for r in rows],
    )


@router.get("/workflow/history", response_model=HistoryResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow_history(
    request: Request, response: Response, thread_id: str
) -> HistoryResponse:
    return await workflow_history_result(request, thread_id)


@router.post("/workflow", response_model=WorkflowResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow(
    request: Request, response: Response, body: WorkflowRequest
) -> WorkflowResponse:
    return await execute_workflow(request, body)


@router.post("/workflow/upload", response_model=WorkflowResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow_upload(
    request: Request,
    response: Response,
    file: UploadFile = File(..., description="Document: txt, pdf, docx, rtf, odt, html, csv, md, …"),
    message: str = Form(""),
    thread_id: str | None = Form(None),
    coaching_mode: str = Form("full"),
    agent_lane: str = Form("auto"),
    learner_profile_json: str | None = Form(None),
) -> WorkflowResponse:
    """Send a document plus optional message; text is extracted server-side and prepended to the user turn."""
    return await workflow_upload_result(
        request,
        file,
        message,
        thread_id,
        coaching_mode,
        agent_lane,
        learner_profile_json,
    )


@router.post("/workflow/stream")
@limiter.limit(dynamic_workflow_limit)
async def workflow_stream(
    request: Request, response: Response, body: WorkflowRequest
):
    return await workflow_stream_response(request, body)
