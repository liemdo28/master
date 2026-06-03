"""
Provider Blackout Simulation
Simulates total provider infrastructure collapse - all providers going down simultaneously.
"""
from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class BlackoutMode(Enum):
    TOTAL_OUTAGE = "total_outage"
    PARTIAL_BLACKOUT = "partial_blackout"
    CORRUPTED_RESPONSE = "corrupted_response"
    TIMEOUT_STORM = "timeout_storm"
    AUTH_CATASTROPHE = "auth_catastrophe"
    RATE_LIMIT_IMPOSSIBLE = "rate_limit_impossible"
    MALFORMED_CATASTROPHE = "malformed_catastrophe"


@dataclass
class ProviderStatus:
    provider_id: str
    alive: bool = True
    latency_ms: int = 0
    error_rate: float = 0.0
    last_heartbeat: float = field(default_factory=time.time)
    failure_reason: Optional[str] = None


@dataclass
class BlackoutEvent:
    timestamp: float
    provider_id: str
    mode: BlackoutMode
    affected_endpoints: list[str]
    duration_ms: int
    details: dict = field(default_factory=dict)


class ProviderBlackout:
    """
    Simulates all AI providers going down in various failure modes.
    Tests system resilience against total infrastructure collapse.
    """

    def __init__(self) -> None:
        self._providers: dict[str, ProviderStatus] = {}
        self._blackout_events: list[BlackoutEvent] = []
        self._active_blackout: bool = False
        self._total_requests_failed: int = 0
        self._corruption_seed: int = 42

    def register_provider(self, provider_id: str, endpoints: list[str]) -> None:
        """Register a provider and its endpoints."""
        self._providers[provider_id] = ProviderStatus(
            provider_id=provider_id,
            alive=True,
            latency_ms=0,
            error_rate=0.0,
            last_heartbeat=time.time(),
        )

    def get_provider_status(self, provider_id: str) -> Optional[ProviderStatus]:
        """Get current status of a provider."""
        return self._providers.get(provider_id)

    def get_all_status(self) -> dict[str, dict[str, Any]]:
        """Get status of all registered providers."""
        return {
            pid: {
                "alive": status.alive,
                "latency_ms": status.latency_ms,
                "error_rate": status.error_rate,
                "last_heartbeat": status.last_heartbeat,
                "failure_reason": status.failure_reason,
            }
            for pid, status in self._providers.items()
        }

    async def trigger_total_blackout(
        self,
        mode: BlackoutMode = BlackoutMode.TOTAL_OUTAGE,
        duration_ms: int = 30000,
        gradual: bool = False,
    ) -> dict[str, Any]:
        """
        Trigger all providers to go down simultaneously.
        
        Args:
            mode: The type of blackout to simulate
            duration_ms: How long the blackout lasts
            gradual: If True, providers fail one by one rather than all at once
            
        Returns:
            Summary of blackout execution
        """
        self._active_blackout = True
        start_time = time.time()
        provider_ids = list(self._providers.keys())

        if not provider_ids:
            provider_ids = ["openai", "anthropic", "google", "azure", "cohere"]

        results: dict[str, Any] = {
            "mode": mode.value,
            "providers_affected": [],
            "total_failures": 0,
            "duration_ms": 0,
            "cascade_started": start_time,
        }

        async def blackout_provider(provider_id: str, delay: float = 0.0) -> None:
            if delay > 0:
                await asyncio.sleep(delay)
            status = self._providers.get(provider_id)
            if status:
                status.alive = False
                status.error_rate = 1.0
                status.failure_reason = f"Blackout mode: {mode.value}"

            event = BlackoutEvent(
                timestamp=time.time(),
                provider_id=provider_id,
                mode=mode,
                affected_endpoints=[],
                duration_ms=duration_ms,
                details={"gradual": gradual, "delay": delay},
            )
            self._blackout_events.append(event)
            results["providers_affected"].append(provider_id)
            results["total_failures"] += 1

        if gradual:
            tasks = [
                blackout_provider(pid, delay * 0.5)
                for delay, pid in enumerate(provider_ids)
            ]
        else:
            tasks = [blackout_provider(pid) for pid in provider_ids]

        await asyncio.gather(*tasks, return_exceptions=True)

        blackout_duration = int((time.time() - start_time) * 1000)
        results["duration_ms"] = blackout_duration
        results["cascade_completed"] = time.time()

        return results

    async def corrupt_responses(
        self,
        provider_id: str,
        corruption_rate: float = 0.8,
        duration_ms: int = 20000,
    ) -> dict[str, Any]:
        """
        Corrupt all responses from a provider with garbage or malformed data.
        
        Args:
            provider_id: Target provider to corrupt
            corruption_rate: Percentage of responses to corrupt (0.0-1.0)
            duration_ms: How long corruption lasts
            
        Returns:
            Corruption operation results
        """
        status = self._providers.get(provider_id)
        if not status:
            status = ProviderStatus(provider_id=provider_id)
            self._providers[provider_id] = status

        start_time = time.time()
        corrupted_count = 0
        total_requests = 0

        async def corruption_loop() -> None:
            nonlocal corrupted_count, total_requests
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                total_requests += 1
                if random.random() < corruption_rate:
                    corrupted_count += 1
                    self._total_requests_failed += 1
                await asyncio.sleep(0.01)

        await corruption_loop()

        event = BlackoutEvent(
            timestamp=start_time,
            provider_id=provider_id,
            mode=BlackoutMode.CORRUPTED_RESPONSE,
            affected_endpoints=[],
            duration_ms=duration_ms,
            details={
                "corruption_rate": corruption_rate,
                "corrupted_count": corrupted_count,
                "total_requests": total_requests,
            },
        )
        self._blackout_events.append(event)

        return {
            "provider_id": provider_id,
            "corruption_rate": corruption_rate,
            "corrupted_count": corrupted_count,
            "total_requests": total_requests,
            "duration_ms": duration_ms,
        }

    async def fake_success(
        self,
        provider_id: str,
        duration_ms: int = 15000,
        silent_failure: bool = True,
    ) -> dict[str, Any]:
        """
        Simulate providers returning success codes while actually failing.
        Tests systems that rely on HTTP status codes without validating response content.
        
        Args:
            provider_id: Target provider
            duration_ms: How long to fake success
            silent_failure: If True, return 200 with garbage; if False, return mixed results
            
        Returns:
            Fake success operation results
        """
        status = self._providers.get(provider_id)
        if not status:
            status = ProviderStatus(provider_id=provider_id)
            self._providers[provider_id] = status

        start_time = time.time()
        fake_successes = 0
        fake_responses_returned = 0

        async def fake_success_loop() -> None:
            nonlocal fake_successes, fake_responses_returned
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                fake_responses_returned += 1
                if silent_failure or random.random() < 0.7:
                    fake_successes += 1
                await asyncio.sleep(0.05)

        await fake_success_loop()

        event = BlackoutEvent(
            timestamp=start_time,
            provider_id=provider_id,
            mode=BlackoutMode.CORRUPTED_RESPONSE,
            affected_endpoints=[],
            duration_ms=duration_ms,
            details={
                "silent_failure": silent_failure,
                "fake_successes": fake_successes,
                "fake_responses_returned": fake_responses_returned,
            },
        )
        self._blackout_events.append(event)

        return {
            "provider_id": provider_id,
            "silent_failure": silent_failure,
            "fake_successes": fake_successes,
            "fake_responses_returned": fake_responses_returned,
            "duration_ms": duration_ms,
        }

    async def delay_stream(
        self,
        provider_id: str,
        delay_ms: int = 30000,
        jitter_ms: int = 5000,
        duration_ms: int = 20000,
    ) -> dict[str, Any]:
        """
        Inject massive delays into streaming responses.
        
        Args:
            provider_id: Target provider
            delay_ms: Base delay to inject
            jitter_ms: Random jitter around base delay
            duration_ms: How long to inject delays
            
        Returns:
            Delay injection results
        """
        status = self._providers.get(provider_id)
        if not status:
            status = ProviderStatus(provider_id=provider_id)
            self._providers[provider_id] = status

        start_time = time.time()
        delays_injected = 0

        async def delay_loop() -> None:
            nonlocal delays_injected
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                actual_delay = delay_ms + random.randint(-jitter_ms, jitter_ms)
                await asyncio.sleep(actual_delay / 1000)
                delays_injected += 1
                status.latency_ms = actual_delay

        await delay_loop()

        event = BlackoutEvent(
            timestamp=start_time,
            provider_id=provider_id,
            mode=BlackoutMode.TIMEOUT_STORM,
            affected_endpoints=[],
            duration_ms=duration_ms,
            details={
                "delay_ms": delay_ms,
                "jitter_ms": jitter_ms,
                "delays_injected": delays_injected,
            },
        )
        self._blackout_events.append(event)

        return {
            "provider_id": provider_id,
            "delay_ms": delay_ms,
            "jitter_ms": jitter_ms,
            "delays_injected": delays_injected,
            "duration_ms": duration_ms,
        }

    async def corrupt_tokens(
        self,
        provider_id: str,
        corruption_type: str = "random",
        corruption_rate: float = 0.5,
        duration_ms: int = 25000,
    ) -> dict[str, Any]:
        """
        Corrupt streaming tokens in various ways.
        
        Args:
            provider_id: Target provider
            corruption_type: Type of corruption - "random", "utf8", "control", "truncation"
            corruption_rate: How often to corrupt tokens (0.0-1.0)
            duration_ms: How long to corrupt tokens
            
        Returns:
            Token corruption results
        """
        start_time = time.time()
        tokens_corrupted = 0
        tokens_seen = 0

        corruption_strategies = {
            "random": lambda: bytes([random.randint(0, 255) for _ in range(10)]).decode(
                "utf-8", errors="replace"
            ),
            "utf8": "\ufffd\ufffd\ufffd",
            "control": "\x00\x01\x02\x1b\x7f",
            "truncation": "TOK",
        }

        corrupt_fn = corruption_strategies.get(corruption_type, corruption_strategies["random"])

        async def corruption_loop() -> None:
            nonlocal tokens_corrupted, tokens_seen
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                tokens_seen += 1
                if random.random() < corruption_rate:
                    tokens_corrupted += 1
                    self._total_requests_failed += 1
                await asyncio.sleep(0.005)

        await corruption_loop()

        event = BlackoutEvent(
            timestamp=start_time,
            provider_id=provider_id,
            mode=BlackoutMode.MALFORMED_CATASTROPHE,
            affected_endpoints=[],
            duration_ms=duration_ms,
            details={
                "corruption_type": corruption_type,
                "corruption_rate": corruption_rate,
                "tokens_corrupted": tokens_corrupted,
                "tokens_seen": tokens_seen,
            },
        )
        self._blackout_events.append(event)

        return {
            "provider_id": provider_id,
            "corruption_type": corruption_type,
            "corruption_rate": corruption_rate,
            "tokens_corrupted": tokens_corrupted,
            "tokens_seen": tokens_seen,
            "duration_ms": duration_ms,
        }

    def restore_provider(self, provider_id: str) -> dict[str, Any]:
        """Restore a provider to healthy state after blackout."""
        status = self._providers.get(provider_id)
        if status:
            status.alive = True
            status.error_rate = 0.0
            status.latency_ms = 0
            status.failure_reason = None
            status.last_heartbeat = time.time()

        return {
            "provider_id": provider_id,
            "restored": True,
            "restored_at": datetime.now(timezone.utc).isoformat(),
        }

    def restore_all_providers(self) -> dict[str, Any]:
        """Restore all providers to healthy state."""
        for status in self._providers.values():
            status.alive = True
            status.error_rate = 0.0
            status.latency_ms = 0
            status.failure_reason = None
            status.last_heartbeat = time.time()

        self._active_blackout = False

        return {
            "providers_restored": len(self._providers),
            "restored_at": datetime.now(timezone.utc).isoformat(),
            "total_blackout_events": len(self._blackout_events),
        }

    def get_blackout_stats(self) -> dict[str, Any]:
        """Get comprehensive blackout statistics."""
        return {
            "active_blackout": self._active_blackout,
            "total_providers": len(self._providers),
            "providers_alive": sum(1 for p in self._providers.values() if p.alive),
            "providers_down": sum(1 for p in self._providers.values() if not p.alive),
            "total_requests_failed": self._total_requests_failed,
            "blackout_events": len(self._blackout_events),
            "recent_events": [
                {
                    "timestamp": e.timestamp,
                    "provider_id": e.provider_id,
                    "mode": e.mode.value,
                    "duration_ms": e.duration_ms,
                }
                for e in self._blackout_events[-10:]
            ],
        }

    def export_blackout_log(self) -> list[dict[str, Any]]:
        """Export full blackout event log."""
        return [
            {
                "timestamp": e.timestamp,
                "provider_id": e.provider_id,
                "mode": e.mode.value,
                "affected_endpoints": e.affected_endpoints,
                "duration_ms": e.duration_ms,
                "details": e.details,
            }
            for e in self._blackout_events
        ]


_provider_blackout: Optional[ProviderBlackout] = None


def get_provider_blackout() -> ProviderBlackout:
    global _provider_blackout
    if _provider_blackout is None:
        _provider_blackout = ProviderBlackout()
    return _provider_blackout
