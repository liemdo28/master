"""CFO Question Engine — answers CFO-grade financial questions.

Routes questions to the appropriate engine and returns evidence-based answers
with confidence, sources, and freshness information.

CTO Rule: If data is missing, return BLOCKED. Never invent answers.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from . import warehouse_client as wh
from .revenue_engine import (
    revenue_aggregation, revenue_trend, store_revenue_ranking,
    revenue_freshness_awareness, STORES,
    _freshness_for_source, _source_status,
)
from .store_ranking_engine import rank_stores, get_top_store, ranking_summary
from .source_health_engine import (
    evaluate_all_sources, get_stale_sources, get_missing_sources,
    health_summary,
)
from .financial_risk_engine import detect_risks, risk_summary


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_answer(question: str, answer: str, confidence: int,
                  sources: list[str], freshness: str,
                  blocked: bool = False,
                  blocked_reason: str = "") -> dict:
    """Standard answer format per directive."""
    result = {
        "question": question,
        "answer": answer,
        "confidence": confidence,
        "sources": sources,
        "freshness": freshness,
        "ts": _now_iso(),
    }
    if blocked:
        result["blocked"] = True
        result["blocked_reason"] = blocked_reason
    return result


# ── Question handlers ──────────────────────────────────────────────────


def answer_revenue_today() -> dict:
    """Revenue hôm nay bao nhiêu?"""
    agg = revenue_aggregation()

    if not agg["revenue_available"]:
        return _build_answer(
            question="Revenue hôm nay bao nhiêu?",
            answer="BLOCKED — Không có dữ liệu revenue. Toast, DoorDash, "
                   "QuickBooks chưa kết nối với dữ liệu POS thực tế.",
            confidence=0,
            sources=["warehouse_freshness_registry", "warehouse_sources"],
            freshness=agg["freshness"],
            blocked=True,
            blocked_reason="No POS data ingested. All revenue sources "
                           "returning MISSING or simulated data.",
        )

    return _build_answer(
        question="Revenue hôm nay bao nhiêu?",
        answer=f"Total revenue: ${agg['total_revenue']:,.2f}",
        confidence=agg["confidence"],
        sources=agg.get("source_breakdown", {}).keys(),
        freshness=agg["freshness"],
    )


def answer_revenue_this_week() -> dict:
    """Revenue tuần này tăng hay giảm?"""
    trend = revenue_trend()

    if not trend["trend_available"]:
        return _build_answer(
            question="Revenue tuần này tăng hay giảm?",
            answer="BLOCKED — Không có dữ liệu revenue theo tuần. "
                   "Cần kết nối POS trước.",
            confidence=0,
            sources=["warehouse_freshness_registry"],
            freshness=trend["freshness"],
            blocked=True,
            blocked_reason=trend.get("blocked_reason",
                                      "No daily revenue data ingested"),
        )

    return _build_answer(
        question="Revenue tuần này tăng hay giảm?",
        answer=f"Change: {trend['change_pct']:+.1f}% ({trend['direction']})",
        confidence=60,
        sources=["warehouse_revenue"],
        freshness=trend["freshness"],
    )


def answer_best_store() -> dict:
    """Store nào lời nhất?"""
    ranking = ranking_summary()
    top = ranking.get("top_store")

    if top is None:
        return _build_answer(
            question="Store nào lời nhất?",
            answer="BLOCKED — Không có dữ liệu revenue hoặc profit theo store.",
            confidence=0,
            sources=["warehouse_sources", "warehouse_freshness"],
            freshness="MISSING",
            blocked=True,
            blocked_reason="No per-store revenue or profit data available",
        )

    freshness_rows = wh.freshness()
    fr = _freshness_for_source("quickbooks", freshness_rows)
    freshness = _source_status(fr)

    return _build_answer(
        question="Store nào lời nhất?",
        answer=f"Top store (by data readiness): {top['store']} "
               f"(score: {top['score']}/100). NOTE: This reflects data "
               f"infrastructure readiness, NOT actual financial performance.",
        confidence=top["score"],
        sources=["warehouse_freshness", "warehouse_sources"],
        freshness=freshness,
    )


def answer_stale_sources() -> dict:
    """Which sources are stale?"""
    summary = health_summary()
    stale = get_stale_sources()
    missing = get_missing_sources()

    if stale or missing:
        parts = []
        for s in stale:
            parts.append(f"{s['source_name']}: STALE (age: {s['age_days']}d)")
        for s in missing:
            parts.append(f"{s['source_name']}: {s['status']}")
        answer_text = "; ".join(parts)
    else:
        answer_text = "All sources are LIVE or not registered."

    live_count = summary["counts"].get("LIVE", 0)
    total = summary["total_sources"]
    confidence = round((live_count / total) * 100) if total else 0

    return _build_answer(
        question="Nguồn tài chính nào đang stale?",
        answer=answer_text,
        confidence=confidence,
        sources=["warehouse_freshness_registry"],
        freshness=summary["overall_health"],
    )


def answer_financial_risks() -> dict:
    """What financial risks exist?"""
    summary = risk_summary()

    if summary["total_risks"] == 0:
        return _build_answer(
            question="Rủi ro tài chính hiện tại?",
            answer="Không phát hiện rủi ro tài chính.",
            confidence=80,
            sources=["warehouse_freshness", "warehouse_sources", "warehouse_health"],
            freshness="LIVE",
        )

    top_risks = summary["risks"][:5]
    risk_text = "; ".join(
        f"[{r['severity']}] {r['risk']}: {r['description']}"
        for r in top_risks
    )
    confidence = max(60, 90 - summary["by_severity"].get("P0", 0) * 15)

    return _build_answer(
        question="Rủi ro tài chính hiện tại?",
        answer=f"{summary['total_risks']} rủi ro: {risk_text}",
        confidence=confidence,
        sources=["warehouse_freshness", "warehouse_sources", "warehouse_health"],
        freshness="LIVE",
    )


def answer_weekly_summary() -> dict:
    """Tuần này cần chú ý tài chính gì?"""
    risk_result = answer_financial_risks()
    stale_result = answer_stale_sources()
    top = get_top_store()

    parts = []

    if top:
        parts.append(f"Store co data tot nhat: {top['store']} "
                     f"(score: {top['score']}/100)")

    if stale_result.get("blocked", False):
        parts.append(f"Data: {stale_result['answer']}")
    else:
        parts.append(f"Nguon stale: {stale_result['answer']}")

    parts.append(f"Rui ro: {risk_result['answer']}")

    return _build_answer(
        question="Tuần này cần chú ý tài chính gì?",
        answer=" | ".join(parts),
        confidence=min(risk_result["confidence"], stale_result["confidence"]),
        sources=risk_result["sources"],
        freshness=risk_result["freshness"],
    )


# ── Question Router ────────────────────────────────────────────────────

QUESTION_MAP = {
    "revenue_today": answer_revenue_today,
    "revenue_this_week": answer_revenue_this_week,
    "best_store": answer_best_store,
    "stale_sources": answer_stale_sources,
    "financial_risks": answer_financial_risks,
    "weekly_summary": answer_weekly_summary,
}


def route_question(question_id: str) -> dict:
    """Route a question by ID to the appropriate handler."""
    handler = QUESTION_MAP.get(question_id)
    if handler is None:
        return {
            "question": question_id,
            "answer": f"Unknown question: {question_id}",
            "confidence": 0,
            "sources": [],
            "freshness": "UNKNOWN",
            "blocked": True,
            "blocked_reason": f"No handler for question '{question_id}'",
            "available_questions": list(QUESTION_MAP.keys()),
        }
    return handler()


def answer_all_questions() -> dict:
    """Answer all CFO questions and return a summary."""
    results = {}
    for qid in QUESTION_MAP:
        results[qid] = route_question(qid)

    can_answer = sum(1 for r in results.values() if not r.get("blocked", False))
    total = len(results)

    return {
        "total_questions": total,
        "answerable": can_answer,
        "blocked": total - can_answer,
        "overall_confidence": round(
            sum(r["confidence"] for r in results.values()) / total
        ) if total else 0,
        "questions": results,
        "ts": _now_iso(),
    }
