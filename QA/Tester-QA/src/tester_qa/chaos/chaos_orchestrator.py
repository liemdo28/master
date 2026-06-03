"""
Chaos Orchestrator
Coordinates and orchestrates all chaos engines for comprehensive system destruction testing.
"""
import asyncio
import time
import json
from typing import Any, Optional
from dataclasses import dataclass, field
from enum import Enum

from .provider_failure import (
    ProviderFailureSimulator, FailureConfig, FailureMode,
    get_provider_failure_simulator
)
from .websocket_chaos import (
    WebSocketChaosEngine, WebSocketChaosConfig, ChaosMode,
    get_websocket_chaos_engine
)
from .latency_injector import (
    LatencyInjector, LatencyConfig, LatencyPattern,
    get_latency_injector
)
from .packet_loss import (
    PacketLossSimulator, PacketLossConfig, LossPattern,
    get_packet_loss_simulator
)
from .retry_storm import (
    RetryStormEngine, RetryStormConfig, RetryPattern,
    get_retry_storm_engine
)
from .memory_pressure import (
    MemoryPressureEngine, MemoryPressureConfig, MemoryPressureMode,
    get_memory_pressure_engine
)
from .cpu_pressure import (
    CPUPressureEngine, CPUPressureConfig, CPUPressureMode,
    get_cpu_pressure_engine
)
from .disk_pressure import (
    DiskPressureEngine, DiskPressureConfig, DiskPressureMode,
    get_disk_pressure_engine
)
from .random_disconnect import (
    RandomDisconnectEngine, DisconnectConfig, DisconnectMode,
    get_random_disconnect_engine
)
from .process_killer import (
    ProcessKillerEngine, KillMode,
    get_process_killer_engine
)


class ChaosLevel(Enum):
    LOW = "low"  # Minimal chaos - occasional failures
    MEDIUM = "medium"  # Moderate chaos - regular failures
    HIGH = "high"  # Heavy chaos - frequent failures
    EXTREME = "extreme"  # Maximum chaos - everything fails
    APOCALYPSE = "apocalypse"  # Total system destruction


@dataclass
class ChaosScenario:
    name: str
    level: ChaosLevel
    targets: list[str] = field(default_factory=list)
    duration_ms: int = 60000
    engines: list[str] = field(default_factory=list)  # which engines to activate
    description: str = ""


@dataclass
class ChaosResult:
    scenario: str
    start_time: float
    end_time: float
    events_generated: int
    failures_detected: int
    systems_affected: list[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)


