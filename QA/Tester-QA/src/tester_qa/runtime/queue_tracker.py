from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class QueueStats:
    queue_id: str
    current_depth: int
    max_depth: int
    average_depth: float
    is_starved: bool
    starvation_duration_sec: float = 0.0
    throughput_per_sec: float = 0.0


@dataclass
class StarvationEvent:
    queue_id: str
    started_at: float
    duration_sec: float
    depth_at_detection: int


class QueueTracker:
    """Tracks async queue depths and detects starvation conditions."""

    def __init__(self, starvation_threshold_sec: float = 5.0) -> None:
        self._starvation_threshold_sec = starvation_threshold_sec
        self._queues: dict[str, asyncio.Queue[object]] = {}
        self._depth_history: dict[str, list[tuple[float, int]]] = {}
        self._starvation_events: dict[str, list[StarvationEvent]] = {}
        self._last_consumed: dict[str, float] = {}
        self._is_tracking = False

    async def track_queue(self, queue_id: str, queue: asyncio.Queue[object]) -> None:
        """Start tracking a specific queue for depth and starvation."""
        self._queues[queue_id] = queue
        self._depth_history[queue_id] = []
        self._starvation_events[queue_id] = []
        self._last_consumed[queue_id] = time.monotonic()
        self._is_tracking = True

        while self._is_tracking:
            now = time.monotonic()
            depth = queue.qsize()
            self._depth_history[queue_id].append((now, depth))

            if depth > 0:
                time_since_consumed = now - self._last_consumed[queue_id]
                if time_since_consumed > self._starvation_threshold_sec:
                    event = StarvationEvent(
                        queue_id=queue_id,
                        started_at=self._last_consumed[queue_id],
                        duration_sec=time_since_consumed,
                        depth_at_detection=depth,
                    )
                    self._starvation_events[queue_id].append(event)
            else:
                self._last_consumed[queue_id] = now

            await asyncio.sleep(0.1)

    def stop_tracking(self) -> None:
        """Stop tracking all queues."""
        self._is_tracking = False

    def notify_consumed(self, queue_id: str) -> None:
        """Notify the tracker that an item was consumed from the queue."""
        self._last_consumed[queue_id] = time.monotonic()

    def detect_starvation(self, queue_id: Optional[str] = None) -> list[StarvationEvent]:
        """Detect queues experiencing consumer starvation."""
        if queue_id is not None:
            return list(self._starvation_events.get(queue_id, []))

        all_events: list[StarvationEvent] = []
        for events in self._starvation_events.values():
            all_events.extend(events)
        return all_events

    def measure_depth(self, queue_id: str) -> dict[str, float]:
        """Measure current and historical depth for a queue."""
        history = self._depth_history.get(queue_id, [])
        if not history:
            return {"current": 0, "average": 0.0, "max": 0, "min": 0}

        depths = [d for _, d in history]
        current = depths[-1] if depths else 0

        return {
            "current": float(current),
            "average": sum(depths) / len(depths),
            "max": float(max(depths)),
            "min": float(min(depths)),
        }

    def get_stats(self, queue_id: Optional[str] = None) -> list[QueueStats]:
        """Get comprehensive stats for tracked queues."""
        queue_ids = [queue_id] if queue_id else list(self._queues.keys())
        results: list[QueueStats] = []

        for qid in queue_ids:
            if qid not in self._queues:
                continue

            depth_info = self.measure_depth(qid)
            history = self._depth_history.get(qid, [])
            starvation_events = self._starvation_events.get(qid, [])

            is_starved = False
            starvation_duration = 0.0
            if starvation_events:
                latest = starvation_events[-1]
                now = time.monotonic()
                if now - (latest.started_at + latest.duration_sec) < self._starvation_threshold_sec:
                    is_starved = True
                    starvation_duration = latest.duration_sec

            throughput = 0.0
            if len(history) >= 2:
                time_span = history[-1][0] - history[0][0]
                if time_span > 0:
                    depth_decreases = sum(
                        1 for i in range(1, len(history))
                        if history[i][1] < history[i - 1][1]
                    )
                    throughput = depth_decreases / time_span

            results.append(QueueStats(
                queue_id=qid,
                current_depth=int(depth_info["current"]),
                max_depth=int(depth_info["max"]),
                average_depth=depth_info["average"],
                is_starved=is_starved,
                starvation_duration_sec=starvation_duration,
                throughput_per_sec=throughput,
            ))

        return results
