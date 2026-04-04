"""HTTP API request/response models for Study Coach."""

from pydantic import BaseModel, Field


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


class WorkflowResponse(BaseModel):
    reply: str
    thread_id: str
    agent_lane: str = Field(description="Resolved specialist lane for this turn.")


class HistoryMessage(BaseModel):
    role: str
    content: str


class HistoryResponse(BaseModel):
    thread_id: str
    messages: list[HistoryMessage]
