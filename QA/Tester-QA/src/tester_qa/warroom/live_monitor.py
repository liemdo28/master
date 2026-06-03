"""Live War Room Monitor — Real-time Operational Intelligence"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from tester_qa.warroom.war_room import (
    WarRoom,
    WarRoomSnapshot,
    RuntimeMetrics,
    ProviderMetrics,
    BrowserMetrics,
    ActiveIncident,
    SubsystemHealth,
)
from tester_qa.warroom.alerts import AlertLevel, AlertRegistry, WarRoomAlert
from tester_qa.warroom.scoring import OperationalScoringSystem, OperationalScores


class LiveWarRoomMonitor:
    """
    Real-time war room monitoring engine.
    Continuously evaluates system signals and raises alerts.
    """

    def __init__(self) -> None:
        self.warroom = WarRoom()
        self.alerts = AlertRegistry()
        self.scorer = OperationalScoringSystem()

    # ── Runtime metrics ────────────────────────────────────────────────────

    def feed_runtime(
        self,
        cpu_percent: float = 0.0,
        memory_percent: float = 0.0,
        websocket_count: int = 0,
        queue_depth: int = 0,
        provider_latency_ms: int = 0,
        retry_storms: int = 0,
        stuck_workers: int = 0,
        failed_executions: int = 0,
        event_loop_blocked: bool = False,
    ) -> list[WarRoomAlert]:
        metrics = RuntimeMetrics(
            cpu_percent=cpu_percent,
            memory_percent=memory_percent,
            websocket_count=websocket_count,
            queue_depth=queue_depth,
            provider_latency_ms=provider_latency_ms,
            retry_storms=retry_storms,
            stuck_workers=stuck_workers,
            failed_executions=failed_executions,
            event_loop_blocked=event_loop_blocked,
        )
        self.warroom.update_runtime(metrics)
        return self._evaluate_runtime_alerts(metrics)

    # ── Provider metrics ──────────────────────────────────────────────────

    def feed_provider(
        self,
        name: str,
        latency_ms: int = 0,
        timeout_rate: float = 0.0,
        failure_rate: float = 0.0,
    ) -> list[WarRoomAlert]:
        self.warroom.update_provider(name, latency_ms, timeout_rate, failure_rate)
        return self._evaluate_provider_alerts(name, latency_ms, timeout_rate, failure_rate)

    # ── Browser metrics ───────────────────────────────────────────────────

    def feed_browser(
        self,
        active_sessions: int = 0,
        render_instability_score: float = 0.0,
        stale_state_detections: int = 0,
        hydration_mismatches: int = 0,
        memory_mb: float = 0.0,
        dom_node_count: int = 0,
    ) -> list[WarRoomAlert]:
        metrics = BrowserMetrics(
            active_sessions=active_sessions,
            render_instability_score=render_instability_score,
            stale_state_detections=stale_state_detections,
            hydration_mismatches=hydration_mismatches,
            memory_mb=memory_mb,
            dom_node_count=dom_node_count,
        )
        self.warroom.update_browser(metrics)
        return self._evaluate_browser_alerts(metrics)

    # ── Incident feed ─────────────────────────────────────────────────────

    def feed_incident(self, incident: ActiveIncident) -> list[WarRoomAlert]:
        self.warroom.register_incident(incident)
        raised: list[WarRoomAlert] = []
        if incident.severity == "critical":
            a = self.alerts.raise_alert(
                AlertLevel.CRITICAL,
                f"INCIDENT [{incident.incident_id}] {incident.title}",
                "incidents",
                details={"blast_radius": incident.blast_radius},
            )
            raised.append(a)
        elif incident.severity == "high":
            a = self.alerts.raise_alert(
                AlertLevel.HIGH,
                f"INCIDENT [{incident.incident_id}] {incident.title}",
                "incidents",
            )
            raised.append(a)
        return raised

    def resolve_incident(self, incident_id: str) -> None:
        self.warroom.resolve_incident(incident_id)

    # ── Capture and score ─────────────────────────────────────────────────

    def capture(self) -> WarRoomSnapshot:
        return self.warroom.capture_snapshot()

    def calculate_scores(self) -> OperationalScores:
        snapshot = self.warroom.capture_snapshot()
        r = snapshot.runtime
        return self.scorer.calculate_all(
            cpu_percent=r.cpu_percent,
            memory_percent=r.memory_percent,
            stuck_workers=r.stuck_workers,
            queue_depth=r.queue_depth,
            retry_storms=r.retry_storms,
            failed_executions=r.failed_executions,
        )

    def render(self, format: str = "json") -> str:
        """Render war room status as report or JSON."""
        if format == "report":
            return self.warroom.generate_war_room_report()
        snapshot = self.warroom.capture_snapshot()
        scores = self.calculate_scores()
        output = {
            "snapshot": snapshot.to_dict(),
            "scores": scores.to_dict(),
            "alerts": self.alerts.to_dict(),
            "predictions": self.warroom.get_collapse_prediction(),
        }
        return json.dumps(output, indent=2, default=str)

    # ── Alert evaluation helpers ───────────────────────────────────────────

    def _evaluate_runtime_alerts(self, r: RuntimeMetrics) -> list[WarRoomAlert]:
        raised: list[WarRoomAlert] = []
        if r.cpu_percent > 90:
            raised.append(self.alerts.raise_alert(AlertLevel.CRITICAL, f"CPU critical: {r.cpu_percent:.1f}%", "runtime"))
        elif r.cpu_percent > 75:
            raised.append(self.alerts.raise_alert(AlertLevel.WARNING, f"CPU elevated: {r.cpu_percent:.1f}%", "runtime"))

        if r.memory_percent > 90:
            raised.append(self.alerts.raise_alert(AlertLevel.CRITICAL, f"Memory critical: {r.memory_percent:.1f}%", "runtime"))
        elif r.memory_percent > 75:
            raised.append(self.alerts.raise_alert(AlertLevel.WARNING, f"Memory elevated: {r.memory_percent:.1f}%", "runtime"))

        if r.event_loop_blocked:
            raised.append(self.alerts.raise_alert(AlertLevel.CRITICAL, "Event loop BLOCKED", "runtime"))

        if r.stuck_workers > 0:
            raised.append(self.alerts.raise_alert(AlertLevel.HIGH, f"{r.stuck_workers} stuck worker(s)", "runtime"))

        if r.queue_depth > 1000:
            raised.append(self.alerts.raise_alert(AlertLevel.HIGH, f"Queue flood: depth={r.queue_depth}", "runtime"))

        if r.retry_storms > 3:
            raised.append(self.alerts.raise_alert(AlertLevel.HIGH, f"Retry storm: {r.retry_storms} active", "runtime"))

        return raised

    def _evaluate_provider_alerts(
        self, name: str, latency_ms: int, timeout_rate: float, failure_rate: float
    ) -> list[WarRoomAlert]:
        raised: list[WarRoomAlert] = []
        if latency_ms > 5000:
            raised.append(self.alerts.raise_alert(
                AlertLevel.CRITICAL, f"Provider {name} latency critical: {latency_ms}ms", f"provider:{name}"
            ))
        elif latency_ms > 2000:
            raised.append(self.alerts.raise_alert(
                AlertLevel.HIGH, f"Provider {name} degraded: {latency_ms}ms", f"provider:{name}"
            ))
        if timeout_rate > 0.5:
            raised.append(self.alerts.raise_alert(
                AlertLevel.CRITICAL, f"Provider {name} timeout rate: {timeout_rate:.0%}", f"provider:{name}"
            ))
        if failure_rate > 0.2:
            raised.append(self.alerts.raise_alert(
                AlertLevel.CRITICAL, f"Provider {name} failure rate: {failure_rate:.0%}", f"provider:{name}"
            ))
        return raised

    def _evaluate_browser_alerts(self, b: BrowserMetrics) -> list[WarRoomAlert]:
        raised: list[WarRoomAlert] = []
        if b.render_instability_score > 0.7:
            raised.append(self.alerts.raise_alert(
                AlertLevel.HIGH, f"Render instability: {b.render_instability_score:.2f}", "browser"
            ))
        if b.stale_state_detections > 0:
            raised.append(self.alerts.raise_alert(
                AlertLevel.WARNING, f"{b.stale_state_detections} stale UI state(s)", "browser"
            ))
        if b.hydration_mismatches > 0:
            raised.append(self.alerts.raise_alert(
                AlertLevel.HIGH, f"{b.hydration_mismatches} hydration mismatch(es)", "browser"
            ))
        if b.memory_mb > 500:
            raised.append(self.alerts.raise_alert(
                AlertLevel.HIGH, f"Browser memory: {b.memory_mb:.0f}MB", "browser"
            ))
        return raised

    def auto_resolve_stale(self) -> int:
        return self.alerts.auto_resolve_stale(max_age_seconds=300)

    def get_status(self) -> dict[str, Any]:
        return self.warroom.get_current_status()
