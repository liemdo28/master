"""Runtime Fragility Scorer — evaluates process-level health and weakness points."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.core.event_bus import EventBus


class RuntimeFragilityScorer:
    """Analyse runtime health to produce a fragility score (0-100)."""

    def __init__(self, event_bus: EventBus | None = None) -> None:
        self._bus = event_bus or EventBus.get_instance()

    def calculate(
        self,
        cpu_pressure_events: int = 0,
        memory_leak_detected: bool = False,
        stuck_worker_count: int = 0,
        queue_saturation: float = 0.0,
        oom_kills: int = 0,
        goroutine_leak_suspected: bool = False,
        test_coverage_percent: int = 60,
        restart_count_24h: int = 0,
    ) -> dict[str, Any]:
        """
        Returns fragility score (0 = perfect, 100 = near-collapse), a list of
        weak points, and actionable recommendations.
        """
        cpu_events  = self._resolve_int(cpu_pressure_events,  "cpu_pressure_events",       0)
        leak        = memory_leak_detected or self._bus.get_recent(300) \
                          and self._bus.get_recent(300)[-1].get("data", {}).get("memory_leak_detected", False)
        stuck       = self._resolve_int(stuck_worker_count,   "stuck_worker_count",         0)
        saturation  = self._resolve_float(queue_saturation,    "queue_saturation",          0.0)
        oom         = self._resolve_int(oom_kills,             "oom_kills",                 0)
        goroutine   = goroutine_leak_suspected or self._get_latest_bool("goroutine_leak_suspected", False)
        coverage    = self._resolve_int(test_coverage_percent,"test_coverage_percent",      60)
        restarts    = self._resolve_int(restart_count_24h,    "restart_count_24h",           0)

        fragility = 0
        fragility += min(20, cpu_events * 4)
        if cpu_events > 3:
            fragility += 10
        if leak:
            fragility += 25
        if oom > 0:
            fragility += 20
        fragility += min(20, stuck * 5)
        fragility += int(saturation * 30)
        if goroutine:
            fragility += 15
        if coverage < 60:
            fragility += (60 - coverage) // 2
        fragility += min(15, restarts * 3)
        fragility = max(0, min(100, fragility))

        weak_points: list[dict[str, Any]] = []
        if cpu_events > 3:
            weak_points.append({"type": "cpu_pressure",       "severity": "high",     "detail": f"{cpu_events} CPU pressure events recorded"})
        if leak:
            weak_points.append({"type": "memory_leak",        "severity": "critical", "detail": "Memory leak detected — heap exhaustion imminent"})
        if oom > 0:
            weak_points.append({"type": "oom_kill",           "severity": "critical", "detail": f"{oom} OOM kill(s) in 24h — memory management failing"})
        if stuck > 0:
            weak_points.append({"type": "stuck_workers",      "severity": "medium",   "detail": f"{stuck} worker(s) appear stuck — work is not progressing"})
        if saturation > 0.7:
            weak_points.append({"type": "queue_saturation",   "severity": "high",     "detail": f"Queue {saturation*100:.0f}% saturated — back-pressure imminent"})
        if goroutine:
            weak_points.append({"type": "goroutine_leak",      "severity": "medium",   "detail": "Goroutine leak suspected — count trending upward"})
        if restarts > 3:
            weak_points.append({"type": "restart_loop",       "severity": "high",     "detail": f"{restarts} restarts in 24h — watchdog may be cycling"})

        recommendations: list[str] = []
        if leak or oom > 0:
            recommendations.append("Profile heap usage and fix memory leak — use pprof or memory profiler")
        if stuck > 0:
            recommendations.append("Investigate stuck workers — dump goroutine stack and check for deadlocks")
        if saturation > 0.7:
            recommendations.append("Scale out workers or add queue partitioning to reduce back-pressure")
        if goroutine:
            recommendations.append("Enable goroutine profiling; check for leaks in long-lived loops")
        if coverage < 60:
            recommendations.append(f"Increase test coverage to at least 60% (currently {coverage}%)")
        if restarts > 3:
            recommendations.append("Audit startup sequence — frequent restarts indicate a crash loop")
        if not recommendations:
            recommendations.append("Runtime health is within acceptable parameters — continue monitoring")

        return {
            "fragility":       fragility,
            "weak_points":     weak_points,
            "recommendations": recommendations,
            "timestamp":       datetime.now(timezone.utc).isoformat(),
        }

    def _resolve_int(self, override: int, key: str, default: int) -> int:
        if override != 0:
            return override
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return int(val)
        return default

    def _resolve_float(self, override: float, key: str, default: float) -> float:
        if override != 0.0:
            return override
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return float(val)
        return default

    def _get_latest_bool(self, key: str, default: bool) -> bool:
        for evt in reversed(self._bus.get_recent(300)):
            val = evt.get("data", {}).get(key)
            if val is not None:
                return bool(val)
        return default
