from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from tester_qa.stress.models import StressResult


@dataclass
class WorkerNode:
    node_id: str
    host: str
    port: int
    status: str = "idle"
    assigned_load: int = 0


@dataclass
class DistributedResult:
    total_nodes: int
    total_requests: int
    total_success: int
    total_failed: int
    duration_ms: int
    node_results: dict[str, StressResult] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_nodes": self.total_nodes,
            "total_requests": self.total_requests,
            "total_success": self.total_success,
            "total_failed": self.total_failed,
            "duration_ms": self.duration_ms,
            "node_results": {k: v.to_dict() for k, v in self.node_results.items()},
            "errors": self.errors,
        }


class DistributedStress:
    def __init__(self, workers: list[WorkerNode] | None = None) -> None:
        self._workers: list[WorkerNode] = workers or []

    @property
    def workers(self) -> list[WorkerNode]:
        return list(self._workers)

    def add_worker(self, node: WorkerNode) -> None:
        self._workers.append(node)

    def remove_worker(self, node_id: str) -> None:
        self._workers = [w for w in self._workers if w.node_id != node_id]

    def distribute_load(self, total_requests: int) -> dict[str, int]:
        if not self._workers:
            return {}
        worker_count = len(self._workers)
        base_load = total_requests // worker_count
        remainder = total_requests % worker_count
        distribution: dict[str, int] = {}
        for i, worker in enumerate(self._workers):
            load = base_load + (1 if i < remainder else 0)
            worker.assigned_load = load
            distribution[worker.node_id] = load
        return distribution

    async def coordinate_workers(
        self,
        task_fn: Callable[[WorkerNode, int], Coroutine[Any, Any, StressResult]],
        total_requests: int,
    ) -> DistributedResult:
        started = time.monotonic()
        distribution = self.distribute_load(total_requests)

        if not distribution:
            return DistributedResult(
                total_nodes=0,
                total_requests=total_requests,
                total_success=0,
                total_failed=total_requests,
                duration_ms=0,
                errors=["No workers available"],
            )

        async def _run_worker(worker: WorkerNode) -> tuple[str, StressResult | None, str]:
            worker.status = "running"
            try:
                result = await task_fn(worker, worker.assigned_load)
                worker.status = "completed"
                return worker.node_id, result, ""
            except Exception as exc:
                worker.status = "failed"
                return worker.node_id, None, str(exc)

        tasks = [_run_worker(w) for w in self._workers]
        outcomes = await asyncio.gather(*tasks)

        node_results: dict[str, StressResult] = {}
        errors: list[str] = []
        total_success = 0
        total_failed = 0

        for node_id, result, error in outcomes:
            if result is not None:
                node_results[node_id] = result
                total_success += result.success
                total_failed += result.failed
            else:
                errors.append(f"{node_id}: {error}")
                total_failed += distribution.get(node_id, 0)

        duration_ms = int((time.monotonic() - started) * 1000)
        return DistributedResult(
            total_nodes=len(self._workers),
            total_requests=total_requests,
            total_success=total_success,
            total_failed=total_failed,
            duration_ms=duration_ms,
            node_results=node_results,
            errors=errors,
        )

    def aggregate_results(self, results: list[StressResult]) -> StressResult:
        if not results:
            return StressResult(
                target="distributed",
                scenario="aggregate",
                total=0,
                success=0,
                failed=0,
                duration_ms=0,
            )

        total = sum(r.total for r in results)
        success = sum(r.success for r in results)
        failed = sum(r.failed for r in results)
        duration_ms = max(r.duration_ms for r in results)
        all_latencies: list[int] = []
        all_errors: list[str] = []
        for r in results:
            all_latencies.extend(r.latencies_ms)
            all_errors.extend(r.errors)

        return StressResult(
            target="distributed",
            scenario="aggregate",
            total=total,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=all_latencies,
            errors=all_errors[:50],
        )
