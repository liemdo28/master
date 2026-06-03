"""Timeline reconstruction for browser warfare events."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

# Valid event types
VALID_EVENT_TYPES = {
    "warfare_start",
    "memory_bomb",
    "hydration_break",
    "render_flood",
    "websocket_flood",
    "async_deadlock",
    "navigation_loop",
    "collapse",
    "recovery",
    "cleanup",
    "snapshot",
}

# Valid phases
VALID_PHASES = {"before", "during", "after", "recovery"}


@dataclass
class TimelineEvent:
    timestamp: str
    event_type: str
    phase: str
    data: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "event_type": self.event_type,
            "phase": self.phase,
            "data": self.data,
        }


class WarfareTimeline:
    """Builds a chronological timeline of warfare events for forensic analysis."""

    def __init__(self, session_id: str) -> None:
        self.session_id = session_id
        self._events: list[TimelineEvent] = []

    def add_event(
        self,
        event_type: str,
        phase: str,
        data: dict[str, Any] | None = None,
        timestamp: str | None = None,
    ) -> TimelineEvent:
        """Record a new event in the timeline.

        Args:
            event_type: Type of event (e.g. 'memory_bomb', 'collapse').
            phase: Phase label ('before' | 'during' | 'after' | 'recovery').
            data: Optional payload dict.
            timestamp: Optional ISO timestamp; defaults to now in UTC.

        Returns:
            The created TimelineEvent.
        """
        event = TimelineEvent(
            timestamp=timestamp or datetime.now(timezone.utc).isoformat(),
            event_type=event_type,
            phase=phase,
            data=data or {},
        )
        self._events.append(event)
        return event

    def add_snapshot(self, label: str, metrics: dict[str, Any]) -> TimelineEvent:
        """Convenience method to add a metrics snapshot event."""
        return self.add_event(
            event_type="snapshot",
            phase="during",
            data={"label": label, "metrics": metrics},
        )

    def add_collapse_event(self, collapse_type: str, evidence: dict[str, Any]) -> TimelineEvent:
        """Convenience method to record a collapse event."""
        return self.add_event(
            event_type="collapse",
            phase="during",
            data={"collapse_type": collapse_type, "evidence": evidence},
        )

    def add_recovery_event(self, recovery_score: float, details: dict[str, Any]) -> TimelineEvent:
        """Convenience method to record a recovery event."""
        return self.add_event(
            event_type="recovery",
            phase="recovery",
            data={"recovery_score": recovery_score, **details},
        )

    def build(self) -> list[dict[str, Any]]:
        """Return full timeline as a list of serializable dicts."""
        return [e.to_dict() for e in self._events]

    def get_events(self) -> list[TimelineEvent]:
        """Return the raw list of TimelineEvent objects."""
        return list(self._events)

    def detect_collapse_point(self) -> dict[str, Any] | None:
        """Detect when and why collapse occurred in the timeline.

        Collapse is identified by:
        - A 'collapse' event directly in the timeline, OR
        - A 'snapshot' event where memory/execution metrics went critical.

        Returns:
            Dict with collapse point info, or None if no collapse detected.
        """
        # First, look for an explicit collapse event
        for event in self._events:
            if event.event_type == "collapse":
                return {
                    "detected_via": "explicit_event",
                    "event_index": self._events.index(event),
                    "timestamp": event.timestamp,
                    "data": event.data,
                }

        # Fallback: look for snapshots where metrics indicate critical state
        for i, event in enumerate(self._events):
            if event.event_type == "snapshot" and event.data.get("metrics"):
                metrics = event.data["metrics"]
                critical = self._is_critical_metrics(metrics)
                if critical:
                    return {
                        "detected_via": "metrics_threshold",
                        "event_index": i,
                        "timestamp": event.timestamp,
                        "data": event.data,
                        "critical_metrics": critical,
                    }

        return None

    def get_timeline_duration_ms(self) -> float:
        """Return total timeline duration in milliseconds."""
        if len(self._events) < 2:
            return 0.0
        first = self._events[0].timestamp
        last = self._events[-1].timestamp
        try:
            t0 = datetime.fromisoformat(first.replace("Z", "+00:00"))
            t1 = datetime.fromisoformat(last.replace("Z", "+00:00"))
            return (t1 - t0).total_seconds() * 1000
        except Exception:
            return 0.0

    def summarize(self) -> dict[str, Any]:
        """Return a high-level summary of the timeline."""
        event_counts: dict[str, int] = {}
        phase_counts: dict[str, int] = {}
        for e in self._events:
            event_counts[e.event_type] = event_counts.get(e.event_type, 0) + 1
            phase_counts[e.phase] = phase_counts.get(e.phase, 0) + 1

        return {
            "session_id": self.session_id,
            "total_events": len(self._events),
            "duration_ms": round(self.get_timeline_duration_ms(), 2),
            "event_type_counts": event_counts,
            "phase_counts": phase_counts,
            "collapse_detected": self.detect_collapse_point() is not None,
        }

    # ─── Private helpers ─────────────────────────────────────────────────────

    @staticmethod
    def _is_critical_metrics(metrics: dict[str, Any]) -> dict[str, bool] | None:
        """Check if metrics indicate a critical collapse state."""
        critical: dict[str, bool] = {}

        # Memory check
        if "usedJSHeapSize" in metrics and "jsHeapSizeLimit" in metrics:
            limit = max(metrics["jsHeapSizeLimit"], 1)
            mem_ratio = metrics["usedJSHeapSize"] / limit
            critical["memory_critical"] = mem_ratio > 0.90

        # DOM node check
        if "total_nodes" in metrics:
            critical["dom_excessive"] = metrics["total_nodes"] > 10_000

        # Error count check
        if "console_errors" in metrics:
            critical["error_flood"] = metrics["console_errors"] > 50

        if "failed_requests" in metrics:
            critical["network_collapse"] = metrics["failed_requests"] > 20

        # Return None if no critical signals, else the critical dict
        return critical if any(critical.values()) else None
