"""POST/GET workflow API (chat agent, uploads, history, SSE)."""

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.limiting import dynamic_workflow_limit, limiter
from app.schemas import HistoryResponse, WorkflowRequest, WorkflowResponse
from app.workflow_ops import (
    execute_workflow,
    workflow_history_result,
    workflow_stream_response,
    workflow_upload_result,
)

router = APIRouter()


@router.get("/workflow/history", response_model=HistoryResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow_history(request: Request, thread_id: str) -> HistoryResponse:
    return await workflow_history_result(request, thread_id)


@router.post("/workflow", response_model=WorkflowResponse)
@limiter.limit(dynamic_workflow_limit)
async def workflow(request: Request, body: WorkflowRequest) -> WorkflowResponse:
    return await execute_workflow(request, body)


@router.post("/workflow/upload", response_model=WorkflowResponse)
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
async def workflow_stream(request: Request, body: WorkflowRequest):
    return await workflow_stream_response(request, body)
