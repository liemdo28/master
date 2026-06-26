"""OSS Lifecycle Engine — orchestrates projects through 8 stages.

Stage progression:
    DISCOVERY → AUDIT → ROI → ARCHITECTURE_REVIEW → PILOT →
    PRODUCTION → MAINTENANCE → RETIRED

Each transition requires an evidence entry and a stage gate check.
The engine never auto-advances: explicit calls only, matching the
"owner approves" governance rule from Section 3.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from . import registry

LIFECYCLE_DIR = Path(__file__).resolve().parent
EVIDENCE_DIR = LIFECYCLE_DIR / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

# Stage-specific gates
STAGE_GATES = {
    "DISCOVERY": {
        "requires": [],
        "description": "Initial candidate identification",
        "next_action": "Conduct codebase audit",
    },
    "AUDIT": {
        "requires": ["DISCOVERY"],
        "description": "Code quality, dependencies, and licensing audit",
        "next_action": "Scorecard ROI evaluation",
    },
    "ROI": {
        "requires": ["AUDIT"],
        "description": "Cost/benefit analysis completed",
        "next_action": "Architecture review",
    },
    "ARCHITECTURE_REVIEW": {
        "requires": ["ROI"],
        "description": "Integration design approved",
        "next_action": "Begin pilot deployment",
    },
    "PILOT": {
        "requires": ["ARCHITECTURE_REVIEW"],
        "description": "Limited-scope deployment",
        "next_action": "Promote to production",
    },
    "PRODUCTION": {
        "requires": ["PILOT"],
        "description": "Full deployment in active use",
        "next_action": "Establish maintenance cadence",
    },
    "MAINTENANCE": {
        "requires": ["PRODUCTION"],
        "description": "Ongoing updates and monitoring",
        "next_action": "Plan replacement or retire",
    },
    "RETIRED": {
        "requires": ["MAINTENANCE", "PRODUCTION", "PILOT"],  # can be retired from any active stage
        "description": "Decommissioned, no longer in use",
        "next_action": None,
    },
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id() -> str:
    return f"LIFECYCLE-{uuid.uuid4().hex[:10]}"


def can_advance(project_id: str, target_stage: str) -> dict:
    """Check if a project can advance to the target stage.

    Returns dict with 'allowed', 'reason', and 'gate' fields.
    """
    project = registry.get_project(project_id)
    if not project:
        return {"allowed": False, "reason": f"Project not found: {project_id}"}

    current = project["lifecycle_stage"]

    if current == "RETIRED":
        return {"allowed": False, "reason": "RETIRED is terminal — cannot advance further"}

    if target_stage == "RETIRED":
        return {"allowed": True, "reason": "Retirement is allowed from any active stage"}

    if target_stage not in STAGE_GATES:
        return {"allowed": False, "reason": f"Invalid stage: {target_stage}"}

    # Must be one step forward or same stage
    current_idx = registry.LIFECYCLE_STAGES.index(current)
    target_idx = registry.LIFECYCLE_STAGES.index(target_stage)

    if target_idx <= current_idx:
        return {"allowed": False, "reason": f"Already at or past {target_stage} (current: {current})"}

    if target_idx > current_idx + 1:
        return {"allowed": False, "reason": f"Cannot skip stages from {current} to {target_stage}"}

    return {
        "allowed": True,
        "reason": "Stage gate satisfied",
        "gate": STAGE_GATES[target_stage],
    }


def advance_stage(
    project_id: str,
    target_stage: str,
    approver: str,
    notes: str = "",
) -> dict:
    """Advance a project to the target stage.

    Emits evidence and updates the registry.
    """
    gate_check = can_advance(project_id, target_stage)
    if not gate_check["allowed"]:
        raise ValueError(f"Cannot advance: {gate_check['reason']}")

    # Apply stage transition via registry
    project = registry.update_lifecycle_stage(project_id, target_stage)

    # Write lifecycle evidence
    lifecycle_event = {
        "event_id": _gen_id(),
        "project_id": project_id,
        "project_name": project["name"],
        "from_stage": project["stage_history"][-2]["stage"] if len(project["stage_history"]) >= 2 else None,
        "to_stage": target_stage,
        "approver": approver,
        "notes": notes,
        "gate": STAGE_GATES[target_stage],
        "ts": time.time(),
        "iso": _now_iso(),
    }
    evidence_file = EVIDENCE_DIR / f"{lifecycle_event['event_id']}.json"
    evidence_file.write_text(json.dumps(lifecycle_event, indent=2, default=str), encoding="utf-8")

    return lifecycle_event


def retire(project_id: str, reason: str, approver: str) -> dict:
    """Retire a project — terminal stage."""
    if not reason:
        raise ValueError("Retirement requires a non-empty reason")

    project = registry.retire_project(project_id, reason=reason)

    lifecycle_event = {
        "event_id": _gen_id(),
        "project_id": project_id,
        "project_name": project["name"],
        "from_stage": "ACTIVE",
        "to_stage": "RETIRED",
        "approver": approver,
        "notes": reason,
        "reason": reason,
        "ts": time.time(),
        "iso": _now_iso(),
    }
    evidence_file = EVIDENCE_DIR / f"{lifecycle_event['event_id']}.json"
    evidence_file.write_text(json.dumps(lifecycle_event, indent=2, default=str), encoding="utf-8")

    return lifecycle_event


def get_stage_gate(stage: str) -> dict:
    """Get the gate requirements for a stage."""
    return STAGE_GATES.get(stage, {})


def get_pipeline_summary() -> dict:
    """Pipeline summary for the dashboard."""
    all_projects = registry.list_all()
    by_stage = registry.count_by_stage()

    # Calculate pipeline health: how many projects stuck in DISCOVERY/AUDIT
    stuck_count = sum(by_stage.get(s, 0) for s in ["DISCOVERY", "AUDIT", "ROI"])
    active_count = sum(by_stage.get(s, 0) for s in ["ARCHITECTURE_REVIEW", "PILOT", "PRODUCTION", "MAINTENANCE"])
    retired_count = by_stage.get("RETIRED", 0)

    return {
        "total_projects": len(all_projects),
        "by_stage": by_stage,
        "stuck_in_early": stuck_count,
        "in_active_use": active_count,
        "retired": retired_count,
        "pipeline_health": (
            "HEALTHY" if stuck_count < active_count else
            "SLOW" if stuck_count <= active_count * 2 else
            "BLOCKED"
        ),
        "ts": _now_iso(),
    }


def list_lifecycle_events() -> list[dict]:
    """List all lifecycle events from evidence."""
    events = []
    for f in sorted(EVIDENCE_DIR.glob("LIFECYCLE-*.json")):
        events.append(json.loads(f.read_text(encoding="utf-8")))
    return events
