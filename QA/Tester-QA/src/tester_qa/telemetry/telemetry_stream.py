"""Live telemetry stream — collect and broadcast runtime metrics."""
from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus, EventType
from tester_qa.db.database import Database


@dataclass
class MetricsSnapshot:
    project_id: str
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_used_mb: float = 0.0
    websocket_count: int = 0
    queue_depth: int = 0
    provider_latency_ms: float = 0.0
    retry_count: int = 0
    active_connections: int = 0
    timestamp: float = 0.0

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "cpu_percent": self.cpu_percent,
            "memory_percent": self.memory_percent,
            "memory_used_mb": self.memory_used_mb,
            "websocket_count": self.websocket_count,
            "queue_depth": self.queue_depth,
            "provider_latency_ms": self.provider_latency_ms,
            "retry_count": self.retry_count,
            "active_connections": self.active_connections,
            "timestamp": self.timestamp,
        }


class TelemetryStream:
    """Collect realtime metrics and stream to event bus + database."""

    def __init__(self, db: Database | None = None) -> None:
        self.bus = EventBus.get_instance()
        self.db = db
        self._history: list[MetricsSnapshot] = []
        self._max_history: int = 500

    def collect_system_metrics(self, project_id: str) -> MetricsSnapshot:
        """Collect current system metrics."""
        try:
            import psutil
            cpu = psutil.cpu_percent(interval=0.1)
            mem = psutil.virtual_memory()
            memory_percent = mem.percent
            memory_used_mb = mem.used / (1024 * 1024)
        except ImportError:
            # Fallback without psutil
            cpu = 0.0
            memory_percent = 0.0
            memory_used_mb = 0.0

        snapshot = MetricsSnapshot(
            project_id=project_id,
            cpu_percent=cpu,
            memory_percent=memory_percent,
            memory_used_mb=round(memory_used_mb, 1),
        )

        self._history.append(snapshot)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        # Publish to event bus
        self.bus.emit(EventType.METRICS_UPDATE, "telemetry", snapshot.to_dict(), project_id)

        # Persist to database
        if self.db:
            self.db.record_metrics(
                project_id=project_id,
                cpu=cpu,
                memory=memory_percent,
                ws_count=snapshot.websocket_count,
                queue_depth=snapshot.queue_depth,
                provider_latency=snapshot.provider_latency_ms,
                retry_count=snapshot.retry_count,
            )

        # Detect anomalies
        self._check_anomalies(snapshot)

        return snapshot

    def record_custom_metrics(self, project_id: str, **kwargs: Any) -> MetricsSnapshot:
        """Record custom metrics (websocket count, queue depth, etc.)."""
        snapshot = MetricsSnapshot(project_id=project_id, **kwargs)
        self._history.append(snapshot)

        self.bus.emit(EventType.METRICS_UPDATE, "telemetry", snapshot.to_dict(), project_id)

        if self.db:
            self.db.record_metrics(
                project_id=project_id,
                cpu=snapshot.cpu_percent,
                memory=snapshot.memory_percent,
                ws_count=snapshot.websocket_count,
                queue_depth=snapshot.queue_depth,
                provider_latency=snapshot.provider_latency_ms,
                retry_count=snapshot.retry_count,
            )

        return snapshot

    def get_latest(self, project_id: str | None = None) -> MetricsSnapshot | None:
        """Get the most recent metrics snapshot."""
        if project_id:
            for snap in reversed(self._history):
                if snap.project_id == project_id:
                    return snap
            return None
        return self._history[-1] if self._history else None

    def get_history(self, project_id: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        """Get metrics history."""
        history = self._history
        if project_id:
            history = [s for s in history if s.project_id == project_id]
        return [s.to_dict() for s in history[-limit:]]

    def get_trends(self, project_id: str) -> dict[str, Any]:
        """Calculate metric trends over recent history."""
        history = [s for s in self._history if s.project_id == project_id]
        if len(history) < 2:
            return {"trend": "insufficient_data"}

        recent = history[-10:]
        cpu_trend = recent[-1].cpu_percent - recent[0].cpu_percent
        mem_trend = recent[-1].memory_percent - recent[0].memory_percent

        return {
            "cpu_trend": round(cpu_trend, 1),
            "memory_trend": round(mem_trend, 1),
            "cpu_direction": "rising" if cpu_trend > 2 else "falling" if cpu_trend < -2 else "stable",
            "memory_direction": "rising" if mem_trend > 2 else "falling" if mem_trend < -2 else "stable",
            "samples": len(recent),
        }

    def _check_anomalies(self, snapshot: MetricsSnapshot) -> None:
        """Check for anomalies and emit alerts."""
        if snapshot.cpu_percent > 90:
            self.bus.emit(EventType.RUNTIME_CRITICAL, "telemetry", {"cpu": snapshot.cpu_percent, "alert": "CPU critical"}, snapshot.project_id)
        elif snapshot.cpu_percent > 75:
            self.bus.emit(EventType.RUNTIME_SPIKE, "telemetry", {"cpu": snapshot.cpu_percent, "alert": "CPU high"}, snapshot.project_id)

        if snapshot.memory_percent > 90:
            self.bus.emit(EventType.RUNTIME_CRITICAL, "telemetry", {"memory": snapshot.memory_percent, "alert": "Memory critical"}, snapshot.project_id)

        if snapshot.retry_count > 10:
            self.bus.emit(EventType.RUNTIME_DEGRADED, "telemetry", {"retries": snapshot.retry_count, "alert": "Retry storm detected"}, snapshot.project_id)

        if snapshot.queue_depth > 1000:
            self.bus.emit(EventType.RUNTIME_DEGRADED, "telemetry", {"queue": snapshot.queue_depth, "alert": "Queue saturation"}, snapshot.project_id)
