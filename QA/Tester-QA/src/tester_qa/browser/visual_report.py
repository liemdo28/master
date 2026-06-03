from __future__ import annotations

from tester_qa.reporting.browser_report import BrowserInspectionReport, render_browser_report


def generate_visual_qa_report(report: BrowserInspectionReport) -> str:
    return render_browser_report(report)
