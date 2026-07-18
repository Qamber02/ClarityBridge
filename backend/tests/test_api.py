import asyncio

from app.main import analyze_buffered_session, ingest_transcript, validate_zoom_webhook_signature
from app.models import AnalyzeBufferedSessionRequest, TranscriptIngestRequest, TranscriptSegment


def test_ingest_and_analyze_buffered_session() -> None:
    ingest_response = ingest_transcript(
        TranscriptIngestRequest(
            meeting_id="meeting-1",
            segment=TranscriptSegment(
                text="Um this answer is clearer when I slow down",
                start_time=0,
                end_time=4,
            ),
        )
    )

    assert ingest_response["segment_count"] == 1

    analyze_response = asyncio.run(
        analyze_buffered_session(
            AnalyzeBufferedSessionRequest(
                meeting_id="meeting-1",
                mode="interview",
            )
        )
    )

    assert analyze_response.mode == "interview"
    assert analyze_response.metrics.filler_word_count == 1


def test_zoom_webhook_signature_is_optional_for_local_development() -> None:
    validate_zoom_webhook_signature(b"{}", timestamp=None, signature=None)
