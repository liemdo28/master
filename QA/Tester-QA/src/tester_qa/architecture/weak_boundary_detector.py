"""Weak Boundary Detector - Identifies improper encapsulation and trust boundary issues."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


@dataclass
class BoundaryViolation:
    """Represents a detected boundary violation."""
    location: str
    violation_type: str  # 'encapsulation', 'trust', 'exposure', 'access'
    severity: float  # 0.0 to 1.0
    description: str
    exposed_elements: List[str] = field(default_factory=list)
    recommended_fix: str = ""


@dataclass
class EncapsulationIssue:
    """Represents an improper encapsulation issue."""
    class_name: str
    field_name: str
    issue: str  # 'public_field', 'mutable_default', 'missing_property'
    visibility: str  # 'public', 'protected', 'private'
    risk_level: str  # 'high', 'medium', 'low'


@dataclass
class TrustBoundaryIssue:
    """Represents a trust boundary violation."""
    source: str
    destination: str
    boundary_type: str  # 'internal_to_external', 'cross_tenant', 'untrusted_input'
    trust_level: float  # 0.0 to 1.0
    risk_factors: List[str] = field(default_factory=list)


@dataclass
class BoundaryReport:
    """Complete boundary analysis report."""
    weak_boundaries: List[BoundaryViolation]
    encapsulation_issues: List[EncapsulationIssue]
    trust_boundary_issues: List[TrustBoundaryIssue]
    overall_score: float = 0.0  # 0.0 is good, 1.0 is bad


class WeakBoundaryDetector:
    """Detects weak boundaries and improper encapsulation in architecture."""

    def __init__(self) -> None:
        self._modules: Dict[str, Dict] = {}
        self._boundaries: List[Dict] = []
        self._exposures: List[Dict] = []

    def detect_weak_boundaries(
        self,
        modules: Optional[Dict[str, Dict]] = None,
        boundaries: Optional[List[Dict]] = None
    ) -> List[BoundaryViolation]:
        """Detect weak or problematic boundaries between modules."""
        if modules:
            for name, config in modules.items():
                self._modules[name] = config

        if boundaries:
            self._boundaries.extend(boundaries)

        violations: List[BoundaryViolation] = []

        for name, module in self._modules.items():
            exposed = module.get('exposed_elements', [])
            if len(exposed) > module.get('max_exposure', 5):
                violations.append(BoundaryViolation(
                    location=name,
                    violation_type='exposure',
                    severity=len(exposed) / 20,
                    description=f"Module exposes {len(exposed)} elements",
                    exposed_elements=exposed,
                    recommended_fix="Reduce public API surface"
                ))

            public_fields = module.get('public_fields', [])
            for field_name in public_fields:
                if module.get('type') == 'data_class':
                    violations.append(BoundaryViolation(
                        location=f"{name}.{field_name}",
                        violation_type='encapsulation',
                        severity=0.6,
                        description=f"Public field {field_name} should be encapsulated",
                        exposed_elements=[field_name],
                        recommended_fix=f"Use private field with property accessor"
                    ))

        return violations

    def find_improper_encapsulation(
        self,
        classes: Optional[List[Dict]] = None
    ) -> List[EncapsulationIssue]:
        """Find improper encapsulation patterns in classes."""
        issues: List[EncapsulationIssue] = []

        if classes:
            for cls in classes:
                self._analyze_class_encapsulation(cls, issues)

        for module in self._modules.values():
            if 'fields' in module:
                for field_info in module['fields']:
                    issue = self._check_field_encapsulation(
                        module.get('name', 'Unknown'),
                        field_info
                    )
                    if issue:
                        issues.append(issue)

        return issues

    def identify_trust_boundary_issues(
        self,
        connections: Optional[List[Dict]] = None
    ) -> List[TrustBoundaryIssue]:
        """Identify violations of trust boundaries."""
        issues: List[TrustBoundaryIssue] = []

        if connections:
            self._boundaries.extend(connections)

        for boundary in self._boundaries:
            source = boundary.get('source', '')
            destination = boundary.get('destination', '')
            trust_level = boundary.get('trust_level', 1.0)
            boundary_type = boundary.get('type', 'internal')

            if trust_level < 0.5 and boundary_type in ('internal', 'trusted'):
                risk_factors = []
                if boundary.get('unvalidated_input'):
                    risk_factors.append('unvalidated_input')
                if boundary.get('sensitive_data'):
                    risk_factors.append('sensitive_data_exposed')

                issues.append(TrustBoundaryIssue(
                    source=source,
                    destination=destination,
                    boundary_type=boundary_type,
                    trust_level=trust_level,
                    risk_factors=risk_factors
                ))

        return issues

    def _analyze_class_encapsulation(
        self,
        cls: Dict,
        issues: List[EncapsulationIssue]
    ) -> None:
        """Analyze a class for encapsulation issues."""
        class_name = cls.get('name', 'Unknown')
        fields = cls.get('fields', [])

        for field_info in fields:
            issue = self._check_field_encapsulation(class_name, field_info)
            if issue:
                issues.append(issue)

    def _check_field_encapsulation(
        self,
        class_name: str,
        field_info: Dict
    ) -> Optional[EncapsulationIssue]:
        """Check a single field for encapsulation issues."""
        field_name = field_info.get('name', '')
        visibility = field_info.get('visibility', 'public')

        if visibility == 'public':
            return EncapsulationIssue(
                class_name=class_name,
                field_name=field_name,
                issue='public_field',
                visibility=visibility,
                risk_level='high'
            )

        if field_info.get('mutable_default'):
            return EncapsulationIssue(
                class_name=class_name,
                field_name=field_name,
                issue='mutable_default',
                visibility=visibility,
                risk_level='medium'
            )

        return None

    def generate_report(
        self,
        modules: Optional[Dict[str, Dict]] = None,
        classes: Optional[List[Dict]] = None,
        connections: Optional[List[Dict]] = None
    ) -> BoundaryReport:
        """Generate a complete boundary analysis report."""
        weak_boundaries = self.detect_weak_boundaries(modules)
        encapsulation_issues = self.find_improper_encapsulation(classes)
        trust_issues = self.identify_trust_boundary_issues(connections)

        total_issues = (
            len(weak_boundaries) +
            len(encapsulation_issues) +
            len(trust_issues)
        )
        max_issues = 50
        overall_score = min(1.0, total_issues / max_issues)

        return BoundaryReport(
            weak_boundaries=weak_boundaries,
            encapsulation_issues=encapsulation_issues,
            trust_boundary_issues=trust_issues,
            overall_score=overall_score
        )

    def add_module(
        self,
        name: str,
        module_type: str,
        exposed_elements: Optional[List[str]] = None,
        public_fields: Optional[List[str]] = None
    ) -> None:
        """Add a module to analyze."""
        self._modules[name] = {
            'name': name,
            'type': module_type,
            'exposed_elements': exposed_elements or [],
            'public_fields': public_fields or []
        }

    def add_boundary(
        self,
        source: str,
        destination: str,
        boundary_type: str = 'internal',
        trust_level: float = 1.0,
        **kwargs
    ) -> None:
        """Add a boundary to analyze."""
        self._boundaries.append({
            'source': source,
            'destination': destination,
            'type': boundary_type,
            'trust_level': trust_level,
            **kwargs
        })
