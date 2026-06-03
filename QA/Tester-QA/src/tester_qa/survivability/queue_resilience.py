"""Queue resilience validation and survival prediction."""

from __future__ import annotations

from typing import Any, Mapping


class QueueResilienceValidator:
    """Validate queue backpressure, drain capability, and loss risk."""

    def validate(self, metrics: Mapping[str, Any]) -> dict[str, Any]:
        prediction = self.predict_queue_survival(metrics)
        metric = dict(metrics or {})
        depth = self._number(metric, "queue_depth", 0.0)
        capacity = max(1.0, self._number(metric, "queue_capacity", 1000.0))
        utilization = self._ratio(metric, "queue_utilization", depth / capacity)
        enqueue_rate = self._number(metric, "enqueue_rate", self._number(metric, "ingress_rate", 0.0))
        drain_rate = self._number(metric, "drain_rate", self._number(metric, "egress_rate", enqueue_rate or 1.0))
        drops = self._number(metric, "queue_drops", self._number(metric, "dropped_messages", 0.0))
        dead_letters = self._number(metric, "dead_letters", self._number(metric, "dlq_count", 0.0))
        latency_ms = self._number(metric, "queue_latency_ms", 0.0)
        score = self._clamp(prediction["score"] - min(0.20, drops * 0.03) - min(0.15, dead_letters * 0.02) - min(0.15, latency_ms / 10000.0))
        risks = []
        if utilization > 0.8:
            risks.append("high_queue_utilization")
        if drain_rate < enqueue_rate:
            risks.append("negative_drain_margin")
        if drops > 0:
            risks.append("queue_drops_detected")
        if dead_letters > 0:
            risks.append("dead_letters_detected")
        return {"score": round(score, 4), "status": self._status(score), "utilization": round(utilization, 4), "drain_margin": round(drain_rate - enqueue_rate, 4), "prediction": prediction, "risks": risks}

    def predict_queue_survival(self, metrics: Mapping[str, Any]) -> dict[str, Any]:
        metric = dict(metrics or {})
        depth = self._number(metric, "queue_depth", 0.0)
        capacity = max(1.0, self._number(metric, "queue_capacity", 1000.0))
        enqueue_rate = self._number(metric, "enqueue_rate", self._number(metric, "ingress_rate", 0.0))
        drain_rate = self._number(metric, "drain_rate", self._number(metric, "egress_rate", enqueue_rate or 1.0))
        utilization = self._ratio(metric, "queue_utilization", depth / capacity)
        backlog_growth = max(0.0, enqueue_rate - drain_rate)
        remaining_capacity = max(0.0, capacity - depth)
        seconds_to_saturation = float("inf") if backlog_growth <= 0 else remaining_capacity / backlog_growth
        survival_window_seconds = self._number(metric, "survival_window_seconds", 300.0)
        score = 1.0 - max(0.0, utilization - 0.65) * 1.2
        if seconds_to_saturation != float("inf") and seconds_to_saturation < survival_window_seconds:
            score -= min(0.35, (survival_window_seconds - seconds_to_saturation) / survival_window_seconds * 0.35)
        if drain_rate <= 0 and enqueue_rate > 0:
            score -= 0.4
        score = self._clamp(score)
        return {"score": round(score, 4), "will_saturate": seconds_to_saturation != float("inf") and seconds_to_saturation <= survival_window_seconds, "seconds_to_saturation": None if seconds_to_saturation == float("inf") else round(seconds_to_saturation, 4), "remaining_capacity": round(remaining_capacity, 4), "backlog_growth_per_sec": round(backlog_growth, 4), "utilization": round(utilization, 4)}

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

    @staticmethod
    def _clamp(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    @staticmethod
    def _status(score: float) -> str:
        if score >= 0.9:
            return "resilient"
        if score >= 0.75:
            return "recoverable"
        if score >= 0.55:
            return "degraded"
        return "unsafe"
