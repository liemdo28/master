"""OSS Governance Coordination Adapter — bridges to Executive Coordination.

Mirrors financial_intelligence/coordination_adapter.py pattern:
- Creates tasks, risks, and alerts in coordination system
- Operates on registry state and pipeline health
- Only sends derived signals, never raw data

CTO Rule: All signals must be derivable from the registry; no fabrication.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from . import registry
from . import scorecard
from . import lifecycle_engine

ADAPTER_DIR = Path(__file__).resolve().parent
EVIDENCE_DIR = ADAPTER_DIR / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

# Also write to operator-runtime/evidence for cross-division visibility
EXEC_EVIDENCE_DIR = (
    Path(__file__).resolve().parent.parent / "operator-runtime" / "evidence"
)
EXEC_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory task ledger (mirrors financial_intelligence pattern)
_coordination_tasks: list[dict] = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


# ---------------------------------------------------------------------------
# Task creators
# ---------------------------------------------------------------------------

def create_oss_task(title: str, owner: str, priority: str,
                    source_signals: list[dict],
                    description: str = "") -> dict:
    """Create an OSS coordination task from registry signals."""
    task_id = _gen_id("OSS")
    task = {
        "coord_task_id": task_id,
        "task_name": title,
        "objective_id": "OBJ-OSS-GOVERNANCE",
        "target": "oss_registry",
        "approval_level": "READ_ONLY",
        "operator_type": "oss_governance",
        "state": "CREATED",
        "created_at": time.time(),
        "created_iso": _now_iso(),
        "updated_at": time.time(),
        "owner": owner,
        "priority": priority,
        "description": description,
        "source_signals": source_signals,
        "evidence_ids": [],
        "state_history": [{"state": "CREATED", "timestamp": time.time()}],
    }
    _coordination_tasks.append(task)

    # Write to both evidence dirs
    task_file = EVIDENCE_DIR / f"{task_id}_coordination.json"
    task_file.write_text(json.dumps(task, indent=2, default=str), encoding="utf-8")
    exec_file = EXEC_EVIDENCE_DIR / f"{task_id}_coordination.json"
    exec_file.write_text(json.dumps(task, indent=2, default=str), encoding="utf-8")
    return task


def create_oss_risk(risk_id: str, severity: str, description: str,
                    evidence: dict) -> dict:
    """Create an OSS risk entry for the Objective Registry."""
    task_id = _gen_id("OSS-RISK")
    risk = {
        "coord_task_id": task_id,
        "task_name": f"OSS RISK: {risk_id}",
        "objective_id": "OBJ-OSS-RISK",
        "target": "oss_registry",
        "approval_level": "READ_ONLY",
        "operator_type": "oss_governance",
        "state": "CREATED",
        "created_at": time.time(),
        "created_iso": _now_iso(),
        "updated_at": time.time(),
        "owner": "engineering_lead",
        "priority": severity,
        "description": description,
        "risk_type": risk_id,
        "evidence": evidence,
        "evidence_ids": [],
        "state_history": [{"state": "CREATED", "timestamp": time.time()}],
    }
    _coordination_tasks.append(risk)

    risk_file = EVIDENCE_DIR / f"{task_id}_coordination.json"
    risk_file.write_text(json.dumps(risk, indent=2, default=str), encoding="utf-8")
    exec_file = EXEC_EVIDENCE_DIR / f"{task_id}_coordination.json"
    exec_file.write_text(json.dumps(risk, indent=2, default=str), encoding="utf-8")
    return risk


def create_executive_alert(severity: str, title: str, description: str) -> dict:
    """Create an executive-level alert for the Approval Registry."""
    alert_id = _gen_id("EXEC-ALERT")
    alert = {
        "coord_task_id": alert_id,
        "task_name": f"EXEC ALERT: {title}",
        "objective_id": "OBJ-EXEC-OSS",
        "target": "executive_leadership",
        "approval_level": "PRODUCTION_WRITE",
        "operator_type": "oss_governance",
        "state": "CREATED",
        "created_at": time.time(),
        "created_iso": _now_iso(),
        "updated_at": time.time(),
        "owner": "executive_lead",
        "priority": severity,
        "description": description,
        "alert_type": "EXECUTIVE",
        "evidence_ids": [],
        "state_history": [{"state": "CREATED", "timestamp": time.time()}],
    }
    _coordination_tasks.append(alert)

    alert_file = EVIDENCE_DIR / f"{alert_id}_coordination.json"
    alert_file.write_text(json.dumps(alert, indent=2, default=str), encoding="utf-8")
    exec_file = EXEC_EVIDENCE_DIR / f"{alert_id}_coordination.json"
    exec_file.write_text(json.dumps(alert, indent=2, default=str), encoding="utf-8")
    return alert


# ---------------------------------------------------------------------------
# Risk detection
# ---------------------------------------------------------------------------

def detect_risks() -> list[dict]:
    """Detect risks from current registry state.

    Mirrors financial_risk_engine.detect_risks() pattern.
    Returns list of risk dicts (no side effects).
    """
    risks = []
    all_projects = registry.list_all()

    # HIGH_LICENSE_RISK: any project with HIGH license risk
    for p in all_projects:
        if p.get("license_risk") == "HIGH" and p.get("status") == "ACTIVE":
            risks.append({
                "risk": "HIGH_LICENSE_RISK",
                "severity": "P1",
                "project_id": p["project_id"],
                "project_name": p["name"],
                "description": f"{p['name']} uses {p['license']} license (HIGH risk)",
                "evidence": {"license": p["license"], "owner_division": p["owner_division"]},
            })

    # STUCK_PIPELINE: too many projects stuck in early stages
    pipeline = lifecycle_engine.get_pipeline_summary()
    if pipeline["pipeline_health"] == "BLOCKED":
        risks.append({
            "risk": "STUCK_PIPELINE",
            "severity": "P2",
            "description": (
                f"Pipeline is BLOCKED: {pipeline['stuck_in_early']} projects "
                f"stuck in early stages vs {pipeline['in_active_use']} in active use"
            ),
            "evidence": pipeline,
        })

    # LOW_ACTIVITY_PROJECT: production-stage project with no recent maintenance
    for p in all_projects:
        if p["lifecycle_stage"] == "PRODUCTION":
            score = scorecard.get_scorecard(p["project_id"])
            if score:
                comm = score.get("maintenance_cost", {}).get("components", {}).get("release_freq", {})
                if comm.get("label") == "slow":
                    risks.append({
                        "risk": "LOW_ACTIVITY_PROJECT",
                        "severity": "P2",
                        "project_id": p["project_id"],
                        "project_name": p["name"],
                        "description": f"{p['name']} in PRODUCTION but release cadence is slow",
                        "evidence": {"scorecard": comm},
                    })

    # EMPTY_REGISTRY: nothing registered yet
    if len(all_projects) == 0:
        risks.append({
            "risk": "EMPTY_REGISTRY",
            "severity": "P0",
            "description": "OSS Registry is empty — no candidates tracked",
            "evidence": {"total": 0},
        })

    # HIGH_RISK_PROJECT: scorecard with HIGH risk verdict
    for p in all_projects:
        sc = scorecard.get_scorecard(p["project_id"])
        if sc and sc.get("risk", {}).get("verdict") == "HIGH":
            risks.append({
                "risk": "HIGH_RISK_PROJECT",
                "severity": "P1",
                "project_id": p["project_id"],
                "project_name": p["name"],
                "description": f"{p['name']} scored HIGH risk in scorecard",
                "evidence": {"composite_score": sc["risk"]["composite_score"]},
            })

    return risks


# ---------------------------------------------------------------------------
# Main scan
# ---------------------------------------------------------------------------

def scan_and_emit() -> dict:
    """Scan registry state and emit coordination signals.

    Mirrors financial_intelligence.coordination_adapter.scan_and_emit().
    """
    emitted = {
        "tasks_created": [],
        "risks_created": [],
        "alerts_created": [],
        "ts": _now_iso(),
    }

    # 1. Stuck projects → tasks
    pipeline = lifecycle_engine.get_pipeline_summary()
    for project_id in [p["project_id"] for p in registry.list_all()
                        if p["lifecycle_stage"] in ("DISCOVERY", "AUDIT", "ROI")]:
        p = registry.get_project(project_id)
        task = create_oss_task(
            title=f"Advance {p['name']} past {p['lifecycle_stage']}",
            owner=p["owner_division"].lower() + "_lead",
            priority="MEDIUM",
            source_signals=[{
                "project_id": project_id,
                "stage": p["lifecycle_stage"],
                "days_in_stage": "unknown",
            }],
            description=f"{p['name']} has been in {p['lifecycle_stage']} — advance gate.",
        )
        emitted["tasks_created"].append(task["coord_task_id"])

    # 2. Active production projects without scorecards → tasks
    for p in registry.list_all():
        if p["lifecycle_stage"] in ("PRODUCTION", "MAINTENANCE"):
            sc = scorecard.get_scorecard(p["project_id"])
            if not sc:
                task = create_oss_task(
                    title=f"Score {p['name']} — production without scorecard",
                    owner=p["owner_division"].lower() + "_lead",
                    priority="MEDIUM-HIGH",
                    source_signals=[{
                        "project_id": p["project_id"],
                        "stage": p["lifecycle_stage"],
                    }],
                    description=f"{p['name']} is in {p['lifecycle_stage']} but has no scorecard.",
                )
                emitted["tasks_created"].append(task["coord_task_id"])

    # 3. Risks → risk entries
    risks = detect_risks()
    for risk in risks:
        entry = create_oss_risk(
            risk_id=risk["risk"],
            severity=risk["severity"],
            description=risk["description"],
            evidence=risk.get("evidence", {}),
        )
        emitted["risks_created"].append(entry["coord_task_id"])

    # 4. P0 risks → executive alert
    p0 = [r for r in risks if r["severity"] == "P0"]
    if p0:
        alert = create_executive_alert(
            severity="P0",
            title=f"{len(p0)} critical OSS governance risks detected",
            description="; ".join(r["description"] for r in p0),
        )
        emitted["alerts_created"].append(alert["coord_task_id"])

    return emitted


def get_coordination_summary() -> dict:
    """Get summary of all coordination tasks created by this adapter."""
    by_priority: dict[str, int] = {}
    for t in _coordination_tasks:
        p = t.get("priority", "UNKNOWN")
        by_priority[p] = by_priority.get(p, 0) + 1

    return {
        "total_tasks": len(_coordination_tasks),
        "by_priority": by_priority,
        "tasks": [
            {
                "id": t["coord_task_id"],
                "name": t["task_name"],
                "state": t["state"],
                "priority": t["priority"],
                "owner": t["owner"],
            }
            for t in _coordination_tasks
        ],
        "ts": _now_iso(),
    }
