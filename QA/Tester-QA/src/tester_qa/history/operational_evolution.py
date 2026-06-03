"""Operational evolution history persisted as JSONL."""
from datetime import datetime, timezone
from pathlib import Path
import json
import statistics


class OperationalEvolution:
    """Persists and analyzes weekly operational summaries."""

    def __init__(self, path="data/history/evolution.jsonl"):
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

    def record_weekly_summary(self, summary: dict):
        """Append weekly summary."""
        record = {"timestamp": datetime.now(timezone.utc).isoformat(), **summary}
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(record, default=str) + "\n")

    def get_evolution_report(self, weeks=4) -> dict:
        """Return trends over N weeks."""
        records = self._read_all()[-int(weeks):]
        metrics = ["survival_score", "collapse_count", "failure_rate", "recovery_time_seconds", "incident_count"]
        trends = {}
        for metric in metrics:
            vals = [float(r[metric]) for r in records if isinstance(r.get(metric), (int, float))]
            if vals:
                trends[metric] = {
                    "initial": vals[0],
                    "latest": vals[-1],
                    "delta": vals[-1] - vals[0] if len(vals) >= 2 else 0.0,
                    "average": statistics.mean(vals),
                }
        return {"weeks_analyzed": len(records), "trends": trends, "records": records}

    def detect_degradation_trend(self) -> dict:
        """Detect whether the system is getting worse."""
        report = self.get_evolution_report(weeks=8)
        trends = report["trends"]
        signals = []
        if trends.get("survival_score", {}).get("delta", 0) < 0:
            signals.append("survival_score_down")
        for metric in ["collapse_count", "failure_rate", "recovery_time_seconds", "incident_count"]:
            if trends.get(metric, {}).get("delta", 0) > 0:
                signals.append(f"{metric}_up")
        return {
            "is_degrading": len(signals) > 0,
            "signals": signals,
            "severity": "high" if len(signals) >= 3 else "medium" if len(signals) else "none",
        }

    def get_improvement_areas(self) -> list[str]:
        """Return areas needing attention."""
        degradation = self.detect_degradation_trend()
        mapping = {
            "survival_score_down": "Improve long-run survivability and reduce critical failure modes",
            "collapse_count_up": "Reduce collapse frequency and harden fragile components",
            "failure_rate_up": "Investigate provider/runtime failure rate regressions",
            "recovery_time_seconds_up": "Improve recovery automation and reduce MTTR",
            "incident_count_up": "Address recurring incidents and expand regression coverage",
        }
        return [mapping[s] for s in degradation["signals"] if s in mapping]
