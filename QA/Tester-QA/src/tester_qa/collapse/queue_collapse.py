"""
Queue Collapse Simulation
Simulates message queue overflow, consumer blocking, message corruption, and dead letter explosions.
"""
from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class QueueCollapseMode(Enum):
    OVERFLOW = "overflow"
    CONSUMER_BLOCK = "consumer_block"
    MESSAGE_CORRUPTION = "message_corruption"
    DEAD_LETTER_EXPLOSION = "dead_letter_explosion"
    PARTITION = "partition"
    REORDER = "reorder"


@dataclass
class QueueStatus:
    queue_id: str
    depth: int = 0
    max_depth: int = 10000
    consumer_count: int = 0
    dead_letter_count: int = 0
    overflow: bool = False
    blocked_consumer_count: int = 0


@dataclass
class QueueCollapseEvent:
    timestamp: float
    queue_id: str
    mode: QueueCollapseMode
    messages_affected: int
    duration_ms: int
    details: dict = field(default_factory=dict)


class QueueCollapse:
    """
    Simulates message queue infrastructure collapse.
    Tests system resilience against queue overflow, dead letter storms, and message chaos.
    """

    def __init__(self) -> None:
        self._queues: dict[str, QueueStatus] = {}
        self._collapse_events: list[QueueCollapseEvent] = []
        self._message_corruption_count: int = 0
        self._dead_letter_explosions: int = 0
        self._active_collapse: bool = False
        self._message_buffer: list[dict[str, Any]] = []

    def register_queue(self, queue_id: str, max_depth: int = 10000) -> None:
        """Register a message queue for tracking."""
        self._queues[queue_id] = QueueStatus(
            queue_id=queue_id,
            depth=0,
            max_depth=max_depth,
            consumer_count=0,
            dead_letter_count=0,
            overflow=False,
            blocked_consumer_count=0,
        )

    def get_queue_status(self, queue_id: str) -> Optional[QueueStatus]:
        """Get current status of a queue."""
        return self._queues.get(queue_id)

    def get_all_queue_status(self) -> dict[str, dict[str, Any]]:
        """Get status of all tracked queues."""
        return {
            qid: {
                "depth": status.depth,
                "max_depth": status.max_depth,
                "consumer_count": status.consumer_count,
                "dead_letter_count": status.dead_letter_count,
                "overflow": status.overflow,
                "blocked_consumer_count": status.blocked_consumer_count,
                "utilization": status.depth / status.max_depth if status.max_depth > 0 else 0,
            }
            for qid, status in self._queues.items()
        }

    async def overflow_queue(
        self,
        queue_id: str,
        target_fill_rate: float = 1.5,
        duration_ms: int = 20000,
    ) -> dict[str, Any]:
        """
        Overflow a queue by flooding it with messages beyond capacity.
        
        Args:
            queue_id: Target queue to overflow
            target_fill_rate: How much to overflow (1.5 = 150% of capacity)
            duration_ms: How long to flood the queue
            
        Returns:
            Queue overflow results
        """
        status = self._queues.get(queue_id)
        if not status:
            status = QueueStatus(queue_id=queue_id)
            self._queues[queue_id] = status

        self._active_collapse = True
        start_time = time.time()
        messages_injected = 0
        overflow_level = int(status.max_depth * target_fill_rate)

        async def flood_loop() -> None:
            nonlocal messages_injected
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                status.depth += 1
                messages_injected += 1
                self._message_buffer.append({
                    "queue_id": queue_id,
                    "timestamp": time.time(),
                    "size": random.randint(100, 10000),
                })
                if status.depth >= status.max_depth:
                    status.overflow = True
                await asyncio.sleep(0.0001)

        await flood_loop()

        event = QueueCollapseEvent(
            timestamp=start_time,
            queue_id=queue_id,
            mode=QueueCollapseMode.OVERFLOW,
            messages_affected=messages_injected,
            duration_ms=duration_ms,
            details={
                "target_fill_rate": target_fill_rate,
                "overflow_level": overflow_level,
                "final_depth": status.depth,
            },
        )
        self._collapse_events.append(event)

        return {
            "queue_id": queue_id,
            "messages_injected": messages_injected,
            "final_depth": status.depth,
            "max_depth": status.max_depth,
            "overflow": status.overflow,
            "duration_ms": duration_ms,
        }

    async def block_consumer(
        self,
        queue_id: str,
        block_duration_ms: int = 15000,
        consumer_percentage: float = 1.0,
    ) -> dict[str, Any]:
        """
        Block queue consumers from processing messages.
        
        Args:
            queue_id: Target queue
            block_duration_ms: How long to block consumers
            consumer_percentage: Percentage of consumers to block (0.0-1.0)
            
        Returns:
            Consumer blocking results
        """
        status = self._queues.get(queue_id)
        if not status:
            status = QueueStatus(queue_id=queue_id)
            self._queues[queue_id] = status

        start_time = time.time()
        blocked_count = int(status.consumer_count * consumer_percentage) if status.consumer_count > 0 else 5
        status.blocked_consumer_count = blocked_count

        async def block_loop() -> None:
            await asyncio.sleep(block_duration_ms / 1000)

        await block_loop()

        event = QueueCollapseEvent(
            timestamp=start_time,
            queue_id=queue_id,
            mode=QueueCollapseMode.CONSUMER_BLOCK,
            messages_affected=blocked_count,
            duration_ms=block_duration_ms,
            details={
                "consumer_percentage": consumer_percentage,
                "blocked_count": blocked_count,
            },
        )
        self._collapse_events.append(event)

        return {
            "queue_id": queue_id,
            "blocked_count": blocked_count,
            "block_duration_ms": block_duration_ms,
            "messages_backed_up": status.depth,
        }

    async def corrupt_messages(
        self,
        queue_id: str,
        corruption_rate: float = 0.5,
        duration_ms: int = 20000,
    ) -> dict[str, Any]:
        """
        Corrupt messages in the queue.
        
        Args:
            queue_id: Target queue
            corruption_rate: Percentage of messages to corrupt (0.0-1.0)
            duration_ms: How long to corrupt messages
            
        Returns:
            Message corruption results
        """
        status = self._queues.get(queue_id)
        if not status:
            status = QueueStatus(queue_id=queue_id)
            self._queues[queue_id] = status

        start_time = time.time()
        messages_processed = 0
        messages_corrupted = 0

        async def corruption_loop() -> None:
            nonlocal messages_processed, messages_corrupted
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                messages_processed += 1
                if random.random() < corruption_rate:
                    messages_corrupted += 1
                    self._message_corruption_count += 1
                await asyncio.sleep(0.001)

        await corruption_loop()

        event = QueueCollapseEvent(
            timestamp=start_time,
            queue_id=queue_id,
            mode=QueueCollapseMode.MESSAGE_CORRUPTION,
            messages_affected=messages_corrupted,
            duration_ms=duration_ms,
            details={
                "corruption_rate": corruption_rate,
                "messages_processed": messages_processed,
                "messages_corrupted": messages_corrupted,
            },
        )
        self._collapse_events.append(event)

        return {
            "queue_id": queue_id,
            "corruption_rate": corruption_rate,
            "messages_processed": messages_processed,
            "messages_corrupted": messages_corrupted,
            "duration_ms": duration_ms,
        }

    async def dead_letter_explosion(
        self,
        queue_id: str,
        explosion_size: int = 1000,
        duration_ms: int = 25000,
    ) -> dict[str, Any]:
        """
        Trigger an explosion of dead letter messages.
        
        Args:
            queue_id: Target queue
            explosion_size: Number of dead letters to generate
            duration_ms: How long the explosion lasts
            
        Returns:
            Dead letter explosion results
        """
        status = self._queues.get(queue_id)
        if not status:
            status = QueueStatus(queue_id=queue_id)
            self._queues[queue_id] = status

        start_time = time.time()
        dead_letters_created = 0

        async def explosion_loop() -> None:
            nonlocal dead_letters_created
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time and dead_letters_created < explosion_size:
                status.dead_letter_count += 1
                dead_letters_created += 1
                self._dead_letter_explosions += 1
                await asyncio.sleep(0.001)

        await explosion_loop()

        event = QueueCollapseEvent(
            timestamp=start_time,
            queue_id=queue_id,
            mode=QueueCollapseMode.DEAD_LETTER_EXPLOSION,
            messages_affected=dead_letters_created,
            duration_ms=duration_ms,
            details={
                "explosion_size": explosion_size,
                "dead_letters_created": dead_letters_created,
            },
        )
        self._collapse_events.append(event)

        return {
            "queue_id": queue_id,
            "explosion_size": explosion_size,
            "dead_letters_created": dead_letters_created,
            "total_dead_letters": status.dead_letter_count,
            "duration_ms": duration_ms,
        }

    async def partition_queue(
        self,
        queue_id: str,
        partition_duration_ms: int = 15000,
    ) -> dict[str, Any]:
        """
        Partition the queue, splitting it into isolated segments.
        
        Args:
            queue_id: Target queue
            partition_duration_ms: How long the partition lasts
            
        Returns:
            Queue partition results
        """
        status = self._queues.get(queue_id)
        if not status:
            status = QueueStatus(queue_id=queue_id)
            self._queues[queue_id] = status

        start_time = time.time()
        messages_isolated = status.depth // 2

        async def partition_loop() -> None:
            await asyncio.sleep(partition_duration_ms / 1000)

        await partition_loop()

        event = QueueCollapseEvent(
            timestamp=start_time,
            queue_id=queue_id,
            mode=QueueCollapseMode.PARTITION,
            messages_affected=messages_isolated,
            duration_ms=partition_duration_ms,
            details={
                "messages_isolated": messages_isolated,
            },
        )
        self._collapse_events.append(event)

        return {
            "queue_id": queue_id,
            "messages_isolated": messages_isolated,
            "partition_duration_ms": partition_duration_ms,
        }

    def clear_queue(self, queue_id: str) -> dict[str, Any]:
        """Clear all messages from a queue."""
        status = self._queues.get(queue_id)
        if status:
            status.depth = 0
            status.dead_letter_count = 0
            status.overflow = False
            status.blocked_consumer_count = 0

        self._message_buffer = [m for m in self._message_buffer if m.get("queue_id") != queue_id]

        return {
            "queue_id": queue_id,
            "cleared": True,
            "cleared_at": datetime.now(timezone.utc).isoformat(),
        }

    def clear_all_queues(self) -> dict[str, Any]:
        """Clear all queues and reset state."""
        for status in self._queues.values():
            status.depth = 0
            status.dead_letter_count = 0
            status.overflow = False
            status.blocked_consumer_count = 0

        self._message_buffer.clear()
        self._active_collapse = False

        return {
            "queues_cleared": len(self._queues),
            "cleared_at": datetime.now(timezone.utc).isoformat(),
            "total_collapse_events": len(self._collapse_events),
        }

    def get_collapse_stats(self) -> dict[str, Any]:
        """Get comprehensive queue collapse statistics."""
        total_depth = sum(s.depth for s in self._queues.values())
        total_dead_letters = sum(s.dead_letter_count for s in self._queues.values())
        overflow_count = sum(1 for s in self._queues.values() if s.overflow)

        return {
            "active_collapse": self._active_collapse,
            "total_queues": len(self._queues),
            "total_depth": total_depth,
            "total_dead_letters": total_dead_letters,
            "overflowing_queues": overflow_count,
            "total_messages_corrupted": self._message_corruption_count,
            "dead_letter_explosions": self._dead_letter_explosions,
            "collapse_events": len(self._collapse_events),
            "recent_events": [
                {
                    "timestamp": e.timestamp,
                    "queue_id": e.queue_id,
                    "mode": e.mode.value,
                    "messages_affected": e.messages_affected,
                }
                for e in self._collapse_events[-10:]
            ],
        }

    def export_collapse_log(self) -> list[dict[str, Any]]:
        """Export full collapse event log."""
        return [
            {
                "timestamp": e.timestamp,
                "queue_id": e.queue_id,
                "mode": e.mode.value,
                "messages_affected": e.messages_affected,
                "duration_ms": e.duration_ms,
                "details": e.details,
            }
            for e in self._collapse_events
        ]


_queue_collapse: Optional[QueueCollapse] = None


def get_queue_collapse() -> QueueCollapse:
    global _queue_collapse
    if _queue_collapse is None:
        _queue_collapse = QueueCollapse()
    return _queue_collapse
