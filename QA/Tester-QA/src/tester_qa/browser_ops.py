from __future__ import annotations

import logging
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from tester_qa.evidence import EvidenceEngine
from tester_qa.incidents import IncidentRegistry, classify_severity
from tester_qa.models import EvidenceType, Severity


LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BrowserQaResult:
    success: bool
    url: str
    status_code: int | None
    duration_ms: int
    incident_id: str | None = None
    screenshot_path: str | None = None
    detail: str = ""

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "url": self.url,
            "status_code": self.status_code,
            "duration_ms": self.duration_ms,
            "incident_id": self.incident_id,
            "screenshot_path": self.screenshot_path,
            "detail": self.detail,
        }


class BrowserOps:
    def __init__(
        self,
        evidence_engine: EvidenceEngine | None = None,
        incident_registry: IncidentRegistry | None = None,
        timeout_seconds: int = 10,
    ) -> None:
        self.evidence_engine = evidence_engine or EvidenceEngine()
        self.incident_registry = incident_registry or IncidentRegistry()
        self.timeout_seconds = timeout_seconds

    def validate_dashboard(self, url: str) -> BrowserQaResult:
        playwright_result = self._validate_with_playwright(url)
        if playwright_result is not None:
            return playwright_result

        import time

        started = time.monotonic()
        try:
            with urllib.request.urlopen(url, timeout=self.timeout_seconds) as response:
                body = response.read().decode(errors="replace")
                duration_ms = int((time.monotonic() - started) * 1000)
                status = response.status
        except (urllib.error.URLError, TimeoutError) as exc:
            duration_ms = int((time.monotonic() - started) * 1000)
            return self._fail(url, None, duration_ms, f"Dashboard launch failed: {exc}", timed_out=isinstance(exc, TimeoutError))

        markers = ["loading", "spinner", "please wait"]
        stale_marker_detected = any(marker in body.lower() for marker in markers)
        if status >= 400 or stale_marker_detected:
            detail = "Dashboard returned unhealthy status." if status >= 400 else "Potential loading deadlock marker detected."
            return self._fail(url, status, duration_ms, detail)

        screenshot = self.evidence_engine.capture_screenshot_placeholder(description=f"Browser QA placeholder for {url}")
        return BrowserQaResult(
            success=True,
            url=url,
            status_code=status,
            duration_ms=duration_ms,
            screenshot_path=str(screenshot.path),
            detail="Dashboard reachable and no basic stale loading marker detected.",
        )

    def _validate_with_playwright(self, url: str) -> BrowserQaResult | None:
        try:
            from playwright.sync_api import Error as PlaywrightError
            from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
            from playwright.sync_api import sync_playwright
        except ImportError:
            return None

        import time

        started = time.monotonic()
        try:
            with sync_playwright() as playwright:
                browser = playwright.chromium.launch(headless=True)
                page = browser.new_page()
                response = page.goto(url, wait_until="networkidle", timeout=self.timeout_seconds * 1000)
                screenshot = self.evidence_engine.directories[EvidenceType.SCREENSHOT] / (
                    f"EVD-GLOBAL-screenshot-playwright-{int(started * 1000)}.png"
                )
                page.screenshot(path=str(screenshot), full_page=True)
                loading_markers = page.locator("text=/loading|spinner|please wait/i").count()
                browser.close()
                duration_ms = int((time.monotonic() - started) * 1000)
                status = response.status if response else None
        except PlaywrightTimeoutError as exc:
            return self._fail(url, None, int((time.monotonic() - started) * 1000), f"Playwright timeout: {exc}", timed_out=True)
        except PlaywrightError as exc:
            return self._fail(url, None, int((time.monotonic() - started) * 1000), f"Playwright failure: {exc}")

        if status is None or status >= 400 or loading_markers > 0:
            detail = "Dashboard returned unhealthy status." if status and status >= 400 else "Potential loading deadlock marker detected."
            return self._fail(url, status, duration_ms, detail)

        return BrowserQaResult(
            success=True,
            url=url,
            status_code=status,
            duration_ms=duration_ms,
            screenshot_path=str(screenshot),
            detail="Playwright dashboard validation passed.",
        )

    def validate_websocket_contract(self, url: str) -> BrowserQaResult:
        if not (url.startswith("ws://") or url.startswith("wss://")):
            return self._fail(url, None, 0, "Invalid websocket URL. Expected ws:// or wss://.")
        return BrowserQaResult(True, url, None, 0, detail="Websocket URL contract is valid. Deep handshake requires optional browser backend.")

    def capture_screenshot(self, output: Path | None = None) -> Path:
        record = self.evidence_engine.capture_screenshot_placeholder()
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(record.path.read_text(encoding="utf-8"), encoding="utf-8")
            return output
        return record.path

    def _fail(
        self,
        url: str,
        status_code: int | None,
        duration_ms: int,
        detail: str,
        timed_out: bool = False,
    ) -> BrowserQaResult:
        severity = classify_severity(timed_out=timed_out, failed_executions=1 if status_code is None or (status_code >= 500 if status_code else False) else 0)
        screenshot = self.evidence_engine.capture_screenshot_placeholder(description=f"Failure screenshot for {url}")
        log = self.evidence_engine.capture_text(EvidenceType.LOG, detail, description=f"Browser failure log for {url}")
        incident = self.incident_registry.create(
            title=f"Browser QA failure: {url}",
            summary=detail,
            severity=severity if severity != Severity.OBSERVATIONAL else Severity.MEDIUM,
            evidence_ids=[screenshot.evidence_id, log.evidence_id],
        )
        return BrowserQaResult(
            success=False,
            url=url,
            status_code=status_code,
            duration_ms=duration_ms,
            incident_id=incident.incident_id,
            screenshot_path=str(screenshot.path),
            detail=detail,
        )
