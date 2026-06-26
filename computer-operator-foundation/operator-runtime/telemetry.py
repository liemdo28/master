"""
Telemetry Layer — records every operator run with full metadata.
"""
import json
import time
import uuid
from pathlib import Path
from typing import Optional

EVIDENCE_DIR = Path(__file__).parent / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

# In-memory telemetry store
_runs: list[dict] = []


def new_task_id() -> str:
    return f"task-{uuid.uuid4().hex[:12]}"


def new_objective_id() -> str:
    return f"obj-{uuid.uuid4().hex[:8]}"


def new_run_id() -> str:
    return f"run-{uuid.uuid4().hex[:12]}"


def new_evidence_id() -> str:
    return f"ev-{uuid.uuid4().hex[:10]}"


def create_run(
    task_id: str,
    objective_id: str,
    adapter: str,
    mode: str,
    target: str,
    policy_decision: dict,
) -> dict:
    """Create a new telemetry run record."""
    run = {
        "run_id": new_run_id(),
        "task_id": task_id,
        "objective_id": objective_id,
        "adapter": adapter,
        "mode": mode,
        "target": target,
        "start_time": time.time(),
        "start_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "end_time": None,
        "end_iso": None,
        "duration_ms": None,
        "action_count": 0,
        "success": False,
        "errors": [],
        "screenshots": [],
        "downloads": [],
        "evidence_ids": [],
        "policy_decision": policy_decision,
        "status": "RUNNING",
        "actions": [],
    }
    _runs.append(run)
    return run


def record_action(run_id: str, action_type: str, detail: str, success: bool = True, error: Optional[str] = None):
    """Record a single action within a run."""
    for r in _runs:
        if r["run_id"] == run_id:
            r["action_count"] += 1
            entry = {
                "seq": r["action_count"],
                "type": action_type,
                "detail": detail,
                "success": success,
                "error": error,
                "timestamp": time.time(),
            }
            r["actions"].append(entry)
            if not success and error:
                r["errors"].append(error)
            return entry
    return None


def add_screenshot(run_id: str, path: str):
    """Add a screenshot reference to a run."""
    for r in _runs:
        if r["run_id"] == run_id:
            r["screenshots"].append(path)
            return


def add_download(run_id: str, path: str):
    """Add a download reference to a run."""
    for r in _runs:
        if r["run_id"] == run_id:
            r["downloads"].append(path)
            return


def add_evidence(run_id: str, evidence_id: str):
    """Add an evidence ID reference to a run."""
    for r in _runs:
        if r["run_id"] == run_id:
            r["evidence_ids"].append(evidence_id)
            return


def complete_run(run_id: str, success: bool = True):
    """Mark a run as complete."""
    for r in _runs:
        if r["run_id"] == run_id:
            r["end_time"] = time.time()
            r["end_iso"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            r["duration_ms"] = round((r["end_time"] - r["start_time"]) * 1000, 1)
            r["success"] = success
            r["status"] = "COMPLETED" if success else "FAILED"
            # Persist to disk
            _persist_run(r)
            return r
    return None


def fail_run(run_id: str, error: str):
    """Mark a run as failed."""
    for r in _runs:
        if r["run_id"] == run_id:
            r["errors"].append(error)
    return complete_run(run_id, success=False)


def get_run(run_id: str) -> Optional[dict]:
    for r in _runs:
        if r["run_id"] == run_id:
            return r
    return None


def get_all_runs() -> list[dict]:
    return list(_runs)


def get_dashboard_stats() -> dict:
    """Return dashboard-level telemetry stats."""
    runs = _runs
    active = [r for r in runs if r["status"] == "RUNNING"]
    completed = [r for r in runs if r["status"] == "COMPLETED"]
    failed = [r for r in runs if r["status"] == "FAILED"]
    policy_blocks = [r for r in runs if not r["policy_decision"].get("ok", True)]

    durations = [r["duration_ms"] for r in completed if r["duration_ms"] is not None]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    evidence_count = sum(len(r.get("evidence_ids", [])) for r in runs)
    screenshot_count = sum(len(r.get("screenshots", [])) for r in runs)

    return {
        "total_runs": len(runs),
        "active_runs": len(active),
        "completed_runs": len(completed),
        "failed_runs": len(failed),
        "policy_blocks": len(policy_blocks),
        "evidence_count": evidence_count,
        "screenshot_count": screenshot_count,
        "average_duration_ms": avg_duration,
        "last_run": runs[-1] if runs else None,
        "active_run_list": [{"run_id": r["run_id"], "target": r["target"], "status": r["status"]} for r in active],
    }


def _persist_run(run: dict):
    """Persist run to disk as JSON."""
    run_file = EVIDENCE_DIR / f"{run['run_id']}_telemetry.json"
    run_file.write_text(json.dumps(run, indent=2, default=str), encoding="utf-8")
