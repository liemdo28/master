"""Provider behavior analysis — reliability, degradation, correlated outages."""
from __future__ import annotations

from collections import defaultdict
from statistics import mean
from datetime import datetime, timedelta


class ProviderBehaviorAnalyzer:
    """Analyzes provider reliability and correlated provider failures."""

    def analyze_reliability(self, provider_history: list[dict]) -> dict:
        """Return uptime_percent, avg_latency, failure_rate for provider history."""
        if not provider_history:
            return {"uptime_percent": 100.0, "avg_latency": 0.0, "failure_rate": 0.0}
        total = len(provider_history)
        failures = sum(1 for x in provider_history if x.get("failed") or x.get("status") in {"failed", "error", "down"} or x.get("failure_mode"))
        latencies = [float(x.get("latency_ms", 0) or 0) for x in provider_history if float(x.get("latency_ms", 0) or 0) > 0]
        failure_rate = failures / total * 100
        return {"uptime_percent": round(100 - failure_rate, 2), "avg_latency": round(mean(latencies), 2) if latencies else 0.0, "failure_rate": round(failure_rate, 2)}

    def detect_degradation_pattern(self, provider: str, history: list[dict]) -> dict:
        """Detect if latency is increasing over time using linear trend slope."""
        rows = [x for x in history if x.get("provider") == provider or provider == "*"]
        rows = sorted(rows, key=lambda x: str(x.get("timestamp", "")))
        latencies = [float(x.get("latency_ms", 0) or 0) for x in rows if float(x.get("latency_ms", 0) or 0) > 0]
        if len(latencies) < 3:
            return {"provider": provider, "degrading": False, "slope_ms_per_sample": 0.0, "confidence": 0.0}
        n = len(latencies)
        xs = list(range(n))
        xbar, ybar = mean(xs), mean(latencies)
        denom = sum((x - xbar) ** 2 for x in xs) or 1
        slope = sum((x - xbar) * (y - ybar) for x, y in zip(xs, latencies)) / denom
        first_avg = mean(latencies[:max(1, n//3)])
        last_avg = mean(latencies[-max(1, n//3):])
        degrading = slope > 0 and last_avg > first_avg * 1.2
        confidence = min(0.95, abs(slope) / max(ybar, 1) * 10 + (0.2 if degrading else 0))
        return {"provider": provider, "degrading": degrading, "slope_ms_per_sample": round(slope, 3), "first_avg_latency": round(first_avg, 2), "last_avg_latency": round(last_avg, 2), "confidence": round(confidence, 3)}

    def _parse_ts(self, ts: str):
        try:
            return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

    def find_correlated_failures(self, history: list[dict]) -> list[dict]:
        """Find providers that fail together within five-minute windows."""
        failures = [x for x in history if x.get("failed") or x.get("status") in {"failed", "error", "down"} or x.get("failure_mode")]
        dated = [(self._parse_ts(x.get("timestamp", "")), x) for x in failures]
        dated = [(ts, x) for ts, x in dated if ts]
        correlations = defaultdict(int)
        for i, (ts, item) in enumerate(dated):
            p1 = str(item.get("provider", "unknown"))
            for ts2, item2 in dated[i+1:]:
                if abs((ts2 - ts).total_seconds()) > 300:
                    continue
                p2 = str(item2.get("provider", "unknown"))
                if p1 != p2:
                    key = tuple(sorted((p1, p2)))
                    correlations[key] += 1
        return [{"providers": list(pair), "count": count} for pair, count in sorted(correlations.items(), key=lambda x: x[1], reverse=True)]
