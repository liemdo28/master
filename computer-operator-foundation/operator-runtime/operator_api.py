"""
Operator Runtime API — Flask server exposing runtime endpoints.

Reads evidence from disk so that the dashboard reflects the state of all
previously executed demos (whose in-memory stores have exited).

Endpoints:
- GET /api/operator/health
- GET /api/operator/tasks
- GET /api/operator/runs
- GET /api/operator/evidence
- GET /api/operator/dashboard
- GET /api/operator/coordination
"""
import json
import time
from pathlib import Path
from flask import Flask, jsonify

HERE = Path(__file__).resolve().parent
EVIDENCE_DIR = HERE / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)


app = Flask(__name__)


def _load_runs_from_disk() -> list[dict]:
    """Load all run telemetry from disk."""
    runs = []
    for f in EVIDENCE_DIR.glob("*_telemetry.json"):
        try:
            runs.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    return runs


def _load_evidence_from_disk() -> list[dict]:
    """Load all evidence registry entries from disk."""
    evidence = []
    # evidence files match ev-*.json but not *telemetry*.json
    for f in EVIDENCE_DIR.glob("ev-*.json"):
        try:
            evidence.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            pass
    return evidence


def _load_coordination_from_disk() -> list[dict]:
    """Load coordination tasks from persisted disk files (only operator runtime ones)."""
    tasks = []
    seen = set()
    for f in EVIDENCE_DIR.glob("coord-*_coordination.json"):
        try:
            t = json.loads(f.read_text(encoding="utf-8"))
            tid = t.get("coord_task_id")
            if tid in seen:
                continue
            seen.add(tid)
            t.setdefault("evidence_count", len(t.get("evidence_ids", [])))
            t.setdefault("run_count", len(t.get("run_ids", [])))
            t.setdefault("approval_level", "READ_ONLY")
            t.setdefault("operator_type", "web")
            tasks.append(t)
        except Exception:
            pass
    return tasks


@app.get("/api/operator/health")
def health():
    runs = _load_runs_from_disk()
    evidence = _load_evidence_from_disk()
    return jsonify({
        "status": "ok",
        "service": "operator-runtime",
        "version": "1.0.0",
        "phase": "2B",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "runs_on_disk": len(runs),
        "evidence_on_disk": len(evidence),
        "components": {
            "policy_guard": "ok",
            "telemetry": "ok",
            "evidence_registry": "ok",
            "coordination": "ok",
            "playwright_adapter": "ok",
        },
    })


@app.get("/api/operator/tasks")
def tasks():
    coord_tasks = _load_coordination_from_disk()
    return jsonify({
        "count": len(coord_tasks),
        "tasks": [
            {
                "coord_task_id": t["coord_task_id"],
                "task_name": t["task_name"],
                "state": t["state"],
                "target": t["target"],
                "approval_level": t["approval_level"],
                "evidence_count": t["evidence_count"],
                "run_count": t["run_count"],
            }
            for t in coord_tasks
        ],
    })


@app.get("/api/operator/runs")
def runs():
    all_runs = _load_runs_from_disk()
    return jsonify({
        "count": len(all_runs),
        "runs": [
            {
                "run_id": r["run_id"],
                "task_id": r["task_id"],
                "target": r["target"],
                "adapter": r["adapter"],
                "mode": r["mode"],
                "status": r["status"],
                "success": r["success"],
                "duration_ms": r["duration_ms"],
                "action_count": r["action_count"],
                "evidence_count": len(r.get("evidence_ids", [])),
                "policy_decision": r["policy_decision"],
                "screenshots": r.get("screenshots", []),
                "downloads": r.get("downloads", []),
            }
            for r in all_runs
        ],
    })


@app.get("/api/operator/evidence")
def evidence():
    all_evidence = _load_evidence_from_disk()
    by_type = {}
    for e in all_evidence:
        t = e.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1
    return jsonify({
        "summary": {
            "total": len(all_evidence),
            "by_type": by_type,
            "latest": all_evidence[-1] if all_evidence else None,
        },
        "count": len(all_evidence),
        "evidence": [
            {
                "evidence_id": e["evidence_id"],
                "type": e["type"],
                "run_id": e.get("run_id"),
                "task_id": e.get("task_id"),
                "file_path": e.get("file_path"),
                "description": e.get("description"),
                "registered_iso": e.get("registered_iso"),
            }
            for e in all_evidence
        ],
    })


