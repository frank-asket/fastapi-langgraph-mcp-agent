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

    #: LangGraph checkpoints: ``sqlite`` (durable) or ``memory`` (MemorySaver; lost on process restart).
    checkpoint_backend: str = Field(default="sqlite")
    #: LangGraph checkpoint DB when ``checkpoint_backend=sqlite`` (conversation history per thread_id).
    checkpoint_sqlite_path: str = Field(default="data/langgraph_checkpoints.db")

    #: Signed cookie secret (required for sessions). Change in production.
    session_secret: str = Field(default="change-me-use-long-random-secret-for-sessions")
    #: If True, session cookie is only sent over HTTPS (set in production behind TLS).
    session_cookie_secure: bool = Field(default=False)

    #: When set, /workflow and /chat API require gate or X-App-Access-Code header.
    app_access_code: str | None = None

    #: Comma-separated API keys; valid X-API-Key or Authorization: Bearer <key> satisfies auth when enabled.
    api_keys: str = Field(default="")

    #: If True and auth enabled, learning IDs are bound to the browser session (blocks cross-device resume).
    bind_threads_to_session: bool = Field(default=True)

    #: Thread ownership registry (separate from LangGraph checkpoints).
    thread_registry_db_path: str = Field(default="data/thread_registry.db")

    #: Per-session-or-IP cap on workflow + stream endpoints.
    workflow_requests_per_minute: int = Field(default=40, ge=5, le=300)
    #: When True, inject the learner's saved weekly timetable (and workload hints) into each /workflow turn.
    workflow_timetable_context_enabled: bool = Field(default=True)
    #: When True, wrap the MCP ReAct coach in a supervisor graph (user-risk scan → safety reply or coach).
    workflow_supervisor_enabled: bool = Field(default=True)
    #: When True (and supervisor on), an orchestrator routes each safe turn to researcher / writer / reviewer / coach ReAct subgraphs.
    workflow_team_router_enabled: bool = Field(default=False)
    #: Contextual bandit (Thompson) over pedagogy arms; persists in adaptive_learning_db_path.
    adaptive_learning_enabled: bool = Field(default=True)
    adaptive_learning_db_path: str = Field(default="data/adaptive_learning.db")
    #: Hourly cap per client (Bearer/session/IP) on POST /workflow/email-export.
    coach_email_exports_per_hour: int = Field(default=8, ge=1, le=120)
    #: Max characters for emailed coach message body (after strip).
    coach_email_export_max_body_chars: int = Field(default=100_000, ge=2_000, le=500_000)

    #: POST /gate/session attempts per client IP (limits brute-force against the access code).
    gate_posts_per_minute: int = Field(default=25, ge=5, le=120)

    #: Optional default cap for routes that declare no limit. 0 = disabled (recommended: use per-route limits).
    global_requests_per_minute: int = Field(default=0, ge=0, le=5000)

    #: Optional shared backend for slowapi (e.g. redis://localhost:6379/1). Omit for in-process memory.
    rate_limit_storage_uri: str | None = None

    #: Write X-RateLimit-* response headers when limits apply.
    rate_limit_headers_enabled: bool = Field(default=True)

    #: Comma-separated allowed browser origins for CORS (e.g. https://app.example.com).
    #: Default includes local Next.js dev (localhost + 127.0.0.1 on port 3000). Set explicitly in production.
    #: Use an empty value in .env only if you want no CORS middleware (same-origin / server-side calls only).
    cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
    )

    #: Allow cookies (SessionMiddleware) in cross-origin requests. Requires explicit origins (not *).
    cors_allow_credentials: bool = Field(default=True)

    #: Comma-separated methods for CORS preflight (default covers typical API + SSE).
    cors_allow_methods: str = Field(default="GET,POST,PUT,PATCH,DELETE,OPTIONS")

    #: * or comma-separated request header names the browser may send.
    cors_allow_headers: str = Field(default="*")

    #: Comma-separated response header names the browser JS may read (e.g. X-RateLimit-Remaining).
    cors_expose_headers: str = Field(
        default="X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset,Retry-After",
    )

    #: Multipart /workflow/upload — max file size (bytes).
    max_upload_bytes: int = Field(default=8 * 1024 * 1024, ge=1024, le=52_428_800)

    #: Max characters kept from extracted document text (then sent to the model).
    max_attachment_extract_chars: int = Field(default=80_000, ge=2_000, le=500_000)

    #: Attach LangChain ``@tool`` builtins alongside MCP tools (workspace file read, optional code runner, email, Slack).
    builtin_tools_enabled: bool = Field(default=True)
    #: Directory for ``read_workspace_file`` (relative paths only; must stay under this root after resolve).
    builtin_tools_workspace_path: str = Field(default="data/agent_workspace")
    builtin_max_file_read_bytes: int = Field(default=524_288, ge=1024, le=8_388_608)
    #: Dangerous: runs ``python -c`` on the server. Keep off in production unless sandboxed.
    builtin_code_runner_enabled: bool = Field(default=False)
    builtin_code_runner_timeout_s: int = Field(default=5, ge=1, le=30)
    #: Slack incoming webhook URL for ``post_slack_message`` tool (optional).
    slack_incoming_webhook_url: str | None = None

    # --- Trust & safety (truthfulness guardrails; not a substitute for fact-checking APIs) ---
    #: Append strong anti-hallucination instructions after the MCP coach system prompt.
    trust_safety_system_enforcement: bool = Field(default=True)
    #: Append a short verification reminder to each /workflow assistant reply (and stream).
    trust_safety_reply_footer: bool = Field(default=True)
    #: Override footer markdown/plain text; empty uses built-in English disclaimer.
    trust_safety_reply_footer_text: str | None = None
    #: If True, log INFO when replies match heuristic patterns (fees/cut-offs)—audit only, no blocking.
    trust_safety_log_risk_signals: bool = Field(default=False)

    # --- Clerk (optional): session JWT + webhooks + subscription enforcement ---
    #: Clerk Frontend API URL (JWT "iss"), e.g. https://your-instance.clerk.accounts.dev
    clerk_jwt_issuer: str | None = None
    #: Override JWKS URL (default: {issuer}/.well-known/jwks.json). See Clerk manual JWT docs.
    clerk_jwks_url: str | None = None
    #: If set, JWT audience is verified; otherwise aud check is skipped.
    clerk_jwt_audience: str | None = None
    #: Comma-separated origins allowed in the session token `azp` claim (recommended for CSRF safety).
    clerk_authorized_parties: str = Field(default="")
    #: Reject tokens with sts=pending when using Clerk Organizations without personal accounts.
    clerk_reject_org_pending_status: bool = Field(default=False)
    #: Svix signing secret from Clerk dashboard (starts with whsec_) for POST /webhooks/clerk.
    clerk_webhook_secret: str | None = None
    #: Send a welcome / onboarding email (SendGrid) on Clerk user.created when SENDGRID_API_KEY is set.
    clerk_send_welcome_email: bool = Field(default=True)
    #: SQLite backing store updated from Clerk webhooks (user.updated, etc.).
    clerk_entitlements_db_path: str = Field(default="data/clerk_entitlements.db")
    #: If True, workflow routes require subscription for Clerk users (see JWT claim and/or DB below).
    clerk_enforce_subscription: bool = Field(default=False)
    #: JWT claim name (add via Clerk session token template), e.g. subscription_status mapped from metadata.
    clerk_subscription_jwt_claim: str = Field(default="")
    #: Comma-separated values treated as "active" for subscription checks.
    clerk_subscription_active_values: str = Field(default="active,trialing")
    #: If True, subscription must also match a row in clerk_entitlements (populated by webhooks).
    clerk_enforce_entitlements_db: bool = Field(default=False)
    #: Optional URL (Stripe portal, Clerk Billing, etc.) returned on GET /account/subscription for the Studio UI.
    subscription_manage_url: str | None = None
    #: Browser publishable key (pk_…) for embedded Clerk on the Next.js app.
    clerk_publishable_key: str | None = None

    #: Timetable + nudges (SQLite). Notifications run in-process (minute ticker).
    timetable_db_path: str = Field(default="data/timetable.db")
    timetable_notifications_enabled: bool = Field(default=True)

    #: SendGrid for timetable / coach nudges (optional; in-app still works without).
    sendgrid_api_key: str | None = None
    sendgrid_from_email: str = Field(default="noreply@klingbo.com")
    sendgrid_from_name: str = Field(default="Klingbo Study Coach")
    #: Override default repo path for email inline logo (PNG).
    timetable_brand_logo_path: str | None = None
    #: Internal reference PNG for timetable import only (not shown in UI); helps the model align to a week grid.
    timetable_reference_layout_path: str | None = None
    #: When True and OPENAI_API_KEY is set, prep/rest/daily-focus nudges use the model to analyse the saved timetable.
    timetable_notify_ai_enabled: bool = Field(default=True)
    #: Optional model override for timetable nudges (defaults to OPENAI_MODEL).
    timetable_notify_ai_model: str | None = None

    #: Next.js UI base URL (no trailing slash). When set, GET /, /assessment, /chat redirect here;
    #: POST /gate/session redirects successful logins to this host (e.g. http://127.0.0.1:3000).
    study_coach_frontend_url: str | None = None
    #: If True, only Clerk session JWTs authorize workflow routes (no API keys, access code, or gate session).
    clerk_only_auth: bool = Field(default=False)

    @property
    def api_key_list(self) -> tuple[str, ...]:
        raw = (self.api_keys or "").strip()
        if not raw:
            return ()
        return tuple(x.strip() for x in raw.split(",") if x.strip())

    @property
    def cors_origin_list(self) -> list[str]:
        """Origins allowed for browser CORS.

        If ``cors_origins`` is empty (e.g. ``CORS_ORIGINS=`` in env), returns ``[]`` so main.py skips
        CORSMiddleware entirely—same as documented “disable CORS” behaviour. ``study_coach_frontend_url`` is
        **not** appended in that case.

        When ``cors_origins`` is non-empty, parses the comma-separated list and merges ``study_coach_frontend_url``
        (if set) so the canonical UI origin is allowed without duplicating it in ``CORS_ORIGINS``.
        """
        raw = (self.cors_origins or "").strip()
        if not raw:
            return []

        out: list[str] = []
        seen_lower: set[str] = set()

        def add(origin: str) -> None:
            o = origin.strip()
            if not o:
                return
            k = o.lower()
            if k in seen_lower:
                return
            seen_lower.add(k)
            out.append(o)

        for part in raw.split(","):
            add(part)
        front = self.study_coach_frontend_base
        if front:
            add(front)
        return out

    @property
    def clerk_jwt_configured(self) -> bool:
        return bool((self.clerk_jwks_url or "").strip() or (self.clerk_jwt_issuer or "").strip())

    @property
    def clerk_authorized_parties_set(self) -> set[str]:
        return {x.strip() for x in self.clerk_authorized_parties.split(",") if x.strip()}

    @property
    def auth_enabled(self) -> bool:
        if self.clerk_only_auth:
            return self.clerk_jwt_configured
        if self.clerk_jwt_configured:
            return True
        if self.api_key_list:
            return True
        return bool(self.app_access_code and str(self.app_access_code).strip())

    @property
    def study_coach_frontend_base(self) -> str | None:
        raw = (self.study_coach_frontend_url or "").strip()
        return raw.rstrip("/") if raw else None

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
