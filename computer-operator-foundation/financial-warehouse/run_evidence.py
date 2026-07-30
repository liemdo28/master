"""Start the warehouse, exercise every endpoint, and write proof to disk."""

import json
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

BASE = Path(__file__).resolve().parent
EVIDENCE_DIR = BASE / "runtime-evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)
SERVER_LOG = EVIDENCE_DIR / "warehouse.stdout.log"
PROOF_LOG = EVIDENCE_DIR / "proof.json"

PORT = 5177
BASE_URL = f"http://127.0.0.1:{PORT}"


def start_server():
    proc = subprocess.Popen(
        [sys.executable, str(BASE / "app.py")],
        cwd=str(BASE),
        stdout=open(SERVER_LOG, "w", encoding="utf-8"),
        stderr=subprocess.STDOUT,
    )
    # Wait for server to be ready
    for _ in range(30):
        time.sleep(0.5)
        try:
            req = urllib.request.Request(f"{BASE_URL}/health")
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.status == 200:
                    return proc
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
    proc.kill()
    raise RuntimeError("Server failed to start within 15s")


def call(method, path, body=None):
    url = f"{BASE_URL}{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    if body:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, json.loads(resp.read().decode())


def main():
    print("Starting warehouse server...")
    proc = start_server()
    print(f"Server started (pid={proc.pid})")

    results = []

    # 1. GET /health
    print("1. GET /health")
    code, body = call("GET", "/health")
    results.append({"endpoint": "GET /health", "status": code, "body": body})
    print(f"   -> {code} {json.dumps(body)[:120]}")

    # 2. Register 8 sources
    sources = [
        {"source_id": "quickbooks", "source_name": "QuickBooks Desktop", "owner": "finance", "classification": "STALE", "health": "DEGRADED"},
        {"source_id": "accounting_engine", "source_name": "Accounting Engine (port 8844)", "owner": "data_engineering", "classification": "LIVE", "health": "HEALTHY"},
        {"source_id": "toast", "source_name": "Toast POS", "owner": "operations", "classification": "MISSING", "health": "UNKNOWN"},
        {"source_id": "doordash", "source_name": "DoorDash Merchant", "owner": "operations", "classification": "MISSING", "health": "UNKNOWN"},
        {"source_id": "payroll", "source_name": "Payroll System", "owner": "hr_finance", "classification": "MISSING", "health": "UNKNOWN"},
        {"source_id": "ga4", "source_name": "Google Analytics 4", "owner": "marketing", "classification": "MISSING", "health": "UNKNOWN"},
        {"source_id": "gsc", "source_name": "Google Search Console", "owner": "marketing", "classification": "MISSING", "health": "UNKNOWN"},
        {"source_id": "gbp", "source_name": "Google Business Profile Reviews", "owner": "marketing", "classification": "BLOCKED", "health": "UNKNOWN"},
    ]

    for i, s in enumerate(sources, 2):
        print(f"{i}. POST /sources/register ({s['source_id']})")
        code, body = call("POST", "/sources/register", s)
        results.append({"endpoint": f"POST /sources/register ({s['source_id']})", "status": code, "body": body})
        print(f"   -> {code}")

    # 9. GET /sources
    print("9. GET /sources")
    code, body = call("GET", "/sources")
    results.append({"endpoint": "GET /sources", "status": code, "count": body["count"]})
    print(f"   -> {code} count={body['count']}")

    # 10. Register a sample snapshot for accounting_engine
    print("10. POST /snapshots/register (accounting_engine)")
    code, body = call("POST", "/snapshots/register", {
        "source_id": "accounting_engine",
        "snapshot_id": "ae-2026-06-26-health",
        "record_count": 1,
        "confidence": "MEDIUM",
        "notes": "Heartbeat snapshot from local probe",
    })
    results.append({"endpoint": "POST /snapshots/register (accounting_engine)", "status": code, "body": body})
    print(f"   -> {code}")

    # 11. Register a sample snapshot for quickbooks (simulated stale data)
    print("11. POST /snapshots/register (quickbooks)")
    code, body = call("POST", "/snapshots/register", {
        "source_id": "quickbooks",
        "snapshot_id": "qb-2026-06-20-daily",
        "record_count": 0,
        "confidence": "LOW",
        "notes": "Simulated — no real QB data connected yet",
    })
    results.append({"endpoint": "POST /snapshots/register (quickbooks)", "status": code, "body": body})
    print(f"   -> {code}")

    # 12. GET /freshness
    print("12. GET /freshness")
    code, body = call("GET", "/freshness")
    results.append({"endpoint": "GET /freshness", "status": code, "count": body["count"]})
    print(f"   -> {code} count={body['count']}")

    # 13. GET /runtime-proof
    print("13. GET /runtime-proof")
    code, body = call("GET", "/runtime-proof")
    results.append({"endpoint": "GET /runtime-proof", "status": code, "body": body})
    print(f"   -> {code} {json.dumps(body)[:120]}")

    # Write proof
    proof = {
        "phase": "3A",
        "title": "Financial Warehouse Runtime Proof",
        "timestamp": body.get("ts"),
        "server_pid": proc.pid,
        "port": PORT,
        "calls": results,
        "outcome": "FINANCIAL_WAREHOUSE_MVP_OPERATIONAL",
    }
    with PROOF_LOG.open("w", encoding="utf-8") as f:
        json.dump(proof, f, indent=2)
    print(f"\nProof written to {PROOF_LOG}")

    # Stop server
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
    print("Server stopped.")

    # Summary
    successes = sum(1 for r in results if r["status"] in (200, 201))
    total = len(results)
    print(f"\n=== RESULT: {successes}/{total} endpoints returned success ===")
    return 0 if successes == total else 1


if __name__ == "__main__":
    sys.exit(main())
