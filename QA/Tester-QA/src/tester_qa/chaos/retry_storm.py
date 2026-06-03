"""
Retry Storm Engine
Simulates retry storms, exponential backoff failures, and thundering herd problems.
"""
import asyncio
import random
import time
from typing import Callable, Optional, Any
from dataclasses import dataclass, field
from enum import Enum
from collections import deque


class RetryPattern(Enum):
    EXPONENTIAL = "exponential"
    LINEAR = "linear"
    IMMEDIATE = "immediate"
    FIBONACCI = "fibonacci"
    JITTERED = "jittered"
    THUNDER_HERD = "thunder_herd"


@dataclass
class RetryStormConfig:
    max_retries: int = 10
    base_delay_ms: int = 100
    max_delay_ms: int = 30000
    pattern: RetryPattern = RetryPattern.EXPONENTIAL
    jitter_factor: float = 0.3
    backoff_multiplier: float = 2.0
    simulate_failure: bool = True  # fail retries intentionally
    thunder_herd_probability: float = 0.8  # probability of synchronized retries


@dataclass
class RetryEvent:
    timestamp: float
    target: str
    attempt: int
    delay_ms: float
    success: bool
    error: Optional[str] = None
    details: dict = field(default_factory=dict)


class RetryStormEngine:
    """
    Simulates retry storms and thundering herd problems.
    """

    def __init__(self):
        self.active_retries: dict[str, RetryStormConfig] = {}
        self.retry_log: list[RetryEvent] = []
        self._retry_count: dict[str, int] = {}
        self._backoff_state: dict[str, float] = {}
        self._synchronized_retries: dict[str, list] = {}
        self._fib_cache: dict[int, float] = {0: 1, 1: 1}

    def configure_retry(self, target: str, config: RetryStormConfig):
        self.active_retries[target] = config
        self._retry_count[target] = 0
        self._backoff_state[target] = config.base_delay_ms
        self._synchronized_retries[target] = []

    def clear_retry(self, target: str):
        self.active_retries.pop(target, None)

    def clear_all(self):
        self.active_retries.clear()

    def _fibonacci(self, n: int) -> float:
        """Calculate fibonacci number for backoff."""
        if n in self._fib_cache:
            return self._fib_cache[n]
        result = self._fibonacci(n - 1) + self._fibonacci(n - 2)
        self._fib_cache[n] = result
        return result

    def _calculate_delay(self, attempt: int, config: RetryStormConfig) -> float:
        """Calculate delay for this retry attempt."""
        pattern = config.pattern

        if pattern == RetryPattern.EXPONENTIAL:
            delay = config.base_delay_ms * (config.backoff_multiplier ** attempt)
            return min(delay, config.max_delay_ms)

        elif pattern == RetryPattern.LINEAR:
            return min(config.base_delay_ms * (attempt + 1), config.max_delay_ms)

        elif pattern == RetryPattern.IMMEDIATE:
            return 0

        elif pattern == RetryPattern.FIBONACCI:
            return min(self._fibonacci(attempt) * config.base_delay_ms, config.max_delay_ms)

        elif pattern == RetryPattern.JITTERED:
            base = config.base_delay_ms * (config.backoff_multiplier ** attempt)
            jitter = base * config.jitter_factor
            return min(base + random.uniform(-jitter, jitter), config.max_delay_ms)

        elif pattern == RetryPattern.THUNDER_HERD:
            # All retries happen at the same time
            return config.base_delay_ms

        return config.base_delay_ms

    async def execute_with_retry(
        self,
        target: str,
        coro_func: Callable,
        *args,
        **kwargs
    ) -> Any:
        """Execute a coroutine with retry logic."""
        if target not in self.active_retries:
            return await coro_func(*args, **kwargs)

        config = self.active_retries[target]
        self._retry_count[target] = self._retry_count.get(target, 0) + 1
        attempt = 0
        last_error = None

        while attempt < config.max_retries:
            try:
                result = await coro_func(*args, **kwargs)
                self.retry_log.append(RetryEvent(
                    timestamp=time.time(),
                    target=target,
                    attempt=attempt,
                    delay_ms=0,
                    success=True,
                    details={"retry_count": self._retry_count[target]}
                ))
                return result

            except Exception as e:
                last_error = str(e)
                attempt += 1

                # Simulate retry failure
                if config.simulate_failure and attempt < config.max_retries:
                    delay_ms = self._calculate_delay(attempt, config)

                    # Add thundering herd behavior
                    retry_pattern = config.pattern
                    if retry_pattern == RetryPattern.THUNDER_HERD or (
                        retry_pattern == RetryPattern.EXPONENTIAL and
                        random.random() < config.thunder_herd_probability
                    ):
                        # Spawn synchronized retry for all waiting requests
                        await self._trigger_thunder_herd(target, config)

                    self.retry_log.append(RetryEvent(
                        timestamp=time.time(),
                        target=target,
                        attempt=attempt,
                        delay_ms=delay_ms,
                        success=False,
                        error=last_error,
                        details={"max_retries": config.max_retries}
                    ))

                    if delay_ms > 0:
                        await asyncio.sleep(delay_ms / 1000)
                else:
                    break

        # All retries exhausted
        self.retry_log.append(RetryEvent(
            timestamp=time.time(),
            target=target,
            attempt=attempt,
            delay_ms=0,
            success=False,
            error=last_error,
            details={"exhausted": True}
        ))
        raise Exception(f"Retry storm: all {config.max_retries} retries exhausted. Last error: {last_error}")

    async def _trigger_thunder_herd(self, target: str, config: RetryStormConfig):
        """Trigger a thundering herd - all requests retry simultaneously."""
        pattern = config.pattern
        self._synchronized_retries[target].append({
            "timestamp": time.time(),
            "pattern": pattern.value,
        })

        # In a real scenario, this would wake up all waiting requests
        # For simulation, we log the herd event

    async def simulate_retry_storm(
        self,
        target: str,
        request_func: Callable,
        concurrent_requests: int = 100
    ):
        """Simulate a retry storm with many concurrent requests all failing."""
        if target not in self.active_retries:
            return

        config = self.active_retries[target]

        async def failing_request(req_id: int):
            """A request that always fails, triggering retries."""
            try:
                await self.execute_with_retry(
                    target,
                    lambda: (_ for _ in ()).throw(Exception(f"Request {req_id} failed")),
                )
            except Exception:
                pass  # Expected to fail

        # Launch all requests simultaneously
        tasks = [failing_request(i) for i in range(concurrent_requests)]
        await asyncio.gather(*tasks, return_exceptions=True)

    def get_retry_stats(self, target: Optional[str] = None) -> dict:
        """Get retry statistics."""
        logs = self.retry_log
        if target:
            logs = [e for e in logs if e.target == target]

        successful = [e for e in logs if e.success]
        failed = [e for e in logs if not e.success]

        attempts_by_target = {}
        for e in logs:
            if e.target not in attempts_by_target:
                attempts_by_target[e.target] = {"total": 0, "max": 0}
            attempts_by_target[e.target]["total"] += 1
            attempts_by_target[e.target]["max"] = max(attempts_by_target[e.target]["max"], e.attempt)

        return {
            "total_retry_attempts": len(logs),
            "successful_retries": len(successful),
            "failed_retries": len(failed),
            "retry_success_rate": len(successful) / max(len(logs), 1),
            "thundering_herd_events": sum(
                len(events) for events in self._synchronized_retries.values()
            ),
            "attempts_by_target": attempts_by_target,
        }

    def export_retry_log(self) -> list[dict]:
        """Export retry log for forensics."""
        return [
            {
                "timestamp": e.timestamp,
                "target": e.target,
                "attempt": e.attempt,
                "delay_ms": e.delay_ms,
                "success": e.success,
                "error": e.error,
                "details": e.details,
            }
            for e in self.retry_log
        ]


# Global singleton
_retry_storm_engine: Optional[RetryStormEngine] = None


def get_retry_storm_engine() -> RetryStormEngine:
    global _retry_storm_engine
    if _retry_storm_engine is None:
        _retry_storm_engine = RetryStormEngine()
    return _retry_storm_engine
