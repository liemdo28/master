"""
Memory Pressure Engine
Simulates memory leaks, heap expansion, and cache overflow to test system resilience.
"""
import asyncio
import random
import time
import gc
import sys
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum


class MemoryPressureMode(Enum):
    LEAK_SIMULATION = "leak_simulation"
    HEAP_EXPANSION = "heap_expansion"
    CACHE_OVERFLOW = "cache_overflow"
    MEMORY_SPIKE = "memory_spike"
    GRADUAL_LEAK = "gradual_leak"
    ALLOCATION_STORM = "allocation_storm"


@dataclass
class MemoryPressureConfig:
    mode: MemoryPressureMode
    intensity: float = 0.5  # 0.0-1.0
    allocation_size_mb: int = 10
    leak_rate_mb_per_second: float = 5.0
    target_memory_mb: int = 500
    duration_ms: int = 30000
    cache_size: int = 10000


@dataclass
class MemoryPressureEvent:
    timestamp: float
    mode: MemoryPressureMode
    memory_used_mb: float
    details: dict = field(default_factory=dict)


class MemoryPressureEngine:
    """
    Creates memory pressure to test system resilience.
    """

    def __init__(self):
        self.active_pressures: dict[str, MemoryPressureConfig] = {}
        self.pressure_log: list[MemoryPressureEvent] = []
        self._leaked_memory: list[bytearray] = []
        self._cache_data: dict[str, Any] = {}
        self._allocation_tasks: list = []
        self._running = False

    def configure_pressure(self, target: str, config: MemoryPressureConfig):
        self.active_pressures[target] = config

    def clear_pressure(self, target: str):
        self.active_pressures.pop(target, None)

    def clear_all(self):
        self.active_pressures.clear()
        self._leaked_memory.clear()
        self._cache_data.clear()
        self._stop_all()

    def _stop_all(self):
        """Stop all running pressure tasks."""
        self._running = False
        for task in self._allocation_tasks:
            if not task.done():
                task.cancel()

    def get_memory_usage(self) -> dict:
        """Get current memory usage."""
        try:
            import psutil
            process = psutil.Process()
            mem_info = process.memory_info()
            return {
                "rss_mb": mem_info.rss / (1024 * 1024),
                "vms_mb": mem_info.vms / (1024 * 1024),
                "percent": process.memory_percent(),
            }
        except ImportError:
            # Fallback without psutil
            return {
                "rss_mb": 0,
                "vms_mb": 0,
                "percent": 0,
            }

    async def apply_memory_pressure(self, target: str):
        """Apply memory pressure to target system."""
        if target not in self.active_pressures:
            return

        config = self.active_pressures[target]
        mode = config.mode
        self._running = True

        start_time = time.time()
        duration = config.duration_ms / 1000

        while self._running and (time.time() - start_time) < duration:
            mem_before = self.get_memory_usage()

            if mode == MemoryPressureMode.LEAK_SIMULATION:
                await self._leak_memory(config)
            elif mode == MemoryPressureMode.HEAP_EXPANSION:
                await self._expand_heap(config)
            elif mode == MemoryPressureMode.CACHE_OVERFLOW:
                self._overflow_cache(config)
            elif mode == MemoryPressureMode.MEMORY_SPIKE:
                await self._memory_spike(config)
            elif mode == MemoryPressureMode.GRADUAL_LEAK:
                await self._gradual_leak(config)
            elif mode == MemoryPressureMode.ALLOCATION_STORM:
                await self._allocation_storm(config)

            mem_after = self.get_memory_usage()

            self.pressure_log.append(MemoryPressureEvent(
                timestamp=time.time(),
                mode=mode,
                memory_used_mb=mem_after.get("rss_mb", 0),
                details={
                    "target": target,
                    "memory_delta_mb": mem_after.get("rss_mb", 0) - mem_before.get("rss_mb", 0),
                    "intensity": config.intensity,
                }
            ))

            await asyncio.sleep(0.5)  # Check every 500ms

    async def _leak_memory(self, config: MemoryPressureConfig):
        """Simulate memory leak by allocating and never releasing."""
        size_bytes = int(config.allocation_size_mb * 1024 * 1024 * config.intensity)
        leaked = bytearray(size_bytes)
        # Fill with random data to prevent compression
        for i in range(0, size_bytes, 4096):
            leaked[i:i + 4096] = bytes([random.randint(0, 255) for _ in range(min(4096, size_bytes - i))])
        self._leaked_memory.append(leaked)

    async def _expand_heap(self, config: MemoryPressureConfig):
        """Expand heap by allocating large objects."""
        num_objects = int(100 * config.intensity)
        objects = []
        for _ in range(num_objects):
            size = int(1024 * 1024 * config.intensity)
            objects.append(bytearray(size))
        # Keep references to prevent GC
        self._leaked_memory.extend(objects)

    def _overflow_cache(self, config: MemoryPressureConfig):
        """Overflow cache by storing excessive data."""
        cache_size = config.cache_size
        # Add more items than cache can hold
        for i in range(int(cache_size * config.intensity)):
            key = f"cache_key_{i}_{time.time()}_{random.random()}"
            self._cache_data[key] = {
                "data": [random.random() for _ in range(100)],
                "timestamp": time.time(),
                "size": sys.getsizeof([random.random() for _ in range(100)]),
            }

    async def _memory_spike(self, config: MemoryPressureConfig):
        """Create a sudden memory spike."""
        spike_size = int(config.target_memory_mb * config.intensity)
        spike_bytes = int(spike_size * 1024 * 1024)
        spike = bytearray(spike_bytes)
        self._leaked_memory.append(spike)

    async def _gradual_leak(self, config: MemoryPressureConfig):
        """Gradually leak memory over time."""
        leak_size = int(config.leak_rate_mb_per_second * config.intensity)
        if leak_size > 0:
            await self._leak_memory(MemoryPressureConfig(
                mode=MemoryPressureMode.LEAK_SIMULATION,
                allocation_size_mb=leak_size,
                intensity=1.0,
            ))

    async def _allocation_storm(self, config: MemoryPressureConfig):
        """Create an allocation storm with rapid allocations/deallocations."""
        allocations = []
        for _ in range(int(1000 * config.intensity)):
            size = random.randint(1024, 1024 * 1024)
            allocations.append(bytearray(size))
        # Don't keep all - creates GC pressure
        del allocations[:len(allocations) // 2]

    def trigger_memory_collapse(self, target: str):
        """Trigger memory collapse scenario."""
        config = self.active_pressures.get(target, MemoryPressureConfig(
            mode=MemoryPressureMode.LEAK_SIMULATION,
            intensity=1.0,
            target_memory_mb=1000,
            duration_ms=60000,
        ))
        # Immediately allocate massive amounts
        try:
            size_mb = config.target_memory_mb
            massive_block = bytearray(size_mb * 1024 * 1024)
            self._leaked_memory.append(massive_block)
            self.pressure_log.append(MemoryPressureEvent(
                timestamp=time.time(),
                mode=MemoryPressureMode.MEMORY_SPIKE,
                memory_used_mb=size_mb,
                details={"target": target, "collapse": True},
            ))
        except MemoryError:
            self.pressure_log.append(MemoryPressureEvent(
                timestamp=time.time(),
                mode=MemoryPressureMode.MEMORY_SPIKE,
                memory_used_mb=0,
                details={"target": target, "error": "MemoryError"},
            ))

    def get_pressure_stats(self) -> dict:
        """Get memory pressure statistics."""
        mem = self.get_memory_usage()
        return {
            "current_memory_mb": mem.get("rss_mb", 0),
            "leaked_blocks": len(self._leaked_memory),
            "cache_entries": len(self._cache_data),
            "active_pressures": len(self.active_pressures),
            "pressure_events": len(self.pressure_log),
        }

    def export_pressure_log(self) -> list[dict]:
        """Export pressure log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "memory_used_mb": e.memory_used_mb,
                "details": e.details,
            }
            for e in self.pressure_log
        ]


# Global singleton
_memory_pressure_engine: Optional[MemoryPressureEngine] = None


def get_memory_pressure_engine() -> MemoryPressureEngine:
    global _memory_pressure_engine
    if _memory_pressure_engine is None:
        _memory_pressure_engine = MemoryPressureEngine()
    return _memory_pressure_engine
