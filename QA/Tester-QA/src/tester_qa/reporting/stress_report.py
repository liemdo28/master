from __future__ import annotations

from tester_qa.metrics import stability_score
from tester_qa.models import Severity
from tester_qa.reporting.executive import ExecutiveReport, render_standard_report
from tester_qa.stress.models import StressResult


def render_stress_report(result: StressResult) -> str:
    score = stability_score(result.total, result.failed, result.p95_ms)
    severity = Severity.HIGH if result.failed else Severity.MEDIUM if result.p95_ms > 1000 else Severity.LOW
    return render_standard_report(
        ExecutiveReport(
            title=f"Stress Test Report: {result.scenario}",
            system_status=f"Target {result.target}. Success {result.success}/{result.total}. Stability score {score}/100.",
            evidence=result.errors,
            findings=[
                f"Total requests/events: {result.total}",
                f"Failed: {result.failed}",
                f"P95 latency: {result.p95_ms}ms",
                f"Duration: {result.duration_ms}ms",
            ],
            root_cause="Stress result indicates capacity, dependency, or runtime stability limits when failures are present.",
            risk_level=severity,
            impact="Stress failures may surface as timeout, stale state, retry storms, queue overload, or degraded user workflows.",
            recommended_fix=["Investigate failed requests/events, tune timeout/backpressure, and add regression stress coverage."],
            validation_plan=["Repeat stress test with same parameters after remediation."],
            decision_required=["Confirm acceptable failure rate and latency SLO."],
            next_actions=["Attach report to release readiness review."],
        )
    )
