from __future__ import annotations

import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from tester_qa.browser.console_monitor import persist_console_errors
from tester_qa.browser.dom_inspector import detect_blank_screen, detect_broken_layout, detect_loading_loop
from tester_qa.browser.network_monitor import persist_network_failures
from tester_qa.evidence import EvidenceEngine
from tester_qa.models import Severity
from tester_qa.reporting.browser_report import BrowserInspectionReport, render_browser_report


@dataclass(frozen=True)
class BrowserInspection:
    url: str
    success: bool
    report_path: str
    screenshot_paths: list[str] = field(default_factory=list)
    console_errors: list[str] = field(default_factory=list)
    network_failures: list[str] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class PlaywrightRunner:
    def __init__(self, evidence_root: Path | str = "evidence", reports_root: Path | str = "reports", timeout_seconds: int = 10) -> None:
        self.evidence_engine = EvidenceEngine(evidence_root)
        self.evidence_root = Path(evidence_root)
        self.reports_root = Path(reports_root)
        self.timeout_seconds = timeout_seconds

    def inspect(self, url: str) -> BrowserInspection:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M")
        report_path = self.reports_root / f"browser-inspection-{timestamp}.md"
        try:
            return self._inspect_with_playwright(url, report_path)
        except ImportError:
            return self._inspect_with_urllib(url, report_path)

    def _inspect_with_playwright(self, url: str, report_path: Path) -> BrowserInspection:
        from playwright.sync_api import sync_playwright

        console_errors: list[str] = []
        network_failures: list[str] = []
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page()
            page.on("console", lambda msg: console_errors.append(f"{msg.type}: {msg.text}") if msg.type == "error" else None)
            page.on("requestfailed", lambda request: network_failures.append(request.url))
            response = page.goto(url, wait_until="networkidle", timeout=self.timeout_seconds * 1000)
            html = page.content()
            screenshot_path = self.evidence_root / "screenshots" / f"browser-{int(time.time())}.png"
            screenshot_path.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(screenshot_path), full_page=True)
            browser.close()
        findings = _findings(html, response.status if response else None, console_errors, network_failures)
        return self._write_report(url, report_path, [str(screenshot_path)], console_errors, network_failures, findings)

    def _inspect_with_urllib(self, url: str, report_path: Path) -> BrowserInspection:
        console_errors: list[str] = []
        network_failures: list[str] = []
        html = ""
        status = None
        try:
            with urllib.request.urlopen(url, timeout=self.timeout_seconds) as response:
                status = response.status
                html = response.read().decode(errors="replace")
        except (urllib.error.URLError, TimeoutError) as exc:
            network_failures.append(str(exc))
        screenshot = self.evidence_engine.capture_screenshot_placeholder(description=f"Browser inspection fallback for {url}")
        findings = _findings(html, status, console_errors, network_failures)
        return self._write_report(url, report_path, [str(screenshot.path)], console_errors, network_failures, findings)

    def _write_report(
        self,
        url: str,
        report_path: Path,
        screenshots: list[str],
        console_errors: list[str],
        network_failures: list[str],
        findings: list[str],
    ) -> BrowserInspection:
        console_path = self.evidence_root / "console" / f"console-{int(time.time())}.log"
        network_path = self.evidence_root / "network" / f"network-{int(time.time())}.log"
        persist_console_errors(console_path, console_errors)
        persist_network_failures(network_path, network_failures)
        severity = Severity.HIGH if network_failures else Severity.MEDIUM if console_errors or findings else Severity.LOW
        markdown = render_browser_report(
            BrowserInspectionReport(
                url=url,
                status="failed" if network_failures else "inspected",
                screenshot_paths=screenshots,
                console_errors=[str(console_path)],
                network_failures=[str(network_path)],
                findings=findings,
                severity=severity,
            )
        )
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(markdown + "\n", encoding="utf-8")
        return BrowserInspection(
            url=url,
            success=not network_failures and severity != Severity.HIGH,
            report_path=str(report_path),
            screenshot_paths=screenshots,
            console_errors=console_errors,
            network_failures=network_failures,
            findings=findings,
        )


def _findings(html: str, status: int | None, console_errors: list[str], network_failures: list[str]) -> list[str]:
    findings = []
    if status is not None and status >= 400:
        findings.append(f"HTTP status failure: {status}")
    if network_failures:
        findings.append("Network failures captured.")
    if console_errors:
        findings.append("Console errors captured.")
    if html and detect_blank_screen(html):
        findings.append("Blank screen risk detected.")
    if html and detect_loading_loop(html):
        findings.append("Loading loop marker detected.")
    findings.extend(detect_broken_layout(html))
    return findings
