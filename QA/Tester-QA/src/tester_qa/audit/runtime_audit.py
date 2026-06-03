from __future__ import annotations

from tester_qa.audit.models import AuditFinding
from tester_qa.models import RuntimeSnapshot, Severity


def audit_runtime(snapshot: RuntimeSnapshot) -> list[AuditFinding]:
    findings: list[AuditFinding] = []
    if snapshot.queue_depth >= 100:
        findings.append(AuditFinding("runtime", Severity.HIGH, "Queue overload risk", [str(snapshot.queue_depth)]))
    if snapshot.retry_storms > 0:
        findings.append(AuditFinding("runtime", Severity.CRITICAL, "Retry storm detected", [str(snapshot.retry_storms)]))
    if snapshot.provider_latency_ms >= 5000:
        findings.append(AuditFinding("runtime", Severity.HIGH, "Provider latency exceeds SLO", [f"{snapshot.provider_latency_ms}ms"]))
    if snapshot.stuck_workers > 0:
        findings.append(AuditFinding("runtime", Severity.HIGH, "Stuck worker risk", [str(snapshot.stuck_workers)]))
    return findings
