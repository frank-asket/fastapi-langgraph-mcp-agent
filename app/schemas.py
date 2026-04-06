"""HTTP API request/response models for Study Coach."""

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator


_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class LearnerProfile(BaseModel):
    education_level: str = Field(
        ...,
        description="primary_jhs | shs | university | technical_university | educator_parent | other (tertiary kept for legacy)",
    )
    shs_track: str | None = Field(default=None)
    tertiary_institution: str | None = Field(
        default=None,
        description="Institution name from GTEC merge (assessment).",
    )
    tertiary_programme: str | None = Field(
        default=None,
        description="Accredited programme name (and duration) from assessment.",
    )
    subject_focus: str | None = None
    region: str | None = None
    goals: str | None = Field(default=None, max_length=4000)


class LearningFeedback(BaseModel):
    """Bandit reward for the prior assistant turn (same ``thread_id``)."""

    signal: Literal["helpful", "not_helpful"]


class WorkflowRequest(BaseModel):
    message: str = Field(..., min_length=1)
    thread_id: str | None = None
    learner_profile: LearnerProfile | None = None
    coaching_mode: str | None = Field(
        default="full",
        description="full | hints — hints prefers Socratic nudges over full solutions.",
    )
    agent_lane: str | None = Field(
        default="auto",
        description="auto | general | jhs | shs | tertiary | educator — specialist coach; auto uses learner_profile.",
    )
    learning_feedback: LearningFeedback | None = Field(
        default=None,
        description="Optional bandit reward for the prior assistant message before this turn.",
    )


class WorkflowResponse(BaseModel):
    reply: str
    thread_id: str
    agent_lane: str = Field(description="Resolved specialist lane for this turn.")
    pedagogy_arm: str | None = Field(
        default=None,
        description="Pedagogy arm chosen by the adaptive bandit when that feature is on (e.g. hints, scaffold).",
    )


class LearningFeedbackRequest(BaseModel):
    thread_id: str = Field(..., min_length=8)
    signal: Literal["helpful", "not_helpful"]


class LearningFeedbackResponse(BaseModel):
    updated: bool = Field(description="Whether a stored arm was found and the bandit counts were updated.")


class HistoryMessage(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    thread_id: str
    messages: list[HistoryMessage]


def _validate_hhmm(v: str) -> str:
    s = (v or "").strip()
    if not _HHMM.match(s):
        raise ValueError("Expected HH:MM (24h)")
    return s


class TimetablePreferencesUpdate(BaseModel):
    timezone: str = Field(default="Africa/Accra", min_length=2, max_length=80)
    notify_email: bool = True
    notify_in_app: bool = True
    study_prep_minutes: int = Field(default=45, ge=5, le=180)
    rest_after_minutes: int = Field(default=15, ge=0, le=120)
    focus_reminder_local: str | None = Field(
        default=None,
        description="Daily focus reminder at local time HH:MM, or null to disable.",
    )
    goals_summary: str | None = Field(default=None, max_length=2000)
    notification_email: str | None = Field(
        default=None,
        description="Optional override; must match where you want SendGrid mail.",
    )
    include_timetable_in_coach: bool = Field(
        default=True,
        description="When True, each /workflow coach turn may include saved weekly timetable context.",
    )

    @field_validator("focus_reminder_local")
    @classmethod
    def focus_time(cls, v: str | None) -> str | None:
        if v is None or not str(v).strip():
            return None
        return _validate_hhmm(str(v).strip())


class TimetablePreferencesOut(BaseModel):
    timezone: str
    notify_email: bool
    notify_in_app: bool
    study_prep_minutes: int
    rest_after_minutes: int
    focus_reminder_local: str | None
    goals_summary: str | None
    notification_email: str | None
    include_timetable_in_coach: bool


class TimetableSlotCreate(BaseModel):
    weekday: int = Field(..., ge=0, le=6, description="0=Monday … 6=Sunday")
    start_time: str = Field(..., min_length=5, max_length=5)
    end_time: str = Field(..., min_length=5, max_length=5)
    title: str = Field(..., min_length=1, max_length=200)
    location: str | None = Field(default=None, max_length=200)

    @field_validator("start_time", "end_time")
    @classmethod
    def times(cls, v: str) -> str:
        return _validate_hhmm(v)


class TimetableSlotOut(BaseModel):
    id: str
    weekday: int
    start_time: str
    end_time: str
    title: str
    location: str | None


class TimetableMeResponse(BaseModel):
    preferences: TimetablePreferencesOut
    slots: list[TimetableSlotOut]


class TimetableInAppNotification(BaseModel):
    id: str
    title: str
    body: str
    kind: str
    created_at: str
    read_at: str | None


class TimetableNotificationsResponse(BaseModel):
    notifications: list[TimetableInAppNotification]


class TimetableImportResponse(BaseModel):
    added: list[TimetableSlotOut]
    message: str


class EmailCoachExportRequest(BaseModel):
    """Send an assistant reply to the learner's saved notification email (SendGrid)."""

    body: str = Field(..., min_length=1, max_length=500_000)
    subject: str | None = Field(default=None, max_length=200)


class EmailCoachExportResponse(BaseModel):
    ok: bool = True
    sent_to: str


class WorkflowThreadMeta(BaseModel):
    thread_id: str
    created_at: str


class WorkflowThreadsResponse(BaseModel):
    threads: list[WorkflowThreadMeta]


class SubscriptionStatusResponse(BaseModel):
    """Clerk subscription gate status for Studio (GET /account/subscription)."""

    enforcement_enabled: bool = Field(description="CLERK_ENFORCE_SUBSCRIPTION")
    clerk_account: bool = Field(description="Request resolved to a Clerk user id (clerk:…).")
    access_allowed: bool = Field(
        description="Whether subscription checks pass (or do not apply). False means workflow/timetable would 403.",
    )
    checks_jwt_claim: bool
    checks_entitlements_database: bool
    jwt_claim_name: str | None = None
    jwt_claim_value: str | None = None
    jwt_in_active_set: bool | None = Field(
        default=None,
        description="True if claim value matches CLERK_SUBSCRIPTION_ACTIVE_VALUES; null if JWT claim not used.",
    )
    database_subscription_status: str | None = None
    database_subscription_plan: str | None = None
    database_updated_at: str | None = None
    database_in_active_set: bool | None = Field(
        default=None,
        description="True if DB status matches active set; null if DB check not used.",
    )
    active_subscription_values: list[str] = Field(
        default_factory=list,
        description="Server-side values treated as active (from CLERK_SUBSCRIPTION_ACTIVE_VALUES).",
    )
    manage_subscription_url: str | None = Field(
        default=None,
        description="Optional SUBSCRIPTION_MANAGE_URL for learners to open billing.",
    )
    detail: str | None = Field(default=None, description="Short explanation for the learner or operator.")
