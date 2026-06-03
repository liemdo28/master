from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from tester_qa.stress.models import StressResult


@dataclass
class DeadlockReport:
    detected: bool
    blocked_tasks: list[str] = field(default_factory=list)
    duration_ms: int = 0


@dataclass
class ThroughputResult:
    operations_per_second: float
    total_operations: int
    duration_ms: int
    errors: list[str] = field(default_factory=list)


class ConcurrencyStress:
    def __init__(self, concurrent_tasks: int = 10) -> None:
        self._concurrent_tasks = max(1, concurrent_tasks)

    @property
    def concurrent_tasks(self) -> int:
        return self._concurrent_tasks

    @concurrent_tasks.setter
    def concurrent_tasks(self, value: int) -> None:
        self._concurrent_tasks = max(1, value)

    async def run_concurrent_tasks(
        self,
        task_fn: Callable[[], Coroutine[Any, Any, Any]],
        total_tasks: int | None = None,
    ) -> StressResult:
        count = total_tasks if total_tasks is not None else self._concurrent_tasks
        count = max(0, count)
        started = time.monotonic()
        semaphore = asyncio.Semaphore(self._concurrent_tasks)
        latencies: list[int] = []
        errors: list[str] = []
        success = 0

        async def _run_one() -> tuple[bool, int, str]:
            async with semaphore:
                task_start = time.monotonic()
                try:
                    await task_fn()
                    latency = int((time.monotonic() - task_start) * 1000)
                    return True, latency, ""
                except Exception as exc:
                    latency = int((time.monotonic() - task_start) * 1000)
                    return False, latency, str(exc)

        results = await asyncio.gather(*[_run_one() for _ in range(count)])
        for ok, latency, error in results:
            latencies.append(latency)
            if ok:
                success += 1
            elif error:
                errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="concurrent_tasks",
            scenario="concurrency_stress",
            total=count,
            success=success,
            failed=count - success,
            duration_ms=duration_ms,
            latencies_ms=latencies,
            errors=errors[:50],
        )

    async def test_race_conditions(
        self,
        shared_resource_fn: Callable[[], Coroutine[Any, Any, Any]],
        iterations: int = 100,
    ) -> StressResult:
        started = time.monotonic()
        errors: list[str] = []
        success = 0

        async def _race_task() -> tuple[bool, str]:
            try:
                await shared_resource_fn()
                return True, ""
            except Exception as exc:
                return False, str(exc)

        tasks = [_race_task() for _ in range(max(0, iterations))]
        results = await asyncio.gather(*tasks)
        for ok, error in results:
            if ok:
                success += 1
            elif error:
                errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="race_condition_test",
            scenario="race_conditions",
            total=iterations,
            success=success,
            failed=iterations - success,
            duration_ms=duration_ms,
            latencies_ms=[],
            errors=errors[:50],
        )

    async def measure_throughput(
        self,
        task_fn: Callable[[], Coroutine[Any, Any, Any]],
        duration_seconds: float = 5.0,
    ) -> ThroughputResult:
        started = time.monotonic()
        deadline = started + max(0.1, duration_seconds)
        semaphore = asyncio.Semaphore(self._concurrent_tasks)
        total_ops = 0
        errors: list[str] = []

        async def _worker() -> None:
            nonlocal total_ops
            while time.monotonic() < deadline:
                async with semaphore:
                    try:
                        await task_fn()
                        total_ops += 1
                    except Exception as exc:
                        errors.append(str(exc))
                        total_ops += 1

        workers = [_worker() for _ in range(self._concurrent_tasks)]
        await asyncio.gather(*workers)

        elapsed_ms = int((time.monotonic() - started) * 1000)
        ops_per_sec = total_ops / max(0.001, elapsed_ms / 1000.0)
        return ThroughputResult(
            operations_per_second=ops_per_sec,
            total_operations=total_ops,
            duration_ms=elapsed_ms,
            errors=errors[:50],
        )

    async def find_deadlocks(
        self,
        task_fn: Callable[[], Coroutine[Any, Any, Any]],
        timeout_seconds: float = 10.0,
    ) -> DeadlockReport:
        started = time.monotonic()
        blocked_tasks: list[str] = []

        async def _monitored_task(index: int) -> None:
            try:
                await asyncio.wait_for(task_fn(), timeout=timeout_seconds)
            except asyncio.TimeoutError:
                blocked_tasks.append(f"task_{index}")

        tasks = [_monitored_task(i) for i in range(self._concurrent_tasks)]
        await asyncio.gather(*tasks)

        duration_ms = int((time.monotonic() - started) * 1000)
        return DeadlockReport(
            detected=len(blocked_tasks) > 0,
            blocked_tasks=blocked_tasks,
            duration_ms=duration_ms,
        )
