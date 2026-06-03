"""Warfare result history persisted as JSONL."""
from datetime import datetime, timezone
from pathlib import Path
import json
import uuid
import statistics


class WarfareHistory:
    """Persists warfare results to data/history/warfare/ as JSONL."""

    def __init__(self, root="data/history/warfare"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.path = self.root / "warfare.jsonl"

    def _read_all(self) -> list[dict]:
        if not self.path.exists():
            return []
        records = []
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        return records

    def record(self, warfare_result: dict) -> str:
        """Append warfare result to JSONL and return record_id."""
        record_id = warfare_result.get("record_id") or f"war-{uuid.uuid4().hex[:12]}"
        record = {
            "record_id": record_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            **warfare_result,
        }
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")
        return record_id

    def get_recent(self, limit=20) -> list[dict]:
        """Read last N records."""
        return self._read_all()[-int(limit):]

    def get_by_scenario(self, scenario: str) -> list[dict]:
        """Filter records by scenario name."""
        out = []
        for r in self._read_all():
            scenarios = r.get("scenarios") or r.get("config", {}).get("scenarios") or []
            if r.get("scenario") == scenario or scenario in scenarios:
                out.append(r)
        return out

    def get_trends(self) -> dict:
        """Calculate survival score trends over time."""
        records = self._read_all()
        points = []
        for r in records:
            score = r.get("survival_score", r.get("survivability_score", r.get("score")))
            if isinstance(score, dict):
                score = score.get("score")
            if score is not None:
                points.append({"timestamp": r.get("timestamp"), "score": float(score)})
        scores = [p["score"] for p in points]
        trend = 0.0
        if len(scores) >= 2:
            trend = scores[-1] - scores[0]
        return {
            "count": len(records),
            "score_points": points,
            "average_score": statistics.mean(scores) if scores else None,
            "latest_score": scores[-1] if scores else None,
            "trend_delta": trend,
            "direction": "improving" if trend > 0 else "degrading" if trend < 0 else "flat",
        }
