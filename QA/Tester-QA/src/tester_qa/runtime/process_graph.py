from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ProcessNode:
    node_id: str
    name: str
    parent_id: Optional[str] = None
    children: list[str] = field(default_factory=list)
    metadata: dict[str, object] = field(default_factory=dict)


@dataclass
class ProcessGraph:
    nodes: dict[str, ProcessNode] = field(default_factory=dict)
    edges: list[tuple[str, str]] = field(default_factory=list)


@dataclass
class OrphanNode:
    node_id: str
    name: str
    depth: int
    metadata: dict[str, object]


@dataclass
class CycleInfo:
    cycle_nodes: list[str]
    cycle_length: int


class ProcessGraphBuilder:
    """Builds and analyzes process hierarchy graphs."""

    def __init__(self) -> None:
        self._graph = ProcessGraph()

    def build_graph(self, processes: list[dict[str, object]]) -> ProcessGraph:
        """Build a process hierarchy graph from a list of process descriptors."""
        self._graph = ProcessGraph()
        self._graph.nodes = {}
        self._graph.edges = []

        for proc in processes:
            node_id = str(proc.get("pid", proc.get("id", "")))
            name = str(proc.get("name", "unknown"))
            parent_id = proc.get("parent_pid")

            parent_id_str = str(parent_id) if parent_id is not None else None

            node = ProcessNode(
                node_id=node_id,
                name=name,
                parent_id=parent_id_str,
                children=[],
                metadata={k: v for k, v in proc.items() if k not in ("pid", "id", "name", "parent_pid")},
            )
            self._graph.nodes[node_id] = node

        for node_id, node in self._graph.nodes.items():
            if node.parent_id and node.parent_id in self._graph.nodes:
                parent = self._graph.nodes[node.parent_id]
                parent.children.append(node_id)
                self._graph.edges.append((node.parent_id, node_id))

        return self._graph

    def find_orphans(self) -> list[OrphanNode]:
        """Find root-level or disconnected nodes with no parent in the graph."""
        orphans: list[OrphanNode] = []

        for node_id, node in self._graph.nodes.items():
            if node.parent_id is None or node.parent_id not in self._graph.nodes:
                depth = self._calculate_depth(node_id)
                orphans.append(OrphanNode(
                    node_id=node_id,
                    name=node.name,
                    depth=depth,
                    metadata=node.metadata,
                ))

        return orphans

    def detect_cycles(self) -> list[CycleInfo]:
        """Detect cycles in the process graph using DFS."""
        cycles: list[CycleInfo] = []
        visited: dict[str, int] = {}

        WHITE, GRAY, BLACK = 0, 1, 2

        def dfs(node_id: str, color: dict[str, int], path: list[str]) -> None:
            color[node_id] = GRAY
            path.append(node_id)

            node = self._graph.nodes.get(node_id)
            if node:
                for child_id in node.children:
                    if child_id not in color:
                        dfs(child_id, color, path)
                    elif color.get(child_id, WHITE) == GRAY:
                        cycle_start = path.index(child_id)
                        cycle_nodes = path[cycle_start:]
                        cycles.append(CycleInfo(
                            cycle_nodes=cycle_nodes,
                            cycle_length=len(cycle_nodes),
                        ))

            path.pop()
            color[node_id] = BLACK

        for node_id in self._graph.nodes:
            if node_id not in visited:
                dfs(node_id, visited, [])

        return cycles

    def visualize(self, format: str = "dict") -> dict[str, object]:
        """Return a representation of the graph for visualization."""
        if format == "dict":
            return {
                "nodes": [
                    {
                        "id": node.node_id,
                        "label": node.name,
                        "parent": node.parent_id,
                        **node.metadata,
                    }
                    for node in self._graph.nodes.values()
                ],
                "edges": [
                    {"from": src, "to": dst}
                    for src, dst in self._graph.edges
                ],
            }

        if format == "dot":
            lines = ["digraph process_graph {", "  rankdir=TB;"]
            for node_id, node in self._graph.nodes.items():
                label = node.name.replace('"', '\\"')
                lines.append(f'  "{node_id}" [label="{label}"];')
            for src, dst in self._graph.edges:
                lines.append(f'  "{src}" -> "{dst}";')
            lines.append("}")
            return {"dot": "\n".join(lines)}

        return {"error": f"Unsupported format: {format}"}

    def _calculate_depth(self, node_id: str) -> int:
        """Calculate the depth of a node from the root."""
        depth = 0
        current_id: Optional[str] = node_id
        visited: set[str] = set()

        while current_id and current_id not in visited:
            visited.add(current_id)
            node = self._graph.nodes.get(current_id)
            if node is None or node.parent_id is None or node.parent_id not in self._graph.nodes:
                break
            current_id = node.parent_id
            depth += 1

        return depth

    def get_subtree_size(self, node_id: str) -> int:
        """Return the total number of nodes in a subtree rooted at node_id."""
        if node_id not in self._graph.nodes:
            return 0

        queue = deque([node_id])
        count = 0

        while queue:
            current = queue.popleft()
            count += 1
            node = self._graph.nodes.get(current)
            if node:
                queue.extend(node.children)

        return count
