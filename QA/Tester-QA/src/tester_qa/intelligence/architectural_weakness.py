"""Architectural Weakness Detection Module"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class Dependency:
    """Represents a dependency between components."""
    source: str
    target: str
    dependency_type: str  # "direct", "transitive", "optional"


@dataclass
class CircularDependency:
    """Represents a detected circular dependency."""
    components: List[str]
    cycle_length: int


@dataclass
class WeaknessReport:
    """Report of detected architectural weaknesses."""
    single_points_of_failure: List[str] = field(default_factory=list)
    circular_dependencies: List[CircularDependency] = field(default_factory=list)
    coupling_score: float = 0.0
    total_components: int = 0
    total_dependencies: int = 0


class ArchitecturalWeaknessDetector:
    """Detects architectural weaknesses in system design including dependencies."""

    def __init__(self):
        self._dependencies: Dict[str, List[str]] = {}
        self._dependency_types: Dict[str, Dict[str, str]] = {}

    def add_dependency(self, source: str, target: str, dep_type: str = "direct") -> None:
        """Add a dependency between two components."""
        if source not in self._dependencies:
            self._dependencies[source] = []
        if target not in self._dependencies[source]:
            self._dependencies[source].append(target)

        if source not in self._dependency_types:
            self._dependency_types[source] = {}
        self._dependency_types[source][target] = dep_type

    def clear_dependencies(self) -> None:
        """Clear all tracked dependencies."""
        self._dependencies = {}
        self._dependency_types = {}

    def analyze_dependencies(self, root_components: Optional[List[str]] = None) -> Dict[str, List[str]]:
        """Analyze dependencies and return dependency graph."""
        if root_components is None:
            return dict(self._dependencies)

        # Filter to only include specified root components
        filtered: Dict[str, List[str]] = {}
        for comp in root_components:
            if comp in self._dependencies:
                filtered[comp] = self._dependencies[comp]
            else:
                filtered[comp] = []
        return filtered

    def find_single_points_of_failure(
        self, critical_services: Optional[List[str]] = None
    ) -> List[str]:
        """Find components that are single points of failure (no redundancy)."""
        if critical_services is None:
            critical_services = list(self._dependencies.keys())

        spof: List[str] = []
        # Build reverse dependency map (who depends on whom)
        dependents: Dict[str, List[str]] = {}
        for source, targets in self._dependencies.items():
            for target in targets:
                if target not in dependents:
                    dependents[target] = []
                dependents[target].append(source)

        # A component is an SPOF if:
        # 1. Others depend on it
        # 2. It has no redundant implementations
        # 3. Its failure would affect critical services
        for comp in self._dependencies.keys():
            if comp in dependents and len(dependents[comp]) > 0:
                # Check if there are alternative implementations
                # (simplified: assume no alternatives if only direct dependencies)
                has_alternatives = False
                for other_comp in self._dependencies.keys():
                    if other_comp != comp:
                        # Check if other_comp provides similar functionality
                        if other_comp.startswith(comp.split("_")[0] + "_"):
                            has_alternatives = True
                            break

                if not has_alternatives:
                    spof.append(comp)

        return spof

    def detect_circular_deps(self) -> List[CircularDependency]:
        """Detect circular dependencies in the dependency graph using DFS."""
        circular_deps: List[CircularDependency] = []
        visited: Set[str] = set()
        rec_stack: Set[str] = set()
        path: List[str] = []

        def dfs(node: str) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            if node in self._dependencies:
                for neighbor in self._dependencies[node]:
                    if neighbor not in visited:
                        dfs(neighbor)
                    elif neighbor in rec_stack:
                        # Found a cycle
                        cycle_start = path.index(neighbor)
                        cycle = path[cycle_start:] + [neighbor]
                        circular_deps.append(
                            CircularDependency(
                                components=cycle,
                                cycle_length=len(cycle) - 1,
                            )
                        )

            path.pop()
            rec_stack.remove(node)

        for node in self._dependencies:
            if node not in visited:
                dfs(node)

        return circular_deps

    def calculate_coupling_score(self) -> float:
        """Calculate a coupling score between 0.0 (decoupled) and 1.0 (highly coupled)."""
        if not self._dependencies:
            return 0.0

        total_components = len(self._dependencies)
        total_dependencies = sum(len(deps) for deps in self._dependencies.values())

        # Maximum possible dependencies (complete graph)
        max_dependencies = total_components * (total_components - 1)

        if max_dependencies == 0:
            return 0.0

        # Actual coupling ratio
        base_coupling = total_dependencies / max_dependencies

        # Penalize circular dependencies
        circular = self.detect_circular_deps()
        circular_penalty = min(0.3, len(circular) * 0.05)

        # Penalize deep dependency chains (transitive dependencies)
        transitive_penalty = 0.0
        for source, targets in self._dependency_types.items():
            for target, dep_type in targets.items():
                if dep_type == "transitive":
                    transitive_penalty += 0.02

        # Calculate final score
        score = base_coupling + circular_penalty + transitive_penalty
        return min(1.0, max(0.0, score))

    def get_weakness_report(self) -> WeaknessReport:
        """Generate a comprehensive weakness report."""
        spof = self.find_single_points_of_failure()
        circular = self.detect_circular_deps()
        coupling = self.calculate_coupling_score()

        return WeaknessReport(
            single_points_of_failure=spof,
            circular_dependencies=circular,
            coupling_score=coupling,
            total_components=len(self._dependencies),
            total_dependencies=sum(len(d) for d in self._dependencies.values()),
        )
