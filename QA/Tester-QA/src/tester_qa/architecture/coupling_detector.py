"""Coupling Detector Module - Analyzes coupling and cohesion in the system."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple


@dataclass
class CouplingRelation:
    """Represents a coupling relationship between components."""
    source: str
    target: str
    coupling_type: str  # 'direct', 'indirect', 'data', 'control', 'stamp'
    coupling_strength: float  # 0.0 to 1.0
    dependency_count: int


@dataclass
class TightCoupling:
    """Represents a tight coupling situation."""
    components: Tuple[str, str]
    coupling_strength: float
    issues: List[str] = field(default_factory=list)
    suggested_decoupling: str = ""


@dataclass
class CohesionMetrics:
    """Metrics for module cohesion."""
    module: str
    cohesion_score: float  # 0.0 to 1.0 (higher is better)
    responsibility_count: int
    shared_element_count: int
    cohesion_type: str  # 'high', 'medium', 'low'


@dataclass
class CouplingReport:
    """Complete coupling and cohesion analysis report."""
    coupling_relations: List[CouplingRelation]
    tight_couplings: List[TightCoupling]
    cohesion_metrics: List[CohesionMetrics]
    overall_coupling_score: float  # 0.0 to 1.0 (lower is better)
    overall_cohesion_score: float  # 0.0 to 1.0 (higher is better)


class CouplingDetector:
    """Detects and analyzes coupling and cohesion patterns."""

    def __init__(self) -> None:
        self._dependencies: Dict[str, Set[str]] = defaultdict(set)
        self._modules: Dict[str, Dict] = {}
        self._calls: Dict[Tuple[str, str], int] = defaultdict(int)

    def detect_coupling(
        self,
        dependencies: Optional[Dict[str, List[str]]] = None,
        modules: Optional[Dict[str, Dict]] = None
    ) -> List[CouplingRelation]:
        """Detect all coupling relationships in the system."""
        if dependencies:
            for source, targets in dependencies.items():
                for target in targets:
                    self._dependencies[source].add(target)

        if modules:
            for name, config in modules.items():
                self._modules[name] = config

        relations: List[CouplingRelation] = []

        for source, targets in self._dependencies.items():
            for target in targets:
                coupling_type = self._classify_coupling(source, target)
                strength = self._calculate_coupling_strength(source, target)

                relations.append(CouplingRelation(
                    source=source,
                    target=target,
                    coupling_type=coupling_type,
                    coupling_strength=strength,
                    dependency_count=len(targets)
                ))

        return relations

    def identify_tight_coupling(
        self,
        threshold: float = 0.7
    ) -> List[TightCoupling]:
        """Identify components that are tightly coupled."""
        tight: List[TightCoupling] = []

        for source, targets in self._dependencies.items():
            for target in targets:
                strength = self._calculate_coupling_strength(source, target)

                if strength >= threshold:
                    direct_calls = self._calls.get((source, target), 0)
                    reverse_calls = self._calls.get((target, source), 0)

                    issues = []
                    if direct_calls > 100:
                        issues.append("High frequency of calls between components")
                    if reverse_calls > 0:
                        issues.append("Bidirectional dependency detected")
                    if source in self._dependencies.get(target, set()):
                        issues.append("Circular dependency detected")

                    tight.append(TightCoupling(
                        components=(source, target),
                        coupling_strength=strength,
                        issues=issues,
                        suggested_decoupling=self._suggest_decoupling(source, target)
                    ))

        tight.sort(key=lambda x: x.coupling_strength, reverse=True)
        return tight

    def measure_cohesion(
        self,
        modules: Optional[Dict[str, Dict]] = None
    ) -> List[CohesionMetrics]:
        """Measure cohesion for each module."""
        if modules:
            for name, config in modules.items():
                self._modules[name] = config

        metrics: List[CohesionMetrics] = []

        for name, config in self._modules.items():
            responsibilities = config.get('responsibilities', [])
            shared_elements = config.get('shared_elements', [])

            cohesion_score = self._calculate_cohesion_score(
                len(responsibilities),
                len(shared_elements)
            )

            cohesion_type = 'high' if cohesion_score > 0.7 else 'medium' if cohesion_score > 0.4 else 'low'

            metrics.append(CohesionMetrics(
                module=name,
                cohesion_score=cohesion_score,
                responsibility_count=len(responsibilities),
                shared_element_count=len(shared_elements),
                cohesion_type=cohesion_type
            ))

        return metrics

    def _classify_coupling(self, source: str, target: str) -> str:
        """Classify the type of coupling between two components."""
        direct_deps = self._dependencies.get(source, set())

        if target in direct_deps:
            if self._calls.get((source, target), 0) > 50:
                return 'data'
            elif self._calls.get((target, source), 0) > 0:
                return 'control'
            return 'direct'

        return 'indirect'

    def _calculate_coupling_strength(self, source: str, target: str) -> float:
        """Calculate coupling strength between two components."""
        direct_deps = self._dependencies.get(source, set())
        reverse_deps = self._dependencies.get(target, set())

        direct_score = 0.4 if target in direct_deps else 0.0
        reverse_score = 0.3 if source in reverse_deps else 0.0

        call_count = self._calls.get((source, target), 0)
        call_score = min(0.2, call_count / 1000)

        shared_dependencies = direct_deps & reverse_deps
        shared_score = min(0.1, len(shared_dependencies) * 0.05)

        return min(1.0, direct_score + reverse_score + call_score + shared_score)

    def _calculate_cohesion_score(
        self,
        responsibility_count: int,
        shared_element_count: int
    ) -> float:
        """Calculate cohesion score for a module."""
        if responsibility_count <= 1:
            return 1.0

        if shared_element_count == 0:
            return 0.9

        ideal_shared = responsibility_count - 1
        cohesion = 1.0 - abs(shared_element_count - ideal_shared) / (responsibility_count * 2)

        return max(0.0, min(1.0, cohesion))

    def _suggest_decoupling(self, source: str, target: str) -> str:
        """Suggest decoupling strategy for two components."""
        bidirectional = source in self._dependencies.get(target, set())
        call_count = self._calls.get((source, target), 0) + self._calls.get((target, source), 0)

        if bidirectional:
            return "Introduce event-driven communication or message broker"
        elif call_count > 100:
            return "Extract shared functionality into new module"
        return "Create interface abstraction layer"

    def add_dependency(self, source: str, target: str) -> None:
        """Add a dependency relationship."""
        self._dependencies[source].add(target)

    def add_call(self, source: str, target: str, count: int = 1) -> None:
        """Add call count between components."""
        self._calls[(source, target)] += count

    def add_module(
        self,
        name: str,
        responsibilities: Optional[List[str]] = None,
        shared_elements: Optional[List[str]] = None
    ) -> None:
        """Add a module for cohesion analysis."""
        self._modules[name] = {
            'responsibilities': responsibilities or [],
            'shared_elements': shared_elements or []
        }

    def generate_report(
        self,
        dependencies: Optional[Dict[str, List[str]]] = None,
        modules: Optional[Dict[str, Dict]] = None
    ) -> CouplingReport:
        """Generate a complete coupling and cohesion report."""
        coupling_relations = self.detect_coupling(dependencies, modules)
        tight_couplings = self.identify_tight_coupling()
        cohesion_metrics = self.measure_cohesion(modules)

        avg_coupling = sum(r.coupling_strength for r in coupling_relations)
        coupling_score = avg_coupling / max(1, len(coupling_relations)) if coupling_relations else 0.0

        avg_cohesion = sum(m.cohesion_score for m in cohesion_metrics)
        cohesion_score = avg_cohesion / max(1, len(cohesion_metrics)) if cohesion_metrics else 1.0

        return CouplingReport(
            coupling_relations=coupling_relations,
            tight_couplings=tight_couplings,
            cohesion_metrics=cohesion_metrics,
            overall_coupling_score=coupling_score,
            overall_cohesion_score=cohesion_score
        )
