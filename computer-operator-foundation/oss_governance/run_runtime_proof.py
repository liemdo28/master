"""Runtime Proof Runner — certification harness for Phase 0.5.

Mirrors financial_intelligence/run_runtime_proof.py pattern:
1. Load registry from disk
2. Run self-test (dashboard_api.run_self_test)
3. Verify dashboard API endpoints respond (HTTP smoke test)
4. Verify coordination adapter emits signals
5. Write machine-readable proof.json
6. Print executive summary

CTO Rule: No fake PASS. If a test fails, the proof reflects FAIL.
"""
from __future__ import annotations

import json
import socket
import sys
import time
import threading
from datetime import datetime, timezone
from http.client import HTTPConnection
from pathlib import Path

from . import registry
from . import scorecard
from . import lifecycle_engine
from . import coordination_adapter
from . import seed_candidates
from . import dashboard_api

PROOF_DIR = Path(__file__).resolve().parent / "runtime-evidence"
PROOF_DIR.mkdir(exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _smoke_test_dashboard(host: str = "127.0.0.1", port: int = 5180) -> dict:
    """Spin up dashboard on a port, hit each endpoint, return result dict."""
    # Start server in a thread
    server = dashboard_api.run_server(host=host, port=port)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    # Give it a moment to bind
    time.sleep(0.5)

    endpoints = [
        ("GET", "/api/oss/health"),
        ("GET", "/api/oss/registry"),
        ("GET", "/api/oss/pipeline"),
        ("GET", "/api/oss/scorecards"),
        ("GET", "/api/oss/risks"),
        ("GET", "/api/oss/coordination"),
        ("GET", "/api/oss/lifecycle/events"),
        ("GET", "/api/oss/lifecycle/gates"),
        ("GET", "/api/oss/summary"),
        ("GET", "/api/oss/runtime-proof"),
        ("GET", "/api/oss/registry/division/Engineering"),
        ("GET", "/api/oss/registry/stage/DISCOVERY"),
        ("POST", "/api/oss/coordination/emit"),
    ]

    results = []
    for method, path in endpoints:
        try:
            conn = HTTPConnection(host, port, timeout=5)
            conn.request(method, path)
            resp = conn.getresponse()
            body = resp.read()
            status_code = resp.status
            # Try to parse JSON
            try:
                payload = json.loads(body)
                valid_json = True
            except Exception:
                payload = None
                valid_json = False
            results.append({
                "endpoint": f"{method} {path}",
                "status_code": status_code,
                "valid_json": valid_json,
                "ok": status_code == 200 and valid_json,
            })
            conn.close()
        except Exception as e:
            results.append({
                "endpoint": f"{method} {path}",
                "status_code": 0,
                "valid_json": False,
                "ok": False,
                "error": str(e),
            })

    server.shutdown()
    server.server_close()

    return {
        "total_endpoints": len(endpoints),
        "passed": sum(1 for r in results if r["ok"]),
        "failed": sum(1 for r in results if not r["ok"]),
        "results": results,
    }


def _check_port_available(host: str, port: int) -> bool:
    """Return True if port is bindable."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind((host, port))
        s.close()
        return True
    except OSError:
        return False


def run_runtime_proof(seed_if_empty: bool = True) -> dict:
    """Run the full runtime proof. Returns the proof dict.

    Args:
        seed_if_empty: If True, will seed registry with 25 candidates
                       if it has 0 entries.
    """
    proof = {
        "phase": "0.5",
        "module": "oss_governance",
        "started_at": _now_iso(),
        "tests": [],
        "summary": {},
        "status": "UNKNOWN",
    }

    failures = 0

    def check(name: str, condition: bool, detail: str = ""):
        nonlocal failures
        status = "PASS" if condition else "FAIL"
        if not condition:
            failures += 1
        proof["tests"].append({"name": name, "status": status, "detail": detail})
        print(f"  [{status}] {name}: {detail}")

    # ------------------------------------------------------------------
    # 1. Load registry
    # ------------------------------------------------------------------
    print("\n[1] Loading registry from disk...")
    registry.load_registry()
    initial_count = len(registry.list_all())
    print(f"     Initial registry size: {initial_count}")

    # 1b. Seed if empty (and requested)
    if initial_count == 0 and seed_if_empty:
        print("\n[1b] Registry empty — seeding 25 candidates from Master Spec...")
        seed_result = seed_candidates.seed_all()
        print(f"     Seed status: {seed_result['status']} | registered: {seed_result['registered_count']}")
        check("seed_25_candidates", seed_result["registered_count"] >= 25,
              f"registered={seed_result['registered_count']}")
    else:
        check("registry_nonempty", initial_count > 0, f"count={initial_count}")

    # Note: self-test in dashboard_api.run_self_test() creates 1 extra project
    # (TEST_INTEGRATION, retired). So after full run: >= 25.
    final_count = len(registry.list_all())
    check("registry_25_projects", final_count >= 25, f"count={final_count}")

    # ------------------------------------------------------------------
    # 2. Registry enums correct
    # ------------------------------------------------------------------
    print("\n[2] Registry enums...")
    check("8_lifecycle_stages", len(registry.LIFECYCLE_STAGES) == 8)
    check("6_divisions", len(registry.DIVISIONS) >= 6)
    check("6_categories", set(registry.CATEGORIES) == set([
        "Engineering", "Operator", "Finance", "Marketing", "IT", "Creative"
    ]))

    # ------------------------------------------------------------------
    # 3. License risk coverage
    # ------------------------------------------------------------------
    print("\n[3] License risk mapping...")
    check("license_mit_low", registry.LICENSE_RISKS["MIT"] == "LOW")
    check("license_agpl_high", registry.LICENSE_RISKS["AGPL-3.0"] == "HIGH")
    check("license_unknown", registry.LICENSE_RISKS["UNKNOWN"] == "UNKNOWN")

    # ------------------------------------------------------------------
    # 4. Scorecard evaluation
    # ------------------------------------------------------------------
    print("\n[4] Scorecard evaluation...")
    sc_mit = scorecard.evaluate_license("MIT")
    check("license_score_mit", sc_mit["score"] == 1.0)
    sc_agpl = scorecard.evaluate_license("AGPL-3.0")
    check("license_score_agpl", sc_agpl["score"] == 0.2)
    sc_unknown = scorecard.evaluate_license("UNKNOWN")
    check("license_score_unknown", sc_unknown["risk"] == "UNKNOWN")

    # ------------------------------------------------------------------
    # 5. Lifecycle engine stage gates
    # ------------------------------------------------------------------
    print("\n[5] Lifecycle engine...")
    check("8_stage_gates", len(lifecycle_engine.STAGE_GATES) == 8)
    check("retired_is_terminal", lifecycle_engine.STAGE_GATES["RETIRED"]["next_action"] is None)

    # Test can_advance on a real project
    first_project = registry.list_all()[0] if registry.list_all() else None
    if first_project:
        gate = lifecycle_engine.can_advance(first_project["project_id"], "AUDIT")
        check("can_advance_to_audit", gate["allowed"], gate["reason"])

        # Try skipping — should fail
        skip_gate = lifecycle_engine.can_advance(first_project["project_id"], "PRODUCTION")
        check("cannot_skip_stages", not skip_gate["allowed"], skip_gate["reason"])

        # Advance for real
        lifecycle_engine.advance_stage(
            first_project["project_id"], "AUDIT",
            approver="runtime_proof", notes="proof runner",
        )
        check("advance_to_audit", registry.get_project(first_project["project_id"])["lifecycle_stage"] == "AUDIT")

    # ------------------------------------------------------------------
    # 6. Pipeline summary
    # ------------------------------------------------------------------
    print("\n[6] Pipeline summary...")
    pipeline = lifecycle_engine.get_pipeline_summary()
    check("pipeline_has_stages", "by_stage" in pipeline)
    check("pipeline_total", pipeline["total_projects"] == final_count)

    # ------------------------------------------------------------------
    # 7. Coordination adapter
    # ------------------------------------------------------------------
    print("\n[7] Coordination adapter...")
    coord_summary = coordination_adapter.get_coordination_summary()
    check("coord_summary", "total_tasks" in coord_summary)

    # Detect risks
    risks = coordination_adapter.detect_risks()
    check("risks_detected", isinstance(risks, list))
    risk_types = {r["risk"] for r in risks}
    print(f"     Risk types: {risk_types}")

    # ------------------------------------------------------------------
    # 8. Run self-test from dashboard_api
    # ------------------------------------------------------------------
    print("\n[8] Self-test...")
    self_test = dashboard_api.run_self_test()
    check("self_test_pass", self_test["failures"] == 0,
          f"passed={self_test['passed']}/{self_test['total']} failures={self_test['failures']}")

    # ------------------------------------------------------------------
    # 9. Dashboard API smoke test
    # ------------------------------------------------------------------
    print("\n[9] Dashboard API smoke test...")
    host = "127.0.0.1"
    port = dashboard_api.PORT

    # Find a free port if 5180 is busy
    for candidate_port in range(5180, 5200):
        if _check_port_available(host, candidate_port):
            port = candidate_port
            break

    smoke = _smoke_test_dashboard(host=host, port=port)
    check("dashboard_13_endpoints", smoke["passed"] == smoke["total_endpoints"],
          f"passed={smoke['passed']}/{smoke['total_endpoints']}")

    # ------------------------------------------------------------------
    # Final summary
    # ------------------------------------------------------------------
    proof["finished_at"] = _now_iso()
    proof["summary"] = {
        "total_tests": len(proof["tests"]),
        "passed": sum(1 for t in proof["tests"] if t["status"] == "PASS"),
        "failed": failures,
        "registry_count": final_count,
        "dashboard_endpoints": smoke["total_endpoints"],
        "dashboard_passed": smoke["passed"],
        "self_test_passed": self_test["passed"],
        "self_test_total": self_test["total"],
        "pipeline_health": pipeline["pipeline_health"],
        "coordination_tasks": coord_summary["total_tasks"],
        "risks_detected": len(risks),
        "risk_types": list(risk_types),
    }
    proof["status"] = "PASS" if failures == 0 else "FAIL"
    proof["dashboard_smoke"] = smoke

    # Write proof.json
    proof_file = PROOF_DIR / "proof.json"
    proof_file.write_text(json.dumps(proof, indent=2, default=str), encoding="utf-8")

    print("\n" + "=" * 60)
    print(f"PHASE 0.5 — OSS GOVERNANCE RUNTIME PROOF")
    print(f"Status: {proof['status']}")
    print(f"Tests: {proof['summary']['passed']}/{proof['summary']['total_tests']} PASS")
    print(f"Registry: {proof['summary']['registry_count']} projects")
    print(f"Dashboard endpoints: {proof['summary']['dashboard_passed']}/{proof['summary']['dashboard_endpoints']}")
    print(f"Self-test: {proof['summary']['self_test_passed']}/{proof['summary']['self_test_total']}")
    print(f"Coordination tasks: {proof['summary']['coordination_tasks']}")
    print(f"Risks detected: {proof['summary']['risks_detected']}")
    print(f"Pipeline health: {proof['summary']['pipeline_health']}")
    print("=" * 60)
    print(f"Proof written to: {proof_file}")

    return proof


if __name__ == "__main__":
    proof = run_runtime_proof(seed_if_empty="--no-seed" not in sys.argv)
    sys.exit(0 if proof["status"] == "PASS" else 1)
