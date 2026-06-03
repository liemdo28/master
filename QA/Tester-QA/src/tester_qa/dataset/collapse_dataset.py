"""Collapse Dataset — tracks system collapse events and patterns."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


@dataclass
class CollapseEvent:
    """Individual collapse event with full context."""
    event_id: str
    timestamp: str
    collapse_type: str
    trigger_chain: list[str] = field(default_factory=list)
    affected_subsystems: list[str] = field(default_factory=list)
    blast_radius: dict = field(default_factory=dict)
    recovery_duration_seconds: float = 0.0
    survived: bool = True

    @classmethod
    def create(
        cls,
        collapse_type: str,
        trigger_chain: Optional[list[str]] = None,
        affected_subsystems: Optional[list[str]] = None,
        blast_radius: Optional[dict] = None,
        recovery_duration_seconds: float = 0.0,
        survived: bool = True,
    ) -> CollapseEvent:
        """Factory method to create a new collapse event."""
        return cls(
            event_id=f"CE-{uuid.uuid4().hex[:12]}",
            timestamp=datetime.utcnow().isoformat() + "Z",
            collapse_type=collapse_type,
            trigger_chain=trigger_chain or [],
            affected_subsystems=affected_subsystems or [],
            blast_radius=blast_radius or {},
            recovery_duration_seconds=recovery_duration_seconds,
            survived=survived,
        )

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> CollapseEvent:
        return cls(**data)


class CollapseDataset:
    """
    Persistent collapse dataset that tracks system collapse events.
    Persists to data/dataset/collapses.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "collapses.jsonl"
        self._cache: list[CollapseEvent] = []
        self._load_cache()

    def _load_cache(self) -> None:
        """Load all events into memory cache."""
        self._cache = []
        if self.filepath.exists():
            with open(self.filepath, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            data = json.loads(line)
                            self._cache.append(CollapseEvent.from_dict(data))
                        except (json.JSONDecodeError, TypeError):
                            continue

    def add_event(self, event: CollapseEvent) -> None:
        """Add a collapse event to the dataset."""
        with open(self.filepath, "a") as f:
            f.write(json.dumps(event.to_dict()) + "\n")
        self._cache.append(event)

    def get_events(self, collapse_type: Optional[str] = None) -> list[CollapseEvent]:
        """Get events, optionally filtered by collapse_type."""
        if collapse_type is None:
            return list(self._cache)
        return [e for e in self._cache if e.collapse_type == collapse_type]

    def get_collapse_frequency(self) -> dict:
        """
        Calculate collapse frequency over different time windows.
        Returns: {hourly: {hour: count}, daily: {date: count}, weekly: {week: count}}
        """
        hourly: Counter = Counter()
        daily: Counter = Counter()
        weekly: Counter = Counter()

        for event in self._cache:
            try:
                ts = datetime.fromisoformat(event.timestamp.replace("Z", "+00:00"))
                hourly[ts.strftime("%Y-%m-%d %H:00")] += 1
                daily[ts.strftime("%Y-%m-%d")] += 1
                # ISO week number
                weekly[ts.strftime("%Y-W%W")] += 1
            except (ValueError, AttributeError):
                continue

        return {
            "hourly": dict(hourly),
            "daily": dict(daily),
            "weekly": dict(weekly),
        }

    def get_most_vulnerable_subsystems(self) -> list[str]:
        """
        Get subsystems sorted by frequency of appearance in affected_subsystems.
        Returns list of subsystem names, most vulnerable first.
        """
        subsystem_counter: Counter = Counter()
        for event in self._cache:
            for subsystem in event.affected_subsystems:
                subsystem_counter[subsystem] += 1

        return [subsystem for subsystem, _ in subsystem_counter.most_common()]

    def export_for_analysis(self) -> dict:
        """Export dataset for external analysis."""
        survival_rate = 0.0
        if self._cache:
            survived_count = sum(1 for e in self._cache if e.survived)
            survival_rate = (survived_count / len(self._cache)) * 100

        recovery_times = [e.recovery_duration_seconds for e in self._cache if e.recovery_duration_seconds > 0]
        avg_recovery = sum(recovery_times) / len(recovery_times) if recovery_times else 0.0

        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_events": len(self._cache),
            "survival_rate_percent": round(survival_rate, 2),
            "avg_recovery_duration_seconds": round(avg_recovery, 2),
            "collapse_types": dict(Counter(e.collapse_type for e in self._cache)),
            "most_vulnerable_subsystems": self.get_most_vulnerable_subsystems()[:10],
            "frequency": self.get_collapse_frequency(),
            "events": [e.to_dict() for e in self._cache],
        }

    def get_events_by_time_range(
        self,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> list[CollapseEvent]:
        """Get events within a time range (ISO format strings)."""
        results = self._cache
        if start:
            results = [e for e in results if e.timestamp >= start]
        if end:
            results = [e for e in results if e.timestamp <= end]
        return results

    def clear(self) -> None:
        """Clear all events (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
