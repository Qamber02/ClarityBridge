from app.analysis import compute_metrics, count_fillers
from app.models import TranscriptSegment


def test_compute_metrics_counts_words_and_fillers() -> None:
    segments = [
        TranscriptSegment(text="Um I think this is clear", start_time=0, end_time=3),
        TranscriptSegment(text="You know, we can slow down", start_time=3, end_time=7),
    ]

    metrics = compute_metrics(segments)

    assert metrics.average_wpm == 102.86
    assert metrics.filler_word_count == 2
    assert metrics.filler_breakdown["um"] == 1
    assert metrics.filler_breakdown["you know"] == 1


def test_count_fillers_uses_word_boundaries() -> None:
    segments = [TranscriptSegment(text="Some summary actually helps, unlike glue.", start_time=0, end_time=4)]

    counts = count_fillers(segments)

    assert counts["um"] == 0
    assert counts["like"] == 0
    assert counts["actually"] == 1
