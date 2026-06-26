"""
Phase H — Policy Guard Re-Test.

Verifies the policy guard blocks the targeted unsafe systems while allowing safe targets.
"""
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from policy_guard import check_target, classify_target  # noqa: E402

BLOCKED_TARGETS = [
    "doordash.com",
    "merchant.doordash.com",
    "toasttab.com",
    "pos.toasttab.com",
    "qbo.intuit.com",
    "quickbooks.intuit.com",
    "business.google.com",
    "google.com/business",
    "dreamhost.com",
    "panel.dreamhost.com",
    "dash.cloudflare.com",
    "cloudflare.com",
    "mybank.com",
    "chase.com",
    "payroll.example.com",
    "adp.com",
    "paychex.com",
]

SAFE_TARGETS = [
    "https://example.com",
    "file:///d:/Project/computer-operator-foundation/operator-runtime/static/test-form.html",
    "http://localhost:8765/api/operator/health",
    "http://127.0.0.1:8080/test",
]


def run_policy_test():
    started = time.time()
    results = {
        "started_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "blocked_tests": [],
        "safe_tests": [],
        "summary": {},
    }

    for target in BLOCKED_TARGETS:
        decision = check_target(target)
        passed = decision["ok"] is False and decision["status"] == "BLOCKED_BY_POLICY"
        results["blocked_tests"].append({
            "target": target,
            "decision": decision,
            "passed": passed,
        })

    for target in SAFE_TARGETS:
        decision = check_target(target)
        passed = decision["ok"] is True and decision["status"] == "APPROVED"
        results["safe_tests"].append({
            "target": target,
            "decision": decision,
            "passed": passed,
        })

    blocked_passed = sum(1 for r in results["blocked_tests"] if r["passed"])
    safe_passed = sum(1 for r in results["safe_tests"] if r["passed"])
    total = len(BLOCKED_TARGETS) + len(SAFE_TARGETS)

    results["summary"] = {
        "total": total,
        "blocked_tested": len(BLOCKED_TARGETS),
        "blocked_passed": blocked_passed,
        "safe_tested": len(SAFE_TARGETS),
        "safe_passed": safe_passed,
        "all_passed": blocked_passed == len(BLOCKED_TARGETS) and safe_passed == len(SAFE_TARGETS),
        "duration_seconds": round(time.time() - started, 3),
    }
    results["finished_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    out_file = HERE / "evidence" / "policy_retest.json"
    out_file.write_text(json.dumps(results, indent=2), encoding="utf-8")

    print(json.dumps(results["summary"], indent=2))
    return results


if __name__ == "__main__":
    run_policy_test()