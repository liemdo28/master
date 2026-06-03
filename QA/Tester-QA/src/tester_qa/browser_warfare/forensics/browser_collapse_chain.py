"""Browser collapse propagation chain analysis."""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)


# Known collapse cause -> effect mappings
COLLAPSE_CHAIN_TEMPLATES: list[dict[str, str]] = [
    {"step": "memory_bomb", "effect": "heap_exhaustion"},
    {"step": "heap_exhaustion", "effect": "gc_storm"},
    {"step": "gc_storm", "effect": "main_thread_freeze"},
    {"step": "main_thread_freeze", "effect": "render_pipeline_stall"},
    {"step": "render_pipeline_stall", "effect": "frame_rate_collapse"},
    {"step": "frame_rate_collapse", "effect": "browser_unresponsive"},
    {"step": "browser_unresponsive", "effect": "tab_crash"},
    {"step": "tab_crash", "effect": "session_loss"},
]

# Collapse trigger -> initiating step mapping
TRIGGER_STEP_MAP: dict[str, str] = {
    "memory_bomb": "memory_bomb",
    "dom_flood": "dom_node_flood",
    "heap_exhaustion": "heap_exhaustion",
    "async_deadlock": "async_deadlock",
    "render_flood": "render_flood",
    "websocket_flood": "websocket_flood",
    "hydration_break": "hydration_break",
    "navigation_loop": "navigation_loop",
}


class BrowserCollapseChain:
    """Reconstructs how browser collapse propagates through the system."""

    def analyze(self, timeline: list[dict[str, Any]]) -> dict[str, Any]:
        """Analyze a warfare timeline and reconstruct the collapse propagation chain.

        Args:
            timeline: List of timeline event dicts from WarfareTimeline.build().

        Returns:
            Dict containing:
                - chain: list of {step, effect} propagation steps
                - trigger_event: dict describing what triggered the collapse
                - collapse_detected: bool
                - severity: 'low' | 'medium' | 'high' | 'extreme'
                - description: human-readable summary
        """
        if not timeline:
            return self._empty_result()

        # Identify events that contributed to collapse
        warfare_events = [e for e in timeline if e.get("event_type") != "snapshot"]
        snapshots = [e for e in timeline if e.get("event_type") == "snapshot"]

        # Find trigger event
        trigger = self.find_trigger_event(timeline)
        trigger_type = trigger.get("event_type", "unknown") if trigger else "unknown"

        # Build propagation chain
        chain = self._build_chain(timeline, trigger_type)

        # Assess severity
        severity = self._assess_severity(timeline, chain, trigger_type)

        LOGGER.info(
            "[CollapseChain] trigger=%s chain_length=%d severity=%s",
            trigger_type, len(chain), severity,
        )

        return {
            "chain": chain,
            "trigger_event": trigger,
            "collapse_detected": trigger is not None,
            "severity": severity,
            "description": self._describe_chain(chain, trigger_type),
            "events_analyzed": len(timeline),
            "warfare_events": len(warfare_events),
            "snapshots_captured": len(snapshots),
        }

    def find_trigger_event(self, timeline: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Find the event that triggered the collapse sequence.

        The trigger is identified as:
        1. The first 'memory_bomb' / 'hydration_break' / 'render_flood' event, OR
        2. The first event where metrics went critical (in a snapshot).
        """
        if not timeline:
            return None

        # Priority: look for explicit warfare events in order of severity
        priority_types = [
            "memory_bomb",
            "hydration_break",
            "render_flood",
            "async_deadlock",
            "websocket_flood",
            "navigation_loop",
        ]

        for ptype in priority_types:
            for event in timeline:
                if event.get("event_type") == ptype:
                    return event

        # Fallback: look for collapse event
        for event in timeline:
            if event.get("event_type") == "collapse":
                return event

        # Last resort: first snapshot with critical metrics
        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if self._has_critical_metrics(metrics):
                    return event

        # No clear trigger found — return last event as best guess
        return timeline[-1] if timeline else None

    # ─── Private helpers ─────────────────────────────────────────────────────

    def _build_chain(self, timeline: list[dict[str, Any]], trigger_type: str) -> list[dict[str, str]]:
        """Build the propagation chain based on trigger type."""
        # Use template chain rooted at the trigger
        base_chain = list(COLLAPSE_CHAIN_TEMPLATES)

        # Adjust first step to match actual trigger
        if trigger_type in TRIGGER_STEP_MAP:
            first_effect = base_chain[0]["effect"]
            base_chain[0] = {"step": trigger_type, "effect": first_effect}

        # Filter chain based on what actually occurred in timeline
        occurred_steps = {e.get("event_type") for e in timeline}
        filtered_chain = []
        for step in base_chain:
            if step["step"] in occurred_steps or step["effect"] in occurred_steps:
                filtered_chain.append(step)

        return filtered_chain

    def _assess_severity(
        self,
        timeline: list[dict[str, Any]],
        chain: list[dict[str, str]],
        trigger_type: str,
    ) -> str:
        """Assess collapse severity based on chain depth and event types."""
        # High-impact triggers
        high_impact = {"memory_bomb", "websocket_flood", "hydration_break"}
        medium_impact = {"render_flood", "async_deadlock", "navigation_loop"}

        severity_score = 0

        if trigger_type in high_impact:
            severity_score += 3
        elif trigger_type in medium_impact:
            severity_score += 2
        else:
            severity_score += 1

        severity_score += len(chain) // 3

        # Count critical snapshots
        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if self._has_critical_metrics(metrics):
                    severity_score += 1

        if severity_score >= 6:
            return "extreme"
        elif severity_score >= 4:
            return "high"
        elif severity_score >= 2:
            return "medium"
        return "low"

    def _has_critical_metrics(self, metrics: dict[str, Any]) -> bool:
        """Return True if metrics indicate a critical state."""
        if not metrics:
            return False

        if "usedJSHeapSize" in metrics and "jsHeapSizeLimit" in metrics:
            limit = max(metrics["jsHeapSizeLimit"], 1)
            if metrics["usedJSHeapSize"] / limit > 0.90:
                return True

        if "total_nodes" in metrics and metrics["total_nodes"] > 10_000:
            return True

        if "console_errors" in metrics and metrics["console_errors"] > 50:
            return True

        return False

    def _describe_chain(self, chain: list[dict[str, str]], trigger_type: str) -> str:
        """Generate a human-readable description of the collapse chain."""
        if not chain:
            return "No collapse chain detected."

        steps = [s["step"] for s in chain]
        effects = [s["effect"] for s in chain]

        return (
            f"Collapse triggered by '{trigger_type}' propagated through: "
            f"{' -> '.join(steps)} -> {effects[-1] if effects else 'unknown'} "
            f"({len(chain)} propagation steps)"
        )

    @staticmethod
    def _empty_result() -> dict[str, Any]:
        return {
            "chain": [],
            "trigger_event": None,
            "collapse_detected": False,
            "severity": "low",
            "description": "No warfare events recorded.",
            "events_analyzed": 0,
            "warfare_events": 0,
            "snapshots_captured": 0,
        }
