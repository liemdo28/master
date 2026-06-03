from __future__ import annotations

import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class HealthStatus(Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    CRITICAL = "critical"


@dataclass
class HealthCheck:
    name: str
    status: HealthStatus
    score: float
    message: str = ""
    details: dict[str, object] = field(default_factory=dict)


@dataclass
class RuntimeHealthReport:
    overall_status: HealthStatus
    overall_score: float
    checks: list[HealthCheck] = field(default_factory=list)
    degradation_detected: bool = False
    degradation_rate: float = 0.0
    timestamp: float = field(default_factory=time.time)


class RuntimeHealth:
    """Monitors and reports on overall runtime health and degradation."""

    def __init__(
        self,
        healthy_threshold: float = 80.0,
        degraded_threshold: float = 50.0,
        critical_threshold: float = 25.0,
    ) -> None:
        self._healthy_threshold = healthy_threshold
        self._degraded_threshold = degraded_threshold
        self._critical_threshold = critical_threshold
        self._health_history: list[tuple[float, float]] = []
        self._last_check_time: Optional[float] = None

    def check_health(self, check_results: list[HealthCheck]) -> RuntimeHealthReport:
        """Perform a comprehensive runtime health check."""
        now = time.time()

        if not check_results:
            return RuntimeHealthReport(
                overall_status=HealthStatus.UNHEALTHY,
                overall_score=0.0,
                checks=[],
                degradation_detected=False,
                degradation_rate=0.0,
                timestamp=now,
            )

        scores = [c.score for c in check_results]
        overall_score = sum(scores) / len(scores)

        statuses = [c.status for c in check_results]
        if any(s == HealthStatus.CRITICAL for s in statuses):
            overall_status = HealthStatus.CRITICAL
        elif any(s == HealthStatus.UNHEALTHY for s in statuses):
            overall_status = HealthStatus.UNHEALTHY
        elif any(s == HealthStatus.DEGRADED for s in statuses):
            overall_status = HealthStatus.DEGRADED
        else:
            overall_status = HealthStatus.HEALTHY

        self._health_history.append((now, overall_score))

        degradation_detected = False
        degradation_rate = 0.0
        if len(self._health_history) >= 3:
            degradation_detected, degradation_rate = self.detect_degradation()

        self._last_check_time = now

        return RuntimeHealthReport(
            overall_status=overall_status,
            overall_score=overall_score,
            checks=list(check_results),
            degradation_detected=degradation_detected,
            degradation_rate=degradation_rate,
            timestamp=now,
        )

    def calculate_score(
        self,
        eventloop_latency_ms: float = 0.0,
        memory_growth_rate: float = 0.0,
        queue_depth: int = 0,
        websocket_active: int = 0,
        websocket_zombies: int = 0,
        process_count: int = 0,
    ) -> float:
        """Calculate a composite runtime health score (0-100) from component metrics."""
        score = 100.0

        if eventloop_latency_ms > 500:
            score -= 30.0
        elif eventloop_latency_ms > 100:
            score -= 15.0
        elif eventloop_latency_ms > 50:
            score -= 5.0

        if memory_growth_rate > 10 * 1024 * 1024:
            score -= 25.0
        elif memory_growth_rate > 1024 * 1024:
            score -= 15.0
        elif memory_growth_rate > 100 * 1024:
            score -= 5.0

        if queue_depth > 1000:
            score -= 20.0
        elif queue_depth > 500:
            score -= 10.0
        elif queue_depth > 100:
            score -= 5.0

        if websocket_zombies > 0:
            zombie_penalty = min(20.0, websocket_zombies * 5.0)
            score -= zombie_penalty

        if process_count > 100:
            score -= 10.0
        elif process_count > 50:
            score -= 5.0

        return max(0.0, min(100.0, score))

    def detect_degradation(self) -> tuple[bool, float]:
        """Detect if the runtime is degrading over time based on health history."""
        if len(self._health_history) < 3:
            return False, 0.0

        recent_window = self._health_history[-3:]
        scores = [s for _, s in recent_window]

        if scores[0] == 0:
            return False, 0.0

        rate = (scores[-1] - scores[0]) / scores[0]

        if rate < -0.1:
            return True, abs(rate) * 100.0

        return False, 0.0

    def get_status(self, score: float) -> HealthStatus:
        """Map a numeric score to a HealthStatus enum value."""
        if score >= self._healthy_threshold:
            return HealthStatus.HEALTHY
        elif score >= self._degraded_threshold:
            return HealthStatus.DEGRADED
        elif score >= self._critical_threshold:
            return HealthStatus.UNHEALTHY
        else:
            return HealthStatus.CRITICAL

    def get_health_history(self) -> list[tuple[float, float]]:
        """Return the history of health scores over time."""
        return list(self._health_history)
