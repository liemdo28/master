from __future__ import annotations

from dataclasses import dataclass, field

from tester_qa.models import Severity
from tester_qa.reporting.common import render_list


@dataclass(frozen=True)
class ExecutiveReport:
    title: str
    system_status: str
    evidence: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)
    root_cause: str = "Pending."
    risk_level: Severity = Severity.MEDIUM
    impact: str = "Pending impact assessment."
    recommended_fix: list[str] = field(default_factory=list)
    validation_plan: list[str] = field(default_factory=list)
    decision_required: list[str] = field(default_factory=list)
    next_actions: list[str] = field(default_factory=list)


def render_standard_report(report: ExecutiveReport) -> str:
    return "\n".join(
        [
            f"# {report.title}",
            "",
            "# Executive Summary",
            report.system_status,
            "",
            "# System Status",
            report.system_status,
            "",
            "# Evidence",
            render_list(report.evidence),
            "",
            "# Findings",
            render_list(report.findings),
            "",
            "# Root Cause",
            report.root_cause,
            "",
            "# Risk Level",
            report.risk_level.value.upper(),
            "",
            "# Impact",
            report.impact,
            "",
            "# Recommended Fix",
            render_list(report.recommended_fix),
            "",
            "# Validation Plan",
            render_list(report.validation_plan),
            "",
            "# Decision Required",
            render_list(report.decision_required),
            "",
            "# Next Actions",
            render_list(report.next_actions),
        ]
    )
