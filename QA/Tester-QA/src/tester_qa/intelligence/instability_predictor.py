"""Instability Prediction Module"""

import json
import math
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class MetricPoint:
    """A single metric data point."""
    name: str
    value: float
    timestamp: float


@dataclass
class RiskForecast:
    """A risk forecast for a given metric or component."""
    name: str
    risk_level: str  # "low", "medium", "high", "critical"
    failure_probability: float
    trend: str  # "stable", "increasing", "decreasing"
    confidence: float


class InstabilityPredictor:
    """Predicts system instability using simple statistical analysis of recorded metrics."""

    def __init__(self, storage_path: Optional[str] = None):
        self._storage_path = storage_path or os.path.join(
            os.path.expanduser("~"), ".tester_qa", "instability_metrics.json"
        )
        self._metrics: Dict[str, List[MetricPoint]] = {}
        self._load_metrics()

    def _load_metrics(self) -> None:
        """Load metrics from persistent storage."""
        if os.path.exists(self._storage_path):
            try:
                with open(self._storage_path, "r") as f:
                    data = json.load(f)
                for name, points in data.items():
                    self._metrics[name] = [
                        MetricPoint(
                            name=p["name"],
                            value=p["value"],
                            timestamp=p["timestamp"],
                        )
                        for p in points
                    ]
            except (json.JSONDecodeError, KeyError):
                self._metrics = {}

    def _save_metrics(self) -> None:
        """Persist metrics to disk."""
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        data: Dict[str, List[Dict]] = {}
        for name, points in self._metrics.items():
            data[name] = [
                {"name": p.name, "value": p.value, "timestamp": p.timestamp}
                for p in points
            ]
        with open(self._storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def record_metric(self, name: str, value: float) -> None:
        """Record a metric data point."""
        point = MetricPoint(name=name, value=value, timestamp=time.time())
        if name not in self._metrics:
            self._metrics[name] = []
        self._metrics[name].append(point)
        self._save_metrics()

    def predict_instability(self, name: str) -> Optional[RiskForecast]:
        """Predict instability for a given metric based on statistical trends."""
        points = self._metrics.get(name, [])
        if len(points) < 3:
            return None

        sorted_points = sorted(points, key=lambda p: p.timestamp)
        values = [p.value for p in sorted_points]

        # Calculate basic statistics
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std_dev = math.sqrt(variance) if variance > 0 else 0.0

        # Determine trend using simple linear regression
        trend = self._calculate_trend(sorted_points)

        # Calculate failure probability based on coefficient of variation
        cv = std_dev / mean if mean != 0 else 0.0
        failure_prob = self.calculate_failure_probability(name)

        # Determine risk level
        if failure_prob >= 0.75:
            risk_level = "critical"
        elif failure_prob >= 0.5:
            risk_level = "high"
        elif failure_prob >= 0.25:
            risk_level = "medium"
        else:
            risk_level = "low"

        # Confidence based on sample size
        confidence = min(1.0, len(points) / 30.0)

        return RiskForecast(
            name=name,
            risk_level=risk_level,
            failure_probability=failure_prob,
            trend=trend,
            confidence=confidence,
        )

    def get_risk_forecast(self) -> List[RiskForecast]:
        """Get risk forecasts for all tracked metrics."""
        forecasts: List[RiskForecast] = []
        for name in self._metrics:
            forecast = self.predict_instability(name)
            if forecast is not None:
                forecasts.append(forecast)
        return sorted(forecasts, key=lambda f: f.failure_probability, reverse=True)

    def calculate_failure_probability(self, name: str) -> float:
        """Calculate the probability of failure for a metric using statistical analysis."""
        points = self._metrics.get(name, [])
        if len(points) < 2:
            return 0.0

        sorted_points = sorted(points, key=lambda p: p.timestamp)
        values = [p.value for p in sorted_points]

        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        std_dev = math.sqrt(variance) if variance > 0 else 0.0

        # Coefficient of variation as instability indicator
        cv = std_dev / abs(mean) if mean != 0 else 0.0

        # Check for increasing trend (worsening)
        recent_half = values[len(values) // 2:]
        first_half = values[:len(values) // 2]
        recent_mean = sum(recent_half) / len(recent_half) if recent_half else 0
        first_mean = sum(first_half) / len(first_half) if first_half else 0

        trend_factor = 0.0
        if first_mean != 0:
            trend_factor = (recent_mean - first_mean) / abs(first_mean)

        # Combine CV and trend into probability (clamped 0-1)
        raw_probability = (cv * 0.6) + (max(0, trend_factor) * 0.4)
        return max(0.0, min(1.0, raw_probability))

    def _calculate_trend(self, points: List[MetricPoint]) -> str:
        """Calculate trend direction using simple linear regression slope."""
        if len(points) < 2:
            return "stable"

        n = len(points)
        x_values = list(range(n))
        y_values = [p.value for p in points]

        x_mean = sum(x_values) / n
        y_mean = sum(y_values) / n

        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values))
        denominator = sum((x - x_mean) ** 2 for x in x_values)

        if denominator == 0:
            return "stable"

        slope = numerator / denominator

        # Normalize slope relative to mean
        if y_mean != 0:
            normalized_slope = slope / abs(y_mean)
        else:
            normalized_slope = slope

        if normalized_slope > 0.05:
            return "increasing"
        elif normalized_slope < -0.05:
            return "decreasing"
        return "stable"