@app.get("/api/operator/dashboard")
def dashboard():
    runs = _load_runs_from_disk()
    evidence = _load_evidence_from_disk()
    coord_tasks = _load_coordination_from_disk()

    active = [r for r in runs if r.get("status") == "RUNNING"]
    completed = [r for r in runs if r.get("status") == "COMPLETED"]
    failed = [r for r in runs if r.get("status") == "FAILED"]
    policy_blocks = [r for r in runs if not r.get("policy_decision", {}).get("ok", True)]

    durations = [r.get("duration_ms", 0) for r in completed if r.get("duration_ms") is not None]
    avg_duration = round(sum(durations) / len(durations), 1) if durations else 0

    evidence_count = sum(len(r.get("evidence_ids", [])) for r in runs)
    screenshot_count = sum(len(r.get("screenshots", [])) for r in runs)

    by_type = {}
    for e in evidence:
        t = e.get("type", "unknown")
        by_type[t] = by_type.get(t, 0) + 1

    last_run = runs[-1] if runs else None
    last_run_summary = None
    if last_run:
        last_run_summary = {
            "run_id": last_run["run_id"],
            "target": last_run["target"],
            "status": last_run["status"],
            "duration_ms": last_run.get("duration_ms"),
        }

    by_state = {}
    for t in coord_tasks:
        s = t["state"]
        by_state[s] = by_state.get(s, 0) + 1

    return jsonify({
        "telemetry": {
            "active_runs": len(active),
            "completed_runs": len(completed),
            "failed_runs": len(failed),
            "policy_blocks": len(policy_blocks),
            "average_duration_ms": avg_duration,
            "screenshot_count": screenshot_count,
            "total_runs": len(runs),
        },
        "evidence": {
            "evidence_count": evidence_count,
            "total_registry": len(evidence),
            "by_type": by_type,
        },
        "coordination": {
            "total_tasks": len(coord_tasks),
            "completed": by_state.get("COMPLETED", 0) + by_state.get("DONE", 0),
            "in_progress": by_state.get("RUNNING", 0) + by_state.get("IN_PROGRESS", 0),
            "failed": by_state.get("FAILED", 0),
            "by_state": by_state,
        },
        "last_run": last_run_summary,
        "active_run_list": [
            {"run_id": r["run_id"], "target": r["target"], "status": r["status"]}
            for r in active
        ],
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })


@app.get("/api/operator/coordination")
def coordination_endpoint():
    coord_tasks = _load_coordination_from_disk()
    by_state = {}
    for t in coord_tasks:
        s = t["state"]
        by_state[s] = by_state.get(s, 0) + 1
    return jsonify({
        "total_tasks": len(coord_tasks),
        "by_state": by_state,
        "created": by_state.get("CREATED", 0),
        "dispatched": by_state.get("DISPATCHED", 0),
        "in_progress": by_state.get("IN_PROGRESS", 0) + by_state.get("RUNNING", 0),
        "completed": by_state.get("COMPLETED", 0) + by_state.get("DONE", 0),
        "failed": by_state.get("FAILED", 0),
        "tasks": [
            {
                "coord_task_id": t["coord_task_id"],
                "task_name": t["task_name"],
                "state": t["state"],
                "target": t["target"],
                "evidence_count": t["evidence_count"],
            }
            for t in coord_tasks
        ],
    })


@app.get("/")
def index():
    return jsonify({
        "service": "Mi Operator Runtime",
        "phase": "2B — Live Execution Proof",
        "endpoints": [
            "/api/operator/health",
            "/api/operator/tasks",
            "/api/operator/runs",
            "/api/operator/evidence",
            "/api/operator/dashboard",
            "/api/operator/coordination",
        ],
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8765, debug=False)