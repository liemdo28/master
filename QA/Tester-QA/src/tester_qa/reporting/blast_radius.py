from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SystemDependency:
    system_id: str
    name: str
    depends_on: list[str] = field(default_factory=list)
    dependents: list[str] = field(default_factory=list)
    criticality: str = "medium"


@dataclass
class ImpactedSystem:
    system_id: str
    name: str
    impact_level: str
    distance_from_origin: int
    path: list[str] = field(default_factory=list)


@dataclass
class BlastRadiusResult:
    origin_system: str
    total_affected: int
    affected_systems: list[ImpactedSystem] = field(default_factory=list)
    critical_systems_affected: int = 0
    max_propagation_depth: int = 0
    impact_map: dict[str, list[str]] = field(default_factory=dict)


class BlastRadiusAnalyzer:
    """Analyzes the blast radius of failures across system dependencies."""

    def __init__(self) -> None:
        self._systems: dict[str, SystemDependency] = {}

    def add_system(self, system: SystemDependency) -> None:
        """Register a system and its dependencies."""
        self._systems[system.system_id] = system

    def build_dependency_graph(self, systems: list[SystemDependency]) -> None:
        """Build the full dependency graph from a list of systems."""
        self._systems = {}
        for system in systems:
            self._systems[system.system_id] = system

        for system_id, system in self._systems.items():
            for dep_id in system.depends_on:
                dep = self._systems.get(dep_id)
                if dep is not None and system_id not in dep.dependents:
                    dep.dependents.append(system_id)

    def calculate_blast_radius(self, origin_system_id: str) -> BlastRadiusResult:
        """Calculate the blast radius if a given system fails."""
        if origin_system_id not in self._systems:
            return BlastRadiusResult(
                origin_system=origin_system_id,
                total_affected=0,
            )

        affected: list[ImpactedSystem] = []
        visited: set[str] = set()
        queue: deque[tuple[str, int, list[str]]] = deque()

        queue.append((origin_system_id, 0, [origin_system_id]))
        visited.add(origin_system_id)

        max_depth = 0

        while queue:
            current_id, depth, path = queue.popleft()

            if current_id != origin_system_id:
                system = self._systems[current_id]
                impact_level = self._calculate_impact_level(depth, system.criticality)
                affected.append(ImpactedSystem(
                    system_id=current_id,
                    name=system.name,
                    impact_level=impact_level,
                    distance_from_origin=depth,
                    path=list(path),
                ))
                max_depth = max(max_depth, depth)

            current_system = self._systems.get(current_id)
            if current_system is None:
                continue

            for dependent_id in current_system.dependents:
                if dependent_id not in visited and dependent_id in self._systems:
                    visited.add(dependent_id)
                    queue.append((dependent_id, depth + 1, path + [dependent_id]))

        critical_count = sum(
            1 for a in affected
            if self._systems.get(a.system_id, SystemDependency(system_id="", name="")).criticality == "critical"
        )

        impact_map = self.generate_impact_map(origin_system_id)

        return BlastRadiusResult(
            origin_system=origin_system_id,
            total_affected=len(affected),
            affected_systems=affected,
            critical_systems_affected=critical_count,
            max_propagation_depth=max_depth,
            impact_map=impact_map,
        )

    def identify_affected_systems(
        self,
        origin_system_id: str,
        max_depth: Optional[int] = None,
    ) -> list[ImpactedSystem]:
        """Identify all systems affected by a failure, optionally limited by depth."""
        result = self.calculate_blast_radius(origin_system_id)
        affected = result.affected_systems

        if max_depth is not None:
            affected = [a for a in affected if a.distance_from_origin <= max_depth]

        return affected

    def generate_impact_map(self, origin_system_id: str) -> dict[str, list[str]]:
        """Generate a map showing propagation paths from the origin system."""
        impact_map: dict[str, list[str]] = {}

        if origin_system_id not in self._systems:
            return impact_map

        visited: set[str] = set()
        queue: deque[str] = deque()

        queue.append(origin_system_id)
        visited.add(origin_system_id)

        while queue:
            current_id = queue.popleft()
            current_system = self._systems.get(current_id)
            if current_system is None:
                continue

            downstream: list[str] = []
            for dependent_id in current_system.dependents:
                if dependent_id not in visited and dependent_id in self._systems:
                    visited.add(dependent_id)
                    queue.append(dependent_id)
                    downstream.append(dependent_id)

            if downstream:
                impact_map[current_id] = downstream

        return impact_map

    def _calculate_impact_level(self, distance: int, criticality: str) -> str:
        """Determine impact level based on distance and system criticality."""
        if criticality == "critical":
            if distance <= 1:
                return "critical"
            elif distance <= 2:
                return "high"
            else:
                return "medium"
        elif criticality == "high":
            if distance <= 1:
                return "high"
            else:
                return "medium"
        else:
            if distance <= 1:
                return "medium"
            else:
                return "low"
