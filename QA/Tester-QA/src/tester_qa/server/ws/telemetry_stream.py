"""Telemetry Stream — streams CPU, memory, WebSocket count, queue depth, provider latency events."""
from __future__ import annotations

import asyncio
import logging
import threading
import time
from typing import Any

try:
    import psutil
    _HAS_PSUTIL = True
except ImportError:
    psutil = None  # type: ignore[assignment]
    _HAS_PSUTIL = False

from tester_qa.core.event_bus import EventBus, EventType
from .event_broadcaster import EventBroadcaster

LOGGER = logging.getLogger(__name__)

# ── Polling interval ───────────────────────────────────────────────────────────
DEFAULT_INTERVAL = 5.0  # seconds


class TelemetryStream:
    """
    Monitors system/runtime metrics and emits change events via the EventBus.

    Tracked metrics:
    - CPU usage (percent)
    - Memory usage (percent + RSS MB)
    - WebSocket client count
    - Event bus queue depth (history length)
    - Per-provider latency (if available)

    Only emits an event when a metric crosses a threshold or changes meaningfully.
    """

    def __init__(
        self,
        interval: float = DEFAULT_INTERVAL,
        broadcaster: EventBroadcaster | None = None,
        cpu_threshold: float = 80.0,
        memory_threshold: float = 85.0,
    ) -> None:
        self._interval = interval
        self._cpu_threshold = cpu_threshold
        self._memory_threshold = memory_threshold
        self._bus = EventBus.get_instance()
        self._broadcaster = broadcaster or EventBroadcaster.get_instance()
        self._running = False
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()

        # Snapshot of last emitted values — used to detect changes
        self._last: dict[str, Any] = {
            "cpu_percent": 0.0,
            "memory_percent": 0.0,
            "memory_rss_mb": 0.0,
            "ws_clients": 0,
            "bus_history_len": 0,
            "provider_latencies": {},
        }

    # ── Metric collection ──────────────────────────────────────────────────────

    def _collect_cpu(self) -> float:
        """Return current CPU usage percent (0-100)."""
        if _HAS_PSUTIL:
            return psutil.cpu_percent(interval=None)
        return 0.0

    def _collect_memory(self) -> tuple[float, float]:
        """Return (memory_percent, memory_rss_mb)."""
        if _HAS_PSUTIL:
            mem = psutil.virtual_memory()
            return float(mem.percent), float(mem.rss / (1024 * 1024))
        return 0.0, 0.0

    def _collect_ws_clients(self) -> int:
        """Return current WebSocket client count."""
        return self._broadcaster.client_count()

    def _collect_bus_depth(self) -> int:
        """Return current event bus history length."""
        return len(self._bus._history)

    def _collect_all(self) -> dict[str, Any]:
        """Collect all metrics at once."""
        cpu = self._collect_cpu()
        mem_pct, mem_mb = self._collect_memory()
        return {
            "cpu_percent": round(cpu, 1),
            "memory_percent": round(mem_pct, 1),
            "memory_rss_mb": round(mem_mb, 1),
            "ws_clients": self._collect_ws_clients(),
            "bus_history_len": self._collect_bus_depth(),
            "timestamp": time.time(),
        }

    # ── Change detection ───────────────────────────────────────────────────────

    def _significant_change(self, current: dict[str, Any]) -> bool:
        """Return True if any metric has changed enough to warrant an event."""
        last = self._last
        thresholds = [
            abs(current["cpu_percent"] - last["cpu_percent"]) >= 5.0,
            abs(current["memory_percent"] - last["memory_percent"]) >= 2.0,
            current["ws_clients"] != last["ws_clients"],
            current["bus_history_len"] != last["bus_history_len"],
            current["cpu_percent"] >= self._cpu_threshold,
            current["memory_percent"] >= self._memory_threshold,
        ]
        return any(thresholds)

    def _build_payload(self, metrics: dict[str, Any]) -> dict[str, Any]:
        """Build the data payload broadcast over WebSocket."""
        return {
            "cpu_percent": metrics["cpu_percent"],
            "memory_percent": metrics["memory_percent"],
            "memory_rss_mb": metrics["memory_rss_mb"],
            "ws_clients": metrics["ws_clients"],
            "bus_queue_depth": metrics["bus_history_len"],
            "timestamp": metrics["timestamp"],
        }

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def _poll_loop(self) -> None:
        """Background polling loop — runs in a dedicated thread."""
        LOGGER.info("[Telemetry] Stream polling started (interval=%.1fs)", self._interval)
        while not self._stop_event.wait(self._interval):
            try:
                current = self._collect_all()
                if self._significant_change(current):
                    payload = self._build_payload(current)
                    self._last = current.copy()

                    # Emit via EventBus so other components can react
                    self._bus.emit(
                        EventType.METRICS_UPDATE,
                        source="telemetry_stream",
                        data=payload,
                    )

                    # Push directly to WebSocket clients
                    self._broadcaster.broadcast(
                        EventType.METRICS_UPDATE,
                        source="telemetry_stream",
                        data=payload,
                    )
            except Exception as exc:
                LOGGER.warning("[Telemetry] Polling error: %s", exc)

        LOGGER.info("[Telemetry] Stream polling stopped")

    def start(self) -> None:
        """Start the telemetry polling thread."""
        if self._running:
            return
        self._stop_event.clear()
        self._running = True
        self._thread = threading.Thread(target=self._poll_loop, daemon=True, name="telemetry-stream")
        self._thread.start()

    def stop(self) -> None:
        """Stop the telemetry polling thread."""
        if not self._running:
            return
        self._running = False
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5.0)
            self._thread = None

    def get_current_metrics(self) -> dict[str, Any]:
        """Return the latest collected metrics snapshot."""
        return self._last.copy()

    def get_stats(self) -> dict[str, Any]:
        """Return stream statistics."""
        return {
            "running": self._running,
            "interval": self._interval,
            "cpu_threshold": self._cpu_threshold,
            "memory_threshold": self._memory_threshold,
            "psutil_available": _HAS_PSUTIL,
        }
