from __future__ import annotations

from tester_qa.models import (
    Evidence,
    IncidentReport,
    Recommendation,
    Severity,
    TestCase,
    TestCategory,
    TestPlan,
)
from tester_qa.reporting import render_incident_report, render_test_plan


class QAAuditAuthority:
    """High-level QA service for validation plans and incident report templates."""

    def create_incident_report(
        self,
        title: str,
        severity: Severity = Severity.MEDIUM,
        summary: str | None = None,
        evidence: list[Evidence] | None = None,
    ) -> IncidentReport:
        return IncidentReport(
            title=title,
            severity=severity,
            summary=summary or "Operational anomaly detected. Investigation required.",
            evidence=evidence or [],
            root_cause="Unknown pending reproduction and trace analysis.",
            systemic_impact="Potential impact across orchestration, worker state, memory, and communication layers.",
            reproduction=[
                "Capture environment, input payload, session ID, and runtime version.",
                "Replay the same workflow with trace logging enabled.",
                "Compare expected state transitions against observed state transitions.",
            ],
            fix_strategy=[
                "Stabilize the immediate failure path.",
                "Add regression coverage around the confirmed failure chain.",
                "Instrument the weak boundary with structured logs and metrics.",
            ],
            validation=[
                "Run focused reproduction test.",
                "Run adjacent workflow regression tests.",
                "Verify monitoring signals and report output.",
            ],
            prevention=[
                "Convert the incident into a regression test.",
                "Define owner and SLA for the failing subsystem.",
                "Add alerting for early failure indicators.",
            ],
            long_term_refactor=[
                "Reduce hidden coupling between orchestration, worker state, and memory contracts.",
                "Standardize operational events across modules.",
            ],
        )

    def render_incident(self, report: IncidentReport) -> str:
        return render_incident_report(report)

    def create_test_plan(self, system: str, scope: str | None = None) -> TestPlan:
        return TestPlan(
            system=system,
            scope=scope or "End-to-end runtime stability and operational readiness validation.",
            cases=[
                TestCase(
                    name="Critical workflow smoke",
                    category=TestCategory.FUNCTIONAL,
                    objective="Verify primary user workflow completes without state corruption.",
                    signal="Successful execution trace and final state.",
                    expected="No exception, no stale state, report generated.",
                ),
                TestCase(
                    name="Concurrent worker saturation",
                    category=TestCategory.CONCURRENCY,
                    objective="Expose race conditions and worker deadlocks under parallel execution.",
                    signal="Queue depth, active workers, completion latency, error rate.",
                    expected="Bounded latency, no deadlock, graceful backpressure.",
                ),
                TestCase(
                    name="Provider failure injection",
                    category=TestCategory.PROVIDER,
                    objective="Validate retry, fallback, and circuit-breaker behavior.",
                    signal="Retry count, fallback path, user-facing status.",
                    expected="Failure isolated with actionable error and preserved session state.",
                ),
                TestCase(
                    name="Websocket interruption",
                    category=TestCategory.WEBSOCKET,
                    objective="Detect stream interruption and dashboard desync.",
                    signal="Reconnect events, sequence gaps, stale UI state.",
                    expected="Automatic recovery or explicit degraded-state indicator.",
                ),
                TestCase(
                    name="Queue overload",
                    category=TestCategory.QUEUE,
                    objective="Validate queue limits, prioritization, and overload behavior.",
                    signal="Queue depth, dropped jobs, timeout rate.",
                    expected="No silent job loss; overload is reported and recoverable.",
                ),
                TestCase(
                    name="Session corruption replay",
                    category=TestCategory.SESSION,
                    objective="Ensure corrupted session state does not poison future runs.",
                    signal="Session validation result and recovery path.",
                    expected="Corruption detected, isolated, and recoverable.",
                ),
                TestCase(
                    name="Visual dashboard QA",
                    category=TestCategory.VISUAL,
                    objective="Detect broken layout, stale panels, and async render issues.",
                    signal="Screenshot evidence and UI state diff.",
                    expected="No overlapping controls, broken empty state, or stale operational status.",
                ),
            ],
            bottlenecks=[
                "Missing baseline metrics will weaken severity scoring.",
                "Unstructured logs will slow root-cause analysis.",
                "No synthetic failure injection will hide provider and queue risks.",
            ],
            recommendations=[
                Recommendation(
                    action="Establish a minimum operational telemetry contract for every subsystem.",
                    owner="Platform",
                    priority=Severity.HIGH,
                ),
                Recommendation(
                    action="Add incident templates to every critical workflow.",
                    owner="QA",
                    priority=Severity.MEDIUM,
                ),
                Recommendation(
                    action="Run concurrency and provider-failure suites before release gates.",
                    owner="Engineering",
                    priority=Severity.HIGH,
                ),
            ],
        )

    def render_test_plan(self, plan: TestPlan) -> str:
        return render_test_plan(plan)
