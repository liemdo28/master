"""Bottleneck Mapping Module - Identifies performance and scalability bottlenecks."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class Bottleneck:
    """Represents a detected bottleneck in the system."""
    location: str
    bottleneck_type: str  # 'queue', 'database', 'network', 'cpu', 'memory', 'io'
    severity: float  # 0.0 to 1.0
    description: str
    metrics: Dict[str, float] = field(default_factory=dict)
    affected_components: List[str] = field(default_factory=list)


@dataclass
class QueueBottleneck:
    """Queue-specific bottleneck information."""
    queue_name: str
    depth: int
    throughput: float
    latency_ms: float
    saturation: float  # 0.0 to 1.0
    backpressure: bool


@dataclass
class ScalingLimit:
    """Identified scaling limitation."""
    component: str
    limit_type: str  # 'vertical', 'horizontal', 'stateless', 'stateful'
    current_capacity: float
    max_capacity: float
    bottleneck_reason: str


@dataclass
class BottleneckReport:
    """Complete bottleneck analysis report."""
    bottlenecks: List[Bottleneck]
    queue_bottlenecks: List[QueueBottleneck]
    scaling_limits: List[ScalingLimit]
    critical_path: List[str] = field(default_factory=list)


class BottleneckMap:
    """Maps and analyzes system bottlenecks and scaling limits."""

    def __init__(self) -> None:
        self._components: Dict[str, Dict] = defaultdict(dict)
        self._queues: Dict[str, Dict] = defaultdict(dict)
        self._limits: Dict[str, Dict] = defaultdict(dict)

    def map_bottlenecks(
        self,
        components: Optional[Dict[str, Dict]] = None,
        metrics: Optional[Dict[str, Dict]] = None
    ) -> BottleneckReport:
        """Perform comprehensive bottleneck mapping across all components."""
        if components:
            for name, config in components.items():
                self._components[name] = config

        if metrics:
            for name, metric_data in metrics.items():
                self._components[name]['metrics'] = metric_data

        bottlenecks = self._analyze_all_bottlenecks()
        queue_bottlenecks = self.find_queue_bottlenecks()
        scaling_limits = self.identify_scaling_limits()

        return BottleneckReport(
            bottlenecks=bottlenecks,
            queue_bottlenecks=queue_bottlenecks,
            scaling_limits=scaling_limits
        )

    def find_queue_bottlenecks(
        self,
        queues: Optional[Dict[str, Dict]] = None
    ) -> List[QueueBottleneck]:
        """Analyze queue-based bottlenecks."""
        if queues:
            for name, config in queues.items():
                self._queues[name] = config

        bottlenecks: List[QueueBottleneck] = []

        for name, config in self._queues.items():
            depth = config.get('depth', 0)
            throughput = config.get('throughput', 0.0)
            latency_ms = config.get('latency_ms', 0.0)
            capacity = config.get('capacity', 100)

            saturation = min(1.0, depth / capacity) if capacity > 0 else 0.0
            backpressure = depth > capacity * 0.8

            if saturation > 0.5 or latency_ms > 100:
                bottlenecks.append(QueueBottleneck(
                    queue_name=name,
                    depth=depth,
                    throughput=throughput,
                    latency_ms=latency_ms,
                    saturation=saturation,
                    backpressure=backpressure
                ))

        return bottlenecks

    def identify_scaling_limits(
        self,
        components: Optional[Dict[str, Dict]] = None
    ) -> List[ScalingLimit]:
        """Identify scaling limitations for each component."""
        if components:
            for name, config in components.items():
                self._components[name] = config

        limits: List[ScalingLimit] = []

        for name, config in self._components.items():
            limit_type = config.get('limit_type', 'vertical')
            current = config.get('current_capacity', 0.0)
            max_cap = config.get('max_capacity', 100.0)
            reason = config.get('bottleneck_reason', 'unknown')

            if current > 0 and max_cap > current:
                limits.append(ScalingLimit(
                    component=name,
                    limit_type=limit_type,
                    current_capacity=current,
                    max_capacity=max_cap,
                    bottleneck_reason=reason
                ))

        return limits

    def add_component(
        self,
        name: str,
        component_type: str,
        metrics: Optional[Dict] = None
    ) -> None:
        """Add a component to track for bottleneck analysis."""
        self._components[name] = {
            'type': component_type,
            'metrics': metrics or {}
        }

    def add_queue(
        self,
        name: str,
        depth: int,
        throughput: float,
        capacity: int = 100
    ) -> None:
        """Add a queue for bottleneck analysis."""
        self._queues[name] = {
            'depth': depth,
            'throughput': throughput,
            'capacity': capacity
        }

    def get_critical_path(self) -> List[str]:
        """Identify the critical path through bottlenecks."""
        path: List[str] = []
        seen: Set[str] = set()

        sorted_bottlenecks = sorted(
            self._components.items(),
            key=lambda x: x[1].get('metrics', {}).get('severity', 0),
            reverse=True
        )

        for name, _ in sorted_bottlenecks:
            if name not in seen:
                path.append(name)
                seen.add(name)

        return path

    def calculate_throughput_ratio(self, component: str) -> float:
        """Calculate throughput ratio for a component."""
        config = self._components.get(component, {})
        current = config.get('metrics', {}).get('throughput', 0.0)
        max_cap = config.get('max_capacity', 100.0)

        if max_cap > 0:
            return min(1.0, current / max_cap)
        return 0.0
