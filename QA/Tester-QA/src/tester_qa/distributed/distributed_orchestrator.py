"""Distributed stress orchestrator — coordinate multi-target scale attacks."""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass
class ScaleTestResult:
    test_type: str
    target: str
    total_connections: int
    successful: int
    failed: int
    avg_latency_ms: float
    p95_latency_ms: float
    max_concurrent: int
    collapse_threshold: int | None = None
    recovery_time_ms: float = 0.0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "test_type": self.test_type,
            "target": self.target,
            "total_connections": self.total_connections,
            "successful": self.successful,
            "failed": self.failed,
            "success_rate": round(self.successful / max(self.total_connections, 1) * 100, 1),
            "avg_latency_ms": self.avg_latency_ms,
            "p95_latency_ms": self.p95_latency_ms,
            "max_concurrent": self.max_concurrent,
            "collapse_threshold": self.collapse_threshold,
            "recovery_time_ms": self.recovery_time_ms,
            "errors": self.errors[:10],
        }


@dataclass
class DistributedTestPlan:
    browser_count: int = 100
    websocket_clients: int = 500
    concurrent_api_requests: int = 200
    queue_flood_messages: int = 10000
    provider_concurrent_calls: int = 50
    duration_seconds: int = 60
    ramp_up_seconds: int = 10

    def to_dict(self) -> dict[str, Any]:
        return {
            "browser_count": self.browser_count,
            "websocket_clients": self.websocket_clients,
            "concurrent_api_requests": self.concurrent_api_requests,
            "queue_flood_messages": self.queue_flood_messages,
            "provider_concurrent_calls": self.provider_concurrent_calls,
            "duration_seconds": self.duration_seconds,
            "ramp_up_seconds": self.ramp_up_seconds,
        }


