"""Runtime proof for the Financial Intelligence Engine.

Runs all engines, exercises all API endpoints, and writes proof artifacts.
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# Force UTF-8 stdout for Windows console compatibility with non-ASCII chars in source
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

HERE = Path(__file__).resolve().parent
PROOF_DIR = HERE / "runtime-evidence"
PROOF_DIR.mkdir(exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def main():
    """Run all engine functions, save proof, then start API and exercise endpoints."""
    # Add parent to path so imports work
    sys.path.insert(0, str(HERE.parent))

    # Import after path setup
    from financial_intelligence import (
        warehouse_client as wh,
        revenue_engine,
        store_ranking_engine,
        source_health_engine,
        financial_risk_engine,
        cfo_question_engine,
        coordination_adapter,
    )

    # Import Flask app lazily to avoid fork issues
    from financial_intelligence.dashboard_api import app as flask_app

    proof = {
        "ts": _now_iso(),
        "phase": "3B Financial Intelligence",
        "warehouse_available": wh.warehouse_available(),
        "engines_run": {},
        "api_endpoints": {},
        "errors": [],
    }

    OK = "[OK]"
    FAIL = "[FAIL]"

    # ── Phase 1: Run each engine directly ──────────────────────────────
    print("[1/5] Running Revenue Engine...")
    try:
        agg = revenue_engine.revenue_aggregation()
        trend = revenue_engine.revenue_trend()
        freshness = revenue_engine.revenue_freshness_awareness()
        proof["engines_run"]["revenue_engine"] = {
            "ok": True,
            "aggregation_confidence": agg["confidence"],
            "freshness": agg["freshness"],
            "live_sources": agg["revenue_sources_live"],
            "total_sources": agg["revenue_sources_total"],
            "trend_available": trend["trend_available"],
            "freshness_awareness": freshness["revenue_freshness"],
        }
        print(f"    {OK} Revenue aggregation: confidence={agg['confidence']}, "
              f"freshness={agg['freshness']}")
    except Exception as e:
        proof["errors"].append(f"revenue_engine: {e}")
        proof["engines_run"]["revenue_engine"] = {"ok": False, "error": str(e)}
        print(f"    {FAIL} Revenue Engine error: {e}")

    print("[2/5] Running Store Ranking Engine...")
    try:
        ranking = store_ranking_engine.ranking_summary()
        proof["engines_run"]["store_ranking_engine"] = {
            "ok": True,
            "total_stores": ranking["total_stores"],
            "top_store": ranking["top_store"]["store"] if ranking["top_store"] else None,
            "top_score": ranking["top_store"]["score"] if ranking["top_store"] else None,
        }
        print(f"    {OK} Top store: {ranking['top_store']['store']} "
              f"(score: {ranking['top_store']['score']})")
    except Exception as e:
        proof["errors"].append(f"store_ranking_engine: {e}")
        proof["engines_run"]["store_ranking_engine"] = {"ok": False, "error": str(e)}
        print(f"    {FAIL} Store Ranking error: {e}")

    print("[3/5] Running Source Health Engine...")
    try:
        health = source_health_engine.health_summary()
        proof["engines_run"]["source_health_engine"] = {
            "ok": True,
            "overall_health": health["overall_health"],
            "counts": health["counts"],
        }
        print(f"    {OK} Overall health: {health['overall_health']}, "
              f"counts={health['counts']}")
    except Exception as e:
        proof["errors"].append(f"source_health_engine: {e}")
        proof["engines_run"]["source_health_engine"] = {"ok": False, "error": str(e)}
        print(f"    {FAIL} Source Health error: {e}")

    print("[4/5] Running Financial Risk Engine...")
    try:
        risks = financial_risk_engine.risk_summary()
        proof["engines_run"]["financial_risk_engine"] = {
            "ok": True,
            "total_risks": risks["total_risks"],
            "by_severity": risks["by_severity"],
        }
        print(f"    {OK} Total risks: {risks['total_risks']}, "
              f"by_severity={risks['by_severity']}")
    except Exception as e:
        proof["errors"].append(f"financial_risk_engine: {e}")
        proof["engines_run"]["financial_risk_engine"] = {"ok": False, "error": str(e)}
        print(f"    {FAIL} Risk Engine error: {e}")

    print("[5/5] Running CFO Question Engine...")
    try:
        all_q = cfo_question_engine.answer_all_questions()
        proof["engines_run"]["cfo_question_engine"] = {
            "ok": True,
            "total_questions": all_q["total_questions"],
            "answerable": all_q["answerable"],
            "blocked": all_q["blocked"],
            "overall_confidence": all_q["overall_confidence"],
        }
        print(f"    {OK} Questions: {all_q['total_questions']} total, "
              f"{all_q['answerable']} answerable, {all_q['blocked']} blocked")
    except Exception as e:
        proof["errors"].append(f"cfo_question_engine: {e}")
        proof["engines_run"]["cfo_question_engine"] = {"ok": False, "error": str(e)}
        print(f"    {FAIL} Question Engine error: {e}")

    # ── Phase 2: Coordination adapter scan ──────────────────────────────
    print("[coordination] Scanning and emitting...")
    try:
        emit = coordination_adapter.scan_and_emit()
        coord_summary = coordination_adapter.get_coordination_summary()
        proof["engines_run"]["coordination_adapter"] = {
            "ok": True,
            "tasks_created": len(emit["tasks_created"]),
            "risks_created": len(emit["risks_created"]),
            "alerts_created": len(emit["alerts_created"]),
            "total_tasks": coord_summary["total_tasks"],
        }
        print(f"    {OK} Tasks: {len(emit['tasks_created'])}, "
              f"Risks: {len(emit['risks_created'])}, "
              f"Alerts: {len(emit['alerts_created'])}")
    except Exception as e:
        proof["errors"].append(f"coordination_adapter: {e}")
        proof["engines_run"]["coordination_adapter"] = {"ok": False, "error": str(e)}
        print(f"    {FAIL} Coordination error: {e}")

    # ── Phase 3: Run Flask server and exercise endpoints ───────────────
    print("\n[api] Starting dashboard API on port 5178...")
    import threading
    port = 5178
    flask_app.config["TESTING"] = True

    server_thread = threading.Thread(
        target=lambda: flask_app.run(
            host="127.0.0.1", port=port, debug=False,
            use_reloader=False, threaded=True,
        ),
        daemon=True,
    )
    server_thread.start()
    time.sleep(2)

    endpoints = [
        ("GET", "/api/finance/health"),
        ("GET", "/api/finance/revenue"),
        ("GET", "/api/finance/stores"),
        ("GET", "/api/finance/risks"),
        ("GET", "/api/finance/questions"),
        ("GET", "/api/finance/questions/revenue_today"),
        ("GET", "/api/finance/questions/best_store"),
        ("GET", "/api/finance/questions/stale_sources"),
        ("GET", "/api/finance/questions/financial_risks"),
        ("GET", "/api/finance/health/sources"),
        ("GET", "/api/finance/coordination"),
        ("GET", "/api/finance/runtime-proof"),
    ]

    print("[api] Exercising endpoints...")
    for method, path in endpoints:
        try:
            url = f"http://127.0.0.1:{port}{path}"
            req = urllib.request.Request(url, method=method)
            with urllib.request.urlopen(req, timeout=5) as resp:
                status = resp.status
                body = json.loads(resp.read().decode("utf-8"))
                proof["api_endpoints"][path] = {
                    "method": method,
                    "status": status,
                    "ok": status == 200,
                }
                print(f"    {OK} {method} {path} -> {status}")
        except Exception as e:
            proof["api_endpoints"][path] = {
                "method": method,
                "ok": False,
                "error": str(e),
            }
            proof["errors"].append(f"api:{path}: {e}")
            print(f"    {FAIL} {method} {path} -> {e}")

    # ── Phase 4: Determine final status ────────────────────────────────
    successful_endpoints = sum(
        1 for ep in proof["api_endpoints"].values() if ep.get("ok")
    )
    total_endpoints = len(proof["api_endpoints"])

    engines_ok = all(
        e.get("ok") for e in proof["engines_run"].values()
    )

    if engines_ok and successful_endpoints == total_endpoints:
        proof["final_status"] = "FINANCIAL_INTELLIGENCE_READY"
    elif successful_endpoints > 0 and engines_ok:
        proof["final_status"] = "FINANCIAL_INTELLIGENCE_PARTIAL"
    else:
        proof["final_status"] = "FINANCIAL_INTELLIGENCE_PARTIAL"

    proof["runtime_metrics"] = {
        "successful_endpoints": successful_endpoints,
        "total_endpoints": total_endpoints,
        "endpoint_success_rate": round(
            (successful_endpoints / total_endpoints) * 100, 1
        ) if total_endpoints else 0,
        "engines_successful": sum(
            1 for e in proof["engines_run"].values() if e.get("ok")
        ),
        "total_engines": len(proof["engines_run"]),
    }

    print(f"\n[summary] Final status: {proof['final_status']}")
    print(f"[summary] Endpoints: {successful_endpoints}/{total_endpoints} successful")
    print(f"[summary] Engines: {proof['runtime_metrics']['engines_successful']}/"
          f"{proof['runtime_metrics']['total_engines']} operational")

    # ── Save proof artifacts ───────────────────────────────────────────
    proof_path = PROOF_DIR / "proof.json"
    proof_path.write_text(json.dumps(proof, indent=2, default=str), encoding="utf-8")
    print(f"\n[save] Proof written to {proof_path}")

    # Also write to root evidence dir for direct review
    (HERE / "FINANCIAL_INTELLIGENCE_RUNTIME_PROOF.json").write_text(
        json.dumps(proof, indent=2, default=str), encoding="utf-8"
    )

    return proof


if __name__ == "__main__":
    main()
