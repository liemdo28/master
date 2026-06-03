"""Collapse simulator — run multi-step failure scenarios on the digital twin."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from tester_qa.digital_twin.ecosystem_model import EcosystemModel


@dataclass
class CollapseStep:
    tick: int
    action: str
    target: str
    intensity: float
    result: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {"tick": self.tick, "action": self.action, "target": self.target, "intensity": self.intensity, "result": self.result}


class CollapseSimulator:
    """Simulate multi-step collapse scenarios on the ecosystem digital twin."""

    def __init__(self, model: EcosystemModel | None = None) -> None:
        self.model = model or EcosystemModel()
        self.steps: list[CollapseStep] = []

    def run_progressive_collapse(self, steps: list[dict[str, Any]]) -> dict[str, Any]:
        """Run a sequence of failure injections and observe ecosystem degradation."""
        self.model.reset()
        self.steps = []

        for i, step in enumerate(steps):
            action = step.get("action", "inject_failure")
            target = step.get("target", "")
            intensity = step.get("intensity", 0.5)

            if action == "inject_failure":
                result = self.model.inject_failure(target, intensity)
            elif action == "apply_load":
                result = self.model.simulate_load(target, intensity)
            elif action == "scenario":
                result = self.model.run_scenario(target, intensity)
            else:
                result = {"error": f"Unknown action: {action}"}

            self.steps.append(CollapseStep(tick=i, action=action, target=target, intensity=intensity, result=result))

        return {
            "total_steps": len(self.steps),
            "steps": [s.to_dict() for s in self.steps],
            "final_state": self.model.get_state(),
            "collapse_path": self.model.get_projected_collapse_path(),
            "fragility_heatmap": self.model.get_fragility_heatmap()[:5],
            "summary": self._summarize(),
        }

    def run_escalating_stress(self, target: str, max_intensity: float = 1.0, steps: int = 10) -> dict[str, Any]:
        """Gradually increase stress until collapse is detected."""
        self.model.reset()
        collapse_point: int | None = None

        for i in range(steps):
            intensity = (i + 1) / steps * max_intensity
            self.model.simulate_load(target, intensity / steps)
            state = self.model.get_state()

            if state["dead"] > 0 and collapse_point is None:
                collapse_point = i

        return {
            "target": target,
            "max_intensity": max_intensity,
            "steps": steps,
            "collapse_detected_at_step": collapse_point,
            "maximum_survivable_load": (collapse_point or steps) / steps * max_intensity,
            "final_state": self.model.get_state(),
            "estimated_recovery_complexity": "high" if collapse_point and collapse_point < steps // 2 else "medium",
        }

    def _summarize(self) -> dict[str, Any]:
        state = self.model.get_state()
        return {
            "ecosystem_survived": state["dead"] == 0,
            "nodes_degraded": state["degraded"],
            "nodes_critical": state["critical"],
            "nodes_dead": state["dead"],
            "overall_health": state["overall_health"],
            "most_fragile": self.model.get_fragility_heatmap()[0]["node"] if self.model.get_fragility_heatmap() else None,
        }
