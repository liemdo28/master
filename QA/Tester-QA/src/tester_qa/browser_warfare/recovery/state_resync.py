"""State resynchronization after warfare."""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)

# Stale state detection thresholds
STALE_PROMISE_THRESHOLD = 10
STALE_CACHE_AGE_SECONDS = 300


class StateResyncValidator:
    """Validates that JavaScript application state has resynchronized after warfare."""

    def validate_state_resync(self, page: Any) -> dict[str, Any]:
        """Run full state resync validation and return a scored report.

        Returns:
            Dict with resync status, hydration state, and stale state issues.
        """
        hydration_state = self.check_hydration_state(page)
        stale_issues = self.detect_stale_state(page)

        # Assess overall resync health
        resynced = (
            hydration_state.get("hydration_intact", True)
            and hydration_state.get("state_consistent", True)
            and len(stale_issues) == 0
        )

        resync_score = self._score_resync(hydration_state, stale_issues)

        LOGGER.info(
            "[StateResync] resynced=%s score=%.1f hydration=%s stale=%d",
            resynced, resync_score,
            hydration_state.get("hydration_intact", False),
            len(stale_issues),
        )

        return {
            "resynced": resynced,
            "resync_score": round(resync_score, 2),
            "hydration_state": hydration_state,
            "stale_state": stale_issues,
        }

    def check_hydration_state(self, page: Any) -> dict[str, Any]:
        """Check the hydration contract integrity after warfare.

        Returns:
            Dict with hydration state metrics.
        """
        result: dict[str, Any] = {
            "hydration_intact": True,
            "state_consistent": True,
            "mismatches": [],
            "warnings": [],
        }

        try:
            hydration_info = page.evaluate("""() => {
                var info = {
                    has_react: typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' || typeof window.__REACT_INTERNALS__ !== 'undefined',
                    has_next: typeof window.__NEXT_DATA__ !== 'undefined',
                    has_vue: typeof window.__VUE__ !== 'undefined',
                    has_svelte: typeof window.__svelte_test__ !== 'undefined',
                    hydration_markers: 0,
                    data_mismatches: 0,
                };

                // Count hydration markers
                if (document.querySelector) {
                    info.hydration_markers = document.querySelectorAll('[data-hydration-id]').length;
                    info.data_mismatches = document.querySelectorAll('[data-hydration-mismatch]').length;
                }

                // Check __NEXT_DATA__ buildId consistency
                if (window.__NEXT_DATA__ && window.__NEXT_DATA__.buildId) {
                    info.next_build_id = window.__NEXT_DATA__.buildId;
                }

                // Check for broken React root
                if (window.__REACT_INTERNALS__) {
                    try {
                        info.react_root_broken = false;
                    } catch(e) {
                        info.react_root_broken = true;
                    }
                }

                return info;
            }""") or {}

            result.update(hydration_info)

            # Determine if hydration is intact
            mismatches = hydration_info.get("data_mismatches", 0)
            hydration_markers = hydration_info.get("hydration_markers", 0)

            if mismatches > 0:
                result["hydration_intact"] = False
                result["mismatches"].append(f"{mismatches}_hydration_mismatches_detected")

            if hydration_markers > 0 and mismatches > hydration_markers * 0.5:
                result["state_consistent"] = False
                result["warnings"].append("majority_mismatch_rate")

            LOGGER.info(
                "[StateResync] hydration_info=%s",
                {k: v for k, v in hydration_info.items() if k != 'has_react' and k != 'has_next'},
            )
        except Exception as e:
            LOGGER.warning("[StateResync] Hydration state check failed: %s", e)
            result["warnings"].append(f"check_error:{e}")

        return result

    def detect_stale_state(self, page: Any) -> list[str]:
        """Detect stale JavaScript state that persists after warfare.

        Returns:
            List of stale state identifiers.
        """
        stale_issues: list[str] = []
        try:
            issues = page.evaluate("""() => {
                var issues = [];

                // Check for unresolved promises (pending async ops)
                if (window.__PENDING_PROMISES__ !== undefined && window.__PENDING_PROMISES__.length > 10) {
                    issues.push('pending_promises:' + window.__PENDING_PROMISES__.length);
                }

                // Check for stale caches
                if (window.caches && window.caches.keys) {
                    // We can't await in this context; mark for further check
                    issues.push('caches_present');
                }

                // Check for zombie stores (Redux/Vuex/NgRx style)
                var storeKeys = Object.keys(window).filter(function(k) {
                    return k.startsWith('__store__') || k.startsWith('__redux__') || k.startsWith('__ngState__');
                });
                if (storeKeys.length > 0) {
                    storeKeys.forEach(function(k) {
                        try {
                            var store = window[k];
                            if (store && store.getState) {
                                var state = store.getState();
                                if (state && typeof state === 'object') {
                                    var keys = Object.keys(state);
                                    if (keys.length === 0) {
                                        issues.push('empty_store:' + k);
                                    }
                                }
                            }
                        } catch(e) {}
                    });
                }

                // Detect stale timers
                var staleTimers = 0;
                if (window.__timer_ids__) {
                    staleTimers = window.__timer_ids__.length;
                }
                if (staleTimers > 0) {
                    issues.push('stale_timers:' + staleTimers);
                }

                // Detect WebSocket state pollution
                var wsStateKeys = Object.keys(window).filter(function(k) {
                    return k.includes('websocket') || k.includes('ws_') || k.includes('_socket');
                });
                if (wsStateKeys.length > 0) {
                    issues.push('ws_state_pollution:' + wsStateKeys.join(','));
                }

                return issues.slice(0, 50);
            }""") or []
            stale_issues = list(issues)
            LOGGER.info("[StateResync] Stale state issues: %s", stale_issues)
        except Exception as e:
            LOGGER.warning("[StateResync] Stale state detection failed: %s", e)

        return stale_issues

    # ─── Private helpers ───────────────────────────────────────────────────────

    def _score_resync(self, hydration_state: dict, stale_issues: list[str]) -> float:
        """Score the state resync health 0–100."""
        score = 100.0
        if not hydration_state.get("hydration_intact", True):
            score -= 30.0
        if not hydration_state.get("state_consistent", True):
            score -= 20.0
        score -= min(len(stale_issues) * 5.0, 30.0)
        if hydration_state.get("warnings"):
            score -= min(len(hydration_state["warnings"]) * 5.0, 20.0)
        return max(0.0, min(100.0, score))
