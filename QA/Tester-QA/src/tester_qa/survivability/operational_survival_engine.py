"""Operational survival engine coordinating Phase 8 survivability validators."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any, Mapping

from tester_qa.survivability.provider_failover_resilience import ProviderFailoverResilience
from tester_qa.survivability.queue_resilience import QueueResilienceValidator
from tester_qa.survivability.recovery_resilience import RecoveryResilienceValidator
from tester_qa.survivability.runtime_survival import RuntimeSurvivalResult, RuntimeSurvivalValidator
from tester_qa.survivability.websocket_recovery_score import WebSocketRecoveryScorer


@dataclass(frozen=True)
class OperationalSurvivalReport:
    overall_score: float
    grade: str
    runtime_survival: RuntimeSurvivalResult
    recovery_integrity: dict[str, Any]
    websocket_recovery: dict[str, Any]
    queue_resilience: dict[str, Any]
    provider_failover: dict[str, Any]
    recommendations: list[str] = field(default_factory=list)


class OperationalSurvivalEngine:
    """Run all survivability validators and emit a deterministic report."""

    def __init__(self) -> None:
        self.runtime_validator = RuntimeSurvivalValidator()
        self.recovery_validator = RecoveryResilienceValidator()
        self.websocket_scorer = WebSocketRecoveryScorer()
        self.queue_validator = QueueResilienceValidator()
        self.provider_validator = ProviderFailoverResilience()

    def validate(self, data: dict) -> OperationalSurvivalReport:
        payload = dict(data or {})
        runtime = self.runtime_validator.validate(payload.get("runtime", payload.get("metrics", {})), payload.get("runtime_history"))
        recovery = self.recovery_validator.validate(payload.get("recovery_history", payload.get("recovery", [])))
        websocket_metrics = payload.get("websocket", payload.get("websocket_metrics", {}))
        websocket = self.websocket_scorer.score(websocket_metrics)
        if "websocket_history" in payload:
            websocket["resync_validation"] = self.websocket_scorer.validate_resync(payload.get("websocket_history", []))
            websocket["score"] = round(min(websocket["score"], websocket["resync_validation"]["score"]), 4)
            websocket["status"] = self._status(websocket["score"])
        queue = self.queue_validator.validate(payload.get("queue", payload.get("queue_metrics", {})))
        providers = self.provider_validator.validate(payload.get("providers", payload.get("provider_failover", [])))
        overall = self._weighted_score(runtime.score, recovery["score"], websocket["score"], queue["score"], providers["score"])
        grade = self._grade(overall)
        recommendations = self._recommendations(runtime, recovery, websocket, queue, providers)
        return OperationalSurvivalReport(overall, grade, runtime, recovery, websocket, queue, providers, recommendations)

    def can_survive_production_pressure(self, data: dict) -> dict[str, Any]:
        report = self.validate(data)
        blockers = []
        if report.overall_score < 0.75:
            blockers.append("overall_survival_score_below_0.75")
        if report.runtime_survival.score < 0.70:
            blockers.append("runtime_survival_below_threshold")
        for name, section in (("recovery_integrity", report.recovery_integrity), ("websocket_recovery", report.websocket_recovery), ("queue_resilience", report.queue_resilience), ("provider_failover", report.provider_failover)):
            if float(section.get("score", 0.0)) < 0.70:
                blockers.append(f"{name}_below_threshold")
        return {"can_survive": not blockers, "overall_score": report.overall_score, "grade": report.grade, "blockers": blockers, "recommendations": report.recommendations}

    def export_report_markdown(self, report: OperationalSurvivalReport) -> str:
        report_dict = asdict(report)
        lines = ["# Operational Survival Report", "", f"**Overall score:** {report.overall_score:.4f}", f"**Grade:** {report.grade}", "", "## Subsystem Scores"]
        lines.extend([
            f"- Runtime survival: {report.runtime_survival.score:.4f}",
            f"- Recovery integrity: {report.recovery_integrity.get('score', 0.0):.4f}",
            f"- WebSocket recovery: {report.websocket_recovery.get('score', 0.0):.4f}",
            f"- Queue resilience: {report.queue_resilience.get('score', 0.0):.4f}",
            f"- Provider failover: {report.provider_failover.get('score', 0.0):.4f}",
            "", "## Recommendations",
        ])
        lines.extend(f"- {item}" for item in (report.recommendations or ["No critical survivability recommendations."]))
        lines.extend(["", "## Raw Report", "```", repr(report_dict), "```"])
        return "\n".join(lines)

    @staticmethod
    def _weighted_score(runtime: float, recovery: float, websocket: float, queue: float, providers: float) -> float:
        return round(max(0.0, min(1.0, runtime * 0.25 + recovery * 0.20 + websocket * 0.18 + queue * 0.19 + providers * 0.18)), 4)

    @staticmethod
    def _grade(score: float) -> str:
        if score >= 0.92:
            return "A"
        if score >= 0.85:
            return "B"
        if score >= 0.75:
            return "C"
        if score >= 0.60:
            return "D"
        return "F"

    @staticmethod
    def _status(score: float) -> str:
        if score >= 0.9:
            return "resilient"
        if score >= 0.75:
            return "recoverable"
        if score >= 0.55:
            return "degraded"
        return "unsafe"

    def _recommendations(self, runtime: RuntimeSurvivalResult, recovery: Mapping[str, Any], websocket: Mapping[str, Any], queue: Mapping[str, Any], providers: Mapping[str, Any]) -> list[str]:
        recs: list[str] = []
        if runtime.cpu_resilience < 0.75:
            recs.append("Increase CPU headroom, reduce event-loop lag, and validate autoscaling under sustained load.")
        if runtime.memory_resilience < 0.75:
            recs.append("Investigate memory growth, GC pauses, and OOM recovery before production pressure.")
        if runtime.queue_resilience < 0.75 or queue.get("risks"):
            recs.append("Add queue backpressure controls, drain-rate alerts, and dead-letter replay validation.")
        if recovery.get("score", 1.0) < 0.8 or recovery.get("residual_corruption"):
            recs.append("Strengthen recovery integrity checks and eliminate residual corruption after failback.")
        if websocket.get("score", 1.0) < 0.8 or websocket.get("issues"):
            recs.append("Harden WebSocket reconnect, replay, and resync semantics for disconnect storms.")
        if providers.get("score", 1.0) < 0.8 or providers.get("risks"):
            recs.append("Improve provider redundancy, failover readiness, and fallback health checks.")
        if not recs:
            recs.append("Maintain current survivability controls and continue scheduled pressure validation.")
        return recs
