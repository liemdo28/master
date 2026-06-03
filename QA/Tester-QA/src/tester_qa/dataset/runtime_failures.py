"""Runtime Failure Dataset — tracks runtime/resource exhaustion failures."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class RuntimeFailureRecord:
    """Individual runtime failure record with resource metrics at failure time."""
    record_id: str
    timestamp: str
    failure_type: str  # oom, cpu_exhaustion, queue_overflow, thread_starvation, gc_pause
    cpu_at_failure: float = 0.0  # percentage 0-100
    memory_at_failure: float = 0.0  # percentage 0-100
    queue_depth_at_failure: int = 0
    recovery_time_seconds: float = 0.0

    @classmethod
    def create(
        cls,
        failure_type: str,
        cpu_at_failure: float = 0.0,
        memory_at_failure: float = 0.0,
        queue_depth_at_failure: int = 0,
        recovery_time_seconds: float = 0.0,
    ) -> RuntimeFailureRecord:
        """Factory method to create a new runtime failure record."""
        return cls(
            record_id=f"RT-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            failure_type=failure_type,
            cpu_at_failure=cpu_at_failure,
            memory_at_failure=memory_at_failure,
            queue_depth_at_failure=queue_depth_at_failure,
            recovery_time_seconds=recovery_time_seconds,
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> RuntimeFailureRecord:
        return cls(**data)


class RuntimeFailureDataset:
    """
    Persistent runtime failure dataset.
    Persists to data/dataset/runtime_failures.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "runtime_failures.jsonl"
        self._cache: list[RuntimeFailureRecord] = []
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
                            self._cache.append(RuntimeFailureRecord.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add(self, record: RuntimeFailureRecord) -> None:
        """Add a runtime failure record."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record.to_dict()) + "\n")
        self._cache.append(record)

    def get_failure_conditions(self) -> dict:
        """
        Get average resource metrics at time of failure.
        Returns: {avg_cpu, avg_memory, avg_queue_depth, by_failure_type}
        """
        if not self._cache:
            return {
                "avg_cpu": 0.0,
                "avg_memory": 0.0,
                "avg_queue_depth": 0,
                "by_failure_type": {},
            }

        cpu_values = [r.cpu_at_failure for r in self._cache if r.cpu_at_failure > 0]
        memory_values = [r.memory_at_failure for r in self._cache if r.memory_at_failure > 0]
        queue_values = [r.queue_depth_at_failure for r in self._cache if r.queue_depth_at_failure > 0]

        # Group by failure type
        by_type: dict[str, dict] = {}
        type_groups: dict[str, list[RuntimeFailureRecord]] = {}
        for record in self._cache:
            if record.failure_type not in type_groups:
                type_groups[record.failure_type] = []
            type_groups[record.failure_type].append(record)

        for ftype, records in type_groups.items():
            type_cpu = [r.cpu_at_failure for r in records if r.cpu_at_failure > 0]
            type_mem = [r.memory_at_failure for r in records if r.memory_at_failure > 0]
            type_queue = [r.queue_depth_at_failure for r in records if r.queue_depth_at_failure > 0]
            
            by_type[ftype] = {
                "count": len(records),
                "avg_cpu": round(sum(type_cpu) / len(type_cpu), 2) if type_cpu else 0.0,
                "avg_memory": round(sum(type_mem) / len(type_mem), 2) if type_mem else 0.0,
                "avg_queue_depth": round(sum(type_queue) / len(type_queue), 2) if type_queue else 0,
            }

        return {
            "avg_cpu": round(sum(cpu_values) / len(cpu_values), 2) if cpu_values else 0.0,
            "avg_memory": round(sum(memory_values) / len(memory_values), 2) if memory_values else 0.0,
            "avg_queue_depth": round(sum(queue_values) / len(queue_values), 2) if queue_values else 0,
            "by_failure_type": by_type,
        }

    def get_fragility_profile(self) -> dict:
        """
        Determine resource thresholds that tend to precede failures.
        Returns: {cpu_threshold, memory_threshold, queue_threshold}
        
        Uses the 25th percentile of failure conditions as the "danger zone" threshold.
        """
        if not self._cache:
            return {
                "cpu_threshold": 80.0,
                "memory_threshold": 85.0,
                "queue_threshold": 1000,
                "confidence": "low",
            }

        cpu_values = sorted([r.cpu_at_failure for r in self._cache if r.cpu_at_failure > 0])
        memory_values = sorted([r.memory_at_failure for r in self._cache if r.memory_at_failure > 0])
        queue_values = sorted([r.queue_depth_at_failure for r in self._cache if r.queue_depth_at_failure > 0])

        def percentile_25(values: list) -> float:
            if not values:
                return 0.0
            idx = max(0, int(len(values) * 0.25) - 1)
            return values[idx]

        cpu_threshold = percentile_25(cpu_values) if cpu_values else 80.0
        memory_threshold = percentile_25(memory_values) if memory_values else 85.0
        queue_threshold = percentile_25(queue_values) if queue_values else 1000

        # Confidence based on sample size
        sample_size = len(self._cache)
        if sample_size >= 100:
            confidence = "high"
        elif sample_size >= 20:
            confidence = "medium"
        else:
            confidence = "low"

        return {
            "cpu_threshold": round(cpu_threshold, 2),
            "memory_threshold": round(memory_threshold, 2),
            "queue_threshold": int(queue_threshold),
            "confidence": confidence,
            "sample_size": sample_size,
        }

    def get_by_failure_type(self, failure_type: str) -> list[RuntimeFailureRecord]:
        """Get all records of a specific failure type."""
        return [r for r in self._cache if r.failure_type == failure_type]

    def get_failure_types(self) -> list[str]:
        """Get list of all failure types in the dataset."""
        return list(set(r.failure_type for r in self._cache))

    def export(self) -> dict:
        """Export the dataset."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_records": len(self._cache),
            "failure_types": dict(Counter(r.failure_type for r in self._cache)),
            "failure_conditions": self.get_failure_conditions(),
            "fragility_profile": self.get_fragility_profile(),
            "records": [r.to_dict() for r in self._cache],
        }

    def clear(self) -> None:
        """Clear all records (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
