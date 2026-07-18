from uuid import UUID, uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.analysis import compute_metrics, generate_heuristic_report
from app.config import get_settings
from app.models import AnalyzeSessionRequest, AnalyzeSessionResponse
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


@app.get("/sessions", response_model=list[AnalyzeSessionResponse])
def list_sessions() -> list[AnalyzeSessionResponse]:
    return list(REPORTS.values())


@app.get("/sessions/{session_id}", response_model=AnalyzeSessionResponse)
def get_session(session_id: UUID) -> AnalyzeSessionResponse:
    report = REPORTS.get(session_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return report
