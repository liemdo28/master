"""Collapse event history persisted as JSONL."""
from collections import Counter
from datetime import datetime, timezone, timedelta
from pathlib import Path
import json
import statistics


class CollapseHistory:
    """Persists collapse events to data/history/collapses.jsonl."""

    def __init__(self, path="data/history/collapses.jsonl"):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _read_all(self) -> list[dict]:
        if not self.path.exists():
            return []
        out = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return out

    def record_collapse(self, event: dict):
        """Append collapse event."""
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), **event}
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def get_collapse_frequency(self) -> dict:
        """Return daily and weekly collapse counts."""
        now = datetime.now(timezone.utc)
        records = self._read_all()
        daily = weekly = 0
        for r in records:
            ts = datetime.fromisoformat(r.get("timestamp"))
            if ts >= now - timedelta(days=1):
                daily += 1
            if ts >= now - timedelta(days=7):
                weekly += 1
        return {"daily": daily, "weekly": weekly}

    def get_most_common_triggers(self) -> list[dict]:
        """Return triggers sorted by frequency."""
        counter = Counter(r.get("trigger") or r.get("reason") or "unknown" for r in self._read_all())
        return [{"trigger": k, "count": v} for k, v in counter.most_common()]

    def get_recovery_stats(self) -> dict:
        """Return average recovery time and success rate."""
        records = self._read_all()
        times = [float(r.get("recovery_time_seconds")) for r in records if r.get("recovery_time_seconds") is not None]
        successes = [bool(r.get("recovered", r.get("recovery_success", False))) for r in records]
        return {
            "avg_recovery_time_seconds": statistics.mean(times) if times else None,
            "recovery_samples": len(times),
            "success_rate": (sum(successes) / len(successes)) if successes else None,
        }
