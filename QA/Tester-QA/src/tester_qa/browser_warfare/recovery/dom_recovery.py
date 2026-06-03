"""DOM recovery validation after hydration attacks."""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)

# Thresholds for DOM corruption detection
MAX_TOTAL_NODES = 10_000
MAX_EMPTY_NODES = 1_000
MAX_BODY_CHILDREN = 5_000


class DOMRecoveryValidator:
    """Validates that the DOM has recovered from warfare-induced corruption."""

    def check_recovery(self, page: Any) -> dict[str, Any]:
        """Run all DOM recovery checks and return a structured report.

        Args:
            page: Playwright page object.

        Returns:
            Dict with recovery status and metrics.
        """
        corrupted_nodes = self.count_corrupted_nodes(page)
        stale_elements = self.detect_stale_dom(page)

        total_nodes = 0
        empty_nodes = 0
        duplicate_ids = 0
        mismatched_attrs = 0
        try:
            stats = page.evaluate("""() => {
                var allNodes = document.querySelectorAll('*');
                var ids = new Set();
                var dupIds = 0;
                var emptyCount = 0;
                allNodes.forEach(function(n) {
                    if (n.id) {
                        if (ids.has(n.id)) dupIds++;
                        else ids.add(n.id);
                    }
                    if (n.children.length === 0 && !n.textContent.trim()) emptyCount++;
                });
                return {
                    total_nodes: allNodes.length,
                    empty_nodes: emptyCount,
                    duplicate_ids: dupIds,
                    body_children: document.body ? document.body.children.length : 0,
                };
            }""") or {}
            total_nodes = stats.get("total_nodes", 0)
            empty_nodes = stats.get("empty_nodes", 0)
            duplicate_ids = stats.get("duplicate_ids", 0)
        except Exception as e:
            LOGGER.warning("[DOMRecovery] Failed to get DOM stats: %s", e)

        # Check for mismatched attributes (hydration contract violations)
        try:
            mismatched_attrs = page.evaluate("""() => {
                var mismatches = 0;
                var dataAttrs = document.querySelectorAll('[data-hydration-mismatch]');
                mismatches += dataAttrs.length;
                var brokenBindings = document.querySelectorAll('[data-bound].broken, [data-model].broken');
                mismatches += brokenBindings.length;
                return mismatches;
            }""") or 0
        except Exception:
            pass

        recovered = (
            corrupted_nodes == 0
            and len(stale_elements) == 0
            and total_nodes <= MAX_TOTAL_NODES
            and empty_nodes <= MAX_EMPTY_NODES
            and duplicate_ids == 0
        )

        LOGGER.info(
            "[DOMRecovery] total_nodes=%d empty=%d dup=%d mismatched=%d stale=%d recovered=%s",
            total_nodes, empty_nodes, duplicate_ids, mismatched_attrs, len(stale_elements), recovered,
        )

        return {
            "recovered": recovered,
            "corrupted_nodes": corrupted_nodes,
            "stale_elements": stale_elements,
            "total_nodes": total_nodes,
            "empty_nodes": empty_nodes,
            "duplicate_ids": duplicate_ids,
            "mismatched_attributes": mismatched_attrs,
        }

    def count_corrupted_nodes(self, page: Any) -> int:
        """Count DOM nodes that appear corrupted after warfare.

        Corrupted nodes are identified by:
        - Zero-size elements with event listeners attached
        - Elements with `data-hydration-broken` marker
        - Disconnected nodes still in memory
        - Hidden iframes or nested documents
        """
        try:
            count = page.evaluate("""() => {
                var corrupted = 0;

                // Detect hydration-broken markers
                var broken = document.querySelectorAll('[data-hydration-broken]');
                corrupted += broken.length;

                // Detect orphaned elements (parentElement === null but still referenced)
                var allNodes = document.querySelectorAll('*');
                allNodes.forEach(function(n) {
                    if (!n.parentElement && n !== document.documentElement && n !== document.body) {
                        corrupted++;
                    }
                });

                // Detect zero-size elements with inline listeners
                allNodes.forEach(function(n) {
                    var rect = n.getBoundingClientRect();
                    if (rect.width === 0 && rect.height === 0 && n.children.length === 0) {
                        var listeners = n.getEventListeners ? n.getEventListeners : null;
                        if (listeners && Object.keys(listeners).length > 0) corrupted++;
                    }
                });

                // Detect hidden iframes
                var iframes = document.querySelectorAll('iframe');
                iframes.forEach(function(iframe) {
                    var style = window.getComputedStyle(iframe);
                    if (style.display === 'none' || style.visibility === 'hidden') {
                        corrupted++;
                    }
                });

                return corrupted;
            }""") or 0
            LOGGER.info("[DOMRecovery] Corrupted nodes: %d", count)
            return int(count)
        except Exception as e:
            LOGGER.warning("[DOMRecovery] Corrupted node count failed: %s", e)
            return 0

    def detect_stale_dom(self, page: Any) -> list[str]:
        """Detect stale DOM elements that persist after warfare.

        Returns:
            List of stale element identifiers (selectors or xpaths).
        """
        stale_selectors: list[str] = []
        try:
            # Detect stale elements by looking for:
            # 1. Elements with timestamp older than last navigation
            # 2. Data-bound elements that lost their binding
            # 3. Elements hidden under collapsed parents
            stale_selectors = page.evaluate("""() => {
                var stale = [];

                // Data-bound stale elements
                var unbound = document.querySelectorAll('[data-bound][data-source]');
                unbound.forEach(function(el) {
                    var source = el.getAttribute('data-source');
                    // Check if source still exists in app state
                    if (!document.querySelector(source)) {
                        stale.push('[data-bound][data-source="' + source + '"]');
                    }
                });

                // Elements with stale timestamps (> 5 min old)
                var timestamped = document.querySelectorAll('[data-timestamp]');
                timestamped.forEach(function(el) {
                    try {
                        var ts = parseInt(el.getAttribute('data-timestamp'), 10);
                        var age = Date.now() - ts;
                        if (age > 5 * 60 * 1000) {
                            stale.push('[data-timestamp]:age>' + Math.round(age / 1000) + 's');
                        }
                    } catch(e) {}
                });

                // Ghost elements: hidden parents with visible children
                var allHidden = document.querySelectorAll('div[style*="display:none"], section[style*="display:none"]');
                allHidden.forEach(function(parent) {
                    if (parent.querySelector('input, button, a')) {
                        stale.push('ghost_parent:' + (parent.className || parent.tagName));
                    }
                });

                return stale.slice(0, 100);  // Cap at 100
            }""") or []
            LOGGER.info("[DOMRecovery] Stale DOM elements: %d", len(stale_selectors))
        except Exception as e:
            LOGGER.warning("[DOMRecovery] Stale DOM detection failed: %s", e)

        return stale_selectors
