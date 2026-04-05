"""Timetable CRUD, preferences, and in-app notification feed."""

from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile

from app.access import verify_app_access
from app.clerk_auth import ensure_clerk_subscription
from app.config import get_settings
from app.limiting import dynamic_workflow_limit, limiter
from app.schemas import (
    TimetableImportResponse,
    TimetableInAppNotification,
    TimetableMeResponse,
    TimetableNotificationsResponse,
    TimetablePreferencesOut,
    TimetablePreferencesUpdate,
    TimetableSlotCreate,
    TimetableSlotOut,
)
from app.timetable_import import import_timetable_from_bytes
from app.workflow_ops import read_upload_bytes
from app.timetable_store import (
    delete_slot,
    get_prefs,
    list_in_app,
    list_slots,
    mark_all_read,
    mark_read,
    insert_slot,
    update_slot,
    upsert_prefs,
)

router = APIRouter(prefix="/timetable", tags=["timetable"])


def _db_path():
    from pathlib import Path

    return Path(get_settings().timetable_db_path).expanduser().resolve()


def _owner(request: Request) -> str:
    settings = get_settings()
    owner = verify_app_access(request, settings)
    if owner is None:
        if not settings.auth_enabled:
            from app.access import ensure_session_learner_id

            return ensure_session_learner_id(request)
        raise HTTPException(
            status_code=401,
            detail="Sign in or configure auth to use timetable.",
        )
    ensure_clerk_subscription(request, settings, owner)
    return owner


def _prefs_out(d: dict) -> TimetablePreferencesOut:
    return TimetablePreferencesOut(
        timezone=d["timezone"],
        notify_email=d["notify_email"],
        notify_in_app=d["notify_in_app"],
        study_prep_minutes=d["study_prep_minutes"],
        rest_after_minutes=d["rest_after_minutes"],
        focus_reminder_local=d.get("focus_reminder_local"),
        goals_summary=d.get("goals_summary"),
        notification_email=d.get("notification_email"),
        include_timetable_in_coach=d.get("include_timetable_in_coach", True),
    )


@router.get("/me", response_model=TimetableMeResponse)
@limiter.limit(dynamic_workflow_limit)
async def timetable_me(request: Request, response: Response) -> TimetableMeResponse:
    owner = _owner(request)
    path = _db_path()
    raw = get_prefs(path, owner)
    slots = [TimetableSlotOut(**s) for s in list_slots(path, owner)]
    return TimetableMeResponse(preferences=_prefs_out(raw), slots=slots)


@router.put("/preferences", response_model=TimetablePreferencesOut)
@limiter.limit(dynamic_workflow_limit)
async def timetable_put_preferences(
    request: Request,
    response: Response,
    body: TimetablePreferencesUpdate,
) -> TimetablePreferencesOut:
    owner = _owner(request)
    path = _db_path()
    updated = upsert_prefs(
        path,
        owner,
        {
            "timezone": body.timezone.strip(),
            "notify_email": body.notify_email,
            "notify_in_app": body.notify_in_app,
            "study_prep_minutes": body.study_prep_minutes,
            "rest_after_minutes": body.rest_after_minutes,
            "focus_reminder_local": body.focus_reminder_local,
            "goals_summary": body.goals_summary,
            "notification_email": (
                body.notification_email.strip()
                if body.notification_email and body.notification_email.strip()
                else None
            ),
            "include_timetable_in_coach": body.include_timetable_in_coach,
        },
    )
    return _prefs_out(updated)


