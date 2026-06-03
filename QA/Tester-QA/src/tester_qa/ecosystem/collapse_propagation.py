"""Collapse propagation engine — simulates how failures cascade across projects."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from tester_qa.ecosystem.dependency_graph import DependencyGraph


@dataclass
class PropagationEvent:
    timestamp: str
    source_project: str
    affected_project: str
    failure_type: str
    propagation_path: list[str]
    severity: str = "high"

    def to_dict(self) -> dict[str, Any]:
        return {
            "timestamp": self.timestamp,
            "source_project": self.source_project,
            "affected_project": self.affected_project,
            "failure_type": self.failure_type,
            "propagation_path": self.propagation_path,
            "severity": self.severity,
        }


@dataclass
class PropagationResult:
    origin: str
    failure_type: str
    total_affected: int
    propagation_events: list[PropagationEvent] = field(default_factory=list)
    collapse_probability: float = 0.0
    time_to_full_collapse_ms: float = 0.0
    recovery_complexity: str = "medium"

    def to_dict(self) -> dict[str, Any]:
        return {
            "origin": self.origin,
            "failure_type": self.failure_type,
            "total_affected": self.total_affected,
            "propagation_events": [e.to_dict() for e in self.propagation_events],
            "collapse_probability": self.collapse_probability,
            "time_to_full_collapse_ms": self.time_to_full_collapse_ms,
            "recovery_complexity": self.recovery_complexity,
        }


class CollapsePropagation:
    """Simulate and analyze how failures propagate across the ecosystem."""

    def __init__(self, graph: DependencyGraph) -> None:
        self.graph = graph

    def simulate_failure(self, origin_project: str, failure_type: str = "runtime_crash") -> PropagationResult:
        """Simulate a failure originating from one project and trace propagation."""
        affected = self.graph.get_blast_radius(origin_project)
        events: list[PropagationEvent] = []
        now = datetime.now(timezone.utc)

        # Build propagation chain
        visited: set[str] = {origin_project}
        queue: list[tuple[str, list[str], int]] = [(origin_project, [origin_project], 0)]
        delay_ms = 0

        while queue:
            current, path, depth = queue.pop(0)
            dependents = self.graph.get_dependents(current)
            for dep in dependents:
                if dep not in visited:
                    visited.add(dep)
                    delay_ms += self._propagation_delay(failure_type, depth)
                    new_path = path + [dep]
                    events.append(PropagationEvent(
                        timestamp=now.isoformat(),
                        source_project=current,
                        affected_project=dep,
                        failure_type=self._derive_failure_type(failure_type, depth),
                        propagation_path=new_path,
                        severity=self._severity_at_depth(depth),
                    ))
                    queue.append((dep, new_path, depth + 1))

        # Calculate collapse metrics
        total_affected = len(affected)
        total_projects = len(self.graph.nodes)
        collapse_prob = min(1.0, total_affected / max(total_projects, 1))

        recovery = "low"
        if total_affected > 3:
            recovery = "high"
        elif total_affected > 1:
            recovery = "medium"

        return PropagationResult(
            origin=origin_project,
            failure_type=failure_type,
            total_affected=total_affected,
            propagation_events=events,
            collapse_probability=round(collapse_prob, 3),
            time_to_full_collapse_ms=delay_ms,
            recovery_complexity=recovery,
        )

    def simulate_all_origins(self) -> list[PropagationResult]:
        """Simulate failure from every project to find worst-case scenarios."""
        results: list[PropagationResult] = []
        for project_id in self.graph.nodes:
            result = self.simulate_failure(project_id)
            if result.total_affected > 0:
                results.append(result)
        return sorted(results, key=lambda r: r.total_affected, reverse=True)

    def get_ecosystem_resilience(self) -> dict[str, Any]:
        """Calculate overall ecosystem resilience score."""
        all_results = self.simulate_all_origins()
        if not all_results:
            return {"resilience_score": 100, "worst_case": None, "average_blast_radius": 0}

        worst = all_results[0]
        avg_blast = sum(r.total_affected for r in all_results) / len(all_results)
        max_blast = worst.total_affected
        total_projects = len(self.graph.nodes)

        # Resilience = inverse of average blast radius ratio
        resilience = max(0, 100 - int(avg_blast / max(total_projects, 1) * 100))

        return {
            "resilience_score": resilience,
            "worst_case_origin": worst.origin,
            "worst_case_affected": worst.total_affected,
            "average_blast_radius": round(avg_blast, 1),
            "max_blast_radius": max_blast,
            "total_projects": total_projects,
            "collapse_scenarios": len(all_results),
        }

    def _propagation_delay(self, failure_type: str, depth: int) -> float:
        """Estimate propagation delay in ms based on failure type and depth."""
        base_delays = {
            "runtime_crash": 500,
            "provider_timeout": 5000,
            "websocket_disconnect": 1000,
            "database_failure": 200,
            "cache_failure": 100,
            "queue_overflow": 3000,
        }
        base = base_delays.get(failure_type, 1000)
        return base * (1 + depth * 0.5)

    def _derive_failure_type(self, original: str, depth: int) -> str:
        """Derive cascading failure type based on depth."""
        if depth == 0:
            return original
        cascades = {
            "runtime_crash": "dependent_service_unavailable",
            "provider_timeout": "retry_storm",
            "websocket_disconnect": "stale_state",
            "database_failure": "data_unavailable",
            "cache_failure": "performance_degradation",
            "queue_overflow": "message_loss",
        }
        return cascades.get(original, f"cascade_depth_{depth}")

    def _severity_at_depth(self, depth: int) -> str:
        if depth == 0:
            return "critical"
        if depth == 1:
            return "high"
        if depth == 2:
            return "medium"
        return "low"
