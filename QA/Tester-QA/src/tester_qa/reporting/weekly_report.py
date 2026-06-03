from __future__ import annotations

from tester_qa.models import Severity
from tester_qa.reporting.executive import ExecutiveReport, render_standard_report


def render_weekly_report(project_count: int, incident_count: int, memory_count: int) -> str:
    severity = Severity.HIGH if incident_count >= 5 else Severity.MEDIUM if incident_count else Severity.LOW
    return render_standard_report(
        ExecutiveReport(
            title="Weekly Engineering Operations Report",
            system_status=f"{project_count} projects tracked, {incident_count} incidents open/recorded, {memory_count} memories indexed.",
            findings=[
                f"Project registry size: {project_count}",
                f"Incident volume: {incident_count}",
                f"Memory entries: {memory_count}",
            ],
            risk_level=severity,
            recommended_fix=["Review recurring incidents and convert repeated weakness into strategic memory."],
            validation_plan=["Re-run project scans, healthchecks, and browser inspections for critical dashboards."],
            decision_required=["Confirm next stabilization priority."],
            next_actions=["Publish project risk map and update operational memory."],
        )
    )
