"""Runtime Decay Tracker — monitors system degradation over time."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
import statistics


@dataclass
class DecaySnapshot:
    """A point-in-time snapshot of system metrics."""
    timestamp: datetime
    elapsed_seconds: float
    cpu_percent: float
    memory_mb: float
    websocket_count: int
    queue_depth: int
    error_rate: float
    retry_count: int

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "elapsed_seconds": self.elapsed_seconds,
            "cpu_percent": self.cpu_percent,
            "memory_mb": self.memory_mb,
            "websocket_count": self.websocket_count,
            "queue_depth": self.queue_depth,
            "error_rate": self.error_rate,
            "retry_count": self.retry_count,
        }


@dataclass
class DecayTrend:
    """Trend analysis for a single metric."""
    metric: str
    initial_value: float
    current_value: float
    drift_rate_per_hour: float
    projected_collapse_hours: Optional[float]
    is_degrading: bool

    def to_dict(self) -> dict:
        return {
            "metric": self.metric,
            "initial_value": self.initial_value,
            "current_value": self.current_value,
            "drift_rate_per_hour": self.drift_rate_per_hour,
            "projected_collapse_hours": self.projected_collapse_hours,
            "is_degrading": self.is_degrading,
        }


class RuntimeDecayTracker:
    """Tracks system decay over extended runtime periods."""

    # Thresholds for collapse prediction
    COLLAPSE_THRESHOLDS = {
        "cpu_percent": 95.0,
        "memory_mb": 4096.0,  # 4GB
        "websocket_count": 1000,
        "queue_depth": 10000,
        "error_rate": 0.5,  # 50%
        "retry_count": 1000,
    }

    def __init__(self):
        self._start_time: Optional[datetime] = None
        self._snapshots: list[DecaySnapshot] = []

    def start(self) -> None:
        """Start tracking decay from this moment."""
        self._start_time = datetime.now(timezone.utc)
        self._snapshots = []

    def record_snapshot(self, metrics: dict) -> DecaySnapshot:
        """Create and record a snapshot from metrics dict."""
        if self._start_time is None:
            self.start()

        now = datetime.now(timezone.utc)
        elapsed = (now - self._start_time).total_seconds()

        snapshot = DecaySnapshot(
            timestamp=now,
            elapsed_seconds=elapsed,
            cpu_percent=metrics.get("cpu_percent", 0.0),
            memory_mb=metrics.get("memory_mb", 0.0),
            websocket_count=metrics.get("websocket_count", 0),
            queue_depth=metrics.get("queue_depth", 0),
            error_rate=metrics.get("error_rate", 0.0),
            retry_count=metrics.get("retry_count", 0),
        )
        self._snapshots.append(snapshot)
        return snapshot

    def _linear_regression(self, x_values: list[float], y_values: list[float]) -> tuple[float, float]:
        """Calculate slope and intercept using least squares."""
        n = len(x_values)
        if n < 2:
            return 0.0, y_values[0] if y_values else 0.0

        x_mean = statistics.mean(x_values)
        y_mean = statistics.mean(y_values)

        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_values, y_values))
        denominator = sum((x - x_mean) ** 2 for x in x_values)

        if denominator == 0:
            return 0.0, y_mean

        slope = numerator / denominator
        intercept = y_mean - slope * x_mean
        return slope, intercept

    def calculate_trends(self) -> list[DecayTrend]:
        """Calculate linear regression on each metric to find drift rate."""
        if len(self._snapshots) < 2:
            return []

        metrics = ["cpu_percent", "memory_mb", "websocket_count", "queue_depth", "error_rate", "retry_count"]
        trends = []

        # Convert elapsed seconds to hours for rate calculation
        hours = [s.elapsed_seconds / 3600.0 for s in self._snapshots]

        for metric in metrics:
            values = [getattr(s, metric) for s in self._snapshots]
            slope_per_hour, _ = self._linear_regression(hours, values)

            initial_value = values[0]
            current_value = values[-1]
            is_degrading = slope_per_hour > 0

            # Calculate projected collapse time
            projected_collapse_hours = None
            if is_degrading and slope_per_hour > 0:
                threshold = self.COLLAPSE_THRESHOLDS.get(metric, float('inf'))
                if current_value < threshold:
                    hours_to_collapse = (threshold - current_value) / slope_per_hour
                    projected_collapse_hours = hours_to_collapse

            trends.append(DecayTrend(
                metric=metric,
                initial_value=initial_value,
                current_value=current_value,
                drift_rate_per_hour=slope_per_hour,
                projected_collapse_hours=projected_collapse_hours,
                is_degrading=is_degrading,
            ))

        return trends

    def get_decay_report(self) -> dict:
        """Return full report with all trends."""
        trends = self.calculate_trends()
        elapsed_hours = 0.0
        if self._snapshots:
            elapsed_hours = self._snapshots[-1].elapsed_seconds / 3600.0

        return {
            "started_at": self._start_time.isoformat() if self._start_time else None,
            "elapsed_hours": elapsed_hours,
            "snapshot_count": len(self._snapshots),
            "trends": [t.to_dict() for t in trends],
            "degrading_metrics": [t.metric for t in trends if t.is_degrading],
            "critical_metrics": [
                t.metric for t in trends
                if t.projected_collapse_hours is not None and t.projected_collapse_hours < 2.0
            ],
        }

    def predict_collapse_time(self) -> dict:
        """Return {metric: hours_until_collapse} based on trends."""
        trends = self.calculate_trends()
        predictions = {}

        for trend in trends:
            if trend.projected_collapse_hours is not None:
                predictions[trend.metric] = trend.projected_collapse_hours

        # Find the soonest collapse
        soonest_metric = None
        soonest_hours = float('inf')
        for metric, hours in predictions.items():
            if hours < soonest_hours:
                soonest_hours = hours
                soonest_metric = metric

        return {
            "predictions": predictions,
            "soonest_collapse_metric": soonest_metric,
            "soonest_collapse_hours": soonest_hours if soonest_metric else None,
        }

    def get_snapshots(self) -> list[DecaySnapshot]:
        """Return all recorded snapshots."""
        return self._snapshots.copy()
