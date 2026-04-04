"""Parse timetable uploads (PDF, DOCX, images) into slot rows via extraction + structured LLM output."""

from __future__ import annotations

import base64
import logging
from pathlib import Path
from typing import Any

from langchain_core.messages import HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field

from app.config import Settings
from app.document_extract import extract_document_text, normalize_upload_filename
from app.schemas import TimetableSlotCreate

logger = logging.getLogger(__name__)

# Student timetable uploads (aligned with common study materials).
TIMETABLE_IMPORT_SUFFIXES: frozenset[str] = frozenset(
    {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
)
_IMAGE_SUFFIXES = frozenset({".png", ".jpg", ".jpeg", ".webp", ".gif"})

_MAX_SLOTS_PER_IMPORT = 60


class _ExtractedSlot(BaseModel):
    weekday: int = Field(ge=0, le=6, description="0=Monday … 6=Sunday")
    start_time: str = Field(min_length=5, max_length=5)
    end_time: str = Field(min_length=5, max_length=5)
    title: str = Field(min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)


class _TimetableExtraction(BaseModel):
    slots: list[_ExtractedSlot] = Field(default_factory=list, max_length=_MAX_SLOTS_PER_IMPORT)


def _image_mime(suffix: str) -> str:
    s = suffix.lower()
    return {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(s, "image/png")


def _default_reference_layout_path() -> Path:
    return Path(__file__).resolve().parent.parent / "frontend" / "public" / "images" / "timetable-calendar-template.png"


def _reference_layout_data_url(settings: Settings) -> str | None:
    raw = (settings.timetable_reference_layout_path or "").strip()
    path = Path(raw).expanduser().resolve() if raw else _default_reference_layout_path()
    if not path.is_file():
        logger.warning("Timetable reference layout missing at %s — continuing import without layout hint.", path)
        return None
    data = path.read_bytes()
    b64 = base64.standard_b64encode(data).decode("ascii")
    return "data:image/png;base64," + b64


def _build_llm(settings: Settings) -> ChatOpenAI:
    model_kw: dict[str, Any] = {
        "model": settings.openai_model,
        "api_key": settings.openai_api_key,
        "use_responses_api": False,
        "temperature": 0.2,
    }
    if settings.openai_base_url and str(settings.openai_base_url).strip():
        model_kw["base_url"] = str(settings.openai_base_url).strip().rstrip("/")
    return ChatOpenAI(**model_kw)


_REFERENCE_HINT = (
    "An internal REFERENCE image (first image when provided) shows an example weekly grid layout "
    "(days as columns, time running down). Use it ONLY to interpret how blocks map to weekdays and times — "
    "do not copy course titles from the reference. Extract data only from the STUDENT material (second image "
    "or the document text below)."
)

_INSTRUCTIONS = f"""You extract a recurring WEEKLY class or course timetable.

{_REFERENCE_HINT}

Return structured data with "slots": a list of objects, each with:
- weekday: integer 0-6 where 0=Monday, 1=Tuesday, …, 6=Sunday
- start_time, end_time: strings "HH:MM" in 24-hour format (e.g. 09:00, 13:30)
- title: course or subject name (short)
- location: room or building if visible, else null

Rules:
- One object per recurring weekly time block (if the same class meets Mon+Wed, output two objects).
- Map day names in any language/locale you can infer to weekday 0-6.
- Convert 12-hour times with AM/PM to 24-hour HH:MM.
- If text is illegible or you are unsure of a row, omit it (do not invent).
- Cap at 60 slots. Prefer the clearest entries if there are many."""


def _multimessage_for_image_user(
    user_data_url: str,
    ref_url: str | None,
) -> HumanMessage:
    parts: list[str | dict[str, Any]] = [{"type": "text", "text": _INSTRUCTIONS}]
    if ref_url:
        parts.append({"type": "text", "text": "Reference layout (style guide only):"})
        parts.append({"type": "image_url", "image_url": {"url": ref_url}})
    parts.append({"type": "text", "text": "STUDENT timetable — extract slots from this image only:"})
    parts.append({"type": "image_url", "image_url": {"url": user_data_url}})
    return HumanMessage(content=parts)


def _multimessage_for_document(
    text: str,
    ref_url: str | None,
) -> HumanMessage:
    parts: list[str | dict[str, Any]] = [{"type": "text", "text": _INSTRUCTIONS}]
    if ref_url:
        parts.append({"type": "text", "text": "Reference layout (style guide only):"})
        parts.append({"type": "image_url", "image_url": {"url": ref_url}})
    parts.append(
        {
            "type": "text",
            "text": "Student document text (may be partial for scanned PDFs without a text layer):\n\n---\n"
            + text
            + "\n---",
        },
    )
    return HumanMessage(content=parts)


async def import_timetable_from_bytes(
    filename: str,
    data: bytes,
    settings: Settings,
) -> list[dict[str, Any]]:
    """
    Return validated slot dicts {'weekday', 'start_time', 'end_time', 'title', 'location'} for DB insert.
    Raises ValueError for unsupported/empty input; RuntimeError for model failures.
    """
    safe_name = normalize_upload_filename(filename)
    suffix = Path(safe_name).suffix.lower()

    if suffix not in TIMETABLE_IMPORT_SUFFIXES:
        raise ValueError(
            f"Unsupported type {suffix or '(none)'}. Use: "
            + ", ".join(sorted(TIMETABLE_IMPORT_SUFFIXES))
            + "."
        )

    llm = _build_llm(settings)
    structured = llm.with_structured_output(_TimetableExtraction)
    ref_url = _reference_layout_data_url(settings)

    if suffix in _IMAGE_SUFFIXES:
        b64 = base64.standard_b64encode(data).decode("ascii")
        mime = _image_mime(suffix)
        user_url = f"data:{mime};base64,{b64}"
        msg = _multimessage_for_image_user(user_url, ref_url)
    else:
        max_c = min(32_000, int(settings.max_attachment_extract_chars))
        try:
            text = extract_document_text(safe_name, data, max_chars=max_c)
        except ValueError as e:
            raise ValueError(str(e)) from e
        msg = _multimessage_for_document(text, ref_url)

    try:
        result = await structured.ainvoke([msg])
    except Exception as e:
        logger.exception("Timetable import LLM failed")
        raise RuntimeError("Could not parse timetable with the AI model.") from e

    if not isinstance(result, _TimetableExtraction):
        raise RuntimeError("Unexpected model response.")

    out: list[dict[str, Any]] = []
    for raw in result.slots:
        try:
            row = TimetableSlotCreate(
                weekday=raw.weekday,
                start_time=raw.start_time,
                end_time=raw.end_time,
                title=raw.title.strip(),
                location=raw.location.strip() if raw.location else None,
            )
            out.append(
                {
                    "weekday": row.weekday,
                    "start_time": row.start_time,
                    "end_time": row.end_time,
                    "title": row.title,
                    "location": row.location,
                }
            )
        except Exception:
            continue

    return out
