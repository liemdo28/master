"""Runtime Interrogator — Identifies most dangerous runtime paths.

Required Intelligence Output:
- Most dangerous runtime path
- Highest retry amplification
- Most unstable websocket route
- Most expensive failure chain
- Highest memory leak probability
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class RuntimePath:
    path_id: str
    components: list[str]
    danger_score: float
    failure_modes: list[str]
    retry_amplification: float = 0.0
    memory_leak_probability: float = 0.0
    latency_p99_ms: float = 0.0
    cascade_depth: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "path_id": self.path_id,
            "components": self.components,
            "danger_score": round(self.danger_score, 4),
            "failure_modes": self.failure_modes,
            "retry_amplification": round(self.retry_amplification, 4),
            "memory_leak_probability": round(self.memory_leak_probability, 4),
            "latency_p99_ms": round(self.latency_p99_ms, 2),
            "cascade_depth": self.cascade_depth,
        }


@dataclass
class RuntimeIntelligence:
    most_dangerous_path: Optional[RuntimePath] = None
    highest_retry_amplification: Optional[RuntimePath] = None
    most_unstable_websocket_route: Optional[str] = None
    most_expensive_failure_chain: list[str] = field(default_factory=list)
    highest_memory_leak_probability: float = 0.0
    overall_danger_score: float = 0.0
    recommendations: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "most_dangerous_path": self.most_dangerous_path.to_dict() if self.most_dangerous_path else None,
            "highest_retry_amplification": self.highest_retry_amplification.to_dict() if self.highest_retry_amplification else None,
            "most_unstable_websocket_route": self.most_unstable_websocket_route,
            "most_expensive_failure_chain": self.most_expensive_failure_chain,
            "highest_memory_leak_probability": round(self.highest_memory_leak_probability, 4),
            "overall_danger_score": round(self.overall_danger_score, 4),
            "recommendations": self.recommendations,
        }


class RuntimeInterrogator:
    """Interrogates runtime behavior to identify most dangerous paths."""

    def __init__(self) -> None:
        self._paths: list[RuntimePath] = []
        self._websocket_routes: dict[str, float] = {}
        self._failure_chains: list[list[str]] = []
        self._memory_signals: list[dict[str, float]] = []

    def register_path(
        self,
        path_id: str,
        components: list[str],
        failure_modes: list[str],
        retry_amplification: float = 0.0,
        memory_leak_probability: float = 0.0,
        latency_p99_ms: float = 0.0,
        cascade_depth: int = 0,
    ) -> RuntimePath:
        """Register a runtime path for interrogation."""
        danger = self._calculate_danger(
            retry_amplification, memory_leak_probability,
            latency_p99_ms, cascade_depth, len(failure_modes),
        )
        path = RuntimePath(
            path_id=path_id,
            components=components,
            danger_score=danger,
            failure_modes=failure_modes,
            retry_amplification=retry_amplification,
            memory_leak_probability=memory_leak_probability,
            latency_p99_ms=latency_p99_ms,
            cascade_depth=cascade_depth,
        )
        self._paths.append(path)
        return path

    def register_websocket_route(self, route: str, instability_score: float) -> None:
        """Register websocket route instability."""
        self._websocket_routes[route] = max(
            self._websocket_routes.get(route, 0), instability_score
        )

    def register_failure_chain(self, chain: list[str]) -> None:
        """Register an observed failure propagation chain."""
        self._failure_chains.append(chain)

    def register_memory_signal(self, component: str, growth_rate_mb_per_min: float, leak_probability: float) -> None:
        """Register memory leak signal."""
        self._memory_signals.append({
            "component": component,
            "growth_rate": growth_rate_mb_per_min,
            "probability": leak_probability,
        })

    def interrogate(self) -> RuntimeIntelligence:
        """Run full runtime interrogation and produce intelligence report."""
        most_dangerous = max(self._paths, key=lambda p: p.danger_score, default=None)
        highest_retry = max(self._paths, key=lambda p: p.retry_amplification, default=None)

        most_unstable_ws = None
        if self._websocket_routes:
            most_unstable_ws = max(self._websocket_routes, key=self._websocket_routes.get)

        most_expensive_chain: list[str] = []
        if self._failure_chains:
            most_expensive_chain = max(self._failure_chains, key=len)

        highest_mem_leak = 0.0
        if self._memory_signals:
            highest_mem_leak = max(s["probability"] for s in self._memory_signals)

        overall_danger = 0.0
        if self._paths:
            overall_danger = sum(p.danger_score for p in self._paths) / len(self._paths)

        recommendations = self._generate_recommendations(
            most_dangerous, highest_retry, most_unstable_ws,
            most_expensive_chain, highest_mem_leak,
        )

        return RuntimeIntelligence(
            most_dangerous_path=most_dangerous,
            highest_retry_amplification=highest_retry,
            most_unstable_websocket_route=most_unstable_ws,
            most_expensive_failure_chain=most_expensive_chain,
            highest_memory_leak_probability=highest_mem_leak,
            overall_danger_score=overall_danger,
            recommendations=recommendations,
        )

    def _calculate_danger(
        self,
        retry_amp: float,
        mem_leak: float,
        latency: float,
        cascade: int,
        failure_mode_count: int,
    ) -> float:
        score = 0.0
        score += min(retry_amp * 5, 30)
        score += mem_leak * 25
        score += min(latency / 100, 20)
        score += cascade * 8
        score += failure_mode_count * 3
        return min(100.0, score)

    def _generate_recommendations(
        self,
        dangerous: Optional[RuntimePath],
        retry: Optional[RuntimePath],
        ws_route: Optional[str],
        chain: list[str],
        mem_leak: float,
    ) -> list[str]:
        recs = []
        if dangerous and dangerous.danger_score > 60:
            recs.append(f"CRITICAL: Path '{dangerous.path_id}' has danger score {dangerous.danger_score:.0f} — requires immediate circuit breaker")
        if retry and retry.retry_amplification > 5:
            recs.append(f"HIGH: Path '{retry.path_id}' amplifies retries {retry.retry_amplification:.1f}x — implement exponential backoff with jitter")
        if ws_route:
            recs.append(f"HIGH: WebSocket route '{ws_route}' is most unstable — add reconnection throttle and state reconciliation")
        if len(chain) > 4:
            recs.append(f"CRITICAL: Failure chain depth {len(chain)} — add failure boundaries between: {' → '.join(chain[:3])}")
        if mem_leak > 0.7:
            recs.append(f"HIGH: Memory leak probability {mem_leak:.0%} — implement periodic GC and connection pool limits")
        if not recs:
            recs.append("System paths within acceptable risk parameters")
        return recs
