"""Production Survival Index — quantify operational readiness across all dimensions."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class SurvivalScores:
    production_survival: int  # 0-100
    operational_fragility: int  # 0-100 (lower = more fragile)
    collapse_probability: float  # 0.0-1.0
    recovery_confidence: int  # 0-100
    websocket_reliability: int  # 0-100
    provider_stability: int  # 0-100
    runtime_integrity: int  # 0-100
    architecture_survivability: int  # 0-100

    def to_dict(self) -> dict[str, Any]:
        return {
            "production_survival_score": self.production_survival,
            "operational_fragility_index": self.operational_fragility,
            "collapse_probability": self.collapse_probability,
            "recovery_confidence": self.recovery_confidence,
            "websocket_reliability": self.websocket_reliability,
            "provider_stability": self.provider_stability,
            "runtime_integrity": self.runtime_integrity,
            "architecture_survivability": self.architecture_survivability,
            "overall_rating": self._rating(),
            "production_ready": self.production_survival >= 70,
        }

    def _rating(self) -> str:
        if self.production_survival >= 90:
            return "battle-hardened"
        if self.production_survival >= 75:
            return "production-ready"
        if self.production_survival >= 60:
            return "needs-hardening"
        if self.production_survival >= 40:
            return "fragile"
        return "critical-risk"


class ProductionReadinessScore:
    """Calculate comprehensive production readiness scores."""

    def calculate(
        self,
        ecosystem_health: int = 80,
        chaos_resilience_rounds: int = 5,
        silent_failures_detected: int = 0,
        recovery_success_rate: float = 0.9,
        websocket_uptime: float = 0.99,
        provider_success_rate: float = 0.95,
        memory_stable: bool = True,
        test_coverage_percent: int = 60,
        spof_count: int = 0,
        blast_radius_max: int = 0,
    ) -> SurvivalScores:
        """Calculate all survival scores from operational metrics."""

        # Production Survival Score
        survival = 50
        survival += min(20, chaos_resilience_rounds * 4)  # Up to 20 from chaos resilience
        survival += int(recovery_success_rate * 15)  # Up to 15 from recovery
        survival += int(websocket_uptime * 10)  # Up to 10 from WS
        survival -= silent_failures_detected * 5  # Penalty for silent failures
        survival -= spof_count * 3  # Penalty for SPOFs
        survival = max(0, min(100, survival))

        # Operational Fragility (inverse — lower = more fragile)
        fragility = 100
        fragility -= spof_count * 10
        fragility -= blast_radius_max * 5
        fragility -= silent_failures_detected * 8
        if not memory_stable:
            fragility -= 15
        fragility = max(0, min(100, fragility))

        # Collapse Probability
        collapse_prob = 0.05  # Base 5%
        collapse_prob += spof_count * 0.1
        collapse_prob += (1 - recovery_success_rate) * 0.3
        collapse_prob += silent_failures_detected * 0.05
        if chaos_resilience_rounds < 3:
            collapse_prob += 0.2
        collapse_prob = min(1.0, max(0.0, collapse_prob))

        # Recovery Confidence
        recovery = int(recovery_success_rate * 70)
        recovery += min(20, chaos_resilience_rounds * 4)
        if memory_stable:
            recovery += 10
        recovery = max(0, min(100, recovery))

        # WebSocket Reliability
        ws_reliability = int(websocket_uptime * 100)
        if silent_failures_detected > 0:
            ws_reliability -= 10

        # Provider Stability
        provider = int(provider_success_rate * 100)

        # Runtime Integrity
        runtime = 70
        if memory_stable:
            runtime += 15
        runtime -= silent_failures_detected * 5
        runtime += min(15, test_coverage_percent // 5)
        runtime = max(0, min(100, runtime))

        # Architecture Survivability
        arch = ecosystem_health
        arch -= spof_count * 8
        arch -= blast_radius_max * 3
        arch = max(0, min(100, arch))

        return SurvivalScores(
            production_survival=survival,
            operational_fragility=fragility,
            collapse_probability=round(collapse_prob, 3),
            recovery_confidence=recovery,
            websocket_reliability=ws_reliability,
            provider_stability=provider,
            runtime_integrity=runtime,
            architecture_survivability=arch,
        )

    def generate_dossier(self, scores: SurvivalScores) -> dict[str, Any]:
        """Generate a full production readiness dossier."""
        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "scores": scores.to_dict(),
            "verdict": self._verdict(scores),
            "critical_risks": self._identify_risks(scores),
            "recommendations": self._recommendations(scores),
        }

    def _verdict(self, scores: SurvivalScores) -> str:
        if scores.production_survival >= 80 and scores.collapse_probability < 0.1:
            return "CLEARED FOR PRODUCTION — System demonstrates operational resilience"
        if scores.production_survival >= 60:
            return "CONDITIONAL — System functional but has identified weaknesses"
        return "NOT READY — Critical operational risks must be addressed before production"

    def _identify_risks(self, scores: SurvivalScores) -> list[str]:
        risks: list[str] = []
        if scores.collapse_probability > 0.3:
            risks.append(f"HIGH COLLAPSE RISK: {scores.collapse_probability*100:.0f}% probability of operational collapse")
        if scores.websocket_reliability < 95:
            risks.append(f"WEBSOCKET INSTABILITY: {scores.websocket_reliability}% reliability is below production threshold")
        if scores.provider_stability < 90:
            risks.append(f"PROVIDER RISK: {scores.provider_stability}% stability — failover may be unreliable")
        if scores.recovery_confidence < 70:
            risks.append(f"RECOVERY WEAKNESS: {scores.recovery_confidence}% confidence — system may not recover from failures")
        if scores.operational_fragility < 50:
            risks.append(f"FRAGILE ARCHITECTURE: Fragility index {scores.operational_fragility}/100 — too many single points of failure")
        return risks

    def _recommendations(self, scores: SurvivalScores) -> list[str]:
        recs: list[str] = []
        if scores.websocket_reliability < 95:
            recs.append("Implement WebSocket heartbeat with automatic reconnection and state resync")
        if scores.provider_stability < 90:
            recs.append("Add provider circuit breaker with automatic failover to secondary provider")
        if scores.recovery_confidence < 70:
            recs.append("Implement graceful degradation and automated recovery procedures")
        if scores.operational_fragility < 50:
            recs.append("Eliminate single points of failure — add redundancy to critical paths")
        if scores.runtime_integrity < 70:
            recs.append("Add memory monitoring, fix detected leaks, increase test coverage")
        if scores.collapse_probability > 0.2:
            recs.append("Run chaos engineering campaigns to identify and fix collapse vectors")
        return recs
