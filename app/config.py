"""Application settings loaded from environment."""

from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openai_api_key: str | None = None
    openai_model: str = "gpt-4o-mini"
    #: Optional OpenAI-compatible API base (e.g. Azure or a proxy). Official API if unset.
    openai_base_url: str | None = None

    public_base_url: str = Field(default="http://127.0.0.1:8000")
    mcp_http_url: str | None = None

    redis_url: str | None = None

    #: LangGraph checkpoint DB (conversation history per thread_id). Survives server restarts.
    checkpoint_sqlite_path: str = Field(default="data/langgraph_checkpoints.db")

    #: Signed cookie secret (required for sessions). Change in production.
    session_secret: str = Field(default="change-me-use-long-random-secret-for-sessions")

    #: When set, /workflow and /chat API require gate or X-App-Access-Code header.
    app_access_code: str | None = None

    #: If True and auth enabled, learning IDs are bound to the browser session (blocks cross-device resume).
    bind_threads_to_session: bool = Field(default=True)

    #: Thread ownership registry (separate from LangGraph checkpoints).
    thread_registry_db_path: str = Field(default="data/thread_registry.db")

    #: Per-session-or-IP cap on workflow + stream endpoints.
    workflow_requests_per_minute: int = Field(default=40, ge=5, le=300)

    #: Multipart /workflow/upload — max file size (bytes).
    max_upload_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=52_428_800)

    #: Max characters kept from extracted document text (then sent to the model).
    max_attachment_extract_chars: int = Field(default=80_000, ge=2_000, le=500_000)

    @property
    def auth_enabled(self) -> bool:
        return bool(self.app_access_code and str(self.app_access_code).strip())

    @computed_field  # type: ignore[prop-decorator]
    @property
    def resolved_mcp_http_url(self) -> str:
        if self.mcp_http_url:
            return self.mcp_http_url.rstrip("/")
        base = self.public_base_url.rstrip("/")
        return f"{base}/agent/mcp"


@lru_cache
def get_settings() -> Settings:
    return Settings()
