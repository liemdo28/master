"""DOM snapshot — captures and compares DOM state before/during/after warfare."""
from __future__ import annotations

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

# JavaScript injected into pages to capture DOM state
_CAPTURE_JS = """() => {
    const serializeNode = (node, depth) => {
        if (depth > 20) return '<max-depth-reached>';
        if (node.nodeType === Node.TEXT_NODE) {
            return { type: 'text', text: node.textContent || '' };
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            const children = [];
            for (const child of node.childNodes) {
                children.push(serializeNode(child, depth + 1));
            }
            return {
                type: 'element',
                tag: node.tagName,
                id: node.id || null,
                class: node.className || null,
                children,
            };
        }
        return null;
    };
    return {
        root: serializeNode(document.body || document.documentElement, 0),
        stats: {
            totalNodes: document.querySelectorAll('*').length,
            textNodes: document.body
                ? document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
                    .root
                    .walker
                    ? 0
                    : 0
                : 0,
            title: document.title,
            readyState: document.readyState,
        },
    };
}"""

_MUTATION_JS = """(before) => {
    if (!before || !before.root) return { mutated: false, reason: 'no baseline' };
    const after = (function() {
        const serializeNode = (node, depth) => {
            if (depth > 20) return '<max-depth-reached>';
            if (node.nodeType === Node.TEXT_NODE) {
                return { type: 'text', text: node.textContent || '' };
            }
            if (node.nodeType === Node.ELEMENT_NODE) {
                const children = [];
                for (const child of node.childNodes) {
                    children.push(serializeNode(child, depth + 1));
                }
                return {
                    type: 'element',
                    tag: node.tagName,
                    id: node.id || null,
                    class: node.className || null,
                    children,
                };
            }
            return null;
        };
        return {
            root: serializeNode(document.body || document.documentElement, 0),
            stats: {
                totalNodes: document.querySelectorAll('*').length,
                title: document.title,
                readyState: document.readyState,
            },
        };
    })();

    const beforeNodes = before.stats ? before.stats.totalNodes : 0;
    const afterNodes = after.stats ? after.stats.totalNodes : 0;
    const titleChanged = before.stats?.title !== after.stats?.title;
    const readyStateChanged = before.stats?.readyState !== after.stats?.readyState;
    const nodeDelta = afterNodes - beforeNodes;

    return {
        mutated: titleChanged || readyStateChanged || Math.abs(nodeDelta) > 10,
        nodeDelta,
        beforeTotalNodes: beforeNodes,
        afterTotalNodes: afterNodes,
        titleChanged,
        readyStateChanged,
        after,
    };
}"""


class DomSnapshot:
    """Captures DOM state and detects structural changes over time."""

    def __init__(self) -> None:
        self._baseline: Optional[dict[str, Any]] = None

    def capture(self, page: Any) -> dict[str, Any]:
        """Capture the current DOM state from a Playwright page.

        Args:
            page: A live Playwright page object.

        Returns:
            Serialisable dict representing the DOM.
        """
        try:
            return page.evaluate(_CAPTURE_JS)
        except Exception as e:
            logger.warning("[DomSnapshot] Capture failed: %s", e)
            return {"error": str(e)}

    def compare(self, before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
        """Compare two DOM snapshots and return a diff summary.

        Args:
            before: DOM snapshot from earlier.
            after: DOM snapshot from later.

        Returns:
            Diff dict with node counts, changed flags, and structural info.
        """
        if not before or not after:
            return {"error": "Missing baseline or current snapshot"}

        try:
            b_stats = before.get("stats", {})
            a_stats = after.get("stats", {})

            b_nodes = b_stats.get("totalNodes", 0)
            a_nodes = a_stats.get("totalNodes", 0)

            return {
                "node_delta": a_nodes - b_nodes,
                "before_total_nodes": b_nodes,
                "after_total_nodes": a_nodes,
                "title_changed": b_stats.get("title") != a_stats.get("title"),
                "ready_state_changed": b_stats.get("readyState")
                != a_stats.get("readyState"),
                "significant_change": abs(a_nodes - b_nodes) > 10
                or b_stats.get("title") != a_stats.get("title"),
            }
        except Exception as e:
            logger.warning("[DomSnapshot] Compare failed: %s", e)
            return {"error": str(e)}

    def detect_mutations(
        self,
        before: dict[str, Any],
        after: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Detect specific mutations between two DOM snapshots.

        Args:
            before: DOM snapshot from earlier.
            after: DOM snapshot from later.

        Returns:
            List of mutation descriptors.
        """
        mutations: list[dict[str, Any]] = []

        if not before or not after:
            return [{"type": "error", "message": "Missing snapshot"}]

        comparison = self.compare(before, after)
        if comparison.get("error"):
            return [comparison]

        b_stats = before.get("stats", {})
        a_stats = after.get("stats", {})

        b_nodes = b_stats.get("totalNodes", 0)
        a_nodes = a_stats.get("totalNodes", 0)
        delta = a_nodes - b_nodes

        if delta > 10:
            mutations.append({
                "type": "node_inflation",
                "message": f"DOM grew by {delta} nodes",
                "delta": delta,
            })
        elif delta < -10:
            mutations.append({
                "type": "node_deflation",
                "message": f"DOM shrunk by {abs(delta)} nodes",
                "delta": delta,
            })

        if b_stats.get("title") != a_stats.get("title"):
            mutations.append({
                "type": "title_change",
                "before": b_stats.get("title", ""),
                "after": a_stats.get("title", ""),
            })

        if b_stats.get("readyState") != a_stats.get("readyState"):
            mutations.append({
                "type": "ready_state_change",
                "before": b_stats.get("readyState", ""),
                "after": a_stats.get("readyState", ""),
            })

        return mutations

    def set_baseline(self, page: Any) -> None:
        """Capture and store a baseline DOM snapshot."""
        self._baseline = self.capture(page)

    def clear_baseline(self) -> None:
        """Clear the stored baseline."""
        self._baseline = None

    @property
    def baseline(self) -> Optional[dict[str, Any]]:
        """Return the stored baseline snapshot."""
        return self._baseline
