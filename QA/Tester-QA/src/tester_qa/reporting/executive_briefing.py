from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Finding:
    title: str
    severity: str
    description: str
    affected_systems: list[str] = field(default_factory=list)
    recommendation: str = ""


@dataclass
class Briefing:
    title: str
    generated_at: float
    operational_risk_score: float
    overall_status: str
    findings: list[Finding] = field(default_factory=list)
    summary: str = ""
    recommendations: list[str] = field(default_factory=list)
    next_steps: list[str] = field(default_factory=list)


class ExecutiveBriefing:
    """Generates executive-level briefings with operational risk scoring."""

    def __init__(self) -> None:
        self._findings: list[Finding] = []
        self._system_scores: dict[str, float] = {}

    def add_finding(self, finding: Finding) -> None:
        """Add a finding to the briefing."""
        self._findings.append(finding)

    def set_system_score(self, system: str, score: float) -> None:
        """Set a health score for a specific system."""
        self._system_scores[system] = max(0.0, min(100.0, score))

    def generate_briefing(
        self,
        title: str = "Executive Briefing",
        findings: Optional[list[Finding]] = None,
        system_scores: Optional[dict[str, float]] = None,
    ) -> Briefing:
        """Generate a complete executive briefing."""
        if findings is not None:
            self._findings = findings
        if system_scores is not None:
            self._system_scores = system_scores

        risk_score = self.calculate_operational_risk_score()
        summary = self.summarize_findings()

        if risk_score >= 75:
            overall_status = "critical"
        elif risk_score >= 50:
            overall_status = "at_risk"
        elif risk_score >= 25:
            overall_status = "degraded"
        else:
            overall_status = "healthy"

        recommendations = self._generate_recommendations()
        next_steps = self._generate_next_steps(overall_status)

        return Briefing(
            title=title,
            generated_at=time.time(),
            operational_risk_score=risk_score,
            overall_status=overall_status,
            findings=list(self._findings),
            summary=summary,
            recommendations=recommendations,
            next_steps=next_steps,
        )

    def calculate_operational_risk_score(self) -> float:
        """Calculate an operational risk score from 0 (no risk) to 100 (critical risk)."""
        if not self._findings and not self._system_scores:
            return 0.0

        score = 0.0

        severity_weights = {
            "critical": 25.0,
            "high": 15.0,
            "medium": 8.0,
            "low": 3.0,
        }

        finding_score = 0.0
        for finding in self._findings:
            weight = severity_weights.get(finding.severity.lower(), 5.0)
            finding_score += weight

        finding_score = min(60.0, finding_score)
        score += finding_score

        if self._system_scores:
            avg_system_health = sum(self._system_scores.values()) / len(self._system_scores)
            system_risk = (100.0 - avg_system_health) * 0.4
            score += system_risk

        return max(0.0, min(100.0, score))

    def summarize_findings(self) -> str:
        """Generate a human-readable summary of all findings."""
        if not self._findings:
            return "No findings to report. All systems operating within normal parameters."

        severity_counts: dict[str, int] = {}
        for finding in self._findings:
            sev = finding.severity.lower()
            severity_counts[sev] = severity_counts.get(sev, 0) + 1

        parts: list[str] = []
        parts.append(f"Total findings: {len(self._findings)}.")

        for sev in ("critical", "high", "medium", "low"):
            count = severity_counts.get(sev, 0)
            if count > 0:
                parts.append(f"{sev.capitalize()}: {count}.")

        affected: set[str] = set()
        for finding in self._findings:
            affected.update(finding.affected_systems)

        if affected:
            parts.append(f"Affected systems: {', '.join(sorted(affected))}.")

        return " ".join(parts)

    def _generate_recommendations(self) -> list[str]:
        """Generate recommendations based on findings."""
        recommendations: list[str] = []

        critical_findings = [f for f in self._findings if f.severity.lower() == "critical"]
        if critical_findings:
            recommendations.append("Immediate action required for critical findings.")
            for finding in critical_findings:
                if finding.recommendation:
                    recommendations.append(finding.recommendation)

        high_findings = [f for f in self._findings if f.severity.lower() == "high"]
        if high_findings:
            recommendations.append("Schedule remediation for high-severity findings within 24 hours.")

        for system, score in self._system_scores.items():
            if score < 50.0:
                recommendations.append(f"Investigate degraded system: {system} (score: {score:.1f}).")

        return recommendations

    def _generate_next_steps(self, status: str) -> list[str]:
        """Generate next steps based on overall status."""
        if status == "critical":
            return [
                "Convene incident response team.",
                "Assess blast radius of critical findings.",
                "Implement immediate mitigations.",
                "Schedule post-incident review.",
            ]
        elif status == "at_risk":
            return [
                "Prioritize remediation of high-severity findings.",
                "Increase monitoring frequency.",
                "Review system dependencies.",
            ]
        elif status == "degraded":
            return [
                "Monitor affected systems closely.",
                "Plan remediation during next maintenance window.",
            ]
        else:
            return ["Continue routine monitoring."]
