"""Subscription evaluation (Clerk JWT + optional entitlements DB) for API enforcement and Studio status UI."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.clerk_entitlements import get_entitlement
from app.config import Settings
from app.schemas import SubscriptionStatusResponse

logger = logging.getLogger(__name__)


def _active_values(settings: Settings) -> set[str]:
    return {x.strip() for x in settings.clerk_subscription_active_values.split(",") if x.strip()}


def evaluate_enforced_clerk_subscription(
    settings: Settings,
    owner_id: str,
    claims: dict[str, Any],
) -> tuple[bool, str | None]:
    """Return (access_ok, http_detail_if_denied). Only for Clerk users when enforcement is on."""
    allowed = _active_values(settings)
    claim_name = (settings.clerk_subscription_jwt_claim or "").strip()
    use_jwt = bool(claim_name)
    use_db = settings.clerk_enforce_entitlements_db
    if not use_jwt and not use_db:
        logger.warning(
            "CLERK_ENFORCE_SUBSCRIPTION is enabled but neither CLERK_SUBSCRIPTION_JWT_CLAIM "
            "nor CLERK_ENFORCE_ENTITLEMENTS_DB is set — skipping subscription check.",
        )
        return True, None

    jwt_ok = True
    if use_jwt:
        val = claims.get(claim_name)
        jwt_ok = str(val) in allowed if val is not None else False

    db_ok = True
    if use_db:
        uid = owner_id.removeprefix("clerk:")
        row = get_entitlement(Path(settings.clerk_entitlements_db_path).expanduser().resolve(), uid)
        st = (row or {}).get("subscription_status")
        db_ok = str(st) in allowed if st is not None else False

    if use_jwt and use_db:
        if jwt_ok and db_ok:
            return True, None
        return False, "An active subscription is required (JWT claim and account record)."
    if use_jwt and not jwt_ok:
        return False, "An active subscription is required."
    if use_db and not db_ok:
        return False, "An active subscription is required — sync billing with Clerk webhooks."
    return True, None


def subscription_status_response(
    settings: Settings,
    owner_id: str | None,
    claims: dict[str, Any],
) -> SubscriptionStatusResponse:
    """Non-secret snapshot for GET /account/subscription (mirrors ``ensure_clerk_subscription``)."""
    allowed = _active_values(settings)
    claim_name = (settings.clerk_subscription_jwt_claim or "").strip()
    use_jwt = bool(claim_name)
    use_db = settings.clerk_enforce_entitlements_db
    enforcement = settings.clerk_enforce_subscription
    clerk_account = bool(owner_id and owner_id.startswith("clerk:"))
    manage_url = (settings.subscription_manage_url or "").strip() or None

    jwt_val: Any = claims.get(claim_name) if use_jwt else None
    jwt_in: bool | None = None
    if use_jwt:
        jwt_in = str(jwt_val) in allowed if jwt_val is not None else False

    db_status: str | None = None
    db_plan: str | None = None
    db_updated: str | None = None
    db_in: bool | None = None
    if use_db and clerk_account and owner_id:
        uid = owner_id.removeprefix("clerk:")
        row = get_entitlement(Path(settings.clerk_entitlements_db_path).expanduser().resolve(), uid)
        if row:
            db_status = row.get("subscription_status")
            db_plan = row.get("subscription_plan")
            db_updated = str(row.get("updated_at") or "") or None
            db_in = str(db_status) in allowed if db_status is not None else False

    access_allowed = True
    detail: str | None = None

    if not enforcement:
        detail = (
            "This deployment is not requiring a paid subscription."
            if clerk_account
            else "Subscription status applies when you use a Clerk account."
        )
    elif not clerk_account:
        detail = "Subscription rules apply to signed-in Clerk users; your session uses a different sign-in path."
    elif not use_jwt and not use_db:
        detail = (
            "Subscription enforcement is on but the server is missing CLERK_SUBSCRIPTION_JWT_CLAIM "
            "and CLERK_ENFORCE_ENTITLEMENTS_DB — ask the operator to configure one or both."
        )
    else:
        ok, deny_detail = evaluate_enforced_clerk_subscription(settings, owner_id or "", claims)
        access_allowed = ok
        if not ok:
            detail = deny_detail

    return SubscriptionStatusResponse(
        enforcement_enabled=enforcement,
        clerk_account=clerk_account,
        access_allowed=access_allowed,
        checks_jwt_claim=use_jwt,
        checks_entitlements_database=use_db,
        jwt_claim_name=claim_name or None,
        jwt_claim_value=str(jwt_val) if jwt_val is not None else None,
        jwt_in_active_set=jwt_in,
        database_subscription_status=db_status,
        database_subscription_plan=db_plan,
        database_updated_at=db_updated,
        database_in_active_set=db_in,
        active_subscription_values=sorted(allowed),
        manage_subscription_url=manage_url,
        detail=detail,
    )
