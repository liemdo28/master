"""Intelligence Coordinator — Central Failure Intelligence Hub"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Optional

from tester_qa.intelligence.recurring_failure import RecurringFailureDetector
from tester_qa.intelligence.flaky_detector import FlakyDetector
from tester_qa.intelligence.instability_predictor import InstabilityPredictor
from tester_qa.intelligence.pattern_learning import PatternLearner
from tester_qa.intelligence.architectural_weakness import ArchitecturalWeaknessDetector
from tester_qa.intelligence.regression_memory import RegressionMemory


@dataclass
class IntelligenceBriefing:
    """Unified intelligence output — executive-grade failure prediction."""

    most_likely_next_failure: str
    highest_collapse_probability: float
    highest_retry_storm_risk: str
    most_unstable_architecture_path: str
    most_dangerous_provider_dependency: str
    recurring_failures: list[dict[str, Any]]
    flaky_tests: list[dict[str, Any]]
    instability_forecast: dict[str, Any]
    known_patterns: list[dict[str, Any]]
    architectural_weaknesses: list[dict[str, Any]]
    regression_risks: list[dict[str, Any]]
    timestamp: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "predictions": {
                "most_likely_next_failure": self.most_likely_next_failure,
                "highest_collapse_probability": self.highest_collapse_probability,
                "highest_retry_storm_risk": self.highest_retry_storm_risk,
                "most_unstable_architecture_path": self.most_unstable_architecture_path,
                "most_dangerous_provider_dependency": self.most_dangerous_provider_dependency,
            },
            "recurring_failures": self.recurring_failures,
            "flaky_tests": self.flaky_tests,
            "instability_forecast": self.instability_forecast,
            "known_patterns": self.known_patterns,
            "architectural_weaknesses": self.architectural_weaknesses,
            "regression_risks": self.regression_risks,
            "timestamp": self.timestamp,
        }


class IntelligenceCoordinator:
    """Aggregates all failure intelligence modules into unified predictions."""

    def __init__(self) -> None:
        self.recurring = RecurringFailureDetector()
        self.flaky = FlakyDetector()
        self.instability = InstabilityPredictor()
        self.patterns = PatternLearner()
        self.architecture = ArchitecturalWeaknessDetector()
        self.regression = RegressionMemory()
        self._briefing_history: list[IntelligenceBriefing] = []

    def generate_briefing(self) -> IntelligenceBriefing:
        """Generate a unified intelligence briefing from all modules."""
        recurring = self.recurring.get_recurring_failures()
        flaky = self.flaky.detect_flaky_tests()
        forecast = self.instability.get_risk_forecast()
        patterns = self.patterns.get_known_patterns()
        weaknesses = (
            self.architecture.detect_weaknesses()
            if hasattr(self.architecture, "detect_weaknesses")
            else []
        )
        regressions = (
            self.regression.get_regression_risks()
            if hasattr(self.regression, "get_regression_risks")
            else []
        )

        most_likely_failure = self._predict_next_failure(recurring, forecast)
        collapse_prob = self._estimate_collapse_probability(forecast, weaknesses)
        retry_risk = self._assess_retry_storm_risk(recurring, patterns)
        unstable_path = self._find_most_unstable_path(weaknesses, forecast)
        dangerous_provider = self._find_dangerous_provider(recurring, patterns)

        briefing = IntelligenceBriefing(
            most_likely_next_failure=most_likely_failure,
            highest_collapse_probability=collapse_prob,
            highest_retry_storm_risk=retry_risk,
            most_unstable_architecture_path=unstable_path,
            most_dangerous_provider_dependency=dangerous_provider,
            recurring_failures=recurring if isinstance(recurring, list) else [],
            flaky_tests=flaky if isinstance(flaky, list) else [],
            instability_forecast=forecast if isinstance(forecast, dict) else {},
            known_patterns=patterns if isinstance(patterns, list) else [],
            architectural_weaknesses=weaknesses if isinstance(weaknesses, list) else [],
            regression_risks=regressions if isinstance(regressions, list) else [],
        )
        self._briefing_history.append(briefing)
        return briefing

    def get_predictions(self) -> dict[str, Any]:
        """Quick predictions without full briefing."""
        briefing = self.generate_briefing()
        return briefing.to_dict()["predictions"]

    def get_briefing_history(self) -> list[IntelligenceBriefing]:
        return list(self._briefing_history)

    def _predict_next_failure(self, recurring: Any, forecast: Any) -> str:
        if isinstance(recurring, list) and recurring:
            top = recurring[0]
            if isinstance(top, dict):
                return top.get("pattern", top.get("description", "Unknown recurring failure"))
            return str(top)
        if isinstance(forecast, dict) and forecast.get("risk_level", "low") != "low":
            return f"Instability predicted: {forecast.get('risk_level', 'unknown')} risk"
        return "No imminent failure predicted"

    def _estimate_collapse_probability(self, forecast: Any, weaknesses: Any) -> float:
        base = 0.0
        if isinstance(forecast, dict):
            risk_map = {"low": 0.1, "medium": 0.3, "high": 0.6, "critical": 0.85}
            base = risk_map.get(forecast.get("risk_level", "low"), 0.1)
        if isinstance(weaknesses, list):
            base += len(weaknesses) * 0.05
        return min(1.0, base)

    def _assess_retry_storm_risk(self, recurring: Any, patterns: Any) -> str:
        retry_related = 0
        for source in [recurring, patterns]:
            if isinstance(source, list):
                for item in source:
                    if isinstance(item, dict) and "retry" in str(item).lower():
                        retry_related += 1
        if retry_related >= 3:
            return "CRITICAL — multiple retry-related patterns detected"
        elif retry_related >= 1:
            return "ELEVATED — retry patterns present"
        return "LOW — no retry storm indicators"

    def _find_most_unstable_path(self, weaknesses: Any, forecast: Any) -> str:
        if isinstance(weaknesses, list) and weaknesses:
            top = weaknesses[0]
            if isinstance(top, dict):
                return top.get("path", top.get("component", "Unknown path"))
            return str(top)
        return "No unstable paths identified"

    def _find_dangerous_provider(self, recurring: Any, patterns: Any) -> str:
        providers_mentioned: dict[str, int] = {}
        for source in [recurring, patterns]:
            if isinstance(source, list):
                for item in source:
                    text = str(item).lower()
                    for provider in ["openai", "anthropic", "google", "azure", "aws", "api"]:
                        if provider in text:
                            providers_mentioned[provider] = (
                                providers_mentioned.get(provider, 0) + 1
                            )
        if providers_mentioned:
            most_dangerous = max(providers_mentioned, key=providers_mentioned.get)  # type: ignore[arg-type]
            return f"{most_dangerous} (mentioned {providers_mentioned[most_dangerous]} times in failure data)"
        return "No dangerous provider dependency identified"
