"""Blast Radius Engine - Calculate blast radius and impact of failures."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional


@dataclass
class Component:
    component_id: str
    name: str
    component_type: str
    dependencies: list[str] = field(default_factory=list)
    dependents: list[str] = field(default_factory=list)


@dataclass
class Casualty:
    component_id: str
    name: str
    impact_type: str
    severity: float
    recovery_time_seconds: float
    affected_operations: list[str] = field(default_factory=list)


@dataclass
class BlastRadius:
    origin_component: str
    timestamp: datetime
    total_components_affected: int
    casualties: list[Casualty]
    impact_score: float
    radius_hops: int
    estimated_damage_cost: float


class BlastRadiusEngine:
    """Calculate blast radius and identify casualties of failures."""

    def __init__(self):
        self.components: dict[str, Component] = {}
        self.casualties: list[Casualty] = []
        self.blast_radii: list[BlastRadius] = []

    def _build_graph(self, component_list: list[dict[str, Any]]) -> None:
        """Build component dependency graph."""
        self.components = {}
        for c in component_list:
            comp = Component(
                component_id=c.get("component_id", ""),
                name=c.get("name", ""),
                component_type=c.get("component_type", "unknown"),
                dependencies=c.get("dependencies", []),
                dependents=c.get("dependents", []),
            )
            self.components[comp.component_id] = comp

    def calculate_blast_radius(
        self,
        origin_id: str,
        component_list: list[dict[str, Any]],
        max_hops: int = 5,
    ) -> BlastRadius:
        """Calculate blast radius from a failure origin."""
        self._build_graph(component_list)
        self.casualties = []

        if origin_id not in self.components:
            return BlastRadius(
                origin_component=origin_id,
                timestamp=datetime.now(),
                total_components_affected=0,
                casualties=[],
                impact_score=0.0,
                radius_hops=0,
                estimated_damage_cost=0.0,
            )

        visited: set[str] = {origin_id}
        current_hop: set[str] = {origin_id}
        hops = 0
        impact_score = 0.0

        while current_hop and hops < max_hops:
            next_hop: set[str] = set()
            for cid in current_hop:
                comp = self.components.get(cid)
                if not comp:
                    continue
                for dep_id in comp.dependents:
                    if dep_id not in visited:
                        visited.add(dep_id)
                        next_hop.add(dep_id)
                        dep = self.components.get(dep_id)
                        if dep:
                            severity = max(0.1, 1.0 - (hops * 0.15))
                            self.casualties.append(
                                Casualty(
                                    component_id=dep_id,
                                    name=dep.name,
                                    impact_type="cascading_failure",
                                    severity=severity,
                                    recovery_time_seconds=30.0 * (hops + 1),
                                    affected_operations=["read", "write"] if hops > 0 else ["read", "write", "control"],
                                )
                            )
                            impact_score += severity
            current_hop = next_hop
            hops += 1

        damage_cost = impact_score * 1000.0

        radius = BlastRadius(
            origin_component=origin_id,
            timestamp=datetime.now(),
            total_components_affected=len(visited) - 1,
            casualties=self.casualties,
            impact_score=impact_score,
            radius_hops=hops,
            estimated_damage_cost=damage_cost,
        )
        self.blast_radii.append(radius)
        return radius

    def identify_casualties(
        self, radius_id: Optional[str] = None
    ) -> list[Casualty]:
        """Identify casualties from blast radius calculation."""
        if radius_id:
            radii = [r for r in self.blast_radii if r.origin_component == radius_id]
            if not radii:
                return []
            return radii[0].casualties
        return self.casualties

    def measure_impact_radius(
        self, component_id: str
    ) -> dict[str, Any]:
        """Measure impact radius metrics for a component."""
        total_impact = 0.0
        total_recovery = 0.0
        affected_ops: set[str] = set()

        for casualty in self.casualties:
            if casualty.component_id == component_id:
                total_impact += casualty.severity
                total_recovery += casualty.recovery_time_seconds
                affected_ops.update(casualty.affected_operations)

        return {
            "component_id": component_id,
            "direct_impact": total_impact,
            "total_recovery_time_seconds": total_recovery,
            "affected_operations": list(affected_ops),
            "blast_hops": next(
                (r.radius_hops for r in self.blast_radii if r.origin_component == component_id),
                0,
            ),
        }
