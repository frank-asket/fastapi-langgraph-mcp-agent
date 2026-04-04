"""Welcome email on first Clerk signup (user.created webhook)."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from app.clerk_entitlements import release_welcome_email_claim, try_claim_welcome_email_send
from app.config import Settings
from app.timetable_messaging import send_sendgrid_email, welcome_signup_copy

logger = logging.getLogger(__name__)


def _primary_email_from_clerk_user(data: dict[str, Any]) -> str | None:
    emails = data.get("email_addresses") or []
    primary_id = data.get("primary_email_address_id")
    if not isinstance(emails, list):
        return None
    for e in emails:
        if not isinstance(e, dict):
            continue
        addr = (e.get("email_address") or "").strip()
        if not addr:
            continue
        if primary_id and e.get("id") == primary_id:
            return addr
    for e in emails:
        if isinstance(e, dict):
            addr = (e.get("email_address") or "").strip()
            if addr:
                return addr
    return None


def _studio_paths(settings: Settings) -> tuple[str | None, str | None, str | None]:
    base = settings.study_coach_frontend_base
    if not base:
        return None, None, None
    root = base.rstrip("/") + "/"
    return (
        urljoin(root, "studio/chat"),
        urljoin(root, "assessment"),
        urljoin(root, "studio/timetable"),
    )


def send_welcome_email_for_clerk_user(settings: Settings, data: dict[str, Any]) -> None:
    """Idempotent welcome send; requires SENDGRID_API_KEY and a verified sender."""
    if not settings.clerk_send_welcome_email:
        return
    if not (settings.sendgrid_api_key or "").strip():
        logger.info("Welcome email skipped: SENDGRID_API_KEY not set")
        return

    uid = data.get("id")
    if not uid:
        return
    clerk_user_id = str(uid)
    to_email = _primary_email_from_clerk_user(data)
    if not to_email:
        logger.warning("Welcome email skipped: no email on Clerk user %s", clerk_user_id)
        return

    path = Path(settings.clerk_entitlements_db_path).expanduser().resolve()
    if not try_claim_welcome_email_send(path, clerk_user_id):
        logger.debug("Welcome email already sent for %s", clerk_user_id)
        return

    first = data.get("first_name")
    first_name = str(first).strip() if first else None
    coach, assess, tt = _studio_paths(settings)
    subj, plain, html_inner = welcome_signup_copy(
        first_name,
        coach_url=coach,
        assessment_url=assess,
        timetable_url=tt,
    )
    ok = send_sendgrid_email(
        settings,
        to_email=to_email,
        subject=subj,
        plain=plain,
        html_inner=html_inner,
    )
    if not ok:
        logger.warning("Welcome email SendGrid failed for %s — releasing claim for retry", to_email)
        release_welcome_email_claim(path, clerk_user_id)
        return
    logger.info("Welcome email sent to %s (clerk user %s)", to_email, clerk_user_id)
