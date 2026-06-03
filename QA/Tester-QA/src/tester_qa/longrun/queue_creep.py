"""Queue Creep Tracker — monitors queue depth growth over time."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
import statistics


@dataclass
class QueueCreepPoint:
    """A point-in-time queue measurement."""
    timestamp: datetime
    depth: int
    processing_rate: float  # items per second
    backlog_growth_rate: float  # items per second

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "depth": self.depth,
            "processing_rate": self.processing_rate,
            "backlog_growth_rate": self.backlog_growth_rate,
        }


class QueueCreepTracker:
    """Tracks queue depth creep and predicts saturation."""

    DEFAULT_MAX_DEPTH = 100000  # Default max queue depth for saturation prediction

    def __init__(self, max_depth: int = DEFAULT_MAX_DEPTH):
        self._start_time: Optional[datetime] = None
        self._points: list[QueueCreepPoint] = []
        self._last_depth: int = 0
        self._last_timestamp: Optional[datetime] = None
        self._total_processed: int = 0
        self._max_depth = max_depth

    def record(self, depth: int, processed: int) -> QueueCreepPoint:
        """Record queue state and return a QueueCreepPoint."""
        now = datetime.now(timezone.utc)

        if self._start_time is None:
            self._start_time = now
            self._last_timestamp = now
            self._last_depth = depth

        # Calculate rates
        time_delta = (now - self._last_timestamp).total_seconds()
        if time_delta > 0:
            processing_rate = processed / time_delta
            depth_change = depth - self._last_depth
            backlog_growth_rate = depth_change / time_delta
        else:
            processing_rate = 0.0
            backlog_growth_rate = 0.0

        point = QueueCreepPoint(
            timestamp=now,
            depth=depth,
            processing_rate=processing_rate,
            backlog_growth_rate=backlog_growth_rate,
        )

        self._points.append(point)
        self._last_depth = depth
        self._last_timestamp = now
        self._total_processed += processed

        return point

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

    def get_creep_rate(self) -> float:
        """Items per hour growth rate."""
        if len(self._points) < 2:
            return 0.0

        start = self._points[0].timestamp
        hours = [(p.timestamp - start).total_seconds() / 3600.0 for p in self._points]
        depths = [p.depth for p in self._points]

        slope, _ = self._linear_regression(hours, depths)
        return slope

    def predict_saturation(self) -> dict:
        """Predict when queue will saturate."""
        creep_rate = self.get_creep_rate()
        current_depth = self._points[-1].depth if self._points else 0

        if creep_rate <= 0:
            return {
                "hours_until_saturation": None,
                "max_depth_projected": current_depth,
                "is_growing": False,
                "creep_rate_per_hour": creep_rate,
            }

        remaining_capacity = self._max_depth - current_depth
        hours_until_saturation = remaining_capacity / creep_rate if creep_rate > 0 else None

        # Project max depth in 24 hours
        max_depth_projected = current_depth + (creep_rate * 24)

        return {
            "hours_until_saturation": hours_until_saturation,
            "max_depth_projected": max_depth_projected,
            "is_growing": creep_rate > 0,
            "creep_rate_per_hour": creep_rate,
            "current_depth": current_depth,
            "max_capacity": self._max_depth,
        }

    def get_report(self) -> dict:
        """Full queue creep report."""
        creep_rate = self.get_creep_rate()
        saturation = self.predict_saturation()

        elapsed_hours = 0.0
        if self._points:
            elapsed = (self._points[-1].timestamp - self._points[0].timestamp).total_seconds()
            elapsed_hours = elapsed / 3600.0

        initial_depth = self._points[0].depth if self._points else 0
        current_depth = self._points[-1].depth if self._points else 0

        # Calculate average processing rate
        avg_processing_rate = 0.0
        if self._points:
            rates = [p.processing_rate for p in self._points if p.processing_rate > 0]
            avg_processing_rate = statistics.mean(rates) if rates else 0.0

        return {
            "started_at": self._start_time.isoformat() if self._start_time else None,
            "elapsed_hours": elapsed_hours,
            "sample_count": len(self._points),
            "initial_depth": initial_depth,
            "current_depth": current_depth,
            "total_growth": current_depth - initial_depth,
            "creep_rate_per_hour": creep_rate,
            "avg_processing_rate_per_second": avg_processing_rate,
            "total_processed": self._total_processed,
            "saturation_prediction": saturation,
            "is_healthy": creep_rate <= 0 or (saturation.get("hours_until_saturation") or float('inf')) > 24,
        }

    def get_points(self) -> list[QueueCreepPoint]:
        """Return all recorded points."""
        return self._points.copy()
