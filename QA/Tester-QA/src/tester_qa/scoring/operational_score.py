"""Operational Survival Score — aggregates all subsystem scores into a single grade."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus


class OperationalScoreCalculator:
    """Aggregate runtime, WebSocket, provider, architecture, and recovery scores."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus or EventBus.get_instance()

    def calculate(
        self,
        runtime_score: int | None = None,
        websocket_score: int | None = None,
        provider_score: int | None = None,
        architecture_score: int | None = None,
        recovery_score: int | None = None,
        incident_frequency: int = 0,
        collapse_probability: float = 0.0,
        recovery_time_seconds: float = 0.0,
        fragility_index: int = 0,
    ) -> dict[str, Any]:
        """
        Returns aggregated operational score (0-100) with letter grade and
        contributing factors. All score parameters default to 70 when omitted.
        """
        # Pull defaults from the event bus history if not explicitly provided
        runtime    = self._resolve(runtime_score,    "runtime_integrity",     70)
        ws         = self._resolve(websocket_score,  "websocket_reliability", 70)
        provider   = self._resolve(provider_score,   "provider_stability",     70)
        arch       = self._resolve(architecture_score, "architecture_survivability", 70)
        recovery   = self._resolve(recovery_score,   "recovery_confidence",   70)

        # Weighted aggregation — runtime and recovery are most critical
        raw = (
            runtime    * 0.25
            + ws       * 0.20
            + provider * 0.20
            + arch     * 0.15
            + recovery * 0.20
        )
        score = int(max(0, min(100, raw)))

        grade = self._grade(score)

        breakdown: dict[str, Any] = {
            "runtime":             runtime,
            "websocket":           ws,
            "provider":            provider,
            "architecture":        arch,
            "recovery":            recovery,
            "incident_penalty":    max(0, -incident_frequency * 2),
            "fragility_penalty":   fragility_index,
        }

        factors: list[dict[str, Any]] = []
        if incident_frequency > 3:
            factors.append({"name": "High incident frequency",   "value": incident_frequency,    "impact": "negative",
                             "detail": f"{incident_frequency} incidents observed — score penalised"})
        if collapse_probability > 0.4:
            factors.append({"name": "Elevated collapse probability", "value": collapse_probability, "impact": "negative",
                             "detail": f"{collapse_probability*100:.0f}% collapse risk — fragility raised"})
        if recovery_time_seconds > 300:
            factors.append({"name": "Slow recovery time",        "value": recovery_time_seconds, "impact": "negative",
                             "detail": f"Last recovery took {recovery_time_seconds:.0f}s — above 5-min threshold"})
        if fragility_index > 30:
            factors.append({"name": "High fragility index",       "value": fragility_index,       "impact": "negative",
                             "detail": f"Fragility index {fragility_index}/100 — structural weaknesses present"})
        if score >= 90:
            factors.append({"name": "System is battle-hardened",  "value": score,                 "impact": "positive",
                             "detail": "All subsystems score well; minimal operational risk"})

        return {
            "score":     score,
            "grade":     grade,
            "breakdown": breakdown,
            "factors":   factors,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _resolve(self, override: int | None, key: str, default: int) -> int:
        """Use override if given, else consult event bus, else fall back to default."""
        if override is not None:
            return override
        history = self._bus.get_recent(seconds=300)
        for evt in reversed(history):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return int(val)
        return default

    @staticmethod
    def _grade(score: int) -> str:
        if score >= 90: return "A"
        if score >= 75: return "B"
        if score >= 60: return "C"
        if score >= 40: return "D"
        return "F"
