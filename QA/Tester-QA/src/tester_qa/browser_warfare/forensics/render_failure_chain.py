"""Render failure propagation chain."""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)


# Render failure propagation template
RENDER_FAILURE_CHAIN: list[dict[str, str]] = [
    {"step": "render_flood", "effect": "layout_thrash"},
    {"step": "layout_thrash", "effect": "style_recalc_storm"},
    {"step": "style_recalc_storm", "effect": "forced_reflow_cascade"},
    {"step": "forced_reflow_cascade", "effect": "frame_budget_exceeded"},
    {"step": "frame_budget_exceeded", "effect": "animation_jank"},
    {"step": "animation_jank", "effect": "paint_storm"},
    {"step": "paint_storm", "effect": "compositor_saturate"},
    {"step": "compositor_saturate", "effect": "render_hang"},
]


class RenderFailureChain:
    """Analyzes how render pipeline failures propagate through the browser."""

    def analyze(self, timeline: list[dict[str, Any]]) -> dict[str, Any]:
        """Reconstruct the render failure propagation chain from a timeline.

        Args:
            timeline: List of timeline event dicts.

        Returns:
            Dict containing:
                - chain: list of {step, effect} propagation steps
                - trigger_event: first render-flood event found
                - failure_detected: bool
                - severity: 'low' | 'medium' | 'high'
                - frame_budget_exceeded: bool
                - description: human-readable summary
        """
        if not timeline:
            return self._empty_result()

        render_events = [e for e in timeline if self._is_render_event(e)]
        trigger = self._find_render_trigger(timeline)
        chain = self._build_chain(timeline, trigger)
        severity = self._assess_severity(timeline, chain, render_events)
        frame_exceeded = self._detect_frame_budget_exceeded(timeline)

        LOGGER.info(
            "[RenderChain] trigger=%s chain_length=%d severity=%s frame_exceeded=%s",
            trigger.get("event_type") if trigger else None,
            len(chain),
            severity,
            frame_exceeded,
        )

        return {
            "chain": chain,
            "trigger_event": trigger,
            "failure_detected": trigger is not None,
            "severity": severity,
            "frame_budget_exceeded": frame_exceeded,
            "render_events_count": len(render_events),
            "description": self._describe_chain(chain, trigger),
            "events_analyzed": len(timeline),
        }

    def find_trigger_event(self, timeline: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Find the first render-flood event in the timeline."""
        for event in timeline:
            if event.get("event_type") == "render_flood":
                return event
        return None

    # ─── Private helpers ─────────────────────────────────────────────────────

    def _is_render_event(self, event: dict[str, Any]) -> bool:
        etype = event.get("event_type", "")
        return etype in {
            "render_flood",
            "snapshot",
            "collapse",
        }

    def _find_render_trigger(self, timeline: list[dict[str, Any]]) -> dict[str, Any] | None:
        return self.find_trigger_event(timeline)

    def _build_chain(
        self,
        timeline: list[dict[str, Any]],
        trigger: dict[str, Any] | None,
    ) -> list[dict[str, str]]:
        if not trigger:
            return []

        occurred = {e.get("event_type") for e in timeline}
        chain = []
        for step in RENDER_FAILURE_CHAIN:
            if step["step"] in occurred or step["effect"] in occurred:
                chain.append(step)

        return chain

    def _assess_severity(
        self,
        timeline: list[dict[str, Any]],
        chain: list[dict[str, str]],
        render_events: list[dict[str, Any]],
    ) -> str:
        score = 0
        score += len(chain) // 2

        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if metrics.get("forced_reflows", 0) > 100:
                    score += 2
                if metrics.get("style_bombs", 0) > 50:
                    score += 2

        if score >= 5:
            return "high"
        elif score >= 3:
            return "medium"
        return "low"

    def _detect_frame_budget_exceeded(self, timeline: list[dict[str, Any]]) -> bool:
        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if metrics.get("estimated_frame_drops", 0) > 30:
                    return True
                if metrics.get("frame_budget_ms", 16.67) < 10:
                    return True
        return False

    def _describe_chain(self, chain: list[dict[str, str]], trigger: dict[str, Any] | None) -> str:
        if not chain:
            return "No render failure chain detected."
        steps = [s["step"] for s in chain]
        effects = [s["effect"] for s in chain]
        trigger_str = trigger.get("event_type", "render_flood") if trigger else "render_flood"
        return (
            f"Render failure triggered by '{trigger_str}' propagated through: "
            f"{' -> '.join(steps)} -> {effects[-1] if effects else 'unknown'} "
            f"({len(chain)} propagation steps)"
        )

    @staticmethod
    def _empty_result() -> dict[str, Any]:
        return {
            "chain": [],
            "trigger_event": None,
            "failure_detected": False,
            "severity": "low",
            "frame_budget_exceeded": False,
            "render_events_count": 0,
            "description": "No render failure events recorded.",
            "events_analyzed": 0,
        }
