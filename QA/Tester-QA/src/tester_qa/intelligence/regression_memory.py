"""Regression Memory Module"""

import json
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class RegressionEvent:
    """A regression event record."""
    test_name: str
    severity: str  # "low", "medium", "high", "critical"
    timestamp: float
    root_cause: Optional[str] = None
    fix_commit: Optional[str] = None
    resolved_at: Optional[float] = None
    metadata: Optional[Dict[str, str]] = None


@dataclass
class RegressionRisk:
    """Predicted regression risk for a test."""
    test_name: str
    risk_score: float  # 0.0 to 1.0
    risk_factors: List[str] = field(default_factory=list)
    similar_past_regressions: int = 0


class RegressionMemory:
    """Persistent memory of past regressions with risk prediction."""

    def __init__(self, storage_path: Optional[str] = None):
        self._storage_path = storage_path or os.path.join(
            os.getenv("HOME", "/root"), ".tester_qa", "regression_memory.json"
        )
        self._regressions: List[RegressionEvent] = []
        self._load_memory()

    def _load_memory(self) -> None:
        """Load regression memory from persistent storage."""
        if os.path.exists(self._storage_path):
            try:
                with open(self._storage_path, "r") as f:
                    data = json.load(f)
                self._regressions = [
                    RegressionEvent(
                        test_name=r["test_name"],
                        severity=r["severity"],
                        timestamp=r["timestamp"],
                        root_cause=r.get("root_cause"),
                        fix_commit=r.get("fix_commit"),
                        resolved_at=r.get("resolved_at"),
                        metadata=r.get("metadata"),
                    )
                    for r in data
                ]
            except (json.JSONDecodeError, KeyError):
                self._regressions = []

    def _save_memory(self) -> None:
        """Persist regression memory to disk."""
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        data = [
            {
                "test_name": r.test_name,
                "severity": r.severity,
                "timestamp": r.timestamp,
                "root_cause": r.root_cause,
                "fix_commit": r.fix_commit,
                "resolved_at": r.resolved_at,
                "metadata": r.metadata,
            }
            for r in self._regressions
        ]
        with open(self._storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def record_regression(
        self,
        test_name: str,
        severity: str = "medium",
        root_cause: Optional[str] = None,
        fix_commit: Optional[str] = None,
        metadata: Optional[Dict[str, str]] = None,
    ) -> None:
        """Record a new regression event."""
        event = RegressionEvent(
            test_name=test_name,
            severity=severity,
            timestamp=time.time(),
            root_cause=root_cause,
            fix_commit=fix_commit,
            resolved_at=None,
            metadata=metadata,
        )
        self._regressions.append(event)
        self._save_memory()

    def check_for_regression(
        self,
        test_name: str,
        time_window: Optional[float] = None,
    ) -> bool:
        """Check if a test has regressed within the time window."""
        now = time.time()
        window = time_window if time_window is not None else (86400 * 30)  # Default 30 days

        for event in reversed(self._regressions):
            if event.test_name == test_name:
                if now - event.timestamp <= window:
                    return True
                else:
                    return False
        return False

    def get_regression_history(
        self,
        test_name: Optional[str] = None,
        severity_filter: Optional[str] = None,
        limit: int = 100,
    ) -> List[RegressionEvent]:
        """Get regression history with optional filters."""
        events = self._regressions

        if test_name is not None:
            events = [e for e in events if e.test_name == test_name]

        if severity_filter is not None:
            events = [e for e in events if e.severity == severity_filter]

        # Sort by timestamp descending
        events = sorted(events, key=lambda e: e.timestamp, reverse=True)
        return events[:limit]

    def predict_regression_risk(self, test_name: str) -> RegressionRisk:
        """Predict the risk of regression for a given test."""
        test_regressions = [e for e in self._regressions if e.test_name == test_name]
        risk_factors: List[str] = []
        risk_score = 0.0

        if not test_regressions:
            # No history - low default risk
            return RegressionRisk(
                test_name=test_name,
                risk_score=0.1,
                risk_factors=["No regression history found"],
                similar_past_regressions=0,
            )

        # Factor 1: Frequency of past regressions
        recurrence_count = len(test_regressions)
        if recurrence_count >= 5:
            risk_score += 0.3
            risk_factors.append(f"High recurrence: {recurrence_count} past regressions")
        elif recurrence_count >= 3:
            risk_score += 0.2
            risk_factors.append(f"Moderate recurrence: {recurrence_count} past regressions")
        elif recurrence_count >= 1:
            risk_score += 0.1
            risk_factors.append(f"Previous regression detected")

        # Factor 2: Severity of past regressions
        severity_weights = {"critical": 0.3, "high": 0.2, "medium": 0.1, "low": 0.05}
        max_severity = max(
            (e.severity for e in test_regressions),
            key=lambda s: severity_weights.get(s, 0),
        )
        max_weight = severity_weights.get(max_severity, 0)
        if max_weight >= 0.2:
            risk_score += 0.15
            risk_factors.append(f"Past {max_severity} severity regression")

        # Factor 3: Time since last regression
        sorted_events = sorted(test_regressions, key=lambda e: e.timestamp, reverse=True)
        last_regression = sorted_events[0]
        days_since = (time.time() - last_regression.timestamp) / 86400
        if days_since < 7:
            risk_score += 0.2
            risk_factors.append(f"Recent regression (within 7 days)")
        elif days_since < 30:
            risk_score += 0.1
            risk_factors.append(f"Moderate recency (within 30 days)")

        # Factor 4: Unresolved regressions
        unresolved = [e for e in test_regressions if e.resolved_at is None]
        if unresolved:
            risk_score += 0.15
            risk_factors.append(f"{len(unresolved)} unresolved regression(s)")

        # Factor 5: Check for similar test patterns
        similar_count = self._count_similar_regressions(test_name)
        if similar_count > 0:
            risk_score += min(0.1, similar_count * 0.02)
            risk_factors.append(f"{similar_count} similar tests with regressions")

        # Cap at 1.0
        risk_score = min(1.0, risk_score)

        return RegressionRisk(
            test_name=test_name,
            risk_score=risk_score,
            risk_factors=risk_factors,
            similar_past_regressions=similar_count,
        )

    def _count_similar_regressions(self, test_name: str) -> int:
        """Count regressions in tests with similar names."""
        base_name = test_name.split("_")[-1] if "_" in test_name else test_name
        count = 0
        for event in self._regressions:
            event_base = event.test_name.split("_")[-1] if "_" in event.test_name else event.test_name
            if event_base == base_name and event.test_name != test_name:
                count += 1
        return count

    def resolve_regression(self, test_name: str, fix_commit: Optional[str] = None) -> bool:
        """Mark a regression as resolved."""
        for event in reversed(self._regressions):
            if event.test_name == test_name and event.resolved_at is None:
                event.resolved_at = time.time()
                event.fix_commit = fix_commit
                self._save_memory()
                return True
        return False
