from collections import Counter
from math import sqrt
import re

from app.models import AnalysisReport, CoachingMode, SessionMetrics, TranscriptSegment, WpmPoint

FILLER_PATTERNS: dict[str, re.Pattern[str]] = {
    "um": re.compile(r"\bum+\b", re.IGNORECASE),
    "uh": re.compile(r"\buh+\b", re.IGNORECASE),
    "like": re.compile(r"\blike\b", re.IGNORECASE),
    "you know": re.compile(r"\byou\s+know\b", re.IGNORECASE),
    "so": re.compile(r"\bso\b", re.IGNORECASE),
    "actually": re.compile(r"\bactually\b", re.IGNORECASE),
    "basically": re.compile(r"\bbasically\b", re.IGNORECASE),
}

WORD_RE = re.compile(r"[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?")


def count_words(text: str) -> int:
    return len(WORD_RE.findall(text))


def count_fillers(segments: list[TranscriptSegment]) -> dict[str, int]:
    counts: Counter[str] = Counter()
    for segment in segments:
        for filler, pattern in FILLER_PATTERNS.items():
            counts[filler] += len(pattern.findall(segment.text))
    return dict(counts)


def build_wpm_series(segments: list[TranscriptSegment], window_seconds: float = 10.0) -> list[WpmPoint]:
    points: list[WpmPoint] = []
    for segment in segments:
        window_start = max(0.0, segment.end_time - window_seconds)
        words = sum(
            count_words(item.text)
            for item in segments
            if item.end_time >= window_start and item.end_time <= segment.end_time
        )
        elapsed = max(1.0, segment.end_time - window_start)
        points.append(WpmPoint(time=round(segment.end_time, 2), wpm=round((words / elapsed) * 60, 2)))
    return points


def compute_metrics(
    segments: list[TranscriptSegment],
    submitted_filler_count: int | None = None,
) -> SessionMetrics:
    first_start = min(segment.start_time for segment in segments)
    last_end = max(segment.end_time for segment in segments)
    elapsed_minutes = max((last_end - first_start) / 60, 1 / 60)
    total_words = sum(count_words(segment.text) for segment in segments)
    average_wpm = total_words / elapsed_minutes
    series = build_wpm_series(segments)
    mean_series_wpm = sum(point.wpm for point in series) / len(series)
    variance = sum((point.wpm - mean_series_wpm) ** 2 for point in series) / len(series)
    filler_breakdown = count_fillers(segments)
    computed_filler_count = sum(filler_breakdown.values())

    return SessionMetrics(
        average_wpm=round(average_wpm, 2),
        pace_variance=round(sqrt(variance), 2),
        filler_word_count=submitted_filler_count if submitted_filler_count is not None else computed_filler_count,
        filler_breakdown=filler_breakdown,
        wpm_series=series,
    )


def generate_heuristic_report(metrics: SessionMetrics, mode: CoachingMode) -> AnalysisReport:
    pace_penalty = 0
    if metrics.average_wpm < 90:
        pace_penalty = 8
        pace_summary = "Your pace was slower than typical conversational delivery. Keep pauses intentional, but avoid losing momentum."
    elif metrics.average_wpm <= 165:
        pace_summary = "Your average pace landed in a clear conversational range."
    elif metrics.average_wpm <= 200:
        pace_penalty = 12
        pace_summary = "Your average pace was fast. Add short pauses after important points so listeners can keep up."
    else:
        pace_penalty = 22
        pace_summary = "Your average pace was very fast. Slow down during transitions and after numbers, names, or key claims."

    variance_penalty = min(15, int(metrics.pace_variance / 8))
    filler_penalty = min(18, metrics.filler_word_count * 2)
    clarity_score = max(45, 100 - pace_penalty - variance_penalty - filler_penalty)

    suggestions = [
        "Pause for one beat after your main claim before adding detail.",
        "Use shorter sentences when introducing names, numbers, or technical terms.",
    ]
    if metrics.pace_variance > 35:
        suggestions.append("Practice holding a steadier pace across the middle of each answer.")
    if metrics.filler_word_count > 4:
        suggestions.append("Replace repeated fillers with a silent pause before continuing.")

    mode_tip = {
        CoachingMode.general: "Anchor each explanation with one clear point before expanding.",
        CoachingMode.interview: "Lead answers with the result, then give context and evidence.",
        CoachingMode.sales: "Slow down after customer objections and reflect the concern before responding.",
    }[mode]

    top_fillers = sorted(metrics.filler_breakdown.items(), key=lambda item: item[1], reverse=True)
    frequent = [f"{word} ({count})" for word, count in top_fillers if count > 0][:3]
    filler_feedback = (
        f"Most repeated fillers: {', '.join(frequent)}."
        if frequent
        else "No major filler-word pattern was detected."
    )

    return AnalysisReport(
        clarity_score=clarity_score,
        pace_summary=pace_summary,
        stress_pause_suggestions=suggestions,
        filler_word_feedback=filler_feedback,
        mode_specific_tip=mode_tip,
    )
