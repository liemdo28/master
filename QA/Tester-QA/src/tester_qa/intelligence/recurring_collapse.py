"""Recurring Collapse Detection — finds collapse recurrence signatures."""
from __future__ import annotations

import hashlib
from collections import defaultdict, Counter
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta


@dataclass
class RecurringCollapsePattern:
    """Detected recurring collapse pattern."""
    pattern_id: str
    collapse_type: str
    recurrence_count: int
    avg_interval_hours: float
    trigger_signature: list[str] = field(default_factory=list)
    prevention_hint: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class RecurringCollapseDetector:
    """Detects recurring collapse patterns and predicts next occurrence."""

    def __init__(self):
        self.patterns: list[RecurringCollapsePattern] = []
        self._last_seen_by_pattern: dict[str, str] = {}

    def _parse_ts(self, ts: str) -> datetime | None:
        try:
            return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return None

    def analyze(self, collapse_events: list[dict]) -> list[RecurringCollapsePattern]:
        """Group collapse events by collapse_type and calculate recurrence intervals."""
        groups: dict[str, list[dict]] = defaultdict(list)
        for event in collapse_events:
            groups[str(event.get("collapse_type", "unknown"))].append(event)

        patterns: list[RecurringCollapsePattern] = []
        for collapse_type, events in groups.items():
            dated = [(self._parse_ts(e.get("timestamp", "")), e) for e in events]
            dated = [(ts, e) for ts, e in dated if ts is not None]
            dated.sort(key=lambda x: x[0])
            intervals = []
            for i in range(1, len(dated)):
                intervals.append((dated[i][0] - dated[i - 1][0]).total_seconds() / 3600)
            avg_interval = sum(intervals) / len(intervals) if intervals else 0.0
            trigger_counter = Counter()
            for _, e in dated:
                chain = e.get("trigger_chain") or []
                if isinstance(chain, str):
                    chain = [chain]
                trigger_counter.update(str(x) for x in chain)
            sig = hashlib.sha1(collapse_type.encode()).hexdigest()[:12]
            prevention = self._prevention_hint(collapse_type, [x for x, _ in trigger_counter.most_common(5)])
            if dated:
                self._last_seen_by_pattern[f"RCP-{sig}"] = dated[-1][0].isoformat()
            patterns.append(RecurringCollapsePattern(
                pattern_id=f"RCP-{sig}",
                collapse_type=collapse_type,
                recurrence_count=len(events),
                avg_interval_hours=round(avg_interval, 2),
                trigger_signature=[x for x, _ in trigger_counter.most_common(5)],
                prevention_hint=prevention,
            ))
        self.patterns = sorted(patterns, key=lambda p: p.recurrence_count, reverse=True)
        return self.patterns

    def _prevention_hint(self, collapse_type: str, triggers: list[str]) -> str:
        trigger_text = ", ".join(triggers) if triggers else "unknown triggers"
        hints = {
            "websocket": "Add connection backpressure, heartbeat validation, and reconnect jitter.",
            "provider": "Enable provider fallback, circuit breakers, and latency budgets.",
            "runtime": "Increase resource headroom and add pre-failure autoscaling triggers.",
            "database": "Add query timeouts, connection pool caps, and replica failover drills.",
        }
        base = next((hint for key, hint in hints.items() if key in collapse_type.lower()), "Reduce shared blast radius and add targeted health gates.")
        return f"{base} Observed trigger signature: {trigger_text}."

    def get_most_recurring(self) -> list[RecurringCollapsePattern]:
        """Return patterns sorted by recurrence_count."""
        return sorted(self.patterns, key=lambda p: p.recurrence_count, reverse=True)

    def predict_next_occurrence(self, pattern: RecurringCollapsePattern) -> dict:
        """Predict next occurrence based on average recurrence interval."""
        last_seen = self._last_seen_by_pattern.get(pattern.pattern_id)
        if not last_seen or pattern.avg_interval_hours <= 0:
            return {"predicted_at": None, "confidence": 0.0}
        try:
            last_dt = datetime.fromisoformat(last_seen)
        except ValueError:
            return {"predicted_at": None, "confidence": 0.0}
        predicted = last_dt + timedelta(hours=pattern.avg_interval_hours)
        confidence = min(0.95, 0.25 + min(pattern.recurrence_count, 10) * 0.07)
        return {"predicted_at": predicted.isoformat(), "confidence": round(confidence, 3)}
