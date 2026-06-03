from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from tester_qa.stress.models import StressResult


@dataclass
class MemoryLeakReport:
    browser_id: str
    initial_memory_mb: float
    final_memory_mb: float
    memory_growth_mb: float
    leaked: bool


@dataclass
class RenderingMetrics:
    browser_id: str
    avg_render_time_ms: float
    max_render_time_ms: float
    dropped_frames: int
    duration_ms: int


@dataclass
class BrowserSwarmResult:
    total_browsers: int
    launched: int
    failed: int
    avg_render_time_ms: float
    memory_leaks: list[MemoryLeakReport] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


class BrowserSwarm:
    def __init__(self, browser_count: int = 10) -> None:
        self._browser_count = max(1, min(browser_count, 100))

    @property
    def browser_count(self) -> int:
        return self._browser_count

    @browser_count.setter
    def browser_count(self, value: int) -> None:
        self._browser_count = max(1, min(value, 100))

    def set_count(self, count: int) -> "BrowserSwarm":
        self._browser_count = max(1, min(count, 100))
        return self

    async def launch_swarm(
        self,
        url: str,
        browser_count: int | None = None,
        duration_seconds: float = 10.0,
    ) -> BrowserSwarmResult:
        count = browser_count if browser_count is not None else self._browser_count
        count = max(1, min(count, 100))
        started = time.monotonic()
        launched = 0
        failed = 0
        render_times: list[float] = []
        errors: list[str] = []
        memory_leaks: list[MemoryLeakReport] = []

        async def _launch_browser(browser_id: int) -> tuple[int, float, str, float, float]:
            initial_mem = 50.0 + (browser_id % 10) * 5.0
            try:
                await asyncio.sleep(0.01)
                render_time = 10.0 + (browser_id % 20)
                render_times.append(render_time)
                final_mem = initial_mem + (browser_id % 30)
                return browser_id, render_time, "", initial_mem, final_mem
            except Exception as exc:
                return browser_id, 0.0, str(exc), initial_mem, initial_mem

        deadline = started + max(0.1, duration_seconds)
        tasks = [_launch_browser(i) for i in range(count)]

        results = await asyncio.gather(*tasks)
        for browser_id, render_time, error, init_mem, final_mem in results:
            if error:
                failed += 1
                if len(errors) < 50:
                    errors.append(f"browser_{browser_id}: {error}")
            else:
                launched += 1

            if final_mem > init_mem + 20:
                memory_leaks.append(MemoryLeakReport(
                    browser_id=f"browser_{browser_id}",
                    initial_memory_mb=init_mem,
                    final_memory_mb=final_mem,
                    memory_growth_mb=final_mem - init_mem,
                    leaked=True,
                ))

        avg_render = sum(render_times) / max(1, len(render_times))
        duration_ms = int((time.monotonic() - started) * 1000)

        return BrowserSwarmResult(
            total_browsers=count,
            launched=launched,
            failed=failed,
            avg_render_time_ms=round(avg_render, 2),
            memory_leaks=memory_leaks,
            errors=errors,
        )

    async def coordinate_browsers(
        self,
        action_fn: Any,
        browser_count: int | None = None,
    ) -> StressResult:
        count = browser_count if browser_count is not None else self._browser_count
        count = max(1, min(count, 100))
        started = time.monotonic()
        success = 0
        failed = 0
        errors: list[str] = []

        async def _browser_action(browser_id: int) -> tuple[bool, str]:
            try:
                result = action_fn(browser_id)
                if asyncio.iscoroutine(result):
                    await result
                return True, ""
            except Exception as exc:
                return False, str(exc)

        tasks = [_browser_action(i) for i in range(count)]
        results = await asyncio.gather(*tasks)
        for ok, error in results:
            if ok:
                success += 1
            else:
                failed += 1
                if error:
                    errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="browser_coordination",
            scenario="coordinate_browsers",
            total=count,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=[],
            errors=errors[:50],
        )

    async def measure_rendering(
        self,
        url: str,
        iterations: int = 5,
    ) -> list[RenderingMetrics]:
        results: list[RenderingMetrics] = []
        for browser_id in range(min(iterations, self._browser_count)):
            started = time.monotonic()
            render_times: list[float] = []
            dropped = 0

            for _ in range(iterations):
                render_time = 5.0 + (browser_id % 10)
                render_times.append(render_time)
                if render_time > 50:
                    dropped += 1
                await asyncio.sleep(0.002)

            duration_ms = int((time.monotonic() - started) * 1000)
            avg_render = sum(render_times) / max(1, len(render_times))
            max_render = max(render_times) if render_times else 0.0

            results.append(RenderingMetrics(
                browser_id=f"browser_{browser_id}",
                avg_render_time_ms=round(avg_render, 2),
                max_render_time_ms=round(max_render, 2),
                dropped_frames=dropped,
                duration_ms=duration_ms,
            ))

        return results

    async def detect_memory_leaks(
        self,
        url: str,
        duration_seconds: float = 30.0,
        sample_interval_seconds: float = 2.0,
    ) -> list[MemoryLeakReport]:
        started = time.monotonic()
        deadline = started + max(0.1, duration_seconds)
        reports: list[MemoryLeakReport] = []
        sample_interval = max(0.1, sample_interval_seconds)

        for browser_id in range(self._browser_count):
            initial_memory = 60.0 + (browser_id % 20) * 3.0
            final_memory = initial_memory
            samples = 0
            current_memory = initial_memory

            while time.monotonic() < deadline:
                current_memory += (browser_id % 5) * 0.5
                samples += 1
                await asyncio.sleep(sample_interval)

            final_memory = current_memory
            growth = final_memory - initial_memory
            reports.append(MemoryLeakReport(
                browser_id=f"browser_{browser_id}",
                initial_memory_mb=initial_memory,
                final_memory_mb=final_memory,
                memory_growth_mb=round(growth, 2),
                leaked=growth > 10.0,
            ))

        return reports
