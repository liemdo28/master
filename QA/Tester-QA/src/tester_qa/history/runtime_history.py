"""Runtime metrics history persisted as JSONL."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import json
import statistics


class RuntimeHistory:
    """Persists runtime snapshots to data/history/runtime.jsonl."""

    def __init__(self, path="data/history/runtime.jsonl"):
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

    def record_snapshot(self, metrics: dict):
        """Append metrics with timestamp."""
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), "metrics": metrics}
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def get_trend(self, metric: str, days=7) -> list[dict]:
        """Return time series for a metric."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        points = []
        for r in self._read_all():
            ts = datetime.fromisoformat(r["timestamp"])
            if ts >= cutoff:
                value = r.get("metrics", {}).get(metric, r.get(metric))
                if value is not None:
                    points.append({"timestamp": r["timestamp"], "value": value})
        return points

    def get_degradation_report(self) -> dict:
        """Report which metrics are degrading."""
        records = self._read_all()
        metrics = set()
        for r in records:
            metrics.update((r.get("metrics") or {}).keys())
        degrading = []
        for metric in sorted(metrics):
            trend = self.get_trend(metric, days=7)
            values = [float(p["value"]) for p in trend if isinstance(p.get("value"), (int, float))]
            if len(values) >= 2 and values[-1] > values[0]:
                degrading.append({"metric": metric, "initial": values[0], "current": values[-1], "delta": values[-1] - values[0]})
        return {"metrics_checked": sorted(metrics), "degrading_metrics": degrading, "degrading_count": len(degrading)}
