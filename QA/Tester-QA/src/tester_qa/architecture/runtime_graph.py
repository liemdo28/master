"""Runtime Graph Module - Builds and analyzes runtime dependency graphs."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class RuntimeNode:
    """Represents a node in the runtime dependency graph."""
    id: str
    name: str
    node_type: str  # 'service', 'database', 'cache', 'api', 'queue'
    health: float  # 0.0 to 1.0
    latency_ms: float = 0.0
    calls: int = 0
    failures: int = 0


@dataclass
class RuntimeEdge:
    """Represents a connection between runtime nodes."""
    source: str
    target: str
    calls: int = 0
    failures: int = 0
    avg_latency_ms: float = 0.0
    is_fragile: bool = False


@dataclass
class CouplingInfo:
    """Information about coupling between components."""
    source: str
    target: str
    coupling_strength: float  # 0.0 to 1.0
    coupling_type: str  # 'data', 'temporal', 'control', 'procedural'


@dataclass
class FragileConnection:
    """Represents a fragile or problematic connection."""
    source: str
    target: str
    failure_rate: float
    avg_recovery_time_ms: float
    severity: str  # 'critical', 'high', 'medium', 'low'


@dataclass
class RuntimeGraphReport:
    """Complete runtime graph analysis report."""
    nodes: List[RuntimeNode]
    edges: List[RuntimeEdge]
    couplings: List[CouplingInfo]
    fragile_connections: List[FragileConnection]
    graph_density: float = 0.0


class RuntimeGraph:
    """Builds and analyzes runtime dependency graphs."""

    def __init__(self) -> None:
        self._nodes: Dict[str, RuntimeNode] = {}
        self._edges: Dict[Tuple[str, str], RuntimeEdge] = {}
        self._adjacency: Dict[str, List[str]] = defaultdict(list)
        self._reverse_adjacency: Dict[str, List[str]] = defaultdict(list)

    def build_runtime_graph(
        self,
        nodes: Optional[List[Dict]] = None,
        edges: Optional[List[Dict]] = None
    ) -> RuntimeGraphReport:
        """Build the runtime graph from node and edge data."""
        if nodes:
            for node_data in nodes:
                self.add_node(**node_data)

        if edges:
            for edge_data in edges:
                self.add_edge(**edge_data)

        couplings = self.identify_coupling()
        fragile_connections = self.find_fragile_connections()
        density = self._calculate_graph_density()

        return RuntimeGraphReport(
            nodes=list(self._nodes.values()),
            edges=list(self._edges.values()),
            couplings=couplings,
            fragile_connections=fragile_connections,
            graph_density=density
        )

    def add_node(
        self,
        id: str,
        name: str,
        node_type: str = 'service',
        health: float = 1.0,
        latency_ms: float = 0.0
    ) -> None:
        """Add a node to the runtime graph."""
        self._nodes[id] = RuntimeNode(
            id=id,
            name=name,
            node_type=node_type,
            health=health,
            latency_ms=latency_ms
        )

    def add_edge(
        self,
        source: str,
        target: str,
        calls: int = 0,
        failures: int = 0,
        avg_latency_ms: float = 0.0
    ) -> None:
        """Add an edge to the runtime graph."""
        key = (source, target)
        self._edges[key] = RuntimeEdge(
            source=source,
            target=target,
            calls=calls,
            failures=failures,
            avg_latency_ms=avg_latency_ms
        )
        self._adjacency[source].append(target)
        self._reverse_adjacency[target].append(source)

    def identify_coupling(
        self,
        threshold: float = 0.5
    ) -> List[CouplingInfo]:
        """Identify and measure coupling between components."""
        couplings: List[CouplingInfo] = []

        for (source, target), edge in self._edges.items():
            if source not in self._nodes or target not in self._nodes:
                continue

            source_node = self._nodes[source]
            target_node = self._nodes[target]

            call_frequency = edge.calls / max(1, source_node.calls)
            failure_impact = edge.failures / max(1, source_node.calls)
            latency_impact = edge.avg_latency_ms / max(1, target_node.latency_ms)

            coupling_strength = min(1.0, (
                call_frequency * 0.4 +
                failure_impact * 0.3 +
                latency_impact * 0.3
            ))

            if coupling_strength >= threshold:
                coupling_type = self._determine_coupling_type(
                    source_node, target_node, edge
                )
                couplings.append(CouplingInfo(
                    source=source,
                    target=target,
                    coupling_strength=coupling_strength,
                    coupling_type=coupling_type
                ))

        return couplings

    def find_fragile_connections(
        self,
        failure_threshold: float = 0.05
    ) -> List[FragileConnection]:
        """Find connections that are fragile or prone to failure."""
        fragile: List[FragileConnection] = []

        for (source, target), edge in self._edges.items():
            if source not in self._nodes:
                continue

            total_calls = self._nodes[source].calls
            if total_calls == 0:
                continue

            failure_rate = edge.failures / total_calls

            if failure_rate >= failure_threshold:
                severity = self._calculate_severity(failure_rate)
                fragile.append(FragileConnection(
                    source=source,
                    target=target,
                    failure_rate=failure_rate,
                    avg_recovery_time_ms=edge.avg_latency_ms * 2,
                    severity=severity
                ))

        return fragile

    def _determine_coupling_type(
        self,
        source: RuntimeNode,
        target: RuntimeNode,
        edge: RuntimeEdge
    ) -> str:
        """Determine the type of coupling between two nodes."""
        if edge.calls > 1000:
            return 'data'
        elif edge.avg_latency_ms > 100:
            return 'temporal'
        elif edge.failures > 0:
            return 'control'
        return 'procedural'

    def _calculate_severity(self, failure_rate: float) -> str:
        """Calculate severity based on failure rate."""
        if failure_rate >= 0.2:
            return 'critical'
        elif failure_rate >= 0.1:
            return 'high'
        elif failure_rate >= 0.05:
            return 'medium'
        return 'low'

    def _calculate_graph_density(self) -> float:
        """Calculate the density of the graph."""
        n = len(self._nodes)
        if n <= 1:
            return 0.0
        max_edges = n * (n - 1)
        return len(self._edges) / max_edges if max_edges > 0 else 0.0

    def get_connected_components(self) -> List[Set[str]]:
        """Find all connected components in the graph."""
        visited: Set[str] = set()
        components: List[Set[str]] = []

        for node_id in self._nodes:
            if node_id not in visited:
                component = self._bfs_component(node_id, visited)
                components.append(component)

        return components

    def _bfs_component(self, start: str, visited: Set[str]) -> Set[str]:
        """BFS to find all nodes in a connected component."""
        component: Set[str] = set()
        queue = deque([start])

        while queue:
            node = queue.popleft()
            if node in visited:
                continue
            visited.add(node)
            component.add(node)

            for neighbor in self._adjacency[node]:
                if neighbor not in visited:
                    queue.append(neighbor)
            for neighbor in self._reverse_adjacency[node]:
                if neighbor not in visited:
                    queue.append(neighbor)

        return component
