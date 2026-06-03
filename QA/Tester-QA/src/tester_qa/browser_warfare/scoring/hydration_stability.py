"""Hydration stability scoring — assess SSR hydration contract integrity."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class HydrationStabilityResult:
    score: float          # 0-100
    mismatches: int
    extra_nodes: int
    removed_nodes: int
    state_corruptions: int
    verdict: str          # STABLE | DEGRADED | BROKEN
    recommendations: list[str]


class HydrationStabilityScorer:
    """Score and predict hydration stability under warfare conditions.

    Hydration contract:
      server renders HTML → client attaches JS → state must match.
    Warfare attacks violate this contract on purpose, then we measure
    how well the application recovers (or doesn't).
    """

    def score(self, warfare_result: dict) -> float:
        """Return a 0-100 stability score derived from hydration attack data."""
        hydr = warfare_result.get("hydration", {})

        mismatched = hydr.get("mismatched_nodes", 0)
        extra = hydr.get("extra_nodes_inserted", 0)
        removed = hydr.get("nodes_removed", 0)
        corruptions = hydr.get("state_corruptions", 0)

        score = 100.0
        score -= min(40.0, mismatched * 0.5)
        score -= min(25.0, extra * 0.05)
        score -= min(20.0, removed * 0.10)
        score -= min(15.0, corruptions * 2.0)
        return round(max(0.0, score), 1)

    def predict_hydration_failure(self, metrics: dict) -> dict[str, Any]:
        """Predict whether hydration will fail given current runtime metrics.

        Args:
            metrics: dict with keys like {dom_depth, component_count,
                     hydration_mismatches, state_size, ...}
        Returns:
            dict with keys: probability (0-1), threshold (none|mild|moderate|severe),
                            warning (str), factors (list[str])
        """
        prob = 0.0
        factors: list[str] = []

        # DOM tree depth contribution
        dom_depth = metrics.get("dom_depth", metrics.get("component_tree_depth", 0))
        if dom_depth > 30:
            prob += 0.25
            factors.append("deep-component-tree")
        elif dom_depth > 15:
            prob += 0.10

        # Hydration mismatch history
        prev_mismatches = metrics.get("hydration_mismatches", metrics.get("prev_mismatches", 0))
        if prev_mismatches > 50:
            prob += 0.30
            factors.append("prior-mismatch-history")
        elif prev_mismatches > 20:
            prob += 0.15

        # State size — large state = harder to hydrate
        state_size_kb = metrics.get("state_size_kb", 0)
        if state_size_kb > 500:
            prob += 0.20
            factors.append("large-hydration-state")
        elif state_size_kb > 200:
            prob += 0.10

        # Mismatched attribute density
        attr_mismatches = metrics.get("attribute_mismatches", 0)
        if attr_mismatches > 30:
            prob += 0.20
            factors.append("attribute-mismatch-pattern")

        prob = min(1.0, max(0.0, prob))

        # Determine threshold label
        if prob >= 0.70:
            threshold = "severe"
            warning = "CRITICAL — Hydration will almost certainly fail"
        elif prob >= 0.45:
            threshold = "moderate"
            warning = "WARNING — Hydration failure likely under load"
        elif prob >= 0.20:
            threshold = "mild"
            warning = "CAUTION — Minor hydration issues probable"
        else:
            threshold = "none"
            warning = "Hydration appears stable"

        return {
            "probability": round(prob, 4),
            "threshold": threshold,
            "warning": warning,
            "factors": factors,
        }

    def detailed_analysis(self, warfare_result: dict) -> HydrationStabilityResult:
        """Return a full hydration stability analysis."""
        hydr = warfare_result.get("hydration", {})
        mismatched = hydr.get("mismatched_nodes", 0)
        extra = hydr.get("extra_nodes_inserted", 0)
        removed = hydr.get("nodes_removed", 0)
        corruptions = hydr.get("state_corruptions", 0)

        score = self.score(warfare_result)

        verdict = "STABLE" if score >= 75 else "DEGRADED" if score >= 40 else "BROKEN"

        recs: list[str] = []
        if mismatched > 50:
            recs.append("Investigate SSR/CSR attribute mismatches — DOM diffing is broken")
        if extra > 200:
            recs.append("Server is rendering nodes the client doesn't expect — check routing/nested components")
        if removed > 100:
            recs.append("Critical DOM nodes missing after hydration — verify conditional rendering logic")
        if corruptions > 10:
            recs.append("State corruption detected — validate state hydration contracts before re-mount")
        if score < 40:
            recs.append("Hydration contract is broken — disable SSR for affected routes until fixed")

        return HydrationStabilityResult(
            score=score,
            mismatches=mismatched,
            extra_nodes=extra,
            removed_nodes=removed,
            state_corruptions=corruptions,
            verdict=verdict,
            recommendations=recs,
        )
