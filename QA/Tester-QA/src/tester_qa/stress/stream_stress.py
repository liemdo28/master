from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine

from tester_qa.stress.models import StressResult


@dataclass
class BackpressureStreamReport:
    triggered: bool
    bytes_paused: int
    pause_events: int
    duration_ms: int


@dataclass
class StreamThroughputResult:
    bytes_sent: int
    bytes_received: int
    throughput_mbps: float
    total_messages: int
    duration_ms: int
    errors: list[str] = field(default_factory=list)


@dataclass
class DataLossStreamReport:
    chunks_sent: int
    chunks_received: int
    chunks_lost: int
    loss_percentage: float
    duration_ms: int


class StreamStress:
    def __init__(self, chunk_size: int = 1024) -> None:
        self._chunk_size = max(1, chunk_size)

    @property
    def chunk_size(self) -> int:
        return self._chunk_size

    async def stress_stream(
        self,
        stream_fn: Callable[[], Coroutine[Any, Any, Any]],
        duration_seconds: float = 10.0,
        rate_per_second: int = 100,
    ) -> StressResult:
        started = time.monotonic()
        deadline = started + max(0.1, duration_seconds)
        success = 0
        failed = 0
        latencies: list[int] = []
        errors: list[str] = []

        interval = 1.0 / max(1, rate_per_second)

        while time.monotonic() < deadline:
            task_start = time.monotonic()
            try:
                await stream_fn()
                latencies.append(int((time.monotonic() - task_start) * 1000))
                success += 1
            except Exception as exc:
                failed += 1
                if len(errors) < 50:
                    errors.append(str(exc))

            sleep_time = interval - (time.monotonic() - task_start)
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

        total_ops = success + failed
        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="stream_stress",
            scenario="stress_stream",
            total=total_ops,
            success=success,
            failed=failed,
            duration_ms=duration_ms,
            latencies_ms=latencies,
            errors=errors,
        )

    async def test_backpressure(
        self,
        sender_fn: Callable[[int], Coroutine[Any, Any, Any]],
        receiver_fn: Callable[[int], Coroutine[Any, Any, Any]],
        total_bytes: int = 1_000_000,
    ) -> BackpressureStreamReport:
        started = time.monotonic()
        triggered = False
        bytes_paused = 0
        pause_events = 0

        batch_size = self._chunk_size
        for offset in range(0, max(0, total_bytes), batch_size):
            try:
                send_result = sender_fn(batch_size)
                if asyncio.iscoroutine(send_result):
                    send_result = await send_result
                sent = int(send_result) if send_result is not None else batch_size

                recv_result = receiver_fn(sent)
                if asyncio.iscoroutine(recv_result):
                    recv_result = await recv_result
                received = int(recv_result) if recv_result is not None else sent

                if received < sent:
                    if not triggered:
                        triggered = True
                    bytes_paused += sent - received
                    pause_events += 1
            except Exception:
                pause_events += 1
                bytes_paused += batch_size

        duration_ms = int((time.monotonic() - started) * 1000)
        return BackpressureStreamReport(
            triggered=triggered,
            bytes_paused=bytes_paused,
            pause_events=pause_events,
            duration_ms=duration_ms,
        )

    async def measure_throughput(
        self,
        sender_fn: Callable[[int], Coroutine[Any, Any, int]],
        receiver_fn: Callable[[int], Coroutine[Any, Any, int]],
        duration_seconds: float = 5.0,
    ) -> StreamThroughputResult:
        started = time.monotonic()
        deadline = started + max(0.1, duration_seconds)
        total_bytes_sent = 0
        total_bytes_received = 0
        total_messages = 0
        errors: list[str] = []

        while time.monotonic() < deadline:
            try:
                send_result = sender_fn(self._chunk_size)
                sent = self._chunk_size
                if asyncio.iscoroutine(send_result):
                    sent = await send_result
                else:
                    sent = int(send_result) if send_result is not None else self._chunk_size

                recv_result = receiver_fn(sent)
                received = sent
                if asyncio.iscoroutine(recv_result):
                    received = await recv_result
                else:
                    received = int(recv_result) if recv_result is not None else sent

                total_bytes_sent += sent
                total_bytes_received += received
                total_messages += 1
            except Exception as exc:
                errors.append(str(exc))
                total_messages += 1

        elapsed_sec = max(0.001, (time.monotonic() - started) / 1000.0)
        throughput_mbps = (total_bytes_sent / 1_000_000.0) / elapsed_sec
        duration_ms = int((time.monotonic() - started) * 1000)

        return StreamThroughputResult(
            bytes_sent=total_bytes_sent,
            bytes_received=total_bytes_received,
            throughput_mbps=round(throughput_mbps, 3),
            total_messages=total_messages,
            duration_ms=duration_ms,
            errors=errors[:50],
        )

    async def detect_data_loss(
        self,
        sender_fn: Callable[[], Coroutine[Any, Any, int]],
        receiver_fn: Callable[[], Coroutine[Any, Any, int]],
        total_chunks: int = 1000,
    ) -> DataLossStreamReport:
        started = time.monotonic()
        chunks_sent = 0
        chunks_received = 0

        for _ in range(max(0, total_chunks)):
            try:
                send_result = sender_fn()
                sent = 1
                if asyncio.iscoroutine(send_result):
                    sent = await send_result
                else:
                    sent = int(send_result) if send_result is not None else 1
                chunks_sent += sent
            except Exception:
                chunks_sent += 1

            try:
                recv_result = receiver_fn()
                received = 1
                if asyncio.iscoroutine(recv_result):
                    received = await recv_result
                else:
                    received = int(recv_result) if recv_result is not None else 1
                chunks_received += received
            except Exception:
                pass

            await asyncio.sleep(0.001)

        chunks_lost = max(0, chunks_sent - chunks_received)
        loss_pct = (chunks_lost / max(1, chunks_sent)) * 100.0
        duration_ms = int((time.monotonic() - started) * 1000)

        return DataLossStreamReport(
            chunks_sent=chunks_sent,
            chunks_received=chunks_received,
            chunks_lost=chunks_lost,
            loss_percentage=round(loss_pct, 2),
            duration_ms=duration_ms,
        )
