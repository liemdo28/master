from __future__ import annotations

from pathlib import Path

from tester_qa.audit.models import AuditFinding, AuditReport
from tester_qa.local_control.project_scanner import ProjectScanner
from tester_qa.models import Severity


class ProjectAudit:
    def __init__(self, scanner: ProjectScanner | None = None) -> None:
        self.scanner = scanner or ProjectScanner()

    def run(self, path: Path | str) -> AuditReport:
        root = Path(path).expanduser().resolve()
        info = self.scanner.identify(root)
        findings: list[AuditFinding] = []
        if not info["has_readme"]:
            findings.append(AuditFinding("config", Severity.MEDIUM, "Missing README", [str(root)]))
        if not info["has_env_example"]:
            findings.append(AuditFinding("config", Severity.MEDIUM, "Missing env example", [str(root)]))
        if not info["test_commands"] and info["test_framework"] in {"none", "unknown-tests-present"}:
            findings.append(AuditFinding("qa", Severity.HIGH, "Missing executable test command", info.get("config_files", [])))
        if info["type"] == "unknown":
            findings.append(AuditFinding("architecture", Severity.HIGH, "Unknown project type", [str(root)]))
        return AuditReport(project=str(root), findings=findings)
