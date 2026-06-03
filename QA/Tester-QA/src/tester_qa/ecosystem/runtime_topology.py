"""Runtime topology — maps live services, ports, websockets, and connections."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class ServiceNode:
    project_id: str
    service_name: str
    port: int | None = None
    protocol: str = "http"
    connections_to: list[str] = field(default_factory=list)
    health: str = "unknown"

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "service_name": self.service_name,
            "port": self.port,
            "protocol": self.protocol,
            "connections_to": self.connections_to,
            "health": self.health,
        }


class RuntimeTopology:
    """Map the live runtime topology across all projects."""

    def __init__(self) -> None:
        self.services: dict[str, ServiceNode] = {}
        self.websocket_endpoints: list[dict[str, Any]] = []
        self.shared_ports: dict[int, list[str]] = {}
        self.shared_caches: list[str] = []
        self.shared_queues: list[str] = []
        self.shared_databases: list[str] = []

    def add_service(self, project_id: str, name: str, port: int | None = None, protocol: str = "http") -> None:
        key = f"{project_id}:{name}"
        self.services[key] = ServiceNode(project_id=project_id, service_name=name, port=port, protocol=protocol)
        if port:
            self.shared_ports.setdefault(port, []).append(project_id)

    def add_websocket(self, project_id: str, url: str, clients: int = 0) -> None:
        self.websocket_endpoints.append({"project_id": project_id, "url": url, "clients": clients})

    def build_from_projects(self, projects: list[dict[str, Any]]) -> None:
        """Build topology from indexed project data."""
        for project in projects:
            pid = project.get("name") or project.get("id", "unknown")
            for runtime in project.get("runtimes", []):
                self.add_service(pid, runtime.get("name", "unknown"), runtime.get("port"), runtime.get("protocol", "http"))

            # Detect shared infrastructure
            for infra in project.get("infra", []):
                if "redis" in infra:
                    self.shared_caches.append(pid)
                if "rabbitmq" in infra or "kafka" in infra:
                    self.shared_queues.append(pid)
                if "postgres" in infra or "mongo" in infra:
                    self.shared_databases.append(pid)

    def detect_shared_resources(self) -> dict[str, Any]:
        """Identify shared resources that could be single points of failure."""
        port_conflicts = {port: owners for port, owners in self.shared_ports.items() if len(owners) > 1}
        return {
            "port_conflicts": port_conflicts,
            "shared_cache_users": list(set(self.shared_caches)),
            "shared_queue_users": list(set(self.shared_queues)),
            "shared_database_users": list(set(self.shared_databases)),
            "websocket_endpoints": len(self.websocket_endpoints),
            "total_services": len(self.services),
        }

    def get_collapse_candidates(self) -> list[dict[str, Any]]:
        """Identify services whose failure would cascade."""
        candidates: list[dict[str, Any]] = []
        # Shared caches — if Redis goes down, all users affected
        if len(set(self.shared_caches)) > 1:
            candidates.append({
                "resource": "shared-cache",
                "type": "redis",
                "affected_projects": list(set(self.shared_caches)),
                "risk": "critical",
                "scenario": "Cache failure causes all dependent projects to degrade",
            })
        if len(set(self.shared_queues)) > 1:
            candidates.append({
                "resource": "shared-queue",
                "type": "message-broker",
                "affected_projects": list(set(self.shared_queues)),
                "risk": "critical",
                "scenario": "Queue failure causes message loss and retry storms",
            })
        if len(set(self.shared_databases)) > 1:
            candidates.append({
                "resource": "shared-database",
                "type": "database",
                "affected_projects": list(set(self.shared_databases)),
                "risk": "critical",
                "scenario": "Database failure causes total system collapse",
            })
        return candidates

    def to_dict(self) -> dict[str, Any]:
        return {
            "services": {k: v.to_dict() for k, v in self.services.items()},
            "websocket_endpoints": self.websocket_endpoints,
            "shared_resources": self.detect_shared_resources(),
            "collapse_candidates": self.get_collapse_candidates(),
        }
