from __future__ import annotations

from pathlib import Path

from tester_qa.local_control.project_scanner import ProjectScanner
from tester_qa.projects.registry import ProjectRecord
from tester_qa.projects.risk_map import assess_project_risk


class ProjectAnalyzer:
    def __init__(self, scanner: ProjectScanner | None = None) -> None:
        self.scanner = scanner or ProjectScanner()

    def analyze(self, path: Path | str) -> ProjectRecord:
        target = Path(path).expanduser().resolve()
        info = self.scanner.identify(target)
        risk = assess_project_risk(info)
        return ProjectRecord(
            name=target.name,
            path=str(target),
            type=info["type"],
            status="active" if target.exists() else "missing",
            entrypoints=info["entrypoints"],
            test_commands=info["test_commands"],
            dev_commands=info["dev_commands"],
            risk_level=risk,
        )

    def scan_root(self, root: Path | str) -> list[ProjectRecord]:
        base = Path(root).expanduser().resolve()
        if not base.exists():
            raise FileNotFoundError(base)
        records = []
        for child in sorted(item for item in base.iterdir() if item.is_dir() and not item.name.startswith(".")):
            try:
                records.append(self.analyze(child))
            except (OSError, ValueError):
                continue
        return records
