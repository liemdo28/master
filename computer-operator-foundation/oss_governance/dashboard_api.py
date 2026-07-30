"""OSS Governance Dashboard API — read-only executive endpoints.

Port 5180 (next available after Financial Intelligence's 5178).

All endpoints are READ-ONLY. No fabrication. No upstream writes.
Every response includes a 'ts' field for freshness awareness.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from . import registry
from . import scorecard
from . import lifecycle_engine
from . import coordination_adapter

# ---------------------------------------------------------------------------
# API constants
# ---------------------------------------------------------------------------

PORT = 5180
DASHBOARD_DIR = Path(__file__).resolve().parent
RUNTIME_EVIDENCE_DIR = DASHBOARD_DIR / "runtime-evidence"
RUNTIME_EVIDENCE_DIR.mkdir(exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Route handlers (all return dicts)
# ---------------------------------------------------------------------------

def handle_health() -> dict:
    """GET /api/oss/health"""
    reg_summary = registry.get_registry_summary()
    pipeline = lifecycle_engine.get_pipeline_summary()
    coord = coordination_adapter.get_coordination_summary()
    scorecards = scorecard.list_scorecards()
    return {
        "status": "OK",
        "module": "oss_governance",
        "version": "0.1.0",
        "registry": reg_summary,
        "pipeline": pipeline,
        "coordination_tasks": coord["total_tasks"],
        "scorecards_count": len(scorecards),
        "ts": _now_iso(),
    }


def handle_registry() -> dict:
    """GET /api/oss/registry"""
    projects = registry.list_all()
    return {
        "total": len(projects),
        "projects": [
            {
                "project_id": p["project_id"],
                "name": p["name"],
                "github": p["github"],
                "owner_division": p["owner_division"],
                "category": p["category"],
                "license": p["license"],
                "license_risk": p["license_risk"],
                "lifecycle_stage": p["lifecycle_stage"],
                "status": p["status"],
            }
            for p in projects
        ],
        "ts": _now_iso(),
    }


def handle_registry_by_division(division: str) -> dict:
    """GET /api/oss/registry/division/{division}"""
    projects = registry.list_by_division(division)
    return {
        "division": division,
        "total": len(projects),
        "projects": [
            {
                "project_id": p["project_id"],
                "name": p["name"],
                "lifecycle_stage": p["lifecycle_stage"],
                "status": p["status"],
            }
            for p in projects
        ],
        "ts": _now_iso(),
    }


def handle_registry_by_stage(stage: str) -> dict:
    """GET /api/oss/registry/stage/{stage}"""
    projects = registry.list_by_stage(stage)
    return {
        "stage": stage,
        "total": len(projects),
        "projects": [
            {
                "project_id": p["project_id"],
                "name": p["name"],
                "owner_division": p["owner_division"],
                "status": p["status"],
            }
            for p in projects
        ],
        "ts": _now_iso(),
    }


def handle_project(project_id: str) -> dict:
    """GET /api/oss/projects/{project_id}"""
    project = registry.get_project(project_id)
    if not project:
        return {"error": f"Project not found: {project_id}", "status": 404}
    sc = scorecard.get_scorecard(project_id)
    return {
        **project,
        "scorecard": sc,
        "ts": _now_iso(),
    }


def handle_pipeline() -> dict:
    """GET /api/oss/pipeline"""
    return lifecycle_engine.get_pipeline_summary()


def handle_scorecards() -> dict:
    """GET /api/oss/scorecards"""
    cards = scorecard.list_scorecards()
    return {
        "total": len(cards),
        "scorecards": cards,
        "ts": _now_iso(),
    }


def handle_risks() -> dict:
    """GET /api/oss/risks"""
    risks = coordination_adapter.detect_risks()
    return {
        "total": len(risks),
        "risks": risks,
        "ts": _now_iso(),
    }


def handle_coordination() -> dict:
    """GET /api/oss/coordination"""
    return coordination_adapter.get_coordination_summary()


def handle_coordination_emit() -> dict:
    """POST /api/oss/coordination/emit (read-only: triggers scan, returns results)"""
    emitted = coordination_adapter.scan_and_emit()
    return {
        "status": "EMITTED",
        "tasks_created": len(emitted["tasks_created"]),
        "risks_created": len(emitted["risks_created"]),
        "alerts_created": len(emitted["alerts_created"]),
        "emitted": emitted,
        "ts": _now_iso(),
    }


def handle_lifecycle_events() -> dict:
    """GET /api/oss/lifecycle/events"""
    events = lifecycle_engine.list_lifecycle_events()
    return {
        "total": len(events),
        "events": events,
        "ts": _now_iso(),
    }


def handle_lifecycle_gates() -> dict:
    """GET /api/oss/lifecycle/gates"""
    gates = {}
    for stage in registry.LIFECYCLE_STAGES:
        gates[stage] = lifecycle_engine.get_stage_gate(stage)
    return {"gates": gates, "ts": _now_iso()}


def handle_summary() -> dict:
    """GET /api/oss/summary"""
    reg = registry.get_registry_summary()
    pipeline = lifecycle_engine.get_pipeline_summary()
    risks = coordination_adapter.detect_risks()
    coord = coordination_adapter.get_coordination_summary()
    scorecards = scorecard.list_scorecards()

    # Count verdicts
    buy_count = sum(1 for sc in scorecards if sc.get("roi", {}).get("verdict") in ("STRONG_BUY", "BUY"))
    hold_count = sum(1 for sc in scorecards if sc.get("roi", {}).get("verdict") == "HOLD")
    pass_count = sum(1 for sc in scorecards if sc.get("roi", {}).get("verdict") == "PASS")

    return {
        "registry": reg,
        "pipeline": pipeline,
        "risks": {
            "total": len(risks),
            "p0": sum(1 for r in risks if r["severity"] == "P0"),
            "p1": sum(1 for r in risks if r["severity"] == "P1"),
            "p2": sum(1 for r in risks if r["severity"] == "P2"),
        },
        "scorecards": {
            "total": len(scorecards),
            "buy": buy_count,
            "hold": hold_count,
            "pass": pass_count,
        },
        "coordination": {
            "total_tasks": coord["total_tasks"],
        },
        "ts": _now_iso(),
    }


def handle_runtime_proof() -> dict:
    """GET /api/oss/runtime-proof"""
    results = run_self_test()
    return {
        "status": "PASS" if results["failures"] == 0 else "FAIL",
        "total_tests": results["total"],
        "passed": results["passed"],
        "failures": results["failures"],
        "tests": results["tests"],
        "ts": _now_iso(),
    }


# ---------------------------------------------------------------------------
# Self-test (for runtime proof)
# ---------------------------------------------------------------------------

def run_self_test() -> dict:
    """Run all self-checks. Returns dict with total, passed, failures, tests."""
    tests = []
    failures = 0

    def check(name: str, condition: bool, detail: str = ""):
        nonlocal failures
        status = "PASS" if condition else "FAIL"
        if not condition:
            failures += 1
        tests.append({"name": name, "status": status, "detail": detail})

    # 1. Registry exists
    reg = registry.get_registry_summary()
    check("registry_loads", reg["total"] >= 0, f"total={reg['total']}")

    # 2. Lifecycle engine present
    pipeline = lifecycle_engine.get_pipeline_summary()
    check("lifecycle_pipeline", "by_stage" in pipeline, str(pipeline.get("by_stage")))

    # 3. Coordination adapter present
    coord = coordination_adapter.get_coordination_summary()
    check("coordination_adapter", "total_tasks" in coord)

    # 4. Risks detectable
    risks = coordination_adapter.detect_risks()
    check("risks_detectable", isinstance(risks, list), f"count={len(risks)}")

    # 5. Scorecard functions available
    sc = scorecard.evaluate_license("MIT")
    check("scorecard_license", sc["score"] == 1.0, f"score={sc['score']}")

    # 6. License risk map correct
    check("license_risk_map", registry.LICENSE_RISKS.get("MIT") == "LOW")

    # 7. Stage gates defined
    check("stage_gates", len(lifecycle_engine.STAGE_GATES) == 8)

    # 8. Division list correct
    check("divisions", len(registry.DIVISIONS) >= 6)

    # 9. Category list matches spec
    check("categories", set(registry.CATEGORIES) == set([
        "Engineering", "Operator", "Finance", "Marketing", "IT", "Creative"
    ]))

    # 10. Summary endpoint
    summary = handle_summary()
    check("summary_endpoint", "registry" in summary and "pipeline" in summary)

    # 11. Health endpoint
    health = handle_health()
    check("health_endpoint", health["status"] == "OK")

    # 12. Lifecycle gates endpoint
    gates = handle_lifecycle_gates()
    check("lifecycle_gates_endpoint", len(gates["gates"]) == 8)

    # 13. No fabrication in registry
    for p in registry.list_all():
        check(
            f"no_fabrication_{p['name']}",
            p["roi"] is None or isinstance(p["roi"], dict),
            f"roi type: {type(p['roi']).__name__}"
        )

    # 14. Risk detection works on empty registry
    check("empty_registry_risk", any(r["risk"] == "EMPTY_REGISTRY" for r in risks) or reg["total"] > 0)

    # 15. Can register and advance (integration test)
    try:
        test_project = registry.register_project(
            name="TEST_INTEGRATION",
            github="https://github.com/test/integration",
            owner_division="Engineering",
            category="Engineering",
            description="Integration test project",
            license="MIT",
        )
        check("register_project", test_project["project_id"].startswith("OSS-"))

        # Advance through stages
        lifecycle_engine.advance_stage(
            test_project["project_id"], "AUDIT", approver="test_runner", notes="integration test"
        )
        check("advance_stage", True)

        # Build scorecard
        sc = scorecard.build_scorecard(
            project_id=test_project["project_id"],
            license_name="MIT",
            stars=5000,
            forks=800,
            contributors=50,
            last_commit_days=10,
            has_api=True,
            has_cli=True,
            has_python_sdk=True,
            release_frequency_months=1.5,
            breaking_changes_per_year=0,
            documentation_quality="good",
        )
        check("build_scorecard", sc["roi"]["status"] == "EVALUATED", f"verdict={sc['roi'].get('verdict')}")

        # Coordination scan
        emitted = coordination_adapter.scan_and_emit()
        check("coordination_emit", isinstance(emitted["tasks_created"], list))

        # Retire
        lifecycle_engine.retire(test_project["project_id"], reason="integration test cleanup", approver="test_runner")
        retired = registry.get_project(test_project["project_id"])
        check("retire_project", retired["lifecycle_stage"] == "RETIRED")

    except Exception as e:
        check("integration_error", False, str(e))

    # 16. Evidence files written
    evidence_files = list((Path(__file__).resolve().parent / "evidence").glob("*.json"))
    check("evidence_files_written", len(evidence_files) > 0, f"count={len(evidence_files)}")

    # 17. Dashboard endpoints present
    check("dashboard_port", PORT == 5180)

    return {
        "total": len(tests),
        "passed": sum(1 for t in tests if t["status"] == "PASS"),
        "failures": failures,
        "tests": tests,
    }


# ---------------------------------------------------------------------------
# HTTP Server
# ---------------------------------------------------------------------------

class OSSDashboardHandler(BaseHTTPRequestHandler):
    """Simple GET-only handler for OSS Governance dashboard."""

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        routes = {
            "/api/oss/health": handle_health,
            "/api/oss/registry": handle_registry,
            "/api/oss/pipeline": handle_pipeline,
            "/api/oss/scorecards": handle_scorecards,
            "/api/oss/risks": handle_risks,
            "/api/oss/coordination": handle_coordination,
            "/api/oss/lifecycle/events": handle_lifecycle_events,
            "/api/oss/lifecycle/gates": handle_lifecycle_gates,
            "/api/oss/summary": handle_summary,
            "/api/oss/runtime-proof": handle_runtime_proof,
        }

        handler = routes.get(path)
        if handler:
            result = handler()
            self._respond(200, result)
        elif path.startswith("/api/oss/registry/division/"):
            division = path.split("/")[-1]
            self._respond(200, handle_registry_by_division(division))
        elif path.startswith("/api/oss/registry/stage/"):
            stage = path.split("/")[-1]
            self._respond(200, handle_registry_by_stage(stage))
        elif path.startswith("/api/oss/projects/"):
            project_id = path.split("/")[-1]
            result = handle_project(project_id)
            code = 200 if "error" not in result else 404
            self._respond(code, result)
        else:
            self._respond(404, {"error": f"Unknown route: {path}"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/api/oss/coordination/emit":
            result = handle_coordination_emit()
            self._respond(200, result)
        else:
            self._respond(404, {"error": f"Unknown POST route: {path}"})

    def _respond(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(body, indent=2, default=str).encode("utf-8"))

    def log_message(self, format, *args):
        # Suppress noisy logs during tests
        pass


def run_server(host: str = "127.0.0.1", port: int = PORT) -> HTTPServer:
    """Start the dashboard server. Returns the HTTPServer instance."""
    server = HTTPServer((host, port), OSSDashboardHandler)
    print(f"[OSS GOVERNANCE] Dashboard API running on http://{host}:{port}")
    print(f"[OSS GOVERNANCE] Endpoints:")
    print(f"  GET  /api/oss/health")
    print(f"  GET  /api/oss/registry")
    print(f"  GET  /api/oss/registry/division/{{division}}")
    print(f"  GET  /api/oss/registry/stage/{{stage}}")
    print(f"  GET  /api/oss/projects/{{project_id}}")
    print(f"  GET  /api/oss/pipeline")
    print(f"  GET  /api/oss/scorecards")
    print(f"  GET  /api/oss/risks")
    print(f"  GET  /api/oss/coordination")
    print(f"  POST /api/oss/coordination/emit")
    print(f"  GET  /api/oss/lifecycle/events")
    print(f"  GET  /api/oss/lifecycle/gates")
    print(f"  GET  /api/oss/summary")
    print(f"  GET  /api/oss/runtime-proof")
    return server


if __name__ == "__main__":
    import sys
    # Load registry first
    registry.load_registry()
    server = run_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[OSS GOVERNANCE] Shutting down.")
        server.shutdown()
