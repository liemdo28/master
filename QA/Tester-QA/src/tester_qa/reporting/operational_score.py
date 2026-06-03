from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class StabilityScores:
    runtime: float = 100.0
    browser: float = 100.0
    websocket: float = 100.0
    provider: float = 100.0
    memory: float = 100.0


@dataclass
class OperationalScoreReport:
    overall_score: float
    stability_scores: StabilityScores
    failure_probability: float
    risk_level: str
    contributing_factors: list[str] = field(default_factory=list)


class OperationalScore:
    """Calculates composite operational scores and predicts failure probability."""

    def __init__(
        self,
        weights: Optional[dict[str, float]] = None,
    ) -> None:
        self._weights = weights or {
            "runtime": 0.25,
            "browser": 0.20,
            "websocket": 0.20,
            "provider": 0.20,
            "memory": 0.15,
        }
        self._history: list[tuple[float, float]] = []

    def calculate_score(
        self,
        stability_scores: Optional[StabilityScores] = None,
        runtime: float = 100.0,
        browser: float = 100.0,
        websocket: float = 100.0,
        provider: float = 100.0,
        memory: float = 100.0,
    ) -> OperationalScoreReport:
        """Calculate the composite operational score from component stability scores."""
        if stability_scores is not None:
            scores = stability_scores
        else:
            scores = StabilityScores(
                runtime=runtime,
                browser=browser,
                websocket=websocket,
                provider=provider,
                memory=memory,
            )

        score_map = {
            "runtime": scores.runtime,
            "browser": scores.browser,
            "websocket": scores.websocket,
            "provider": scores.provider,
            "memory": scores.memory,
        }

        weighted_sum = 0.0
        total_weight = 0.0
        for component, weight in self._weights.items():
            component_score = score_map.get(component, 100.0)
            weighted_sum += component_score * weight
            total_weight += weight

        overall_score = weighted_sum / total_weight if total_weight > 0 else 0.0
        overall_score = max(0.0, min(100.0, overall_score))

        failure_probability = self.predict_failure_probability(scores)

        if overall_score >= 80:
            risk_level = "low"
        elif overall_score >= 60:
            risk_level = "moderate"
        elif overall_score >= 40:
            risk_level = "high"
        else:
            risk_level = "critical"

        contributing_factors = self._identify_contributing_factors(score_map)

        import time
        self._history.append((time.time(), overall_score))

        return OperationalScoreReport(
            overall_score=overall_score,
            stability_scores=scores,
            failure_probability=failure_probability,
            risk_level=risk_level,
            contributing_factors=contributing_factors,
        )

    def get_stability_scores(
        self,
        runtime: float = 100.0,
        browser: float = 100.0,
        websocket: float = 100.0,
        provider: float = 100.0,
        memory: float = 100.0,
    ) -> StabilityScores:
        """Create a StabilityScores instance from individual component scores."""
        return StabilityScores(
            runtime=max(0.0, min(100.0, runtime)),
            browser=max(0.0, min(100.0, browser)),
            websocket=max(0.0, min(100.0, websocket)),
            provider=max(0.0, min(100.0, provider)),
            memory=max(0.0, min(100.0, memory)),
        )

    def predict_failure_probability(self, scores: StabilityScores) -> float:
        """Predict the probability of system failure based on stability scores."""
        score_values = [
            scores.runtime,
            scores.browser,
            scores.websocket,
            scores.provider,
            scores.memory,
        ]

        min_score = min(score_values)
        avg_score = sum(score_values) / len(score_values)

        base_probability = 1.0 - (avg_score / 100.0)

        weakest_link_factor = 1.0 - (min_score / 100.0)

        low_scores = sum(1 for s in score_values if s < 50.0)
        cascade_factor = low_scores * 0.05

        trend_factor = 0.0
        if len(self._history) >= 3:
            recent_scores = [s for _, s in self._history[-3:]]
            if recent_scores[0] > 0:
                trend = (recent_scores[-1] - recent_scores[0]) / recent_scores[0]
                if trend < -0.1:
                    trend_factor = abs(trend) * 0.2

        probability = (
            base_probability * 0.3
            + weakest_link_factor * 0.4
            + cascade_factor
            + trend_factor
        )

        probability = max(0.0, min(1.0, probability))

        return round(probability, 4)

    def _identify_contributing_factors(self, score_map: dict[str, float]) -> list[str]:
        """Identify which components are contributing to risk."""
        factors: list[str] = []

        for component, score in sorted(score_map.items(), key=lambda x: x[1]):
            if score < 50.0:
                factors.append(f"{component} is critically degraded (score: {score:.1f})")
            elif score < 70.0:
                factors.append(f"{component} is below acceptable threshold (score: {score:.1f})")
            elif score < 85.0:
                factors.append(f"{component} showing early signs of degradation (score: {score:.1f})")

        return factors

    def get_score_history(self) -> list[tuple[float, float]]:
        """Return the history of operational scores over time."""
        return list(self._history)
