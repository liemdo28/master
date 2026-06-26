"""Financial Risk Engine — detects risks from warehouse source health.

Detects:
- Revenue source offline (Toast/DoorDash/QB BLOCKED/STALE)
- Payroll missing
- QB stale
- Warehouse stale
- Missing snapshots
- Missing connectors

Severity tiers: P0 (critical), P1 (high), P2 (medium), P3 (low)
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from . import warehouse_client as wh
from .source_health_engine import (
    evaluate_all_sources, _age_days, EXPECTED_CADENCE,
)
from .revenue_engine import STORES


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


SEVERITY_RULES = {
    "REVENUE_SOURCE_OFFLINE": "P0",
    "TOAST_MISSING": "P1",
    "DOORDASH_MISSING": "P1",
    "QB_STALE": "P1",
    "QB_BLOCKED": "P0",
    "QB_MISSING": "P1",
    "PAYROLL_MISSING": "P1",
    "PAYROLL_STALE": "P2",
    "WAREHOUSE_DOWN": "P0",
    "WAREHOUSE_STALE": "P1",
    "SNAPSHOTS_MISSING": "P2",
    "SOURCE_REGISTRY_EMPTY": "P3",
    "MISSING_CONNECTORS": "P2",
    "GA4_MISSING": "P3",
    "GSC_MISSING": "P3",
    "GBP_BLOCKED": "P2",
}


def detect_risks() -> list[dict]:
    """Detect all financial risks from current warehouse state."""
    risks = []
    sources = evaluate_all_sources()
    sources_dict = {s["source"]: s for s in sources}

    # 1. Revenue source checks
    revenue_source_ids = ["toast", "doordash", "quickbooks"]
    revenue_offline = [
        s for s in revenue_source_ids
        if sources_dict.get(s, {}).get("status") in ("MISSING", "BLOCKED")
    ]
    if len(revenue_offline) == len(revenue_source_ids):
        risks.append({
            "risk_id": "REV_ALL_OFFLINE",
            "risk": "REVENUE_SOURCE_OFFLINE",
            "severity": "P0",
            "description": "All revenue sources (Toast, DoorDash, QB) are offline or missing",
            "evidence": {s: sources_dict.get(s, {}).get("status", "UNKNOWN")
                         for s in revenue_source_ids},
            "affected_stores": list(STORES.keys()),
            "ts": _now_iso(),
        })

    for src_id in revenue_source_ids:
        src = sources_dict.get(src_id, {})
        status = src.get("status", "MISSING")
        if status == "MISSING":
            risks.append({
                "risk_id": f"{src_id.upper()}_MISSING",
                "risk": f"{src_id.upper()}_MISSING",
                "severity": SEVERITY_RULES.get(f"{src_id.upper()}_MISSING", "P1"),
                "description": f"{src.get('source_name', src_id)} source missing from warehouse",
                "evidence": src,
                "ts": _now_iso(),
            })
        elif status == "BLOCKED":
            risks.append({
                "risk_id": f"{src_id.upper()}_BLOCKED",
                "risk": f"{src_id.upper()}_BLOCKED",
                "severity": "P0",
                "description": f"{src.get('source_name', src_id)} is BLOCKED",
                "evidence": src,
                "ts": _now_iso(),
            })
        elif status == "STALE":
            risks.append({
                "risk_id": f"{src_id.upper()}_STALE",
                "risk": f"{src_id.upper()}_STALE",
                "severity": SEVERITY_RULES.get(f"{src_id.upper()}_STALE", "P1"),
                "description": f"{src.get('source_name', src_id)} is STALE",
                "evidence": src,
                "ts": _now_iso(),
            })

    # 2. Payroll
    payroll = sources_dict.get("payroll", {})
    ps = payroll.get("status", "MISSING")
    if ps == "MISSING":
        risks.append({
            "risk_id": "PAYROLL_MISSING",
            "risk": "PAYROLL_MISSING",
            "severity": "P1",
            "description": "Payroll source missing — labor and profit KPIs blocked",
            "evidence": payroll,
            "ts": _now_iso(),
        })
    elif ps == "STALE":
        risks.append({
            "risk_id": "PAYROLL_STALE",
            "risk": "PAYROLL_STALE",
            "severity": "P2",
            "description": "Payroll source STALE — labor data may be outdated",
            "evidence": payroll,
            "ts": _now_iso(),
        })

    # 3. Warehouse health
    if wh.health() is None:
        risks.append({
            "risk_id": "WAREHOUSE_DOWN",
            "risk": "WAREHOUSE_DOWN",
            "severity": "P0",
            "description": "Financial Warehouse unreachable — all intelligence blocked",
            "ts": _now_iso(),
        })

    # 4. Snapshot coverage
    runtime = wh.runtime_proof()
    if runtime:
        src_count = runtime.get("sources", 0)
        snap_count = runtime.get("snapshots", 0)
        if src_count > 0 and snap_count == 0:
            risks.append({
                "risk_id": "SNAPSHOTS_MISSING",
                "risk": "SNAPSHOTS_MISSING",
                "severity": "P2",
                "description": f"{src_count} sources registered but 0 snapshots ingested",
                "ts": _now_iso(),
            })

    # 5. Missing connectors (sources with no data path)
    connectorless = ["toast", "doordash", "payroll", "ga4", "gsc"]
    missing_connectors = [s for s in connectorless
                          if sources_dict.get(s, {}).get("status") == "MISSING"]
    if missing_connectors:
        risks.append({
            "risk_id": "MISSING_CONNECTORS",
            "risk": "MISSING_CONNECTORS",
            "severity": "P2",
            "description": f"No connector built for: {', '.join(missing_connectors)}",
            "affected_sources": missing_connectors,
            "ts": _now_iso(),
        })

    # 6. GBP blocked
    gbp = sources_dict.get("gbp", {})
    if gbp.get("status") == "BLOCKED":
        risks.append({
            "risk_id": "GBP_BLOCKED",
            "risk": "GBP_BLOCKED",
            "severity": "P2",
            "description": "Google Business Profile blocked — review data unavailable",
            "evidence": gbp,
            "ts": _now_iso(),
        })

    # Sort by severity
    severity_order = {"P0": 0, "P1": 1, "P2": 2, "P3": 3}
    risks.sort(key=lambda r: severity_order.get(r["severity"], 9))

    return risks


def risk_summary() -> dict:
    """Summarize detected risks."""
    risks = detect_risks()
    counts = {"P0": 0, "P1": 0, "P2": 0, "P3": 0}
    for r in risks:
        counts[r["severity"]] = counts.get(r["severity"], 0) + 1

    return {
        "total_risks": len(risks),
        "by_severity": counts,
        "has_critical": counts["P0"] > 0,
        "risks": risks,
        "ts": _now_iso(),
    }
