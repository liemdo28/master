"""Flaky Test Detection Module"""

import json
import os
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass
class TestResult:
    """A single test execution result."""
    test_name: str
    passed: bool
    timestamp: float
    duration: Optional[float] = None
    error_message: Optional[str] = None


@dataclass
class FlakyTestInfo:
    """Information about a detected flaky test."""
    test_name: str
    flakiness_score: float
    total_runs: int
    pass_count: int
    fail_count: int
    recent_results: List[bool] = field(default_factory=list)
    suggested_fixes: List[str] = field(default_factory=list)


class FlakyDetector:
    """Detects flaky tests by tracking pass/fail history and identifying inconsistencies."""

    def __init__(self, storage_path: Optional[str] = None):
        self._storage_path = storage_path or os.path.join(
            os.path.expanduser("~"), ".tester_qa", "flaky_history.json"
        )
        self._test_history: Dict[str, List[TestResult]] = {}
        self._load_history()

    def _load_history(self) -> None:
        """Load test result history from persistent storage."""
        if os.path.exists(self._storage_path):
            try:
                with open(self._storage_path, "r") as f:
                    data = json.load(f)
                for test_name, results in data.items():
                    self._test_history[test_name] = [
                        TestResult(
                            test_name=r["test_name"],
                            passed=r["passed"],
                            timestamp=r["timestamp"],
                            duration=r.get("duration"),
                            error_message=r.get("error_message"),
                        )
                        for r in results
                    ]
            except (json.JSONDecodeError, KeyError):
                self._test_history = {}

    def _save_history(self) -> None:
        """Persist test result history to disk."""
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        data: Dict[str, List[Dict]] = {}
        for test_name, results in self._test_history.items():
            data[test_name] = [
                {
                    "test_name": r.test_name,
                    "passed": r.passed,
                    "timestamp": r.timestamp,
                    "duration": r.duration,
                    "error_message": r.error_message,
                }
                for r in results
            ]
        with open(self._storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def record_test_result(
        self,
        test_name: str,
        passed: bool,
        duration: Optional[float] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """Record a test execution result."""
        result = TestResult(
            test_name=test_name,
            passed=passed,
            timestamp=time.time(),
            duration=duration,
            error_message=error_message,
        )
        if test_name not in self._test_history:
            self._test_history[test_name] = []
        self._test_history[test_name].append(result)
        self._save_history()

    def detect_flaky_tests(
        self, min_runs: int = 5, flakiness_threshold: float = 0.1
    ) -> List[FlakyTestInfo]:
        """Detect tests that exhibit flaky behavior."""
        flaky_tests: List[FlakyTestInfo] = []
        for test_name, results in self._test_history.items():
            if len(results) < min_runs:
                continue
            score = self.get_flakiness_score(test_name)
            if score >= flakiness_threshold:
                pass_count = sum(1 for r in results if r.passed)
                fail_count = len(results) - pass_count
                recent = [r.passed for r in sorted(results, key=lambda r: r.timestamp)[-10:]]
                fixes = self.suggest_fixes(test_name)
                flaky_tests.append(
                    FlakyTestInfo(
                        test_name=test_name,
                        flakiness_score=score,
                        total_runs=len(results),
                        pass_count=pass_count,
                        fail_count=fail_count,
                        recent_results=recent,
                        suggested_fixes=fixes,
                    )
                )
        return sorted(flaky_tests, key=lambda t: t.flakiness_score, reverse=True)

    def get_flakiness_score(self, test_name: str) -> float:
        """Calculate a flakiness score between 0.0 (stable) and 1.0 (maximally flaky)."""
        results = self._test_history.get(test_name, [])
        if len(results) < 2:
            return 0.0
        sorted_results = sorted(results, key=lambda r: r.timestamp)
        transitions = 0
        for i in range(1, len(sorted_results)):
            if sorted_results[i].passed != sorted_results[i - 1].passed:
                transitions += 1
        # Score is ratio of state transitions to maximum possible transitions
        max_transitions = len(sorted_results) - 1
        return transitions / max_transitions if max_transitions > 0 else 0.0

    def suggest_fixes(self, test_name: str) -> List[str]:
        """Suggest potential fixes for a flaky test based on its failure patterns."""
        results = self._test_history.get(test_name, [])
        if not results:
            return []
        suggestions: List[str] = []
        # Check for timing-related flakiness
        durations = [r.duration for r in results if r.duration is not None]
        if durations:
            avg_duration = sum(durations) / len(durations)
            max_duration = max(durations)
            if max_duration > avg_duration * 3:
                suggestions.append(
                    "High duration variance detected. Consider adding explicit waits or increasing timeouts."
                )
        # Check for intermittent errors
        error_messages = [r.error_message for r in results if r.error_message]
        unique_errors = set(error_messages)
        if len(unique_errors) > 1:
            suggestions.append(
                "Multiple different error messages detected. Test may have multiple failure modes."
            )
        # Check pass/fail ratio
        pass_count = sum(1 for r in results if r.passed)
        fail_ratio = 1.0 - (pass_count / len(results))
        if 0.1 < fail_ratio < 0.5:
            suggestions.append(
                "Test fails intermittently. Check for race conditions, shared state, or external dependencies."
            )
        if not suggestions:
            suggestions.append(
                "Review test isolation and ensure no shared mutable state between test runs."
            )
        return suggestions
