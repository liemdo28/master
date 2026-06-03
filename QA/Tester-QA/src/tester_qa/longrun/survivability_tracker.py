"""Survivability Tracker — scores long-run system resilience."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional
import statistics


@dataclass
class SurvivabilityScore:
    """Long-run survivability score."""
    score: float
    grade: str
    hours_survived: float
    collapse_events: int
    recovery_count: int
    mean_time_to_failure_hours: Optional[float]
    mean_time_to_recovery_seconds: Optional[float]

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "grade": self.grade,
            "hours_survived": self.hours_survived,
            "collapse_events": self.collapse_events,
            "recovery_count": self.recovery_count,
            "mean_time_to_failure_hours": self.mean_time_to_failure_hours,
            "mean_time_to_recovery_seconds": self.mean_time_to_recovery_seconds,
        }


class SurvivabilityTracker:
    """Records collapse/recovery events and calculates a survivability score."""

    def __init__(self):
        self.started_at = datetime.now(timezone.utc)
        self.collapse_events: list[dict[str, Any]] = []
        self.recovery_events: list[dict[str, Any]] = []

    def record_collapse(self, reason, metrics) -> None:
        """Record a collapse event."""
        self.collapse_events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": str(reason),
            "metrics": dict(metrics or {}),
        })

    def record_recovery(self, duration_seconds) -> None:
        """Record a successful recovery and its duration in seconds."""
        self.recovery_events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_seconds": float(duration_seconds),
        })

    def _hours_survived(self) -> float:
        return (datetime.now(timezone.utc) - self.started_at).total_seconds() / 3600.0

    def _mttf(self) -> Optional[float]:
        if not self.collapse_events:
            return None
        times = []
        previous = self.started_at
        for event in self.collapse_events:
            ts = datetime.fromisoformat(event["timestamp"])
            times.append((ts - previous).total_seconds() / 3600.0)
            previous = ts
        return statistics.mean(times) if times else None

    def _mttr(self) -> Optional[float]:
        if not self.recovery_events:
            return None
        return statistics.mean([e["duration_seconds"] for e in self.recovery_events])

    def _grade(self, score: float) -> str:
        if score >= 90:
            return "A"
        if score >= 80:
            return "B"
        if score >= 70:
            return "C"
        if score >= 60:
            return "D"
        return "F"

    def calculate_score(self) -> SurvivabilityScore:
        """Weighted score based on MTTF, MTTR, collapse frequency, and recovery rate."""
        hours = self._hours_survived()
        collapse_count = len(self.collapse_events)
        recovery_count = len(self.recovery_events)
        mttf = self._mttf()
        mttr = self._mttr()

        collapse_rate = collapse_count / max(hours, 0.001)
        recovery_rate = recovery_count / collapse_count if collapse_count else 1.0

        # Higher MTTF and lower collapse rate help; high MTTR hurts.
        mttf_score = 100.0 if mttf is None else min(100.0, (mttf / 8.0) * 100.0)
        mttr_score = 100.0 if mttr is None else max(0.0, 100.0 - min(100.0, (mttr / 300.0) * 100.0))
        frequency_score = max(0.0, 100.0 - collapse_rate * 50.0)
        recovery_score = min(100.0, recovery_rate * 100.0)

        score = (
            mttf_score * 0.35
            + mttr_score * 0.20
            + frequency_score * 0.30
            + recovery_score * 0.15
        )
        score = round(max(0.0, min(100.0, score)), 2)

        return SurvivabilityScore(
            score=score,
            grade=self._grade(score),
            hours_survived=round(hours, 4),
            collapse_events=collapse_count,
            recovery_count=recovery_count,
            mean_time_to_failure_hours=mttf,
            mean_time_to_recovery_seconds=mttr,
        )

    def get_report(self) -> dict:
        """Return survivability report."""
        score = self.calculate_score()
        return {
            "started_at": self.started_at.isoformat(),
            "score": score.to_dict(),
            "collapse_events": self.collapse_events,
            "recovery_events": self.recovery_events,
        }
