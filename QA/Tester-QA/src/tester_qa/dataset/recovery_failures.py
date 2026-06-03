"""Recovery Failure Dataset — tracks failed recovery attempts."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class RecoveryFailureRecord:
    """Individual failed recovery attempt record."""
    record_id: str
    timestamp: str
    original_failure: str
    recovery_attempt: str
    recovery_failed_reason: str
    time_to_failure_seconds: float = 0.0
    residual_corruption: list[str] = field(default_factory=list)

    @classmethod
    def create(
        cls,
        original_failure: str,
        recovery_attempt: str,
        recovery_failed_reason: str,
        time_to_failure_seconds: float = 0.0,
        residual_corruption: Optional[list[str]] = None,
    ) -> RecoveryFailureRecord:
        """Factory method to create a new recovery failure record."""
        return cls(
            record_id=f"RF-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            original_failure=original_failure,
            recovery_attempt=recovery_attempt,
            recovery_failed_reason=recovery_failed_reason,
            time_to_failure_seconds=time_to_failure_seconds,
            residual_corruption=residual_corruption or [],
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> RecoveryFailureRecord:
        return cls(**data)


class RecoveryFailureDataset:
    """
    Persistent recovery failure dataset.
    Persists to data/dataset/recovery_failures.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "recovery_failures.jsonl"
        self._cache: list[RecoveryFailureRecord] = []
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
                            self._cache.append(RecoveryFailureRecord.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add(self, record: RecoveryFailureRecord) -> None:
        """Add a recovery failure record."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record.to_dict()) + "\n")
        self._cache.append(record)

    def get_failure_rate(self) -> float:
        """
        Get percentage of recoveries that fail.
        Since this dataset only stores failed recoveries, this returns 100% if records exist,
        0% if no failures are recorded. For true rate calculation, integrate with recovery success dataset.
        """
        if not self._cache:
            return 0.0
        return 100.0

    def get_most_fragile_recoveries(self) -> list[dict]:
        """
        Get top failure reasons and recovery attempts.
        Returns list sorted by frequency: {reason, count, recovery_attempts, avg_time_to_failure}
        """
        reason_groups: dict[str, list[RecoveryFailureRecord]] = {}
        for record in self._cache:
            reason = record.recovery_failed_reason
            if reason not in reason_groups:
                reason_groups[reason] = []
            reason_groups[reason].append(record)

        fragile = []
        for reason, records in reason_groups.items():
            attempts = Counter(r.recovery_attempt for r in records)
            times = [r.time_to_failure_seconds for r in records if r.time_to_failure_seconds > 0]
            avg_time = sum(times) / len(times) if times else 0.0
            corruption = Counter()
            for r in records:
                corruption.update(r.residual_corruption)

            fragile.append({
                "reason": reason,
                "count": len(records),
                "recovery_attempts": dict(attempts),
                "avg_time_to_failure_seconds": round(avg_time, 2),
                "common_residual_corruption": dict(corruption.most_common(5)),
            })

        return sorted(fragile, key=lambda x: x["count"], reverse=True)

    def get_by_original_failure(self, original_failure: str) -> list[RecoveryFailureRecord]:
        """Get recovery failures for a specific original failure."""
        return [r for r in self._cache if r.original_failure == original_failure]

    def get_by_attempt(self, recovery_attempt: str) -> list[RecoveryFailureRecord]:
        """Get failures for a specific recovery attempt type."""
        return [r for r in self._cache if r.recovery_attempt == recovery_attempt]

    def get_corruption_patterns(self) -> list[dict]:
        """Get patterns of residual corruption after failed recoveries."""
        corruption_counter = Counter()
        for record in self._cache:
            corruption_counter.update(record.residual_corruption)

        total = sum(corruption_counter.values()) if corruption_counter else 1
        return [
            {
                "corruption": corruption,
                "count": count,
                "percentage": round((count / total) * 100, 2),
            }
            for corruption, count in corruption_counter.most_common()
        ]

    def export(self) -> dict:
        """Export the dataset."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_records": len(self._cache),
            "failure_rate_percent": self.get_failure_rate(),
            "fragile_recoveries": self.get_most_fragile_recoveries(),
            "corruption_patterns": self.get_corruption_patterns(),
            "records": [r.to_dict() for r in self._cache],
        }

    def clear(self) -> None:
        """Clear all records (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
