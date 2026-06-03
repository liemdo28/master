from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from tester_qa.stress.models import StressResult


@dataclass
class UserSimulationResult:
    total_users: int
    total_actions: int
    successful_actions: int
    failed_actions: int
    duration_ms: int
    errors: list[str] = field(default_factory=list)


class UserSimulator:
    async def simulate_navigation(
        self,
        navigation_fn: Callable[[str], Coroutine[Any, Any, Any]],
        urls: list[str],
        users: int = 10,
        iterations_per_user: int = 5,
    ) -> StressResult:
        started = time.monotonic()
        total = max(0, users) * max(0, iterations_per_user)
        success = 0
        failed = 0
        latencies: list[int] = []
        errors: list[str] = []

        async def _navigate(user_id: int) -> tuple[int, int, str]:
            task_start = time.monotonic()
            url = urls[user_id % max(1, len(urls))]
            try:
                result = navigation_fn(url)
                if asyncio.iscoroutine(result):
                    await result
                latency = int((time.monotonic() - task_start) * 1000)
                return 1, latency, ""
            except Exception as exc:
                latency = int((time.monotonic() - task_start) * 1000)
                return 0, latency, str(exc)

        tasks: list[Coroutine[Any, Any, tuple[int, int, str]]] = []
        for user_id in range(users):
            for _ in range(iterations_per_user):
                tasks.append(_navigate(user_id))

        results = await asyncio.gather(*tasks)
        for ok, latency, error in results:
            latencies.append(latency)
            if ok:
                success += 1
            else:
                failed += 1
                if error and len(errors) < 50:
                    errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="user_navigation",
            scenario="simulate_navigation",
            total=total,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=latencies,
            errors=errors,
        )

    async def rapid_clicking(
        self,
        click_fn: Callable[[str], Coroutine[Any, Any, Any]],
        element_selector: str,
        clicks_per_user: int = 20,
        users: int = 10,
    ) -> StressResult:
        started = time.monotonic()
        total = max(0, users) * max(0, clicks_per_user)
        success = 0
        failed = 0
        latencies: list[int] = []
        errors: list[str] = []

        async def _click_batch(user_id: int) -> None:
            nonlocal success, failed
            for _ in range(max(0, clicks_per_user)):
                task_start = time.monotonic()
                try:
                    result = click_fn(element_selector)
                    if asyncio.iscoroutine(result):
                        await result
                    latencies.append(int((time.monotonic() - task_start) * 1000))
                    success += 1
                except Exception as exc:
                    latencies.append(int((time.monotonic() - task_start) * 1000))
                    failed += 1
                    if len(errors) < 50:
                        errors.append(str(exc))

        tasks = [_click_batch(i) for i in range(max(0, users))]
        await asyncio.gather(*tasks)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="rapid_clicking",
            scenario="rapid_clicking",
            total=total,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=latencies,
            errors=errors,
        )

    async def duplicate_actions(
        self,
        action_fn: Callable[[], Coroutine[Any, Any, Any]],
        action_count: int = 100,
        duplicate_factor: int = 3,
    ) -> StressResult:
        started = time.monotonic()
        total = max(0, action_count) * max(1, duplicate_factor)
        success = 0
        failed = 0
        errors: list[str] = []

        async def _action() -> tuple[bool, str]:
            try:
                result = action_fn()
                if asyncio.iscoroutine(result):
                    await result
                return True, ""
            except Exception as exc:
                return False, str(exc)

        tasks: list[Coroutine[Any, Any, tuple[bool, str]]] = []
        for _ in range(max(0, action_count)):
            for _ in range(max(1, duplicate_factor)):
                tasks.append(_action())

        results = await asyncio.gather(*tasks)
        for ok, error in results:
            if ok:
                success += 1
            else:
                failed += 1
                if error and len(errors) < 50:
                    errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="duplicate_actions",
            scenario="duplicate_actions",
            total=total,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=[],
            errors=errors,
        )

    async def refresh_storm(
        self,
        refresh_fn: Callable[[str], Coroutine[Any, Any, Any]],
        url: str,
        refresh_count: int = 100,
        concurrency: int = 20,
    ) -> StressResult:
        started = time.monotonic()
        total = max(0, refresh_count)
        semaphore = asyncio.Semaphore(max(1, concurrency))
        success = 0
        failed = 0
        latencies: list[int] = []
        errors: list[str] = []

        async def _refresh(idx: int) -> tuple[int, int, str]:
            task_start = time.monotonic()
            async with semaphore:
                try:
                    result = refresh_fn(url)
                    if asyncio.iscoroutine(result):
                        await result
                    latency = int((time.monotonic() - task_start) * 1000)
                    return 1, latency, ""
                except Exception as exc:
                    latency = int((time.monotonic() - task_start) * 1000)
                    return 0, latency, str(exc)

        tasks = [_refresh(i) for i in range(total)]
        results = await asyncio.gather(*tasks)
        for ok, latency, error in results:
            latencies.append(latency)
            if ok:
                success += 1
            else:
                failed += 1
                if error and len(errors) < 50:
                    errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="refresh_storm",
            scenario="refresh_storm",
            total=total,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=latencies,
            errors=errors,
        )

    async def login_flood(
        self,
        login_fn: Callable[[str, str], Coroutine[Any, Any, Any]],
        username: str,
        password: str,
        attempts: int = 100,
        concurrency: int = 50,
    ) -> StressResult:
        started = time.monotonic()
        total = max(0, attempts)
        semaphore = asyncio.Semaphore(max(1, concurrency))
        success = 0
        failed = 0
        latencies: list[int] = []
        errors: list[str] = []

        async def _login(idx: int) -> tuple[int, int, str]:
            task_start = time.monotonic()
            async with semaphore:
                try:
                    result = login_fn(username, password)
                    if asyncio.iscoroutine(result):
                        await result
                    latency = int((time.monotonic() - task_start) * 1000)
                    return 1, latency, ""
                except Exception as exc:
                    latency = int((time.monotonic() - task_start) * 1000)
                    return 0, latency, str(exc)

        tasks = [_login(i) for i in range(total)]
        results = await asyncio.gather(*tasks)
        for ok, latency, error in results:
            latencies.append(latency)
            if ok:
                success += 1
            else:
                failed += 1
                if error and len(errors) < 50:
                    errors.append(error)

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="login_flood",
            scenario="login_flood",
            total=total,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=latencies,
            errors=errors,
        )
