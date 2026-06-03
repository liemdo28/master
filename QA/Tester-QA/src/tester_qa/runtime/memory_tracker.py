from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class MemorySnapshot:
    timestamp: float
    rss_bytes: int
    vms_bytes: int
    object_count: int
    top_allocators: list[dict[str, object]] = field(default_factory=list)


@dataclass
class LeakReport:
    is_leaking: bool
    growth_rate_bytes_per_sec: float
    suspect_objects: list[str] = field(default_factory=list)
    confidence: float = 0.0


class MemoryTracker:
    """Tracks memory usage over time and detects potential memory leaks."""

    def __init__(self, sample_interval_sec: float = 1.0, leak_threshold_bytes: int = 1024 * 1024) -> None:
        self._sample_interval_sec = sample_interval_sec
        self._leak_threshold_bytes = leak_threshold_bytes
        self._snapshots: list[MemorySnapshot] = []
        self._is_tracking = False
        self._start_time: Optional[float] = None

    async def start_tracking(self) -> None:
        """Start tracking memory usage at regular intervals."""
        import asyncio

        self._is_tracking = True
        self._start_time = time.monotonic()

        while self._is_tracking:
            self._snapshots.append(self.snapshot())
            await asyncio.sleep(self._sample_interval_sec)

    def stop_tracking(self) -> None:
        """Stop the memory tracking loop."""
        self._is_tracking = False

    def snapshot(self) -> MemorySnapshot:
        """Take a point-in-time memory snapshot."""
        import gc
        import sys

        gc_objects = gc.get_objects()
        object_count = len(gc_objects)

        type_counts: dict[str, int] = {}
        for obj in gc_objects[:10000]:
            type_name = type(obj).__name__
            type_counts[type_name] = type_counts.get(type_name, 0) + 1

        top_allocators = [
            {"type": k, "count": v}
            for k, v in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        ]

        rss_bytes = 0
        vms_bytes = 0
        try:
            import resource
            usage = resource.getrusage(resource.RUSAGE_SELF)
            rss_bytes = usage.ru_maxrss
        except (ImportError, AttributeError):
            rss_bytes = sys.getsizeof(gc_objects)

        return MemorySnapshot(
            timestamp=time.monotonic(),
            rss_bytes=rss_bytes,
            vms_bytes=vms_bytes,
            object_count=object_count,
            top_allocators=top_allocators,
        )

    def detect_leaks(self) -> LeakReport:
        """Analyze snapshots to detect potential memory leaks."""
        if len(self._snapshots) < 2:
            return LeakReport(is_leaking=False, growth_rate_bytes_per_sec=0.0)

        growth_rate = self.get_growth_rate()
        is_leaking = abs(growth_rate) > self._leak_threshold_bytes

        suspect_objects: list[str] = []
        if is_leaking and len(self._snapshots) >= 2:
            first = self._snapshots[0]
            last = self._snapshots[-1]
            first_types = {item["type"]: item["count"] for item in first.top_allocators}
            for item in last.top_allocators:
                type_name = str(item["type"])
                current_count = int(item.get("count", 0))
                original_count = int(first_types.get(type_name, 0))
                if current_count > original_count * 1.5:
                    suspect_objects.append(type_name)

        confidence = min(1.0, len(self._snapshots) / 100.0) if is_leaking else 0.0

        return LeakReport(
            is_leaking=is_leaking,
            growth_rate_bytes_per_sec=growth_rate,
            suspect_objects=suspect_objects,
            confidence=confidence,
        )

    def get_growth_rate(self) -> float:
        """Calculate memory growth rate in bytes per second."""
        if len(self._snapshots) < 2:
            return 0.0

        first = self._snapshots[0]
        last = self._snapshots[-1]
        time_delta = last.timestamp - first.timestamp

        if time_delta <= 0:
            return 0.0

        memory_delta = last.rss_bytes - first.rss_bytes
        return memory_delta / time_delta
