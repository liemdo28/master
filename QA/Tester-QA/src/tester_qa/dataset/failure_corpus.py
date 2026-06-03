"""Failure Corpus — persistent storage for failure intelligence records."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class FailureRecord:
    """Individual failure record with full context."""
    record_id: str
    failure_type: str
    timestamp: str
    severity: str  # critical, high, medium, low
    trigger: str
    chain: list[str] = field(default_factory=list)
    recovery_time_seconds: float = 0.0
    residual_damage: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        failure_type: str,
        severity: str,
        trigger: str,
        chain: Optional[list[str]] = None,
        recovery_time_seconds: float = 0.0,
        residual_damage: Optional[dict] = None,
        metadata: Optional[dict] = None,
    ) -> FailureRecord:
        """Factory method to create a new failure record."""
        return cls(
            record_id=f"FR-{uuid.uuid4().hex[:12]}",
            failure_type=failure_type,
            timestamp=datetime.utcnow().isoformat() + "Z",
            severity=severity,
            trigger=trigger,
            chain=chain or [],
            recovery_time_seconds=recovery_time_seconds,
            residual_damage=residual_damage or {},
            metadata=metadata or {},
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> FailureRecord:
        return cls(**data)


class FailureCorpus:
    """
    Persistent failure corpus that accumulates operational failure intelligence.
    Persists to data/corpus/failures.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "corpus"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "failures.jsonl"
        self._cache: list[FailureRecord] = []
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
                            self._cache.append(FailureRecord.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add(self, record: FailureRecord) -> None:
        """Append a failure record to the corpus."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record.to_dict()) + "\n")
        self._cache.append(record)

    def query(
        self,
        failure_type: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> list[FailureRecord]:
        """Filter records by failure_type and/or severity."""
        results = self._cache
        if failure_type is not None:
            results = [r for r in results if r.failure_type == failure_type]
        if severity is not None:
            results = [r for r in results if r.severity == severity]
        return results

    def get_statistics(self) -> dict:
        """
        Return statistics about the corpus.
        Returns: {total, by_type, by_severity, avg_recovery_time}
        """
        if not self._cache:
            return {
                "total": 0,
                "by_type": {},
                "by_severity": {},
                "avg_recovery_time": 0.0,
            }

        by_type: dict[str, int] = Counter(r.failure_type for r in self._cache)
        by_severity: dict[str, int] = Counter(r.severity for r in self._cache)
        
        recovery_times = [r.recovery_time_seconds for r in self._cache if r.recovery_time_seconds > 0]
        avg_recovery = sum(recovery_times) / len(recovery_times) if recovery_times else 0.0

        return {
            "total": len(self._cache),
            "by_type": dict(by_type),
            "by_severity": dict(by_severity),
            "avg_recovery_time": round(avg_recovery, 2),
        }

    def export(self) -> dict:
        """Full export of the corpus."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_records": len(self._cache),
            "records": [r.to_dict() for r in self._cache],
            "statistics": self.get_statistics(),
        }

    def get_most_common_chains(self) -> list[dict]:
        """
        Get top 10 propagation chains by frequency.
        Returns list of {chain, count, percentage}
        """
        chain_counter: Counter = Counter()
        for record in self._cache:
            if record.chain:
                chain_key = " -> ".join(record.chain)
                chain_counter[chain_key] += 1

        total = sum(chain_counter.values()) if chain_counter else 1
        top_chains = chain_counter.most_common(10)

        return [
            {
                "chain": chain.split(" -> "),
                "chain_str": chain,
                "count": count,
                "percentage": round((count / total) * 100, 2),
            }
            for chain, count in top_chains
        ]

    def get_records_by_time_range(
        self,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> list[FailureRecord]:
        """Get records within a time range (ISO format strings)."""
        results = self._cache
        if start:
            results = [r for r in results if r.timestamp >= start]
        if end:
            results = [r for r in results if r.timestamp <= end]
        return results

    def clear(self) -> None:
        """Clear all records (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
