"""Browser survival score calculation after warfare attacks."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SurvivalScore:
    score: float          # 0-100
    grade: str            # A, B, C, D, F
    factors: dict[str, float]
    recommendation: str


@dataclass
class CollapsePrediction:
    probability: float   # 0.0-1.0
    threshold: str       # none | mild | moderate | severe | critical
    warning: str
    contributing_factors: list[str] = field(default_factory=list)


class BrowserSurvivalScorer:
    """Calculate how well the browser survived warfare attacks.

    Weights:
      - memory_normalized       : 25 %
      - dom_cleaned             : 20 %
      - console_errors_cleared  : 15 %
      - hydration_recovered     : 20 %
      - websocket_resynced      : 20 %
    """

    WEIGHTS = {
        "memory_normalized": 0.25,
        "dom_cleaned": 0.20,
        "console_errors_cleared": 0.15,
        "hydration_recovered": 0.20,
        "websocket_resynced": 0.20,
    }

    def calculate(self, warfare_result: dict) -> SurvivalScore:
        """Calculate survival score from a BrowserWarfareResult dict."""
        metrics = self._extract_metrics(warfare_result)
        factors = {k: v * 100 for k, v in metrics.items()}  # 0-100 scale

        weighted = sum(self.WEIGHTS[k] * factors[k] for k in self.WEIGHTS)
        score = round(max(0.0, min(100.0, weighted)), 1)
        grade = self._grade(score)
        recommendation = self._recommendation(score, factors)

        return SurvivalScore(
            score=score,
            grade=grade,
            factors=factors,
            recommendation=recommendation,
        )

    def _extract_metrics(self, result: dict) -> dict[str, float]:
        """Normalize raw warfare result dict into 0-1 factor scores."""
        # ── Memory ──────────────────────────────────────────────────────────────
        mem = result.get("memory", {})
        bytes_alloc = mem.get("bytes_allocated", 0)
        dom_flooded = mem.get("dom_nodes_flooded", 0)
        # 0 allocated = perfect, 100 MB+ = catastrophic
        norm = 1.0 - min(1.0, bytes_alloc / 150_000_000)
        dom_norm = 1.0 - min(1.0, dom_flooded / 10_000)
        memory_normalized = (norm + dom_norm) / 2

        # ── DOM cleaning ───────────────────────────────────────────────────────
        # DOM nodes flooded vs. current live nodes; lower flood = higher score
        live_nodes = self._live_dom_nodes(result)
        dom_cleaned = 1.0 if (dom_flooded < live_nodes * 0.1) else max(0.0, 1.0 - dom_flooded / (live_nodes + 1))

        # ── Console errors ─────────────────────────────────────────────────────
        errors = result.get("console_errors", [])
        console_errors_cleared = 1.0 - min(1.0, len(errors) / 20)

        # ── Hydration recovery ─────────────────────────────────────────────────
        hydr = result.get("hydration", {})
        mismatched = hydr.get("mismatched_nodes", 0)
        hydration_recovered = max(0.0, 1.0 - mismatched / 500)

        # ── WebSocket resync ───────────────────────────────────────────────────
        ws = result.get("websocket", {})
        corrupt_pct = self._corrupt_message_ratio(ws)
        reconnects = ws.get("reconnects_triggered", 0)
        websocket_resynced = (1.0 - corrupt_pct) * (1.0 - min(1.0, reconnects / 100))

        return {
            "memory_normalized": memory_normalized,
            "dom_cleaned": dom_cleaned,
            "console_errors_cleared": console_errors_cleared,
            "hydration_recovered": hydration_recovered,
            "websocket_resynced": websocket_resynced,
        }

    def _live_dom_nodes(self, result: dict) -> int:
        hydr = result.get("hydration", {})
        extra = hydr.get("extra_nodes_inserted", 0)
        removed = hydr.get("nodes_removed", 0)
        return max(1, extra - removed)

    def _corrupt_message_ratio(self, ws: dict) -> float:
        sent = ws.get("messages_sent", 0)
        corrupt = ws.get("corrupt_messages", 0)
        return 0.0 if sent == 0 else min(1.0, corrupt / sent)

    def _grade(self, score: float) -> str:
        if score >= 90: return "A"
        if score >= 80: return "B"
        if score >= 65: return "C"
        if score >= 45: return "D"
        return "F"

    def _recommendation(self, score: float, factors: dict[str, float]) -> str:
        if score >= 80:
            return "Browser demonstrates strong resilience. Continue monitoring."
        weak = [k.replace("_", " ") for k, v in factors.items() if v < 50]
        if weak:
            return f"Address: {', '.join(weak)}. Browser shows degradation under load."
        return "Browser is fragile under warfare conditions. Prioritize hardening."

    # ─── Collapse Prediction ───────────────────────────────────────────────────

    # Thresholds calibrated from chaos-test observations
    _COLLAPSE_RULES: list[tuple[float, str, str]] = [
        (0.75, "critical", "SEVERE", "Browser is 1-2 actions from collapse"),
        (0.50, "severe",   "HIGH",   "Memory pressure + instability detected"),
        (0.30, "moderate", "MEDIUM", "Browser showing signs of fatigue"),
        (0.15, "mild",     "LOW",    "Minor stress indicators present"),
        (0.00, "none",     "NONE",   "System within normal parameters"),
    ]

    def get_collapse_prediction(self, metrics: dict) -> CollapsePrediction:
        """Predict collapse probability from current runtime metrics.

        Args:
            metrics: dict with keys like {memory_percent, dom_nodes, ws_disconnects,
                     hydration_mismatches, console_errors, ...}
        """
        prob, threshold, warning = self._calc_collapse_probability(metrics)
        contributing = self._identify_contributing_factors(metrics, prob)

        return CollapsePrediction(
            probability=round(prob, 4),
            threshold=threshold,
            warning=warning,
            contributing_factors=contributing,
        )

    def _calc_collapse_probability(self, m: dict) -> tuple[float, str, str]:
        prob = 0.0

        mem_pct = m.get("memory_percent", m.get("memory_mb", 0)) / (
            100 if "memory_percent" in m else 500
        )
        prob += min(0.25, mem_pct * 0.25)

        dom_nodes = m.get("dom_nodes", m.get("dom_nodes_flooded", 0))
        prob += min(0.20, dom_nodes / 50_000)

        ws_disconnects = m.get("ws_disconnects", m.get("ws_disconnect_count", 0))
        prob += min(0.20, ws_disconnects / 10)

        hydr_issues = m.get("hydration_mismatches", m.get("mismatched_nodes", 0))
        prob += min(0.15, hydr_issues / 100)

        console_errors = m.get("console_errors", 0)
        if isinstance(console_errors, list):
            console_errors = len(console_errors)
        prob += min(0.15, console_errors / 30)

        prob = min(1.0, max(0.0, prob))

        for threshold_val, threshold_label, warning_label, _ in self._COLLAPSE_RULES:
            if prob >= threshold_val:
                return prob, threshold_label, warning_label
        return prob, "none", "NONE"

    def _identify_contributing_factors(
        self, m: dict, total_prob: float
    ) -> list[str]:
        factors: list[str] = []
        mem_pct = m.get("memory_percent", m.get("memory_mb", 0))
        if mem_pct > 80 or m.get("memory_mb", 0) > 400:
            factors.append("high-memory-pressure")
        if m.get("dom_nodes", 0) > 30_000:
            factors.append("dom-bloat")
        if m.get("ws_disconnects", 0) > 5:
            factors.append("websocket-instability")
        if m.get("hydration_mismatches", 0) > 20:
            factors.append("hydration-failure")
        err_count = (
            len(m["console_errors"])
            if isinstance(m.get("console_errors"), list)
            else m.get("console_errors", 0)
        )
        if err_count > 10:
            factors.append("console-error-flood")
        return factors
