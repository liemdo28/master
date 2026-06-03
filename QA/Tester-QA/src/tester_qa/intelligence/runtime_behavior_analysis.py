"""Runtime behavior analysis — decay, leaks, fragility conditions."""
from __future__ import annotations

from collections import Counter
from statistics import mean


class RuntimeBehaviorAnalyzer:
    """Analyzes runtime resource trends and pre-failure signatures."""

    def _slope(self, values: list[float]) -> float:
        if len(values) < 2:
            return 0.0
        xs = list(range(len(values)))
        xbar, ybar = mean(xs), mean(values)
        denom = sum((x - xbar) ** 2 for x in xs) or 1
        return sum((x - xbar) * (y - ybar) for x, y in zip(xs, values)) / denom

    def analyze_decay_pattern(self, runtime_history: list[dict]) -> dict:
        """Perform linear regression on memory/cpu trends."""
        ordered = sorted(runtime_history, key=lambda x: str(x.get("timestamp", "")))
        memory = [float(x.get("memory_mb", x.get("memory_at_failure", x.get("memory_percent", 0))) or 0) for x in ordered]
        cpu = [float(x.get("cpu_percent", x.get("cpu_at_failure", 0)) or 0) for x in ordered]
        mem_slope = self._slope(memory)
        cpu_slope = self._slope(cpu)
        return {"memory_slope_per_sample": round(mem_slope, 4), "cpu_slope_per_sample": round(cpu_slope, 4), "decay_detected": mem_slope > 0 or cpu_slope > 0.5, "sample_count": len(ordered)}

    def detect_memory_leak_signature(self, history: list[dict]) -> dict:
        """Detect monotonic memory growth and estimate leak rate MB/hour."""
        ordered = sorted(history, key=lambda x: str(x.get("timestamp", "")))
        memory = [float(x.get("memory_mb", 0) or 0) for x in ordered if float(x.get("memory_mb", 0) or 0) > 0]
        if len(memory) < 3:
            return {"detected": False, "leak_rate_mb_per_hour": 0.0, "confidence": 0.0}
        slope = self._slope(memory)
        increases = sum(1 for a, b in zip(memory, memory[1:]) if b >= a)
        monotonicity = increases / (len(memory) - 1)
        detected = slope > 0 and monotonicity >= 0.7
        # Without real timestamps interval, assume samples are hourly unless metadata provides interval.
        rate = slope
        confidence = min(0.95, monotonicity * 0.7 + min(max(slope, 0) / max(mean(memory), 1) * 10, 0.25)) if detected else min(0.3, monotonicity * 0.3)
        return {"detected": detected, "leak_rate_mb_per_hour": round(rate, 3), "confidence": round(confidence, 3)}

    def find_fragility_conditions(self, history: list[dict]) -> list[dict]:
        """Find metric conditions that precede failures."""
        failures = [x for x in history if x.get("failed") or x.get("failure_type") or x.get("status") in {"failed", "error"}]
        if not failures:
            return []
        conditions = []
        metrics = ["cpu_percent", "memory_percent", "queue_depth", "memory_mb"]
        for metric in metrics:
            vals = [float(x.get(metric, 0) or 0) for x in failures if float(x.get(metric, 0) or 0) > 0]
            if vals:
                conditions.append({"metric": metric, "avg_before_failure": round(mean(vals), 2), "min_failure_value": round(min(vals), 2), "max_failure_value": round(max(vals), 2), "sample_count": len(vals)})
        types = Counter(str(x.get("failure_type", "unknown")) for x in failures)
        for c in conditions:
            c["associated_failure_types"] = dict(types)
        return sorted(conditions, key=lambda x: x["sample_count"], reverse=True)
