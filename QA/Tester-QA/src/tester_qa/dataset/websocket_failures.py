"""WebSocket Failure Dataset — tracks WebSocket-specific failure patterns."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional


@dataclass
class WSFailureRecord:
    """Individual WebSocket failure record."""
    record_id: str
    timestamp: str
    failure_mode: str  # disconnect, timeout, desync, flood, reconnect_storm
    connection_count: int = 0
    message_rate: float = 0.0  # messages per second
    recovery_time_seconds: float = 0.0
    desync_detected: bool = False

    @classmethod
    def create(
        cls,
        failure_mode: str,
        connection_count: int = 0,
        message_rate: float = 0.0,
        recovery_time_seconds: float = 0.0,
        desync_detected: bool = False,
    ) -> WSFailureRecord:
        """Factory method to create a new WS failure record."""
        return cls(
            record_id=f"WS-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            failure_mode=failure_mode,
            connection_count=connection_count,
            message_rate=message_rate,
            recovery_time_seconds=recovery_time_seconds,
            desync_detected=desync_detected,
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> WSFailureRecord:
        return cls(**data)


class WebSocketFailureDataset:
    """
    Persistent WebSocket failure dataset.
    Persists to data/dataset/ws_failures.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "ws_failures.jsonl"
        self._cache: list[WSFailureRecord] = []
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
                            self._cache.append(WSFailureRecord.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add(self, record: WSFailureRecord) -> None:
        """Add a WebSocket failure record."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(record.to_dict()) + "\n")
        self._cache.append(record)

    def get_failure_patterns(self) -> list[dict]:
        """
        Group failures by failure_mode with statistics.
        Returns list of {mode, count, avg_recovery_time, avg_connection_count, desync_rate}
        """
        mode_groups: dict[str, list[WSFailureRecord]] = {}
        for record in self._cache:
            if record.failure_mode not in mode_groups:
                mode_groups[record.failure_mode] = []
            mode_groups[record.failure_mode].append(record)

        patterns = []
        for mode, records in mode_groups.items():
            recovery_times = [r.recovery_time_seconds for r in records if r.recovery_time_seconds > 0]
            avg_recovery = sum(recovery_times) / len(recovery_times) if recovery_times else 0.0
            
            connection_counts = [r.connection_count for r in records]
            avg_connections = sum(connection_counts) / len(connection_counts) if connection_counts else 0.0
            
            desync_count = sum(1 for r in records if r.desync_detected)
            desync_rate = (desync_count / len(records)) * 100 if records else 0.0

            patterns.append({
                "mode": mode,
                "count": len(records),
                "avg_recovery_time": round(avg_recovery, 2),
                "avg_connection_count": round(avg_connections, 2),
                "desync_rate_percent": round(desync_rate, 2),
            })

        return sorted(patterns, key=lambda x: x["count"], reverse=True)

    def get_most_common_mode(self) -> str:
        """Get the most common failure mode."""
        if not self._cache:
            return "none"
        mode_counter = Counter(r.failure_mode for r in self._cache)
        most_common = mode_counter.most_common(1)
        return most_common[0][0] if most_common else "none"

    def get_average_recovery_time(self) -> float:
        """Get average recovery time across all failures."""
        recovery_times = [r.recovery_time_seconds for r in self._cache if r.recovery_time_seconds > 0]
        if not recovery_times:
            return 0.0
        return round(sum(recovery_times) / len(recovery_times), 2)

    def get_desync_records(self) -> list[WSFailureRecord]:
        """Get all records where desync was detected."""
        return [r for r in self._cache if r.desync_detected]

    def get_high_connection_failures(self, threshold: int = 100) -> list[WSFailureRecord]:
        """Get failures that occurred with high connection counts."""
        return [r for r in self._cache if r.connection_count >= threshold]

    def export(self) -> dict:
        """Export the dataset."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_records": len(self._cache),
            "most_common_mode": self.get_most_common_mode(),
            "avg_recovery_time": self.get_average_recovery_time(),
            "patterns": self.get_failure_patterns(),
            "records": [r.to_dict() for r in self._cache],
        }

    def clear(self) -> None:
        """Clear all records (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
