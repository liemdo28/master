"""
Chaos CLI - Command-line interface for chaos engineering commands.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
from pathlib import Path

from tester_qa.chaos import (
    get_chaos_orchestrator,
    get_websocket_chaos_engine,
    get_latency_injector,
    get_memory_pressure_engine,
    get_cpu_pressure_engine,
    get_disk_pressure_engine,
    ChaosMode,
    LatencyPattern,
    MemoryPressureMode,
    CPUPressureMode,
    DiskPressureMode,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="tester-qa chaos")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # chaos websocket
    p = subparsers.add_parser("websocket", help="Inject WebSocket chaos into a target.")
    p.add_argument("target", help="Target endpoint or identifier.")
    p.add_argument("mode", choices=[m.value for m in ChaosMode], help="Chaos mode.")
    p.add_argument("intensity", type=float, help="Chaos intensity (0.0-1.0).")
    p.add_argument("--duration", type=int, default=60000, help="Duration in ms (default: 60000).")

    # chaos provider
    p = subparsers.add_parser("provider", help="Simulate provider failure.")
    p.add_argument("target", help="Target provider or endpoint.")
    p.add_argument("mode", help="Failure mode (timeout|rate_limit|invalid_payload|unavailable).")
    p.add_argument("duration", type=int, help="Duration in seconds.")

    # chaos latency
    p = subparsers.add_parser("latency", help="Inject network latency.")
    p.add_argument("target", help="Target endpoint.")
    p.add_argument("base_ms", type=int, help="Base latency in milliseconds.")
    p.add_argument("jitter", type=int, help="Jitter/spike in milliseconds.")
    p.add_argument("--pattern", default="spike",
                   choices=[pt.value for pt in LatencyPattern],
                   help="Latency pattern (default: spike).")

    # chaos memory
    p = subparsers.add_parser("memory", help="Apply memory pressure.")
    p.add_argument("target", help="Target process or identifier.")
    p.add_argument("intensity", type=float, help="Pressure intensity (0.0-1.0).")
    p.add_argument("duration", type=int, help="Duration in seconds.")

    # chaos cpu
    p = subparsers.add_parser("cpu", help="Apply CPU pressure.")
    p.add_argument("target", help="Target process or identifier.")
    p.add_argument("intensity", type=float, help="Pressure intensity (0.0-1.0).")
    p.add_argument("duration", type=int, help="Duration in seconds.")

    # chaos disk
    p = subparsers.add_parser("disk", help="Apply disk pressure.")
    p.add_argument("target", help="Target path or identifier.")
    p.add_argument("intensity", type=float, help="Pressure intensity (0.0-1.0).")
    p.add_argument("duration", type=int, help="Duration in seconds.")

    # chaos execute-scenario
    p = subparsers.add_parser("execute-scenario", help="Execute a named chaos scenario.")
    p.add_argument("scenario", help="Scenario name.")
    p.add_argument("target", help="Target identifier.")
    p.add_argument("--format", choices=["json", "markdown"], default="json")

    # chaos stats
    subparsers.add_parser("stats", help="Print chaos engine statistics.")

    # chaos stop
    subparsers.add_parser("stop", help="Emergency stop - halt all chaos engines.")

    return parser


# ---------------------------------------------------------------------------
# Public CLI-facing functions
# ---------------------------------------------------------------------------

async def chaos_websocket(target: str, mode: str, intensity: float, duration_ms: int = 60000) -> dict:
    """Inject WebSocket chaos into a target."""
    engine = get_websocket_chaos_engine()
    chaos_mode = ChaosMode(mode)
    from tester_qa.chaos.websocket_chaos import WebSocketChaosConfig
    engine.configure_chaos(target, WebSocketChaosConfig(
        mode=chaos_mode,
        probability=intensity,
        intensity=intensity,
        duration_ms=duration_ms,
    ))
    await engine.inject_chaos(target)
    return {
        "engine": "websocket_chaos",
        "target": target,
        "mode": chaos_mode.value,
        "intensity": intensity,
        "duration_ms": duration_ms,
        "status": "active",
    }


async def chaos_provider(target: str, mode: str, duration: int) -> dict:
    """Simulate provider failure."""
    orchestrator = get_chaos_orchestrator()
    from tester_qa.chaos.provider_failure import FailureConfig, FailureMode
    failure_config = FailureConfig(
        mode=FailureMode(mode),
        probability=0.8,
        duration_ms=duration * 1000,
    )
    orchestrator.provider_failure.configure_failure(target, failure_config)
    await orchestrator.provider_failure.simulate_failure(target)
    return {
        "engine": "provider_failure",
        "target": target,
        "mode": mode,
        "duration_s": duration,
        "status": "active",
    }


async def chaos_latency(target: str, base_ms: int, jitter: int, pattern: str = "spike") -> dict:
    """Inject network latency."""
    engine = get_latency_injector()
    lat_pattern = LatencyPattern(pattern)
    from tester_qa.chaos.latency_injector import LatencyConfig
    engine.configure_latency(target, LatencyConfig(
        base_ms=base_ms,
        jitter_ms=jitter,
        pattern=lat_pattern,
        spike_probability=0.3,
    ))
    engine.inject_latency(target)
    return {
        "engine": "latency_injector",
        "target": target,
        "base_ms": base_ms,
        "jitter_ms": jitter,
        "pattern": lat_pattern.value,
        "status": "active",
    }


async def chaos_memory(target: str, intensity: float, duration: int) -> dict:
    """Apply memory pressure."""
    engine = get_memory_pressure_engine()
    from tester_qa.chaos.memory_pressure import MemoryPressureConfig
    engine.configure_pressure(target, MemoryPressureConfig(
        mode=MemoryPressureMode.GRADUAL_LEAK,
        intensity=intensity,
        duration_ms=duration * 1000,
    ))
    await engine.apply_memory_pressure(target)
    return {
        "engine": "memory_pressure",
        "target": target,
        "intensity": intensity,
        "duration_s": duration,
        "status": "active",
    }


async def chaos_cpu(target: str, intensity: float, duration: int) -> dict:
    """Apply CPU pressure."""
    engine = get_cpu_pressure_engine()
    from tester_qa.chaos.cpu_pressure import CPUPressureConfig
    engine.configure_pressure(target, CPUPressureConfig(
        mode=CPUPressureMode.WORKER_SATURATION,
        intensity=intensity,
        burn_duration_ms=duration * 1000,
    ))
    await engine.apply_cpu_pressure(target)
    return {
        "engine": "cpu_pressure",
        "target": target,
        "intensity": intensity,
        "duration_s": duration,
        "status": "active",
    }


async def chaos_disk(target: str, intensity: float, duration: int) -> dict:
    """Apply disk pressure."""
    engine = get_disk_pressure_engine()
    from tester_qa.chaos.disk_pressure import DiskPressureConfig
    engine.configure_pressure(target, DiskPressureConfig(
        mode=DiskPressureMode.LOG_EXPLOSION,
        intensity=intensity,
        duration_ms=duration * 1000,
    ))
    await engine.apply_disk_pressure(target)
    return {
        "engine": "disk_pressure",
        "target": target,
        "intensity": intensity,
        "duration_s": duration,
        "status": "active",
    }


async def chaos_execute_scenario(scenario: str, target: str) -> dict:
    """Execute a named chaos scenario."""
    orchestrator = get_chaos_orchestrator()
    result = await orchestrator.execute_scenario(scenario, target)
    return {
        "scenario": result.scenario,
        "events_generated": result.events_generated,
        "failures_detected": result.failures_detected,
        "systems_affected": result.systems_affected,
        "details": result.details,
    }


def chaos_stats() -> dict:
    """Return chaos engine statistics."""
    orchestrator = get_chaos_orchestrator()
    return orchestrator.get_orchestrator_stats()


def chaos_stop() -> dict:
    """Emergency stop - halt all chaos engines."""
    orchestrator = get_chaos_orchestrator()
    orchestrator.stop_all_chaos()
    return {"status": "stopped", "message": "All chaos engines halted."}


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    parser = _build_parser()
    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    try:
        if args.command == "websocket":
            result = asyncio.run(chaos_websocket(args.target, args.mode, args.intensity, args.duration))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "provider":
            result = asyncio.run(chaos_provider(args.target, args.mode, args.duration))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "latency":
            result = asyncio.run(chaos_latency(args.target, args.base_ms, args.jitter, args.pattern))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "memory":
            result = asyncio.run(chaos_memory(args.target, args.intensity, args.duration))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "cpu":
            result = asyncio.run(chaos_cpu(args.target, args.intensity, args.duration))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "disk":
            result = asyncio.run(chaos_disk(args.target, args.intensity, args.duration))
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "execute-scenario":
            result = asyncio.run(chaos_execute_scenario(args.scenario, args.target))
            output = json.dumps(result, ensure_ascii=False, indent=2)
            print(output)
            return

        if args.command == "stats":
            result = chaos_stats()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

        if args.command == "stop":
            result = chaos_stop()
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return

    except Exception as exc:
        logging.error("Chaos command '%s' failed: %s", args.command, exc)
        raise SystemExit(1)


if __name__ == "__main__":
    main()
