"""War Room Alert System — Threshold-based operational alerting.

Monitors operational metrics and triggers alerts when thresholds are breached.
Supports escalation levels and alert deduplication.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class AlertLevel(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertState(str, Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SUPPRESSED = "suppressed"


@dataclass
class AlertRule:
    name: str
    metric: str
    threshold: float
    level: AlertLevel
    comparison: str = "gt"  # gt | lt | eq | gte | lte
    cooldown_seconds: float = 60.0
    description: str = ""

    def evaluate(self, value: float) -> bool:
        ops = {
            "gt": value > self.threshold,
            "lt": value < self.threshold,
            "eq": value == self.threshold,
            "gte": value >= self.threshold,
            "lte": value <= self.threshold,
        }
        return ops.get(self.comparison, False)


@dataclass
class WarRoomAlert:
    alert_id: str
    rule_name: str
    level: AlertLevel
    state: AlertState
    message: str
    metric_value: float
    threshold: float
    triggered_at: float
    resolved_at: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "alert_id": self.alert_id,
            "rule_name": self.rule_name,
            "level": self.level.value,
            "state": self.state.value,
            "message": self.message,
            "metric_value": self.metric_value,
            "threshold": self.threshold,
            "triggered_at": self.triggered_at,
            "resolved_at": self.resolved_at,
        }


class AlertRegistry:
    """Manages alert rules, evaluates metrics, and tracks active alerts."""

    def __init__(self) -> None:
        self._rules: list[AlertRule] = self._default_rules()
        self._active_alerts: dict[str, WarRoomAlert] = {}
        self._alert_history: list[WarRoomAlert] = []
        self._last_fired: dict[str, float] = {}
        self._counter = 0
        self._callbacks: list[Callable[[WarRoomAlert], None]] = []

    def add_rule(self, rule: AlertRule) -> None:
        self._rules.append(rule)

    def on_alert(self, callback: Callable[[WarRoomAlert], None]) -> None:
        self._callbacks.append(callback)

    def evaluate(self, metrics: dict[str, float]) -> list[WarRoomAlert]:
        """Evaluate all rules against current metrics. Returns newly fired alerts."""
        new_alerts: list[WarRoomAlert] = []
        now = time.time()

        for rule in self._rules:
            value = metrics.get(rule.metric)
            if value is None:
                continue

            if rule.evaluate(value):
                # Check cooldown
                last = self._last_fired.get(rule.name, 0.0)
                if now - last < rule.cooldown_seconds:
                    continue

                # Fire alert
                self._counter += 1
                alert_id = f"ALERT-{self._counter:06d}"
                alert = WarRoomAlert(
                    alert_id=alert_id,
                    rule_name=rule.name,
                    level=rule.level,
                    state=AlertState.ACTIVE,
                    message=f"{rule.name}: {rule.metric}={value:.2f} breached threshold {rule.threshold}",
                    metric_value=value,
                    threshold=rule.threshold,
                    triggered_at=now,
                )
                self._active_alerts[alert_id] = alert
                self._alert_history.append(alert)
                self._last_fired[rule.name] = now
                new_alerts.append(alert)

                for cb in self._callbacks:
                    cb(alert)
            else:
                # Auto-resolve if metric returns to normal
                to_resolve = [
                    aid for aid, a in self._active_alerts.items()
                    if a.rule_name == rule.name and a.state == AlertState.ACTIVE
                ]
                for aid in to_resolve:
                    self._active_alerts[aid] = WarRoomAlert(
                        alert_id=self._active_alerts[aid].alert_id,
                        rule_name=self._active_alerts[aid].rule_name,
                        level=self._active_alerts[aid].level,
                        state=AlertState.RESOLVED,
                        message=self._active_alerts[aid].message,
                        metric_value=value,
                        threshold=self._active_alerts[aid].threshold,
                        triggered_at=self._active_alerts[aid].triggered_at,
                        resolved_at=now,
                    )

        return new_alerts

    def acknowledge(self, alert_id: str) -> None:
        if alert_id in self._active_alerts:
            a = self._active_alerts[alert_id]
            self._active_alerts[alert_id] = WarRoomAlert(
                alert_id=a.alert_id, rule_name=a.rule_name, level=a.level,
                state=AlertState.ACKNOWLEDGED, message=a.message,
                metric_value=a.metric_value, threshold=a.threshold,
                triggered_at=a.triggered_at,
            )

    def get_active(self) -> list[WarRoomAlert]:
        return [a for a in self._active_alerts.values() if a.state == AlertState.ACTIVE]

    def get_history(self, limit: int = 100) -> list[WarRoomAlert]:
        return self._alert_history[-limit:]

    def get_stats(self) -> dict[str, Any]:
        active = self.get_active()
        return {
            "total_fired": len(self._alert_history),
            "active_count": len(active),
            "critical_active": sum(1 for a in active if a.level == AlertLevel.CRITICAL),
            "emergency_active": sum(1 for a in active if a.level == AlertLevel.EMERGENCY),
        }

    @staticmethod
    def _default_rules() -> list[AlertRule]:
        return [
            AlertRule("cpu_critical", "cpu_percent", 90.0, AlertLevel.CRITICAL, "gte", 120.0, "CPU saturation detected"),
            AlertRule("cpu_warning", "cpu_percent", 75.0, AlertLevel.WARNING, "gte", 60.0, "CPU elevated"),
            AlertRule("memory_critical", "memory_percent", 90.0, AlertLevel.CRITICAL, "gte", 120.0, "Memory exhaustion imminent"),
            AlertRule("memory_warning", "memory_percent", 80.0, AlertLevel.WARNING, "gte", 60.0, "Memory pressure detected"),
            AlertRule("retry_storm", "retry_storms", 5.0, AlertLevel.EMERGENCY, "gte", 30.0, "Retry storm cascade active"),
            AlertRule("queue_flood", "queue_depth", 1000.0, AlertLevel.CRITICAL, "gte", 60.0, "Queue depth critical"),
            AlertRule("websocket_leak", "websocket_count", 100.0, AlertLevel.WARNING, "gte", 60.0, "WebSocket connection leak"),
            AlertRule("stuck_workers", "stuck_workers", 3.0, AlertLevel.CRITICAL, "gte", 60.0, "Worker zombification detected"),
            AlertRule("execution_failures", "failed_executions", 10.0, AlertLevel.CRITICAL, "gte", 60.0, "Execution failure cascade"),
            AlertRule("collapse_probability", "collapse_probability", 0.7, AlertLevel.EMERGENCY, "gte", 30.0, "System collapse imminent"),
        ]
