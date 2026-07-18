import hashlib
import hmac
from typing import Any
from uuid import UUID, uuid4

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.analysis import compute_metrics, generate_heuristic_report
from app.config import get_settings
from app.models import AnalyzeBufferedSessionRequest, AnalyzeSessionRequest, AnalyzeSessionResponse, TranscriptIngestRequest, TranscriptSegment
from app.storage import persist_report

settings = get_settings()

app = FastAPI(title="ClarityBridge API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

REPORTS: dict[UUID, AnalyzeSessionResponse] = {}
TRANSCRIPT_BUFFERS: dict[str, list[TranscriptSegment]] = {}
RTMS_EVENTS: list[dict[str, Any]] = []


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/analyze-session", response_model=AnalyzeSessionResponse)
async def analyze_session(payload: AnalyzeSessionRequest) -> AnalyzeSessionResponse:
    metrics = compute_metrics(payload.transcript_segments, payload.filler_word_count)
    report = generate_heuristic_report(metrics, payload.mode)
    response = AnalyzeSessionResponse(
        session_id=uuid4(),
        mode=payload.mode,
        metrics=metrics,
        report=report,
    )
    REPORTS[response.session_id] = response

    try:
        await persist_report(settings, response)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Report generated but persistence failed: {exc}") from exc

    return response


@app.post("/ingest-transcript")
def ingest_transcript(payload: TranscriptIngestRequest) -> dict[str, int | str]:
    buffer = TRANSCRIPT_BUFFERS.setdefault(payload.meeting_id, [])
    buffer.append(payload.segment)
    return {"meeting_id": payload.meeting_id, "segment_count": len(buffer)}


@app.post("/analyze-buffered-session", response_model=AnalyzeSessionResponse)
async def analyze_buffered_session(payload: AnalyzeBufferedSessionRequest) -> AnalyzeSessionResponse:
    segments = TRANSCRIPT_BUFFERS.get(payload.meeting_id, [])
    if not segments:
        raise HTTPException(status_code=404, detail="No transcript segments buffered for this meeting")

    return await analyze_session(
        AnalyzeSessionRequest(
            transcript_segments=segments,
            filler_word_count=payload.filler_word_count,
            mode=payload.mode,
        )
    )


def validate_zoom_webhook_signature(raw_body: bytes, timestamp: str | None, signature: str | None) -> None:
    if not settings.zoom_webhook_secret_token:
        return
    if not timestamp or not signature:
        raise HTTPException(status_code=401, detail="Missing Zoom webhook signature headers")

    message = f"v0:{timestamp}:{raw_body.decode()}".encode()
    digest = hmac.new(settings.zoom_webhook_secret_token.encode(), message, hashlib.sha256).hexdigest()
    expected = f"v0={digest}"
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="Invalid Zoom webhook signature")


@app.post("/zoom/rtms/events")
async def zoom_rtms_events(
    request: Request,
    x_zm_request_timestamp: str | None = Header(default=None),
    x_zm_signature: str | None = Header(default=None),
) -> dict[str, Any]:
    raw_body = await request.body()
    validate_zoom_webhook_signature(raw_body, x_zm_request_timestamp, x_zm_signature)
    payload = await request.json()

    if payload.get("event") == "endpoint.url_validation":
        plain_token = payload["payload"]["plainToken"]
        encrypted_token = hmac.new(
            (settings.zoom_webhook_secret_token or "").encode(),
            plain_token.encode(),
            hashlib.sha256,
        ).hexdigest()
        return {"plainToken": plain_token, "encryptedToken": encrypted_token}

    RTMS_EVENTS.append(payload)
    return {"status": "received", "event_count": len(RTMS_EVENTS)}


@app.get("/sessions", response_model=list[AnalyzeSessionResponse])
def list_sessions() -> list[AnalyzeSessionResponse]:
    return list(REPORTS.values())


@app.get("/sessions/{session_id}", response_model=AnalyzeSessionResponse)
def get_session(session_id: UUID) -> AnalyzeSessionResponse:
    report = REPORTS.get(session_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return report
