"""Provider Stability Scorer — evaluates external service provider reliability."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus


class ProviderStabilityScorer:
    """Score the stability and resilience of all configured providers."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus or EventBus.get_instance()

    def calculate(
        self,
        provider_timeout_rates: dict[str, float] | None = None,
        provider_latency_trends: dict[str, float] | None = None,
        provider_failover_counts: dict[str, int] | None = None,
        provider_success_rates: dict[str, float] | None = None,
        default_timeout_rate: float | None = None,
        default_latency_ms: float | None = None,
        default_failover_count: int | None = None,
        default_success_rate: float | None = None,
    ) -> dict[str, Any]:
        """
        Returns an aggregate provider stability score (0-100), degraded providers,
        and the overall failure rate.
        """
        # Gather defaults from event bus then layer overrides on top
        bus_rates   = self._bus_dict("provider_timeout_rates",   cast=float)
        bus_latency = self._bus_dict("provider_latency_trends_ms", cast=float)
        bus_failover = self._bus_dict("provider_failover_counts", cast=int)
        bus_success  = self._bus_dict("provider_success_rates",  cast=float)

        all_timeouts  = {**bus_rates,    **(provider_timeout_rates  or {})}
        all_latencies = {**bus_latency,  **(provider_latency_trends or {})}
        all_failovers = {**bus_failover, **(provider_failover_counts or {})}
        all_success   = {**bus_success,  **(provider_success_rates  or {})}

        dto   = default_timeout_rate   if default_timeout_rate   is not None else self._bus_float("provider_timeout_rate", 0.05)
        dlat  = default_latency_ms     if default_latency_ms     is not None else self._bus_float("provider_latency_ms", 100.0)
        dfail = default_failover_count if default_failover_count is not None else 0
        dsr   = default_success_rate   if default_success_rate   is not None else self._bus_float("provider_success_rate", 0.95)

        provider_scores: dict[str, int] = {}
        provider_total  = 0
        provider_count  = 0

        all_providers = set(all_success) | set(all_timeouts) | set(all_latencies) | set(all_failovers)
        for p in all_providers:
            s_rate   = all_success.get(p, dsr)
            to_rate  = all_timeouts.get(p, dto)
            latency  = all_latencies.get(p, dlat)
            failovers = all_failovers.get(p, dfail)

            ps = int(s_rate * 50) - int(to_rate * 30)
            if latency > 2000:
                ps -= 15
            elif latency > 1000:
                ps -= 8
            ps -= failovers * 3
            ps = max(0, min(100, ps))
            provider_scores[p] = ps
            provider_total += ps
            provider_count += 1

        score = int(provider_total / provider_count) if provider_count > 0 else \
                max(0, min(100, int(dsr * 100) - int(dto * 20)))

        total_requests = self._bus_float("provider_total_requests", 1.0)
        total_errors   = self._bus_float("provider_total_errors",  0.0)
        failure_rate   = round(total_errors / max(1.0, total_requests), 4)

        degraded_providers: list[dict[str, Any]] = []
        for p, ps in provider_scores.items():
            if ps < 70:
                degraded_providers.append({
                    "provider": p,
                    "score":    ps,
                    "issues":   self._provider_issues(p,
                                all_success.get(p, 1.0),
                                all_timeouts.get(p, 0.0),
                                all_latencies.get(p, 0.0),
                                all_failovers.get(p, 0)),
                })

        return {
            "score":              score,
            "degraded_providers": degraded_providers,
            "failure_rate":       failure_rate,
            "timestamp":         datetime.now(timezone.utc).isoformat(),
        }

    def _bus_float(self, key: str, default: float) -> float:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return float(val)
        return default

    def _bus_int(self, key: str, default: int) -> int:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return int(val)
        return default

    def _bus_dict(self, key: str, cast: type) -> dict[str, Any]:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None and isinstance(val, dict):
                return {k: cast(v) for k, v in val.items()}
        return {}

    @staticmethod
    def _provider_issues(provider: str, success: float, timeout: float,
                        latency: float, failovers: int) -> list[str]:
        issues: list[str] = []
        if success  < 0.9:  issues.append(f"success rate {success*100:.1f}% below 90%")
        if timeout  > 0.05: issues.append(f"timeout rate {timeout*100:.1f}% above 5%")
        if latency  > 2000: issues.append(f"latency {latency:.0f}ms exceeds 2s")
        if failovers > 1:   issues.append(f"{failovers} failover(s) triggered")
        return issues
