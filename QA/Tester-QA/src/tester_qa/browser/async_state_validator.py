"""Async state validation and race condition detection for QA testing."""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Awaitable, Callable, Dict, List, Optional, Set, Tuple


@dataclass
class RaceCondition:
    """Represents a detected race condition between async operations."""
    operation_a: str
    operation_b: str
    detected_at: datetime = field(default_factory=datetime.now)
    conflict_type: str = ""
    shared_resource: str = ""
    execution_order: List[str] = field(default_factory=list)


@dataclass
class AwaitChain:
    """Represents a chain of await calls."""
    chain_id: str
    steps: List[str] = field(default_factory=list)
    depth: int = 0
    has_cycles: bool = False
    unresolved_steps: List[str] = field(default_factory=list)


@dataclass
class UnhandledPromise:
    """Represents an unhandled or unobserved promise."""
    promise_id: str
    created_at: datetime
    resolution_status: str = "unknown"
    rejection_reason: Optional[str] = None
    associated_state_key: Optional[str] = None


class AsyncStateValidator:
    """Validates async state consistency and detects race conditions.

    Monitors async operations, await chains, and promise resolutions
    to ensure that concurrent state updates do not cause inconsistencies.
    """

    def __init__(self) -> None:
        self._state_snapshots: Dict[str, Dict[str, Any]] = {}
        self._async_operations: Dict[str, Dict[str, Any]] = {}
        self._race_conditions: List[RaceCondition] = []
        self._await_chains: Dict[str, AwaitChain] = {}
        self._unhandled_promises: Dict[str, UnhandledPromise] = {}
        self._operation_counter: int = 0
        self._state_history: List[Dict[str, Any]] = []

    def validate_state_consistency(
        self,
        current_state: Dict[str, Any],
        expected_state: Optional[Dict[str, Any]] = None,
        state_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """Validate that async state updates are consistent.

        Args:
            current_state: The current application state.
            expected_state: Optional expected state to validate against.
            state_key: Optional specific state key to validate.

        Returns:
            Dictionary with validation results and any inconsistencies found.
        """
        now = datetime.now()
        inconsistencies: List[Dict[str, Any]] = []

        if state_key:
            current_value = current_state.get(state_key)
            snapshot = self._state_snapshots.get(state_key)
            if snapshot:
                snapshot_value = snapshot.get("value")
                if current_value != snapshot_value:
                    inconsistencies.append({
                        "type": "value_changed",
                        "key": state_key,
                        "expected": snapshot_value,
                        "actual": current_value,
                        "timestamp": snapshot.get("timestamp")
                    })
            self._state_snapshots[state_key] = {
                "value": current_value,
                "timestamp": now
            }
        else:
            for key, value in current_state.items():
                if key in self._state_snapshots:
                    snapshot_value = self._state_snapshots[key]["value"]
                    if value != snapshot_value:
                        inconsistencies.append({
                            "type": "value_changed",
                            "key": key,
                            "expected": snapshot_value,
                            "actual": value
                        })
                self._state_snapshots[key] = {
                    "value": value,
                    "timestamp": now
                }

        if expected_state:
            for key, expected_value in expected_state.items():
                actual_value = current_state.get(key)
                if actual_value != expected_value:
                    inconsistencies.append({
                        "type": "state_mismatch",
                        "key": key,
                        "expected": expected_value,
                        "actual": actual_value
                    })

        self._state_history.append({
            "timestamp": now,
            "state": dict(current_state),
            "inconsistencies": inconsistencies
        })

        return {
            "consistent": len(inconsistencies) == 0,
            "inconsistencies": inconsistencies,
            "validated_at": now,
            "keys_checked": len(current_state)
        }

    def detect_race_conditions(
        self,
        operations: Optional[List[Tuple[str, str]]] = None,
        shared_resources: Optional[List[str]] = None,
        operation_history: Optional[List[Dict[str, Any]]] = None
    ) -> List[RaceCondition]:
        """Detect race conditions between concurrent async operations.

        Args:
            operations: Optional list of (operation_a, operation_b) pairs to check.
            shared_resources: Resources that multiple operations may access.
            operation_history: Historical record of operation executions.

        Returns:
            List of detected RaceCondition objects.
        """
        detected_races: List[RaceCondition] = []

        if operation_history:
            for i, op_i in enumerate(operation_history):
                for op_j in operation_history[i + 1:]:
                    if self._is_concurrent(op_i, op_j):
                        resource_i = op_i.get("resource", "")
                        resource_j = op_j.get("resource", "")
                        if resource_i and resource_i == resource_j:
                            race = RaceCondition(
                                operation_a=op_i.get("name", ""),
                                operation_b=op_j.get("name", ""),
                                conflict_type="shared_resource_contention",
                                shared_resource=resource_i,
                                execution_order=[
                                    f"{op_i.get('name')}:{op_i.get('timestamp')}",
                                    f"{op_j.get('name')}:{op_j.get('timestamp')}"
                                ]
                            )
                            detected_races.append(race)
                            self._race_conditions.append(race)

        if shared_resources:
            for resource in shared_resources:
                concurrent_ops = [
                    (op_id, op) for op_id, op in self._async_operations.items()
                    if op.get("resource") == resource
                ]
                for i, (op_id_a, op_a) in enumerate(concurrent_ops):
                    for op_id_b, op_b in concurrent_ops[i + 1:]:
                        if self._operations_overlap(op_a, op_b):
                            race = RaceCondition(
                                operation_a=op_a.get("name", op_id_a),
                                operation_b=op_b.get("name", op_id_b),
                                conflict_type="resource_overlap",
                                shared_resource=resource
                            )
                            if race not in self._race_conditions:
                                detected_races.append(race)
                                self._race_conditions.append(race)

        if operations:
            for op_a, op_b in operations:
                if self._may_conflict(op_a, op_b):
                    race = RaceCondition(
                        operation_a=op_a,
                        operation_b=op_b,
                        conflict_type="potential_conflict"
                    )
                    if race not in self._race_conditions:
                        detected_races.append(race)
                        self._race_conditions.append(race)

        return detected_races

    def check_await_chains(
        self,
        chain_definitions: Optional[List[List[str]]] = None
    ) -> List[AwaitChain]:
        """Analyze await chains for cycles and unresolved dependencies.

        Args:
            chain_definitions: Optional list of await chains to analyze.

        Returns:
            List of AwaitChain objects with analysis results.
        """
        analyzed_chains: List[AwaitChain] = []

        for chain_id, chain in self._await_chains.items():
            analyzed = self._analyze_chain(chain)
            analyzed_chains.append(analyzed)

        if chain_definitions:
            for idx, steps in enumerate(chain_definitions):
                chain_id = f"chain_{idx}"
                chain = AwaitChain(
                    chain_id=chain_id,
                    steps=list(steps),
                    depth=len(steps)
                )
                analyzed = self._analyze_chain(chain)
                analyzed_chains.append(analyzed)
                self._await_chains[chain_id] = analyzed

        return analyzed_chains

    def find_unhandled_promises(
        self,
        check_window_seconds: float = 5.0
    ) -> List[UnhandledPromise]:
        """Find promises that were created but never resolved or rejected.

        Args:
            check_window_seconds: Age threshold for flagging unhandled promises.

        Returns:
            List of UnhandledPromise objects.
        """
        now = datetime.now()
        unhandled: List[UnhandledPromise] = []

        for promise_id, promise in self._unhandled_promises.items():
            age = (now - promise.created_at).total_seconds()
            if age > check_window_seconds and promise.resolution_status == "unknown":
                promise.resolution_status = "stale"
                unhandled.append(promise)

        return unhandled

    def record_state_snapshot(
        self,
        state: Dict[str, Any],
        operation_id: Optional[str] = None
    ) -> None:
        """Record a state snapshot before an async operation."""
        now = datetime.now()
        for key, value in state.items():
            self._state_snapshots[key] = {
                "value": value,
                "timestamp": now,
                "operation_id": operation_id
            }

    def record_operation(
        self,
        operation_name: str,
        resource: Optional[str] = None,
        status: str = "started"
    ) -> str:
        """Record an async operation for race condition tracking."""
        self._operation_counter += 1
        op_id = f"op_{self._operation_counter}"
        self._async_operations[op_id] = {
            "name": operation_name,
            "resource": resource,
            "status": status,
            "started_at": datetime.now()
        }
        return op_id

    def complete_operation(self, operation_id: str, success: bool = True) -> None:
        """Mark an operation as complete."""
        if operation_id in self._async_operations:
            self._async_operations[operation_id]["status"] = (
                "completed" if success else "failed"
            )
            self._async_operations[operation_id]["completed_at"] = datetime.now()

    def track_promise(
        self,
        promise_id: str,
        associated_state_key: Optional[str] = None
    ) -> None:
        """Begin tracking a promise for resolution."""
        self._unhandled_promises[promise_id] = UnhandledPromise(
            promise_id=promise_id,
            created_at=datetime.now(),
            resolution_status="pending",
            associated_state_key=associated_state_key
        )

    def resolve_promise(
        self,
        promise_id: str,
        success: bool = True,
        rejection_reason: Optional[str] = None
    ) -> None:
        """Record promise resolution."""
        if promise_id in self._unhandled_promises:
            promise = self._unhandled_promises[promise_id]
            promise.resolution_status = "resolved" if success else "rejected"
            promise.rejection_reason = rejection_reason

    def add_await_chain(self, chain_id: str, steps: List[str]) -> None:
        """Add an await chain to track."""
        self._await_chains[chain_id] = AwaitChain(
            chain_id=chain_id,
            steps=list(steps),
            depth=len(steps)
        )

    def _analyze_chain(self, chain: AwaitChain) -> AwaitChain:
        """Analyze an await chain for cycles and unresolved steps."""
        steps = chain.steps
        unresolved: List[str] = []
        seen: Set[str] = set()
        has_cycle = False

        for step in steps:
            if step in seen:
                has_cycle = True
            else:
                seen.add(step)
            if not self._step_resolved(step):
                unresolved.append(step)

        chain.has_cycles = has_cycle
        chain.unresolved_steps = unresolved
        return chain

    def _step_resolved(self, step: str) -> bool:
        """Check if an await step has been resolved."""
        return step in self._async_operations

    def _is_concurrent(self, op_a: Dict[str, Any], op_b: Dict[str, Any]) -> bool:
        """Check if two operations executed concurrently."""
        start_a = op_a.get("timestamp")
        start_b = op_b.get("timestamp")
        if start_a is None or start_b is None:
            return False
        time_diff = abs((start_a - start_b).total_seconds())
        return time_diff < 1.0

    def _operations_overlap(
        self,
        op_a: Dict[str, Any],
        op_b: Dict[str, Any]
    ) -> bool:
        """Check if two operations' execution windows overlap."""
        start_a = op_a.get("started_at")
        start_b = op_b.get("started_at")
        end_a = op_a.get("completed_at")
        end_b = op_b.get("completed_at")

        if start_a is None or start_b is None:
            return False

        if end_a is None:
            end_a = datetime.now()
        if end_b is None:
            end_b = datetime.now()

        return start_a <= end_b and start_b <= end_a

    def _may_conflict(self, op_a: str, op_b: str) -> bool:
        """Heuristic check for potential conflict between operations."""
        shared_prefix = self._shared_prefix(op_a, op_b)
        return len(shared_prefix) > 3

    def _shared_prefix(self, a: str, b: str) -> str:
        """Find shared prefix between two strings."""
        shared = []
        for ca, cb in zip(a, b):
            if ca == cb:
                shared.append(ca)
            else:
                break
        return "".join(shared)

    def get_race_conditions(self) -> List[RaceCondition]:
        """Return all detected race conditions."""
        return list(self._race_conditions)

    def get_state_history(self) -> List[Dict[str, Any]]:
        """Return the full state change history."""
        return list(self._state_history)

    def clear(self) -> None:
        """Clear all tracking state."""
        self._state_snapshots.clear()
        self._async_operations.clear()
        self._race_conditions.clear()
        self._await_chains.clear()
        self._unhandled_promises.clear()
        self._state_history.clear()
        self._operation_counter = 0
