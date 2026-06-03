"""
Provider Failure Simulation Engine
Simulates API failures, rate limits, malformed payloads, stream interruptions, and auth errors.
"""
import asyncio
import random
import time
from typing import Any, Callable, Optional
from dataclasses import dataclass, field
from enum import Enum
from functools import wraps
import json


class FailureMode(Enum):
    TIMEOUT = "timeout"
    RATE_LIMIT = "rate_limit"
    MALFORMED_PAYLOAD = "malformed_payload"
    PARTIAL_STREAM = "partial_stream"
    SLOW_STREAM = "slow_stream"
    DISCONNECTED_STREAM = "disconnected_stream"
    INVALID_JSON = "invalid_json"
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    AUTH_FAILURE = "auth_failure"
    SERVER_ERROR = "server_error"
    EMPTY_RESPONSE = "empty_response"
    CORRUPTED_DATA = "corrupted_data"


@dataclass
class FailureConfig:
    mode: FailureMode
    probability: float = 1.0  # 0.0-1.0 chance this failure triggers
    delay_ms: int = 0  # artificial delay before failure
    duration_ms: int = 5000  # how long failure lasts
    response_code: int = 429
    response_body: Optional[str] = None
    stream_chunk_size: int = 10  # for partial stream
    auth_header_override: Optional[str] = None  # corrupt auth header


@dataclass
class FailureEvent:
    timestamp: float
    mode: FailureMode
    target: str
    duration_ms: int
    details: dict = field(default_factory=dict)


class ProviderFailureSimulator:
    """
    Simulates provider-side failures to test resilience.
    Can wrap async functions or act as a proxy.
    """

    def __init__(self):
        self.active_failures: dict[str, FailureConfig] = {}
        self.failure_log: list[FailureEvent] = []
        self._failure_count = 0

    def configure_failure(self, target: str, config: FailureConfig):
        """Register a failure scenario for a target endpoint."""
        self.active_failures[target] = config

    def clear_failure(self, target: str):
        """Remove failure scenario for target."""
        self.active_failures.pop(target, None)

    def clear_all(self):
        """Clear all failure scenarios."""
        self.active_failures.clear()

    async def inject_async(
        self,
        target: str,
        coro,
        config: FailureConfig
    ) -> Any:
        """
        Wrap an async coroutine with failure injection.
        Returns either the failure response or passes through to the actual coroutine.
        """
        self._failure_count += 1

        if random.random() > config.probability:
            return await coro()

        if config.delay_ms > 0:
            await asyncio.sleep(config.delay_ms / 1000)

        self.failure_log.append(FailureEvent(
            timestamp=time.time(),
            mode=config.mode,
            target=target,
            duration_ms=config.duration_ms,
            details={
                "failure_id": self._failure_count,
                "probability": config.probability,
                "response_code": config.response_code,
            }
        ))

        return self._build_failure_response(config)

    def _build_failure_response(self, config: FailureConfig) -> Any:
        """Build the appropriate failure response based on mode."""
        mode = config.mode
        if mode == FailureMode.TIMEOUT:
            raise asyncio.TimeoutError(f"Simulated timeout after {config.duration_ms}ms")
        elif mode == FailureMode.RATE_LIMIT:
            return {
                "error": "rate_limit_exceeded",
                "status": 429,
                "retry_after": random.randint(1, 60),
                "message": "Too many requests"
            }
        elif mode == FailureMode.MALFORMED_PAYLOAD:
            return {"malformed": True, "data": "<<<<INVALID>>>>"}
        elif mode == FailureMode.PARTIAL_STREAM:
            return {"stream": "partial", "data": "chunk-" * config.stream_chunk_size}
        elif mode == FailureMode.SLOW_STREAM:
            return {"stream": "slow", "delay_ms": config.duration_ms}
        elif mode == FailureMode.DISCONNECTED_STREAM:
            raise ConnectionError("Simulated stream disconnection")
        elif mode == FailureMode.INVALID_JSON:
            return "<<<<NOT_JSON<<<<>>>>"
        elif mode == FailureMode.PROVIDER_UNAVAILABLE:
            return {"error": "provider_unavailable", "status": 503}
        elif mode == FailureMode.AUTH_FAILURE:
            return {"error": "unauthorized", "status": 401}
        elif mode == FailureMode.SERVER_ERROR:
            return {"error": "internal_server_error", "status": 500}
        elif mode == FailureMode.EMPTY_RESPONSE:
            return None
        elif mode == FailureMode.CORRUPTED_DATA:
            return {"data": bytes([random.randint(0, 255) for _ in range(50)]).hex()}
        else:
            return {"error": "unknown_failure", "status": 500}

    async def stream_failure(
        self,
        config: FailureConfig,
        data_generator: Callable,
    ) -> Any:
        """
        Wrap a streaming response with failure injection.
        Simulates partial streams, slow streams, disconnections.
        """
        if config.delay_ms > 0:
            await asyncio.sleep(config.delay_ms / 1000)

        self.failure_log.append(FailureEvent(
            timestamp=time.time(),
            mode=config.mode,
            target="stream",
            duration_ms=config.duration_ms,
            details={"stream_failure": True}
        ))

        mode = config.mode
        if mode == FailureMode.PARTIAL_STREAM:
            # Yield partial chunks then fail
            chunks_yielded = 0
            async for chunk in data_generator():
                if chunks_yielded < config.stream_chunk_size:
                    yield chunk
                    chunks_yielded += 1
                else:
                    raise ConnectionError("Simulated stream cutoff")
        elif mode == FailureMode.SLOW_STREAM:
            async for chunk in data_generator():
                await asyncio.sleep(config.duration_ms / 1000)
                yield chunk
        elif mode == FailureMode.DISCONNECTED_STREAM:
            yield "data: connected\n\n"
            await asyncio.sleep(0.1)
            raise ConnectionError("Simulated abrupt disconnection")
        else:
            async for chunk in data_generator():
                yield chunk

    def inject_decorator(self, target: str):
        """Decorator to inject failures into async functions."""
        def decorator(func):
            @wraps(func)
            async def wrapper(*args, **kwargs):
                if target not in self.active_failures:
                    return await func(*args, **kwargs)
                config = self.active_failures[target]
                return await self.inject_async(target, lambda: func(*args, **kwargs), config)
            return wrapper
        return decorator

    def get_failure_stats(self) -> dict:
        """Return statistics about simulated failures."""
        return {
            "total_failures_injected": self._failure_count,
            "active_failure_count": len(self.active_failures),
            "failure_log_size": len(self.failure_log),
            "recent_failures": [
                {
                    "mode": e.mode.value,
                    "target": e.target,
                    "timestamp": e.timestamp,
                }
                for e in self.failure_log[-10:]
            ],
        }

    def export_failure_log(self) -> list[dict]:
        """Export the full failure log for forensics."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "target": e.target,
                "duration_ms": e.duration_ms,
                "details": e.details,
            }
            for e in self.failure_log
        ]


# Global singleton
_provider_failure_simulator: Optional[ProviderFailureSimulator] = None


def get_provider_failure_simulator() -> ProviderFailureSimulator:
    global _provider_failure_simulator
    if _provider_failure_simulator is None:
        _provider_failure_simulator = ProviderFailureSimulator()
    return _provider_failure_simulator
