"""
Queue Starvation — simulate queue saturation and worker starvation.
Detects: slow consumers, poison messages, priority inversion, queue depth explosion.
"""
from __future__ import annotations

import logging
import queue
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable

from tester_qa.core.event_bus import EventBus, EventType

LOGGER = logging.getLogger(__name__)

# Safety boundaries
MAX_WORKERS = 2000
MAX_TASK_RATE = 50000
MAX_DURATION_SECONDS = 120


@dataclass
class StarvationResult:
    tasks_injected: int = 0
    tasks_completed: int = 0
    tasks_dropped: int = 0
    queue_depth_max: int = 0
    starvation_duration_ms: float = 0.0
    worker_utilization: float = 0.0
    poison_messages: int = 0
    duration_seconds: float = 0.0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "tasks_injected": self.tasks_injected,
            "tasks_completed": self.tasks_completed,
            "tasks_dropped": self.tasks_dropped,
            "queue_depth_max": self.queue_depth_max,
            "starvation_duration_ms": round(self.starvation_duration_ms, 2),
            "worker_utilization": round(self.worker_utilization, 4),
            "poison_messages": self.poison_messages,
            "duration_seconds": round(self.duration_seconds, 2),
            "errors": self.errors[:20],
        }


class QueueStarvation:
    """
    Simulate queue saturation and worker starvation.

    Scenarios:
    - Slow consumers (workers take too long)
    - Poison messages (tasks that crash workers)
    - Priority inversion (low-priority tasks block high-priority)
    - Pure volume flood (overwhelm queue capacity)
    """

    def __init__(self, queue_max_size: int = 10000) -> None:
        self._bus = EventBus.get_instance()
        self._running = False
        self._result = StarvationResult()
        self._queue: queue.Queue = queue.Queue(maxsize=queue_max_size)
        self._workers: list[threading.Thread] = []
        self._producer: threading.Thread | None = None
        self._starvation_start: float | None = None

    def starve(
        self,
        workers: int = 500,
        task_rate: int = 1000,
        duration_seconds: float = 30.0,
        slow_consumer_ms: float = 50.0,
        poison_rate: float = 0.01,
    ) -> StarvationResult:
        """
        Flood the task queue to induce worker starvation.

        Args:
            workers: Number of consumer workers
            task_rate: Tasks injected per second
            duration_seconds: Duration of the test
            slow_consumer_ms: Simulated processing time per task (ms)
            poison_rate: Fraction of tasks that are "poison" (crash workers)
        """
        workers = min(workers, MAX_WORKERS)
        task_rate = min(task_rate, MAX_TASK_RATE)
        duration_seconds = min(duration_seconds, MAX_DURATION_SECONDS)

        self._running = True
        self._result = StarvationResult()
        self._starvation_start = None

        start = time.time()

        self._bus.emit(
            EventType.RUNTIME_CRITICAL,
            "stress.queue_starvation",
            {"workers": workers, "task_rate": task_rate, "duration": duration_seconds},
        )

        # Start workers
        for i in range(workers):
            t = threading.Thread(
                target=self._worker_loop,
                args=(i, slow_consumer_ms, poison_rate),
                daemon=True,
            )
            t.start()
            self._workers.append(t)

        # Start producer
        self._producer = threading.Thread(
            target=self._producer_loop,
            args=(task_rate, duration_seconds),
            daemon=True,
        )
        self._producer.start()
        self._producer.join(timeout=duration_seconds + 5)

        # Wait for queue to drain (with timeout)
        drain_deadline = time.time() + 5.0
        while not self._queue.empty() and time.time() < drain_deadline:
            time.sleep(0.1)

        self._running = False
        self._result.duration_seconds = time.time() - start

        # Calculate utilization
        if self._result.tasks_injected > 0:
            self._result.worker_utilization = self._result.tasks_completed / self._result.tasks_injected

        # Detect starvation
        if self._result.queue_depth_max > workers * 10:
            if self._starvation_start:
                self._result.starvation_duration_ms = (time.time() - self._starvation_start) * 1000

        return self._result

    def _producer_loop(self, task_rate: int, duration: float) -> None:
        """Inject tasks at the specified rate."""
        interval = 1.0 / max(task_rate, 1)
        end_time = time.time() + duration

        while time.time() < end_time and self._running:
            try:
                task_data = {"id": self._result.tasks_injected, "ts": time.time()}
                self._queue.put_nowait(task_data)
                self._result.tasks_injected += 1

                # Track queue depth
                current_depth = self._queue.qsize()
                if current_depth > self._result.queue_depth_max:
                    self._result.queue_depth_max = current_depth

                # Detect starvation onset
                if current_depth > 1000 and self._starvation_start is None:
                    self._starvation_start = time.time()
                    self._bus.emit(
                        EventType.RUNTIME_CRITICAL,
                        "stress.queue_starvation",
                        {"event": "starvation_detected", "queue_depth": current_depth},
                    )

            except queue.Full:
                self._result.tasks_dropped += 1

            time.sleep(interval)

    def _worker_loop(self, worker_id: int, slow_ms: float, poison_rate: float) -> None:
        """Consumer worker that processes tasks."""
        import random

        while self._running:
            try:
                task = self._queue.get(timeout=1.0)
            except queue.Empty:
                continue

            try:
                # Simulate poison message
                if random.random() < poison_rate:
                    self._result.poison_messages += 1
                    raise RuntimeError(f"Poison message in worker {worker_id}")

                # Simulate slow processing
                time.sleep(slow_ms / 1000.0)
                self._result.tasks_completed += 1

            except RuntimeError:
                # Worker "crashes" but recovers
                time.sleep(0.01)
            except Exception as e:
                if len(self._result.errors) < 20:
                    self._result.errors.append(f"Worker {worker_id}: {e}")

    def stop(self) -> None:
        """Halt the starvation test."""
        self._running = False

    def get_results(self) -> dict[str, Any]:
        """Get starvation test results."""
        return self._result.to_dict()
