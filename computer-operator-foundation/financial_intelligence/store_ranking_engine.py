"""Store Ranking Engine — scores and ranks stores.

Factors: revenue, trend, freshness, confidence.
Only uses data from the warehouse. Never fabricates scores.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from . import warehouse_client as wh
from .revenue_engine import STORES, _freshness_for_source, _source_status, _age_days


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _compute_freshness_score(freshness_rows: list[dict]) -> dict:
    """Score based on data freshness across all sources.

    Returns a score 0-100 and supporting detail.
    """
    revenue_sources = ["quickbooks", "toast", "doordash"]
    scores = []

    for src_id in revenue_sources:
        fr = _freshness_for_source(src_id, freshness_rows)
        status = _source_status(fr)
        age = _age_days(fr)

        if status == "LIVE" and age is not None:
            if age == 0:
                scores.append(100)
            elif age <= 1:
                scores.append(90)
            elif age <= 3:
                scores.append(70)
            elif age <= 7:
                scores.append(50)
            else:
                scores.append(30)
        elif status == "STALE":
            scores.append(20)
        elif status == "PARTIAL":
            scores.append(35)
        elif status == "BLOCKED":
            scores.append(5)
        else:  # MISSING or UNKNOWN
            scores.append(0)

    avg = round(sum(scores) / len(scores)) if scores else 0
    return {"score": avg, "detail": dict(zip(revenue_sources, scores))}


def _compute_revenue_score(revenue_data: Any) -> dict:
    """Score based on revenue data availability.

    Without real revenue data, this reflects data completeness,
    not fabricated performance.
    """
    if revenue_data is None:
        return {"score": 0, "reason": "No revenue data available"}
    return {"score": 50, "reason": "Revenue data available but limited"}


def _compute_confidence_score(freshness_rows: list[dict],
                               source_registry: list[dict]) -> dict:
    """Score based on data confidence.

    Reflects how many sources are providing data and how fresh they are.
    """
    total = len(source_registry)
    if total == 0:
        return {"score": 0, "reason": "No sources registered"}

    live = sum(1 for fr in freshness_rows if fr.get("status") == "LIVE")
    stale = sum(1 for fr in freshness_rows if fr.get("status") == "STALE")
    missing = sum(1 for fr in freshness_rows
                  if fr.get("status") in ("MISSING", "UNKNOWN"))
    blocked = sum(1 for fr in freshness_rows if fr.get("status") == "BLOCKED")

    # Weighted: LIVE=1.0, STALE=0.3, PARTIAL=0.5, MISSING=0, BLOCKED=0
    score = round(((live * 1.0 + stale * 0.3) / total) * 100) if total else 0
    return {
        "score": score,
        "live": live,
        "stale": stale,
        "missing": missing,
        "blocked": blocked,
        "total": total,
    }


def rank_stores() -> list[dict]:
    """Rank all known stores.

    Since no actual revenue data is ingested, the ranking is based on
    data infrastructure readiness (freshness + confidence), NOT on
    fabricated financial performance.

    Output format matches the directive:
    {
        "rank": 1,
        "store": "Bakudan The Rim",
        "score": 87
    }
    """
    freshness_rows = wh.freshness()
    source_registry = wh.sources()

    freshness_score = _compute_freshness_score(freshness_rows)
    confidence_result = _compute_confidence_score(freshness_rows, source_registry)

    results = []
    for sid, info in STORES.items():
        freshness = freshness_score["score"]
        confidence = confidence_result["score"]

        # Composite: freshness 40%, confidence 40%, revenue data 20%
        # Revenue component is 0 because no actual revenue is ingested
        composite = round(freshness * 0.40 + confidence * 0.40 + 0 * 0.20)

        results.append({
            "store": info["name"],
            "store_id": sid,
            "score": composite,
            "dimensions": {
                "freshness": freshness,
                "confidence": confidence,
                "revenue_data": 0,
            },
            "note": "Score reflects data infrastructure readiness, not "
                    "financial performance. No revenue data is ingested.",
        })

    # Sort by score descending
    results.sort(key=lambda x: x["score"], reverse=True)
    for i, r in enumerate(results, 1):
        r["rank"] = i

    return results


def get_top_store() -> Optional[dict]:
    """Return the #1 ranked store."""
    rankings = rank_stores()
    return rankings[0] if rankings else None


def get_bottom_store() -> Optional[dict]:
    """Return the lowest-ranked store."""
    rankings = rank_stores()
    return rankings[-1] if rankings else None


def ranking_summary() -> dict:
    """Return a summary of the store ranking."""
    rankings = rank_stores()
    return {
        "total_stores": len(rankings),
        "top_store": rankings[0] if rankings else None,
        "bottom_store": rankings[-1] if rankings else None,
        "rankings": rankings,
        "ts": _now_iso(),
    }
