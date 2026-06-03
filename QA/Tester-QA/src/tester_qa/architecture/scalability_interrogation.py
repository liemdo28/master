"""Scalability Interrogation Module - Analyzes system scalability characteristics."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ScalabilityBottleneck:
    """Represents a scalability bottleneck in the system."""
    component: str
    bottleneck_type: str  # 'vertical', 'horizontal', 'database', 'network', 'state'
    current_capacity: float
    max_capacity: float
    utilization_percent: float
    estimated_growth_rate: float  # percent per month
    time_to_limit_months: int
    recommended_action: str


@dataclass
class HorizontalLimit:
    """Represents horizontal scaling limits."""
    component: str
    supports_horizontal: bool
    current_instances: int
    max_instances: int
    scaling_blockers: List[str] = field(default_factory=list)
    cost_per_instance: float = 0.0


@dataclass
class ScalabilityReport:
    """Complete scalability analysis report."""
    bottlenecks: List[ScalabilityBottleneck]
    horizontal_limits: List[HorizontalLimit]
    scalability_score: float  # 0.0 to 1.0
    recommended_scaling_strategy: str
    estimated_cost_increase_per_10x: float  # percent


class ScalabilityInterrogation:
    """Interrogates system scalability and identifies bottlenecks."""

    def __init__(self) -> None:
        self._components: Dict[str, Dict] = {}
        self._metrics: Dict[str, Dict] = {}

    def interrogate_scalability(
        self,
        components: Optional[Dict[str, Dict]] = None,
        metrics: Optional[Dict[str, Dict]] = None
    ) -> ScalabilityReport:
        """Perform comprehensive scalability analysis."""
        if components:
            for name, config in components.items():
                self._components[name] = config

        if metrics:
            for name, metric_data in metrics.items():
                self._metrics[name] = metric_data

        bottlenecks = self.identify_scaling_bottlenecks()
        horizontal_limits = self.measure_horizontal_limits()

        score = self._calculate_scalability_score(bottlenecks, horizontal_limits)
        strategy = self._determine_scaling_strategy(bottlenecks, horizontal_limits)
        cost = self._estimate_cost_increase(bottlenecks)

        return ScalabilityReport(
            bottlenecks=bottlenecks,
            horizontal_limits=horizontal_limits,
            scalability_score=score,
            recommended_scaling_strategy=strategy,
            estimated_cost_increase_per_10x=cost
        )

    def identify_scaling_bottlenecks(
        self,
        components: Optional[Dict[str, Dict]] = None
    ) -> List[ScalabilityBottleneck]:
        """Identify bottlenecks that limit scalability."""
        if components:
            for name, config in components.items():
                self._components[name] = config

        bottlenecks: List[ScalabilityBottleneck] = []

        for name, config in self._components.items():
            current = config.get('current_load', 0.0)
            max_cap = config.get('max_capacity', 100.0)
            growth = config.get('growth_rate', 0.1)

            if max_cap > 0:
                utilization = (current / max_cap) * 100
                months_to_limit = self._calculate_months_to_limit(
                    current, max_cap, growth
                )

                if utilization > 70 or months_to_limit <= 6:
                    bottlenecks.append(ScalabilityBottleneck(
                        component=name,
                        bottleneck_type=config.get('bottleneck_type', 'vertical'),
                        current_capacity=current,
                        max_capacity=max_cap,
                        utilization_percent=utilization,
                        estimated_growth_rate=growth,
                        time_to_limit_months=months_to_limit,
                        recommended_action=self._suggest_action(
                            config.get('bottleneck_type', 'vertical'),
                            utilization
                        )
                    ))

        return bottlenecks

    def measure_horizontal_limits(
        self,
        components: Optional[Dict[str, Dict]] = None
    ) -> List[HorizontalLimit]:
        """Measure horizontal scaling limits for each component."""
        if components:
            for name, config in components.items():
                self._components[name] = config

        limits: List[HorizontalLimit] = []

        for name, config in self._components.items():
            supports_horizontal = config.get('supports_horizontal', True)
            current_instances = config.get('instances', 1)
            max_instances = config.get('max_instances', 10)

            blockers = self._identify_scaling_blockers(name, config)

            limits.append(HorizontalLimit(
                component=name,
                supports_horizontal=supports_horizontal,
                current_instances=current_instances,
                max_instances=max_instances,
                scaling_blockers=blockers,
                cost_per_instance=config.get('cost_per_instance', 0.0)
            ))

        return limits

    def _calculate_months_to_limit(
        self,
        current: float,
        max_cap: float,
        growth_rate: float
    ) -> int:
        """Calculate estimated months until capacity is reached."""
        if growth_rate <= 0 or current >= max_cap:
            return 0

        months = 0
        load = current
        while load < max_cap and months < 60:
            load *= (1 + growth_rate)
            months += 1

        return months

    def _suggest_action(self, bottleneck_type: str, utilization: float) -> str:
        """Suggest action based on bottleneck type and utilization."""
        if utilization > 90:
            return "Immediate scaling required"
        elif utilization > 70:
            actions = {
                'vertical': "Plan vertical scaling within 30 days",
                'horizontal': "Enable horizontal scaling or add instances",
                'database': "Implement database sharding or read replicas",
                'network': "Increase bandwidth or use CDN",
                'state': "Move to stateless architecture or use distributed cache"
            }
            return actions.get(bottleneck_type, "Review and optimize")
        return "Monitor closely"

    def _identify_scaling_blockers(self, name: str, config: Dict) -> List[str]:
        """Identify what prevents horizontal scaling."""
        blockers: List[str] = []

        if not config.get('supports_horizontal', True):
            blockers.append("Architecture does not support horizontal scaling")

        if config.get('has_local_state', False):
            blockers.append("Component has local state preventing distribution")

        if config.get('requires_ordered_processing', False):
            blockers.append("Ordered processing required, limits parallelism")

        if config.get('database_dependency', False):
            blockers.append("Database becomes bottleneck under horizontal scaling")

        return blockers

    def _calculate_scalability_score(
        self,
        bottlenecks: List[ScalabilityBottleneck],
        limits: List[HorizontalLimit]
    ) -> float:
        """Calculate overall scalability score."""
        if not bottlenecks and not limits:
            return 1.0

        score = 1.0

        for bottleneck in bottlenecks:
            if bottleneck.time_to_limit_months < 3:
                score -= 0.3
            elif bottleneck.time_to_limit_months < 6:
                score -= 0.2
            elif bottleneck.utilization_percent > 80:
                score -= 0.15

        blocked_count = sum(
            1 for limit in limits
            if not limit.supports_horizontal or limit.scaling_blockers
        )
        score -= (blocked_count / max(1, len(limits))) * 0.25

        return max(0.0, min(1.0, score))

    def _determine_scaling_strategy(
        self,
        bottlenecks: List[ScalabilityBottleneck],
        limits: List[HorizontalLimit]
    ) -> str:
        """Determine recommended scaling strategy."""
        has_blockers = any(
            limit.scaling_blockers for limit in limits
        )

        critical_bottleneck = None
        for b in bottlenecks:
            if b.time_to_limit_months < 3:
                critical_bottleneck = b
                break

        if critical_bottleneck:
            return f"Immediate action: Address {critical_bottleneck.component} bottleneck"

        if has_blockers:
            return "Refactor blocked components before scaling"

        return "Implement horizontal scaling with auto-scaling groups"

    def _estimate_cost_increase(self, bottlenecks: List[ScalabilityBottleneck]) -> float:
        """Estimate cost increase percentage for 10x growth."""
        if not bottlenecks:
            return 50.0

        avg_limit_months = sum(
            b.time_to_limit_months for b in bottlenecks
        ) / len(bottlenecks)

        if avg_limit_months > 12:
            return 75.0
        elif avg_limit_months > 6:
            return 150.0
        return 300.0

    def add_component(
        self,
        name: str,
        bottleneck_type: str = 'vertical',
        current_load: float = 0.0,
        max_capacity: float = 100.0,
        growth_rate: float = 0.1,
        supports_horizontal: bool = True,
        instances: int = 1,
        max_instances: int = 10,
        **kwargs
    ) -> None:
        """Add a component for scalability analysis."""
        self._components[name] = {
            'bottleneck_type': bottleneck_type,
            'current_load': current_load,
            'max_capacity': max_capacity,
            'growth_rate': growth_rate,
            'supports_horizontal': supports_horizontal,
            'instances': instances,
            'max_instances': max_instances,
            **kwargs
        }

    def add_metrics(
        self,
        name: str,
        current_load: float,
        requests_per_second: float = 0.0,
        response_time_ms: float = 0.0
    ) -> None:
        """Add metrics for a component."""
        self._metrics[name] = {
            'current_load': current_load,
            'requests_per_second': requests_per_second,
            'response_time_ms': response_time_ms
        }
