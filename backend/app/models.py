from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CoachingMode(StrEnum):
    general = "general"
    interview = "interview"
    sales = "sales"


class TranscriptSegment(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    start_time: float = Field(ge=0)
    end_time: float = Field(ge=0)
    speaker: str | None = Field(default=None, max_length=120)

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, value: float, info: Any) -> float:
        start_time = info.data.get("start_time")
        if start_time is not None and value < start_time:
            raise ValueError("end_time must be greater than or equal to start_time")
        return value


class AnalyzeSessionRequest(BaseModel):
    transcript_segments: list[TranscriptSegment] = Field(min_length=1)
    filler_word_count: int | None = Field(default=None, ge=0)
    mode: CoachingMode = CoachingMode.general
    user_id: str | None = Field(default=None, max_length=128)


class TranscriptIngestRequest(BaseModel):
    meeting_id: str = Field(min_length=1, max_length=256)
    segment: TranscriptSegment
    rtms_session_id: str | None = Field(default=None, max_length=256)


class AnalyzeBufferedSessionRequest(BaseModel):
    meeting_id: str = Field(min_length=1, max_length=256)
    mode: CoachingMode = CoachingMode.general
    filler_word_count: int | None = Field(default=None, ge=0)


class WpmPoint(BaseModel):
    time: float
    wpm: float


class SessionMetrics(BaseModel):
    average_wpm: float
    pace_variance: float
    filler_word_count: int
    filler_breakdown: dict[str, int]
    wpm_series: list[WpmPoint]


class AnalysisReport(BaseModel):
    clarity_score: int = Field(ge=0, le=100)
    pace_summary: str
    stress_pause_suggestions: list[str]
    filler_word_feedback: str
    mode_specific_tip: str


class AnalyzeSessionResponse(BaseModel):
    session_id: UUID
    mode: CoachingMode
    metrics: SessionMetrics
    report: AnalysisReport
