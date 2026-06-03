from __future__ import annotations

from pathlib import Path

from tester_qa.projects.analyzer import ProjectAnalyzer
from tester_qa.projects.healthcheck import ProjectHealthcheck
from tester_qa.reporting.project_report import render_project_report


def generate_project_report(path: Path | str) -> str:
    record = ProjectAnalyzer().analyze(path)
    health = ProjectHealthcheck().run(path)
    return render_project_report(record.to_dict(), health)