class ChaosOrchestrator:
    """
    Master orchestrator for all chaos engines.
    Coordinates multi-engine chaos scenarios.
    """

    def __init__(self):
        self.provider_failure = get_provider_failure_simulator()
        self.websocket_chaos = get_websocket_chaos_engine()
        self.latency_injector = get_latency_injector()
        self.packet_loss = get_packet_loss_simulator()
        self.retry_storm = get_retry_storm_engine()
        self.memory_pressure = get_memory_pressure_engine()
        self.cpu_pressure = get_cpu_pressure_engine()
        self.disk_pressure = get_disk_pressure_engine()
        self.random_disconnect = get_random_disconnect_engine()
        self.process_killer = get_process_killer_engine()

        self._scenarios: dict[str, ChaosScenario] = {}
        self._results: list[ChaosResult] = []
        self._running = False
        self._active_tasks: list = []

    def register_scenario(self, scenario: ChaosScenario):
        """Register a chaos scenario."""
        self._scenarios[scenario.name] = scenario

    def get_predefined_scenarios(self) -> dict[str, ChaosScenario]:
        """Get predefined chaos scenarios."""
        return {
            "provider_meltdown": ChaosScenario(
                name="provider_meltdown",
                level=ChaosLevel.HIGH,
                engines=["provider_failure", "retry_storm", "latency_injector"],
                duration_ms=60000,
                description="Simulate complete provider failure with retry storms"
            ),
            "websocket_apocalypse": ChaosScenario(
                name="websocket_apocalypse",
                level=ChaosLevel.EXTREME,
                engines=["websocket_chaos", "packet_loss", "random_disconnect"],
                duration_ms=120000,
                description="Total WebSocket infrastructure collapse"
            ),
            "resource_exhaustion": ChaosScenario(
                name="resource_exhaustion",
                level=ChaosLevel.HIGH,
                engines=["memory_pressure", "cpu_pressure", "disk_pressure"],
                duration_ms=60000,
                description="Exhaust all system resources simultaneously"
            ),
            "network_partition": ChaosScenario(
                name="network_partition",
                level=ChaosLevel.MEDIUM,
                engines=["random_disconnect", "packet_loss", "latency_injector"],
                duration_ms=30000,
                description="Simulate network partition with packet loss"
            ),
            "total_chaos": ChaosScenario(
                name="total_chaos",
                level=ChaosLevel.APOCALYPSE,
                engines=[
                    "provider_failure", "websocket_chaos", "latency_injector",
                    "packet_loss", "retry_storm", "memory_pressure",
                    "cpu_pressure", "disk_pressure", "random_disconnect"
                ],
                duration_ms=180000,
                description="Activate ALL chaos engines simultaneously"
            ),
        }

    async def execute_scenario(
        self,
        scenario_name: str,
        target: str = "default"
    ) -> ChaosResult:
        """Execute a chaos scenario."""
        scenario = self._scenarios.get(scenario_name)
        if not scenario:
            predefined = self.get_predefined_scenarios()
            scenario = predefined.get(scenario_name)

        if not scenario:
            return ChaosResult(
                scenario=scenario_name,
                start_time=time.time(),
                end_time=time.time(),
                events_generated=0,
                failures_detected=0,
                details={"error": f"Scenario '{scenario_name}' not found"}
            )

        self._running = True
        start_time = time.time()
        intensity = self._level_to_intensity(scenario.level)

        # Configure all engines
        tasks = []
        for engine_name in scenario.engines:
            task = self._activate_engine(engine_name, target, intensity, scenario.duration_ms)
            if task:
                tasks.append(task)

        # Run all engines concurrently
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        end_time = time.time()
        self._running = False

        # Collect results
        result = ChaosResult(
            scenario=scenario_name,
            start_time=start_time,
            end_time=end_time,
            events_generated=self._count_total_events(),
            failures_detected=self._count_failures(),
            systems_affected=scenario.engines,
            details={
                "level": scenario.level.value,
                "duration_ms": scenario.duration_ms,
                "intensity": intensity,
                "description": scenario.description,
            }
        )
        self._results.append(result)
        return result

    def _level_to_intensity(self, level: ChaosLevel) -> float:
        """Convert chaos level to intensity value."""
        mapping = {
            ChaosLevel.LOW: 0.2,
            ChaosLevel.MEDIUM: 0.5,
            ChaosLevel.HIGH: 0.7,
            ChaosLevel.EXTREME: 0.9,
            ChaosLevel.APOCALYPSE: 1.0,
        }
        return mapping.get(level, 0.5)

    async def _activate_engine(
        self,
        engine_name: str,
        target: str,
        intensity: float,
        duration_ms: int
    ):
        """Activate a specific chaos engine."""
        if engine_name == "provider_failure":
            self.provider_failure.configure_failure(target, FailureConfig(
                mode=FailureMode.TIMEOUT,
                probability=intensity,
                duration_ms=duration_ms,
            ))

        elif engine_name == "websocket_chaos":
            self.websocket_chaos.configure_chaos(target, WebSocketChaosConfig(
                mode=ChaosMode.RECONNECT_STORM,
                probability=intensity,
                intensity=intensity,
                duration_ms=duration_ms,
            ))

        elif engine_name == "latency_injector":
            self.latency_injector.configure_latency(target, LatencyConfig(
                base_ms=int(100 * intensity),
                jitter_ms=int(50 * intensity),
                pattern=LatencyPattern.SPIKE,
                spike_probability=intensity * 0.3,
            ))

        elif engine_name == "packet_loss":
            self.packet_loss.configure_loss(target, PacketLossConfig(
                loss_rate=intensity * 0.3,
                corruption_rate=intensity * 0.05,
                pattern=LossPattern.BURST,
            ))

        elif engine_name == "retry_storm":
            self.retry_storm.configure_retry(target, RetryStormConfig(
                max_retries=int(10 * intensity),
                pattern=RetryPattern.EXPONENTIAL,
                thunder_herd_probability=intensity,
            ))

        elif engine_name == "memory_pressure":
            self.memory_pressure.configure_pressure(target, MemoryPressureConfig(
                mode=MemoryPressureMode.GRADUAL_LEAK,
                intensity=intensity,
                duration_ms=duration_ms,
            ))
            await self.memory_pressure.apply_memory_pressure(target)

        elif engine_name == "cpu_pressure":
            self.cpu_pressure.configure_pressure(target, CPUPressureConfig(
                mode=CPUPressureMode.WORKER_SATURATION,
                intensity=intensity,
                burn_duration_ms=duration_ms,
            ))
            await self.cpu_pressure.apply_cpu_pressure(target)

        elif engine_name == "disk_pressure":
            self.disk_pressure.configure_pressure(target, DiskPressureConfig(
                mode=DiskPressureMode.LOG_EXPLOSION,
                intensity=intensity,
                duration_ms=duration_ms,
            ))
            await self.disk_pressure.apply_disk_pressure(target)

        elif engine_name == "random_disconnect":
            self.random_disconnect.configure_disconnect(target, DisconnectConfig(
                mode=DisconnectMode.FLAPPING,
                probability=intensity * 0.5,
            ))

    def _count_total_events(self) -> int:
        """Count total events across all engines."""
        return (
            len(self.provider_failure.failure_log) +
            len(self.websocket_chaos.chaos_log) +
            len(self.latency_injector.latency_log) +
            len(self.packet_loss.loss_log) +
            len(self.retry_storm.retry_log) +
            len(self.memory_pressure.pressure_log) +
            len(self.cpu_pressure.pressure_log) +
            len(self.disk_pressure.pressure_log) +
            len(self.random_disconnect.disconnect_log)
        )

    def _count_failures(self) -> int:
        """Count total failures detected."""
        failures = 0
        failures += len(self.provider_failure.failure_log)
        failures += len([e for e in self.retry_storm.retry_log if not e.success])
        failures += len([e for e in self.packet_loss.loss_log if e.action == "lost"])
        failures += len([e for e in self.random_disconnect.disconnect_log if not e.reconnected])
        return failures

    def stop_all_chaos(self):
        """Emergency stop - halt all chaos engines."""
        self._running = False
        self.provider_failure.clear_all()
        self.websocket_chaos.clear_all()
        self.latency_injector.clear_all()
        self.packet_loss.clear_all()
        self.retry_storm.clear_all()
        self.memory_pressure.clear_all()
        self.cpu_pressure.clear_all()
        self.disk_pressure.clear_all()
        self.random_disconnect.clear_all()

    def get_orchestrator_stats(self) -> dict:
        """Get comprehensive stats from all engines."""
        return {
            "running": self._running,
            "scenarios_executed": len(self._results),
            "total_events": self._count_total_events(),
            "total_failures": self._count_failures(),
            "engines": {
                "provider_failure": self.provider_failure.get_failure_stats(),
                "websocket_chaos": self.websocket_chaos.get_chaos_stats(),
                "latency_injector": self.latency_injector.get_latency_stats(),
                "packet_loss": self.packet_loss.get_loss_stats(),
                "retry_storm": self.retry_storm.get_retry_stats(),
                "memory_pressure": self.memory_pressure.get_pressure_stats(),
                "cpu_pressure": self.cpu_pressure.get_pressure_stats(),
                "disk_pressure": self.disk_pressure.get_pressure_stats(),
                "random_disconnect": self.random_disconnect.get_disconnect_stats(),
            },
        }

    def export_full_report(self) -> dict:
        """Export comprehensive chaos report."""
        return {
            "timestamp": time.time(),
            "scenarios_executed": [
                {
                    "scenario": r.scenario,
                    "start_time": r.start_time,
                    "end_time": r.end_time,
                    "events_generated": r.events_generated,
                    "failures_detected": r.failures_detected,
                    "systems_affected": r.systems_affected,
                    "details": r.details,
                }
                for r in self._results
            ],
            "engine_logs": {
                "provider_failure": self.provider_failure.export_failure_log(),
                "websocket_chaos": self.websocket_chaos.export_chaos_log(),
                "latency_injector": self.latency_injector.export_latency_log(),
                "packet_loss": self.packet_loss.export_loss_log(),
                "retry_storm": self.retry_storm.export_retry_log(),
                "memory_pressure": self.memory_pressure.export_pressure_log(),
                "cpu_pressure": self.cpu_pressure.export_pressure_log(),
                "disk_pressure": self.disk_pressure.export_pressure_log(),
                "random_disconnect": self.random_disconnect.export_disconnect_log(),
            },
            "stats": self.get_orchestrator_stats(),
        }


# Global singleton
_chaos_orchestrator: Optional[ChaosOrchestrator] = None


def get_chaos_orchestrator() -> ChaosOrchestrator:
    global _chaos_orchestrator
    if _chaos_orchestrator is None:
        _chaos_orchestrator = ChaosOrchestrator()
    return _chaos_orchestrator
