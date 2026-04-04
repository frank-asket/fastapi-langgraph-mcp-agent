"""Mounted FastMCP HTTP app (tools / prompts)."""

from app.config import get_settings
from app.mcp_server.server import build_event_store, mcp

_settings = get_settings()
event_store = build_event_store(_settings.redis_url)
mcp_app = mcp.http_app(path="/mcp", event_store=event_store)
