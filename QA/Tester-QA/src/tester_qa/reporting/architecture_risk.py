from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WeakPoint:
    component: str
    risk_type: str
    severity: str
    description: str
    mitigation: str = ""


@dataclass
class RiskRecommendation:
    priority: int
    action: str
    rationale: str
    effort: str = "medium"
    impact: str = "medium"


@dataclass
class ArchitectureRiskData:
    title: str
    overall_risk_score: float
    weak_points: list[WeakPoint] = field(default_factory=list)
    recommendations: list[RiskRecommendation] = field(default_factory=list)
    risk_breakdown: dict[str, float] = field(default_factory=dict)
    summary: str = ""


@dataclass
class ComponentRisk:
    component: str
    single_point_of_failure: bool = False
    coupling_score: float = 0.0
    dependency_count: int = 0
    dependent_count: int = 0
    has_fallback: bool = True
    has_circuit_breaker: bool = True
    has_retry_logic: bool = True
    has_health_check: bool = True


class ArchitectureRiskReport:
    """Assesses architectural risk and identifies weak points in the system."""

    def __init__(self) -> None:
        self._components: list[ComponentRisk] = []
        self._weak_points: list[WeakPoint] = []

    def add_component(self, component: ComponentRisk) -> None:
        """Register a component for risk assessment."""
        self._components.append(component)

    def assess_risk(
        self,
        components: Optional[list[ComponentRisk]] = None,
    ) -> ArchitectureRiskData:
        """Perform a full architecture risk assessment."""
        if components is not None:
            self._components = components

        self._weak_points = self.find_weak_points()
        risk_score = self.calculate_risk_score()
        recommendations = self.generate_recommendations()

        risk_breakdown: dict[str, float] = {}
        for component in self._components:
            risk_breakdown[component.component] = self._component_risk_score(component)

        summary = self._generate_summary(risk_score)

        return ArchitectureRiskData(
            title="Architecture Risk Assessment",
            overall_risk_score=risk_score,
            weak_points=self._weak_points,
            recommendations=recommendations,
            risk_breakdown=risk_breakdown,
            summary=summary,
        )

    def find_weak_points(self) -> list[WeakPoint]:
        """Identify architectural weak points across all components."""
        weak_points: list[WeakPoint] = []

        for component in self._components:
            if component.single_point_of_failure:
                weak_points.append(WeakPoint(
                    component=component.component,
                    risk_type="single_point_of_failure",
                    severity="critical",
                    description=f"{component.component} is a single point of failure with {component.dependent_count} dependents.",
                    mitigation="Introduce redundancy or failover mechanisms.",
                ))

            if component.coupling_score > 0.7:
                weak_points.append(WeakPoint(
                    component=component.component,
                    risk_type="high_coupling",
                    severity="high",
                    description=f"{component.component} has high coupling score ({component.coupling_score:.2f}).",
                    mitigation="Decouple through interfaces, message queues, or event-driven patterns.",
                ))

            if not component.has_fallback:
                weak_points.append(WeakPoint(
                    component=component.component,
                    risk_type="no_fallback",
                    severity="medium",
                    description=f"{component.component} has no fallback mechanism.",
                    mitigation="Implement graceful degradation or fallback behavior.",
                ))

            if not component.has_circuit_breaker and component.dependency_count > 0:
                weak_points.append(WeakPoint(
                    component=component.component,
                    risk_type="no_circuit_breaker",
                    severity="medium",
                    description=f"{component.component} lacks circuit breaker protection.",
                    mitigation="Add circuit breaker pattern to prevent cascade failures.",
                ))

            if not component.has_health_check:
                weak_points.append(WeakPoint(
                    component=component.component,
                    risk_type="no_health_check",
                    severity="low",
                    description=f"{component.component} has no health check endpoint.",
                    mitigation="Implement health check for observability and auto-recovery.",
                ))

        return sorted(weak_points, key=lambda w: {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(w.severity, 4))

    def calculate_risk_score(self) -> float:
        """Calculate an overall architecture risk score (0-100)."""
        if not self._components:
            return 0.0

        component_scores = [self._component_risk_score(c) for c in self._components]
        avg_score = sum(component_scores) / len(component_scores)

        spof_count = sum(1 for c in self._components if c.single_point_of_failure)
        spof_penalty = min(30.0, spof_count * 10.0)

        high_coupling_count = sum(1 for c in self._components if c.coupling_score > 0.7)
        coupling_penalty = min(20.0, high_coupling_count * 5.0)

        return max(0.0, min(100.0, avg_score + spof_penalty + coupling_penalty))

    def generate_recommendations(self) -> list[RiskRecommendation]:
        """Generate prioritized recommendations based on identified risks."""
        recommendations: list[RiskRecommendation] = []
        priority = 1

        spof_components = [c for c in self._components if c.single_point_of_failure]
        if spof_components:
            for comp in spof_components:
                recommendations.append(RiskRecommendation(
                    priority=priority,
                    action=f"Eliminate single point of failure: {comp.component}",
                    rationale=f"{comp.component} has {comp.dependent_count} dependents and no redundancy.",
                    effort="high",
                    impact="critical",
                ))
                priority += 1

        no_cb_components = [c for c in self._components if not c.has_circuit_breaker and c.dependency_count > 0]
        if no_cb_components:
            recommendations.append(RiskRecommendation(
                priority=priority,
                action=f"Add circuit breakers to: {', '.join(c.component for c in no_cb_components)}",
                rationale="Prevent cascade failures when dependencies become unavailable.",
                effort="medium",
                impact="high",
            ))
            priority += 1

        high_coupling = [c for c in self._components if c.coupling_score > 0.7]
        if high_coupling:
            recommendations.append(RiskRecommendation(
                priority=priority,
                action=f"Reduce coupling in: {', '.join(c.component for c in high_coupling)}",
                rationale="High coupling increases blast radius and makes changes risky.",
                effort="high",
                impact="high",
            ))
            priority += 1

        no_fallback = [c for c in self._components if not c.has_fallback]
        if no_fallback:
            recommendations.append(RiskRecommendation(
                priority=priority,
                action=f"Implement fallbacks for: {', '.join(c.component for c in no_fallback)}",
                rationale="Graceful degradation improves user experience during partial outages.",
                effort="medium",
                impact="medium",
            ))
            priority += 1

        return recommendations

    def _component_risk_score(self, component: ComponentRisk) -> float:
        """Calculate risk score for a single component."""
        score = 0.0

        if component.single_point_of_failure:
            score += 30.0

        score += component.coupling_score * 20.0

        if not component.has_fallback:
            score += 10.0
        if not component.has_circuit_breaker:
            score += 10.0
        if not component.has_retry_logic:
            score += 5.0
        if not component.has_health_check:
            score += 5.0

        dep_risk = min(20.0, component.dependency_count * 3.0)
        score += dep_risk

        return max(0.0, min(100.0, score))

    def _generate_summary(self, risk_score: float) -> str:
        """Generate a summary of the architecture risk assessment."""
        if risk_score >= 75:
            level = "Critical"
            desc = "Architecture has significant structural risks requiring immediate attention."
        elif risk_score >= 50:
            level = "High"
            desc = "Architecture has notable risks that should be addressed in the near term."
        elif risk_score >= 25:
            level = "Moderate"
            desc = "Architecture has some risks but is generally sound."
        else:
            level = "Low"
            desc = "Architecture is well-structured with minimal identified risks."

        return (
            f"Risk Level: {level} (Score: {risk_score:.1f}/100). "
            f"{desc} "
            f"Components assessed: {len(self._components)}. "
            f"Weak points identified: {len(self._weak_points)}."
        )
