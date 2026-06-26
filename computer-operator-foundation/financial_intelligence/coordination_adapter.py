"""Coordination Adapter — bridges Financial Intelligence to Executive Coordination.

Creates tasks, risks, and alerts in the coordination system based on
warehouse state. Integrates with Phase 0 Objective Registry, Task Registry,
Evidence Registry, and Approval Registry.

CTO Rule: Only sends derived signals, never raw financial data.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from .source_health_engine import evaluate_all_sources, get_stale_sources, get_missing_sources
from .financial_risk_engine import detect_risks
from . import warehouse_client as wh


EVIDENCE_DIR = Path(__file__).resolve().parent.parent / "operator-runtime" / "evidence"
EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

INTEL_EVIDENCE_DIR = Path(__file__).resolve().parent / "evidence"
INTEL_EVIDENCE_DIR.mkdir(exist_ok=True)

_coordination_tasks: list[dict] = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:10]}"


def create_fin_task(title: str, owner: str, priority: str,
                    source_signals: list[dict],
                    description: str = "") -> dict:
    """Create a FIN coordination task from warehouse signals."""
    task_id = _gen_id("FIN")
    task = {
        "coord_task_id": task_id,
        "task_name": title,
        "objective_id": "OBJ-FIN-DATA-GOVERNANCE",
        "target": "financial_warehouse",
        "approval_level": "READ_ONLY",
        "operator_type": "financial_intelligence",
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
    task_file = EVIDENCE_DIR / f"{task_id}_coordination.json"
    task_file.write_text(json.dumps(task, indent=2, default=str), encoding="utf-8")
    intel_file = INTEL_EVIDENCE_DIR / f"{task_id}_coordination.json"
    intel_file.write_text(json.dumps(task, indent=2, default=str), encoding="utf-8")
    return task


def create_fin_risk(risk_id: str, severity: str, description: str,
                    evidence: dict) -> dict:
    """Create a FIN risk entry for the Objective Registry."""
    task_id = _gen_id("FIN-RISK")
    risk = {
        "coord_task_id": task_id,
        "task_name": f"FIN RISK: {risk_id}",
        "objective_id": "OBJ-FIN-RISK-GOVERNANCE",
        "target": "financial_warehouse",
        "approval_level": "READ_ONLY",
        "operator_type": "financial_intelligence",
        "state": "CREATED",
        "created_at": time.time(),
        "created_iso": _now_iso(),
        "updated_at": time.time(),
        "owner": "data_engineering",
        "priority": severity,
        "description": description,
        "risk_type": risk_id,
        "evidence": evidence,
        "evidence_ids": [],
        "state_history": [{"state": "CREATED", "timestamp": time.time()}],
    }
    _coordination_tasks.append(risk)
    task_file = EVIDENCE_DIR / f"{task_id}_coordination.json"
    task_file.write_text(json.dumps(risk, indent=2, default=str), encoding="utf-8")
    return risk


def create_executive_alert(severity: str, title: str, description: str) -> dict:
    """Create an executive-level alert for the Approval Registry."""
    alert_id = _gen_id("EXEC-ALERT")
    alert = {
        "coord_task_id": alert_id,
        "task_name": f"EXEC ALERT: {title}",
        "objective_id": "OBJ-EXEC-FINANCIAL",
        "target": "executive_leadership",
        "approval_level": "PRODUCTION_WRITE",
        "operator_type": "financial_intelligence",
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
    task_file = EVIDENCE_DIR / f"{alert_id}_coordination.json"
    task_file.write_text(json.dumps(alert, indent=2, default=str), encoding="utf-8")
    return alert


def scan_and_emit() -> dict:
    """Scan warehouse state and emit coordination signals.

    Main entry point: reads freshness, sources, risks, then creates
    tasks, risks, and alerts in the coordination system.
    """
    emitted = {
        "tasks_created": [],
        "risks_created": [],
        "alerts_created": [],
        "ts": _now_iso(),
    }

    # 1. Stale sources → FIN tasks
    stale = get_stale_sources()
    for src in stale:
        task = create_fin_task(
            title=f"{src['source_name']} source stale — investigate",
            owner="data_engineering",
            priority="MEDIUM-HIGH",
            source_signals=[{
                "source": src["source"],
                "status": src["status"],
                "age_days": src["age_days"],
            }],
            description=(f"Source {src['source']} has been STALE for "
                         f"{src['age_days']} days (expected: "
                         f"{src['expected_cadence']})."),
        )
        emitted["tasks_created"].append(task["coord_task_id"])

    # 2. Missing connectors → FIN tasks
    missing = get_missing_sources()
    connectorless = ["toast", "doordash", "payroll", "ga4", "gsc"]
    for src in missing:
        if src["source"] in connectorless:
            task = create_fin_task(
                title=f"Build connector: {src['source_name']}",
                owner="data_engineering",
                priority="MEDIUM",
                source_signals=[{"source": src["source"], "status": src["status"]}],
                description=f"No connector for {src['source_name']}.",
            )
            emitted["tasks_created"].append(task["coord_task_id"])

    # 3. Risks → FIN risk entries
    risks = detect_risks()
    for risk in risks:
        entry = create_fin_risk(
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
            title=f"{len(p0)} critical financial risks detected",
            description="; ".join(r["description"] for r in p0),
        )
        emitted["alerts_created"].append(alert["coord_task_id"])

    return emitted


def get_coordination_summary() -> dict:
    """Get summary of all coordination tasks created by this adapter."""
    by_priority = {}
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
