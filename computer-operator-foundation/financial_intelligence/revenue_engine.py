"""Revenue Engine — aggregates, trends, ranks revenue from warehouse data.

Never fabricates revenue. Only reports what the warehouse contains.
When data is missing or stale, confidence is lowered accordingly.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from . import warehouse_client as wh


# ── known stores ────────────────────────────────────────────────────────
STORES = {
    "bakudan-the-rim": {"name": "Bakudan The Rim", "brand": "Bakudan"},
    "bakudan-bandera": {"name": "Bakudan Bandera", "brand": "Bakudan"},
    "bakudan-stone-oak": {"name": "Bakudan Stone Oak", "brand": "Bakudan"},
    "raw-sushi": {"name": "Raw Sushi", "brand": "Raw Sushi"},
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _freshness_for_source(source_id: str, freshness_rows: list[dict]) -> Optional[dict]:
    """Find freshness row for a given source."""
    for row in freshness_rows:
        if row.get("source_id") == source_id:
            return row
    return None


def _source_status(freshness_row: Optional[dict]) -> str:
    """Derive source status from freshness row."""
    if freshness_row is None:
        return "MISSING"
    return freshness_row.get("status", freshness_row.get("health", "UNKNOWN"))


def _age_days(freshness_row: Optional[dict]) -> Optional[int]:
    """Compute age in days from freshness row last_seen timestamp."""
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


def revenue_aggregation() -> dict:
    """Aggregate revenue from warehouse sources.

    Since real POS data is not yet ingested, this returns an evidence-based
    status report of what revenue data the warehouse currently holds.

    Returns:
        dict with stores, total_revenue, source_breakdown, freshness, confidence
    """
    sources = wh.sources()
    freshness_rows = wh.freshness()
    snapshots = wh.runtime_proof()

    # Check which revenue-capable sources exist
    revenue_sources = ["quickbooks", "toast", "doordash"]
    source_status = {}
    for src_id in revenue_sources:
        fr = _freshness_for_source(src_id, freshness_rows)
        source_status[src_id] = {
            "status": _source_status(fr),
            "age_days": _age_days(fr),
            "last_seen": fr.get("last_seen") if fr else None,
        }

    # Count how many revenue sources are LIVE
    live_count = sum(1 for s in source_status.values() if s["status"] == "LIVE")
    total_revenue_sources = len(revenue_sources)

    # Confidence calculation based on source availability
    if live_count == 0:
        confidence = 0
    elif live_count < total_revenue_sources:
        confidence = round(30 + (live_count / total_revenue_sources) * 40)
    else:
        confidence = 85  # all sources live but data may be partial

    # Check for stale sources (simulated QB snapshot is stale)
    stale_count = sum(1 for s in source_status.values()
                      if s["status"] in ("STALE", "PARTIAL"))
    missing_count = sum(1 for s in source_status.values()
                        if s["status"] in ("MISSING", "UNKNOWN"))
    blocked_count = sum(1 for s in source_status.values()
                        if s["status"] == "BLOCKED")

    # Overall freshness
    if missing_count == len(revenue_sources) and live_count == 0:
        overall_freshness = "MISSING"
    elif stale_count > 0 and live_count == 0:
        overall_freshness = "STALE"
    elif blocked_count > 0:
        overall_freshness = "BLOCKED"
    elif live_count > 0:
        overall_freshness = "PARTIAL"
    else:
        overall_freshness = "MISSING"

    return {
        "total_revenue": None,  # No actual revenue data ingested yet
        "revenue_available": False,
        "stores": [
            {
                "store_id": sid,
                "store_name": info["name"],
                "revenue": None,  # Cannot fabricate
                "source": "BLOCKED",
            }
            for sid, info in STORES.items()
        ],
        "source_breakdown": source_status,
        "revenue_sources_live": live_count,
        "revenue_sources_total": total_revenue_sources,
        "freshness": overall_freshness,
        "confidence": confidence,
        "ts": _now_iso(),
        "evidence": "warehouse_freshness_registry + warehouse_sources",
    }


def revenue_trend() -> dict:
    """Calculate revenue trend.

    Without historical revenue data in the warehouse, this returns
    BLOCKED with evidence explaining why.
    """
    agg = revenue_aggregation()

    return {
        "trend_available": False,
        "current_period_revenue": None,
        "previous_period_revenue": None,
        "change_pct": None,
        "direction": "UNKNOWN",
        "freshness": agg["freshness"],
        "confidence": 0,
        "blocked_reason": "No revenue data ingested into warehouse. "
                          "Toast, DoorDash, and QB revenue sources are "
                          "not yet connected with actual POS data.",
        "ts": _now_iso(),
        "evidence": "warehouse_freshness_registry shows all revenue sources MISSING or simulated",
    }


def store_revenue_ranking() -> list[dict]:
    """Rank stores by revenue.

    Without actual revenue data, returns stores ranked by data availability
    signal (which sources are connected) — NOT by fabricated revenue.
    """
    freshness_rows = wh.freshness()
    results = []

    for sid, info in STORES.items():
        # Check data availability for this store's sources
        qb_fresh = _freshness_for_source("quickbooks", freshness_rows)
        toast_fresh = _freshness_for_source("toast", freshness_rows)
        dd_fresh = _freshness_for_source("doordash", freshness_rows)

        connected = 0
        sources_detail = []
        for name, fr in [("QB", qb_fresh), ("Toast", toast_fresh),
                         ("DoorDash", dd_fresh)]:
            status = _source_status(fr)
            sources_detail.append({"source": name, "status": status})
            if status == "LIVE":
                connected += 1

        # Data-availability score (not revenue!)
        data_score = round((connected / 3) * 50)  # 0-50 based on sources

        results.append({
            "store_id": sid,
            "store_name": info["name"],
            "revenue": None,
            "revenue_rank": None,
            "data_availability_score": data_score,
            "connected_sources": connected,
            "source_details": sources_detail,
            "freshness": _source_status(qb_fresh),
            "confidence": 0,
        })

    # Sort by data availability (best data first)
    results.sort(key=lambda x: x["data_availability_score"], reverse=True)
    for i, r in enumerate(results, 1):
        r["rank"] = i

    return results


def revenue_freshness_awareness() -> dict:
    """Report on revenue data freshness across all sources."""
    freshness_rows = wh.freshness()
    revenue_source_ids = ["quickbooks", "toast", "doordash"]
    sources = []

    for src_id in revenue_source_ids:
        fr = _freshness_for_source(src_id, freshness_rows)
        status = _source_status(fr)
        age = _age_days(fr)

        # Freshness classification
        if status == "MISSING":
            classification = "MISSING"
        elif status == "BLOCKED":
            classification = "BLOCKED"
        elif status == "LIVE" and age is not None and age <= 1:
            classification = "LIVE"
        elif status == "LIVE" and age is not None and age <= 3:
            classification = "FRESH"
        elif status in ("STALE", "PARTIAL"):
            classification = "STALE"
        elif age is not None and age > 7:
            classification = "STALE"
        else:
            classification = status

        sources.append({
            "source_id": src_id,
            "status": status,
            "age_days": age,
            "freshness_classification": classification,
            "last_seen": fr.get("last_seen") if fr else None,
        })

    overall = "MISSING"
    live_count = sum(1 for s in sources if s["status"] == "LIVE")
    if live_count == len(sources):
        overall = "FRESH"
    elif live_count > 0:
        overall = "PARTIAL"

    return {
        "revenue_freshness": overall,
        "sources": sources,
        "live_count": live_count,
        "total_count": len(sources),
        "confidence": round((live_count / len(sources)) * 100) if sources else 0,
        "ts": _now_iso(),
    }
