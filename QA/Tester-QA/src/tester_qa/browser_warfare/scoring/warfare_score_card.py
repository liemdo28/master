"""Complete warfare score card — combines all metrics into a single report."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .browser_survival_score import BrowserSurvivalScorer, SurvivalScore
from .hydration_stability import HydrationStabilityScorer
from .websocket_reliability import WebSocketReliabilityScorer
from .dom_fragility import DOMFragilityScorer


@dataclass
class WarfareScoreCard:
    session_id: str = ""
    survival: SurvivalScore | None = None
    hydration_stability: float = 0.0   # 0-100
    ws_reliability: float = 0.0        # 0-100
    dom_fragility: float = 0.0         # 0-100 (higher = more fragile = worse)
    overall_score: float = 0.0         # 0-100
    collapse_probability: float = 0.0  # 0-1
    grades: dict[str, str] = field(default_factory=dict)
    timestamp: str = ""
    recommendations: list[str] = field(default_factory=list)
    metrics_breakdown: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "survival_score": self.survival.score if self.survival else 0.0,
            "survival_grade": self.survival.grade if self.survival else "N/A",
            "hydration_stability": self.hydration_stability,
            "ws_reliability": self.ws_reliability,
            "dom_fragility": self.dom_fragility,
            "overall_score": self.overall_score,
            "collapse_probability": self.collapse_probability,
            "grades": self.grades,
            "timestamp": self.timestamp,
            "recommendations": self.recommendations,
            "metrics_breakdown": self.metrics_breakdown,
        }


_GRADE_LABELS = {"A": "EXCEPTIONAL", "B": "GOOD", "C": "ACCEPTABLE", "D": "POOR", "F": "FAILURE"}


class WarfareScoreEngine:
    """Generate comprehensive warfare score cards from orchestrator results."""

    def __init__(self) -> None:
        self._survival_scorer = BrowserSurvivalScorer()
        self._hydration_scorer = HydrationStabilityScorer()
        self._ws_scorer = WebSocketReliabilityScorer()
        self._dom_scorer = DOMFragilityScorer()

    def generate_score_card(
        self,
        warfare_result: dict,
        ws_analysis: dict | None = None,
        dom_page: Any = None,
    ) -> WarfareScoreCard:
        """Generate a comprehensive warfare score card.

        Args:
            warfare_result: dict output from BrowserWarfareOrchestrator result.to_dict()
            ws_analysis: optional WS analysis dict; falls back to warfare_result["websocket"]
            dom_page: optional Playwright page; if not provided DOM fragility is
                      estimated from hydration data.
        """
        # ── Survival score ────────────────────────────────────────────────────
        survival = self._survival_scorer.calculate(warfare_result)

        # ── Hydration stability ───────────────────────────────────────────────
        hydration_stability = self._hydration_scorer.score(warfare_result)

        # ── WebSocket reliability ───────────────────────────────────────────────
        ws_data = ws_analysis if ws_analysis is not None else warfare_result.get("websocket", {})
        ws_reliability = self._ws_scorer.score(ws_data)

        # ── DOM fragility ───────────────────────────────────────────────────────
        if dom_page is not None:
            dom_fragility = self._dom_scorer.score(dom_page)
        else:
            # Estimate from hydration DOM node flood count
            dom_fragility = self._estimate_dom_fragility(warfare_result)

        # ── Overall score: survival-weighted blend ──────────────────────────────
        # DOM fragility is inverted (lower fragility = higher score)
        dom_score = 100.0 - dom_fragility
        overall = (
            survival.score    * 0.35
            + hydration_stability * 0.20
            + ws_reliability  * 0.25
            + dom_score        * 0.20
        )
        overall = round(max(0.0, min(100.0, overall)), 1)

        # ── Collapse probability ───────────────────────────────────────────────
        metrics_for_collapse = {
            "memory_percent": 50.0 + survival.score * 0.0,  # neutral; driven by factors below
            "memory_mb": warfare_result.get("memory", {}).get("estimated_mb", 0),
            "dom_nodes": warfare_result.get("memory", {}).get("dom_nodes_flooded", 0),
            "ws_disconnects": max(0, ws_data.get("connections_opened", 0) // 10),
            "hydration_mismatches": warfare_result.get("hydration", {}).get("mismatched_nodes", 0),
            "console_errors": warfare_result.get("console_errors", []),
        }
        prediction = self._survival_scorer.get_collapse_prediction(metrics_for_collapse)

        # ── Grades ──────────────────────────────────────────────────────────────
        grades = {
            "survival": survival.grade,
            "hydration": _grade(hydration_stability),
            "websocket": _grade(ws_reliability),
            "dom": _grade(dom_score),
            "overall": _grade(overall),
        }

        # ── Recommendations ─────────────────────────────────────────────────────
        recommendations = self._build_recommendations(
            survival=survival,
            hydration=hydration_stability,
            ws=ws_reliability,
            dom_fragility=dom_fragility,
            collapse_prob=prediction.probability,
        )

        # ── Session ID ──────────────────────────────────────────────────────────
        session_id = warfare_result.get("scenario", "unknown") + "-" + str(int(datetime.now(timezone.utc).timestamp()))

        return WarfareScoreCard(
            session_id=session_id,
            survival=survival,
            hydration_stability=hydration_stability,
            ws_reliability=ws_reliability,
            dom_fragility=dom_fragility,
            overall_score=overall,
            collapse_probability=prediction.probability,
            grades=grades,
            timestamp=datetime.now(timezone.utc).isoformat(),
            recommendations=recommendations,
            metrics_breakdown={
                "survival_score": survival.score,
                "hydration_stability": hydration_stability,
                "ws_reliability": ws_reliability,
                "dom_score": dom_score,
            },
        )

    def _estimate_dom_fragility(self, warfare_result: dict) -> float:
        """Estimate DOM fragility score from warfare result when no page is available."""
        import math
        dom_flooded = warfare_result.get("memory", {}).get("dom_nodes_flooded", 0)
        live_nodes = warfare_result.get("hydration", {}).get("extra_nodes_inserted", 0)
        depth = warfare_result.get("render_flood", {}).get("nodes_created", 0)
        frag = min(30.0, math.log1p(dom_flooded) * 3.0)
        frag += min(25.0, math.log1p(live_nodes) * 1.5)
        frag += min(25.0, math.log1p(depth) * 2.0)
        return round(min(100.0, frag), 1)

    def _build_recommendations(
        self,
        survival: SurvivalScore,
        hydration: float,
        ws: float,
        dom_fragility: float,
        collapse_prob: float,
    ) -> list[str]:
        recs: list[str] = []

        if survival.score < 65:
            recs.append(f"[SURVIVAL {survival.score}] — Browser struggled under warfare load. Increase memory headroom and optimize render paths.")
        if hydration < 60:
            recs.append(f"[HYDRATION {hydration:.0f}] — SSR hydration contract violated. Audit server/client state synchronisation.")
        if ws < 60:
            recs.append(f"[WEBSOCKET {ws:.0f}] — WS layer failed resilience tests. Add heartbeat, backoff reconnect, and message validation.")
        if dom_fragility > 65:
            recs.append(f"[DOM FRAGILITY {dom_fragility:.0f}] — DOM complexity is dangerous. Reduce DOM depth and remove unused event listeners.")
        if collapse_prob > 0.4:
            recs.append(f"[COLLAPSE {collapse_prob*100:.0f}%] — High collapse probability. Stop warfare and investigate root causes before continuing.")
        if not recs:
            recs.append("All subsystems passed warfare stress tests. Browser is resilient under attack.")
        return recs

    def export_score_report(self, card: WarfareScoreCard) -> str:
        """Export a WarfareScoreCard as a formatted markdown string."""
        lines: list[str] = []

        # ── Header ──────────────────────────────────────────────────────────────
        lines.append("# 🛡️ BROWSER WARFARE SCORE REPORT")
        lines.append("")
        lines.append(f"**Session:** `{card.session_id}`")
        lines.append(f"**Generated:** {card.timestamp}")
        lines.append("")
        lines.append("---")
        lines.append("")

        # ── Overall verdict ─────────────────────────────────────────────────────
        grade_label = _GRADE_LABELS.get(card.grades.get("overall", "F"), "UNKNOWN")
        lines.append(f"## OVERALL SCORE: {card.overall_score:.1f}  |  Grade: {card.grades.get('overall', 'N/A')} — {grade_label}")
        lines.append("")
        lines.append(f"**Collapse Probability:** {card.collapse_probability*100:.1f}%")
        lines.append("")

        # ── Score table ─────────────────────────────────────────────────────────
        rows = [
            ("Survival Score",       card.survival.score if card.survival else 0,   card.grades.get("survival", "N/A")),
            ("Hydration Stability",  card.hydration_stability,                     card.grades.get("hydration", "N/A")),
            ("WebSocket Reliability", card.ws_reliability,                         card.grades.get("websocket", "N/A")),
            ("DOM Fragility",        100 - card.dom_fragility,                     card.grades.get("dom", "N/A")),
        ]
        header = "| Metric | Score | Grade |"
        sep    = "|---|---|---|"
        lines.append(header)
        lines.append(sep)
        for label, score, grade in rows:
            lines.append(f"| {label} | {score:.1f} | **{grade}** |")
        lines.append("")

        # ── Factor breakdown (from survival) ────────────────────────────────────
        if card.survival:
            lines.append("### Survival Factor Breakdown")
            lines.append("")
            for factor, value in card.survival.factors.items():
                bar = _bar(value)
                lines.append(f"- **{factor.replace('_', ' ').title()}**: `{value:.1f}` {bar}")
            lines.append("")
            lines.append(f"**Recommendation:** {card.survival.recommendation}")
            lines.append("")

        # ── Recommendations ─────────────────────────────────────────────────────
        if card.recommendations:
            lines.append("### Recommendations")
            for rec in card.recommendations:
                lines.append(f"- {rec}")
            lines.append("")

        lines.append("---")
        lines.append("*Report generated by WarfareScoreEngine*")

        return "\n".join(lines)


def _grade(score: float) -> str:
    """Convert a 0-100 score to a letter grade."""
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 65: return "C"
    if score >= 45: return "D"
    return "F"


def _bar(value: float, width: int = 20) -> str:
    """ASCII progress bar."""
    filled = int(round(value / 100.0 * width))
    return "[" + "█" * filled + "░" * (width - filled) + "]"
