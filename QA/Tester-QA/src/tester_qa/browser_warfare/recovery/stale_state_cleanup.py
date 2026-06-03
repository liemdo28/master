"""Detect and clean stale DOM/state after warfare."""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)

# Cleanup thresholds
MAX_STALE_ELEMENTS_BEFORE_FORCE = 50


class StaleStateCleanup:
    """Detects and optionally cleans stale DOM elements and state after warfare."""

    def detect_stale_elements(self, page: Any) -> list[str]:
        """Detect stale DOM elements that should be cleaned up.

        Returns:
            List of stale element identifiers (selectors).
        """
        stale: list[str] = []
        try:
            stale = page.evaluate("""() => {
                var result = [];

                // 1. Ghost parent elements (hidden parents with interactive children)
                var parents = document.querySelectorAll('div, section, span');
                parents.forEach(function(p) {
                    try {
                        var style = p.style;
                        var displayNone = style.display === 'none';
                        var visibilityHidden = style.visibility === 'hidden';
                        if (displayNone || visibilityHidden) {
                            var interactive = p.querySelector('button, input, a, select, textarea');
                            if (interactive) {
                                result.push('ghost:' + (p.className || p.tagName) + ':' + p.id);
                            }
                        }
                    } catch(e) {}
                });

                // 2. Empty containers with event listeners
                var all = document.querySelectorAll('div, span, td, li');
                all.forEach(function(el) {
                    try {
                        var isEmpty = el.children.length === 0 && !el.textContent.trim();
                        var hasListeners = el.hasAttribute('data-listener') || el.hasAttribute('onclick');
                        if (isEmpty && hasListeners) {
                            result.push('orphan_listener:' + (el.className || el.tagName));
                        }
                    } catch(e) {}
                });

                // 3. Elements with data-bound attributes but missing source
                var bound = document.querySelectorAll('[data-source]');
                bound.forEach(function(el) {
                    try {
                        var src = el.getAttribute('data-source');
                        if (src && !document.querySelector(src)) {
                            result.push('unbound:' + el.className);
                        }
                    } catch(e) {}
                });

                // 4. Duplicate elements (same ID or data-uid)
                var idMap = {};
                var dupIds = [];
                var uidMap = {};
                document.querySelectorAll('[id], [data-uid]').forEach(function(el) {
                    var id = el.id || el.getAttribute('data-uid');
                    if (id) {
                        var map = el.id ? idMap : uidMap;
                        if (map[id]) {
                            dupIds.push(id);
                        } else {
                            map[id] = true;
                        }
                    }
                });
                dupIds.slice(0, 20).forEach(function(dup) {
                    result.push('duplicate:' + dup);
                });

                // 5. Elements past expiration threshold
                var expired = document.querySelectorAll('[data-expires]');
                expired.forEach(function(el) {
                    try {
                        var expires = parseInt(el.getAttribute('data-expires'), 10);
                        if (Date.now() > expires) {
                            result.push('expired:' + (el.className || el.tagName));
                        }
                    } catch(e) {}
                });

                return result.slice(0, 200);
            }""") or []
            LOGGER.info("[Cleanup] Detected %d stale elements", len(stale))
        except Exception as e:
            LOGGER.warning("[Cleanup] Stale element detection failed: %s", e)

        return stale

    def force_cleanup(self, page: Any) -> int:
        """Force cleanup of detected stale elements via JavaScript injection.

        Returns:
            Number of elements removed.
        """
        removed = 0
        try:
            removed = page.evaluate("""() => {
                var removed = 0;

                // Remove ghost parent elements
                var ghostParents = document.querySelectorAll('[data-ghost]');
                ghostParents.forEach(function(el) {
                    el.remove();
                    removed++;
                });

                // Remove expired elements
                var expired = document.querySelectorAll('[data-expires]');
                expired.forEach(function(el) {
                    try {
                        var expires = parseInt(el.getAttribute('data-expires'), 10);
                        if (Date.now() > expires) {
                            el.remove();
                            removed++;
                        }
                    } catch(e) {}
                });

                // Remove zero-size elements with no meaningful content
                var zeroSize = document.querySelectorAll('div, span, td');
                zeroSize.forEach(function(el) {
                    try {
                        var rect = el.getBoundingClientRect();
                        var isEmpty = el.children.length === 0 && !el.textContent.trim();
                        var isOrphan = !el.textContent && el.children.length === 0 && !el.hasAttribute('data-bound');
                        if ((rect.width === 0 && rect.height === 0) || isOrphan) {
                            // Only remove if truly garbage
                            if (isEmpty) {
                                el.remove();
                                removed++;
                            }
                        }
                    } catch(e) {}
                });

                // Remove orphaned data attributes (strip stale data)
                var allNodes = document.querySelectorAll('*');
                allNodes.forEach(function(el) {
                    var staleAttrs = [];
                    for (var i = 0; i < el.attributes.length; i++) {
                        var attr = el.attributes[i];
                        if (attr.name.startsWith('data-stale-') || attr.name.startsWith('data-warfare-')) {
                            staleAttrs.push(attr.name);
                        }
                    }
                    staleAttrs.forEach(function(name) {
                        el.removeAttribute(name);
                    });
                });

                return removed;
            }""") or 0
            LOGGER.info("[Cleanup] Force cleanup removed %d elements", removed)
        except Exception as e:
            LOGGER.warning("[Cleanup] Force cleanup failed: %s", e)

        return int(removed)

    def measure_cleanup_effectiveness(self, page: Any) -> dict[str, Any]:
        """Measure the effectiveness of DOM/state cleanup.

        Returns:
            Dict with before/after metrics showing cleanup impact.
        """
        # Capture before metrics
        before = self._snapshot_dom(page)

        # Perform cleanup
        removed = self.force_cleanup(page)

        # Capture after metrics
        after = self._snapshot_dom(page)

        # Re-detect remaining stale elements
        remaining_stale = self.detect_stale_elements(page)

        # Calculate improvement
        node_reduction = before.get("total_nodes", 0) - after.get("total_nodes", 0)
        effectiveness_score = 0.0
        if before.get("total_nodes", 0) > 0:
            effectiveness_score = (node_reduction / before["total_nodes"]) * 100

        LOGGER.info(
            "[Cleanup] Effectiveness: removed=%d nodes_delta=%d effectiveness=%.1f%% remaining_stale=%d",
            removed, node_reduction, effectiveness_score, len(remaining_stale),
        )

        return {
            "removed_count": removed,
            "before": before,
            "after": after,
            "node_reduction": node_reduction,
            "effectiveness_score": round(effectiveness_score, 2),
            "remaining_stale_elements": remaining_stale,
            "stale_elements_cleared": len(before.get("stale_selectors", [])) - len(remaining_stale),
        }

    # ─── Private helpers ──────────────────────────────────────────────────────

    def _snapshot_dom(self, page: Any) -> dict[str, Any]:
        """Take a DOM snapshot for before/after comparison."""
        try:
            return page.evaluate("""() => {
                var all = document.querySelectorAll('*');
                return {
                    total_nodes: all.length,
                    body_children: document.body ? document.body.children.length : 0,
                    hidden_nodes: 0,
                };
            }""") or {}
        except Exception as e:
            LOGGER.warning("[Cleanup] Snapshot failed: %s", e)
            return {}
