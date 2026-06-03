from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WebSocketConnection:
    connection_id: str
    opened_at: float
    last_message_at: float
    messages_sent: int = 0
    messages_received: int = 0
    latency_ms: float = 0.0
    is_alive: bool = True


@dataclass
class ZombieConnection:
    connection_id: str
    idle_duration_sec: float
    last_activity_at: float
    opened_at: float


class WebSocketTracker:
    """Tracks WebSocket connections, detects zombies, and measures latency."""

    def __init__(self, zombie_threshold_sec: float = 30.0) -> None:
        self._zombie_threshold_sec = zombie_threshold_sec
        self._connections: dict[str, WebSocketConnection] = {}
        self._latency_samples: dict[str, list[float]] = {}
        self._ping_timestamps: dict[str, float] = {}

    def track_connections(
        self,
        connection_id: str,
        event: str = "open",
        latency_ms: Optional[float] = None,
    ) -> None:
        """Track a WebSocket connection event (open, message, close, pong)."""
        now = time.monotonic()

        if event == "open":
            self._connections[connection_id] = WebSocketConnection(
                connection_id=connection_id,
                opened_at=now,
                last_message_at=now,
            )
            self._latency_samples[connection_id] = []

        elif event == "message":
            conn = self._connections.get(connection_id)
            if conn is not None:
                conn.last_message_at = now
                conn.messages_received += 1

        elif event == "send":
            conn = self._connections.get(connection_id)
            if conn is not None:
                conn.last_message_at = now
                conn.messages_sent += 1

        elif event == "ping":
            self._ping_timestamps[connection_id] = now

        elif event == "pong":
            ping_time = self._ping_timestamps.pop(connection_id, None)
            if ping_time is not None:
                measured_latency = (now - ping_time) * 1000.0
                conn = self._connections.get(connection_id)
                if conn is not None:
                    conn.latency_ms = measured_latency
                    conn.last_message_at = now
                self._latency_samples.setdefault(connection_id, []).append(measured_latency)

        elif event == "close":
            conn = self._connections.get(connection_id)
            if conn is not None:
                conn.is_alive = False

        if latency_ms is not None and connection_id in self._connections:
            self._connections[connection_id].latency_ms = latency_ms
            self._latency_samples.setdefault(connection_id, []).append(latency_ms)

    def detect_zombies(self) -> list[ZombieConnection]:
        """Detect zombie connections that have been idle beyond the threshold."""
        now = time.monotonic()
        zombies: list[ZombieConnection] = []

        for conn_id, conn in self._connections.items():
            if not conn.is_alive:
                continue

            idle_duration = now - conn.last_message_at
            if idle_duration > self._zombie_threshold_sec:
                zombies.append(ZombieConnection(
                    connection_id=conn_id,
                    idle_duration_sec=idle_duration,
                    last_activity_at=conn.last_message_at,
                    opened_at=conn.opened_at,
                ))

        return zombies

    def measure_latency(self, connection_id: Optional[str] = None) -> dict[str, dict[str, float]]:
        """Measure latency statistics for tracked connections."""
        results: dict[str, dict[str, float]] = {}

        target_ids = [connection_id] if connection_id else list(self._latency_samples.keys())

        for conn_id in target_ids:
            samples = self._latency_samples.get(conn_id, [])
            if not samples:
                results[conn_id] = {"average_ms": 0.0, "max_ms": 0.0, "min_ms": 0.0, "p95_ms": 0.0}
                continue

            sorted_samples = sorted(samples)
            p95_index = int(len(sorted_samples) * 0.95)

            results[conn_id] = {
                "average_ms": sum(samples) / len(samples),
                "max_ms": max(samples),
                "min_ms": min(samples),
                "p95_ms": sorted_samples[min(p95_index, len(sorted_samples) - 1)],
            }

        return results

    def get_active_connections(self) -> list[WebSocketConnection]:
        """Return all currently active connections."""
        return [conn for conn in self._connections.values() if conn.is_alive]

    def get_connection_count(self) -> dict[str, int]:
        """Return counts of active and total connections."""
        active = sum(1 for conn in self._connections.values() if conn.is_alive)
        return {
            "active": active,
            "total": len(self._connections),
            "closed": len(self._connections) - active,
        }
