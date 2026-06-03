"""Pattern Learning Module"""

import json
import os
import time
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Dict, List, Optional


@dataclass
class FailurePattern:
    """A stored failure pattern."""
    pattern_id: str
    category: str
    error_keywords: List[str]
    root_cause: str
    prevention_steps: List[str]
    occurrence_count: int
    first_seen: float
    last_seen: float
    similar_patterns: List[str] = field(default_factory=list)


@dataclass
class FailureEvent:
    """A failure event used for learning."""
    test_name: str
    error_message: str
    stack_trace: Optional[str]
    timestamp: float
    context: Optional[Dict[str, str]] = None


class PatternLearner:
    """Learns from failure patterns and suggests prevention strategies."""

    def __init__(self, storage_path: Optional[str] = None):
        self._storage_path = storage_path or os.path.join(
            os.path.expanduser("~"), ".tester_qa", "learned_patterns.json"
        )
        self._patterns: Dict[str, FailurePattern] = {}
        self._load_patterns()

    def _load_patterns(self) -> None:
        """Load learned patterns from persistent storage."""
        if os.path.exists(self._storage_path):
            try:
                with open(self._storage_path, "r") as f:
                    data = json.load(f)
                for pid, pdata in data.items():
                    self._patterns[pid] = FailurePattern(
                        pattern_id=pdata["pattern_id"],
                        category=pdata["category"],
                        error_keywords=pdata["error_keywords"],
                        root_cause=pdata["root_cause"],
                        prevention_steps=pdata["prevention_steps"],
                        occurrence_count=pdata["occurrence_count"],
                        first_seen=pdata["first_seen"],
                        last_seen=pdata["last_seen"],
                        similar_patterns=pdata.get("similar_patterns", []),
                    )
            except (json.JSONDecodeError, KeyError):
                self._patterns = {}

    def _save_patterns(self) -> None:
        """Persist learned patterns to disk."""
        os.makedirs(os.path.dirname(self._storage_path), exist_ok=True)
        data: Dict[str, Dict] = {}
        for pid, pattern in self._patterns.items():
            data[pid] = {
                "pattern_id": pattern.pattern_id,
                "category": pattern.category,
                "error_keywords": pattern.error_keywords,
                "root_cause": pattern.root_cause,
                "prevention_steps": pattern.prevention_steps,
                "occurrence_count": pattern.occurrence_count,
                "first_seen": pattern.first_seen,
                "last_seen": pattern.last_seen,
                "similar_patterns": pattern.similar_patterns,
            }
        with open(self._storage_path, "w") as f:
            json.dump(data, f, indent=2)

    def _extract_keywords(self, text: str) -> List[str]:
        """Extract meaningful keywords from text."""
        # Simple keyword extraction: split and filter short words
        words = text.lower().split()
        keywords = [w.strip(".,!?;:()[]{}") for w in words if len(w) > 3]
        # Remove common words
        stop_words = {"the", "and", "for", "are", "but", "not", "with", "this", "that"}
        return [w for w in keywords if w not in stop_words][:10]

    def _generate_pattern_id(self, keywords: List[str]) -> str:
        """Generate a unique pattern ID from keywords."""
        key_part = "_".join(sorted(set(keywords[:3])))
        return f"pattern_{key_part[:50]}"

    def _categorize_failure(
        self, keywords: List[str], error_message: str
    ) -> str:
        """Categorize a failure based on its characteristics."""
        msg_lower = error_message.lower()
        if any(w in msg_lower for w in ["timeout", "timed out", "deadline"]):
            return "timeout"
        if any(w in msg_lower for w in ["null", "none", "undefined", "nonexistent"]):
            return "null_reference"
        if any(w in msg_lower for w in ["connection", "refused", "network", "socket"]):
            return "network"
        if any(w in msg_lower for w in ["permission", "denied", "access", "unauthorized"]):
            return "permission"
        if any(w in msg_lower for w in ["memory", "heap", "out of", "allocation"]):
            return "resource"
        if any(w in msg_lower for w in ["assert", "expected", "actual", "mismatch"]):
            return "assertion"
        return "general"

    def _infer_root_cause(self, category: str, keywords: List[str]) -> str:
        """Infer root cause based on category and keywords."""
        causes: Dict[str, str] = {
            "timeout": "Test execution exceeded time limits due to slow operations or deadlocks.",
            "null_reference": "Code attempts to use an object that was not initialized or was deleted.",
            "network": "Network connectivity issues or service unavailability.",
            "permission": "Insufficient permissions to access required resources.",
            "resource": "System resource exhaustion (memory, CPU, disk space).",
            "assertion": "Expected behavior does not match actual behavior.",
            "general": "Unknown root cause; further investigation required.",
        }
        return causes.get(category, causes["general"])

    def _suggest_prevention(self, category: str) -> List[str]:
        """Suggest prevention steps based on failure category."""
        prevention: Dict[str, List[str]] = {
            "timeout": [
                "Increase test timeouts to reasonable limits.",
                "Check for deadlocks or infinite loops in test code.",
                "Use explicit waits instead of fixed delays.",
                "Verify external service availability before tests.",
            ],
            "null_reference": [
                "Add null checks before using objects.",
                "Ensure proper initialization in test setup.",
                "Use mock objects to avoid external dependencies.",
                "Review object lifecycle management.",
            ],
            "network": [
                "Add retry logic with exponential backoff.",
                "Use service mocks for external dependencies.",
                "Check network connectivity before test runs.",
                "Implement circuit breaker pattern.",
            ],
            "permission": [
                "Run tests with appropriate privileges.",
                "Check file/directory permissions before tests.",
                "Use service accounts with required access.",
                "Verify environment setup scripts.",
            ],
            "resource": [
                "Add resource usage monitoring to tests.",
                "Implement proper cleanup in teardown.",
                "Use resource limits to prevent exhaustion.",
                "Profile memory usage and optimize.",
            ],
            "assertion": [
                "Review test assertions for correctness.",
                "Ensure test data matches expected values.",
                "Update tests when production code changes.",
                "Use more specific assertion messages.",
            ],
            "general": [
                "Review test logs and error messages.",
                "Check test environment configuration.",
                "Verify test isolation from other tests.",
                "Consult documentation for known issues.",
            ],
        }
        return prevention.get(category, prevention["general"])

    def learn_from_failure(
        self,
        test_name: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        context: Optional[Dict[str, str]] = None,
    ) -> str:
        """Learn from a failure and store the pattern."""
        keywords = self._extract_keywords(error_message)
        if stack_trace:
            keywords.extend(self._extract_keywords(stack_trace))

        pattern_id = self._generate_pattern_id(keywords)
        category = self._categorize_failure(keywords, error_message)
        timestamp = time.time()

        if pattern_id in self._patterns:
            # Update existing pattern
            pattern = self._patterns[pattern_id]
            pattern.occurrence_count += 1
            pattern.last_seen = timestamp
            pattern.error_keywords = list(set(pattern.error_keywords + keywords))
        else:
            # Create new pattern
            root_cause = self._infer_root_cause(category, keywords)
            prevention = self._suggest_prevention(category)
            self._patterns[pattern_id] = FailurePattern(
                pattern_id=pattern_id,
                category=category,
                error_keywords=keywords,
                root_cause=root_cause,
                prevention_steps=prevention,
                occurrence_count=1,
                first_seen=timestamp,
                last_seen=timestamp,
            )
            pattern_id = pattern_id

        self._save_patterns()
        return pattern_id

    def find_similar_patterns(
        self, error_message: str, threshold: float = 0.6
    ) -> List[FailurePattern]:
        """Find patterns similar to the given error message."""
        similar: List[tuple] = []
        for pattern in self._patterns.values():
            # Compare error message with pattern keywords
            ratio = SequenceMatcher(
                None, error_message.lower(), " ".join(pattern.error_keywords)
            ).ratio()
            if ratio >= threshold:
                similar.append((pattern, ratio))
        similar.sort(key=lambda x: x[1], reverse=True)
        return [p for p, _ in similar]

    def get_known_patterns(self) -> List[FailurePattern]:
        """Get all learned patterns sorted by occurrence count."""
        return sorted(
            self._patterns.values(),
            key=lambda p: (p.occurrence_count, p.last_seen),
            reverse=True,
        )

    def suggest_prevention(self, error_message: str) -> List[str]:
        """Suggest prevention strategies for a given error message."""
        keywords = self._extract_keywords(error_message)
        category = self._categorize_failure(keywords, error_message)
        return self._suggest_prevention(category)
