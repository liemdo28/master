from __future__ import annotations

from dataclasses import dataclass, field

from tester_qa.models import Severity


@dataclass(frozen=True)
class AuditFinding:
    category: str
    severity: Severity
    title: str
    evidence: list[str] = field(default_factory=list)
    impact: str = "Pending impact assessment."
    recommendation: str = "Investigate and remediate before release."

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "severity": self.severity.value,
            "title": self.title,
            "evidence": self.evidence,
            "impact": self.impact,
            "recommendation": self.recommendation,
        }


@dataclass(frozen=True)
class AuditReport:
    project: str
    findings: list[AuditFinding]

    @property
    def risk_level(self) -> Severity:
        order = {
            Severity.OBSERVATIONAL: 0,
            Severity.LOW: 1,
            Severity.MEDIUM: 2,
            Severity.HIGH: 3,
            Severity.CRITICAL: 4,
        }
        return max((finding.severity for finding in self.findings), default=Severity.LOW, key=lambda item: order[item])

    def to_dict(self) -> dict:
        return {
            "project": self.project,
            "risk_level": self.risk_level.value,
            "findings": [finding.to_dict() for finding in self.findings],
        }
