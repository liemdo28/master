"""Ecosystem Digital Twin — model the entire runtime without touching production."""
from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class RuntimeNode:
    """A node in the digital twin representing a service/component."""
    name: str
    node_type: str  # service | websocket | provider | queue | cache | database | browser
    health: float = 1.0  # 0.0 = dead, 1.0 = healthy
    load: float = 0.0  # 0.0 = idle, 1.0 = saturated
    connections: list[str] = field(default_factory=list)
    metrics: dict[str, float] = field(default_factory=dict)

    def degrade(self, amount: float) -> None:
        self.health = max(0.0, self.health - amount)

    def apply_load(self, amount: float) -> None:
        self.load = min(1.0, self.load + amount)
        if self.load > 0.8:
            self.degrade(0.05 * (self.load - 0.8) * 10)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "type": self.node_type,
            "health": round(self.health, 3),
            "load": round(self.load, 3),
            "connections": self.connections,
            "metrics": self.metrics,
            "status": "healthy" if self.health > 0.7 else "degraded" if self.health > 0.3 else "critical" if self.health > 0 else "dead",
        }


class EcosystemModel:
    """Digital twin of the engineering ecosystem for simulation."""

    def __init__(self) -> None:
        self.nodes: dict[str, RuntimeNode] = {}
        self.tick_count: int = 0
        self.history: list[dict[str, Any]] = []

    def add_node(self, name: str, node_type: str, connections: list[str] | None = None) -> None:
        self.nodes[name] = RuntimeNode(name=name, node_type=node_type, connections=connections or [])

    def build_from_projects(self, projects: list[dict[str, Any]]) -> None:
        """Build digital twin from indexed project data."""
        for project in projects:
            pid = project.get("name") or project.get("id", "unknown")
            self.add_node(pid, "service")

            for runtime in project.get("runtimes", []):
                rt_name = f"{pid}:{runtime.get('name', 'unknown')}"
                self.add_node(rt_name, "service", [pid])

            for infra in project.get("infra", []):
                if infra not in self.nodes:
                    self.add_node(infra, self._infra_type(infra))
                if infra not in self.nodes[pid].connections:
                    self.nodes[pid].connections.append(infra)

    def inject_failure(self, node_name: str, severity: float = 0.5) -> dict[str, Any]:
        """Inject a failure into a node and observe propagation."""
        if node_name not in self.nodes:
            return {"error": f"Node {node_name} not found"}

        self.nodes[node_name].degrade(severity)
        propagation = self._propagate_failure(node_name, severity)

        return {
            "injected_at": node_name,
            "severity": severity,
            "propagation": propagation,
            "ecosystem_state": self.get_state(),
        }

    def simulate_load(self, node_name: str, load: float = 0.5) -> dict[str, Any]:
        """Apply load to a node and observe cascading effects."""
        if node_name not in self.nodes:
            return {"error": f"Node {node_name} not found"}

        self.nodes[node_name].apply_load(load)
        cascades = self._cascade_load(node_name, load * 0.6)

        return {
            "loaded_node": node_name,
            "applied_load": load,
            "cascades": cascades,
            "ecosystem_state": self.get_state(),
        }

    def run_scenario(self, scenario: str, intensity: float = 0.7) -> dict[str, Any]:
        """Run a predefined collapse scenario on the digital twin."""
        scenarios = {
            "provider_degradation": self._scenario_provider_degradation,
            "websocket_instability": self._scenario_websocket_instability,
            "memory_fragmentation": self._scenario_memory_fragmentation,
            "queue_starvation": self._scenario_queue_starvation,
            "distributed_retry_storm": self._scenario_retry_storm,
            "cascade_collapse": self._scenario_cascade_collapse,
        }

        handler = scenarios.get(scenario)
        if not handler:
            return {"error": f"Unknown scenario: {scenario}", "available": list(scenarios.keys())}

        return handler(intensity)

    def get_state(self) -> dict[str, Any]:
        """Get current ecosystem state."""
        nodes_state = {name: node.to_dict() for name, node in self.nodes.items()}
        healthy = sum(1 for n in self.nodes.values() if n.health > 0.7)
        degraded = sum(1 for n in self.nodes.values() if 0.3 < n.health <= 0.7)
        critical = sum(1 for n in self.nodes.values() if 0 < n.health <= 0.3)
        dead = sum(1 for n in self.nodes.values() if n.health == 0)

        return {
            "total_nodes": len(self.nodes),
            "healthy": healthy,
            "degraded": degraded,
            "critical": critical,
            "dead": dead,
            "overall_health": round(sum(n.health for n in self.nodes.values()) / max(len(self.nodes), 1), 3),
            "nodes": nodes_state,
        }

    def get_fragility_heatmap(self) -> list[dict[str, Any]]:
        """Generate fragility heatmap — which nodes are most vulnerable."""
        heatmap: list[dict[str, Any]] = []
        for name, node in self.nodes.items():
            # Fragility = how many other nodes depend on this one
            dependents = sum(1 for n in self.nodes.values() if name in n.connections)
            fragility = dependents * (1 - node.health) + node.load * 0.5
            heatmap.append({
                "node": name,
                "fragility_score": round(fragility, 3),
                "health": round(node.health, 3),
                "load": round(node.load, 3),
                "dependents": dependents,
                "risk": "critical" if fragility > 2 else "high" if fragility > 1 else "medium" if fragility > 0.5 else "low",
            })
        return sorted(heatmap, key=lambda x: x["fragility_score"], reverse=True)

    def get_projected_collapse_path(self) -> list[str]:
        """Project the most likely collapse path."""
        heatmap = self.get_fragility_heatmap()
        if not heatmap:
            return []
        # Start from most fragile node
        path = [heatmap[0]["node"]]
        visited = {path[0]}
        current = path[0]
        for _ in range(min(5, len(self.nodes))):
            node = self.nodes.get(current)
            if not node:
                break
            # Find connected nodes sorted by fragility
            connected = [n for n in node.connections if n not in visited and n in self.nodes]
            if not connected:
                break
            # Pick most fragile connected node
            next_node = max(connected, key=lambda n: 1 - self.nodes[n].health + self.nodes[n].load)
            path.append(next_node)
            visited.add(next_node)
            current = next_node
        return path

    def reset(self) -> None:
        """Reset all nodes to healthy state."""
        for node in self.nodes.values():
            node.health = 1.0
            node.load = 0.0
            node.metrics = {}

    def _propagate_failure(self, origin: str, severity: float) -> list[dict[str, Any]]:
        """Propagate failure through connected nodes."""
        propagation: list[dict[str, Any]] = []
        visited = {origin}
        queue = [(origin, severity)]

        while queue:
            current, sev = queue.pop(0)
            # Find nodes connected to current
            for name, node in self.nodes.items():
                if name not in visited and current in node.connections:
                    cascade_sev = sev * 0.6 * random.uniform(0.5, 1.0)
                    if cascade_sev > 0.05:
                        node.degrade(cascade_sev)
                        visited.add(name)
                        propagation.append({"node": name, "degradation": round(cascade_sev, 3), "from": current})
                        queue.append((name, cascade_sev))

        return propagation

    def _cascade_load(self, origin: str, load: float) -> list[dict[str, Any]]:
        """Cascade load through connected nodes."""
        cascades: list[dict[str, Any]] = []
        for name, node in self.nodes.items():
            if origin in node.connections and name != origin:
                cascade_load = load * random.uniform(0.3, 0.7)
                node.apply_load(cascade_load)
                cascades.append({"node": name, "load_added": round(cascade_load, 3)})
        return cascades

    def _scenario_provider_degradation(self, intensity: float) -> dict[str, Any]:
        providers = [n for n, node in self.nodes.items() if node.node_type == "provider"]
        for p in providers:
            self.nodes[p].degrade(intensity * 0.7)
        return {"scenario": "provider_degradation", "affected": providers, "state": self.get_state()}

    def _scenario_websocket_instability(self, intensity: float) -> dict[str, Any]:
        ws_nodes = [n for n, node in self.nodes.items() if "websocket" in node.node_type or "ws" in n.lower()]
        for ws in ws_nodes:
            self.nodes[ws].degrade(intensity * 0.8)
            self.nodes[ws].apply_load(intensity * 0.5)
        return {"scenario": "websocket_instability", "affected": ws_nodes, "state": self.get_state()}

    def _scenario_memory_fragmentation(self, intensity: float) -> dict[str, Any]:
        services = [n for n, node in self.nodes.items() if node.node_type == "service"]
        for s in services:
            self.nodes[s].apply_load(intensity * 0.4)
            self.nodes[s].metrics["memory_pressure"] = intensity
        return {"scenario": "memory_fragmentation", "affected": services, "state": self.get_state()}

    def _scenario_queue_starvation(self, intensity: float) -> dict[str, Any]:
        queues = [n for n, node in self.nodes.items() if node.node_type in ("queue", "cache")]
        for q in queues:
            self.nodes[q].apply_load(intensity * 0.9)
            self.nodes[q].degrade(intensity * 0.3)
        return {"scenario": "queue_starvation", "affected": queues, "state": self.get_state()}

    def _scenario_retry_storm(self, intensity: float) -> dict[str, Any]:
        all_nodes = list(self.nodes.keys())
        affected = random.sample(all_nodes, min(3, len(all_nodes)))
        for n in affected:
            self.nodes[n].apply_load(intensity * 0.7)
            self.nodes[n].metrics["retry_amplification"] = intensity * 10
        return {"scenario": "distributed_retry_storm", "affected": affected, "state": self.get_state()}

    def _scenario_cascade_collapse(self, intensity: float) -> dict[str, Any]:
        heatmap = self.get_fragility_heatmap()
        if heatmap:
            origin = heatmap[0]["node"]
            self.inject_failure(origin, intensity)
        return {"scenario": "cascade_collapse", "origin": heatmap[0]["node"] if heatmap else None, "state": self.get_state()}

    def _infra_type(self, infra: str) -> str:
        if "redis" in infra:
            return "cache"
        if "postgres" in infra or "mongo" in infra:
            return "database"
        if "rabbit" in infra or "kafka" in infra:
            return "queue"
        return "infra"
