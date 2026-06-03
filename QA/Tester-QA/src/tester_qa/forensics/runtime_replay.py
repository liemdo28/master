"""Runtime Replay - Reconstruct and replay runtime execution events."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class AnomalyType(Enum):
    TIMING_VIOLATION = "timing_violation"
    MEMORY_SPIKE = "memory_spike"
    EVENTLOOP_BLOCK = "eventloop_block"
    STATE_CORRUPTION = "state_corruption"
    UNEXPECTED_EXIT = "unexpected_exit"


@dataclass
class RuntimeEvent:
    timestamp: datetime
    event_type: str
    thread_id: str
    data: dict[str, Any]
    sequence: int


@dataclass
class Anomaly:
    anomaly_type: AnomalyType
    timestamp: datetime
    description: str
    severity: float
    related_events: list[int] = field(default_factory=list)


@dataclass
class ExecutionSnapshot:
    events: list[RuntimeEvent]
    start_time: datetime
    end_time: datetime
    thread_states: dict[str, dict[str, Any]]


class RuntimeReplay:
    """Reconstruct and replay runtime execution events."""

    def __init__(self, events: Optional[list[RuntimeEvent]] = None):
        self.events: list[RuntimeEvent] = events or []
        self.anomalies: list[Anomaly] = []
        self.execution_snapshots: list[ExecutionSnapshot] = []

    def replay_runtime_events(
        self, events: list[RuntimeEvent]
    ) -> ExecutionSnapshot:
        """Replay runtime events and return execution snapshot."""
        self.events = sorted(events, key=lambda e: e.sequence)

        start_time = min((e.timestamp for e in events), default=datetime.now())
        end_time = max((e.timestamp for e in events), default=datetime.now())

        thread_states: dict[str, dict[str, Any]] = {}
        for event in self.events:
            if event.thread_id not in thread_states:
                thread_states[event.thread_id] = {"event_count": 0, "last_type": None}
            thread_states[event.thread_id]["event_count"] += 1
            thread_states[event.thread_id]["last_type"] = event.event_type

        snapshot = ExecutionSnapshot(
            events=self.events,
            start_time=start_time,
            end_time=end_time,
            thread_states=thread_states,
        )
        self.execution_snapshots.append(snapshot)
        return snapshot

    def reconstruct_execution(
        self, from_time: datetime, to_time: datetime
    ) -> list[RuntimeEvent]:
        """Reconstruct execution timeline within a time range."""
        filtered = [
            e
            for e in self.events
            if from_time <= e.timestamp <= to_time
        ]
        return sorted(filtered, key=lambda e: e.sequence)

    def identify_anomalies(
        self, timing_threshold_ms: float = 1000.0
    ) -> list[Anomaly]:
        """Identify anomalies in runtime events."""
        self.anomalies = []

        if len(self.events) < 2:
            return self.anomalies

        for i in range(1, len(self.events)):
            prev = self.events[i - 1]
            curr = self.events[i]
            delta = (curr.timestamp - prev.timestamp).total_seconds() * 1000

            if delta > timing_threshold_ms:
                self.anomalies.append(
                    Anomaly(
                        anomaly_type=AnomalyType.TIMING_VIOLATION,
                        timestamp=curr.timestamp,
                        description=f"Timing gap of {delta:.2f}ms between events {prev.sequence} and {curr.sequence}",
                        severity=min(delta / timing_threshold_ms, 10.0),
                        related_events=[prev.sequence, curr.sequence],
                    )
                )

            if curr.event_type == "memory" and "memory_mb" in curr.data:
                if curr.data["memory_mb"] > 500:
                    self.anomalies.append(
                        Anomaly(
                            anomaly_type=AnomalyType.MEMORY_SPIKE,
                            timestamp=curr.timestamp,
                            description=f"Memory spike: {curr.data['memory_mb']}MB",
                            severity=curr.data["memory_mb"] / 100,
                            related_events=[curr.sequence],
                        )
                    )

            if prev.thread_id == curr.thread_id and prev.event_type == "eventloop_task":
                if curr.event_type != "eventloop_task":
                    self.anomalies.append(
                        Anomaly(
                            anomaly_type=AnomalyType.EVENTLOOP_BLOCK,
                            timestamp=curr.timestamp,
                            description=f"EventLoop blocked at event {curr.sequence}",
                            severity=5.0,
                            related_events=[curr.sequence],
                        )
                    )

        return self.anomalies
