"""Architecture Failure Dataset — tracks architectural risk patterns."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class ArchitectureFailureRecord:
    """Individual architecture failure/risk record."""
    record_id: str
    timestamp: str
    pattern: str  # single_point_of_failure, tight_coupling, weak_boundary, bottleneck
    affected_components: list[str] = field(default_factory=list)
    risk_score: float = 0.0  # 0-100

    @classmethod
    def create(
        cls,
        pattern: str,
        affected_components: Optional[list[str]] = None,
        risk_score: float = 0.0,
    ) -> ArchitectureFailureRecord:
        """Factory method to create a new architecture failure record."""
        return cls(
            record_id=f"AF-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            pattern=pattern,
            affected_components=affected_components or [],
            risk_score=risk_score,
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> ArchitectureFailureRecord:
        return cls(**data)


class ArchitectureFailureDataset:
    """
    Persistent architecture failure dataset.
    Persists to data/dataset/architecture_failures.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "architecture_failures.jsonl"
        self._cache: list[ArchitectureFailureRecord] = []
        self._load_cache()

    def _load_cache(self) -> None:
        """Load all records into memory cache."""
        self._cache = []
        if self.filepath.exists():
            with open(self.filepath, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            self._cache.append(ArchitectureFailureRecord.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add(self, record: ArchitectureFailureRecord) -> None:
        """Add an architecture failure record."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record.to_dict()) + "\n")
        self._cache.append(record)

    def get_risk_patterns(self) -> list[dict]:
        """
        Get risk patterns sorted by average risk_score descending.
        Returns list of {pattern, count, avg_risk_score, max_risk_score, affected_components}
        """
        pattern_groups: dict[str, list[ArchitectureFailureRecord]] = {}
        for record in self._cache:
            if record.pattern not in pattern_groups:
                pattern_groups[record.pattern] = []
            pattern_groups[record.pattern].append(record)

        patterns = []
        for pattern, records in pattern_groups.items():
            risk_scores = [r.risk_score for r in records]
            components = Counter()
            for r in records:
                components.update(r.affected_components)

            patterns.append({
                "pattern": pattern,
                "count": len(records),
                "avg_risk_score": round(sum(risk_scores) / len(risk_scores), 2) if risk_scores else 0.0,
                "max_risk_score": round(max(risk_scores), 2) if risk_scores else 0.0,
                "affected_components": [c for c, _ in components.most_common()],
                "component_frequency": dict(components),
            })

        return sorted(patterns, key=lambda x: x["avg_risk_score"], reverse=True)

    def get_highest_risk_components(self) -> list[str]:
        """
        Get components sorted by cumulative risk exposure.
        Returns component names sorted by weighted risk score.
        """
        component_risk: dict[str, float] = {}
        for record in self._cache:
            for component in record.affected_components:
                component_risk[component] = component_risk.get(component, 0.0) + record.risk_score

        sorted_components = sorted(component_risk.items(), key=lambda x: x[1], reverse=True)
        return [component for component, _ in sorted_components]

    def get_high_risk_records(self, threshold: float = 70.0) -> list[ArchitectureFailureRecord]:
        """Get records with risk score above threshold."""
        return [r for r in self._cache if r.risk_score >= threshold]

    def get_by_pattern(self, pattern: str) -> list[ArchitectureFailureRecord]:
        """Get records for a specific architecture pattern."""
        return [r for r in self._cache if r.pattern == pattern]

    def export(self) -> dict:
        """Export the dataset."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_records": len(self._cache),
            "risk_patterns": self.get_risk_patterns(),
            "highest_risk_components": self.get_highest_risk_components(),
            "high_risk_count": len(self.get_high_risk_records()),
            "records": [r.to_dict() for r in self._cache],
        }

    def clear(self) -> None:
        """Clear all records (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
