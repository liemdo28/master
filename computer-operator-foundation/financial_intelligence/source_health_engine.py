"""Source Health Engine — evaluates source status, freshness, and health.

Reads directly from warehouse freshness registry. Never fabricates state.

Status values: LIVE, STALE, PARTIAL, MISSING, BLOCKED
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from . import warehouse_client as wh


# Cadence thresholds (in days) for expected refresh intervals
CADENCE_THRESHOLDS = {
    "real_time": 0.5,   # 12 hours
    "hourly": 1,
    "daily": 2,
    "weekly": 8,
    "monthly": 35,
}


# Expected cadence per source_id (per FINANCIAL_FRESHNESS_REGISTRY.md)
EXPECTED_CADENCE = {
    "quickbooks": "daily",
    "accounting_engine": "real_time",
    "toast": "daily",
    "doordash": "daily",
    "payroll": "weekly",
    "ga4": "daily",
    "gsc": "daily",
    "gbp": "daily",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _age_days(freshness_row: Optional[dict]) -> Optional[int]:
    """Compute age in days from last_seen timestamp."""
    if freshness_row is None:
        return None
    last_seen = freshness_row.get("last_seen")
    if not last_seen:
        return None
    try:
        last_dt = datetime.fromisoformat(last_seen)
        now = datetime.now(timezone.utc)
        delta = now - last_dt
        return delta.days
    except Exception:
        return None


def _evaluate_status(source_id: str, freshness_row: Optional[dict],
                     sources_registry: list[dict]) -> str:
    """Evaluate actual source status using multi-signal logic.

    Precedence:
    1. If registered as BLOCKED → BLOCKED
    2. If no snapshot ever → MISSING
    3. If snapshot exists but age > cadence threshold → STALE
    4. If snapshot exists and recent → LIVE
    """
    # Check registration
    registered = any(s.get("source_id") == source_id for s in sources_registry)
    if not registered:
        return "MISSING"

    # Check registration classification
    for s in sources_registry:
        if s.get("source_id") == source_id:
            classification = s.get("classification", "")
            if classification == "BLOCKED":
                return "BLOCKED"
            break

    if freshness_row is None or freshness_row.get("last_seen") is None:
        return "MISSING"

    age = _age_days(freshness_row)
    if age is None:
        return "UNKNOWN"

    # Compare against expected cadence
    cadence = EXPECTED_CADENCE.get(source_id, "daily")
    threshold = CADENCE_THRESHOLDS.get(cadence, 2)

    # If health was DOWN, mark PARTIAL
    health = freshness_row.get("health", "UNKNOWN")
    if health == "DOWN":
        return "PARTIAL"

    if age > threshold:
        return "STALE"
    return "LIVE"


def evaluate_all_sources() -> list[dict]:
    """Evaluate health status for all sources.

    Output format per directive:
    {
        "source": "QB",
        "status": "STALE",
        "age_days": 6
    }
    """
    freshness_rows = wh.freshness()
    sources = wh.sources()

    results = []
    for s in sources:
        sid = s.get("source_id")
        fr = next((f for f in freshness_rows if f.get("source_id") == sid), None)
        status = _evaluate_status(sid, fr, sources)
        age = _age_days(fr)

        # Normalize status to one of: LIVE, STALE, PARTIAL, MISSING, BLOCKED
        normalized = status
        if normalized not in ("LIVE", "STALE", "PARTIAL", "MISSING", "BLOCKED"):
            normalized = "UNKNOWN"

        results.append({
            "source": sid,
            "source_name": s.get("source_name", sid),
            "status": normalized,
            "age_days": age,
            "owner": s.get("owner", "unknown"),
            "classification": s.get("classification", "UNKNOWN"),
            "last_seen": fr.get("last_seen") if fr else None,
            "expected_cadence": EXPECTED_CADENCE.get(sid, "daily"),
        })

    return results


def evaluate_source(source_id: str) -> Optional[dict]:
    """Evaluate a specific source."""
    all_results = evaluate_all_sources()
    for r in all_results:
        if r["source"] == source_id:
            return r
    return None


def get_stale_sources() -> list[dict]:
    """Return only STALE/PARTIAL sources."""
    return [r for r in evaluate_all_sources()
            if r["status"] in ("STALE", "PARTIAL")]


def get_missing_sources() -> list[dict]:
    """Return only MISSING/BLOCKED sources."""
    return [r for r in evaluate_all_sources()
            if r["status"] in ("MISSING", "BLOCKED")]


def get_live_sources() -> list[dict]:
    """Return only LIVE sources."""
    return [r for r in evaluate_all_sources() if r["status"] == "LIVE"]


def health_summary() -> dict:
    """Return overall source health summary."""
    all_sources = evaluate_all_sources()
    counts = {"LIVE": 0, "STALE": 0, "PARTIAL": 0, "MISSING": 0, "BLOCKED": 0}
    for s in all_sources:
        counts[s["status"]] = counts.get(s["status"], 0) + 1

    # Determine overall posture
    if counts["MISSING"] == len(all_sources):
        overall = "MISSING"
    elif counts["LIVE"] == len(all_sources):
        overall = "HEALTHY"
    elif counts["LIVE"] >= len(all_sources) / 2:
        overall = "PARTIAL"
    elif counts["BLOCKED"] > 0:
        overall = "BLOCKED"
    else:
        overall = "DEGRADED"

    return {
        "overall_health": overall,
        "counts": counts,
        "total_sources": len(all_sources),
        "sources": all_sources,
        "ts": _now_iso(),
    }
