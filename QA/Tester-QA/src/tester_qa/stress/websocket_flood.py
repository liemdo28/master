"""
WebSocket Flood — massive concurrent WebSocket connection stress test.
Detects: reconnect amplification, message loss, server backpressure.
"""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from tester_qa.core.event_bus import EventBus, EventType

LOGGER = logging.getLogger(__name__)

# Safety boundaries
MAX_CONNECTIONS = 5000
MAX_DURATION_SECONDS = 120
MAX_MESSAGES_PER_SEC = 10000


@dataclass
class FloodResult:
    connections_opened: int = 0
    connections_failed: int = 0
    messages_sent: int = 0
    messages_received: int = 0
    messages_lost: int = 0
    avg_latency_ms: float = 0.0
    reconnect_storms: int = 0
    duration_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "connections_opened": self.connections_opened,
            "connections_failed": self.connections_failed,
            "messages_sent": self.messages_sent,
            "messages_received": self.messages_received,
            "messages_lost": self.messages_lost,
            "avg_latency_ms": round(self.avg_latency_ms, 2),
            "reconnect_storms": self.reconnect_storms,
            "duration_seconds": round(self.duration_seconds, 2),
            "errors": self.errors[:20],
        }


class WebSocketFlood:
    """
    Flood a WebSocket endpoint with massive concurrent connections.

    Detects:
    - Reconnect amplification
    - Message loss
    - Server backpressure
    - Connection ceiling
    """

    def __init__(self) -> None:
        self._bus = EventBus.get_instance()
        self._running = False
        self._result = FloodResult()
        self._thread: threading.Thread | None = None
        self._latencies: list[float] = []

    def flood(
        self,
        url: str,
        connections: int = 1000,
        messages_per_sec: int = 100,
        duration_seconds: float = 30.0,
    ) -> FloodResult:
        """
        Open N connections and send messages at the specified rate.

        Args:
            url: WebSocket URL (ws:// or wss://)
            connections: Number of concurrent connections
            messages_per_sec: Messages per second across all connections
            duration_seconds: How long to sustain the flood
        """
        connections = min(connections, MAX_CONNECTIONS)
        messages_per_sec = min(messages_per_sec, MAX_MESSAGES_PER_SEC)
        duration_seconds = min(duration_seconds, MAX_DURATION_SECONDS)

        self._running = True
        self._result = FloodResult()
        self._latencies = []

        start = time.time()
        self._bus.emit(
            EventType.WEBSOCKET_FLOOD,
            "stress.websocket_flood",
            {"url": url, "connections": connections, "messages_per_sec": messages_per_sec},
        )

        try:
            asyncio.run(self._run_flood(url, connections, messages_per_sec, duration_seconds))
        except Exception as e:
            self._result.errors.append(f"Flood error: {e}")
            LOGGER.error(f"[WebSocketFlood] Error: {e}")

        self._result.duration_seconds = time.time() - start
        self._result.messages_lost = max(0, self._result.messages_sent - self._result.messages_received)

        if self._latencies:
            self._result.avg_latency_ms = sum(self._latencies) / len(self._latencies)

        # Detect reconnect storms
        if self._result.connections_failed > connections * 0.3:
            self._result.reconnect_storms += 1
            self._bus.emit(
                EventType.WEBSOCKET_DESYNC,
                "stress.websocket_flood",
                {"reconnect_storm": True, "failed": self._result.connections_failed},
            )

        self._running = False
        return self._result

    async def _run_flood(
        self, url: str, connections: int, messages_per_sec: int, duration_seconds: float
    ) -> None:
        """Run the async flood loop."""
        try:
            import websockets
        except ImportError:
            self._result.errors.append("websockets library not installed")
            return

        semaphore = asyncio.Semaphore(min(connections, 200))  # limit concurrent opens
        tasks = []

        for i in range(connections):
            if not self._running:
                break
            task = asyncio.create_task(
                self._connect_and_send(url, i, messages_per_sec // max(connections, 1), duration_seconds, semaphore)
            )
            tasks.append(task)

        await asyncio.gather(*tasks, return_exceptions=True)

    async def _connect_and_send(
        self,
        url: str,
        client_id: int,
        msgs_per_sec: int,
        duration: float,
        semaphore: asyncio.Semaphore,
    ) -> None:
        """Single client: connect, send messages, measure latency."""
        try:
            import websockets
        except ImportError:
            return

        async with semaphore:
            try:
                async with websockets.connect(url, open_timeout=10, close_timeout=5) as ws:
                    self._result.connections_opened += 1
                    end_time = time.time() + duration
                    interval = 1.0 / max(msgs_per_sec, 1)

                    while time.time() < end_time and self._running:
                        try:
                            send_time = time.time()
                            payload = json.dumps({"client": client_id, "ts": send_time})
                            await asyncio.wait_for(ws.send(payload), timeout=5.0)
                            self._result.messages_sent += 1

                            # Try to receive echo/response
                            try:
                                resp = await asyncio.wait_for(ws.recv(), timeout=2.0)
                                self._result.messages_received += 1
                                latency = (time.time() - send_time) * 1000
                                self._latencies.append(latency)
                            except asyncio.TimeoutError:
                                pass

                            await asyncio.sleep(interval)
                        except Exception:
                            break

            except Exception as e:
                self._result.connections_failed += 1
                if len(self._result.errors) < 20:
                    self._result.errors.append(f"Client {client_id}: {type(e).__name__}: {e}")

    def stop(self) -> None:
        """Terminate the flood."""
        self._running = False

    def get_results(self) -> dict[str, Any]:
        """Get flood results."""
        return self._result.to_dict()
