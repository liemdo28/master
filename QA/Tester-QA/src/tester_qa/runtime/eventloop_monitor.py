from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class EventLoopStats:
    total_iterations: int = 0
    blocking_calls_detected: int = 0
    average_latency_ms: float = 0.0
    max_latency_ms: float = 0.0
    is_monitoring: bool = False


class EventLoopMonitor:
    """Monitors the asyncio event loop for blocking calls and latency issues."""

    def __init__(self, blocking_threshold_ms: float = 100.0) -> None:
        self._blocking_threshold_ms = blocking_threshold_ms
        self._is_monitoring = False
        self._latencies: list[float] = []
        self._blocking_calls: list[dict[str, object]] = []
        self._start_time: Optional[float] = None
        self._iteration_count: int = 0

    async def start_monitoring(self, loop: Optional[asyncio.AbstractEventLoop] = None) -> None:
        """Start monitoring the event loop for blocking and latency."""
        self._is_monitoring = True
        self._start_time = time.monotonic()
        self._latencies = []
        self._blocking_calls = []
        self._iteration_count = 0

        if loop is None:
            loop = asyncio.get_running_loop()

        while self._is_monitoring:
            iteration_start = time.monotonic()
            await asyncio.sleep(0)
            iteration_end = time.monotonic()

            latency_ms = (iteration_end - iteration_start) * 1000.0
            self._latencies.append(latency_ms)
            self._iteration_count += 1

            if latency_ms > self._blocking_threshold_ms:
                self._blocking_calls.append({
                    "timestamp": iteration_end,
                    "latency_ms": latency_ms,
                    "iteration": self._iteration_count,
                })

            await asyncio.sleep(0.01)

    def stop_monitoring(self) -> None:
        """Stop the monitoring loop."""
        self._is_monitoring = False

    def detect_blocking(self) -> list[dict[str, object]]:
        """Return detected blocking calls that exceeded the threshold."""
        return list(self._blocking_calls)

    def measure_latency(self) -> dict[str, float]:
        """Measure current event loop latency statistics."""
        if not self._latencies:
            return {"average_ms": 0.0, "max_ms": 0.0, "min_ms": 0.0, "p95_ms": 0.0}

        sorted_latencies = sorted(self._latencies)
        p95_index = int(len(sorted_latencies) * 0.95)

        return {
            "average_ms": sum(self._latencies) / len(self._latencies),
            "max_ms": max(self._latencies),
            "min_ms": min(self._latencies),
            "p95_ms": sorted_latencies[min(p95_index, len(sorted_latencies) - 1)],
        }

    def get_stats(self) -> EventLoopStats:
        """Get comprehensive event loop monitoring statistics."""
        latency_info = self.measure_latency()
        return EventLoopStats(
            total_iterations=self._iteration_count,
            blocking_calls_detected=len(self._blocking_calls),
            average_latency_ms=latency_info["average_ms"],
            max_latency_ms=latency_info["max_ms"],
            is_monitoring=self._is_monitoring,
        )
