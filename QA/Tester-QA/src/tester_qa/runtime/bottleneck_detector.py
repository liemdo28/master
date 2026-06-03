from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Bottleneck:
    component: str
    type: str
    severity: float
    throughput_before: float
    throughput_after: float
    saturation_percent: float
    recommendation: str


@dataclass
class SaturationPoint:
    component: str
    saturation_load: float
    throughput_at_saturation: float
    latency_at_saturation: float


class BottleneckDetector:
    """Detects performance bottlenecks and saturation points in the runtime."""

    def __init__(self, window_size: int = 100) -> None:
        self._window_size = window_size
        self._throughput_samples: dict[str, deque[tuple[float, float]]] = {}
        self._latency_samples: dict[str, deque[tuple[float, float]]] = {}
        self._component_thresholds: dict[str, float] = {}

    def record_throughput(self, component: str, value: float, timestamp: Optional[float] = None) -> None:
        """Record a throughput sample for a component."""
        if timestamp is None:
            timestamp = time.monotonic()

        if component not in self._throughput_samples:
            self._throughput_samples[component] = deque(maxlen=self._window_size)

        self._throughput_samples[component].append((timestamp, value))

    def record_latency(self, component: str, value: float, timestamp: Optional[float] = None) -> None:
        """Record a latency sample for a component."""
        if timestamp is None:
            timestamp = time.monotonic()

        if component not in self._latency_samples:
            self._latency_samples[component] = deque(maxlen=self._window_size)

        self._latency_samples[component].append((timestamp, value))

    def detect_bottlenecks(self) -> list[Bottleneck]:
        """Analyze recorded samples to detect performance bottlenecks."""
        bottlenecks: list[Bottleneck] = []

        for component, samples in self._throughput_samples.items():
            if len(samples) < 5:
                continue

            values = [v for _, v in samples]
            avg = sum(values) / len(values)
            max_val = max(values)
            min_val = min(values)

            if max_val == 0:
                continue

            variance = sum((v - avg) ** 2 for v in values) / len(values)
            std_dev = variance ** 0.5
            cv = std_dev / avg if avg != 0 else 0.0

            if cv > 0.5 or min_val < avg * 0.3:
                severity = min(1.0, cv)

                latency_info = self._measure_latency_for_component(component)
                current_throughput = values[-1] if values else 0.0

                bottleneck_type = "variance"
                if cv > 0.5:
                    bottleneck_type = "high_variance"
                elif min_val < avg * 0.3:
                    bottleneck_type = "throughput_drop"

                bottlenecks.append(Bottleneck(
                    component=component,
                    type=bottleneck_type,
                    severity=severity,
                    throughput_before=avg,
                    throughput_after=current_throughput,
                    saturation_percent=min(100.0, (current_throughput / max_val) * 100.0 if max_val else 0.0),
                    recommendation=self._suggest_remediation(component, bottleneck_type, severity),
                ))

        return sorted(bottlenecks, key=lambda b: b.severity, reverse=True)

    def measure_throughput(self, component: str) -> dict[str, float]:
        """Measure throughput statistics for a specific component."""
        samples = self._throughput_samples.get(component, [])
        if not samples:
            return {"current": 0.0, "average": 0.0, "max": 0.0, "min": 0.0, "total": 0.0}

        values = [v for _, v in samples]
        return {
            "current": values[-1],
            "average": sum(values) / len(values),
            "max": max(values),
            "min": min(values),
            "total": sum(values),
        }

    def find_saturation_point(self, component: str, load_steps: list[float]) -> Optional[SaturationPoint]:
        """Analyze load steps to find the saturation point for a component."""
        if not load_steps:
            return None

        samples = self._throughput_samples.get(component, [])
        latencies = self._latency_samples.get(component, [])

        if len(samples) < 2:
            return None

        throughput_values = [v for _, v in samples]
        latency_values = [v for _, v in latencies] if latencies else []

        max_throughput = max(throughput_values)
        saturation_index = 0
        for i, val in enumerate(throughput_values):
            if val >= max_throughput * 0.9:
                saturation_index = i
                break

        saturation_load = load_steps[saturation_index] if saturation_index < len(load_steps) else load_steps[-1]

        sat_latency = 0.0
        if latency_values and saturation_index < len(latency_values):
            sat_latency = latency_values[saturation_index]

        return SaturationPoint(
            component=component,
            saturation_load=saturation_load,
            throughput_at_saturation=throughput_values[saturation_index],
            latency_at_saturation=sat_latency,
        )

    def _measure_latency_for_component(self, component: str) -> dict[str, float]:
        """Internal helper to compute latency stats for a component."""
        samples = self._latency_samples.get(component, [])
        if not samples:
            return {"average_ms": 0.0, "max_ms": 0.0, "min_ms": 0.0}

        values = [v for _, v in samples]
        return {
            "average_ms": sum(values) / len(values),
            "max_ms": max(values),
            "min_ms": min(values),
        }

    def _suggest_remediation(self, component: str, bottleneck_type: str, severity: float) -> str:
        """Generate a remediation recommendation based on bottleneck type."""
        if bottleneck_type == "high_variance":
            return f"Investigate {component} for inconsistent processing times. Consider batching or caching."
        elif bottleneck_type == "throughput_drop":
            return f"Throughput drop detected in {component}. Check resource availability and upstream dependencies."
        else:
            return f"Monitor {component} closely. Severity: {severity:.2f}. Consider scaling or optimization."
