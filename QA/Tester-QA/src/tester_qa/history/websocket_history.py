"""WebSocket metrics history persisted as JSONL."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import json


class WebSocketHistory:
    """Persists WebSocket metrics to data/history/websocket.jsonl."""

    def __init__(self, path="data/history/websocket.jsonl"):
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

    def record(self, ws_metrics: dict):
        """Append WebSocket metrics."""
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), **ws_metrics}
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def get_stability_trend(self, days=7) -> list[dict]:
        """Return stability time series for recent days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        trend = []
        for r in self._read_all():
            ts = datetime.fromisoformat(r["timestamp"])
            if ts >= cutoff:
                stability = r.get("stability", r.get("connection_stability"))
                if stability is None:
                    connections = r.get("connections_maintained", 0)
                    expected = r.get("connections_expected", r.get("connections", max(connections, 1)))
                    stability = connections / max(expected, 1)
                trend.append({"timestamp": r["timestamp"], "stability": float(stability)})
        return trend

    def get_reconnect_frequency(self) -> dict:
        """Return reconnect frequency summary."""
        records = self._read_all()
        total_reconnects = sum(int(r.get("reconnects", 0)) for r in records)
        if not records:
            return {"total_reconnects": 0, "records": 0, "avg_reconnects_per_record": 0.0}
        return {
            "total_reconnects": total_reconnects,
            "records": len(records),
            "avg_reconnects_per_record": total_reconnects / len(records),
        }
