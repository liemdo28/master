"""Dependency Interrogation Module - Analyzes package and module dependencies."""

from __future__ import annotations

import re
from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class DependencyNode:
    """Represents a dependency node in the dependency graph."""
    name: str
    version: str
    path: Optional[str] = None
    is_dev: bool = False
    is_optional: bool = False


@dataclass
class CircularDependency:
    """Represents a circular dependency cycle."""
    cycle: List[str]
    depth: int


@dataclass
class VersionConflict:
    """Represents a version conflict between dependencies."""
    package: str
    required_by: List[str]
    conflicting_versions: List[str]
    severity: str  # 'high', 'medium', 'low'


@dataclass
class DependencyReport:
    """Complete report of dependency analysis."""
    total_dependencies: int
    direct_deps: int
    transitive_deps: int
    circular_deps: List[CircularDependency]
    version_conflicts: List[VersionConflict]
    dependency_graph: Dict[str, List[str]] = field(default_factory=dict)


class DependencyInterrogation:
    """Interrogates project dependencies for structural issues."""

    def __init__(self, project_root: Optional[str] = None) -> None:
        self.project_root = project_root
        self._graph: Dict[str, List[str]] = defaultdict(list)
        self._versions: Dict[str, str] = {}
        self._reverse_graph: Dict[str, List[str]] = defaultdict(list)

    def interrogate_dependencies(
        self,
        dependencies: Optional[Dict[str, str]] = None,
        transitive: Optional[Dict[str, List[str]]] = None
    ) -> DependencyReport:
        """Perform full dependency interrogation and analysis."""
        if dependencies:
            for name, version in dependencies.items():
                self._add_dependency(name, version)

        if transitive:
            for parent, children in transitive.items():
                for child in children:
                    self._graph[parent].append(child)
                    self._reverse_graph[child].append(parent)

        circular_deps = self.find_circular_deps()
        version_conflicts = self.identify_version_conflicts()

        direct_count = len(dependencies) if dependencies else 0
        transitive_count = sum(len(v) for v in (transitive or {}).values())

        return DependencyReport(
            total_dependencies=direct_count + transitive_count,
            direct_deps=direct_count,
            transitive_deps=transitive_count,
            circular_deps=circular_deps,
            version_conflicts=version_conflicts,
            dependency_graph=dict(self._graph)
        )

    def find_circular_deps(self) -> List[CircularDependency]:
        """Detect all circular dependency cycles in the dependency graph."""
        cycles: List[CircularDependency] = []
        visited: Set[str] = set()
        rec_stack: Set[str] = set()

        def dfs(node: str, path: List[str]) -> None:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in self._graph.get(node, []):
                if neighbor not in visited:
                    dfs(neighbor, path)
                elif neighbor in rec_stack:
                    cycle_start = path.index(neighbor)
                    cycle = path[cycle_start:] + [neighbor]
                    cycles.append(CircularDependency(
                        cycle=cycle,
                        depth=len(cycle) - 1
                    ))

            path.pop()
            rec_stack.remove(node)

        for node in self._graph:
            if node not in visited:
                dfs(node, [])

        return cycles

    def identify_version_conflicts(self) -> List[VersionConflict]:
        """Identify version conflicts between transitive dependencies."""
        conflicts: List[VersionConflict] = []
        version_map: Dict[str, List[Tuple[str, str]]] = defaultdict(list)

        for pkg, version in self._versions.items():
            for dep, deps_list in self._graph.items():
                if pkg in deps_list:
                    version_map[pkg].append((dep, version))

        for pkg, reqs in version_map.items():
            versions = list(set(v for _, v in reqs))
            if len(versions) > 1:
                required_by = list(set(r for r, _ in reqs))
                severity = self._calculate_conflict_severity(versions)
                conflicts.append(VersionConflict(
                    package=pkg,
                    required_by=required_by,
                    conflicting_versions=versions,
                    severity=severity
                ))

        return conflicts

    def _add_dependency(self, name: str, version: str) -> None:
        """Add a dependency to the internal tracking."""
        self._versions[name] = version

    def _calculate_conflict_severity(self, versions: List[str]) -> str:
        """Calculate the severity of a version conflict."""
        if len(versions) > 3:
            return 'high'
        elif len(versions) > 1:
            return 'medium'
        return 'low'

    def add_dependency(self, name: str, version: str) -> None:
        """Public method to add a single dependency."""
        self._add_dependency(name, version)

    def add_transitive_deps(self, parent: str, children: List[str]) -> None:
        """Public method to add transitive dependencies."""
        for child in children:
            self._graph[parent].append(child)
            self._reverse_graph[child].append(parent)

    def get_dependency_tree(self, root: str, depth: int = 3) -> Dict:
        """Get a formatted dependency tree starting from a root."""
        result: Dict = {'name': root, 'children': []}
        self._build_tree(root, result, 0, depth, set())
        return result

    def _build_tree(
        self,
        node: str,
        result: Dict,
        current_depth: int,
        max_depth: int,
        seen: Set[str]
    ) -> None:
        """Recursively build the dependency tree."""
        if current_depth >= max_depth or node in seen:
            return
        seen.add(node)

        for child in self._graph.get(node, []):
            child_node: Dict = {'name': child, 'children': []}
            result['children'].append(child_node)
            self._build_tree(child, child_node, current_depth + 1, max_depth, seen)
