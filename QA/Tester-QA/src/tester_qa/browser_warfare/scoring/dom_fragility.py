"""DOM fragility scoring — measure DOM complexity and structural instability."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class DOMFragilityResult:
    score: float          # 0-100 (higher = more fragile = worse)
    live_node_count: int
    max_depth: int
    event_listener_count: int
    inline_style_count: int
    complexity_factors: list[str]
    verdict: str           # ROBUST | FRAGILE | CRITICAL


class DOMFragilityScorer:
    """Score DOM fragility based on structural complexity and instability signals.

    High DOM complexity correlates strongly with render jank, hydration failures,
    and memory pressure after warfare attacks.
    """

    def score(self, page: Any) -> float:
        """Return a fragility score (0-100) for a Playwright page object.

        Args:
            page: A Playwright Page object.
        Returns:
            0-100 fragility score. Higher = more fragile.
        """
        try:
            metrics = page.evaluate("""
                (function() {
                    var all = document.querySelectorAll('*');
                    var live = all.length;
                    var depth = 0;
                    function maxDepth(node, d) {
                        if (d > depth) depth = d;
                        for (var i = 0; i < node.childNodes.length; i++) {
                            maxDepth(node.childNodes[i], d + 1);
                        }
                    }
                    maxDepth(document.body, 0);
                    var listeners = 0;
                    try { listeners = getEventListeners ? getEventListeners(document.body).length : 0; } catch(e) {}
                    var inline = 0;
                    all.forEach(function(el) { if (el.hasAttribute('style')) inline++; });
                    return { live: live, depth: depth, listeners: listeners, inlineStyles: inline };
                })();
            """)
        except Exception:
            return 50.0  # Conservative default

        live = metrics.get("live", 0)
        depth = metrics.get("depth", 0)
        listeners = metrics.get("listeners", 0)
        inline_styles = metrics.get("inlineStyles", 0)

        frag = 0.0

        # Node count contribution (log-scaled to avoid over-weighting large pages)
        import math
        frag += min(30.0, math.log1p(live) * 3.0)

        # Depth contribution (deep DOMs are fragile)
        frag += min(25.0, depth * 1.5)

        # Event listener contribution
        frag += min(25.0, listeners * 0.5)

        # Inline style contribution (forces style recalculation)
        frag += min(20.0, inline_styles * 0.2)

        return round(min(100.0, frag), 1)

    def measure_dom_complexity(self, page: Any) -> int:
        """Return the live DOM node count as a raw complexity metric."""
        try:
            count = page.evaluate("return document.querySelectorAll('*').length;")
            return int(count) if count else 0
        except Exception:
            return 0

    def detailed_analysis(self, page: Any) -> DOMFragilityResult:
        """Return a full DOM fragility analysis for a Playwright page."""
        try:
            metrics = page.evaluate("""
                (function() {
                    var all = document.querySelectorAll('*');
                    var live = all.length;
                    var depth = 0;
                    function maxDepth(node, d) {
                        if (d > depth) depth = d;
                        for (var i = 0; i < node.childNodes.length; i++) {
                            maxDepth(node.childNodes[i], d + 1);
                        }
                    }
                    maxDepth(document.body, 0);
                    var listeners = 0;
                    try { listeners = getEventListeners ? getEventListeners(document.body).length : 0; } catch(e) {}
                    var inline = 0;
                    all.forEach(function(el) { if (el.hasAttribute('style')) inline++; });
                    return { live: live, depth: depth, listeners: listeners, inlineStyles: inline };
                })();
            """)
        except Exception:
            metrics = {"live": 0, "depth": 0, "listeners": 0, "inlineStyles": 0}

        live = metrics.get("live", 0)
        depth = metrics.get("depth", 0)
        listeners = metrics.get("listeners", 0)
        inline_styles = metrics.get("inlineStyles", 0)

        frag = self.score(page)
        verdict = "ROBUST" if frag < 30 else "FRAGILE" if frag < 65 else "CRITICAL"

        factors: list[str] = []
        import math
        if live > 1500:
            factors.append(f"excessive-nodes({live})")
        if depth > 25:
            factors.append(f"deep-dom-tree({depth})")
        if listeners > 100:
            factors.append(f"listener-bloat({listeners})")
        if inline_styles > 200:
            factors.append(f"inline-style-flood({inline_styles})")
        if math.log1p(live) * 3.0 > 20:
            factors.append("log-dom-bloat")

        return DOMFragilityResult(
            score=frag,
            live_node_count=live,
            max_depth=depth,
            event_listener_count=listeners,
            inline_style_count=inline_styles,
            complexity_factors=factors,
            verdict=verdict,
        )

    def score_from_metrics(self, metrics: dict) -> float:
        """Compute fragility score from a raw metrics dict (no Playwright needed).

        Args:
            metrics: dict with keys {live_nodes, dom_depth, event_listeners,
                     inline_styles}
        """
        import math
        live = metrics.get("live_nodes", 0)
        depth = metrics.get("dom_depth", 0)
        listeners = metrics.get("event_listeners", 0)
        inline = metrics.get("inline_styles", 0)

        frag = 0.0
        frag += min(30.0, math.log1p(live) * 3.0)
        frag += min(25.0, depth * 1.5)
        frag += min(25.0, listeners * 0.5)
        frag += min(20.0, inline * 0.2)

        return round(min(100.0, frag), 1)
