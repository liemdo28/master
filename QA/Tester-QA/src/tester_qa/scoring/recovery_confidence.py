"""Recovery Confidence Engine — quantifies ability to recover from failures."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus


class RecoveryConfidenceEngine:
    """Score the system's recovery capability from historical evidence."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus or EventBus.get_instance()

    def calculate(
        self,
        last_recovery_time_seconds: float | None = None,
        recovery_success_count: int | None = None,
        recovery_failure_count: int | None = None,
        automated_recovery_enabled: bool | None = None,
        evidence_completeness: float | None = None,
        runbook_coverage: float | None = None,
        last_incident_timestamp: str | None = None,
        chaos_rounds_passed: int | None = None,
    ) -> dict[str, Any]:
        """
        Returns recovery confidence score (0-100), estimated recovery time,
        and a list of weak recovery paths.
        """
        recovery_time = (
            last_recovery_time_seconds
            if last_recovery_time_seconds is not None
            else self._bus_float("last_recovery_time_seconds", 300.0)
        )
        success_count = (
            recovery_success_count
            if recovery_success_count is not None
            else self._bus_int("recovery_success_count", 3)
        )
        failure_count = (
            recovery_failure_count
            if recovery_failure_count is not None
            else self._bus_int("recovery_failure_count", 0)
        )
        auto_recovery = (
            automated_recovery_enabled
            if automated_recovery_enabled is not None
            else self._bus_bool("automated_recovery_enabled", False)
        )
        evidence = (
            evidence_completeness
            if evidence_completeness is not None
            else self._bus_float("evidence_completeness", 0.7)
        )
        runbook = (
            runbook_coverage
            if runbook_coverage is not None
            else self._bus_float("runbook_coverage", 0.5)
        )
        last_incident = (
            last_incident_timestamp
            if last_incident_timestamp is not None
            else self._bus_str("last_incident_timestamp", None)
        )
        chaos = (
            chaos_rounds_passed
            if chaos_rounds_passed is not None
            else self._bus_int("chaos_resilience_rounds", 3)
        )

        total_attempts = success_count + failure_count
        success_rate   = success_count / max(1, total_attempts)

        confidence = int(success_rate * 50)
        confidence += int(evidence * 20)
        confidence += int(runbook * 15)
        if auto_recovery:
            confidence += 10
        if chaos >= 5:
            confidence += 5
        elif chaos >= 3:
            confidence += 2

        if recovery_time > 600:
            confidence -= 15
        elif recovery_time > 300:
            confidence -= 8
        elif recovery_time > 60:
            confidence -= 3

        confidence = max(0, min(100, confidence))

        recovery_time_estimate = (
            min(recovery_time, 60.0) if auto_recovery else max(recovery_time, 300.0)
        )

        weak_paths: list[dict[str, Any]] = []
        if success_rate < 0.7:
            weak_paths.append({"path": "historical_recovery", "severity": "critical",
                               "detail": f"Recovery success rate {success_rate*100:.0f}% — below 70% threshold"})
        if not auto_recovery:
            weak_paths.append({"path": "automation", "severity": "high",
                               "detail": "No automated recovery — manual intervention required; expect delays"})
        if evidence < 0.5:
            weak_paths.append({"path": "evidence_completeness", "severity": "medium",
                               "detail": f"Evidence completeness {evidence*100:.0f}% — post-mortems incomplete"})
        if runbook < 0.5:
            weak_paths.append({"path": "runbook_coverage", "severity": "medium",
                               "detail": f"Runbook coverage {runbook*100:.0f}% — {int((1-runbook)*100)}% of failure modes undocumented"})
        if recovery_time > 300:
            weak_paths.append({"path": "recovery_speed", "severity": "high",
                               "detail": f"Last recovery took {recovery_time:.0f}s — target is under 5 minutes"})
        if last_incident is None:
            weak_paths.append({"path": "incident_history", "severity": "low",
                               "detail": "No recent incident recorded — recovery capability not recently validated"})

        return {
            "confidence":             confidence,
            "recovery_time_estimate": round(recovery_time_estimate, 1),
            "weak_recovery_paths":    weak_paths,
            "timestamp":             datetime.now(timezone.utc).isoformat(),
        }

    def _bus_float(self, key: str, default: float) -> float:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return float(val)
        return default

    def _bus_int(self, key: str, default: int) -> int:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return int(val)
        return default

    def _bus_bool(self, key: str, default: bool) -> bool:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return bool(val)
        return default

    def _bus_str(self, key: str, default: str | None) -> str | None:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return str(val)
        return default
