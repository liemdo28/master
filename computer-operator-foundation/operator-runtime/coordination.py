"""
Executive Coordination Integration — manages task lifecycle through coordination stages.
"""
import time
import uuid
from typing import Optional

TASK_STATES = {
    "CREATED",
    "DISPATCHED",
    "IN_PROGRESS",
    "DONE",
    "FAILED",
    "CANCELLED",
}

# In-memory coordination store
_tasks: list[dict] = []


def create_coordination_task(
    task_name: str,
    objective_id: str,
    target: str,
    approval_level: str,
    operator_type: str = "web",
) -> dict:
    """Create a new coordination task."""
    task = {
        "coord_task_id": f"coord-{uuid.uuid4().hex[:10]}",
        "task_name": task_name,
        "objective_id": objective_id,
        "target": target,
        "approval_level": approval_level,
        "operator_type": operator_type,
        "state": "CREATED",
        "created_at": time.time(),
        "updated_at": time.time(),
        "state_history": [
            {"state": "CREATED", "timestamp": time.time()}
        ],
        "evidence_ids": [],
        "run_ids": [],
        "error": None,
    }
    _tasks.append(task)
    return task


def transition_task(coord_task_id: str, new_state: str, error: Optional[str] = None) -> dict:
    """Transition a task to a new state."""
    if new_state not in TASK_STATES:
        raise ValueError(f"Invalid state: {new_state}")

    for t in _tasks:
        if t["coord_task_id"] == coord_task_id:
            t["state"] = new_state
            t["updated_at"] = time.time()
            t["state_history"].append({
                "state": new_state,
                "timestamp": time.time(),
            })
            if error:
                t["error"] = error
            return t
    raise ValueError(f"Task not found: {coord_task_id}")


def dispatch_task(coord_task_id: str) -> dict:
    return transition_task(coord_task_id, "DISPATCHED")


def start_task(coord_task_id: str) -> dict:
    return transition_task(coord_task_id, "IN_PROGRESS")


def complete_task(coord_task_id: str) -> dict:
    return transition_task(coord_task_id, "DONE")


def fail_task(coord_task_id: str, error: str) -> dict:
    return transition_task(coord_task_id, "FAILED", error=error)


def attach_evidence(coord_task_id: str, evidence_id: str):
    for t in _tasks:
        if t["coord_task_id"] == coord_task_id:
            t["evidence_ids"].append(evidence_id)
            return


def attach_run(coord_task_id: str, run_id: str):
    for t in _tasks:
        if t["coord_task_id"] == coord_task_id:
            t["run_ids"].append(run_id)
            return


def get_task(coord_task_id: str) -> Optional[dict]:
    for t in _tasks:
        if t["coord_task_id"] == coord_task_id:
            return t
    return None


def get_all_tasks() -> list[dict]:
    return list(_tasks)


def get_dashboard_summary() -> dict:
    """Executive coordination dashboard summary."""
    by_state = {}
    for t in _tasks:
        s = t["state"]
        by_state[s] = by_state.get(s, 0) + 1
    return {
        "total_tasks": len(_tasks),
        "by_state": by_state,
        "created": by_state.get("CREATED", 0),
        "dispatched": by_state.get("DISPATCHED", 0),
        "in_progress": by_state.get("IN_PROGRESS", 0),
        "completed": by_state.get("DONE", 0),
        "failed": by_state.get("FAILED", 0),
        "tasks": [
            {
                "coord_task_id": t["coord_task_id"],
                "task_name": t["task_name"],
                "state": t["state"],
                "target": t["target"],
                "evidence_count": len(t["evidence_ids"]),
            }
            for t in _tasks
        ],
    }
