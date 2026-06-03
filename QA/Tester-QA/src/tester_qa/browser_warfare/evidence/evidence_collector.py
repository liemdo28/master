"""Central evidence collector for browser warfare — captures before/during/after state."""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class WarfareEvidencePhase:
    """Single-phase evidence snapshot from a warfare session."""

    phase: str  # before | during | after
    timestamp: str
    screenshot_path: str
    dom_snapshot: dict
    console_errors: list[str]
    metrics: dict
    timeline_events: list[dict] = field(default_factory=list)


class WarfareEvidenceCollector:
    """Collects and persists evidence across all phases of browser warfare."""

    def __init__(self, evidence_root: Path | str = "evidence") -> None:
        self.evidence_root = Path(evidence_root)
        self._sessions: dict[str, list[WarfareEvidencePhase]] = {}
        self._console_buffer: dict[str, list[str]] = {}  # session_id -> console errors
        self._timeline_buffer: dict[str, list[dict]] = {}  # session_id -> events

    def start_session(self, session_id: str, url: str) -> None:
        """Begin a new evidence collection session."""
        self._sessions[session_id] = []
        self._console_buffer[session_id] = []
        self._timeline_buffer[session_id] = []
        logger.info("[EvidenceCollector] Session started: %s (url=%s)", session_id, url)

    def capture_phase(
        self,
        session_id: str,
        page: Any,
        phase: str,
    ) -> WarfareEvidencePhase:
        """Capture a full evidence snapshot for the given phase.

        Args:
            session_id: The session identifier.
            page: A live Playwright page object.
            phase: One of "before", "during", "after".

        Returns:
            The captured WarfareEvidencePhase instance.
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        screenshot_path = self._capture_screenshot(page, session_id, phase)
        dom_snapshot = self._capture_dom(page)
        console_errors = self._capture_console(page)
        metrics = self._capture_metrics(page)
        timeline_events = list(self._timeline_buffer.get(session_id, []))

        evidence = WarfareEvidencePhase(
            phase=phase,
            timestamp=timestamp,
            screenshot_path=screenshot_path,
            dom_snapshot=dom_snapshot,
            console_errors=console_errors,
            metrics=metrics,
            timeline_events=timeline_events,
        )

        self._sessions.setdefault(session_id, []).append(evidence)
        logger.debug(
            "[EvidenceCollector] Phase '%s' captured for session %s", phase, session_id
        )
        return evidence

    def end_session(self, session_id: str) -> dict[str, Any]:
        """Finalize a session and persist evidence to disk.

        Returns:
            Full evidence dict for the session.
        """
        phases = self._sessions.get(session_id, [])
        evidence_dir = self.evidence_root / session_id
        evidence_dir.mkdir(parents=True, exist_ok=True)

        # Persist JSON
        output: dict[str, Any] = {
            "session_id": session_id,
            "started_at": phases[0].timestamp if phases else "",
            "ended_at": datetime.now(timezone.utc).isoformat(),
            "phases": [
                {
                    "phase": p.phase,
                    "timestamp": p.timestamp,
                    "screenshot_path": p.screenshot_path,
                    "dom_snapshot": p.dom_snapshot,
                    "console_errors": p.console_errors,
                    "metrics": p.metrics,
                    "timeline_events": p.timeline_events,
                }
                for p in phases
            ],
        }

        report_path = evidence_dir / "evidence_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, default=str)

        logger.info(
            "[EvidenceCollector] Session ended: %s — %d phases, report: %s",
            session_id,
            len(phases),
            report_path,
        )

        # Clean up buffers
        self._sessions.pop(session_id, None)
        self._console_buffer.pop(session_id, None)
        self._timeline_buffer.pop(session_id, None)

        return output

    def get_session(self, session_id: str) -> list[WarfareEvidencePhase]:
        """Return all captured phases for a session."""
        return list(self._sessions.get(session_id, []))

    # ─── Private capture helpers ───────────────────────────────────────────────

    def _capture_screenshot(self, page: Any, session_id: str, phase: str) -> str:
        """Capture a screenshot and return the path."""
        try:
            import playwright  # noqa: F401

            evidence_dir = self.evidence_root / session_id / "screenshots"
            evidence_dir.mkdir(parents=True, exist_ok=True)
            path = evidence_dir / f"screenshot-{phase}-{int(time.time() * 1000)}.png"
            page.screenshot(path=str(path), full_page=True)
            return str(path)
        except Exception as e:
            logger.warning("[EvidenceCollector] Screenshot failed: %s", e)
            return ""

    def _capture_dom(self, page: Any) -> dict[str, Any]:
        """Capture current DOM state as a serialisable dict."""
        try:
            import playwright  # noqa: F401

            return page.evaluate(
                """() => {
                    const serializer = new XMLSerializer();
                    return {
                        documentElement: serializer.serializeToString(document.documentElement),
                        title: document.title,
                        readyState: document.readyState,
                        bodyInnerText: document.body ? document.body.innerText.slice(0, 2000) : '',
                        childElementCount: document.body ? document.body.childElementCount : 0,
                    };
                }"""
            )
        except Exception as e:
            logger.warning("[EvidenceCollector] DOM capture failed: %s", e)
            return {}

    def _capture_console(self, page: Any) -> list[str]:
        """Collect console errors from the page."""
        try:
            import playwright  # noqa: F401

            return page.evaluate(
                """() => {
                    return window.__tqa_console_errors__ || [];
                }"""
            )
        except Exception:
            return []

    def _capture_metrics(self, page: Any) -> dict[str, Any]:
        """Capture performance and resource metrics from the page."""
        try:
            import playwright  # noqa: F401

            return page.evaluate(
                """() => {
                    const perf = performance.getEntriesByType('navigation')[0] || {};
                    const mem = performance.memory || {};
                    const timing = performance.timing || {};
                    return {
                        domNodes: document.querySelectorAll('*').length,
                        memoryUsedMB: mem.usedJSHeapSize
                            ? Math.round(mem.usedJSHeapSize / 1024 / 1024)
                            : 0,
                        memoryTotalMB: mem.totalJSHeapSize
                            ? Math.round(mem.totalJSHeapSize / 1024 / 1024)
                            : 0,
                        domContentLoaded: perf.domContentLoadedEventEnd || 0,
                        loadComplete: perf.loadEventEnd || 0,
                        timestamp: Date.now(),
                    };
                }"""
            )
        except Exception as e:
            logger.warning("[EvidenceCollector] Metrics capture failed: %s", e)
            return {}
