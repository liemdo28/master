from __future__ import annotations

from tester_qa.models import Severity
from tester_qa.reporting.executive import ExecutiveReport, render_standard_report


def render_project_report(project: dict, health: dict) -> str:
    risk = Severity(project.get("risk_level", "medium"))
    findings = [f"{key}: {value}" for key, value in health.items()]
    return render_standard_report(
        ExecutiveReport(
            title=f"Project Report: {project.get('name', 'unknown')}",
            system_status=f"Project type: {project.get('type', 'unknown')}. Status: {project.get('status', 'unknown')}.",
            evidence=[project.get("path", "")],
            findings=findings,
            risk_level=risk,
            impact="Project health affects local engineering throughput and release confidence.",
            recommended_fix=["Address missing scripts, dependency breakage, env gaps, and port conflicts."],
            validation_plan=["Run healthcheck after remediation and archive report evidence."],
            decision_required=["Assign owner for unresolved high-risk project findings."],
            next_actions=["Prioritize projects with high risk level for stabilization."],
        )
    )
