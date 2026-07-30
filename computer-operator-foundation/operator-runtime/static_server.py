"""
Phase H — Policy Guard Re-Test (verify blocking).

Quick demo to verify DemoRun refuses blocked targets before any browser starts.
"""
import json
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from demo_runner import DemoRun


def attempt_blocked(target: str) -> dict:
    started = time.time()
    result = {
        "target": target,
        "attempted_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    try:
        DemoRun(demo_name=f"policy-test-{target}", target=target, approval_level="READ_ONLY")
        result["blocked"] = False
        result["error"] = "DemoRun unexpectedly accepted blocked target"
    except RuntimeError as e:
        result["blocked"] = True
        result["error"] = str(e)
    except Exception as e:
        result["blocked"] = True
        result["error"] = str(e)
    result["duration_seconds"] = round(time.time() - started, 3)
    return result


if __name__ == "__main__":
    targets = [
        "doordash.com",
        "toasttab.com",
        "qbo.intuit.com",
        "business.google.com",
        "panel.dreamhost.com",
        "dash.cloudflare.com",
        "chase.com",
        "payroll.example.com",
    ]
    results = [attempt_blocked(t) for t in targets]
    out = HERE / "evidence" / "policy_block_attempts.json"
    out.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps({"blocked_count": sum(1 for r in results if r["blocked"]), "total": len(results)}, indent=2))