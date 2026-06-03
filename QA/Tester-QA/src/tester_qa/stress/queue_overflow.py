from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from typing import Any

from tester_qa.stress.models import StressResult


@dataclass
class BackpressureReport:
    queue_depth: int
    backpressure_triggered: bool
    rejection_count: int
    duration_ms: int


@dataclass
class QueueLimitResult:
    max_capacity: int
    messages_accepted: int
    messages_rejected: int
    backpressure_at: int


@dataclass
class MessageLossReport:
    messages_sent: int
    messages_received: int
    messages_lost: int
    loss_percentage: float
    duration_ms: int


class QueueOverflow:
    def __init__(self, queue_capacity: int = 1000) -> None:
        self._queue_capacity = max(1, queue_capacity)

    @property
    def queue_capacity(self) -> int:
        return self._queue_capacity

    async def flood_queue(
        self,
        message_fn: Any,
        total_messages: int = 10000,
    ) -> StressResult:
        started = time.monotonic()
        accepted = 0
        rejected = 0
        errors: list[str] = []

        for i in range(max(0, total_messages)):
            try:
                if hasattr(message_fn, "__call__"):
                    result = message_fn()
                    if asyncio.iscoroutine(result):
                        result = await result
                    accepted += 1
                else:
                    accepted += 1
            except Exception as exc:
                rejected += 1
                if len(errors) < 50:
                    errors.append(str(exc))

        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(
            target="queue_overflow",
            scenario="flood_queue",
            total=total_messages,
            success=accepted,
            failed=rejected,
            duration_ms=duration_ms,
            latencies_ms=[],
            errors=errors,
        )

    async def measure_backpressure(
        self,
        queue_depth_fn: Any,
        threshold: int = 500,
        duration_seconds: float = 10.0,
    ) -> BackpressureReport:
        started = time.monotonic()
        backpressure_triggered = False
        rejection_count = 0
        deadline = started + max(0.1, duration_seconds)

        while time.monotonic() < deadline:
            try:
                depth = 0
                if hasattr(queue_depth_fn, "__call__"):
                    result = queue_depth_fn()
                    if asyncio.iscoroutine(result):
                        result = await result
                    depth = int(result) if result is not None else 0

                if depth >= threshold:
                    backpressure_triggered = True
                    rejection_count += max(0, depth - threshold)
            except Exception:
                pass

            await asyncio.sleep(0.05)

        duration_ms = int((time.monotonic() - started) * 1000)
        return BackpressureReport(
            queue_depth=threshold,
            backpressure_triggered=backpressure_triggered,
            rejection_count=rejection_count,
            duration_ms=duration_ms,
        )

    async def test_queue_limits(
        self,
        message_fn: Any,
        start_size: int = 100,
        increment: int = 100,
        max_size: int = 10000,
    ) -> QueueLimitResult:
        current = start_size
        accepted = 0
        rejected = 0
        backpressure_at = max_size

        while current <= max_size:
            batch_start = time.monotonic()
            for _ in range(max(0, increment)):
                try:
                    if hasattr(message_fn, "__call__"):
                        result = message_fn()
                        if asyncio.iscoroutine(result):
                            result = await result
                        accepted += 1
                    else:
                        accepted += 1
                except Exception:
                    rejected += 1
                    if backpressure_at == max_size:
                        backpressure_at = current
            await asyncio.sleep(0.01)
            current += increment

        return QueueLimitResult(
            max_capacity=max_size,
            messages_accepted=accepted,
            messages_rejected=rejected,
            backpressure_at=backpressure_at,
        )

    async def detect_message_loss(
        self,
        sender_fn: Any,
        receiver_fn: Any,
        total_messages: int = 5000,
        batch_size: int = 100,
    ) -> MessageLossReport:
        started = time.monotonic()
        messages_sent = 0
        messages_received = 0
        batches = max(1, total_messages // batch_size)

        for _ in range(batches):
            try:
                if hasattr(sender_fn, "__call__"):
                    result = sender_fn()
                    if asyncio.iscoroutine(result):
                        await result
                messages_sent += batch_size
            except Exception:
                pass

            try:
                if hasattr(receiver_fn, "__call__"):
                    result = receiver_fn()
                    if asyncio.iscoroutine(result):
                        result = await result
                    received = int(result) if result is not None else batch_size
                    messages_received += received
            except Exception:
                pass

            await asyncio.sleep(0.005)

        messages_lost = max(0, messages_sent - messages_received)
        loss_pct = (messages_lost / max(1, messages_sent)) * 100.0
        duration_ms = int((time.monotonic() - started) * 1000)

        return MessageLossReport(
            messages_sent=messages_sent,
            messages_received=messages_received,
            messages_lost=messages_lost,
            loss_percentage=round(loss_pct, 2),
            duration_ms=duration_ms,
        )
