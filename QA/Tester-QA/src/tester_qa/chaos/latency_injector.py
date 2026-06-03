"""
Latency Injection Engine
Injects artificial delays, jitter, and latency spikes into network paths.
"""
import asyncio
import random
import time
from typing import Callable, Optional
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
import statistics


class LatencyPattern(Enum):
    CONSTANT = "constant"
    RANDOM = "random"
    SPIKE = "spike"
    GRADUAL = "gradual"
    BURST = "burst"
    SPIKELEY = "spikeley"  # random spikes


@dataclass
class LatencyConfig:
    base_ms: int = 100
    jitter_ms: int = 50
    pattern: LatencyPattern = LatencyPattern.RANDOM
    spike_probability: float = 0.05
    spike_multiplier: float = 10.0
    gradual_increase: float = 1.0  # multiplier per request
    burst_count: int = 5
    burst_spacing_ms: int = 200


@dataclass
class LatencyEvent:
    timestamp: float
    target: str
    latency_ms: float
    pattern: LatencyPattern
    details: dict = field(default_factory=dict)


class LatencyInjector:
    """
    Injects artificial latency into operations.
    Can wrap async functions or act as a middleware.
    """

    def __init__(self):
        self.active_injections: dict[str, LatencyConfig] = {}
        self.latency_log: list[LatencyEvent] = []
        self._request_count: dict[str, int] = {}
        self._spike_tracker: dict[str, list[float]] = {}

    def configure_latency(self, target: str, config: LatencyConfig):
        """Configure latency injection for a target."""
        self.active_injections[target] = config
        self._request_count[target] = 0
        self._spike_tracker[target] = []

    def clear_latency(self, target: str):
        self.active_injections.pop(target, None)

    def clear_all(self):
        self.active_injections.clear()

    async def inject(self, target: str, coro: Callable):
        """Wrap an async coroutine with latency injection."""
        if target not in self.active_injections:
            return await coro()

        config = self.active_injections[target]
        self._request_count[target] = self._request_count.get(target, 0) + 1

        latency_ms = self._calculate_latency(target, config)

        start = time.time()
        self.latency_log.append(LatencyEvent(
            timestamp=start,
            target=target,
            latency_ms=latency_ms,
            pattern=config.pattern,
            details={"request_num": self._request_count[target]}
        ))

        if latency_ms > 0:
            await asyncio.sleep(latency_ms / 1000)

        return await coro()

    def _calculate_latency(self, target: str, config: LatencyConfig) -> float:
        """Calculate latency based on pattern."""
        base = config.base_ms
        jitter = config.jitter_ms
        req_num = self._request_count.get(target, 0)

        if config.pattern == LatencyPattern.CONSTANT:
            return float(base)

        elif config.pattern == LatencyPattern.RANDOM:
            return base + random.uniform(-jitter, jitter)

        elif config.pattern == LatencyPattern.SPIKE:
            if random.random() < config.spike_probability:
                return base * config.spike_multiplier
            return base + random.uniform(-jitter, jitter)

        elif config.pattern == LatencyPattern.GRADUAL:
            multiplier = 1.0 + (req_num * config.gradual_increase / 100)
            return (base + random.uniform(-jitter, jitter)) * multiplier

        elif config.pattern == LatencyPattern.BURST:
            burst_pos = req_num % config.burst_count
            if burst_pos == 0:
                return base * 2  # First in burst is slower
            return base + random.uniform(-jitter, jitter)

        elif config.pattern == LatencyPattern.SPIKELEY:
            rand_val = random.uniform(-jitter, jitter)
            if random.random() < config.spike_probability:
                return base + (config.spike_multiplier * jitter) + rand_val
            return base + rand_val

        return float(base)

    def inject_decorator(self, target: str):
        """Decorator for latency injection."""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                return await self.inject(target, lambda: func(*args, **kwargs))
            return wrapper
        return decorator

    def get_latency_stats(self, target: Optional[str] = None) -> dict:
        """Get latency statistics."""
        logs = self.latency_log
        if target:
            logs = [e for e in logs if e.target == target]

        if not logs:
            return {"error": "no latency data"}

        latencies = [e.latency_ms for e in logs]

        return {
            "total_requests": len(logs),
            "avg_latency_ms": statistics.mean(latencies),
            "median_latency_ms": statistics.median(latencies),
            "min_latency_ms": min(latencies),
            "max_latency_ms": max(latencies),
            "p95_latency_ms": sorted(latencies)[int(len(latencies) * 0.95)] if len(latencies) > 20 else max(latencies),
            "p99_latency_ms": sorted(latencies)[int(len(latencies) * 0.99)] if len(latencies) > 100 else max(latencies),
            "stddev": statistics.stdev(latencies) if len(latencies) > 1 else 0,
            "pattern_distribution": self._pattern_counts(logs),
        }

    def _pattern_counts(self, logs: list[LatencyEvent]) -> dict:
        counts = {}
        for e in logs:
            counts[e.pattern.value] = counts.get(e.pattern.value, 0) + 1
        return counts

    def export_latency_log(self) -> list[dict]:
        """Export latency log for forensics."""
        return [
            {
                "timestamp": e.timestamp,
                "target": e.target,
                "latency_ms": e.latency_ms,
                "pattern": e.pattern.value,
                "details": e.details,
            }
            for e in self.latency_log
        ]


# Global singleton
_latency_injector: Optional[LatencyInjector] = None


def get_latency_injector() -> LatencyInjector:
    global _latency_injector
    if _latency_injector is None:
        _latency_injector = LatencyInjector()
    return _latency_injector
