from typing import Any

import httpx

from app.config import Settings
from app.models import AnalyzeSessionResponse


async def persist_report(settings: Settings, report: AnalyzeSessionResponse) -> None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return

    url = f"{str(settings.supabase_url).rstrip('/')}/rest/v1/sessions"
    headers = {
        "apikey": settings.supabase_service_role_key,
        "authorization": f"Bearer {settings.supabase_service_role_key}",
        "content-type": "application/json",
        "prefer": "return=minimal",
    }
    payload: dict[str, Any] = {
        "id": str(report.session_id),
        "mode": report.mode.value,
        "metrics": report.metrics.model_dump(),
        "report": report.report.model_dump(),
    }

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
