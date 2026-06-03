from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from tester_qa.stress.models import StressResult


@dataclass
class ScaleThreshold:
    metric: str
    max_value: int
    collapse_at: int
    last_stable: int
    duration_ms: int


@dataclass
class ScaleReport:
    max_concurrent_users: ScaleThreshold | None = None
    max_websocket_count: ScaleThreshold | None = None
    memory_collapse_threshold: ScaleThreshold | None = None
    cpu_collapse_threshold: ScaleThreshold | None = None
    total_duration_ms: int = 0
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        result: dict[str, Any] = {
            "total_duration_ms": self.total_duration_ms,
            "notes": self.notes,
        }
        if self.max_concurrent_users:
            result["max_concurrent_users"] = {
                "metric": self.max_concurrent_users.metric,
                "max_value": self.max_concurrent_users.max_value,
                "collapse_at": self.max_concurrent_users.collapse_at,
                "last_stable": self.max_concurrent_users.last_stable,
            }
        if self.max_websocket_count:
            result["max_websocket_count"] = {
                "metric": self.max_websocket_count.metric,
                "max_value": self.max_websocket_count.max_value,
                "collapse_at": self.max_websocket_count.collapse_at,
                "last_stable": self.max_websocket_count.last_stable,
            }
        if self.memory_collapse_threshold:
            result["memory_collapse_threshold"] = {
                "metric": self.memory_collapse_threshold.metric,
                "max_value": self.memory_collapse_threshold.max_value,
                "collapse_at": self.memory_collapse_threshold.collapse_at,
                "last_stable": self.memory_collapse_threshold.last_stable,
            }
        if self.cpu_collapse_threshold:
            result["cpu_collapse_threshold"] = {
                "metric": self.cpu_collapse_threshold.metric,
                "max_value": self.cpu_collapse_threshold.max_value,
                "collapse_at": self.cpu_collapse_threshold.collapse_at,
                "last_stable": self.cpu_collapse_threshold.last_stable,
            }
        return result


class ScaleEngine:
    def __init__(
        self,
        start_count: int = 10,
        step_size: int = 10,
        max_count: int = 1000,
        failure_threshold: float = 0.1,
    ) -> None:
        self._start_count = max(1, start_count)
        self._step_size = max(1, step_size)
        self._max_count = max(self._start_count, max_count)
        self._failure_threshold = max(0.0, min(1.0, failure_threshold))

    async def find_max_concurrent_users(
        self,
        user_fn: Callable[[int], Coroutine[Any, Any, bool]],
    ) -> ScaleThreshold:
        started = time.monotonic()
        last_stable = 0
        collapse_at = self._max_count
        current = self._start_count

        while current <= self._max_count:
            tasks = [user_fn(i) for i in range(current)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            successes = sum(1 for r in results if r is True)
            failure_rate = 1.0 - (successes / max(1, current))

            if failure_rate >= self._failure_threshold:
                collapse_at = current
                break
            else:
                last_stable = current

            current += self._step_size

        duration_ms = int((time.monotonic() - started) * 1000)
        return ScaleThreshold(
            metric="concurrent_users",
            max_value=self._max_count,
            collapse_at=collapse_at,
            last_stable=last_stable,
            duration_ms=duration_ms,
        )

    async def find_max_websocket_count(
        self,
        connect_fn: Callable[[int], Coroutine[Any, Any, bool]],
    ) -> ScaleThreshold:
        started = time.monotonic()
        last_stable = 0
        collapse_at = self._max_count
        current = self._start_count

        while current <= self._max_count:
            tasks = [connect_fn(i) for i in range(current)]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            successes = sum(1 for r in results if r is True)
            failure_rate = 1.0 - (successes / max(1, current))

            if failure_rate >= self._failure_threshold:
                collapse_at = current
                break
            else:
                last_stable = current

            current += self._step_size

        duration_ms = int((time.monotonic() - started) * 1000)
        return ScaleThreshold(
            metric="websocket_connections",
            max_value=self._max_count,
            collapse_at=collapse_at,
            last_stable=last_stable,
            duration_ms=duration_ms,
        )

    async def find_memory_collapse_threshold(
        self,
        allocate_fn: Callable[[int], Coroutine[Any, Any, float]],
        collapse_percent: float = 95.0,
    ) -> ScaleThreshold:
        started = time.monotonic()
        last_stable = 0
        collapse_at = self._max_count
        current = self._start_count

        while current <= self._max_count:
            try:
                memory_percent = await allocate_fn(current)
                if memory_percent >= collapse_percent:
                    collapse_at = current
                    break
                else:
                    last_stable = current
            except Exception:
                collapse_at = current
                break

            current += self._step_size

        duration_ms = int((time.monotonic() - started) * 1000)
        return ScaleThreshold(
            metric="memory_percent",
            max_value=self._max_count,
            collapse_at=collapse_at,
            last_stable=last_stable,
            duration_ms=duration_ms,
        )

    async def find_cpu_collapse_threshold(
        self,
        load_fn: Callable[[int], Coroutine[Any, Any, float]],
        collapse_percent: float = 95.0,
    ) -> ScaleThreshold:
        started = time.monotonic()
        last_stable = 0
        collapse_at = self._max_count
        current = self._start_count

        while current <= self._max_count:
            try:
                cpu_percent = await load_fn(current)
                if cpu_percent >= collapse_percent:
                    collapse_at = current
                    break
                else:
                    last_stable = current
            except Exception:
                collapse_at = current
                break

            current += self._step_size

        duration_ms = int((time.monotonic() - started) * 1000)
        return ScaleThreshold(
            metric="cpu_percent",
            max_value=self._max_count,
            collapse_at=collapse_at,
            last_stable=last_stable,
            duration_ms=duration_ms,
        )

    async def generate_scale_report(
        self,
        user_fn: Callable[[int], Coroutine[Any, Any, bool]] | None = None,
        connect_fn: Callable[[int], Coroutine[Any, Any, bool]] | None = None,
        allocate_fn: Callable[[int], Coroutine[Any, Any, float]] | None = None,
        load_fn: Callable[[int], Coroutine[Any, Any, float]] | None = None,
    ) -> ScaleReport:
        started = time.monotonic()
        report = ScaleReport()

        if user_fn is not None:
            report.max_concurrent_users = await self.find_max_concurrent_users(user_fn)
            report.notes.append(
                f"Max concurrent users: stable at {report.max_concurrent_users.last_stable}, "
                f"collapse at {report.max_concurrent_users.collapse_at}"
            )

        if connect_fn is not None:
            report.max_websocket_count = await self.find_max_websocket_count(connect_fn)
            report.notes.append(
                f"Max websockets: stable at {report.max_websocket_count.last_stable}, "
                f"collapse at {report.max_websocket_count.collapse_at}"
            )

        if allocate_fn is not None:
            report.memory_collapse_threshold = await self.find_memory_collapse_threshold(allocate_fn)
            report.notes.append(
                f"Memory collapse: stable at {report.memory_collapse_threshold.last_stable}, "
                f"collapse at {report.memory_collapse_threshold.collapse_at}"
            )

        if load_fn is not None:
            report.cpu_collapse_threshold = await self.find_cpu_collapse_threshold(load_fn)
            report.notes.append(
                f"CPU collapse: stable at {report.cpu_collapse_threshold.last_stable}, "
                f"collapse at {report.cpu_collapse_threshold.collapse_at}"
            )

        report.total_duration_ms = int((time.monotonic() - started) * 1000)
        return report
