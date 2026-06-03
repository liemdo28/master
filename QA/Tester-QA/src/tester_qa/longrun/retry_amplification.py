"""Retry Amplification Tracker — detects retry storms."""
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
import statistics


@dataclass
class RetryAmplificationPoint:
    """A point-in-time retry measurement."""
    timestamp: datetime
    retry_count: int
    amplification_factor: float  # current / baseline
    is_storm: bool

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "retry_count": self.retry_count,
            "amplification_factor": self.amplification_factor,
            "is_storm": self.is_storm,
        }


class RetryAmplificationTracker:
    """Tracks retry amplification and detects storm onset."""

    STORM_THRESHOLD = 3.0  # 3x amplification = storm

    def __init__(self, storm_threshold: float = STORM_THRESHOLD):
        self._start_time: Optional[datetime] = None
        self._points: list[RetryAmplificationPoint] = []
        self._baseline_retry_count: Optional[int] = None
        self._storm_threshold = storm_threshold

    def record(self, retry_count: int) -> RetryAmplificationPoint:
        """Record retry count and return a RetryAmplificationPoint."""
        now = datetime.now(timezone.utc)

        if self._start_time is None:
            self._start_time = now
            self._baseline_retry_count = max(retry_count, 1)  # Avoid division by zero

        amplification_factor = retry_count / self._baseline_retry_count
        is_storm = amplification_factor >= self._storm_threshold

        point = RetryAmplificationPoint(
            timestamp=now,
            retry_count=retry_count,
            amplification_factor=amplification_factor,
            is_storm=is_storm,
        )

        self._points.append(point)
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

    def get_amplification_rate(self) -> float:
        """Factor growth per hour."""
        if len(self._points) < 2:
            return 0.0

        start = self._points[0].timestamp
        hours = [(p.timestamp - start).total_seconds() / 3600.0 for p in self._points]
        factors = [p.amplification_factor for p in self._points]

        slope, _ = self._linear_regression(hours, factors)
        return slope

    def detect_storm_onset(self) -> bool:
        """True if amplification > 3x initial (storm threshold)."""
        if not self._points:
            return False

        current_factor = self._points[-1].amplification_factor
        return current_factor >= self._storm_threshold

    def get_storm_events(self) -> list[RetryAmplificationPoint]:
        """Return all points where storm was detected."""
        return [p for p in self._points if p.is_storm]

    def predict_storm_onset(self) -> dict:
        """Predict when storm will occur based on current trend."""
        if len(self._points) < 2:
            return {"hours_until_storm": None, "is_imminent": False}

        current_factor = self._points[-1].amplification_factor
        if current_factor >= self._storm_threshold:
            return {"hours_until_storm": 0.0, "is_imminent": True, "already_in_storm": True}

        rate = self.get_amplification_rate()
        if rate <= 0:
            return {"hours_until_storm": None, "is_imminent": False}

        remaining = self._storm_threshold - current_factor
        hours_until_storm = remaining / rate

        return {
            "hours_until_storm": hours_until_storm,
            "is_imminent": hours_until_storm < 1.0,
            "already_in_storm": False,
        }

    def get_report(self) -> dict:
        """Full retry amplification report."""
        amplification_rate = self.get_amplification_rate()
        storm_detected = self.detect_storm_onset()
        storm_prediction = self.predict_storm_onset()
        storm_events = self.get_storm_events()

        elapsed_hours = 0.0
        if self._points:
            elapsed = (self._points[-1].timestamp - self._points[0].timestamp).total_seconds()
            elapsed_hours = elapsed / 3600.0

        initial_retries = self._baseline_retry_count or 0
        current_retries = self._points[-1].retry_count if self._points else 0
        current_factor = self._points[-1].amplification_factor if self._points else 1.0

        # Calculate peak amplification
        peak_factor = max((p.amplification_factor for p in self._points), default=1.0)

        return {
            "started_at": self._start_time.isoformat() if self._start_time else None,
            "elapsed_hours": elapsed_hours,
            "sample_count": len(self._points),
            "baseline_retry_count": initial_retries,
            "current_retry_count": current_retries,
            "current_amplification_factor": current_factor,
            "peak_amplification_factor": peak_factor,
            "amplification_rate_per_hour": amplification_rate,
            "storm_threshold": self._storm_threshold,
            "storm_detected": storm_detected,
            "storm_event_count": len(storm_events),
            "storm_prediction": storm_prediction,
            "severity": self._calculate_severity(current_factor),
        }

    def _calculate_severity(self, factor: float) -> str:
        """Calculate severity level based on amplification factor."""
        if factor < 1.5:
            return "normal"
        elif factor < 2.0:
            return "elevated"
        elif factor < 3.0:
            return "warning"
        elif factor < 5.0:
            return "critical"
        else:
            return "catastrophic"

    def get_points(self) -> list[RetryAmplificationPoint]:
        """Return all recorded points."""
        return self._points.copy()
