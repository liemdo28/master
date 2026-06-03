"""War Room Panels — Live Operational Intelligence Panels

Each panel represents a real-time view into a specific subsystem,
designed for executive war-room display during active incidents.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from tester_qa.warroom.war_room import (
    RuntimeMetrics,
    ProviderMetrics,
    BrowserMetrics,
    ActiveIncident,
    SubsystemHealth,
)


@dataclass
class PanelEntry:
    label: str
    value: Any
    status: str = "nominal"  # nominal | warning | critical
    threshold_breached: bool = False


class RuntimePanel:
    """Live runtime metrics panel — CPU, memory, websocket, queue depth."""

    def __init__(self) -> None:
        self._history: list[RuntimeMetrics] = []
        self._max_history = 100

    def ingest(self, metrics: RuntimeMetrics) -> None:
        self._history.append(metrics)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

    def render(self) -> list[PanelEntry]:
        if not self._history:
            return [PanelEntry("status", "no data", "unknown")]
        m = self._history[-1]
        return [
            PanelEntry("cpu", f"{m.cpu_percent:.1f}%", self._status(m.cpu_percent, 70, 90), m.cpu_percent > 90),
            PanelEntry("memory", f"{m.memory_percent:.1f}%", self._status(m.memory_percent, 75, 90), m.memory_percent > 90),
            PanelEntry("disk", f"{m.disk_percent:.1f}%", self._status(m.disk_percent, 80, 95), m.disk_percent > 95),
            PanelEntry("websockets", str(m.websocket_count), self._status(m.websocket_count, 50, 100), m.websocket_count > 100),
            PanelEntry("queue_depth", str(m.queue_depth), self._status(m.queue_depth, 500, 1000), m.queue_depth > 1000),
            PanelEntry("retry_storms", str(m.retry_storms), self._status(m.retry_storms, 3, 5), m.retry_storms > 5),
            PanelEntry("stuck_workers", str(m.stuck_workers), self._status(m.stuck_workers, 1, 3), m.stuck_workers > 3),
            PanelEntry("event_loop", "BLOCKED" if m.event_loop_blocked else "OK", "critical" if m.event_loop_blocked else "nominal", m.event_loop_blocked),
        ]

    def trend(self, metric: str, window: int = 10) -> list[float]:
        """Return recent values for a metric."""
        recent = self._history[-window:]
        return [getattr(m, metric, 0.0) for m in recent]

    @staticmethod
    def _status(value: float, warn: float, crit: float) -> str:
        if value >= crit:
            return "critical"
        if value >= warn:
            return "warning"
        return "nominal"


class ProviderPanel:
    """Live provider health panel — latency, timeout rate, failure rate."""

    def __init__(self) -> None:
        self._providers: dict[str, list[ProviderMetrics]] = {}
        self._max_history = 50

    def ingest(self, metrics: ProviderMetrics) -> None:
        if metrics.name not in self._providers:
            self._providers[metrics.name] = []
        self._providers[metrics.name].append(metrics)
        if len(self._providers[metrics.name]) > self._max_history:
            self._providers[metrics.name] = self._providers[metrics.name][-self._max_history:]

    def render(self) -> list[PanelEntry]:
        entries = []
        for name, history in self._providers.items():
            latest = history[-1]
            status = latest.status.value if latest.status != SubsystemHealth.UNKNOWN else "nominal"
            entries.append(PanelEntry(
                f"{name}:latency", f"{latest.latency_ms}ms", status, latest.latency_ms > 5000
            ))
            entries.append(PanelEntry(
                f"{name}:failure_rate", f"{latest.failure_rate:.1%}", status, latest.failure_rate > 0.5
            ))
            entries.append(PanelEntry(
                f"{name}:timeout_rate", f"{latest.timeout_rate:.1%}", status, latest.timeout_rate > 0.5
            ))
        return entries

    def get_degraded_providers(self) -> list[str]:
        degraded = []
        for name, history in self._providers.items():
            if history and history[-1].status in (SubsystemHealth.WARNING, SubsystemHealth.FAILED):
                degraded.append(name)
        return degraded


class BrowserPanel:
    """Live browser stability panel — sessions, render instability, stale state."""

    def __init__(self) -> None:
        self._history: list[BrowserMetrics] = []
        self._max_history = 50

    def ingest(self, metrics: BrowserMetrics) -> None:
        self._history.append(metrics)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

    def render(self) -> list[PanelEntry]:
        if not self._history:
            return [PanelEntry("status", "no data", "unknown")]
        b = self._history[-1]
        return [
            PanelEntry("active_sessions", str(b.active_sessions), "nominal"),
            PanelEntry("render_instability", f"{b.render_instability_score:.2f}", self._render_status(b.render_instability_score), b.render_instability_score > 0.7),
            PanelEntry("stale_state", str(b.stale_state_detections), "critical" if b.stale_state_detections > 0 else "nominal", b.stale_state_detections > 0),
            PanelEntry("hydration_mismatch", str(b.hydration_mismatches), "critical" if b.hydration_mismatches > 0 else "nominal", b.hydration_mismatches > 0),
            PanelEntry("memory_mb", f"{b.memory_mb:.1f}", "warning" if b.memory_mb > 500 else "nominal", b.memory_mb > 1000),
            PanelEntry("dom_nodes", str(b.dom_node_count), "warning" if b.dom_node_count > 5000 else "nominal", b.dom_node_count > 10000),
        ]

    @staticmethod
    def _render_status(score: float) -> str:
        if score > 0.7:
            return "critical"
        if score > 0.4:
            return "warning"
        return "nominal"


class IncidentPanel:
    """Live incident tracking panel — active collapses, blast radius, recovery state."""

    def __init__(self) -> None:
        self._incidents: list[ActiveIncident] = []

    def ingest(self, incident: ActiveIncident) -> None:
        if not any(i.incident_id == incident.incident_id for i in self._incidents):
            self._incidents.append(incident)

    def resolve(self, incident_id: str) -> None:
        self._incidents = [i for i in self._incidents if i.incident_id != incident_id]

    def render(self) -> list[PanelEntry]:
        entries = [PanelEntry("active_count", str(len(self._incidents)), "critical" if len(self._incidents) > 3 else "nominal")]
        for inc in self._incidents:
            entries.append(PanelEntry(
                inc.incident_id,
                f"[{inc.severity.upper()}] {inc.title}",
                "critical" if inc.severity == "critical" else "warning",
                inc.severity == "critical",
            ))
        return entries

    @property
    def critical_count(self) -> int:
        return sum(1 for i in self._incidents if i.severity == "critical")

    @property
    def active_count(self) -> int:
        return len(self._incidents)


class SystemOverview:
    """Aggregated system overview panel combining all sub-panels."""

    def __init__(self) -> None:
        self.runtime = RuntimePanel()
        self.providers = ProviderPanel()
        self.browser = BrowserPanel()
        self.incidents = IncidentPanel()

    def render_all(self) -> dict[str, list[PanelEntry]]:
        return {
            "runtime": self.runtime.render(),
            "providers": self.providers.render(),
            "browser": self.browser.render(),
            "incidents": self.incidents.render(),
        }

    def get_critical_alerts(self) -> list[str]:
        alerts = []
        for entry in self.runtime.render():
            if entry.threshold_breached:
                alerts.append(f"RUNTIME: {entry.label} = {entry.value}")
        for entry in self.providers.render():
            if entry.threshold_breached:
                alerts.append(f"PROVIDER: {entry.label} = {entry.value}")
        for entry in self.browser.render():
            if entry.threshold_breached:
                alerts.append(f"BROWSER: {entry.label} = {entry.value}")
        if self.incidents.critical_count > 0:
            alerts.append(f"INCIDENTS: {self.incidents.critical_count} critical active")
        return alerts