@router.post("/import", response_model=TimetableImportResponse)
@limiter.limit(dynamic_workflow_limit)
async def timetable_import(
    request: Request,
    response: Response,
    file: UploadFile = File(..., description="Timetable: PDF, DOCX, or image (PNG, JPG, WebP, GIF)."),
) -> TimetableImportResponse:
    """Extract weekly slots from an uploaded timetable (document text or vision for images)."""
    owner = _owner(request)
    settings = get_settings()
    if not settings.openai_api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY is not configured — timetable import needs the AI parser.",
        )
    path = _db_path()
    max_b = settings.max_upload_bytes
    try:
        filename, data = await read_upload_bytes(file, max_b)
        rows = await import_timetable_from_bytes(filename, data, settings)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    added: list[TimetableSlotOut] = []
    for row in rows:
        ins = insert_slot(
            path,
            owner,
            weekday=row["weekday"],
            start_time=row["start_time"],
            end_time=row["end_time"],
            title=row["title"],
            location=row.get("location"),
        )
        added.append(TimetableSlotOut(**ins))

    if not added:
        msg = (
            "No slots could be extracted. Try a clearer photo, a PDF with selectable text, "
            "or add rows manually. Scanned PDFs without a text layer may not work."
        )
    else:
        msg = f"Imported {len(added)} slot(s). Review and remove any mistakes below."
    return TimetableImportResponse(added=added, message=msg)


@router.post("/slots", response_model=TimetableSlotOut)
@limiter.limit(dynamic_workflow_limit)
async def timetable_post_slot(
    request: Request,
    response: Response,
    body: TimetableSlotCreate,
) -> TimetableSlotOut:
    owner = _owner(request)
    path = _db_path()
    row = insert_slot(
        path,
        owner,
        weekday=body.weekday,
        start_time=body.start_time,
        end_time=body.end_time,
        title=body.title.strip(),
        location=body.location.strip() if body.location else None,
    )
    return TimetableSlotOut(**row)


@router.put("/slots/{slot_id}", response_model=TimetableSlotOut)
@limiter.limit(dynamic_workflow_limit)
async def timetable_put_slot(
    request: Request,
    response: Response,
    slot_id: str,
    body: TimetableSlotCreate,
) -> TimetableSlotOut:
    owner = _owner(request)
    path = _db_path()
    row = update_slot(
        path,
        owner,
        slot_id,
        weekday=body.weekday,
        start_time=body.start_time,
        end_time=body.end_time,
        title=body.title.strip(),
        location=body.location.strip() if body.location else None,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Slot not found.")
    return TimetableSlotOut(**row)


@router.delete("/slots/{slot_id}")
@limiter.limit(dynamic_workflow_limit)
async def timetable_delete_slot(request: Request, response: Response, slot_id: str) -> dict[str, bool]:
    owner = _owner(request)
    path = _db_path()
    ok = delete_slot(path, owner, slot_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Slot not found.")
    return {"ok": True}


@router.get("/notifications", response_model=TimetableNotificationsResponse)
@limiter.limit(dynamic_workflow_limit)
async def timetable_notifications(
    request: Request,
    response: Response,
    unread_only: bool = False,
    limit: int = 50,
) -> TimetableNotificationsResponse:
    owner = _owner(request)
    path = _db_path()
    lim = max(1, min(limit, 100))
    rows = list_in_app(path, owner, limit=lim, unread_only=unread_only)
    items = [
        TimetableInAppNotification(
            id=r["id"],
            title=r["title"],
            body=r["body"],
            kind=r["kind"],
            created_at=r["created_at"],
            read_at=r["read_at"],
        )
        for r in rows
    ]
    return TimetableNotificationsResponse(notifications=items)


@router.post("/notifications/{notification_id}/read")
@limiter.limit(dynamic_workflow_limit)
async def timetable_notification_read(
    request: Request,
    response: Response,
    notification_id: str,
) -> dict[str, bool]:
    owner = _owner(request)
    path = _db_path()
    ok = mark_read(path, owner, notification_id)
    return {"ok": ok}


@router.post("/notifications/read-all")
@limiter.limit(dynamic_workflow_limit)
async def timetable_notifications_read_all(request: Request, response: Response) -> dict[str, int]:
    owner = _owner(request)
    path = _db_path()
    n = mark_all_read(path, owner)
    return {"marked": n}
