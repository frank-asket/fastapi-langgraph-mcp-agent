"""Subscription status helper tests."""

from app.config import Settings
from app.subscription_view import subscription_status_response


def test_enforcement_off_always_allowed() -> None:
    s = Settings(clerk_enforce_subscription=False)
    r = subscription_status_response(s, "clerk:user_1", {"subscription_status": "inactive"})
    assert r.access_allowed is True
    assert r.enforcement_enabled is False


def test_enforcement_on_non_clerk_bypasses() -> None:
    s = Settings(
        clerk_enforce_subscription=True,
        clerk_subscription_jwt_claim="subscription_status",
        clerk_subscription_active_values="active",
    )
    r = subscription_status_response(s, "api:deadbeef", {})
    assert r.clerk_account is False
    assert r.access_allowed is True


def test_enforcement_jwt_inactive_denied() -> None:
    s = Settings(
        clerk_enforce_subscription=True,
        clerk_subscription_jwt_claim="subscription_status",
        clerk_subscription_active_values="active,trialing",
        clerk_enforce_entitlements_db=False,
    )
    r = subscription_status_response(s, "clerk:user_x", {"subscription_status": "canceled"})
    assert r.clerk_account is True
    assert r.access_allowed is False
    assert r.jwt_in_active_set is False


def test_enforcement_jwt_active_allowed() -> None:
    s = Settings(
        clerk_enforce_subscription=True,
        clerk_subscription_jwt_claim="subscription_status",
        clerk_subscription_active_values="active",
        clerk_enforce_entitlements_db=False,
    )
    r = subscription_status_response(s, "clerk:user_x", {"subscription_status": "active"})
    assert r.access_allowed is True
    assert r.jwt_in_active_set is True
