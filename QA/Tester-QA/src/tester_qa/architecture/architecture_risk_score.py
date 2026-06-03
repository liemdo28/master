"""Architecture Risk Score Module - Calculates and reports architectural risk assessment."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class RiskFactor:
    """Represents an individual risk factor in the architecture."""
    category: str  # 'coupling', 'cohesion', 'scalability', 'availability', 'security'
    name: str
    score: float  # 0.0 to 1.0 (higher is worse)
    weight: float  # Relative importance
    description: str
    affected_components: List[str] = field(default_factory=list)


@dataclass
class Weakness:
    """Represents a detected architectural weakness."""
    id: str
    title: str
    description: str
    severity: str  # 'critical', 'high', 'medium', 'low'
    category: str
    affected_components: List[str] = field(default_factory=list)
    suggested_remediation: str = ""
    estimated_fix_effort: str = ""


@dataclass
class RiskReport:
    """Complete architectural risk report."""
    overall_risk_score: float  # 0.0 to 1.0 (higher is worse)
    risk_level: str  # 'critical', 'high', 'medium', 'low'
    risk_factors: List[RiskFactor]
    weaknesses: List[Weakness]
    risk_breakdown: Dict[str, float] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)


class ArchitectureRiskScore:
    """Calculates architectural risk scores and generates risk reports."""

    CATEGORY_WEIGHTS = {
        'coupling': 0.25,
        'cohesion': 0.15,
        'scalability': 0.20,
        'availability': 0.25,
        'security': 0.15
    }

    def __init__(self) -> None:
        self._risk_factors: List[RiskFactor] = []
        self._weaknesses: List[Weakness] = []
        self._category_scores: Dict[str, List[float]] = {
            'coupling': [],
            'cohesion': [],
            'scalability': [],
            'availability': [],
            'security': []
        }

    def calculate_architecture_risk(
        self,
        coupling_score: Optional[float] = None,
        cohesion_score: Optional[float] = None,
        scalability_score: Optional[float] = None,
        availability_score: Optional[float] = None,
        security_score: Optional[float] = None,
        risk_data: Optional[Dict[str, Dict]] = None
    ) -> float:
        """Calculate overall architecture risk score."""
        scores: Dict[str, float] = {}

        if coupling_score is not None:
            scores['coupling'] = coupling_score
        if cohesion_score is not None:
            scores['cohesion'] = 1.0 - cohesion_score
        if scalability_score is not None:
            scores['scalability'] = 1.0 - scalability_score
        if availability_score is not None:
            scores['availability'] = availability_score
        if security_score is not None:
            scores['security'] = security_score

        if risk_data:
            for category, data in risk_data.items():
                if 'score' in data:
                    self._category_scores[category].append(data['score'])

        weighted_sum = 0.0
        total_weight = 0.0

        for category, score in scores.items():
            weight = self.CATEGORY_WEIGHTS.get(category, 0.2)
            weighted_sum += score * weight
            total_weight += weight

        if total_weight > 0:
            overall_score = weighted_sum / total_weight
        else:
            category_scores = []
            for cat_scores in self._category_scores.values():
                if cat_scores:
                    category_scores.append(sum(cat_scores) / len(cat_scores))

            overall_score = sum(category_scores) / len(category_scores) if category_scores else 0.0

        return min(1.0, max(0.0, overall_score))

    def generate_risk_report(
        self,
        risk_data: Optional[Dict] = None
    ) -> RiskReport:
        """Generate a comprehensive risk report."""
        risk_factors: List[RiskFactor] = []
        weaknesses: List[Weakness] = []

        if risk_data:
            for category, data in risk_data.items():
                if 'factors' in data:
                    for factor in data['factors']:
                        risk_factors.append(RiskFactor(
                            category=category,
                            name=factor.get('name', ''),
                            score=factor.get('score', 0.5),
                            weight=factor.get('weight', 0.2),
                            description=factor.get('description', ''),
                            affected_components=factor.get('affected', [])
                        ))

                if 'weaknesses' in data:
                    for idx, weakness in enumerate(data['weaknesses']):
                        weaknesses.append(Weakness(
                            id=f"{category}_weak_{idx}",
                            title=weakness.get('title', ''),
                            description=weakness.get('description', ''),
                            severity=weakness.get('severity', 'medium'),
                            category=category,
                            affected_components=weakness.get('affected', []),
                            suggested_remediation=weakness.get('fix', ''),
                            estimated_fix_effort=weakness.get('effort', '')
                        ))

        risk_factors.extend(self._risk_factors)
        weaknesses.extend(self._weaknesses)

        breakdown = self._calculate_risk_breakdown(risk_factors)

        overall_score = 0.0
        for category, score in breakdown.items():
            weight = self.CATEGORY_WEIGHTS.get(category, 0.2)
            overall_score += score * weight

        risk_level = self._determine_risk_level(overall_score)
        recommendations = self._generate_recommendations(weaknesses, breakdown)

        return RiskReport(
            overall_risk_score=overall_score,
            risk_level=risk_level,
            risk_factors=risk_factors,
            weaknesses=weaknesses,
            risk_breakdown=breakdown,
            recommendations=recommendations
        )

    def identify_weaknesses(
        self,
        weaknesses: Optional[List[Dict]] = None
    ) -> List[Weakness]:
        """Identify and catalog architectural weaknesses."""
        identified: List[Weakness] = []

        if weaknesses:
            for idx, weak_data in enumerate(weaknesses):
                identified.append(Weakness(
                    id=weak_data.get('id', f'weak_{idx}'),
                    title=weak_data.get('title', ''),
                    description=weak_data.get('description', ''),
                    severity=weak_data.get('severity', 'medium'),
                    category=weak_data.get('category', 'general'),
                    affected_components=weak_data.get('affected', []),
                    suggested_remediation=weak_data.get('remediation', ''),
                    estimated_fix_effort=weak_data.get('effort', '')
                ))

        identified.sort(
            key=lambda w: self._severity_to_score(w.severity),
            reverse=True
        )

        self._weaknesses.extend(identified)
        return identified

    def add_risk_factor(
        self,
        category: str,
        name: str,
        score: float,
        description: str = "",
        weight: float = 0.2,
        affected: Optional[List[str]] = None
    ) -> None:
        """Add a risk factor to the analysis."""
        factor = RiskFactor(
            category=category,
            name=name,
            score=score,
            weight=weight,
            description=description,
            affected_components=affected or []
        )
        self._risk_factors.append(factor)
        self._category_scores[category].append(score)

    def add_weakness(
        self,
        title: str,
        description: str,
        severity: str,
        category: str = 'general',
        affected: Optional[List[str]] = None,
        remediation: str = "",
        effort: str = ""
    ) -> None:
        """Add a weakness to track."""
        weakness_id = f"{category}_{len(self._weaknesses)}"
        self._weaknesses.append(Weakness(
            id=weakness_id,
            title=title,
            description=description,
            severity=severity,
            category=category,
            affected_components=affected or [],
            suggested_remediation=remediation,
            estimated_fix_effort=effort
        ))

    def _calculate_risk_breakdown(
        self,
        factors: List[RiskFactor]
    ) -> Dict[str, float]:
        """Calculate risk scores by category."""
        breakdown: Dict[str, float] = {}

        for category in self.CATEGORY_WEIGHTS:
            category_factors = [
                f.score for f in factors
                if f.category == category
            ]

            if category_factors:
                breakdown[category] = sum(category_factors) / len(category_factors)
            else:
                breakdown[category] = 0.0

        return breakdown

    def _determine_risk_level(self, score: float) -> str:
        """Determine risk level from score."""
        if score >= 0.8:
            return 'critical'
        elif score >= 0.6:
            return 'high'
        elif score >= 0.4:
            return 'medium'
        return 'low'

    def _severity_to_score(self, severity: str) -> float:
        """Convert severity to numeric score."""
        scores = {
            'critical': 1.0,
            'high': 0.75,
            'medium': 0.5,
            'low': 0.25
        }
        return scores.get(severity, 0.5)

    def _generate_recommendations(
        self,
        weaknesses: List[Weakness],
        breakdown: Dict[str, float]
    ) -> List[str]:
        """Generate recommendations based on identified issues."""
        recommendations: List[str] = []

        high_risk_cats = [
            cat for cat, score in breakdown.items()
            if score >= 0.7
        ]
        for cat in high_risk_cats:
            recommendations.append(
                f"Urgent: Address {cat} issues to reduce architectural risk"
            )

        critical_weaknesses = [w for w in weaknesses if w.severity == 'critical']
        if critical_weaknesses:
            recommendations.append(
                f"Fix {len(critical_weaknesses)} critical weaknesses immediately"
            )

        if breakdown.get('coupling', 0) > 0.6:
            recommendations.append(
                "Reduce coupling by introducing interfaces and event-driven communication"
            )

        if breakdown.get('cohesion', 0) > 0.6:
            recommendations.append(
                "Improve cohesion by refactoring modules to have single responsibility"
            )

        if breakdown.get('scalability', 0) > 0.6:
            recommendations.append(
                "Address scalability bottlenecks before traffic increases"
            )

        return recommendations
