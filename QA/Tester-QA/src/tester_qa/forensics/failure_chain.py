"""Failure Chain - Build and analyze failure causation chains."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class CausationType(Enum):
    DIRECT = "direct"
    INDIRECT = "indirect"
    CASCADING = "cascading"
    SPIKE = "spike"


@dataclass
class FailureNode:
    node_id: str
    component: str
    timestamp: datetime
    error_type: str
    error_message: str
    severity: float
    caused_by: list[str] = field(default_factory=list)
    caused_failures: list[str] = field(default_factory=list)


@dataclass
class FailureLink:
    source_id: str
    target_id: str
    causation_type: CausationType
    delay_ms: float
    propagation_factor: float


@dataclass
class FailureChain:
    chain_id: str
    root_cause: Optional[str]
    nodes: list[FailureNode]
    links: list[FailureLink]
    total_duration_ms: float
    propagation_speed_ms_per_node: float


class FailureCausationAnalyzer:
    """Build and analyze failure causation chains."""

    def __init__(self):
        self.nodes: dict[str, FailureNode] = {}
        self.links: list[FailureLink] = []
        self.chains: list[FailureChain] = []

    def build_failure_chain(
        self, failures: list[dict[str, Any]]
    ) -> FailureChain:
        """Build failure chain from failure events."""
        self.nodes = {}
        self.links = []

        for idx, failure in enumerate(failures):
            node_id = failure.get("node_id", f"node_{idx}")
            node = FailureNode(
                node_id=node_id,
                component=failure.get("component", "unknown"),
                timestamp=datetime.fromisoformat(
                    failure.get("timestamp", datetime.now().isoformat())
                ),
                error_type=failure.get("error_type", "unknown"),
                error_message=failure.get("error_message", ""),
                severity=failure.get("severity", 1.0),
                caused_by=[],
                caused_failures=[],
            )
            self.nodes[node_id] = node

        for idx in range(1, len(failures)):
            prev_id = failures[idx - 1].get("node_id", f"node_{idx - 1}")
            curr_id = failures[idx].get("node_id", f"node_{idx}")
            if prev_id in self.nodes and curr_id in self.nodes:
                prev_ts = self.nodes[prev_id].timestamp
                curr_ts = self.nodes[curr_id].timestamp
                delay_ms = (curr_ts - prev_ts).total_seconds() * 1000
                causation = CausationType.INDIRECT if delay_ms > 100 else CausationType.DIRECT
                self.links.append(
                    FailureLink(
                        source_id=prev_id,
                        target_id=curr_id,
                        causation_type=causation,
                        delay_ms=delay_ms,
                        propagation_factor=1.0,
                    )
                )
                self.nodes[prev_id].caused_failures.append(curr_id)
                self.nodes[curr_id].caused_by.append(prev_id)

        sorted_nodes = sorted(self.nodes.values(), key=lambda n: n.timestamp)
        root_cause = sorted_nodes[0].component if sorted_nodes else None

        total_ms = 0.0
        if sorted_nodes:
            total_ms = (
                sorted_nodes[-1].timestamp - sorted_nodes[0].timestamp
            ).total_seconds() * 1000

        propagation_speed = total_ms / len(sorted_nodes) if sorted_nodes else 0.0

        chain = FailureChain(
            chain_id=f"chain_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            root_cause=root_cause,
            nodes=sorted_nodes,
            links=self.links,
            total_duration_ms=total_ms,
            propagation_speed_ms_per_node=propagation_speed,
        )
        self.chains.append(chain)
        return chain

    def identify_causation(
        self, node_id: str
    ) -> dict[str, list[str]]:
        """Identify causation relationships for a node."""
        node = self.nodes.get(node_id)
        if not node:
            return {"caused_by": [], "caused_failures": []}
        return {
            "caused_by": node.caused_by,
            "caused_failures": node.caused_failures,
        }

    def calculate_propagation_speed(
        self, chain_id: Optional[str] = None
    ) -> float:
        """Calculate propagation speed in ms per node."""
        if chain_id:
            chains = [c for c in self.chains if c.chain_id == chain_id]
        else:
            chains = self.chains

        if not chains:
            return 0.0

        speeds = [c.propagation_speed_ms_per_node for c in chains]
        return sum(speeds) / len(speeds)
