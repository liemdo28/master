"""Operational Scoring System — Production Survival Metrics"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class OperationalScores:
    production_survival: float = 100.0
    runtime_stability: float = 100.0
    browser_stability: float = 100.0
    recovery_reliability: float = 100.0
    collapse_probability: float = 0.0
    operational_risk: float = 0.0
    scalability_risk: float = 0.0
    architecture_fragility: float = 0.0
    chaos_resilience: float = 100.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "production_survival_score": self.production_survival,
            "runtime_stability_index": self.runtime_stability,
            "browser_stability_index": self.browser_stability,
            "recovery_reliability_score": self.recovery_reliability,
            "collapse_probability_score": self.collapse_probability,
            "operational_risk_score": self.operational_risk,
            "scalability_risk_score": self.scalability_risk,
            "architecture_fragility_score": self.architecture_fragility,
            "chaos_resilience_score": self.chaos_resilience,
        }


@dataclass
class ScoreBreakdown:
    component: str
    score: float
    penalty: float
    factors: list[str] = field(default_factory=list)


class OperationalScoringSystem:
    """Calculates comprehensive operational scores.

    Produces the full suite of scores:
    - Production Survival Score
    - Runtime Stability Index
    - Browser Stability Index
    - Recovery Reliability Score
    - Collapse Probability Score
    - Operational Risk Score
    - Scalability Risk Score
    - Architecture Fragility Score
    - Chaos Resilience Score
    """

    def __init__(self) -> None:
        self._breakdowns: list[ScoreBreakdown] = []

    def calculate_all(
        self,
        runtime_score: float = 100.0,
        browser_score: float = 100.0,
        websocket_score: float = 100.0,
        provider_score: float = 100.0,
        memory_score: float = 100.0,
        retry_storms: int = 0,
        failed_executions: int = 0,
        stuck_workers: int = 0,
        websocket_zombies: int = 0,
        queue_depth: int = 0,
        eventloop_latency_ms: float = 0.0,
        cpu_percent: float = 0.0,
        memory_percent: float = 0.0,
        recovery_time_sec: float = 0.0,
        residual_corruption: bool = False,
        collapse_scenarios: int = 0,
        architectural_weakness_count: int = 0,
        single_points_of_failure: int = 0,
    ) -> OperationalScores:
        self._breakdowns = []

        runtime_stability = self._calc_runtime_stability(
            runtime_score, eventloop_latency_ms, stuck_workers, cpu_percent, memory_percent
        )
        browser_stability = self._calc_browser_stability(browser_score, websocket_zombies)
        recovery_reliability = self._calc_recovery_reliability(
            recovery_time_sec, residual_corruption, websocket_score
        )
        collapse_probability = self._calc_collapse_probability(
            retry_storms, failed_executions, queue_depth,
            collapse_scenarios, architectural_weakness_count,
        )
        operational_risk = self._calc_operational_risk(
            runtime_stability, browser_stability, collapse_probability,
            failed_executions, stuck_workers,
        )
        scalability_risk = self._calc_scalability_risk(
            queue_depth, websocket_zombies, eventloop_latency_ms, provider_score
        )
        architecture_fragility = self._calc_architecture_fragility(
            architectural_weakness_count, single_points_of_failure, collapse_probability
        )
        chaos_resilience = self._calc_chaos_resilience(
            runtime_stability, browser_stability, recovery_reliability,
            provider_score, memory_score,
        )
        production_survival = self._calc_production_survival(
            runtime_stability, browser_stability, recovery_reliability,
            collapse_probability, operational_risk,
        )

        return OperationalScores(
            production_survival=production_survival,
            runtime_stability=runtime_stability,
            browser_stability=browser_stability,
            recovery_reliability=recovery_reliability,
            collapse_probability=collapse_probability,
            operational_risk=operational_risk,
            scalability_risk=scalability_risk,
            architecture_fragility=architecture_fragility,
            chaos_resilience=chaos_resilience,
        )

    def _calc_runtime_stability(
        self,
        runtime_score: float,
        eventloop_latency_ms: float,
        stuck_workers: int,
        cpu_percent: float,
        memory_percent: float,
    ) -> float:
        score = runtime_score
        penalty = 0.0
        factors: list[str] = []

        if eventloop_latency_ms > 500:
            d = 20.0; factors.append(f"eventloop saturated: {eventloop_latency_ms:.0f}ms")
        elif eventloop_latency_ms > 100:
            d = 10.0; factors.append(f"eventloop elevated: {eventloop_latency_ms:.0f}ms")
        else:
            d = 0.0
        penalty += d; score -= d

        if stuck_workers > 0:
            d = min(20.0, stuck_workers * 5.0)
            factors.append(f"{stuck_workers} stuck workers")
            penalty += d; score -= d

        if cpu_percent > 90:
            d = 15.0; factors.append(f"CPU critical: {cpu_percent:.0f}%")
            penalty += d; score -= d
        elif cpu_percent > 75:
            d = 7.0; factors.append(f"CPU elevated: {cpu_percent:.0f}%")
            penalty += d; score -= d

        if memory_percent > 90:
            d = 15.0; factors.append(f"Memory critical: {memory_percent:.0f}%")
            penalty += d; score -= d
        elif memory_percent > 75:
            d = 7.0; factors.append(f"Memory elevated: {memory_percent:.0f}%")
            penalty += d; score -= d

        self._breakdowns.append(ScoreBreakdown("runtime_stability", max(0.0, score), penalty, factors))
        return max(0.0, min(100.0, score))

    def _calc_browser_stability(self, browser_score: float, websocket_zombies: int) -> float:
        score = browser_score
        penalty = 0.0
        factors: list[str] = []
        if websocket_zombies > 0:
            d = min(20.0, websocket_zombies * 4.0)
            factors.append(f"{websocket_zombies} zombie websockets")
            penalty += d; score -= d
        self._breakdowns.append(ScoreBreakdown("browser_stability", max(0.0, score), penalty, factors))
        return max(0.0, min(100.0, score))

    def _calc_recovery_reliability(
        self, recovery_time_sec: float, residual_corruption: bool, websocket_score: float
    ) -> float:
        score = 100.0
        penalty = 0.0
        factors: list[str] = []
        if recovery_time_sec > 300:
            d = 40.0; factors.append(f"recovery > 5min: {recovery_time_sec:.0f}s")
            penalty += d; score -= d
        elif recovery_time_sec > 60:
            d = 20.0; factors.append(f"recovery slow: {recovery_time_sec:.0f}s")
            penalty += d; score -= d
        elif recovery_time_sec > 10:
            d = 8.0; factors.append(f"recovery elevated: {recovery_time_sec:.0f}s")
            penalty += d; score -= d
        if residual_corruption:
            d = 30.0; factors.append("residual state corruption after recovery")
            penalty += d; score -= d
        ws_penalty = (100.0 - websocket_score) * 0.3
        if ws_penalty > 0:
            factors.append(f"websocket recovery weakness: {websocket_score:.0f}")
            penalty += ws_penalty; score -= ws_penalty
        self._breakdowns.append(ScoreBreakdown("recovery_reliability", max(0.0, score), penalty, factors))
        return max(0.0, min(100.0, score))

    def _calc_collapse_probability(
        self,
        retry_storms: int,
        failed_executions: int,
        queue_depth: int,
        collapse_scenarios: int,
        architectural_weakness_count: int,
    ) -> float:
        prob = 0.0
        factors: list[str] = []
        if retry_storms >= 5:
            d = 30.0; factors.append(f"retry storm active: {retry_storms}")
            prob += d
        elif retry_storms >= 1:
            prob += retry_storms * 5.0
        if failed_executions >= 10:
            d = 25.0; factors.append(f"failed executions: {failed_executions}")
            prob += d
        elif failed_executions >= 3:
            prob += failed_executions * 5.0
        if queue_depth > 1000:
            d = 20.0; factors.append(f"queue flood: {queue_depth}")
            prob += d
        elif queue_depth > 100:
            prob += queue_depth * 0.05
        if collapse_scenarios > 0:
            d = min(30.0, collapse_scenarios * 10.0)
            factors.append(f"{collapse_scenarios} collapse scenarios")
            prob += d
        if architectural_weakness_count > 0:
            d = min(25.0, architectural_weakness_count * 8.0)
            factors.append(f"{architectural_weakness_count} architectural weaknesses")
            prob += d
        penalty = prob
        self._breakdowns.append(ScoreBreakdown("collapse_probability", max(0.0, 100.0 - prob), penalty, factors))
        return max(0.0, min(100.0, prob))

    def _calc_operational_risk(
        self,
        runtime_stability: float,
        browser_stability: float,
        collapse_probability: float,
        failed_executions: int,
        stuck_workers: int,
    ) -> float:
        risk = 0.0
        factors: list[str] = []
        runtime_risk = (100.0 - runtime_stability) * 0.3
        if runtime_risk > 0:
            factors.append(f"runtime: -{runtime_stability:.0f}")
            risk += runtime_risk
        browser_risk = (100.0 - browser_stability) * 0.2
        if browser_risk > 0:
            factors.append(f"browser: -{browser_stability:.0f}")
            risk += browser_risk
        collapse_risk = collapse_probability * 0.25
        if collapse_risk > 0:
            factors.append(f"collapse prob: {collapse_probability:.0f}")
            risk += collapse_risk
        execution_risk = min(15.0, failed_executions * 3.0)
        if execution_risk > 0:
            factors.append(f"exec failures: {failed_executions}")
            risk += execution_risk
        worker_risk = min(10.0, stuck_workers * 5.0)
        if worker_risk > 0:
            factors.append(f"stuck workers: {stuck_workers}")
            risk += worker_risk
        penalty = risk
        self._breakdowns.append(ScoreBreakdown("operational_risk", max(0.0, 100.0 - risk), penalty, factors))
        return max(0.0, min(100.0, risk))

    def _calc_scalability_risk(
        self,
        queue_depth: int,
        websocket_zombies: int,
        eventloop_latency_ms: float,
        provider_score: float,
    ) -> float:
        risk = 0.0
        factors: list[str] = []
        if queue_depth > 500:
            d = 20.0; factors.append(f"queue depth: {queue_depth}")
            risk += d
        elif queue_depth > 100:
            risk += queue_depth * 0.05
        if websocket_zombies > 5:
            d = 15.0; factors.append(f"zombie ws: {websocket_zombies}")
            risk += d
        if eventloop_latency_ms > 100:
            d = 15.0; factors.append(f"eventloop: {eventloop_latency_ms:.0f}ms")
            risk += d
        provider_risk = (100.0 - provider_score) * 0.25
        if provider_risk > 0:
            factors.append(f"provider: {provider_score:.0f}")
            risk += provider_risk
        penalty = risk
        self._breakdowns.append(ScoreBreakdown("scalability_risk", max(0.0, 100.0 - risk), penalty, factors))
        return max(0.0, min(100.0, risk))

    def _calc_architecture_fragility(
        self,
        architectural_weakness_count: int,
        single_points_of_failure: int,
        collapse_probability: float,
    ) -> float:
        fragility = 0.0
        factors: list[str] = []
        if architectural_weakness_count > 0:
            d = min(35.0, architectural_weakness_count * 8.0)
            factors.append(f"{architectural_weakness_count} weaknesses")
            fragility += d
        if single_points_of_failure > 0:
            d = min(30.0, single_points_of_failure * 15.0)
            factors.append(f"{single_points_of_failure} SPOFs")
            fragility += d
        cascade_risk = collapse_probability * 0.2
        if cascade_risk > 0:
            factors.append(f"collapse cascade: {collapse_probability:.0f}")
            fragility += cascade_risk
        penalty = fragility
        self._breakdowns.append(ScoreBreakdown("architecture_fragility", max(0.0, 100.0 - fragility), penalty, factors))
        return max(0.0, min(100.0, fragility))

    def _calc_chaos_resilience(
        self,
        runtime_stability: float,
        browser_stability: float,
        recovery_reliability: float,
        provider_score: float,
        memory_score: float,
    ) -> float:
        components = [runtime_stability, browser_stability, recovery_reliability, provider_score, memory_score]
        weights = [0.25, 0.20, 0.25, 0.15, 0.15]
        resilience = sum(c * w for c, w in zip(components, weights))
        return max(0.0, min(100.0, resilience))

    def _calc_production_survival(
        self,
        runtime_stability: float,
        browser_stability: float,
        recovery_reliability: float,
        collapse_probability: float,
        operational_risk: float,
    ) -> float:
        survival = (
            runtime_stability * 0.20
            + browser_stability * 0.15
            + recovery_reliability * 0.25
            + (100.0 - collapse_probability) * 0.20
            + (100.0 - operational_risk) * 0.20
        )
        return max(0.0, min(100.0, survival))

    def get_breakdowns(self) -> list[ScoreBreakdown]:
        return list(self._breakdowns)
