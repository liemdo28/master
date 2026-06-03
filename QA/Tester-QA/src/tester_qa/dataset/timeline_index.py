"""Timeline Index — chronological index for all operational events."""
from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional


class TimelineIndex:
    """
    Persistent chronological event index.
    Persists to data/dataset/timeline.jsonl
    """

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent.parent.parent / "data" / "dataset"
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.data_dir / "timeline.jsonl"
        self._cache: list[dict] = []
        self._load_cache()

    def _load_cache(self) -> None:
        """Load all timeline entries into memory cache."""
        self._cache = []
        if self.filepath.exists():
            with open(self.filepath, "r") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            self._cache.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        self._cache.sort(key=lambda x: x.get("timestamp", ""))

    def index_event(
        self,
        event_type: str,
        event_id: str,
        timestamp: str,
        metadata: Optional[dict] = None,
    ) -> None:
        """Append an event entry to the timeline."""
        entry = {
            "timeline_id": f"TL-{uuid.uuid4().hex[:12]}",
            "event_type": event_type,
            "event_id": event_id,
            "timestamp": timestamp,
            "metadata": metadata or {},
            "indexed_at": datetime.utcnow().isoformat() + "Z",
        }
        with open(self.filepath, "a") as f:
            f.write(json.dumps(entry) + "\n")
        self._cache.append(entry)
        self._cache.sort(key=lambda x: x.get("timestamp", ""))

    def get_timeline(
        self,
        start: Optional[str] = None,
        end: Optional[str] = None,
    ) -> list[dict]:
        """Get timeline entries filtered by optional time range."""
        results = self._cache
        if start is not None:
            results = [e for e in results if e.get("timestamp", "") >= start]
        if end is not None:
            results = [e for e in results if e.get("timestamp", "") <= end]
        return list(results)

    def get_event_density(self) -> dict:
        """
        Get event density by hour and day.
        Returns: {hourly: {hour: count}, daily: {date: count}}
        """
        hourly: Counter = Counter()
        daily: Counter = Counter()

        for entry in self._cache:
            timestamp = entry.get("timestamp")
            if not timestamp:
                continue
            try:
                ts = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
                hourly[ts.strftime("%Y-%m-%d %H:00")] += 1
                daily[ts.strftime("%Y-%m-%d")] += 1
            except (ValueError, AttributeError):
                continue

        return {
            "hourly": dict(hourly),
            "daily": dict(daily),
        }

    def find_correlated_events(self, event_id: str) -> list[dict]:
        """
        Find events within 5 minute window of the specified event.
        Returns all events except the target event itself.
        """
        target = None
        for entry in self._cache:
            if entry.get("event_id") == event_id:
                target = entry
                break

        if not target:
            return []

        try:
            target_ts = datetime.fromisoformat(target["timestamp"].replace("Z", "+00:00"))
        except (ValueError, KeyError, AttributeError):
            return []

        window_start = target_ts - timedelta(minutes=5)
        window_end = target_ts + timedelta(minutes=5)

        correlated = []
        for entry in self._cache:
            if entry.get("event_id") == event_id:
                continue
            try:
                entry_ts = datetime.fromisoformat(entry["timestamp"].replace("Z", "+00:00"))
                if window_start <= entry_ts <= window_end:
                    entry_copy = dict(entry)
                    entry_copy["seconds_from_target"] = round((entry_ts - target_ts).total_seconds(), 2)
                    correlated.append(entry_copy)
            except (ValueError, KeyError, AttributeError):
                continue

        return sorted(correlated, key=lambda x: abs(x.get("seconds_from_target", 0)))

    def get_events_by_type(self, event_type: str) -> list[dict]:
        """Get timeline entries of a specific event type."""
        return [e for e in self._cache if e.get("event_type") == event_type]

    def get_event_types(self) -> dict:
        """Get count of events by type."""
        return dict(Counter(e.get("event_type", "unknown") for e in self._cache))

    def export(self) -> dict:
        """Export the timeline index."""
        return {
            "exported_at": datetime.utcnow().isoformat() + "Z",
            "total_events": len(self._cache),
            "event_types": self.get_event_types(),
            "density": self.get_event_density(),
            "timeline": list(self._cache),
        }

    def clear(self) -> None:
        """Clear all timeline entries (use with caution)."""
        if self.filepath.exists():
            self.filepath.unlink()
        self._cache = []
