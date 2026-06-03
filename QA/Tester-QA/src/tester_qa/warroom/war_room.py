"""
War Room — Live Operational Intelligence Center
Tester-QA's real-time command center for engineering collapse monitoring,
runtime forensics, and executive-level operational awareness.
"""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any


# ─────────────────────────────────────────────────────────────────────────────
# Enums & Status
# ─────────────────────────────────────────────────────────────────────────────


class OperationalStatus(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    AT_RISK = "at_risk"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class SubsystemHealth(str, Enum):
    NOMINAL = "nominal"
    WARNING = "warning"
    FAILED = "failed"
    UNKNOWN = "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# Data Models
# ─────────────────────────────────────────────────────────────────────────────


@dataclass
class RuntimeMetrics:
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    disk_percent: float = 0.0
    process_count: int = 0
    websocket_count: int = 0
    queue_depth: int = 0
    provider_latency_ms: int = 0
    retry_storms: int = 0
    stuck_workers: int = 0
    failed_executions: int = 0
    event_loop_blocked: bool = False
    captured_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "cpu_percent": self.cpu_percent,
            "memory_percent": self.memory_percent,
            "disk_percent": self.disk_percent,
            "process_count": self.process_count,
            "websocket_count": self.websocket_count,
            "queue_depth": self.queue_depth,
            "provider_latency_ms": self.provider_latency_ms,
            "retry_storms": self.retry_storms,
            "stuck_workers": self.stuck_workers,
            "failed_executions": self.failed_executions,
            "event_loop_blocked": self.event_loop_blocked,
            "captured_at": self.captured_at,
        }


@dataclass
class ProviderMetrics:
    name: str
    latency_ms: int = 0
    timeout_rate: float = 0.0
    failure_rate: float = 0.0
    status: SubsystemHealth = SubsystemHealth.UNKNOWN
    last_failure: float = 0.0
    recovered_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "latency_ms": self.latency_ms,
            "timeout_rate": self.timeout_rate,
            "failure_rate": self.failure_rate,
            "status": self.status.value,
            "last_failure": self.last_failure,
            "recovered_at": self.recovered_at,
        }


@dataclass
class BrowserMetrics:
    active_sessions: int = 0
    render_instability_score: float = 0.0
    stale_state_detections: int = 0
    hydration_mismatches: int = 0
    memory_mb: float = 0.0
    dom_node_count: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "active_sessions": self.active_sessions,
            "render_instability_score": self.render_instability_score,
            "stale_state_detections": self.stale_state_detections,
            "hydration_mismatches": self.hydration_mismatches,
            "memory_mb": self.memory_mb,
            "dom_node_count": self.dom_node_count,
        }


@dataclass
class ActiveIncident:
    incident_id: str
    title: str
    severity: str
    state: str
    blast_radius: str
    affected_subsystems: list[str]
    started_at: float
    detected_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "title": self.title,
            "severity": self.severity,
            "state": self.state,
            "blast_radius": self.blast_radius,
            "affected_subsystems": self.affected_subsystems,
            "started_at": self.started_at,
            "detected_at": self.detected_at,
        }


@dataclass
class WarRoomSnapshot:
    timestamp: float
    overall_status: OperationalStatus
    operational_score: float
    runtime: RuntimeMetrics
    providers: list[ProviderMetrics]
    browser: BrowserMetrics
    active_incidents: list[ActiveIncident]
    recovery_score: float = 0.0
    collapse_probability: float = 0.0
    uptime_seconds: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "overall_status": self.overall_status.value,
            "operational_score": self.operational_score,
            "runtime": self.runtime.to_dict(),
            "providers": [p.to_dict() for p in self.providers],
            "browser": self.browser.to_dict(),
            "active_incidents": [i.to_dict() for i in self.active_incidents],
            "recovery_score": self.recovery_score,
            "collapse_probability": self.collapse_probability,
            "uptime_seconds": self.uptime_seconds,
        }


# ─────────────────────────────────────────────────────────────────────────────
# War Room Engine
# ─────────────────────────────────────────────────────────────────────────────


