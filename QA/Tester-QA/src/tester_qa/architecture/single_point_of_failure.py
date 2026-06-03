"""Single Point of Failure Module - Identifies and analyzes system vulnerabilities."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class SinglePointOfFailure:
    """Represents a single point of failure in the system."""
    component: str
    component_type: str  # 'service', 'database', 'queue', 'load_balancer'
    redundancy: int  # Number of redundant instances
    failure_probability: float  # 0.0 to 1.0
    impact_score: float  # 0.0 to 1.0
    is_critical: bool = False
    alternatives: List[str] = field(default_factory=list)


@dataclass
class CriticalPathSegment:
    """Represents a segment in the critical path."""
    component: str
    order: int
    latency_contribution_ms: float
    failure_probability: float
    redundancy: int


@dataclass
class FailureImpact:
    """Represents the impact assessment of a failure."""
    failed_component: str
    affected_services: List[str]
    affected_users: int
    revenue_impact_per_hour: float
    recovery_time_minutes: int
    cascading: bool
    cascade_depth: int


@dataclass
class SpfReport:
    """Complete single point of failure analysis report."""
    spf_components: List[SinglePointOfFailure]
    critical_path: List[CriticalPathSegment]
    failure_impacts: List[FailureImpact]
    overall_resilience_score: float  # 0.0 to 1.0


class SinglePointOfFailure:
    """Identifies single points of failure and analyzes their impact."""

    def __init__(self) -> None:
        self._components: Dict[str, Dict] = {}
        self._dependencies: Dict[str, List[str]] = defaultdict(list)
        self._user_count: Dict[str, int] = {}
        self._revenue_per_hour: Dict[str, float] = {}

    def find_spf(
        self,
        components: Optional[Dict[str, Dict]] = None,
        dependencies: Optional[Dict[str, List[str]]] = None
    ) -> List[SinglePointOfFailure]:
        """Find all single points of failure in the system."""
        if components:
            for name, config in components.items():
                self._components[name] = config

        if dependencies:
            for parent, deps in dependencies.items():
                self._dependencies[parent] = deps

        spf_list: List[SinglePointOfFailure] = []

        for name, config in self._components.items():
            redundancy = config.get('redundancy', 1)
            failure_prob = config.get('failure_probability', 0.1)
            impact = config.get('impact_score', 0.5)

            if redundancy <= 1 and failure_prob > 0:
                is_critical = self._is_critical_component(name)

                spf_list.append(SinglePointOfFailure(
                    component=name,
                    component_type=config.get('type', 'unknown'),
                    redundancy=redundancy,
                    failure_probability=failure_prob,
                    impact_score=impact,
                    is_critical=is_critical,
                    alternatives=self._find_alternatives(name)
                ))

        spf_list.sort(key=lambda x: x.impact_score * x.failure_probability, reverse=True)
        return spf_list

    def identify_critical_path(
        self,
        start: Optional[str] = None,
        end: Optional[str] = None
    ) -> List[CriticalPathSegment]:
        """Identify the critical path through the system."""
        if not start and self._components:
            start = self._find_entry_point()
        if not end and self._components:
            end = self._find_exit_point()

        if not start or not end:
            return []

        path = self._calculate_critical_path(start, end)
        segments: List[CriticalPathSegment] = []

        for order, component in enumerate(path):
            config = self._components.get(component, {})
            segments.append(CriticalPathSegment(
                component=component,
                order=order,
                latency_contribution_ms=config.get('latency_ms', 0.0),
                failure_probability=config.get('failure_probability', 0.0),
                redundancy=config.get('redundancy', 1)
            ))

        return segments

    def calculate_failure_impact(
        self,
        component: str
    ) -> FailureImpact:
        """Calculate the impact of a component failure."""
        affected = self._get_affected_services(component)
        total_users = sum(self._user_count.get(svc, 0) for svc in affected)
        revenue_impact = sum(self._revenue_per_hour.get(svc, 0.0) for svc in affected)

        cascade_depth = self._calculate_cascade_depth(component)

        return FailureImpact(
            failed_component=component,
            affected_services=affected,
            affected_users=total_users,
            revenue_impact_per_hour=revenue_impact,
            recovery_time_minutes=self._estimate_recovery_time(component),
            cascading=cascade_depth > 0,
            cascade_depth=cascade_depth
        )

    def _is_critical_component(self, component: str) -> bool:
        """Determine if a component is critical (no alternatives, high impact)."""
        dependents = sum(
            1 for deps in self._dependencies.values()
            if component in deps
        )
        dependents += sum(
            1 for deps in self._dependencies.values()
            for dep in deps
            if dep == component and self._dependencies.get(component)
        )

        config = self._components.get(component, {})
        return (
            dependents > 2 or
            config.get('impact_score', 0) > 0.8
        )

    def _find_alternatives(self, component: str) -> List[str]:
        """Find alternative components for a given component."""
        alternatives: List[str] = []

        for name, config in self._components.items():
            if name != component:
                if config.get('type') == self._components.get(component, {}).get('type'):
                    if config.get('redundancy', 1) > 1:
                        alternatives.append(name)

        return alternatives[:3]

    def _find_entry_point(self) -> Optional[str]:
        """Find the entry point of the system."""
        all_deps: Set[str] = set()
        for deps in self._dependencies.values():
            all_deps.update(deps)

        for name in self._components:
            if name not in all_deps:
                return name

        return next(iter(self._components), None)

    def _find_exit_point(self) -> Optional[str]:
        """Find the exit point of the system."""
        for name, deps in self._dependencies.items():
            if not deps:
                return name
        return None

    def _calculate_critical_path(
        self,
        start: str,
        end: str
    ) -> List[str]:
        """Calculate the critical path between start and end."""
        path: List[str] = [start]
        visited: Set[str] = {start}

        current = start
        while current != end:
            next_components = [
                c for c in self._dependencies.get(current, [])
                if c not in visited
            ]

            if not next_components:
                break

            next_component = max(
                next_components,
                key=lambda c: self._components.get(c, {}).get('latency_ms', 0)
            )
            path.append(next_component)
            visited.add(next_component)
            current = next_component

        return path

    def _get_affected_services(self, component: str) -> List[str]:
        """Get all services affected by a component failure."""
        affected: Set[str] = {component}

        def traverse(start: str) -> None:
            for name, deps in self._dependencies.items():
                if start in deps:
                    if name not in affected:
                        affected.add(name)
                        traverse(name)

        traverse(component)
        return list(affected)

    def _calculate_cascade_depth(self, component: str) -> int:
        """Calculate the depth of cascade failure."""
        affected = self._get_affected_services(component)
        return len(affected) - 1

    def _estimate_recovery_time(self, component: str) -> int:
        """Estimate recovery time in minutes for a component."""
        config = self._components.get(component, {})
        base_time = config.get('recovery_time_minutes', 30)

        redundancy = config.get('redundancy', 1)
        if redundancy > 1:
            base_time = max(5, base_time // 2)

        return base_time

    def add_component(
        self,
        name: str,
        component_type: str,
        redundancy: int = 1,
        failure_probability: float = 0.1,
        impact_score: float = 0.5,
        **kwargs
    ) -> None:
        """Add a component to analyze."""
        self._components[name] = {
            'type': component_type,
            'redundancy': redundancy,
            'failure_probability': failure_probability,
            'impact_score': impact_score,
            **kwargs
        }

    def add_dependency(self, parent: str, child: str) -> None:
        """Add a dependency relationship."""
        self._dependencies[parent].append(child)

    def set_service_metrics(
        self,
        service: str,
        users: int = 0,
        revenue_per_hour: float = 0.0
    ) -> None:
        """Set metrics for a service."""
        self._user_count[service] = users
        self._revenue_per_hour[service] = revenue_per_hour

    def generate_full_report(self) -> SpfReport:
        """Generate a complete SPF analysis report."""
        spf_components = self.find_spf()
        critical_path = self.identify_critical_path()

        failure_impacts = []
        for spf in spf_components[:5]:
            impact = self.calculate_failure_impact(spf.component)
            failure_impacts.append(impact)

        resilience_score = self._calculate_resilience_score(spf_components)

        return SpfReport(
            spf_components=spf_components,
            critical_path=critical_path,
            failure_impacts=failure_impacts,
            overall_resilience_score=resilience_score
        )

    def _calculate_resilience_score(
        self,
        spf_list: List[SinglePointOfFailure]
    ) -> float:
        """Calculate overall system resilience score."""
        if not spf_list:
            return 1.0

        critical_count = sum(1 for spf in spf_list if spf.is_critical)
        avg_redundancy = sum(spf.redundancy for spf in spf_list) / len(spf_list)

        score = 1.0
        score -= (critical_count * 0.1)
        score -= (1.0 / max(1, avg_redundancy)) * 0.3

        return max(0.0, min(1.0, score))
