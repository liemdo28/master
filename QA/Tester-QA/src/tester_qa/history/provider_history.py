"""Provider metrics history persisted per provider."""
from pathlib import Path
from datetime import datetime, timezone
import json
import re


class ProviderHistory:
    """Persists provider metrics to data/history/providers/."""

    def __init__(self, root="data/history/providers"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _safe_provider(self, provider: str) -> str:
        return re.sub(r"[^a-zA-Z0-9_.-]+", "_", provider.strip().lower()) or "unknown"

    def _path(self, provider: str) -> Path:
        return self.root / f"{self._safe_provider(provider)}.jsonl"

    def _read_file(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        out = []
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return out

    def record(self, provider: str, metrics: dict):
        """Append metrics to provider-specific file."""
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), "provider": provider, **metrics}
        with self._path(provider).open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def get_reliability_trend(self, provider: str) -> list[dict]:
        """Return reliability time series for provider."""
        trend = []
        for r in self._read_file(self._path(provider)):
            reliability = r.get("reliability")
            if reliability is None:
                failures = float(r.get("failures", r.get("failure_count", 0)))
                total = float(r.get("requests", r.get("total", max(failures, 1))))
                reliability = 1.0 - (failures / max(total, 1.0))
            trend.append({"timestamp": r.get("timestamp"), "reliability": float(reliability)})
        return trend

    def get_most_unreliable(self) -> list[dict]:
        """Return providers sorted by failure rate descending."""
        rows = []
        for path in self.root.glob("*.jsonl"):
            records = self._read_file(path)
            if not records:
                continue
            failures = sum(float(r.get("failures", r.get("failure_count", 0))) for r in records)
            total = sum(float(r.get("requests", r.get("total", 1))) for r in records)
            failure_rate = failures / max(total, 1.0)
            provider = records[-1].get("provider", path.stem)
            rows.append({"provider": provider, "failure_rate": failure_rate, "records": len(records)})
        return sorted(rows, key=lambda r: r["failure_rate"], reverse=True)