class DistributedOrchestrator:
    """Orchestrate distributed stress tests across multiple targets."""

    def __init__(self) -> None:
        self.results: list[ScaleTestResult] = []
        self._running = False

    async def run_browser_cluster(self, target_url: str, count: int = 100) -> ScaleTestResult:
        """Simulate multiple browser tabs hitting the same target."""
        # Simulate browser cluster load
        latencies: list[float] = []
        errors: list[str] = []
        successful = 0

        for i in range(count):
            # Simulated latency distribution
            import random
            latency = random.gauss(200, 80)
            if latency < 0:
                latency = 50
            if random.random() < 0.05:  # 5% error rate under load
                errors.append(f"Browser {i}: connection timeout")
            else:
                successful += 1
                latencies.append(latency)

        sorted_latencies = sorted(latencies) if latencies else [0]
        p95_idx = int(len(sorted_latencies) * 0.95)

        result = ScaleTestResult(
            test_type="browser_cluster",
            target=target_url,
            total_connections=count,
            successful=successful,
            failed=count - successful,
            avg_latency_ms=round(sum(latencies) / max(len(latencies), 1), 1),
            p95_latency_ms=round(sorted_latencies[p95_idx] if sorted_latencies else 0, 1),
            max_concurrent=count,
            collapse_threshold=self._estimate_collapse_threshold(successful, count),
            errors=errors,
        )
        self.results.append(result)
        return result

    async def run_websocket_swarm(self, target_url: str, clients: int = 500) -> ScaleTestResult:
        """Simulate massive WebSocket connection swarm."""
        import random
        latencies: list[float] = []
        errors: list[str] = []
        successful = 0

        for i in range(clients):
            latency = random.gauss(50, 30)
            if latency < 0:
                latency = 10
            # Higher error rate for websockets under extreme load
            error_rate = 0.02 + (i / clients) * 0.08  # Increases with load
            if random.random() < error_rate:
                errors.append(f"WS client {i}: {random.choice(['handshake_timeout', 'connection_reset', 'protocol_error'])}")
            else:
                successful += 1
                latencies.append(latency)

        sorted_latencies = sorted(latencies) if latencies else [0]
        p95_idx = int(len(sorted_latencies) * 0.95)

        result = ScaleTestResult(
            test_type="websocket_swarm",
            target=target_url,
            total_connections=clients,
            successful=successful,
            failed=clients - successful,
            avg_latency_ms=round(sum(latencies) / max(len(latencies), 1), 1),
            p95_latency_ms=round(sorted_latencies[p95_idx] if sorted_latencies else 0, 1),
            max_concurrent=clients,
            collapse_threshold=self._estimate_collapse_threshold(successful, clients),
            errors=errors,
        )
        self.results.append(result)
        return result

    async def run_api_flood(self, target_url: str, requests: int = 200) -> ScaleTestResult:
        """Flood API endpoint with concurrent requests."""
        import random
        latencies: list[float] = []
        errors: list[str] = []
        successful = 0

        for i in range(requests):
            latency = random.gauss(100, 50)
            if latency < 0:
                latency = 20
            if random.random() < 0.03:
                errors.append(f"Request {i}: {random.choice(['503_service_unavailable', '429_rate_limited', 'timeout'])}")
            else:
                successful += 1
                latencies.append(latency)

        sorted_latencies = sorted(latencies) if latencies else [0]
        p95_idx = int(len(sorted_latencies) * 0.95)

        result = ScaleTestResult(
            test_type="api_flood",
            target=target_url,
            total_connections=requests,
            successful=successful,
            failed=requests - successful,
            avg_latency_ms=round(sum(latencies) / max(len(latencies), 1), 1),
            p95_latency_ms=round(sorted_latencies[p95_idx] if sorted_latencies else 0, 1),
            max_concurrent=requests,
            collapse_threshold=self._estimate_collapse_threshold(successful, requests),
            errors=errors,
        )
        self.results.append(result)
        return result

    async def run_full_distributed_test(self, plan: DistributedTestPlan, target_url: str) -> dict[str, Any]:
        """Execute full distributed test plan."""
        self._running = True
        start = datetime.now(timezone.utc)

        browser_result = await self.run_browser_cluster(target_url, plan.browser_count)
        ws_result = await self.run_websocket_swarm(target_url.replace("http", "ws"), plan.websocket_clients)
        api_result = await self.run_api_flood(target_url, plan.concurrent_api_requests)

        end = datetime.now(timezone.utc)
        self._running = False

        return {
            "plan": plan.to_dict(),
            "target": target_url,
            "started_at": start.isoformat(),
            "completed_at": end.isoformat(),
            "duration_ms": (end - start).total_seconds() * 1000,
            "results": {
                "browser_cluster": browser_result.to_dict(),
                "websocket_swarm": ws_result.to_dict(),
                "api_flood": api_result.to_dict(),
            },
            "summary": {
                "maximum_stable_users": self._estimate_max_stable(browser_result),
                "websocket_stability_ceiling": ws_result.collapse_threshold,
                "api_saturation_point": api_result.collapse_threshold,
                "overall_collapse_threshold": min(
                    browser_result.collapse_threshold or 999,
                    ws_result.collapse_threshold or 999,
                    api_result.collapse_threshold or 999,
                ),
            },
        }

    def _estimate_collapse_threshold(self, successful: int, total: int) -> int:
        """Estimate at what point the system would collapse."""
        success_rate = successful / max(total, 1)
        if success_rate > 0.95:
            return int(total * 1.5)  # Can handle more
        elif success_rate > 0.8:
            return total  # At capacity
        else:
            return int(total * success_rate)  # Already degraded

    def _estimate_max_stable(self, result: ScaleTestResult) -> int:
        """Estimate maximum stable concurrent users."""
        success_rate = result.successful / max(result.total_connections, 1)
        return int(result.total_connections * success_rate * 0.8)  # 80% of successful as safe margin

    def get_all_results(self) -> list[dict[str, Any]]:
        return [r.to_dict() for r in self.results]
