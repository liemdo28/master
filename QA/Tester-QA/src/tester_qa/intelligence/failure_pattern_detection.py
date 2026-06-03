"""Failure Pattern Detection — AI-assisted discovery of recurring failure signatures."""
from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from dataclasses import dataclass, asdict, field
from datetime import datetime
from typing import Any


@dataclass
class FailurePattern:
    """Detected recurring failure pattern."""
    pattern_id: str
    pattern_type: str
    frequency: int
    last_seen: str
    trigger_conditions: list[str] = field(default_factory=list)
    affected_subsystems: list[str] = field(default_factory=list)
    confidence: float = 0.0

    def to_dict(self) -> dict:
        return asdict(self)


class FailurePatternDetector:
    """Detects recurring failure patterns from operational failure records."""

    def __init__(self):
        self.patterns: list[FailurePattern] = []
        self.last_analysis: dict = {}

    def _normalize_record(self, record: dict) -> dict:
        """Normalize mixed record schemas into common fields."""
        trigger = str(record.get("trigger") or record.get("failure_mode") or record.get("failure_type") or "unknown")
        chain = record.get("chain") or record.get("trigger_chain") or []
        if isinstance(chain, str):
            chain = [chain]
        timestamp = str(record.get("timestamp") or datetime.utcnow().isoformat() + "Z")
        affected = record.get("affected_subsystems") or record.get("affected_components") or []
        if isinstance(affected, str):
            affected = [affected]
        pattern_type = str(record.get("failure_type") or record.get("collapse_type") or record.get("failure_mode") or trigger)
        return {
            "trigger": trigger,
            "chain": [str(x) for x in chain],
            "timestamp": timestamp,
            "affected": [str(x) for x in affected],
            "pattern_type": pattern_type,
        }

    def _signature(self, trigger: str, chain: list[str]) -> str:
        """Create stable similarity signature from trigger and chain."""
        normalized_chain = "|".join(x.strip().lower() for x in chain)
        raw = f"{trigger.strip().lower()}::{normalized_chain}"
        return hashlib.sha1(raw.encode()).hexdigest()[:12]

    def analyze(self, failure_records: list[dict]) -> list[FailurePattern]:
        """Group records by trigger+chain similarity and calculate frequencies/confidence."""
        groups: dict[str, list[dict]] = defaultdict(list)
        for raw in failure_records:
            rec = self._normalize_record(raw)
            groups[self._signature(rec["trigger"], rec["chain"])].append(rec)

        patterns: list[FailurePattern] = []
        total = max(len(failure_records), 1)
        for sig, records in groups.items():
            triggers = Counter(r["trigger"] for r in records)
            chains = Counter(tuple(r["chain"]) for r in records)
            affected = Counter()
            pattern_types = Counter()
            for r in records:
                affected.update(r["affected"])
                pattern_types[r["pattern_type"]] += 1
            last_seen = max(r["timestamp"] for r in records)
            dominant_chain = list(chains.most_common(1)[0][0]) if chains else []
            dominant_trigger = triggers.most_common(1)[0][0] if triggers else "unknown"
            confidence = min(1.0, (len(records) / total) * 2 + (0.1 if len(records) >= 3 else 0))
            patterns.append(FailurePattern(
                pattern_id=f"FP-{sig}",
                pattern_type=pattern_types.most_common(1)[0][0] if pattern_types else "unknown",
                frequency=len(records),
                last_seen=last_seen,
                trigger_conditions=[dominant_trigger] + dominant_chain,
                affected_subsystems=[x for x, _ in affected.most_common()],
                confidence=round(confidence, 3),
            ))

        self.patterns = sorted(patterns, key=lambda p: (p.frequency, p.confidence), reverse=True)
        self.last_analysis = {
            "analyzed_at": datetime.utcnow().isoformat() + "Z",
            "record_count": len(failure_records),
            "pattern_count": len(self.patterns),
        }
        return self.patterns

    def find_common_chains(self, records: list[dict]) -> list[dict]:
        """Find top 10 most common propagation chains."""
        counter: Counter = Counter()
        for raw in records:
            chain = raw.get("chain") or raw.get("trigger_chain") or []
            if isinstance(chain, str):
                chain = [chain]
            if chain:
                counter[tuple(str(x) for x in chain)] += 1
        total = sum(counter.values()) or 1
        return [
            {"chain": list(chain), "chain_str": " -> ".join(chain), "count": count, "percentage": round(count / total * 100, 2)}
            for chain, count in counter.most_common(10)
        ]

    def detect_precursors(self, records: list[dict]) -> list[dict]:
        """Find events that consistently precede failures based on metadata/preceding_events."""
        precursor_counter: Counter = Counter()
        pair_counter: Counter = Counter()
        for raw in records:
            failure = raw.get("failure_type") or raw.get("failure_mode") or raw.get("collapse_type") or "failure"
            precursors = raw.get("preceding_events") or raw.get("precursors") or raw.get("metadata", {}).get("preceding_events", [])
            if isinstance(precursors, str):
                precursors = [precursors]
            for precursor in precursors:
                precursor = str(precursor)
                precursor_counter[precursor] += 1
                pair_counter[(precursor, str(failure))] += 1
        results = []
        for precursor, count in precursor_counter.most_common(10):
            failures = {f: c for (p, f), c in pair_counter.items() if p == precursor}
            consistency = max(failures.values()) / count if failures else 0.0
            results.append({"precursor": precursor, "count": count, "associated_failures": failures, "consistency": round(consistency, 3)})
        return results

    def get_pattern_report(self) -> dict:
        """Return report for the latest analysis."""
        return {
            **self.last_analysis,
            "patterns": [p.to_dict() for p in self.patterns],
            "top_patterns": [p.to_dict() for p in self.patterns[:5]],
        }
