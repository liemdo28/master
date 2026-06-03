"""Comprehensive recovery validation orchestrator."""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .browser_recovery import BrowserRecoveryValidator, BrowserRecoveryResult
from .dom_recovery import DOMRecoveryValidator
from .state_resync import StateResyncValidator
from .stale_state_cleanup import StaleStateCleanup

LOGGER = logging.getLogger(__name__)


@dataclass
class RecoveryValidationReport:
    session_id: str
    timestamp: str
    overall_score: float = 0.0
    memory_score: float = 0.0
    dom_score: float = 0.0
    state_score: float = 0.0
    cleanup_score: float = 0.0
    browser_result: dict[str, Any] = field(default_factory=dict)
    dom_result: dict[str, Any] = field(default_factory=dict)
    state_result: dict[str, Any] = field(default_factory=dict)
    cleanup_result: dict[str, Any] = field(default_factory=dict)
    residual_issues: list[str] = field(default_factory=list)
    recovered: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "timestamp": self.timestamp,
            "overall_score": round(self.overall_score, 2),
            "memory_score": round(self.memory_score, 2),
            "dom_score": round(self.dom_score, 2),
            "state_score": round(self.state_score, 2),
            "cleanup_score": round(self.cleanup_score, 2),
            "browser_result": self.browser_result,
            "dom_result": self.dom_result,
            "state_result": self.state_result,
            "cleanup_result": self.cleanup_result,
            "residual_issues": self.residual_issues,
            "recovered": self.recovered,
        }


class WarfareRecoveryValidator:
    """Orchestrates all recovery validation checks after browser warfare."""

    def __init__(
        self,
        recovery_window_secs: float = 5.0,
        run_cleanup: bool = True,
    ) -> None:
        self.recovery_window_secs = recovery_window_secs
        self.run_cleanup = run_cleanup
        self._browser_validator = BrowserRecoveryValidator(
            recovery_window_secs=recovery_window_secs,
        )
        self._dom_validator = DOMRecoveryValidator()
        self._state_validator = StateResyncValidator()
        self._cleanup = StaleStateCleanup()
        self._last_report: RecoveryValidationReport | None = None

    def run_full_validation(
        self,
        page: Any,
        session_id: str,
        before_metrics: dict[str, Any] | None = None,
        console_errors: list[str] | None = None,
    ) -> RecoveryValidationReport:
        """Run all recovery validations and return a scored report.

        Args:
            page: Playwright page object.
            session_id: Identifier for this warfare session.
            before_metrics: Optional pre-warfare metrics for comparison.
            console_errors: Console errors captured during warfare.

        Returns:
            RecoveryValidationReport with per-component and overall scores.
        """
        LOGGER.info("[RecoveryValidator] Starting full validation for session=%s", session_id)
        timestamp = datetime.now(timezone.utc).isoformat()

        # 1. Browser-level recovery check
        browser_result = self._browser_validator.validate_recovery(
            page=page,
            session_id=session_id,
            before_metrics=before_metrics,
            console_errors=console_errors,
        )
        memory_score = browser_result.recovery_score * 0.4 if browser_result.memory_normalized else browser_result.recovery_score * 0.2

        # 2. DOM recovery check
        dom_result = self._dom_validator.check_recovery(page)
        dom_score = self._score_dom_result(dom_result)

        # 3. State resync check
        state_result = self._state_validator.validate_state_resync(page)
        state_score = state_result.get("resync_score", 0.0)

        # 4. Cleanup (optional)
        cleanup_result: dict[str, Any] = {}
        cleanup_score = 0.0
        if self.run_cleanup:
            cleanup_result = self._cleanup.measure_cleanup_effectiveness(page)
            cleanup_score = cleanup_result.get("effectiveness_score", 0.0)

        # Collect residual issues
        residual: list[str] = list(browser_result.residual_issues)
        if not dom_result.get("recovered", False):
            residual.append(f"dom_corruption:{dom_result.get('corrupted_nodes', 0)}")
        if not state_result.get("resynced", False):
            residual.extend(state_result.get("stale_state", []))
        if cleanup_result.get("remaining_stale_elements"):
            residual.extend([f"stale:{s}" for s in cleanup_result["remaining_stale_elements"][:10]])

        # Overall score (weighted average)
        overall_score = self._compute_overall_score(
            browser_score=browser_result.recovery_score,
            dom_score=dom_score,
            state_score=state_score,
            cleanup_score=cleanup_score,
        )

        recovered = (
            browser_result.recovery_score >= 60.0
            and dom_result.get("recovered", False)
            and state_result.get("resynced", False)
            and overall_score >= 50.0
        )

        self._last_report = RecoveryValidationReport(
            session_id=session_id,
            timestamp=timestamp,
            overall_score=overall_score,
            memory_score=browser_result.recovery_score,
            dom_score=dom_score,
            state_score=state_score,
            cleanup_score=cleanup_score,
            browser_result=browser_result.to_dict(),
            dom_result=dom_result,
            state_result=state_result,
            cleanup_result=cleanup_result,
            residual_issues=residual[:50],  # Cap at 50
            recovered=recovered,
        )

        LOGGER.info(
            "[RecoveryValidator] Session=%s recovered=%s overall_score=%.1f",
            session_id, recovered, overall_score,
        )

        return self._last_report

    def get_recovery_score(self) -> float:
        """Return the overall recovery score from the last run, or 0.0."""
        if self._last_report is None:
            return 0.0
        return self._last_report.overall_score

    def export_recovery_report(self) -> dict[str, Any]:
        """Export the last recovery report as a dict."""
        if self._last_report is None:
            return {}
        return self._last_report.to_dict()

    # ─── Private scoring helpers ──────────────────────────────────────────────

    @staticmethod
    def _score_dom_result(dom_result: dict[str, Any]) -> float:
        """Convert DOM recovery result dict to a 0–100 score."""
        score = 100.0
        if dom_result.get("corrupted_nodes", 0) > 0:
            score -= min(dom_result["corrupted_nodes"] * 2.0, 40.0)
        if dom_result.get("duplicate_ids", 0) > 0:
            score -= min(dom_result["duplicate_ids"] * 5.0, 20.0)
        if dom_result.get("total_nodes", 0) > 10_000:
            score -= 15.0
        if dom_result.get("mismatched_attributes", 0) > 0:
            score -= min(dom_result["mismatched_attributes"] * 2.0, 25.0)
        return max(0.0, min(100.0, score))

    @staticmethod
    def _compute_overall_score(
        browser_score: float,
        dom_score: float,
        state_score: float,
        cleanup_score: float,
    ) -> float:
        """Compute weighted overall recovery score."""
        return round(
            browser_score * 0.35
            + dom_score * 0.25
            + state_score * 0.25
            + cleanup_score * 0.15,
            2,
        )
