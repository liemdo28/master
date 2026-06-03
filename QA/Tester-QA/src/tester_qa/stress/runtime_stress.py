from __future__ import annotations

from tester_qa.models import RuntimeSnapshot
from tester_qa.stress.models import StressResult


class RuntimeStressModel:
    def simulate_queue_overflow(self, target: str, queue_depth: int = 1000) -> StressResult:
        failed = max(0, queue_depth - 100)
        success = max(0, queue_depth - failed)
        return StressResult(target, "queue_overflow_simulation", queue_depth, success, failed, 0, [], ["queue_overflow"] if failed else [])

    def simulate_memory_pressure(self, target: str, memory_percent: float = 95.0) -> RuntimeSnapshot:
        return RuntimeSnapshot(cpu_percent=10, memory_percent=memory_percent, disk_percent=10, process_count=1)
