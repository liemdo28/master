from __future__ import annotations

from pathlib import Path

from tester_qa.audit.models import AuditFinding
from tester_qa.models import Severity
from tester_qa.projects.dependency_map import dependency_map


def audit_dependencies(path: Path | str) -> list[AuditFinding]:
    deps = dependency_map(path)
    findings: list[AuditFinding] = []
    for ecosystem, items in deps.items():
        if any("malformed" in item for item in items):
            findings.append(AuditFinding("dependency", Severity.HIGH, f"Malformed {ecosystem} dependency file", items))
        if not items:
            findings.append(AuditFinding("dependency", Severity.OBSERVATIONAL, f"No {ecosystem} dependencies detected"))
    return findings
