"""Report Engine 4.0 — auto-named, per-project, evidence-linked reports."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any


REPORTS_DIR = Path("reports")


class ReportEngine:
    """Generate executive-level reports with auto-naming and evidence linking."""

    def __init__(self, base_dir: Path | str = REPORTS_DIR) -> None:
        self.base_dir = Path(base_dir)

    def generate(
        self,
        project_id: str,
        report_type: str,
        data: dict[str, Any],
        evidence_paths: list[str] | None = None,
    ) -> Path:
        """Generate a full report and save to per-project directory."""
        timestamp = datetime.now(timezone.utc)
        filename = self._build_filename(project_id, report_type, timestamp)
        project_dir = self.base_dir / self._sanitize(project_id)
        project_dir.mkdir(parents=True, exist_ok=True)

        report_path = project_dir / filename
        content = self._render_report(project_id, report_type, timestamp, data, evidence_paths)
        report_path.write_text(content, encoding="utf-8")
        return report_path

    def _build_filename(self, project_id: str, report_type: str, timestamp: datetime) -> str:
        """Build auto-named filename: project_report-type_datetime.md"""
        ts = timestamp.strftime("%Y-%m-%d_%H-%M-%S")
        safe_project = self._sanitize(project_id)
        safe_type = self._sanitize(report_type)
        return f"{safe_project}_{safe_type}_{ts}.md"

    def _render_report(
        self,
        project_id: str,
        report_type: str,
        timestamp: datetime,
        data: dict[str, Any],
        evidence_paths: list[str] | None = None,
    ) -> str:
        """Render full markdown report."""
        sections: list[str] = []

        # Header
        sections.append(f"# {report_type.replace('-', ' ').title()} Report")
        sections.append(f"\n**Project:** {project_id}")
        sections.append(f"**Generated:** {timestamp.isoformat()}")
        sections.append(f"**Report Type:** {report_type}")
        sections.append("")

        # Executive Summary
        sections.append("## Executive Summary")
        sections.append("")
        summary = data.get("executive_summary", "No summary provided.")
        sections.append(summary)
        sections.append("")

        # Environment
        if "environment" in data:
            sections.append("## Environment")
            sections.append("")
            env = data["environment"]
            if isinstance(env, dict):
                for key, value in env.items():
                    sections.append(f"- **{key}:** {value}")
            else:
                sections.append(str(env))
            sections.append("")

        # Project Structure
        if "project_structure" in data:
            sections.append("## Project Structure")
            sections.append("")
            sections.append("```")
            sections.append(str(data["project_structure"]))
            sections.append("```")
            sections.append("")

        # Detected Services
        if "detected_services" in data:
            sections.append("## Detected Services")
            sections.append("")
            for svc in data["detected_services"]:
                if isinstance(svc, dict):
                    sections.append(f"- **{svc.get('name', 'unknown')}** — port {svc.get('port', '?')}, status: {svc.get('status', 'unknown')}")
                else:
                    sections.append(f"- {svc}")
            sections.append("")

        # Runtime Status
        if "runtime_status" in data:
            sections.append("## Runtime Status")
            sections.append("")
            runtime = data["runtime_status"]
            if isinstance(runtime, dict):
                for key, value in runtime.items():
                    sections.append(f"- **{key}:** {value}")
            else:
                sections.append(str(runtime))
            sections.append("")

        # Stress Results
        if "stress_results" in data:
            sections.append("## Stress Results")
            sections.append("")
            stress = data["stress_results"]
            if isinstance(stress, dict):
                for key, value in stress.items():
                    sections.append(f"- **{key}:** {value}")
            elif isinstance(stress, list):
                for item in stress:
                    sections.append(f"- {item}")
            else:
                sections.append(str(stress))
            sections.append("")

        # Browser Findings
        if "browser_findings" in data:
            sections.append("## Browser Findings")
            sections.append("")
            for finding in data["browser_findings"]:
                if isinstance(finding, dict):
                    sections.append(f"- [{finding.get('severity', 'info')}] {finding.get('message', '')}")
                else:
                    sections.append(f"- {finding}")
            sections.append("")

        # Security Findings
        if "security_findings" in data:
            sections.append("## Security Findings")
            sections.append("")
            for finding in data["security_findings"]:
                if isinstance(finding, dict):
                    sections.append(f"- **[{finding.get('severity', 'info')}]** {finding.get('title', '')}: {finding.get('description', '')}")
                else:
                    sections.append(f"- {finding}")
            sections.append("")

        # Architecture Risks
        if "architecture_risks" in data:
            sections.append("## Architecture Risks")
            sections.append("")
            for risk in data["architecture_risks"]:
                if isinstance(risk, dict):
                    sections.append(f"- **{risk.get('component', '')}**: {risk.get('risk', '')} (severity: {risk.get('severity', 'medium')})")
                else:
                    sections.append(f"- {risk}")
            sections.append("")

        # Operational Risk Score
        if "operational_risk_score" in data:
            sections.append("## Operational Risk Score")
            sections.append("")
            score = data["operational_risk_score"]
            if isinstance(score, dict):
                sections.append(f"**Overall Score:** {score.get('score', 'N/A')}/100")
                sections.append(f"**Rating:** {score.get('rating', 'N/A')}")
                if "breakdown" in score:
                    sections.append("")
                    sections.append("### Breakdown")
                    for key, value in score["breakdown"].items():
                        sections.append(f"- {key}: {value}")
            else:
                sections.append(f"**Score:** {score}")
            sections.append("")

        # Failure Timeline
        if "failure_timeline" in data:
            sections.append("## Failure Timeline")
            sections.append("")
            sections.append("```")
            for event in data["failure_timeline"]:
                if isinstance(event, dict):
                    sections.append(f"[{event.get('timestamp', '')}] {event.get('event', '')} → {event.get('impact', '')}")
                else:
                    sections.append(str(event))
            sections.append("```")
            sections.append("")

        # Evidence
        sections.append("## Evidence")
        sections.append("")
        if evidence_paths:
            for path in evidence_paths:
                sections.append(f"- [{Path(path).name}]({path})")
        else:
            sections.append("No evidence files linked.")
        sections.append("")

        # Screenshots
        if "screenshots" in data:
            sections.append("## Screenshots")
            sections.append("")
            for screenshot in data["screenshots"]:
                sections.append(f"![{Path(screenshot).stem}]({screenshot})")
            sections.append("")

        # Recommendations
        if "recommendations" in data:
            sections.append("## Recommendations")
            sections.append("")
            for i, rec in enumerate(data["recommendations"], 1):
                sections.append(f"{i}. {rec}")
            sections.append("")

        # Footer
        sections.append("---")
        sections.append(f"*Generated by Tester-QA Report Engine 4.0 at {timestamp.isoformat()}*")

        return "\n".join(sections)

    def _sanitize(self, name: str) -> str:
        """Sanitize a name for use in filenames."""
        return name.lower().replace(" ", "-").replace("/", "-").replace("\\", "-")

    def list_reports(self, project_id: str | None = None) -> list[dict[str, Any]]:
        """List all reports, optionally filtered by project."""
        reports: list[dict[str, Any]] = []
        if not self.base_dir.exists():
            return reports

        if project_id:
            project_dir = self.base_dir / self._sanitize(project_id)
            if project_dir.is_dir():
                for f in sorted(project_dir.glob("*.md"), reverse=True):
                    reports.append(self._report_meta(f, project_id))
        else:
            for project_dir in sorted(self.base_dir.iterdir()):
                if project_dir.is_dir() and project_dir.name != "shared":
                    for f in sorted(project_dir.glob("*.md"), reverse=True):
                        reports.append(self._report_meta(f, project_dir.name))

        return reports

    def _report_meta(self, path: Path, project_id: str) -> dict[str, Any]:
        """Extract metadata from a report file."""
        return {
            "project_id": project_id,
            "filename": path.name,
            "path": str(path),
            "size_bytes": path.stat().st_size,
            "modified": datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat(),
        }
