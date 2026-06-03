from __future__ import annotations

import asyncio
import math
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Coroutine

from tester_qa.stress.models import StressResult


class ProfileType(Enum):
    RAMP_UP = "ramp_up"
    SPIKE = "spike"
    SUSTAINED = "sustained"
    WAVE = "wave"
    STEP = "step"


@dataclass
class LoadProfile:
    profile_type: ProfileType
    duration_seconds: float
    max_concurrency: int
    min_concurrency: int = 1
    ramp_time_seconds: float = 5.0
    step_count: int = 5
    spike_multiplier: float = 3.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "profile_type": self.profile_type.value,
            "duration_seconds": self.duration_seconds,
            "max_concurrency": self.max_concurrency,
            "min_concurrency": self.min_concurrency,
            "ramp_time_seconds": self.ramp_time_seconds,
            "step_count": self.step_count,
            "spike_multiplier": self.spike_multiplier,
        }


# Predefined profiles
RAMP_UP = LoadProfile(
    profile_type=ProfileType.RAMP_UP,
    duration_seconds=30.0,
    max_concurrency=100,
    min_concurrency=1,
    ramp_time_seconds=30.0,
)

SPIKE = LoadProfile(
    profile_type=ProfileType.SPIKE,
    duration_seconds=20.0,
    max_concurrency=200,
    min_concurrency=10,
    spike_multiplier=5.0,
)

SUSTAINED = LoadProfile(
    profile_type=ProfileType.SUSTAINED,
    duration_seconds=60.0,
    max_concurrency=50,
    min_concurrency=50,
)

WAVE = LoadProfile(
    profile_type=ProfileType.WAVE,
    duration_seconds=60.0,
    max_concurrency=100,
    min_concurrency=10,
)

STEP = LoadProfile(
    profile_type=ProfileType.STEP,
    duration_seconds=50.0,
    max_concurrency=100,
    min_concurrency=10,
    step_count=5,
)


@dataclass
class LoadCurvePoint:
    time_offset_seconds: float
    concurrency: int


@dataclass
class ProfileExecutionResult:
    profile: LoadProfile
    stress_results: list[StressResult] = field(default_factory=list)
    total_duration_ms: int = 0
    total_requests: int = 0
    total_success: int = 0
    total_failed: int = 0


class LoadProfileEngine:
    def generate_load_curve(self, profile: LoadProfile, resolution: float = 1.0) -> list[LoadCurvePoint]:
        points: list[LoadCurvePoint] = []
        t = 0.0
        while t <= profile.duration_seconds:
            concurrency = self._calculate_concurrency(profile, t)
            points.append(LoadCurvePoint(time_offset_seconds=round(t, 2), concurrency=concurrency))
            t += resolution
        return points

    def _calculate_concurrency(self, profile: LoadProfile, elapsed: float) -> int:
        if profile.profile_type == ProfileType.RAMP_UP:
            progress = min(1.0, elapsed / max(0.01, profile.ramp_time_seconds))
            concurrency = profile.min_concurrency + int(
                (profile.max_concurrency - profile.min_concurrency) * progress
            )
        elif profile.profile_type == ProfileType.SPIKE:
            mid = profile.duration_seconds / 2.0
            spike_window = profile.duration_seconds * 0.1
            if abs(elapsed - mid) < spike_window:
                concurrency = int(profile.max_concurrency * profile.spike_multiplier)
            else:
                concurrency = profile.min_concurrency
        elif profile.profile_type == ProfileType.SUSTAINED:
            concurrency = profile.max_concurrency
        elif profile.profile_type == ProfileType.WAVE:
            period = profile.duration_seconds
            amplitude = (profile.max_concurrency - profile.min_concurrency) / 2.0
            center = (profile.max_concurrency + profile.min_concurrency) / 2.0
            concurrency = int(center + amplitude * math.sin(2 * math.pi * elapsed / period))
        elif profile.profile_type == ProfileType.STEP:
            step_duration = profile.duration_seconds / max(1, profile.step_count)
            current_step = min(profile.step_count - 1, int(elapsed / step_duration))
            step_size = (profile.max_concurrency - profile.min_concurrency) / max(1, profile.step_count - 1)
            concurrency = profile.min_concurrency + int(current_step * step_size)
        else:
            concurrency = profile.min_concurrency
        return max(1, concurrency)

    async def execute_profile(
        self,
        profile: LoadProfile,
        task_fn: Callable[[], Coroutine[Any, Any, Any]],
        interval_seconds: float = 1.0,
    ) -> ProfileExecutionResult:
        started = time.monotonic()
        curve = self.generate_load_curve(profile, resolution=interval_seconds)
        result = ProfileExecutionResult(profile=profile)

        for point in curve:
            wait_until = started + point.time_offset_seconds
            now = time.monotonic()
            if now < wait_until:
                await asyncio.sleep(wait_until - now)

            batch_start = time.monotonic()
            tasks = [task_fn() for _ in range(point.concurrency)]
            outcomes = await asyncio.gather(*tasks, return_exceptions=True)
            batch_duration = int((time.monotonic() - batch_start) * 1000)

            success = sum(1 for o in outcomes if not isinstance(o, Exception))
            failed = len(outcomes) - success
            errors = [str(o) for o in outcomes if isinstance(o, Exception)]

            stress_result = StressResult(
                target="load_profile",
                scenario=profile.profile_type.value,
                total=point.concurrency,
                success=success,
                failed=failed,
                duration_ms=batch_duration,
                latencies_ms=[],
                errors=errors[:20],
            )
            result.stress_results.append(stress_result)
            result.total_requests += point.concurrency
            result.total_success += success
            result.total_failed += failed

        result.total_duration_ms = int((time.monotonic() - started) * 1000)
        return result