class WarRoom:
    """
    Live operational intelligence center.
    Aggregates runtime, provider, browser, and incident data into
    a unified command-center view.
    """

    def __init__(self) -> None:
        self._snapshots: list[WarRoomSnapshot] = []
        self._start_time = time.time()
        self._active_incidents: list[ActiveIncident] = []
        self._provider_metrics: dict[str, ProviderMetrics] = {}
        self._last_runtime: RuntimeMetrics | None = None
        self._last_browser: BrowserMetrics | None = None
        self._operational_score: float = 100.0
        self._recovery_score: float = 100.0
        self._collapse_probability: float = 0.0

    # ── Runtime ─────────────────────────────────────────────────────────────

    def update_runtime(self, metrics: RuntimeMetrics) -> None:
        self._last_runtime = metrics
        self._refresh_operational_score()

    def update_runtime_from_dict(self, data: dict[str, Any]) -> None:
        self.update_runtime(RuntimeMetrics(
            cpu_percent=data.get("cpu_percent", 0.0),
            memory_percent=data.get("memory_percent", 0.0),
            disk_percent=data.get("disk_percent", 0.0),
            process_count=data.get("process_count", 0),
            websocket_count=data.get("websocket_count", 0),
            queue_depth=data.get("queue_depth", 0),
            provider_latency_ms=data.get("provider_latency_ms", 0),
            retry_storms=data.get("retry_storms", 0),
            stuck_workers=data.get("stuck_workers", 0),
            failed_executions=data.get("failed_executions", 0),
            event_loop_blocked=data.get("event_loop_blocked", False),
        ))

    # ── Providers ──────────────────────────────────────────────────────────

    def update_provider(
        self,
        name: str,
        latency_ms: int = 0,
        timeout_rate: float = 0.0,
        failure_rate: float = 0.0,
    ) -> None:
        if latency_ms > 5000 or failure_rate > 0.5 or timeout_rate > 0.5:
            status = SubsystemHealth.FAILED
        elif latency_ms > 2000 or failure_rate > 0.2 or timeout_rate > 0.2:
            status = SubsystemHealth.WARNING
        else:
            status = SubsystemHealth.NOMINAL

        self._provider_metrics[name] = ProviderMetrics(
            name=name,
            latency_ms=latency_ms,
            timeout_rate=timeout_rate,
            failure_rate=failure_rate,
            status=status,
        )
        self._refresh_operational_score()

    def get_provider(self, name: str) -> ProviderMetrics | None:
        return self._provider_metrics.get(name)

    # ── Browser ────────────────────────────────────────────────────────────

    def update_browser(self, metrics: BrowserMetrics) -> None:
        self._last_browser = metrics
        self._refresh_operational_score()

    def update_browser_from_dict(self, data: dict[str, Any]) -> None:
        self.update_browser(BrowserMetrics(
            active_sessions=data.get("active_sessions", 0),
            render_instability_score=data.get("render_instability_score", 0.0),
            stale_state_detections=data.get("stale_state_detections", 0),
            hydration_mismatches=data.get("hydration_mismatches", 0),
            memory_mb=data.get("memory_mb", 0.0),
            dom_node_count=data.get("dom_node_count", 0),
        ))

    # ── Incidents ─────────────────────────────────────────────────────────

    def register_incident(self, incident: ActiveIncident) -> None:
        if not any(i.incident_id == incident.incident_id for i in self._active_incidents):
            self._active_incidents.append(incident)
        self._refresh_operational_score()

    def resolve_incident(self, incident_id: str) -> None:
        self._active_incidents = [
            i for i in self._active_incidents if i.incident_id != incident_id
        ]
        self._refresh_operational_score()

    # ── Scoring ────────────────────────────────────────────────────────────

    def _refresh_operational_score(self) -> None:
        score = 100.0

        # Runtime penalties
        if self._last_runtime:
            r = self._last_runtime
            if r.cpu_percent > 90:
                score -= 20
            elif r.cpu_percent > 70:
                score -= 10
            if r.memory_percent > 90:
                score -= 20
            elif r.memory_percent > 80:
                score -= 10
            if r.retry_storms > 5:
                score -= 15
            if r.stuck_workers > 2:
                score -= 10
            if r.failed_executions > 10:
                score -= 15
            if r.queue_depth > 1000:
                score -= 10
            if r.websocket_count > 100:
                score -= 5
            if r.event_loop_blocked:
                score -= 20

        # Provider penalties
        for p in self._provider_metrics.values():
            if p.status == SubsystemHealth.FAILED:
                score -= 25
            elif p.status == SubsystemHealth.WARNING:
                score -= 10

        # Browser penalties
        if self._last_browser:
            b = self._last_browser
            if b.render_instability_score > 0.7:
                score -= 15
            if b.stale_state_detections > 0:
                score -= 10
            if b.hydration_mismatches > 0:
                score -= 10

        # Incident penalties
        critical_active = sum(1 for i in self._active_incidents if i.severity == "critical")
        high_active = sum(1 for i in self._active_incidents if i.severity == "high")
        score -= critical_active * 20
        score -= high_active * 10

        self._operational_score = max(0.0, min(100.0, score))
        self._collapse_probability = self._compute_collapse_probability()

    def _compute_collapse_probability(self) -> float:
        prob = 0.0
        if self._last_runtime:
            r = self._last_runtime
            if r.memory_percent > 85:
                prob += 0.25
            if r.retry_storms > 3:
                prob += 0.20
            if r.stuck_workers > 1:
                prob += 0.15
            if r.event_loop_blocked:
                prob += 0.30

        failed_providers = sum(1 for p in self._provider_metrics.values() if p.status == SubsystemHealth.FAILED)
        prob += failed_providers * 0.15

        prob += len(self._active_incidents) * 0.05
        return max(0.0, min(1.0, prob))

    # ── Snapshots ─────────────────────────────────────────────────────────

    def capture_snapshot(self) -> WarRoomSnapshot:
        snapshot = WarRoomSnapshot(
            timestamp=time.time(),
            overall_status=self._compute_status(),
            operational_score=round(self._operational_score, 1),
            runtime=self._last_runtime or RuntimeMetrics(),
            providers=list(self._provider_metrics.values()),
            browser=self._last_browser or BrowserMetrics(),
            active_incidents=list(self._active_incidents),
            recovery_score=self._recovery_score,
            collapse_probability=round(self._collapse_probability, 4),
            uptime_seconds=time.time() - self._start_time,
        )
        self._snapshots.append(snapshot)
        return snapshot

    def _compute_status(self) -> OperationalStatus:
        if self._operational_score >= 85:
            return OperationalStatus.HEALTHY
        elif self._operational_score >= 70:
            return OperationalStatus.DEGRADED
        elif self._operational_score >= 50:
            return OperationalStatus.AT_RISK
        elif self._operational_score >= 25:
            return OperationalStatus.CRITICAL
        return OperationalStatus.UNKNOWN

    # ── Intelligence ──────────────────────────────────────────────────────

    def get_weakest_subsystem(self) -> str:
        weaknesses = []
        if self._last_runtime:
            r = self._last_runtime
            if r.memory_percent > 80:
                weaknesses.append(("memory", r.memory_percent))
            if r.cpu_percent > 80:
                weaknesses.append(("cpu", r.cpu_percent))
            if r.retry_storms > 3:
                weaknesses.append(("retry_storm", r.retry_storms))
            if r.stuck_workers > 1:
                weaknesses.append(("stuck_workers", r.stuck_workers))
            if r.queue_depth > 500:
                weaknesses.append(("queue_depth", r.queue_depth))
        for name, p in self._provider_metrics.items():
            if p.status == SubsystemHealth.FAILED:
                weaknesses.append((f"provider:{name}", p.failure_rate))
        if not weaknesses:
            return "none"
        return max(weaknesses, key=lambda x: x[1])[0]

    def get_collapse_prediction(self) -> dict[str, Any]:
        return {
            "probability": round(self._collapse_probability, 4),
            "weakest_subsystem": self.get_weakest_subsystem(),
            "risk_level": self._compute_status().value,
            "active_incidents": len(self._active_incidents),
            "operational_score": round(self._operational_score, 1),
            "critical_signals": self._collect_critical_signals(),
        }

    def _collect_critical_signals(self) -> list[str]:
        signals = []
        if self._last_runtime:
            r = self._last_runtime
            if r.memory_percent > 85:
                signals.append(f"MEMORY_CRITICAL: {r.memory_percent:.1f}%")
            if r.cpu_percent > 90:
                signals.append(f"CPU_SATURATED: {r.cpu_percent:.1f}%")
            if r.retry_storms > 5:
                signals.append(f"RETRY_STORM: {r.retry_storms} active")
            if r.stuck_workers > 2:
                signals.append(f"ZOMBIE_WORKERS: {r.stuck_workers} stuck")
            if r.event_loop_blocked:
                signals.append("EVENT_LOOP_BLOCKED")
            if r.websocket_count > 100:
                signals.append(f"WS_LEAK: {r.websocket_count} connections")
        for name, p in self._provider_metrics.items():
            if p.status == SubsystemHealth.FAILED:
                signals.append(f"PROVIDER_DOWN: {name}")
        if len(self._active_incidents) > 3:
            signals.append(f"MULTI_INCIDENT: {len(self._active_incidents)} active")
        return signals

    # ── Reports ───────────────────────────────────────────────────────────

    def generate_war_room_report(self) -> str:
        snapshot = self.capture_snapshot()
        lines = [
            "=" * 70,
            "TESTER-QA WAR ROOM — OPERATIONAL BRIEFING",
            "=" * 70,
            f"Timestamp:  {datetime.fromtimestamp(snapshot.timestamp, tz=timezone.utc).isoformat()}",
            f"Uptime:     {snapshot.uptime_seconds:.0f}s",
            f"Status:     {snapshot.overall_status.value.upper()}",
            f"Op Score:  {snapshot.operational_score}/100",
            f"Collapse:  {snapshot.collapse_probability:.1%}",
            f"Weakest:   {self.get_weakest_subsystem()}",
            "",
            "-" * 70,
            "RUNTIME",
            "-" * 70,
        ]
        r = snapshot.runtime
        lines.extend([
            f"  CPU:       {r.cpu_percent:.1f}%",
            f"  Memory:    {r.memory_percent:.1f}%",
            f"  Disk:      {r.disk_percent:.1f}%",
            f"  Processes: {r.process_count}",
            f"  WebSockets:{r.websocket_count}",
            f"  Queue:     {r.queue_depth}",
            f"  Latency:   {r.provider_latency_ms}ms",
            f"  RetryStorm:{r.retry_storms}",
            f"  StuckWrk:  {r.stuck_workers}",
            f"  Failed:    {r.failed_executions}",
            f"  EventLoop: {'BLOCKED' if r.event_loop_blocked else 'OK'}",
        ])
        if snapshot.providers:
            lines.extend(["", "-" * 70, "PROVIDERS", "-" * 70])
            for p in snapshot.providers:
                icon = "✓" if p.status == SubsystemHealth.NOMINAL else "⚠" if p.status == SubsystemHealth.WARNING else "✗"
                lines.append(f"  {icon} {p.name}: latency={p.latency_ms}ms fail={p.failure_rate:.1%} timeout={p.timeout_rate:.1%}")
        if snapshot.browser.active_sessions > 0:
            b = snapshot.browser
            lines.extend(["", "-" * 70, "BROWSER", "-" * 70])
            lines.extend([
                f"  Sessions:    {b.active_sessions}",
                f"  RenderScore:{b.render_instability_score:.2f}",
                f"  StaleState: {b.stale_state_detections}",
                f"  Hydration:  {b.hydration_mismatches}",
                f"  Memory:     {b.memory_mb:.1f}MB",
            ])
        if snapshot.active_incidents:
            lines.extend(["", "-" * 70, f"ACTIVE INCIDENTS ({len(snapshot.active_incidents)})", "-" * 70])
            for inc in snapshot.active_incidents:
                lines.append(f"  [{inc.severity.upper()}] {inc.incident_id} — {inc.title}")
                lines.append(f"    Blast Radius: {inc.blast_radius}")
                lines.append(f"    Affected: {', '.join(inc.affected_subsystems)}")
        critical = self._collect_critical_signals()
        if critical:
            lines.extend(["", "-" * 70, "CRITICAL SIGNALS", "-" * 70])
            for sig in critical:
                lines.append(f"  !! {sig}")
        lines.extend(["", "=" * 70])
        return "\n".join(lines)

    def get_snapshot_history(self, limit: int = 50) -> list[dict[str, Any]]:
        return [s.to_dict() for s in self._snapshots[-limit:]]

    def get_current_snapshot(self) -> WarRoomSnapshot:
        return self.capture_snapshot()

    def get_current_status(self) -> dict[str, Any]:
        s = self.capture_snapshot()
        return {
            "status": s.overall_status.value,
            "operational_score": s.operational_score,
            "collapse_probability": s.collapse_probability,
            "active_incidents": len(s.active_incidents),
            "critical_signals": self._collect_critical_signals(),
            "weakest_subsystem": self.get_weakest_subsystem(),
        }
