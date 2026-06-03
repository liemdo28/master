"""Provider failover survivability scoring."""

from __future__ import annotations

from typing import Any, Iterable, Mapping


class ProviderFailoverResilience:
    """Validate provider redundancy, failover speed, and fallback health."""

    def validate(self, providers: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
        provider_list = [dict(provider) for provider in (providers or []) if isinstance(provider, Mapping)]
        confidence = self.score_failover_confidence(provider_list)
        healthy = [provider for provider in provider_list if self._is_healthy(provider)]
        primaries = [provider for provider in provider_list if str(provider.get("role", "")).lower() == "primary" or provider.get("primary")]
        failover_ready = sum(1 for provider in provider_list if bool(provider.get("failover_ready", provider.get("fallback_ready", self._is_healthy(provider)))))
        avg_failover_ms = self._average(self._number(provider, "failover_ms", self._number(provider, "failover_time_ms", 0.0)) for provider in provider_list)
        risks = []
        if len(provider_list) < 2:
            risks.append("single_provider_dependency")
        if not healthy:
            risks.append("no_healthy_provider")
        if failover_ready < 2 and len(provider_list) >= 2:
            risks.append("insufficient_failover_capacity")
        if avg_failover_ms > 5000:
            risks.append("slow_provider_failover")
        if primaries and not any(provider in healthy for provider in primaries):
            risks.append("primary_provider_unhealthy")
        return {"score": round(confidence, 4), "confidence": round(confidence, 4), "status": self._status(confidence), "provider_count": len(provider_list), "healthy_provider_count": len(healthy), "failover_ready_count": failover_ready, "avg_failover_ms": round(avg_failover_ms, 4), "risks": risks}

    def score_failover_confidence(self, providers: Iterable[Mapping[str, Any]]) -> float:
        provider_list = [dict(provider) for provider in (providers or []) if isinstance(provider, Mapping)]
        if not provider_list:
            return 0.0
        score = 0.35 if len(provider_list) == 1 else 0.70
        healthy_ratio = sum(1 for provider in provider_list if self._is_healthy(provider)) / len(provider_list)
        ready_ratio = sum(1 for provider in provider_list if bool(provider.get("failover_ready", provider.get("fallback_ready", self._is_healthy(provider))))) / len(provider_list)
        success_rates = [self._ratio(provider, "success_rate", 1.0) for provider in provider_list]
        timeout_rates = [self._ratio(provider, "timeout_rate", 0.0) for provider in provider_list]
        failover_times = [self._number(provider, "failover_ms", self._number(provider, "failover_time_ms", 0.0)) for provider in provider_list]
        score += healthy_ratio * 0.18 + ready_ratio * 0.16 + (sum(success_rates) / len(success_rates)) * 0.12
        score -= min(0.20, (sum(timeout_rates) / len(timeout_rates)) * 0.8)
        avg_failover = self._average(failover_times)
        score -= min(0.14, avg_failover / 60000.0)
        if len(provider_list) >= 3:
            score += 0.05
        if healthy_ratio == 0:
            score = min(score, 0.25)
        return self._clamp(score)

    @staticmethod
    def _is_healthy(provider: Mapping[str, Any]) -> bool:
        status = str(provider.get("status", "")).lower()
        if status in {"healthy", "ok", "ready", "available", "active"}:
            return True
        if status in {"down", "failed", "unhealthy", "degraded", "unavailable"}:
            return False
        return bool(provider.get("healthy", provider.get("available", True)))

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
    def _average(values: Iterable[float]) -> float:
        nums = [value for value in values if value > 0]
        return sum(nums) / len(nums) if nums else 0.0

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
