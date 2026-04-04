"""Coach-style copy + SendGrid email (noreply@klingbo.com) with inline logo."""

from __future__ import annotations

import base64
import logging
from pathlib import Path

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

HTML_STYLE = """
body { margin:0; padding:0; background:#0f172a; font-family: Georgia, 'Times New Roman', serif; }
.wrap { max-width:560px; margin:0 auto; padding:24px; }
.card { background:#1e293b; border-radius:16px; padding:28px; border:1px solid #334155; }
h1 { color:#fbbf24; font-size:20px; margin:0 0 12px; font-weight:700; }
p { color:#e2e8f0; font-size:15px; line-height:1.55; margin:0 0 14px; }
.meta { color:#94a3b8; font-size:12px; margin-top:20px; }
.logo-row { text-align:center; margin-bottom:20px; }
.footer { color:#64748b; font-size:11px; margin-top:24px; text-align:center; }
"""


def _goal_line(goals_summary: str | None) -> str:
    g = (goals_summary or "").strip()
    if g:
        return g
    return "Stay consistent—small sessions add up toward your goals."


def prep_copy(slot_title: str, start: str, end: str, goals_summary: str | None) -> tuple[str, str, str]:
    gl = _goal_line(goals_summary)
    plain = (
        f"Study prep — {slot_title} starts soon ({start}–{end}). {gl} "
        "Skim your notes, write two questions for class, and take a steady breath."
    )
    subj = f"Study prep: {slot_title} is coming up"
    html = f"""
<div class="wrap"><div class="card">
  <h1>Time to prep</h1>
  <p><strong>{slot_title}</strong> runs <strong>{start}</strong>–<strong>{end}</strong>.</p>
  <p>{gl}</p>
  <p>Try a 10–15 minute skim of last session, jot two questions you want answered, then step in with confidence.</p>
  <p class="meta">— Your Study Coach (Klingbo)</p>
</div>
<p class="footer">Heuristic reminders, not a substitute for your school's official schedule.</p></div>
"""
    return subj, plain, html


def rest_copy(slot_title: str, rest_mins: int, goals_summary: str | None) -> tuple[str, str, str]:
    gl = _goal_line(goals_summary)
    plain = (
        f"Rest break — {slot_title} just ended. {gl} Take about {rest_mins} minutes: water, stretch, short walk, then plan your next block."
    )
    subj = f"Rest: after {slot_title}"
    html = f"""
<div class="wrap"><div class="card">
  <h1>Well done — time to recharge</h1>
  <p><strong>{slot_title}</strong> is done for now.</p>
  <p>{gl}</p>
  <p>Step away for roughly <strong>{rest_mins} minutes</strong>: hydrate, move, look away from the screen. Then pick your next focus block deliberately.</p>
  <p class="meta">— Your Study Coach (Klingbo)</p>
</div>
<p class="footer">Heuristic reminders from your saved timetable.</p></div>
"""
    return subj, plain, html


def focus_copy(goals_summary: str | None) -> tuple[str, str, str]:
    gl = _goal_line(goals_summary)
    plain = f"Daily focus — {gl} Glance at your timetable and block one deep-work session before classes."
    subj = "Your daily focus — Study Coach"
    html = f"""
<div class="wrap"><div class="card">
  <h1>Start the day with intention</h1>
  <p>{gl}</p>
  <p>Open your timetable, note your first class, and carve one uninterrupted block for review or practice before the day speeds up.</p>
  <p class="meta">— Your Study Coach (Klingbo)</p>
</div>
<p class="footer">Personalised from your goals and timetable settings.</p></div>
"""
    return subj, plain, html


def _load_logo_b64(settings: Settings) -> tuple[str | None, str | None]:
    """Return (base64_content, mime) or (None, None)."""
    raw_path = (settings.timetable_brand_logo_path or "").strip()
    if raw_path:
        path = Path(raw_path).expanduser().resolve()
    else:
        path = Path(__file__).resolve().parent.parent / "frontend" / "public" / "images" / "landing" / "kifinal.png"
    if not path.is_file():
        logger.warning("Timetable logo not found at %s", path)
        return None, None
    data = path.read_bytes()
    return base64.b64encode(data).decode("ascii"), "image/png"


def send_sendgrid_email(
    settings: Settings,
    *,
    to_email: str,
    subject: str,
    plain: str,
    html_inner: str,
) -> bool:
    key = (settings.sendgrid_api_key or "").strip()
    if not key:
        return False
    from_email = (settings.sendgrid_from_email or "noreply@klingbo.com").strip()
    from_name_stripped = (settings.sendgrid_from_name or "Klingbo Study Coach").strip()

    logo_b64, logo_mime = _load_logo_b64(settings)
    logo_html = ""
    attachments: list[dict[str, str]] = []
    if logo_b64 and logo_mime:
        logo_html = (
            '<div class="logo-row"><img src="cid:klingbo_logo" alt="Klingbo" width="72" height="72" '
            'style="border-radius:12px;display:inline-block;" /></div>'
        )
        attachments.append(
            {
                "content": logo_b64,
                "type": logo_mime,
                "filename": "kifinal.png",
                "disposition": "inline",
                "content_id": "klingbo_logo",
            }
        )

    full_html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{HTML_STYLE}</style></head>
<body>{logo_html}{html_inner}</body></html>"""

    payload: dict = {
        "personalizations": [{"to": [{"email": to_email}]}],
        "from": {"email": from_email, "name": from_name_stripped},
        "subject": subject,
        "content": [{"type": "text/plain", "value": plain}, {"type": "text/html", "value": full_html}],
    }
    if attachments:
        payload["attachments"] = attachments

    try:
        r = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json=payload,
            timeout=30.0,
        )
    except Exception as e:
        logger.exception("SendGrid request failed: %s", e)
        return False
    if r.status_code >= 300:
        logger.warning("SendGrid error %s: %s", r.status_code, r.text[:500])
        return False
    return True
