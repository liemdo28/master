"""WebSocket Stability Scorer — measures real-time connection reliability."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus


class WebSocketStabilityScorer:
    """Score WebSocket stability from connection health and failure patterns."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus or EventBus.get_instance()

    def calculate(
        self,
        desync_count: int = 0,
        reconnect_storm_count: int = 0,
        dead_socket_rate: float = 0.0,
        message_lag_ms: float = 0.0,
        total_connections: int = 1,
        dropped_connections: int = 0,
        avg_connection_age_seconds: float = 0.0,
        heartbeat_missed_rate: float = 0.0,
    ) -> dict[str, Any]:
        """
        Returns a WebSocket stability score (0-100), identified issues, and the
        reconnect storm rate.
        """
        desync    = self._resolve_int(desync_count,             "ws_desync_count",              0)
        storms    = self._resolve_int(reconnect_storm_count,   "ws_reconnect_storm_count",     0)
        dead_rate = self._resolve_float(dead_socket_rate,      "ws_dead_socket_rate",           0.0)
        lag       = self._resolve_float(message_lag_ms,         "ws_message_lag_ms",             0.0)
        total     = self._resolve_int(total_connections,        "ws_total_connections",         1)
        dropped   = self._resolve_int(dropped_connections,      "ws_dropped_connections",        0)
        age       = self._resolve_float(avg_connection_age_seconds, "ws_avg_connection_age_seconds", 0.0)
        heartbeat = self._resolve_float(heartbeat_missed_rate, "ws_heartbeat_missed_rate",      0.0)

        score = 100
        score -= min(30, desync * 5)
        if desync > 3:
            score -= 10
        score -= min(25, storms * 8)
        if storms > 2:
            score -= 10
        score -= int(dead_rate * 40)
        if lag > 1000:
            score -= min(20, int((lag - 1000) / 500) * 5)
        churn_rate = dropped / total if total > 0 else 0.0
        score -= int(churn_rate * 30)
        if age > 0 and age < 30:
            score -= 10
        score -= int(heartbeat * 25)
        score = max(0, min(100, score))

        reconnect_rate = round(storms / max(1, total), 4)

        issues: list[dict[str, Any]] = []
        if desync > 0:
            issues.append({"type": "desync",             "severity": "high",
                           "detail": f"{desync} desync event(s) — client/server state diverged"})
        if storms > 0:
            issues.append({"type": "reconnect_storm",     "severity": "critical" if storms > 2 else "medium",
                           "detail": f"{storms} reconnect storm(s) — many clients simultaneously reconnecting"})
        if dead_rate > 0.1:
            issues.append({"type": "dead_sockets",        "severity": "high",
                           "detail": f"Dead socket rate {dead_rate*100:.1f}% — connections not being cleaned up"})
        if lag > 1000:
            issues.append({"type": "message_lag",         "severity": "medium",
                           "detail": f"Message lag {lag:.0f}ms — exceeds 1s threshold; real-time UX degraded"})
        if churn_rate > 0.2:
            issues.append({"type": "connection_churn",    "severity": "medium",
                           "detail": f"{churn_rate*100:.0f}% connection churn — high rate of drops/reconnects"})
        if heartbeat > 0.3:
            issues.append({"type": "heartbeat_failures",  "severity": "high",
                           "detail": f"{heartbeat*100:.0f}% heartbeat miss rate — clients may be silently disconnected"})

        return {
            "score":          score,
            "issues":         issues,
            "reconnect_rate": reconnect_rate,
            "timestamp":      datetime.now(timezone.utc).isoformat(),
        }

    def _resolve_int(self, override: int, key: str, default: int) -> int:
        if override != 0:
            return override
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return int(val)
        return default

    def _resolve_float(self, override: float, key: str, default: float) -> float:
        if override != 0.0:
            return override
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return float(val)
        return default
