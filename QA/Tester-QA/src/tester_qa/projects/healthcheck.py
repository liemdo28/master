from __future__ import annotations

from pathlib import Path

from tester_qa.local_control.process import ProcessInspector
from tester_qa.local_control.project_scanner import ProjectScanner


class ProjectHealthcheck:
    def __init__(self, scanner: ProjectScanner | None = None, process_inspector: ProcessInspector | None = None) -> None:
        self.scanner = scanner or ProjectScanner()
        self.process_inspector = process_inspector or ProcessInspector()

    def run(self, path: Path | str) -> dict:
        info = self.scanner.identify(path)
        return {
            "can_install": info["package_manager"] != "unknown",
            "can_run": bool(info["dev_commands"] or info["entrypoints"]),
            "can_test": bool(info["test_commands"] or info["test_framework"] not in {"none", "unknown-tests-present"}),
            "has_readme": info["has_readme"],
            "has_env_example": info["has_env_example"],
            "has_broken_dependency": False,
            "has_port_conflict": bool(self._likely_port_conflicts()),
            "has_failing_tests": None,
            "has_missing_scripts": not bool(info["dev_commands"] or info["test_commands"]),
            "framework": info["framework"],
            "test_framework": info["test_framework"],
        }

    def _likely_port_conflicts(self) -> list[int]:
        common = {3000, 3001, 5173, 8000, 8080}
        return [item.port for item in self.process_inspector.occupied_ports() if item.port in common]
