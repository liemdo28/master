"""
CPU Pressure Engine
Simulates worker saturation, event loop blocking, and thread overload.
"""
import asyncio
import random
import time
import threading
import multiprocessing
from typing import Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum


class CPUPressureMode(Enum):
    WORKER_SATURATION = "worker_saturation"
    EVENTLOOP_BLOCKING = "eventloop_blocking"
    THREAD_OVERLOAD = "thread_overload"
    CPU_SPIKE = "cpu_spike"
    CONTINOUS_BURN = "continuous_burn"
    CONTEXT_SWITCH_STORM = "context_switch_storm"


@dataclass
class CPUPressureConfig:
    mode: CPUPressureMode
    intensity: float = 0.5  # 0.0-1.0
    num_workers: int = 4
    burn_duration_ms: int = 10000
    spike_duration_ms: int = 5000
    thread_count: int = 10


@dataclass
class CPUPressureEvent:
    timestamp: float
    mode: CPUPressureMode
    cpu_percent: float
    details: dict = field(default_factory=dict)


class CPUPressureEngine:
    """
    Creates CPU pressure to test system resilience.
    """

    def __init__(self):
        self.active_pressures: dict[str, CPUPressureConfig] = {}
        self.pressure_log: list[CPUPressureEvent] = []
        self._running = False
        self._worker_tasks: list = []
        self._burn_threads: list = []
        self._cpu_samples: list = []

    def configure_pressure(self, target: str, config: CPUPressureConfig):
        self.active_pressures[target] = config

    def clear_pressure(self, target: str):
        self.active_pressures.pop(target, None)

    def clear_all(self):
        self.active_pressures.clear()
        self._stop_all()

    def _stop_all(self):
        """Stop all running pressure tasks."""
        self._running = False
        for task in self._worker_tasks:
            if hasattr(task, 'cancel'):
                task.cancel()
        for thread in self._burn_threads:
            if thread.is_alive():
                # Can't stop threads easily, but we can signal them
                pass
        self._worker_tasks.clear()
        self._burn_threads.clear()

    def get_cpu_usage(self) -> float:
        """Get current CPU usage percentage."""
        try:
            import psutil
            return psutil.cpu_percent(interval=0.1)
        except ImportError:
            return 0.0

    async def apply_cpu_pressure(self, target: str):
        """Apply CPU pressure to target system."""
        if target not in self.active_pressures:
            return

        config = self.active_pressures[target]
        mode = config.mode
        self._running = True

        start_time = time.time()
        duration = config.burn_duration_ms / 1000

        while self._running and (time.time() - start_time) < duration:
            cpu_before = self.get_cpu_usage()

            if mode == CPUPressureMode.WORKER_SATURATION:
                await self._saturate_workers(config)
            elif mode == CPUPressureMode.EVENTLOOP_BLOCKING:
                await self._block_eventloop(config)
            elif mode == CPUPressureMode.THREAD_OVERLOAD:
                await self._overload_threads(config)
            elif mode == CPUPressureMode.CPU_SPIKE:
                await self._cpu_spike(config)
            elif mode == CPUPressureMode.CONTINOUS_BURN:
                await self._continuous_burn(config)
            elif mode == CPUPressureMode.CONTEXT_SWITCH_STORM:
                await self._context_switch_storm(config)

            cpu_after = self.get_cpu_usage()

            self.pressure_log.append(CPUPressureEvent(
                timestamp=time.time(),
                mode=mode,
                cpu_percent=cpu_after,
                details={
                    "target": target,
                    "cpu_delta": cpu_after - cpu_before,
                    "intensity": config.intensity,
                }
            ))

            await asyncio.sleep(0.1)  # Sample every 100ms

    async def _saturate_workers(self, config: CPUPressureConfig):
        """Saturate worker pool with CPU-bound tasks."""
        num_workers = int(config.num_workers * config.intensity)

        async def cpu_bound_task():
            """A task that burns CPU."""
            end_time = time.time() + 0.1
            result = 0
            while time.time() < end_time:
                result += random.randint(1, 1000)
            return result

        tasks = [cpu_bound_task() for _ in range(num_workers)]
        await asyncio.gather(*tasks)

    async def _block_eventloop(self, config: CPUPressureConfig):
        """Block the event loop with synchronous CPU work."""
        duration = config.burn_duration_ms / 1000
        end_time = time.time() + duration
        result = 0

        while time.time() < end_time:
            # CPU-intensive synchronous work
            for _ in range(10000):
                result += random.randint(1, 1000)
                result = result % 1000000

    async def _overload_threads(self, config: CPUPressureConfig):
        """Overload system with threads doing CPU work."""
        num_threads = int(config.thread_count * config.intensity)
        stop_event = threading.Event()

        def thread_burn():
            """Thread that burns CPU."""
            result = 0
            while not stop_event.is_set():
                for _ in range(1000):
                    result += random.randint(1, 1000)

        # Start threads
        threads = []
        for _ in range(num_threads):
            t = threading.Thread(target=thread_burn, daemon=True)
            t.start()
            threads.append(t)

        # Let them run briefly
        await asyncio.sleep(0.1)

        # Stop threads
        stop_event.set()
        self._burn_threads.extend(threads)

    async def _cpu_spike(self, config: CPUPressureConfig):
        """Create a sudden CPU spike."""
        spike_duration = config.spike_duration_ms / 1000
        end_time = time.time() + spike_duration
        result = 0

        while time.time() < end_time:
            # Maximum CPU burn
            for _ in range(50000):
                result += random.randint(1, 10000)

    async def _continuous_burn(self, config: CPUPressureConfig):
        """Continuous CPU burn."""
        duration = config.burn_duration_ms / 1000
        end_time = time.time() + duration
        result = 0

        while time.time() < end_time:
            for _ in range(10000):
                result += random.randint(1, 1000)
            # Brief yield
            await asyncio.sleep(0.001)

    async def _context_switch_storm(self, config: CPUPressureConfig):
        """Create context switch storm by rapidly spawning/canceling tasks."""
        num_tasks = int(100 * config.intensity)

        async def quick_task():
            await asyncio.sleep(0.001)
            return random.randint(1, 1000)

        for _ in range(num_tasks):
            task = asyncio.create_task(quick_task())
            self._worker_tasks.append(task)
            task.cancel()

    def trigger_cpu_collapse(self, target: str):
        """Trigger CPU collapse scenario."""
        config = self.active_pressures.get(target, CPUPressureConfig(
            mode=CPUPressureMode.CONTINOUS_BURN,
            intensity=1.0,
            burn_duration_ms=60000,
        ))

        # Spawn maximum CPU burn
        def max_burn():
            result = 0
            end = time.time() + 60
            while time.time() < end:
                for _ in range(100000):
                    result += random.randint(1, 10000)

        threads = []
        for _ in range(multiprocessing.cpu_count() * 2):
            t = threading.Thread(target=max_burn, daemon=True)
            t.start()
            threads.append(t)

        self._burn_threads.extend(threads)
        self.pressure_log.append(CPUPressureEvent(
            timestamp=time.time(),
            mode=CPUPressureMode.CONTINOUS_BURN,
            cpu_percent=100.0,
            details={"target": target, "collapse": True, "threads": len(threads)},
        ))

    def get_pressure_stats(self) -> dict:
        """Get CPU pressure statistics."""
        current_cpu = self.get_cpu_usage()
        return {
            "current_cpu_percent": current_cpu,
            "active_pressures": len(self.active_pressures),
            "pressure_events": len(self.pressure_log),
            "active_threads": len(self._burn_threads),
            "active_tasks": len(self._worker_tasks),
            "avg_cpu_from_samples": sum(self._cpu_samples) / max(len(self._cpu_samples), 1),
        }

    def export_pressure_log(self) -> list[dict]:
        """Export pressure log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "cpu_percent": e.cpu_percent,
                "details": e.details,
            }
            for e in self.pressure_log
        ]


# Global singleton
_cpu_pressure_engine: Optional[CPUPressureEngine] = None


def get_cpu_pressure_engine() -> CPUPressureEngine:
    global _cpu_pressure_engine
    if _cpu_pressure_engine is None:
        _cpu_pressure_engine = CPUPressureEngine()
    return _cpu_pressure_engine
