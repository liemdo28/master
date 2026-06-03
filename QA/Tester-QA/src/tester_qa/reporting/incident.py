from __future__ import annotations

from tester_qa.models import EnterpriseIncident, IncidentReport
from tester_qa.reporting.common import render_evidence, render_list


def render_incident_report(report: IncidentReport) -> str:
    return "\n".join(
        [
            f"# Incident Report: {report.title}",
            "",
            "## Incident",
            report.summary,
            "",
            "## Evidence",
            render_evidence(report.evidence),
            "",
            "## Root Cause",
            report.root_cause,
            "",
            "## Systemic Impact",
            report.systemic_impact,
            "",
            "## Risk Level",
            report.severity.value.upper(),
            "",
            "## Reproduction",
            render_list(report.reproduction),
            "",
            "## Fix Strategy",
            render_list(report.fix_strategy),
            "",
            "## Validation",
            render_list(report.validation),
            "",
            "## Prevention",
            render_list(report.prevention),
            "",
            "## Long-Term Refactor",
            render_list(report.long_term_refactor),
            "",
            f"_Created at: {report.created_at.isoformat()}_",
        ]
    )


def render_enterprise_incident_markdown(incident: EnterpriseIncident) -> str:
    root = incident.root_cause
    return "\n".join(
        [
            f"# Incident {incident.incident_id}: {incident.title}",
            "",
            "## Incident",
            incident.summary,
            "",
            "## State",
            incident.state.value,
            "",
            "## Severity",
            incident.severity.value.upper(),
            "",
            "## Trigger",
            root.trigger,
            "",
            "## Blast Radius",
            root.blast_radius,
            "",
            "## Affected Modules",
            render_list(root.affected_modules),
            "",
            "## Reproduction",
            render_list(root.reproduction),
            "",
            "## Mitigation",
            render_list(root.mitigation),
            "",
            "## Prevention",
            render_list(root.prevention),
            "",
            "## Long-Term Refactor",
            render_list(root.long_term_refactor),
            "",
            "## Evidence",
            render_list(incident.evidence_ids),
            "",
            "## Timeline",
            render_list([f"{event.created_at.isoformat()} - {event.state.value}: {event.note}" for event in incident.timeline]),
        ]
    )
