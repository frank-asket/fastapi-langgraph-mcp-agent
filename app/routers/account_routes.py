"""Account introspection (subscription status for Studio)."""

from __future__ import annotations

from fastapi import APIRouter, Request

from app.access import verify_app_access
from app.config import get_settings
from app.limiting import dynamic_workflow_limit, limiter
from app.schemas import SubscriptionStatusResponse
from app.subscription_view import subscription_status_response

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/subscription", response_model=SubscriptionStatusResponse)
@limiter.limit(dynamic_workflow_limit)
async def get_subscription_status(request: Request) -> SubscriptionStatusResponse:
    """Return subscription gate status for the authenticated user (Clerk JWT / session / API key)."""
    settings = get_settings()
    owner = verify_app_access(request, settings)
    claims = getattr(request.state, "clerk_claims", None) or {}
    return subscription_status_response(settings, owner, claims)
