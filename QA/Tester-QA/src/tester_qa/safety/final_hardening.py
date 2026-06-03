"""Phase 9 final hardening safety engine."""
from __future__ import annotations

from typing import Any

from tester_qa.browser_warfare.safety import (
    ChaosGuardrailPolicy,
    ChaosGuardrails,
    QueueProtection,
    RuntimeKillSwitch,
    WarfareIsolationGuard,
)


class FinalHardeningEngine:
    """Combine guardrails, kill switch, queue protection, and isolation checks."""

    def __init__(
        self,
        guardrails: ChaosGuardrails | None = None,
        kill_switch: RuntimeKillSwitch | None = None,
        queue_protection: QueueProtection | None = None,
        isolation_guard: WarfareIsolationGuard | None = None,
        policy: ChaosGuardrailPolicy | None = None,
    ) -> None:
        self.guardrails = guardrails or ChaosGuardrails(policy=policy)
        self.kill_switch = kill_switch or RuntimeKillSwitch()
        self.queue_protection = queue_protection or QueueProtection()
        self.isolation_guard = isolation_guard or WarfareIsolationGuard()

    def validate_operation(self, operation: dict[str, Any]) -> dict[str, Any]:
        """Validate an operation against all final hardening safety checks."""
        violations: list[str] = []
        checks: dict[str, Any] = {}

        if self.kill_switch.should_abort():
            violations.append("runtime kill switch is armed")
        checks["kill_switch"] = {"armed": self.kill_switch.is_armed()}

        guardrail_ok, guardrail_violations = self.guardrails.validate_request(operation)
        checks["guardrails"] = {"ok": guardrail_ok, "violations": guardrail_violations}
        violations.extend(guardrail_violations)

        target = operation.get("target") or operation.get("url")
        if target:
            isolation_ok, isolation_violations = self.isolation_guard.validate_target(str(target))
            checks["isolation"] = {"ok": isolation_ok, "violations": isolation_violations}
            violations.extend(isolation_violations)
        else:
            checks["isolation"] = {"ok": True, "violations": []}

        metrics = operation.get("metrics", {}) or {}
        if "queue_depth" in operation and "queue_depth" not in metrics:
            metrics = {**metrics, "queue_depth": operation["queue_depth"]}
        if "retry_count" in operation and "retry_count" not in metrics:
            metrics = {**metrics, "retry_count": operation["retry_count"]}
        pause = self.queue_protection.should_pause_ingestion(metrics)
        checks["queue"] = {"ok": not pause, "pause_ingestion": pause, "metrics": metrics}
        if pause:
            violations.append("queue protection requires ingestion pause")

        return {"ok": not violations, "violations": violations, "checks": checks}

    def emergency_shutdown(self, reason: str) -> dict[str, Any]:
        """Trigger the runtime kill switch for an emergency shutdown."""
        event = self.kill_switch.trigger(reason)
        return {"ok": True, "shutdown": True, "event": event}

    def get_safety_status(self) -> dict[str, Any]:
        """Return consolidated final hardening safety status."""
        return {
            "kill_switch": {
                "armed": self.kill_switch.is_armed(),
                "should_abort": self.kill_switch.should_abort(),
                "history_count": len(self.kill_switch.history()),
            },
            "guardrails": self.guardrails.get_status(),
        }
