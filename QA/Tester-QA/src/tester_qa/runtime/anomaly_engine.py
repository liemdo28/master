from __future__ import annotations

import math
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Optional


@dataclass
class Anomaly:
    metric: str
    value: float
    expected_value: float
    deviation: float
    severity: str
    timestamp: float
    description: str = ""


@dataclass
class BaselineProfile:
    metric: str
    mean: float
    std_dev: float
    sample_count: int
    window_start: float
    window_end: float


class AnomalyEngine:
    """Detects anomalies in runtime metrics based on learned baselines."""

    def __init__(self, deviation_threshold_std: float = 3.0) -> None:
        self._deviation_threshold_std = deviation_threshold_std
        self._baselines: dict[str, BaselineProfile] = {}
        self._raw_samples: dict[str, deque[float]] = {}
        self._anomalies: list[Anomaly] = []
        self._baseline_window_sec: float = 300.0
        self._alert_callbacks: list[Callable[[Anomaly], None]] = []

    def learn_baseline(self, metric: str, values: list[float]) -> BaselineProfile:
        """Build a statistical baseline from a set of metric values."""
        if not values:
            return BaselineProfile(
                metric=metric,
                mean=0.0,
                std_dev=0.0,
                sample_count=0,
                window_start=time.time(),
                window_end=time.time(),
            )

        n = len(values)
        mean = sum(values) / n
        variance = sum((v - mean) ** 2 for v in values) / n
        std_dev = math.sqrt(variance) if variance > 0 else 0.0

        now = time.time()
        profile = BaselineProfile(
            metric=metric,
            mean=mean,
            std_dev=std_dev,
            sample_count=n,
            window_start=now - self._baseline_window_sec,
            window_end=now,
        )

        self._baselines[metric] = profile

        if metric not in self._raw_samples:
            self._raw_samples[metric] = deque(maxlen=1000)
        for v in values:
            self._raw_samples[metric].append(v)

        return profile

    def calculate_deviation(self, metric: str, value: float) -> float:
        """Calculate how many standard deviations a value is from the baseline mean."""
        baseline = self._baselines.get(metric)
        if baseline is None or baseline.std_dev == 0:
            return 0.0

        deviation = abs(value - baseline.mean) / baseline.std_dev
        return deviation

    def detect_anomalies(
        self,
        metric: str,
        value: float,
        timestamp: Optional[float] = None,
    ) -> list[Anomaly]:
        """Detect anomalies for a single metric value against its learned baseline."""
        if timestamp is None:
            timestamp = time.time()

        detected: list[Anomaly] = []

        self._raw_samples.setdefault(metric, deque(maxlen=1000)).append(value)

        if metric not in self._baselines:
            return detected

        baseline = self._baselines[metric]
        deviation = self.calculate_deviation(metric, value)

        if deviation > self._deviation_threshold_std:
            severity = "low"
            if deviation > self._deviation_threshold_std * 2:
                severity = "medium"
            if deviation > self._deviation_threshold_std * 3:
                severity = "high"
            if deviation > self._deviation_threshold_std * 5:
                severity = "critical"

            anomaly = Anomaly(
                metric=metric,
                value=value,
                expected_value=baseline.mean,
                deviation=deviation,
                severity=severity,
                timestamp=timestamp,
                description=self._describe_anomaly(metric, value, baseline),
            )

            self._anomalies.append(anomaly)
            detected.append(anomaly)

            for callback in self._alert_callbacks:
                callback(anomaly)

        return detected

    def detect_batch(
        self,
        metrics: dict[str, float],
        timestamp: Optional[float] = None,
    ) -> list[Anomaly]:
        """Detect anomalies across multiple metrics at once."""
        if timestamp is None:
            timestamp = time.time()

        all_anomalies: list[Anomaly] = []
        for metric, value in metrics.items():
            anomalies = self.detect_anomalies(metric, value, timestamp)
            all_anomalies.extend(anomalies)

        return all_anomalies

    def alert(self, callback: Callable[[Anomaly], None]) -> None:
        """Register a callback to be invoked when an anomaly is detected."""
        self._alert_callbacks.append(callback)

    def get_anomalies(
        self,
        metric: Optional[str] = None,
        since: Optional[float] = None,
        min_severity: Optional[str] = None,
    ) -> list[Anomaly]:
        """Retrieve recorded anomalies with optional filters."""
        severity_order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
        min_level = severity_order.get(min_severity, 0) if min_severity else -1

        results = list(self._anomalies)

        if metric is not None:
            results = [a for a in results if a.metric == metric]

        if since is not None:
            results = [a for a in results if a.timestamp >= since]

        if min_severity is not None:
            results = [
                a for a in results
                if severity_order.get(a.severity, 0) >= min_level
            ]

        return results

    def get_baseline(self, metric: str) -> Optional[BaselineProfile]:
        """Return the current baseline profile for a metric."""
        return self._baselines.get(metric)

    def _describe_anomaly(self, metric: str, value: float, baseline: BaselineProfile) -> str:
        """Generate a human-readable description of an anomaly."""
        direction = "above" if value > baseline.mean else "below"
        deviation = self.calculate_deviation(metric, value)
        return (
            f"{metric} is {direction} expected range "
            f"(value={value:.2f}, expected={baseline.mean:.2f}, "
            f"z={deviation:.2f})"
        )
