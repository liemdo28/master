from __future__ import annotations

from tester_qa.audit.models import AuditReport
from tester_qa.reporting.executive import ExecutiveReport, render_standard_report


def render_audit_report(report: AuditReport) -> str:
    return render_standard_report(
        ExecutiveReport(
            title=f"Engineering Audit Report: {report.project}",
            system_status=f"Audit completed. Risk level: {report.risk_level.value.upper()}.",
            evidence=[evidence for finding in report.findings for evidence in finding.evidence],
            findings=[f"[{finding.severity.value.upper()}] {finding.category}: {finding.title}" for finding in report.findings],
            root_cause="Audit findings indicate validation, configuration, dependency, security, or runtime readiness gaps.",
            risk_level=report.risk_level,
            impact="Unresolved audit findings reduce release confidence and increase operational failure probability.",
            recommended_fix=[finding.recommendation for finding in report.findings] or ["No remediation required."],
            validation_plan=["Re-run audit after remediation and attach evidence to release gate."],
            decision_required=["Confirm whether high-risk findings block release."],
            next_actions=["Prioritize high and critical findings."],
        )
    )
