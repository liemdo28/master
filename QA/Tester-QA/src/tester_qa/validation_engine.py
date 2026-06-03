"""Validation Engine — Unified orchestration of all destruction/validation.

Single entry point to run full-spectrum validation across:
- Collapse simulation
- Recovery validation
- Runtime interrogation
- Security audit
- Architecture interrogation
- Operational scoring
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from tester_qa.collapse.collapse_coordinator import CollapseCoordinator, CollapseResult
from tester_qa.recovery.recovery_validator import (
    CollapseScenario, CollapseType, RecoveryValidator, RecoveryMetrics,
)
from tester_qa.runtime.interrogator import RuntimeInterrogator, RuntimeIntelligence
from tester_qa.warroom.scoring import OperationalScoringSystem, OperationalScores


@dataclass
class ValidationReport:
    """Complete validation report — executive intelligence output."""
    generated_at: str
    collapse_results: list[dict[str, Any]] = field(default_factory=list)
    recovery_metrics: Optional[dict[str, Any]] = None
    runtime_intelligence: Optional[dict[str, Any]] = None
    operational_scores: Optional[dict[str, Any]] = None
    production_survival_score: float = 0.0
    collapse_probability: float = 0.0
    weakest_subsystem: str = "unknown"
    most_dangerous_path: str = "unknown"
    recommendations: list[str] = field(default_factory=list)
    verdict: str = "UNKNOWN"

    def to_dict(self) -> dict[str, Any]:
        return {
            "generated_at": self.generated_at,
            "verdict": self.verdict,
            "production_survival_score": self.production_survival_score,
            "collapse_probability": self.collapse_probability,
            "weakest_subsystem": self.weakest_subsystem,
            "most_dangerous_path": self.most_dangerous_path,
            "collapse_results": self.collapse_results,
            "recovery_metrics": self.recovery_metrics,
            "runtime_intelligence": self.runtime_intelligence,
            "operational_scores": self.operational_scores,
            "recommendations": self.recommendations,
        }


class ValidationEngine:
    """Unified validation orchestrator — runs full-spectrum destruction validation."""

    def __init__(self) -> None:
        self.collapse = CollapseCoordinator()
        self.recovery = RecoveryValidator()
        self.interrogator = RuntimeInterrogator()
        self.scorer = OperationalScoringSystem()

    def run_full_validation(
        self,
        topology: Optional[dict[str, list[str]]] = None,
        runtime_paths: Optional[list[dict[str, Any]]] = None,
        intensity: float = 0.8,
    ) -> ValidationReport:
        """Run complete validation suite and produce executive report."""

        # Register topology
        if topology:
            for name, deps in topology.items():
                self.collapse.register_subsystem(name, deps)
        else:
            self.collapse.register_default_topology()

        # Register runtime paths if provided
        if runtime_paths:
            for path in runtime_paths:
                self.interrogator.register_path(**path)
        else:
            self._register_default_paths()

        # Phase 1: Collapse simulation
        collapse_results = self.collapse.simulate_total_chaos()

        # Phase 2: Recovery validation
        scenario = CollapseScenario(
            collapse_type=CollapseType.CASCADING_FAILURE,
            duration_ms=15000,
            intensity=intensity,
        )
        recovery_result = self.recovery.run_full_recovery_validation(
            scenario, disconnect_duration_ms=15000,
        )

        # Phase 3: Runtime interrogation
        intel = self.interrogator.interrogate()

        # Phase 4: Operational scoring
        worst_collapse = self.collapse.get_worst_scenario()
        scores = self.scorer.calculate_all(
            collapse_scenarios=len(collapse_results),
            architectural_weakness_count=len([
                r for r in collapse_results if r.blast_radius_score > 0.5
            ]),
        )

        # Build report
        survival = scores.production_survival
        collapse_prob = scores.collapse_probability
        weakest = worst_collapse.weakest_subsystem if worst_collapse else "unknown"
        dangerous = intel.most_dangerous_path.path_id if intel.most_dangerous_path else "unknown"

        recommendations = list(intel.recommendations)
        if worst_collapse and worst_collapse.blast_radius_score > 0.6:
            recommendations.insert(0, f"CRITICAL: Collapse scenario '{worst_collapse.scenario_id}' has blast radius {worst_collapse.blast_radius_score:.0%}")
        if recovery_result.get("retry_logic_catastrophic"):
            recommendations.insert(0, "CRITICAL: Retry logic becomes catastrophic under failure — implement circuit breaker")

        verdict = self._determine_verdict(survival, collapse_prob)

        return ValidationReport(
            generated_at=datetime.now(timezone.utc).isoformat(),
            collapse_results=[r.to_dict() for r in collapse_results],
            recovery_metrics=recovery_result.get("metrics"),
            runtime_intelligence=intel.to_dict(),
            operational_scores=scores.to_dict(),
            production_survival_score=survival,
            collapse_probability=collapse_prob,
            weakest_subsystem=weakest,
            most_dangerous_path=dangerous,
            recommendations=recommendations,
            verdict=verdict,
        )

    def run_collapse_only(self, trigger: str = "provider", intensity: float = 0.9) -> CollapseResult:
        """Quick collapse simulation."""
        if not self.collapse._subsystems:
            self.collapse.register_default_topology()
        return self.collapse.simulate_collapse(trigger, f"Injected {trigger} failure", intensity)

    def run_recovery_only(self, collapse_type: str = "provider_outage", intensity: float = 0.7) -> dict[str, Any]:
        """Quick recovery validation."""
        type_map = {
            "provider_outage": CollapseType.PROVIDER_OUTAGE,
            "websocket_extinction": CollapseType.WEBSOCKET_EXTINCTION,
            "queue_overflow": CollapseType.QUEUE_OVERFLOW,
            "memory_exhaustion": CollapseType.MEMORY_EXHAUSTION,
            "cascading_failure": CollapseType.CASCADING_FAILURE,
        }
        scenario = CollapseScenario(
            collapse_type=type_map.get(collapse_type, CollapseType.CASCADING_FAILURE),
            duration_ms=10000,
            intensity=intensity,
        )
        return self.recovery.run_full_recovery_validation(scenario)

    def _register_default_paths(self) -> None:
        """Register typical dangerous runtime paths."""
        self.interrogator.register_path(
            path_id="api→provider→retry",
            components=["api_gateway", "provider", "retry_handler"],
            failure_modes=["timeout", "rate_limit", "retry_amplification"],
            retry_amplification=8.0,
            latency_p99_ms=5000,
            cascade_depth=3,
        )
        self.interrogator.register_path(
            path_id="ws→auth→reconnect",
            components=["websocket", "auth", "reconnect_handler"],
            failure_modes=["desync", "stale_state", "reconnect_storm"],
            retry_amplification=12.0,
            memory_leak_probability=0.4,
            latency_p99_ms=3000,
            cascade_depth=2,
        )
        self.interrogator.register_path(
            path_id="queue→consumer→db",
            components=["queue", "consumer", "database"],
            failure_modes=["starvation", "deadlock", "connection_exhaustion"],
            retry_amplification=3.0,
            memory_leak_probability=0.2,
            latency_p99_ms=8000,
            cascade_depth=4,
        )
        self.interrogator.register_path(
            path_id="browser→ws→render",
            components=["browser", "websocket", "render_engine"],
            failure_modes=["hydration_mismatch", "render_loop", "memory_bomb"],
            memory_leak_probability=0.6,
            latency_p99_ms=2000,
            cascade_depth=2,
        )
        self.interrogator.register_websocket_route("/ws/chat", 0.7)
        self.interrogator.register_websocket_route("/ws/notifications", 0.4)
        self.interrogator.register_failure_chain([
            "provider timeout", "retry storm", "queue flood",
            "consumer starvation", "stale UI state", "user-visible error",
        ])
        self.interrogator.register_memory_signal("websocket_pool", 2.5, 0.6)
        self.interrogator.register_memory_signal("event_handlers", 0.8, 0.3)

    def _determine_verdict(self, survival: float, collapse_prob: float) -> str:
        if survival >= 80 and collapse_prob < 15:
            return "PRODUCTION READY"
        if survival >= 60 and collapse_prob < 30:
            return "CONDITIONAL — monitor closely"
        if survival >= 40:
            return "AT RISK — deployment not advised"
        return "NOT READY — immediate intervention required"
