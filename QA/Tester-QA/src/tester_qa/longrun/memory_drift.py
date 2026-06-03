"""Memory Drift Tracker — detects memory leaks over time."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional
import statistics


@dataclass
class MemoryDriftPoint:
    """A point-in-time memory measurement."""
    timestamp: datetime
    heap_mb: float
    dom_nodes: int
    event_listeners: int
    detached_nodes: int

    def to_dict(self) -> dict:
        return {
            "timestamp": self.timestamp.isoformat(),
            "heap_mb": self.heap_mb,
            "dom_nodes": self.dom_nodes,
            "event_listeners": self.event_listeners,
            "detached_nodes": self.detached_nodes,
        }


class MemoryDriftTracker:
    """Tracks memory drift and detects leak patterns."""

    def __init__(self):
        self._start_time: Optional[datetime] = None
        self._points: list[MemoryDriftPoint] = []
        self._tracking_active = False

    def start_tracking(self, page=None) -> None:
        """Start tracking, optionally injects JS memory monitor."""
        self._start_time = datetime.now(timezone.utc)
        self._points = []
        self._tracking_active = True

        # If a Playwright page is provided, inject memory monitoring JS
        if page is not None:
            try:
                page.evaluate("""
                    window.__memoryMonitor = {
                        samples: [],
                        sample: function() {
                            const sample = {
                                timestamp: Date.now(),
                                heap: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0,
                                domNodes: document.getElementsByTagName('*').length,
                                eventListeners: window.__eventListenerCount || 0,
                                detachedNodes: 0
                            };
                            this.samples.push(sample);
                            return sample;
                        },
                        getSamples: function() { return this.samples; }
                    };
                """)
            except Exception:
                pass  # Browser may not support memory API

    def sample(self, page=None) -> MemoryDriftPoint:
        """Sample current memory state (uses psutil if no page)."""
        now = datetime.now(timezone.utc)

        if page is not None:
            try:
                metrics = page.evaluate("""
                    () => {
                        return {
                            heap: performance.memory ? performance.memory.usedJSHeapSize / 1024 / 1024 : 0,
                            domNodes: document.getElementsByTagName('*').length,
                            eventListeners: window.__eventListenerCount || 0,
                            detachedNodes: 0
                        };
                    }
                """)
                point = MemoryDriftPoint(
                    timestamp=now,
                    heap_mb=metrics.get("heap", 0.0),
                    dom_nodes=metrics.get("domNodes", 0),
                    event_listeners=metrics.get("eventListeners", 0),
                    detached_nodes=metrics.get("detachedNodes", 0),
                )
            except Exception:
                point = self._sample_system_memory(now)
        else:
            point = self._sample_system_memory(now)

        self._points.append(point)
        return point

    def _sample_system_memory(self, timestamp: datetime) -> MemoryDriftPoint:
        """Sample system memory using psutil."""
        try:
            import psutil
            process = psutil.Process()
            memory_info = process.memory_info()
            heap_mb = memory_info.rss / 1024 / 1024
        except ImportError:
            heap_mb = 0.0

        return MemoryDriftPoint(
            timestamp=timestamp,
            heap_mb=heap_mb,
            dom_nodes=0,
            event_listeners=0,
            detached_nodes=0,
        )

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

    def get_drift_rate(self) -> float:
        """MB per hour based on linear regression."""
        if len(self._points) < 2:
            return 0.0

        # Convert timestamps to hours from start
        start = self._points[0].timestamp
        hours = [(p.timestamp - start).total_seconds() / 3600.0 for p in self._points]
        heap_values = [p.heap_mb for p in self._points]

        slope, _ = self._linear_regression(hours, heap_values)
        return slope

    def detect_leak_pattern(self) -> dict:
        """Detect if leak is linear/exponential/step."""
        if len(self._points) < 3:
            return {"pattern": "insufficient_data", "confidence": 0.0}

        heap_values = [p.heap_mb for p in self._points]
        start = self._points[0].timestamp
        hours = [(p.timestamp - start).total_seconds() / 3600.0 for p in self._points]

        # Calculate linear fit
        linear_slope, linear_intercept = self._linear_regression(hours, heap_values)
        linear_predictions = [linear_slope * h + linear_intercept for h in hours]
        linear_error = sum((actual - pred) ** 2 for actual, pred in zip(heap_values, linear_predictions))

        # Check for step pattern (sudden jumps)
        diffs = [heap_values[i+1] - heap_values[i] for i in range(len(heap_values) - 1)]
        if diffs:
            avg_diff = statistics.mean(diffs)
            std_diff = statistics.stdev(diffs) if len(diffs) > 1 else 0
            step_jumps = sum(1 for d in diffs if abs(d - avg_diff) > 2 * std_diff) if std_diff > 0 else 0
        else:
            step_jumps = 0

        # Check for exponential pattern
        try:
            import math
            log_heap = [math.log(max(h, 0.001)) for h in heap_values]
            exp_slope, exp_intercept = self._linear_regression(hours, log_heap)
            exp_predictions = [math.exp(exp_slope * h + exp_intercept) for h in hours]
            exp_error = sum((actual - pred) ** 2 for actual, pred in zip(heap_values, exp_predictions))
        except (ValueError, OverflowError):
            exp_error = float('inf')

        # Determine pattern
        if step_jumps > len(diffs) * 0.3:
            pattern = "step"
            confidence = min(step_jumps / len(diffs), 1.0)
        elif exp_error < linear_error * 0.8:
            pattern = "exponential"
            confidence = 1.0 - (exp_error / (linear_error + 0.001))
        elif linear_slope > 0.1:  # More than 0.1 MB/hour
            pattern = "linear"
            confidence = min(linear_slope / 10.0, 1.0)
        else:
            pattern = "stable"
            confidence = 1.0 - abs(linear_slope)

        return {
            "pattern": pattern,
            "confidence": max(0.0, min(1.0, confidence)),
            "linear_slope_mb_per_hour": linear_slope,
            "step_jumps_detected": step_jumps,
        }

    def get_report(self) -> dict:
        """Full memory drift report."""
        drift_rate = self.get_drift_rate()
        leak_pattern = self.detect_leak_pattern()

        elapsed_hours = 0.0
        if self._points:
            elapsed = (self._points[-1].timestamp - self._points[0].timestamp).total_seconds()
            elapsed_hours = elapsed / 3600.0

        initial_heap = self._points[0].heap_mb if self._points else 0.0
        current_heap = self._points[-1].heap_mb if self._points else 0.0
        total_drift = current_heap - initial_heap

        return {
            "started_at": self._start_time.isoformat() if self._start_time else None,
            "elapsed_hours": elapsed_hours,
            "sample_count": len(self._points),
            "initial_heap_mb": initial_heap,
            "current_heap_mb": current_heap,
            "total_drift_mb": total_drift,
            "drift_rate_mb_per_hour": drift_rate,
            "leak_pattern": leak_pattern,
            "is_leaking": drift_rate > 1.0,  # More than 1 MB/hour
            "projected_oom_hours": (4096 - current_heap) / drift_rate if drift_rate > 0 else None,
        }

    def get_points(self) -> list[MemoryDriftPoint]:
        """Return all recorded points."""
        return self._points.copy()
