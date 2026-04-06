"""LangChain tool decorators for the coach agent (MCP + local helpers).

Workspace file read is path-sandboxed. Code runner is opt-in. Email/Slack require env configuration.
"""

from __future__ import annotations

import html
import logging
import re
import subprocess
import sys
from pathlib import Path

import httpx
from langchain_core.tools import tool

from app.config import Settings
from app.timetable_messaging import send_sendgrid_email

logger = logging.getLogger(__name__)

_BAD_CODE_FRAGMENTS = (
    "import os",
    "import subprocess",
    "import sys",
    "import pathlib",
    "import socket",
    "__import__",
    "open(",
    "exec(",
    "eval(",
    "compile(",
    "input(",
    "pty.",
    "shutil.",
)


def _workspace_root(settings: Settings) -> Path:
    root = Path(settings.builtin_tools_workspace_path).expanduser().resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_workspace_file(root: Path, relative_path: str) -> Path:
    raw = (relative_path or "").strip().replace("\\", "/")
    if not raw or raw.startswith("/") or ".." in Path(raw).parts:
        raise ValueError("Invalid path: use a relative path under the workspace (no ..).")
    candidate = (root / raw).resolve()
    if candidate != root and root not in candidate.parents:
        raise PermissionError("Path escapes workspace root.")
    if not candidate.is_file():
        raise FileNotFoundError(f"Not a file: {raw}")
    return candidate


def build_builtin_tools(settings: Settings) -> list:
    """Return StructuredTool instances bound to this process ``Settings``."""
    root = _workspace_root(settings)
    max_bytes = int(settings.builtin_max_file_read_bytes)

    @tool
    def read_workspace_file(relative_path: str) -> str:
        """Read a UTF-8 text file from the agent workspace. Pass a relative path (e.g. notes/hello.txt)."""
        try:
            path = _safe_workspace_file(root, relative_path)
            if path.stat().st_size > max_bytes:
                return f"File too large (max {max_bytes} bytes)."
            return path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:  # noqa: BLE001
            return f"read_workspace_file error: {e!s}"

    @tool
    def run_python_snippet(code: str) -> str:
        """Run a **short** Python snippet with ``python -c`` (disabled unless BUILTIN_CODE_RUNNER_ENABLED). For small calculations only; no I/O."""
        if not settings.builtin_code_runner_enabled:
            return (
                "Code runner is disabled. Set BUILTIN_CODE_RUNNER_ENABLED=true in server env "
                "(unsafe on shared hosts — use only in trusted environments)."
            )
        src = (code or "").strip()
        if not src:
            return "Empty code."
        if len(src) > 4000:
            return "Snippet too long (max 4000 characters)."
        low = src.lower()
        if any(bad in low for bad in _BAD_CODE_FRAGMENTS):
            return "Snippet rejected: contains disallowed patterns (imports, I/O, exec/eval, etc.)."
        if re.search(r"^[ \t]*(import|from)[ \t]", src, re.MULTILINE):
            return "Snippet rejected: no import/from — use a single expression (e.g. math via built-ins only)."
        try:
            proc = subprocess.run(
                [sys.executable, "-c", src],
                capture_output=True,
                text=True,
                timeout=float(settings.builtin_code_runner_timeout_s),
            )
        except subprocess.TimeoutExpired:
            return f"Timed out after {settings.builtin_code_runner_timeout_s}s."
        except Exception as e:  # noqa: BLE001
            return f"run_python_snippet error: {e!s}"
        out = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        if proc.returncode != 0:
            return f"exit {proc.returncode}\n{err or out or '(no output)'}"
        return out or "(no stdout)"

    @tool
    def send_email_tool(to_email: str, subject: str, body: str) -> str:
        """Send a plain email via SendGrid when SENDGRID_API_KEY is configured. Use for user-approved notifications only."""
        to = (to_email or "").strip()
        subj = (subject or "").strip() or "(no subject)"
        plain = (body or "").strip()
        if not to or "@" not in to:
            return "Invalid or missing to_email."
        if len(plain) > 50_000:
            return "Body too long (max 50k characters)."
        if not (settings.sendgrid_api_key or "").strip():
            return "SendGrid is not configured (SENDGRID_API_KEY missing)."
        safe_html = f"<pre style=\"white-space:pre-wrap;font-family:ui-monospace,monospace\">{html.escape(plain)}</pre>"
        ok = send_sendgrid_email(
            settings,
            to_email=to,
            subject=subj[:200],
            plain=plain,
            html_inner=safe_html,
        )
        if ok:
            return f"Email queued for {to}."
        logger.warning("send_email_tool SendGrid failed to=%s", to[:64])
        return "SendGrid returned failure — check logs and sender configuration."

    @tool
    def post_slack_message(message: str) -> str:
        """Post text to Slack using SLACK_INCOMING_WEBHOOK_URL when set."""
        url = (settings.slack_incoming_webhook_url or "").strip()
        text = (message or "").strip()
        if not text:
            return "Empty message."
        if len(text) > 4000:
            return "Message too long (max 4000 characters)."
        if not url:
            return "Slack webhook not configured (SLACK_INCOMING_WEBHOOK_URL missing)."
        try:
            r = httpx.post(url, json={"text": text}, timeout=10.0)
            if r.is_success:
                return "Posted to Slack."
            return f"Slack webhook failed: HTTP {r.status_code} {r.text[:200]}"
        except Exception as e:  # noqa: BLE001
            return f"post_slack_message error: {e!s}"

    return [read_workspace_file, run_python_snippet, send_email_tool, post_slack_message]
