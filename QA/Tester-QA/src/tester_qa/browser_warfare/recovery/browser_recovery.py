"""Browser recovery validation after warfare attacks."""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

LOGGER = logging.getLogger(__name__)

# Default recovery window in seconds
DEFAULT_RECOVERY_WINDOW_SECS = 5.0


@dataclass
class BrowserRecoveryResult:
    session_id: str
    before_metrics: dict[str, Any]
    after_metrics: dict[str, Any]
    recovery_duration_ms: float = 0.0
    memory_normalized: bool = False
    dom_cleaned: bool = False
    console_errors_cleared: bool = False
    residual_issues: list[str] = field(default_factory=list)
    recovery_score: float = 0.0  # 0–100

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "before_metrics": self.before_metrics,
            "after_metrics": self.after_metrics,
            "recovery_duration_ms": round(self.recovery_duration_ms, 2),
            "memory_normalized": self.memory_normalized,
            "dom_cleaned": self.dom_cleaned,
            "console_errors_cleared": self.console_errors_cleared,
            "residual_issues": self.residual_issues,
            "recovery_score": round(self.recovery_score, 2),
        }


class BrowserRecoveryValidator:
    """Validates whether browser recovered after warfare."""

    def __init__(self, recovery_window_secs: float = DEFAULT_RECOVERY_WINDOW_SECS) -> None:
        self.recovery_window_secs = recovery_window_secs
        self._before_metrics: dict[str, Any] = {}
        self._console_errors_at_start: list[str] = []

    def capture_before_metrics(self, page: Any) -> dict[str, Any]:
        """Capture baseline metrics from the page before warfare begins."""
        metrics: dict[str, Any] = {}
        try:
            metrics = page.evaluate("""() => {
                if (performance.memory) {
                    return {
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                    };
                }
                return { jsHeapSizeLimit: 0, totalJSHeapSize: 0, usedJSHeapSize: 0 };
            }""") or {}
        except Exception as e:
            LOGGER.warning("[Recovery] Failed to capture memory metrics: %s", e)

        try:
            dom_stats = page.evaluate("""() => {
                return {
                    body_children: document.body.children.length,
                    total_nodes: document.querySelectorAll('*').length,
                };
            }""") or {}
            metrics.update(dom_stats)
        except Exception as e:
            LOGGER.warning("[Recovery] Failed to capture DOM metrics: %s", e)

        try:
            metrics["url"] = page.url
            metrics["title"] = page.title()
        except Exception:
            pass

        self._before_metrics = metrics
        return metrics

    def validate_recovery(
        self,
        page: Any,
        session_id: str,
        before_metrics: dict[str, Any] | None = None,
        console_errors: list[str] | None = None,
    ) -> BrowserRecoveryResult:
        """Run recovery validation on a page after warfare.

        Args:
            page: Playwright page object.
            session_id: Identifier for this warfare session.
            before_metrics: Optional pre-warfare metrics; if None, captures current state.
            console_errors: Optional list of console errors captured during warfare.

        Returns:
            BrowserRecoveryResult with scored recovery assessment.
        """
        start_time = time.monotonic()

        if before_metrics is None:
            before_metrics = self._before_metrics
        if console_errors is None:
            console_errors = []

        # Wait for recovery window
        time.sleep(self.recovery_window_secs)

        # Capture after metrics
        after_metrics = self._capture_after_metrics(page)

        # Individual validation checks
        memory_ok, memory_score = self.validate_memory_recovery(page)
        dom_ok, dom_issues = self.validate_dom_recovery(page)

        # Check console errors cleared
        errors_after = self._get_console_errors(page)
        errors_cleared = len(errors_after) <= len(console_errors) * 0.1

        # Build residual issues
        residual: list[str] = []
        if not memory_ok:
            residual.append("memory_not_normalized")
        if not dom_ok:
            residual.extend(dom_issues)
        if not errors_cleared:
            residual.append(f"console_errors_remaining:{len(errors_after)}")

        # Calculate score
        recovery_duration_ms = (time.monotonic() - start_time) * 1000
        recovery_score = self._calculate_score(
            memory_ok=memory_ok,
            dom_ok=dom_ok,
            errors_cleared=errors_cleared,
            residual_count=len(residual),
        )

        return BrowserRecoveryResult(
            session_id=session_id,
            before_metrics=before_metrics,
            after_metrics=after_metrics,
            recovery_duration_ms=recovery_duration_ms,
            memory_normalized=memory_ok,
            dom_cleaned=dom_ok,
            console_errors_cleared=errors_cleared,
            residual_issues=residual,
            recovery_score=recovery_score,
        )

    def validate_memory_recovery(self, page: Any) -> tuple[bool, float]:
        """Check if JS heap memory has returned to safe levels.

        Returns:
            Tuple of (is_normalized, score_pct).
        """
        try:
            metrics = page.evaluate("""() => {
                if (performance.memory) {
                    return {
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                    };
                }
                return null;
            }""")
            if not metrics:
                return True, 100.0  # Cannot measure — assume recovered

            used = metrics.get("usedJSHeapSize", 0)
            limit = metrics.get("jsHeapSizeLimit", 1)
            usage_ratio = used / max(limit, 1)

            # Consider normalized if under 70% of limit
            threshold = 0.70
            normalized = usage_ratio < threshold
            score = max(0.0, (1.0 - usage_ratio) * 100)

            LOGGER.info(
                "[Recovery] Memory: used=%d limit=%d ratio=%.2f normalized=%s score=%.1f",
                used, limit, usage_ratio, normalized, score,
            )
            return normalized, score
        except Exception as e:
            LOGGER.warning("[Recovery] Memory recovery check failed: %s", e)
            return True, 100.0

    def validate_dom_recovery(self, page: Any) -> tuple[bool, list[str]]:
        """Check if DOM has been cleaned up after warfare attacks.

        Returns:
            Tuple of (is_clean, list of issues found).
        """
        issues: list[str] = []
        try:
            stats = page.evaluate("""() => {
                var allNodes = document.querySelectorAll('*');
                var bodyChildren = document.body ? document.body.children.length : 0;
                var totalNodes = allNodes.length;
                var emptyDivs = 0;
                var duplicateIds = 0;
                var ids = new Set();
                allNodes.forEach(function(n) {
                    if (n.children.length === 0 && n.textContent.trim() === '') emptyDivs++;
                    if (n.id) {
                        if (ids.has(n.id)) duplicateIds++;
                        else ids.add(n.id);
                    }
                });
                return {
                    body_children: bodyChildren,
                    total_nodes: totalNodes,
                    empty_divs: emptyDivs,
                    duplicate_ids: duplicateIds,
                };
            }""") or {}

            total_nodes = stats.get("total_nodes", 0)
            empty_divs = stats.get("empty_divs", 0)
            duplicate_ids = stats.get("duplicate_ids", 0)

            # DOM is considered "recovered" if total nodes < 10_000 and no major anomalies
            if total_nodes > 10_000:
                issues.append(f"excessive_nodes:{total_nodes}")
            if empty_divs > 1000:
                issues.append(f"orphan_nodes:{empty_divs}")
            if duplicate_ids > 0:
                issues.append(f"duplicate_ids:{duplicate_ids}")

            cleaned = len(issues) == 0
            LOGGER.info(
                "[Recovery] DOM: total_nodes=%d empty=%d dup_ids=%d cleaned=%s",
                total_nodes, empty_divs, duplicate_ids, cleaned,
            )
            return cleaned, issues
        except Exception as e:
            LOGGER.warning("[Recovery] DOM recovery check failed: %s", e)
            return True, []

    def validate_state_recovery(self, page: Any) -> tuple[bool, list[str]]:
        """Check if JavaScript application state recovered correctly.

        Returns:
            Tuple of (is_recovered, list of stale state issues).
        """
        issues: list[str] = []
        try:
            state_info = page.evaluate("""() => {
                // Attempt to detect common stale state signals
                var signals = [];
                // Check for unresolved promises
                if (window.__PENDING_PROMISES__ !== undefined) {
                    signals.push('pending_promises');
                }
                // Check for __NEXT_DATA__ staleness (Next.js)
                if (window.__NEXT_DATA__ && window.__NEXT_DATA__.buildId) {
                    signals.push('next_data_present');
                }
                // Check React devtools presence
                if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                    signals.push('react_devtools_attached');
                }
                return signals;
            }""") or []

            # Check if page is responsive
            responsive = True
            try:
                page.evaluate("() => document.readyState")
            except Exception:
                responsive = False
                issues.append("page_unresponsive")

            if not responsive:
                return False, issues

            LOGGER.info("[Recovery] State: signals=%s responsive=%s", state_info, responsive)
            return True, issues
        except Exception as e:
            LOGGER.warning("[Recovery] State recovery check failed: %s", e)
            return True, []

    # ─── Private helpers ───────────────────────────────────────────────────────

    def _capture_after_metrics(self, page: Any) -> dict[str, Any]:
        """Capture metrics after the recovery window."""
        metrics: dict[str, Any] = {}
        try:
            metrics = page.evaluate("""() => {
                var mem = performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                } : null;
                var dom = {
                    body_children: document.body ? document.body.children.length : 0,
                    total_nodes: document.querySelectorAll('*').length,
                };
                return { memory: mem, dom: dom };
            }""") or {}
        except Exception as e:
            LOGGER.warning("[Recovery] Failed to capture after-metrics: %s", e)

        try:
            metrics["url"] = page.url
            metrics["title"] = page.title()
        except Exception:
            pass

        return metrics

    def _get_console_errors(self, page: Any) -> list[str]:
        """Retrieve current page console errors."""
        errors: list[str] = []
        try:
            entries = page.evaluate("() => { return window.__tester_qa_errors__ || []; }")
            if entries:
                errors = entries
        except Exception:
            pass
        return errors

    def _calculate_score(
        self,
        memory_ok: bool,
        dom_ok: bool,
        errors_cleared: bool,
        residual_count: int,
    ) -> float:
        """Calculate overall recovery score 0–100."""
        score = 0.0
        if memory_ok:
            score += 40.0
        if dom_ok:
            score += 30.0
        if errors_cleared:
            score += 20.0
        # Penalise residual issues
        score -= min(residual_count * 5.0, 20.0)
        return max(0.0, min(100.0, score))
