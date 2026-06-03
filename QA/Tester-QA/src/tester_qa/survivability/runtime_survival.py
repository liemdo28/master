"""Runtime survivability validation for Tester-QA."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Iterable, Mapping


@dataclass(frozen=True)
class RuntimeSurvivalResult:
    score: float
    cpu_resilience: float
    memory_resilience: float
    queue_resilience: float
    failure_modes: list[str] = field(default_factory=list)


class RuntimeSurvivalValidator:
    """Score runtime resilience under CPU, memory, and queue pressure."""

    def validate(self, metrics: Mapping[str, Any], history: Iterable[Mapping[str, Any]] | None = None) -> RuntimeSurvivalResult:
        metric = dict(metrics or {})
        samples = [dict(item) for item in (history or []) if isinstance(item, Mapping)]
        cpu_resilience = self._score_cpu(metric, samples)
        memory_resilience = self._score_memory(metric, samples)
        queue_resilience = self._score_queue(metric, samples)
        penalties = 0.0
        failure_modes: list[str] = []
        error_rate = self._ratio(metric, "error_rate", 0.0)
        crash_count = self._number(metric, "crash_count", 0.0)
        restart_count = self._number(metric, "restart_count", 0.0)
        if error_rate > 0.05:
            failure_modes.append("elevated_error_rate")
            penalties += min(0.12, error_rate * 0.8)
        if crash_count > 0:
            failure_modes.append("runtime_crashes")
            penalties += min(0.18, crash_count * 0.06)
        if restart_count > 2:
            failure_modes.append("restart_instability")
            penalties += min(0.10, (restart_count - 2) * 0.025)
        for name, value in (("cpu_pressure", cpu_resilience), ("memory_pressure", memory_resilience), ("queue_backpressure", queue_resilience)):
            if value < 0.65:
                failure_modes.append(name)
        score = self._clamp(cpu_resilience * 0.34 + memory_resilience * 0.33 + queue_resilience * 0.33 - penalties)
        return RuntimeSurvivalResult(round(score, 4), round(cpu_resilience, 4), round(memory_resilience, 4), round(queue_resilience, 4), sorted(set(failure_modes)))

    def _score_cpu(self, metrics: Mapping[str, Any], history: list[Mapping[str, Any]]) -> float:
        usage = self._ratio(metrics, "cpu_usage", self._ratio(metrics, "cpu", 0.45))
        score = 1.0 - max(0.0, usage - 0.70) * 1.15
        score -= min(0.18, self._number(metrics, "event_loop_lag_ms", 0.0) / 1000.0)
        score -= min(0.16, self._number(metrics, "cpu_saturation_seconds", 0.0) / 600.0)
        score -= min(0.10, self._number(metrics, "cpu_throttle_events", 0.0) * 0.015)
        score -= self._volatility_penalty(history, ("cpu_usage", "cpu"), 0.08)
        return self._clamp(score)

    def _score_memory(self, metrics: Mapping[str, Any], history: list[Mapping[str, Any]]) -> float:
        usage = self._ratio(metrics, "memory_usage", self._ratio(metrics, "memory", 0.45))
        score = 1.0 - max(0.0, usage - 0.72) * 1.2
        score -= min(0.18, self._number(metrics, "memory_growth_mb_per_min", 0.0) / 800.0)
        score -= min(0.12, self._number(metrics, "gc_pause_ms", 0.0) / 2500.0)
        score -= min(0.30, self._number(metrics, "oom_events", 0.0) * 0.15)
        score -= self._volatility_penalty(history, ("memory_usage", "memory"), 0.07)
        return self._clamp(score)

    def _score_queue(self, metrics: Mapping[str, Any], history: list[Mapping[str, Any]]) -> float:
        depth = self._number(metrics, "queue_depth", 0.0)
        capacity = max(1.0, self._number(metrics, "queue_capacity", 1000.0))
        utilization = self._ratio(metrics, "queue_utilization", depth / capacity)
        score = 1.0 - max(0.0, utilization - 0.70) * 1.25
        score -= min(0.18, self._number(metrics, "queue_latency_ms", 0.0) / 5000.0)
        score -= min(0.18, self._number(metrics, "queue_drops", 0.0) * 0.025)
        score -= min(0.12, self._ratio(metrics, "retry_rate", 0.0) * 0.7)
        score -= self._volatility_penalty(history, ("queue_utilization",), 0.06)
        return self._clamp(score)

    @staticmethod
    def _number(metrics: Mapping[str, Any], key: str, default: float) -> float:
        try:
            value = metrics.get(key, default)
            return default if value is None else float(value)
        except (TypeError, ValueError):
            return default

    @classmethod
    def _ratio(cls, metrics: Mapping[str, Any], key: str, default: float) -> float:
        value = cls._number(metrics, key, default)
        if 1.0 < value <= 100.0:
            value /= 100.0
        return cls._clamp(value)

    @classmethod
    def _volatility_penalty(cls, history: list[Mapping[str, Any]], keys: tuple[str, ...], weight: float) -> float:
        values: list[float] = []
        for sample in history[-20:]:
            for key in keys:
                if key in sample:
                    values.append(cls._ratio(sample, key, 0.0))
                    break
        if len(values) < 3:
            return 0.0
        return min(weight, max(0.0, max(values) - min(values) - 0.25) * weight)

    @staticmethod
    def _clamp(value: float, lower: float = 0.0, upper: float = 1.0) -> float:
        return max(lower, min(upper, float(value)))
