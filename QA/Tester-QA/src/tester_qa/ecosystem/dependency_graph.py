"""Cross-project dependency graph — maps how projects depend on each other."""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class DependencyEdge:
    source: str
    target: str
    dependency_type: str  # runtime | shared-lib | api | websocket | database | cache | auth
    criticality: str = "medium"  # low | medium | high | critical

    def to_dict(self) -> dict[str, Any]:
        return {"source": self.source, "target": self.target, "type": self.dependency_type, "criticality": self.criticality}


@dataclass
class DependencyNode:
    project_id: str
    path: str
    services: list[str] = field(default_factory=list)
    ports: list[int] = field(default_factory=list)
    shared_resources: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {"project_id": self.project_id, "path": self.path, "services": self.services, "ports": self.ports, "shared_resources": self.shared_resources}


class DependencyGraph:
    """Build and analyze cross-project dependency graphs."""

    def __init__(self) -> None:
        self.nodes: dict[str, DependencyNode] = {}
        self.edges: list[DependencyEdge] = []

    def add_project(self, project_id: str, path: str, services: list[str] | None = None, ports: list[int] | None = None) -> None:
        self.nodes[project_id] = DependencyNode(project_id=project_id, path=path, services=services or [], ports=ports or [])

    def add_dependency(self, source: str, target: str, dep_type: str, criticality: str = "medium") -> None:
        self.edges.append(DependencyEdge(source=source, target=target, dependency_type=dep_type, criticality=criticality))

    def build_from_projects(self, projects: list[dict[str, Any]]) -> None:
        """Auto-detect dependencies from indexed project data."""
        for project in projects:
            pid = project.get("name") or project.get("id", "unknown")
            path = project.get("path", "")
            services = [r.get("name", "") for r in project.get("runtimes", [])]
            ports = [r.get("port") for r in project.get("runtimes", []) if r.get("port")]
            self.add_project(pid, path, services, ports)

        # Detect shared ports (potential inter-project communication)
        port_owners: dict[int, list[str]] = {}
        for pid, node in self.nodes.items():
            for port in node.ports:
                port_owners.setdefault(port, []).append(pid)

        # Detect shared infra from project data
        infra_users: dict[str, list[str]] = {}
        for project in projects:
            pid = project.get("name") or project.get("id", "unknown")
            for infra in project.get("infra", []):
                infra_users.setdefault(infra, []).append(pid)

        # Create edges for shared infrastructure
        for infra, users in infra_users.items():
            if len(users) > 1:
                for i, u1 in enumerate(users):
                    for u2 in users[i + 1:]:
                        self.add_dependency(u1, u2, f"shared-{infra}", "high")

    def get_dependents(self, project_id: str) -> list[str]:
        """Get all projects that depend on this project."""
        return [e.source for e in self.edges if e.target == project_id]

    def get_dependencies(self, project_id: str) -> list[str]:
        """Get all projects this project depends on."""
        return [e.target for e in self.edges if e.source == project_id]

    def get_blast_radius(self, project_id: str) -> list[str]:
        """Calculate blast radius — all projects affected if this one fails."""
        affected: set[str] = set()
        queue = [project_id]
        while queue:
            current = queue.pop(0)
            dependents = self.get_dependents(current)
            for dep in dependents:
                if dep not in affected:
                    affected.add(dep)
                    queue.append(dep)
        return sorted(affected)

    def get_critical_paths(self) -> list[list[str]]:
        """Find critical failure paths through the dependency graph."""
        critical_edges = [e for e in self.edges if e.criticality in ("high", "critical")]
        paths: list[list[str]] = []
        for edge in critical_edges:
            path = [edge.source, edge.target]
            # Extend path following critical edges
            current = edge.target
            visited = {edge.source, edge.target}
            while True:
                next_edges = [e for e in critical_edges if e.source == current and e.target not in visited]
                if not next_edges:
                    break
                next_edge = next_edges[0]
                path.append(next_edge.target)
                visited.add(next_edge.target)
                current = next_edge.target
            if len(path) > 2:
                paths.append(path)
        return paths

    def get_fragility_score(self) -> dict[str, Any]:
        """Calculate ecosystem fragility metrics."""
        total_nodes = len(self.nodes)
        total_edges = len(self.edges)
        critical_edges = len([e for e in self.edges if e.criticality in ("high", "critical")])

        # Find single points of failure (nodes with many dependents)
        spof: list[dict[str, Any]] = []
        for pid in self.nodes:
            dependents = self.get_dependents(pid)
            if len(dependents) >= 2:
                spof.append({"project": pid, "dependents": len(dependents), "blast_radius": len(self.get_blast_radius(pid))})

        return {
            "total_projects": total_nodes,
            "total_dependencies": total_edges,
            "critical_dependencies": critical_edges,
            "single_points_of_failure": sorted(spof, key=lambda x: x["blast_radius"], reverse=True),
            "fragility_index": round(critical_edges / max(total_edges, 1) * 100, 1),
            "connectivity_ratio": round(total_edges / max(total_nodes, 1), 2),
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "nodes": {pid: node.to_dict() for pid, node in self.nodes.items()},
            "edges": [e.to_dict() for e in self.edges],
            "fragility": self.get_fragility_score(),
        }
