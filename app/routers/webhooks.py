"""External webhooks (Clerk via Svix)."""

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request

from app.clerk_entitlements import apply_clerk_event
from app.config import get_settings
from app.limiting import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/webhooks/clerk", include_in_schema=False)
@limiter.exempt
async def clerk_webhook_handler(request: Request) -> dict[str, str]:
    """Ingest Clerk webhooks (Svix). Configure CLERK_WEBHOOK_SECRET and point Clerk to this URL."""
    settings = get_settings()
    secret = (settings.clerk_webhook_secret or "").strip()
    if not secret:
        raise HTTPException(status_code=404, detail="Not found")
    body = await request.body()
    headers = {
        "svix-id": request.headers.get("svix-id", ""),
        "svix-timestamp": request.headers.get("svix-timestamp", ""),
        "svix-signature": request.headers.get("svix-signature", ""),
    }
    try:
        from svix.webhooks import Webhook, WebhookVerificationError

        wh = Webhook(secret)
        payload = wh.verify(body, headers)
    except WebhookVerificationError as e:
        logger.warning("Clerk webhook signature invalid: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook signature") from e
    except Exception as e:  # noqa: BLE001
        logger.warning("Clerk webhook verify failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook") from e
    data: dict[str, Any] = payload if isinstance(payload, dict) else json.loads(payload)  # type: ignore[arg-type]
    apply_clerk_event(data)
    return {"ok": "true"}
