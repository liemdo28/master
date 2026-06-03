from __future__ import annotations

from dataclasses import dataclass, field

from tester_qa.models import Severity
from tester_qa.reporting.executive import ExecutiveReport, render_standard_report


@dataclass(frozen=True)
class BrowserInspectionReport:
    url: str
    status: str
    screenshot_paths: list[str] = field(default_factory=list)
    console_errors: list[str] = field(default_factory=list)
    network_failures: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)
    severity: Severity = Severity.LOW


def render_browser_report(report: BrowserInspectionReport) -> str:
    return render_standard_report(
        ExecutiveReport(
            title=f"Browser Inspection: {report.url}",
            system_status=report.status,
            evidence=[*report.screenshot_paths, *report.console_errors, *report.network_failures],
            findings=report.findings,
            risk_level=report.severity,
            recommended_fix=["Resolve console/network failures and verify dashboard state stability."],
            validation_plan=["Re-run browser inspection and compare screenshot, console, and network evidence."],
            decision_required=["Confirm whether this issue blocks release or can be tracked as degraded UX."],
            next_actions=["Attach evidence to incident if severity is medium or higher."],
        )
    )
