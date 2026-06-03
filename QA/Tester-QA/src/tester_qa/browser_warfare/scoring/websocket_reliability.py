"""WebSocket reliability scoring — measure WS resilience under swarm attacks."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any


@dataclass
class WebSocketReliabilityResult:
    score: float                     # 0-100
    connections_opened: int
    corrupt_ratio: float              # 0-1
    reconnect_storm_detected: bool
    message_delivery_rate: float      # 0-1
    verdict: str                      # STABLE | DEGRADED | UNSTABLE


# In-process record of reconnection timestamps for storm detection
_reconnect_timestamps: list[float] = []


class WebSocketReliabilityScorer:
    """Score WebSocket reliability and detect reconnection storms.

    A reconnect storm occurs when a large number of connections try to
    re-establish simultaneously, overwhelming the server's accept queue.
    """

    def score(self, analysis: dict) -> float:
        """Score WS reliability from a swarm result dict.

        Args:
            analysis: dict with keys like {connections_opened, messages_sent,
                     corrupt_messages, reconnects_triggered, ...}
        Returns: 0-100 score (higher = more reliable).
        """
        conns = analysis.get("connections_opened", 0)
        msgs = analysis.get("messages_sent", 0)
        corrupt = analysis.get("corrupt_messages", 0)
        reconnects = analysis.get("reconnects_triggered", 0)

        score = 100.0

        # Penalise low open rate (out of attempted connections)
        attempted = analysis.get("connections_attempted", max(1, conns))
        open_rate = conns / attempted
        score -= (1.0 - open_rate) * 30

        # Penalise corrupt message ratio
        corrupt_ratio = 0.0 if msgs == 0 else min(1.0, corrupt / msgs)
        score -= corrupt_ratio * 35

        # Penalise excessive reconnects
        score -= min(25.0, reconnects / 4)

        # Penalise low message throughput
        expected_msgs = attempted * analysis.get("messages_per_connection", 0)
        if expected_msgs > 0:
            delivery_rate = msgs / expected_msgs
            score -= (1.0 - delivery_rate) * 10

        return round(max(0.0, min(100.0, score)), 1)

    def get_resync_score(self) -> float:
        """Return a 0-100 score for how reliably the WS layer resyncs after attacks.

        Uses recorded reconnect-timestamp history to measure storm intensity.
        """
        global _reconnect_timestamps
        now = time.monotonic()
        # Keep only last 60 s
        _reconnect_timestamps = [t for t in _reconnect_timestamps if now - t < 60]

        if not _reconnect_timestamps:
            return 100.0

        # Rate of reconnects per second over the window
        window = max(1.0, _reconnect_timestamps[-1] - _reconnect_timestamps[0])
        rate = len(_reconnect_timestamps) / window

        score = 100.0
        if rate > 50:
            score -= 60
        elif rate > 20:
            score -= 40
        elif rate > 10:
            score -= 20
        elif rate > 5:
            score -= 10

        return round(max(0.0, score), 1)

    def detect_reconnect_storm(self) -> bool:
        """Return True if a reconnect storm pattern is currently active.

        Storm threshold: > 30 reconnects within 5 seconds.
        """
        global _reconnect_timestamps
        now = time.monotonic()
        recent = [t for t in _reconnect_timestamps if now - t < 5.0]
        return len(recent) > 30

    def record_reconnect(self) -> None:
        """Record a single reconnect event for storm detection."""
        global _reconnect_timestamps
        _reconnect_timestamps.append(time.monotonic())
        # Cap history to avoid unbounded memory growth
        if len(_reconnect_timestamps) > 10_000:
            _reconnect_timestamps = _reconnect_timestamps[-5000:]

    def record_reconnects(self, count: int) -> None:
        """Bulk-record multiple reconnect events at the current timestamp."""
        global _reconnect_timestamps
        now = time.monotonic()
        _reconnect_timestamps.extend([now] * count)
        if len(_reconnect_timestamps) > 10_000:
            _reconnect_timestamps[:] = _reconnect_timestamps[-5000:]

    def detailed_analysis(self, analysis: dict) -> WebSocketReliabilityResult:
        """Return a full WS reliability analysis."""
        conns = analysis.get("connections_opened", 0)
        msgs = analysis.get("messages_sent", 0)
        corrupt = analysis.get("corrupt_messages", 0)
        reconnects = analysis.get("reconnects_triggered", 0)

        score = self.score(analysis)
        corrupt_ratio = 0.0 if msgs == 0 else min(1.0, corrupt / msgs)
        delivery_rate = 1.0 - corrupt_ratio

        verdict = "STABLE" if score >= 80 else "DEGRADED" if score >= 50 else "UNSTABLE"

        if reconnects > 50:
            verdict = "UNSTABLE"

        return WebSocketReliabilityResult(
            score=score,
            connections_opened=conns,
            corrupt_ratio=round(corrupt_ratio, 4),
            reconnect_storm_detected=self.detect_reconnect_storm(),
            message_delivery_rate=round(delivery_rate, 4),
            verdict=verdict,
        )
