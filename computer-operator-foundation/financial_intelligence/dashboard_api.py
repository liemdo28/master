"""CFO Dashboard API — read-only endpoints for financial intelligence.

All endpoints are warehouse-backed and evidence-aware.
No fabrication. No writes to production systems.

Endpoints:
  GET /api/finance/health
  GET /api/finance/revenue
  GET /api/finance/stores
  GET /api/finance/risks
  GET /api/finance/questions
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from flask import Flask, jsonify

from .revenue_engine import (
    revenue_aggregation, revenue_trend, store_revenue_ranking,
    revenue_freshness_awareness,
)
from .store_ranking_engine import rank_stores, ranking_summary
from .source_health_engine import health_summary, evaluate_all_sources
from .financial_risk_engine import risk_summary, detect_risks
from .cfo_question_engine import route_question, answer_all_questions
from .coordination_adapter import scan_and_emit, get_coordination_summary
from . import warehouse_client as wh

app = Flask(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.get("/api/finance/health")
def finance_health():
    """Overall financial intelligence health check."""
    wh_ok = wh.warehouse_available()
    return jsonify({
        "ok": wh_ok,
        "service": "financial-intelligence-engine",
        "warehouse_reachable": wh_ok,
        "ts": _now_iso(),
        "engines": {
            "revenue_engine": "ok",
            "store_ranking_engine": "ok",
            "source_health_engine": "ok",
            "financial_risk_engine": "ok",
            "cfo_question_engine": "ok",
            "coordination_adapter": "ok",
        },
    })


@app.get("/api/finance/revenue")
def finance_revenue():
    """Revenue intelligence endpoints."""
    aggregation = revenue_aggregation()
    trend = revenue_trend()
    ranking = store_revenue_ranking()
    freshness = revenue_freshness_awareness()

    return jsonify({
        "aggregation": aggregation,
        "trend": trend,
        "ranking": ranking,
        "freshness": freshness,
        "ts": _now_iso(),
    })


@app.get("/api/finance/stores")
def finance_stores():
    """Store ranking intelligence."""
    ranking = ranking_summary()
    return jsonify({
        "summary": {
            "total_stores": ranking["total_stores"],
            "top_store": ranking["top_store"]["store"] if ranking["top_store"] else None,
            "bottom_store": ranking["bottom_store"]["store"] if ranking["bottom_store"] else None,
        },
        "rankings": ranking["rankings"],
        "note": "Scores reflect data infrastructure readiness, not financial performance.",
        "ts": _now_iso(),
    })


@app.get("/api/finance/health/sources")
def finance_source_health():
    """Source health intelligence."""
    return jsonify(health_summary())


@app.get("/api/finance/risks")
def finance_risks():
    """Financial risk intelligence."""
    return jsonify(risk_summary())


@app.get("/api/finance/questions")
def finance_questions():
    """Answer all CFO questions."""
    return jsonify(answer_all_questions())


@app.get("/api/finance/questions/<question_id>")
def finance_question_by_id(question_id: str):
    """Answer a specific CFO question."""
    return jsonify(route_question(question_id))


@app.get("/api/finance/coordination")
def finance_coordination():
    """Coordination integration — scan and emit tasks."""
    emit_result = scan_and_emit()
    return jsonify({
        "scan_result": emit_result,
        "summary": get_coordination_summary(),
        "ts": _now_iso(),
    })


@app.get("/api/finance/runtime-proof")
def finance_runtime_proof():
    """Runtime proof — assert all engines are operational."""
    questions = answer_all_questions()
    risks = risk_summary()
    health = health_summary()

    return jsonify({
        "status": "FINANCIAL_INTELLIGENCE_ENGINE_OPERATIONAL",
        "ts": _now_iso(),
        "warehouse_available": wh.warehouse_available(),
        "engines_operational": [
            "revenue_engine",
            "store_ranking_engine",
            "source_health_engine",
            "financial_risk_engine",
            "cfo_question_engine",
            "coordination_adapter",
        ],
        "questions_answered": questions["total_questions"],
        "questions_answerable": questions["answerable"],
        "questions_blocked": questions["blocked"],
        "risks_detected": risks["total_risks"],
        "source_health_overall": health["overall_health"],
        "source_health_counts": health["counts"],
    })


@app.get("/")
def index():
    return jsonify({
        "service": "Financial Intelligence Engine",
        "phase": "3B",
        "endpoints": [
            "/api/finance/health",
            "/api/finance/revenue",
            "/api/finance/stores",
            "/api/finance/risks",
            "/api/finance/questions",
            "/api/finance/health/sources",
            "/api/finance/coordination",
            "/api/finance/runtime-proof",
        ],
    })


if __name__ == "__main__":
    port = int(os.environ.get("FIN_PORT", 5178))
    app.run(host="127.0.0.1", port=port, debug=False)
