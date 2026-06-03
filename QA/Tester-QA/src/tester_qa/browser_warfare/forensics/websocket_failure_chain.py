"""WebSocket failure propagation chain."""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)


# WebSocket failure propagation template
WS_FAILURE_CHAIN: list[dict[str, str]] = [
    {"step": "websocket_flood", "effect": "connection_table_overflow"},
    {"step": "connection_table_overflow", "effect": "socket_handle_exhaustion"},
    {"step": "socket_handle_exhaustion", "effect": "reconnect_storm"},
    {"step": "reconnect_storm", "effect": "server_overload"},
    {"step": "server_overload", "effect": "message_queue_overflow"},
    {"step": "message_queue_overflow", "effect": "state_desynchronization"},
    {"step": "state_desynchronization", "effect": "client_state_corruption"},
    {"step": "client_state_corruption", "effect": "application_hang"},
]


class WebSocketFailureChain:
    """Analyzes how WebSocket failures propagate through the browser and server."""

    def analyze(self, timeline: list[dict[str, Any]]) -> dict[str, Any]:
        """Reconstruct the WebSocket failure propagation chain from a timeline.

        Args:
            timeline: List of timeline event dicts.

        Returns:
            Dict containing:
                - chain: list of {step, effect} propagation steps
                - trigger_event: first websocket_flood event found
                - failure_detected: bool
                - severity: 'low' | 'medium' | 'high' | 'extreme'
                - reconnect_storm: bool
                - state_desync: bool
                - description: human-readable summary
        """
        if not timeline:
            return self._empty_result()

        ws_events = [e for e in timeline if self._is_ws_event(e)]
        trigger = self._find_ws_trigger(timeline)
        chain = self._build_chain(timeline)
        severity = self._assess_severity(timeline, chain, ws_events)
        reconnect_storm = self._detect_reconnect_storm(timeline)
        state_desync = self._detect_state_desync(timeline)

        LOGGER.info(
            "[WSChain] trigger=%s chain_length=%d severity=%s reconnect_storm=%s desync=%s",
            trigger.get("event_type") if trigger else None,
            len(chain),
            severity,
            reconnect_storm,
            state_desync,
        )

        return {
            "chain": chain,
            "trigger_event": trigger,
            "failure_detected": trigger is not None,
            "severity": severity,
            "reconnect_storm": reconnect_storm,
            "state_desynchronization": state_desync,
            "ws_events_count": len(ws_events),
            "description": self._describe_chain(chain, trigger),
            "events_analyzed": len(timeline),
        }

    def find_trigger_event(self, timeline: list[dict[str, Any]]) -> dict[str, Any] | None:
        """Find the first websocket_flood event in the timeline."""
        for event in timeline:
            if event.get("event_type") == "websocket_flood":
                return event
        return None

    # ─── Private helpers ─────────────────────────────────────────────────────

    def _is_ws_event(self, event: dict[str, Any]) -> bool:
        etype = event.get("event_type", "")
        return etype in {
            "websocket_flood",
            "snapshot",
            "collapse",
        }

    def _find_ws_trigger(self, timeline: list[dict[str, Any]]) -> dict[str, Any] | None:
        return self.find_trigger_event(timeline)

    def _build_chain(self, timeline: list[dict[str, Any]]) -> list[dict[str, str]]:
        occurred = {e.get("event_type") for e in timeline}
        chain = []
        for step in WS_FAILURE_CHAIN:
            if step["step"] in occurred or step["effect"] in occurred:
                chain.append(step)
        return chain

    def _assess_severity(
        self,
        timeline: list[dict[str, Any]],
        chain: list[dict[str, str]],
        ws_events: list[dict[str, Any]],
    ) -> str:
        score = 0
        score += len(chain) // 2

        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if metrics.get("connections_opened", 0) > 20:
                    score += 2
                if metrics.get("messages_sent", 0) > 500:
                    score += 2

        if self._detect_reconnect_storm(timeline):
            score += 3
        if self._detect_state_desync(timeline):
            score += 2

        if score >= 7:
            return "extreme"
        elif score >= 5:
            return "high"
        elif score >= 3:
            return "medium"
        return "low"

    def _detect_reconnect_storm(self, timeline: list[dict[str, Any]]) -> bool:
        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if metrics.get("reconnect_attempts", 0) > 100:
                    return True
                if metrics.get("connections_opened", 0) > 30:
                    return True
        return False

    def _detect_state_desync(self, timeline: list[dict[str, Any]]) -> bool:
        for event in timeline:
            if event.get("event_type") == "snapshot":
                metrics = event.get("data", {}).get("metrics", {})
                if metrics.get("stale_state", False):
                    return True
                if metrics.get("message_loss_count", 0) > 10:
                    return True
        return False

    def _describe_chain(
        self,
        chain: list[dict[str, str]],
        trigger: dict[str, Any] | None,
    ) -> str:
        if not chain:
            return "No WebSocket failure chain detected."
        steps = [s["step"] for s in chain]
        effects = [s["effect"] for s in chain]
        trigger_str = trigger.get("event_type", "websocket_flood") if trigger else "websocket_flood"
        return (
            f"WebSocket failure triggered by '{trigger_str}' propagated through: "
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
            "reconnect_storm": False,
            "state_desynchronization": False,
            "ws_events_count": 0,
            "description": "No WebSocket failure events recorded.",
            "events_analyzed": 0,
        }
