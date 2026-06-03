"""Guardrails for chaos/browser-warfare scenario execution."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


_INTENSITY_ORDER = {"low": 1, "medium": 2, "high": 3, "critical": 4}


@dataclass(slots=True)
class ChaosGuardrailPolicy:
    """Policy limits used to validate chaos scenario requests."""

    max_duration_seconds: int = 3600
    max_parallel_scenarios: int = 3
    max_intensity: str = "high"
    allowed_targets: list[str] = field(default_factory=list)
    forbidden_targets: list[str] = field(default_factory=list)


class ChaosGuardrails:
    """Validate and track active chaos scenario requests."""

    def __init__(self, policy: ChaosGuardrailPolicy | None = None) -> None:
        self.policy = policy or ChaosGuardrailPolicy()
        self._active_scenarios: dict[str, dict[str, Any]] = {}

    def validate_request(self, request: dict[str, Any]) -> tuple[bool, list[str]]:
        """Validate a chaos scenario request against the configured policy."""
        violations: list[str] = []

        duration = request.get("duration_seconds", request.get("duration", 0))
        if duration and float(duration) > self.policy.max_duration_seconds:
            violations.append(
                f"duration exceeds max_duration_seconds={self.policy.max_duration_seconds}"
            )

        if len(self._active_scenarios) >= self.policy.max_parallel_scenarios:
            violations.append(
                f"active scenarios exceed max_parallel_scenarios={self.policy.max_parallel_scenarios}"
            )

        intensity = str(request.get("intensity", "low")).lower()
        max_intensity = self.policy.max_intensity.lower()
        if _INTENSITY_ORDER.get(intensity, 0) > _INTENSITY_ORDER.get(max_intensity, 0):
            violations.append(f"intensity '{intensity}' exceeds max_intensity='{max_intensity}'")

        target = str(request.get("target", request.get("url", "")))
        if self.policy.allowed_targets and not any(
            allowed in target for allowed in self.policy.allowed_targets
        ):
            violations.append("target is not in allowed_targets")
        if self.policy.forbidden_targets and any(
            forbidden in target for forbidden in self.policy.forbidden_targets
        ):
            violations.append("target matches forbidden_targets")

        return not violations, violations

    def register_active_scenario(self, id: str, request: dict[str, Any]) -> None:
        """Register an active scenario by id."""
        self._active_scenarios[id] = dict(request)

    def unregister_active_scenario(self, id: str) -> None:
        """Unregister an active scenario by id."""
        self._active_scenarios.pop(id, None)

    def get_status(self) -> dict[str, Any]:
        """Return current guardrail status."""
        return {
            "policy": {
                "max_duration_seconds": self.policy.max_duration_seconds,
                "max_parallel_scenarios": self.policy.max_parallel_scenarios,
                "max_intensity": self.policy.max_intensity,
                "allowed_targets": list(self.policy.allowed_targets),
                "forbidden_targets": list(self.policy.forbidden_targets),
            },
            "active_count": len(self._active_scenarios),
            "active_scenarios": list(self._active_scenarios.keys()),
        }
