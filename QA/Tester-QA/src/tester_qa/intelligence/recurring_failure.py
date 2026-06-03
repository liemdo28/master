"""Recurring Failure Detection Module"""

import json
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class FailureRecord:
    """A single failure occurrence."""
    test_name: str
    error_message: str
    timestamp: float
    context: Optional[Dict[str, str]] = None


@dataclass
class RecurrencePattern:
    """A detected recurrence pattern."""
    test_name: str
    failure_count: int
    first_seen: float
    last_seen: float
    average_interval: float
    error_messages: List[str] = field(default_factory=list)


class RecurringFailureDetector:
    """Detects recurring test failures and tracks failure patterns over time."""

    def __init__(self, storage_path: Optional[str] = None):
        self._storage_path = storage_path or os.path.join(
            os.path.expanduser("~"), ".tester_qa", "failure_history.json"
        )
        self._failure_history: Dict[str, List[FailureRecord]] = {}
        self._load_history()

    def _load_history(self) -> None:
        """Load failure history from persistent storage."""
        if os.path.exists(self._storage_path):
            try:
                with open(self._storage_path, "r") as f:
                    data = json.load(f)
                for test_name, records in data.items():
                    self._failure_history[test_name] = [
                        FailureRecord(
                            test_name=r["test_name"],
                            error_message=r["error_message"],
                            timestamp=r["timestamp"],
                            context=r.get("context"),
                        )
                        for r in records
                    ]
            except (json.JSONDecodeError, KeyError):
                self._failure_history = {}

    def _save_history(self) -> None:
        """Persist failure history to disk."""
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        data: Dict[str, List[Dict]] = {}
        for test_name, records in self._failure_history.items():
            data[test_name] = [
                {
                    "test_name": r.test_name,
                    "error_message": r.error_message,
                    "timestamp": r.timestamp,
                    "context": r.context,
                }
                for r in records
            ]
        with open(self._storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def record_failure(
        self,
        test_name: str,
        error_message: str,
        context: Optional[Dict[str, str]] = None,
    ) -> None:
        """Record a test failure occurrence."""
        record = FailureRecord(
            test_name=test_name,
            error_message=error_message,
            timestamp=time.time(),
            context=context,
        )
        if test_name not in self._failure_history:
            self._failure_history[test_name] = []
        self._failure_history[test_name].append(record)
        self._save_history()

    def detect_patterns(self, min_occurrences: int = 3) -> List[RecurrencePattern]:
        """Detect recurring failure patterns across all tests."""
        patterns: List[RecurrencePattern] = []
        for test_name, records in self._failure_history.items():
            if len(records) >= min_occurrences:
                sorted_records = sorted(records, key=lambda r: r.timestamp)
                intervals: List[float] = []
                for i in range(1, len(sorted_records)):
                    intervals.append(
                        sorted_records[i].timestamp - sorted_records[i - 1].timestamp
                    )
                avg_interval = sum(intervals) / len(intervals) if intervals else 0.0
                error_messages = list(set(r.error_message for r in records))
                patterns.append(
                    RecurrencePattern(
                        test_name=test_name,
                        failure_count=len(records),
                        first_seen=sorted_records[0].timestamp,
                        last_seen=sorted_records[-1].timestamp,
                        average_interval=avg_interval,
                        error_messages=error_messages,
                    )
                )
        return patterns

    def get_recurring_failures(
        self, time_window: Optional[float] = None
    ) -> List[str]:
        """Get test names that have recurring failures within a time window."""
        now = time.time()
        recurring: List[str] = []
        for test_name, records in self._failure_history.items():
            if time_window is not None:
                recent = [r for r in records if now - r.timestamp <= time_window]
            else:
                recent = records
            if len(recent) >= 2:
                recurring.append(test_name)
        return recurring

    def calculate_recurrence_rate(self, test_name: str) -> float:
        """Calculate the recurrence rate (failures per hour) for a given test."""
        records = self._failure_history.get(test_name, [])
        if len(records) < 2:
            return 0.0
        sorted_records = sorted(records, key=lambda r: r.timestamp)
        time_span = sorted_records[-1].timestamp - sorted_records[0].timestamp
        if time_span == 0:
            return 0.0
        # Return failures per hour
        return len(records) / (time_span / 3600.0)
