"""Event Timeline Module - Builds failure timelines for forensic analysis."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional


class TimelineEventType(Enum):
    """Types of events in a timeline."""
    NORMAL = "normal"
    WARNING = "warning"
    ERROR = "error"
    FAILURE = "failure"
    RECOVERY = "recovery"
    CASCADE = "cascade"
    TRIGGER = "trigger"
    DEGRADATION = "degradation"


@dataclass
class TimelineEvent:
    """A single event in a failure timeline."""
    timestamp: datetime
    event_type: TimelineEventType
    source: str
    description: str
    data: Dict[str, Any] = field(default_factory=dict)
    severity: int = 0
    event_id: Optional[str] = None
    parent_event_id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    is_cascade_point: bool = False

    def to_dict(self) -> Dict[str, Any]:
        """Export event as dictionary."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "event_type": self.event_type.value,
            "source": self.source,
            "description": self.description,
            "data": self.data,
            "severity": self.severity,
            "parent_event_id": self.parent_event_id,
            "tags": self.tags,
            "is_cascade_point": self.is_cascade_point,
        }


@dataclass
class Timeline:
    """Complete failure timeline."""
    timeline_id: str
    events: List[TimelineEvent]
    start_time: datetime
    end_time: datetime
    cascade_point: Optional[TimelineEvent] = None
    summary: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Export timeline as dictionary."""
        return {
            "timeline_id": self.timeline_id,
            "events": [e.to_dict() for e in self.events],
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "cascade_point": self.cascade_point.to_dict() if self.cascade_point else None,
            "summary": self.summary,
            "metadata": self.metadata,
        }


class EventTimeline:
    """Builds and analyzes failure timelines."""

    def __init__(self) -> None:
        self._events: List[TimelineEvent] = []
        self._event_counter: int = 0

    def add_event(
        self,
        timestamp: datetime,
        event_type: TimelineEventType,
        source: str,
        description: str,
        data: Optional[Dict[str, Any]] = None,
        severity: int = 0,
        parent_event_id: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> TimelineEvent:
        """Add an event to the timeline.

        Args:
            timestamp: When the event occurred.
            event_type: Classification of the event.
            source: System or component that generated the event.
            description: Human-readable description.
            data: Optional additional data.
            severity: Severity level (0-10).
            parent_event_id: Optional parent event for causation tracking.
            tags: Optional tags for categorization.

        Returns:
            The created TimelineEvent.
        """
        self._event_counter += 1
        event = TimelineEvent(
            timestamp=timestamp,
            event_type=event_type,
            source=source,
            description=description,
            data=data or {},
            severity=severity,
            event_id=f"tl-{self._event_counter:06d}",
            parent_event_id=parent_event_id,
            tags=tags or [],
        )
        self._events.append(event)
        return event

    def build_timeline(
        self,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> Timeline:
        """Build a complete timeline from collected events.

        Args:
            start_time: Optional start time filter.
            end_time: Optional end time filter.

        Returns:
            Constructed Timeline object.
        """
        filtered = self._events

        if start_time:
            filtered = [e for e in filtered if e.timestamp >= start_time]
        if end_time:
            filtered = [e for e in filtered if e.timestamp <= end_time]

        sorted_events = sorted(filtered, key=lambda e: e.timestamp)

        cascade_point = self.find_cascade_point(sorted_events)
        if cascade_point:
            cascade_point.is_cascade_point = True

        actual_start = sorted_events[0].timestamp if sorted_events else datetime.utcnow()
        actual_end = sorted_events[-1].timestamp if sorted_events else datetime.utcnow()

        timeline = Timeline(
            timeline_id=f"timeline-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            events=sorted_events,
            start_time=actual_start,
            end_time=actual_end,
            cascade_point=cascade_point,
            summary=self._generate_summary(sorted_events, cascade_point),
            metadata={
                "total_events": len(sorted_events),
                "error_count": len([e for e in sorted_events if e.event_type == TimelineEventType.ERROR]),
                "failure_count": len([e for e in sorted_events if e.event_type == TimelineEventType.FAILURE]),
                "sources": list(set(e.source for e in sorted_events)),
            },
        )

        return timeline

    def find_cascade_point(
        self, events: Optional[List[TimelineEvent]] = None
    ) -> Optional[TimelineEvent]:
        """Find the point where a failure began cascading.

        The cascade point is identified as the first error/failure event
        that is followed by a rapid succession of additional failures.

        Args:
            events: Optional list of events to analyze. Uses internal events if None.

        Returns:
            The TimelineEvent that represents the cascade point, or None.
        """
        target_events = events if events is not None else sorted(
            self._events, key=lambda e: e.timestamp
        )

        failure_events = [
            e for e in target_events
            if e.event_type in (TimelineEventType.ERROR, TimelineEventType.FAILURE, TimelineEventType.CASCADE)
        ]

        if len(failure_events) < 2:
            if failure_events:
                return failure_events[0]
            return None

        max_acceleration = 0.0
        cascade_event: Optional[TimelineEvent] = None

        for i in range(len(failure_events) - 1):
            current = failure_events[i]
            next_event = failure_events[i + 1]
            time_diff = (next_event.timestamp - current.timestamp).total_seconds()

            if time_diff <= 0:
                time_diff = 0.001

            rate = 1.0 / time_diff

            if i > 0:
                prev_event = failure_events[i - 1]
                prev_diff = (current.timestamp - prev_event.timestamp).total_seconds()
                if prev_diff <= 0:
                    prev_diff = 0.001
                prev_rate = 1.0 / prev_diff
                acceleration = rate - prev_rate
            else:
                acceleration = rate

            if acceleration > max_acceleration:
                max_acceleration = acceleration
                cascade_event = current

        return cascade_event

    def export_timeline(self, format: str = "dict") -> Any:
        """Export the current timeline.

        Args:
            format: Output format - 'dict', 'text', or 'json'.

        Returns:
            Formatted timeline data.
        """
        timeline = self.build_timeline()

        if format == "text":
            return self._format_timeline_text(timeline)
        elif format == "json":
            import json
            return json.dumps(timeline.to_dict(), indent=2, default=str)
        return timeline.to_dict()

    def clear(self) -> None:
        """Clear all events from the timeline."""
        self._events = []
        self._event_counter = 0

    def get_events_by_source(self, source: str) -> List[TimelineEvent]:
        """Get all events from a specific source."""
        return [e for e in self._events if e.source == source]

    def get_events_by_type(self, event_type: TimelineEventType) -> List[TimelineEvent]:
        """Get all events of a specific type."""
        return [e for e in self._events if e.event_type == event_type]

    def _generate_summary(
        self,
        events: List[TimelineEvent],
        cascade_point: Optional[TimelineEvent],
    ) -> str:
        """Generate a human-readable summary of the timeline."""
        if not events:
            return "No events recorded."

        error_count = len([e for e in events if e.event_type == TimelineEventType.ERROR])
        failure_count = len([e for e in events if e.event_type == TimelineEventType.FAILURE])
        sources = list(set(e.source for e in events))

        summary_parts = [
            f"Timeline contains {len(events)} events across {len(sources)} source(s).",
            f"Errors: {error_count}, Failures: {failure_count}.",
        ]

        if cascade_point:
            summary_parts.append(
                f"Cascade point identified at {cascade_point.timestamp.isoformat()} "
                f"from source '{cascade_point.source}': {cascade_point.description}"
            )

        return " ".join(summary_parts)

    def _format_timeline_text(self, timeline: Timeline) -> str:
        """Format timeline as human-readable text."""
        lines = [
            "=" * 60,
            "FAILURE TIMELINE",
            "=" * 60,
            f"Timeline ID: {timeline.timeline_id}",
            f"Start:       {timeline.start_time.isoformat()}",
            f"End:         {timeline.end_time.isoformat()}",
            f"Events:      {len(timeline.events)}",
            "",
        ]

        if timeline.summary:
            lines.extend(["SUMMARY:", timeline.summary, ""])

        lines.append("EVENTS:")
        for event in timeline.events:
            marker = ">>>" if event.is_cascade_point else "   "
            lines.append(
                f"  {marker} [{event.timestamp.isoformat()}] "
                f"[{event.event_type.value.upper()}] "
                f"({event.source}) {event.description}"
            )

        if timeline.cascade_point:
            lines.extend([
                "",
                "CASCADE POINT:",
                f"  Time:   {timeline.cascade_point.timestamp.isoformat()}",
                f"  Source: {timeline.cascade_point.source}",
                f"  Event:  {timeline.cascade_point.description}",
            ])

        lines.append("=" * 60)
        return "\n".join(lines)
