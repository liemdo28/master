"""Collapse Probability Engine — estimates likelihood of system-wide failure."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus


class CollapseProbabilityEngine:
    """Estimate the probability that the system collapses given current telemetry."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus or EventBus.get_instance()

    def calculate(
        self,
        ecosystem_risk: float | None = None,
        chaos_rounds_passed: int | None = None,
        provider_timeout_rate: float | None = None,
        recovery_failure_rate: float | None = None,
        spof_count: int = 0,
        silent_failures: int = 0,
        memory_pressure_events: int = 0,
        ws_disconnect_storms: int = 0,
    ) -> dict[str, Any]:
        """
        Returns collapse probability (0.0–1.0), risk level, contributing factors,
        and the configured CRITICAL threshold.
        """
        pto   = self._resolve_float(provider_timeout_rate, "provider_timeout_rate", 0.05)
        rfr   = self._resolve_float(recovery_failure_rate, "recovery_failure_rate", 0.1)
        risk  = self._resolve_float(ecosystem_risk, "ecosystem_risk", 0.1)
        chaos = self._resolve_int(chaos_rounds_passed, "chaos_resilience_rounds", 5)

        prob = 0.05
        prob += pto   * 0.4
        prob += rfr   * 0.3
        prob += risk  * 0.15
        prob += spof_count              * 0.08
        prob += silent_failures          * 0.04
        if chaos < 3:
            prob += 0.15
        prob += memory_pressure_events   * 0.03
        prob += ws_disconnect_storms     * 0.02

        probability = round(min(1.0, max(0.0, prob)), 4)
        risk_level  = self._risk_level(probability)
        threshold   = 0.7

        contributions: list[dict[str, Any]] = []
        if pto  > 0.1:  contributions.append({"factor": "provider_timeout_rate",  "value": pto,  "contribution": round(pto  * 0.4, 4)})
        if rfr  > 0.05: contributions.append({"factor": "recovery_failure_rate","value": rfr,  "contribution": round(rfr  * 0.3, 4)})
        if risk > 0.15: contributions.append({"factor": "ecosystem_risk",        "value": risk, "contribution": round(risk * 0.15, 4)})
        if spof_count         > 0: contributions.append({"factor": "spof_count",               "value": spof_count,         "contribution": spof_count         * 0.08})
        if silent_failures    > 0: contributions.append({"factor": "silent_failures",          "value": silent_failures,    "contribution": silent_failures    * 0.04})
        if chaos             < 3: contributions.append({"factor": "chaos_rounds_passed",        "value": chaos,             "contribution": 0.15})
        if memory_pressure_events > 0: contributions.append({"factor": "memory_pressure_events","value": memory_pressure_events,"contribution": memory_pressure_events * 0.03})
        if ws_disconnect_storms   > 0: contributions.append({"factor": "ws_disconnect_storms",  "value": ws_disconnect_storms, "contribution": ws_disconnect_storms   * 0.02})

        return {
            "probability":          probability,
            "risk_level":           risk_level,
            "contributing_factors": sorted(contributions, key=lambda x: x["contribution"], reverse=True),
            "threshold":            threshold,
            "timestamp":            datetime.now(timezone.utc).isoformat(),
        }

    def _resolve_float(self, override: float | None, key: str, default: float) -> float:
        if override is not None:
            return override
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return float(val)
        return default

    def _resolve_int(self, override: int | None, key: str, default: int) -> int:
        if override is not None:
            return override
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return int(val)
        return default

    @staticmethod
    def _risk_level(probability: float) -> str:
        if probability > 0.7:  return "CRITICAL"
        if probability >= 0.4: return "HIGH"
        if probability >= 0.2: return "MEDIUM"
        return "LOW"
