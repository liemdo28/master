"""Silent failure detection — detect failures that don't crash but corrupt state."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class SilentFailure:
    failure_type: str
    project_id: str
    severity: str  # warning | danger | critical
    description: str
    indicators: list[str] = field(default_factory=list)
    detection_method: str = ""
    remediation: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "failure_type": self.failure_type,
            "project_id": self.project_id,
            "severity": self.severity,
            "description": self.description,
            "indicators": self.indicators,
            "detection_method": self.detection_method,
            "remediation": self.remediation,
        }


class SilentFailureEngine:
    """Detect silent failures — the most dangerous kind that don't crash immediately."""

    def __init__(self) -> None:
        self.detected: list[SilentFailure] = []

    def detect_ghost_websocket(self, project_id: str, ws_last_message_age_ms: float, ws_connected: bool) -> SilentFailure | None:
        """Detect ghost WebSocket — technically connected but stale/desynced."""
        if ws_connected and ws_last_message_age_ms > 30000:
            failure = SilentFailure(
                failure_type="ghost_websocket",
                project_id=project_id,
                severity="danger",
                description="WebSocket connection alive but no messages for 30s+ — likely desynced",
                indicators=[
                    f"Last message age: {ws_last_message_age_ms}ms",
                    "Connection state: connected",
                    "Data flow: stalled",
                ],
                detection_method="Message age threshold exceeded while connection reports healthy",
                remediation="Force reconnect and state resync",
            )
            self.detected.append(failure)
            return failure
        return None

    def detect_hidden_retry_loop(self, project_id: str, retry_count: int, retry_interval_ms: float) -> SilentFailure | None:
        """Detect hidden retry loops that appear healthy but amplify exponentially."""
        if retry_count > 5 and retry_interval_ms < 1000:
            failure = SilentFailure(
                failure_type="hidden_retry_loop",
                project_id=project_id,
                severity="critical",
                description=f"Silent retry storm: {retry_count} retries at {retry_interval_ms}ms intervals",
                indicators=[
                    f"Retry count: {retry_count}",
                    f"Interval: {retry_interval_ms}ms",
                    "Pattern: exponential amplification",
                    "Visible symptoms: none yet",
                ],
                detection_method="Retry counter exceeds threshold without visible error",
                remediation="Implement circuit breaker, add jitter, cap retries",
            )
            self.detected.append(failure)
            return failure
        return None

    def detect_memory_drift(self, project_id: str, memory_samples: list[float]) -> SilentFailure | None:
        """Detect slow memory leak — memory growing without obvious cause."""
        if len(memory_samples) < 5:
            return None
        # Check if memory is consistently growing
        diffs = [memory_samples[i+1] - memory_samples[i] for i in range(len(memory_samples)-1)]
        growing = sum(1 for d in diffs if d > 0)
        if growing / len(diffs) > 0.8:  # 80%+ of samples show growth
            avg_growth = sum(d for d in diffs if d > 0) / max(growing, 1)
            failure = SilentFailure(
                failure_type="memory_drift",
                project_id=project_id,
                severity="warning" if avg_growth < 1.0 else "danger",
                description=f"Memory growing consistently: avg +{avg_growth:.2f}MB per sample",
                indicators=[
                    f"Samples: {len(memory_samples)}",
                    f"Growth rate: {avg_growth:.2f}MB/sample",
                    f"Growing in {growing}/{len(diffs)} intervals",
                    f"Current: {memory_samples[-1]:.1f}MB",
                ],
                detection_method="Monotonic memory growth detection across sample window",
                remediation="Profile heap, check for event listener leaks, unbounded caches",
            )
            self.detected.append(failure)
            return failure
        return None

    def detect_queue_latency_creep(self, project_id: str, latency_samples: list[float]) -> SilentFailure | None:
        """Detect queue processing latency slowly increasing."""
        if len(latency_samples) < 5:
            return None
        first_half = sum(latency_samples[:len(latency_samples)//2]) / (len(latency_samples)//2)
        second_half = sum(latency_samples[len(latency_samples)//2:]) / (len(latency_samples) - len(latency_samples)//2)

        if second_half > first_half * 1.5:  # 50%+ increase
            failure = SilentFailure(
                failure_type="queue_latency_creep",
                project_id=project_id,
                severity="danger",
                description=f"Queue latency creeping: {first_half:.0f}ms → {second_half:.0f}ms",
                indicators=[
                    f"Early avg: {first_half:.0f}ms",
                    f"Recent avg: {second_half:.0f}ms",
                    f"Growth: {((second_half/first_half)-1)*100:.0f}%",
                ],
                detection_method="Sliding window latency comparison",
                remediation="Check consumer throughput, scale workers, investigate backpressure",
            )
            self.detected.append(failure)
            return failure
        return None

    def detect_async_state_divergence(self, project_id: str, frontend_state: Any, backend_state: Any) -> SilentFailure | None:
        """Detect when frontend and backend state have diverged silently."""
        if frontend_state != backend_state:
            failure = SilentFailure(
                failure_type="async_state_divergence",
                project_id=project_id,
                severity="critical",
                description="Frontend state != Backend state — silent desynchronization",
                indicators=[
                    "Frontend and backend report different state",
                    "No visible error to user",
                    "Data integrity compromised",
                ],
                detection_method="State hash comparison between frontend and backend",
                remediation="Force state resync, implement optimistic update validation",
            )
            self.detected.append(failure)
            return failure
        return None

    def detect_partial_failure(self, project_id: str, endpoints_healthy: int, endpoints_total: int) -> SilentFailure | None:
        """Detect partial service failure — some endpoints down but service reports healthy."""
        if endpoints_total > 0 and endpoints_healthy < endpoints_total and endpoints_healthy > 0:
            failure_rate = (endpoints_total - endpoints_healthy) / endpoints_total
            if failure_rate > 0.1:  # More than 10% endpoints failing
                failure = SilentFailure(
                    failure_type="partial_failure",
                    project_id=project_id,
                    severity="danger" if failure_rate > 0.3 else "warning",
                    description=f"Partial failure: {endpoints_healthy}/{endpoints_total} endpoints healthy ({failure_rate*100:.0f}% degraded)",
                    indicators=[
                        f"Healthy: {endpoints_healthy}/{endpoints_total}",
                        f"Failure rate: {failure_rate*100:.0f}%",
                        "Service health check: passing (misleading)",
                    ],
                    detection_method="Per-endpoint health verification vs aggregate health check",
                    remediation="Implement granular health checks, add endpoint-level monitoring",
                )
                self.detected.append(failure)
                return failure
        return None

    def run_full_detection(self, project_id: str, metrics: dict[str, Any]) -> list[SilentFailure]:
        """Run all silent failure detections against provided metrics."""
        results: list[SilentFailure] = []

        # Ghost websocket
        ws_age = metrics.get("ws_last_message_age_ms", 0)
        ws_connected = metrics.get("ws_connected", False)
        r = self.detect_ghost_websocket(project_id, ws_age, ws_connected)
        if r:
            results.append(r)

        # Hidden retry
        retry_count = metrics.get("retry_count", 0)
        retry_interval = metrics.get("retry_interval_ms", 5000)
        r = self.detect_hidden_retry_loop(project_id, retry_count, retry_interval)
        if r:
            results.append(r)

        # Memory drift
        memory_samples = metrics.get("memory_samples", [])
        r = self.detect_memory_drift(project_id, memory_samples)
        if r:
            results.append(r)

        # Queue latency
        queue_latencies = metrics.get("queue_latency_samples", [])
        r = self.detect_queue_latency_creep(project_id, queue_latencies)
        if r:
            results.append(r)

        # Partial failure
        healthy = metrics.get("endpoints_healthy", 0)
        total = metrics.get("endpoints_total", 0)
        r = self.detect_partial_failure(project_id, healthy, total)
        if r:
            results.append(r)

        return results

    def get_all_detected(self) -> list[dict[str, Any]]:
        return [f.to_dict() for f in self.detected]
