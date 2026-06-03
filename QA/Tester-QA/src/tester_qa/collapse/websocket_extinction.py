"""
WebSocket Extinction Simulation
Simulates complete WebSocket infrastructure collapse - connections, message ordering, and zombie states.
"""
from __future__ import annotations

import asyncio
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional


class ExtinctionMode(Enum):
    HARD_DISCONNECT = "hard_disconnect"
    ZOMBIE_SWARM = "zombie_swarm"
    MESSAGE_CORRUPTION = "message_corruption"
    ORDER_DESTRUCTION = "order_destruction"
    DESYNC_APOCALYPSE = "desync_apocalypse"
    RECONNECT_STORM = "reconnect_storm"
    GHOST_CONNECTIONS = "ghost_connections"


@dataclass
class WebSocketConnection:
    connection_id: str
    endpoint: str
    alive: bool = True
    message_count: int = 0
    last_message_time: float = field(default_factory=time.time)
    zombie: bool = False
    desync_level: float = 0.0


@dataclass
class ExtinctionEvent:
    timestamp: float
    mode: ExtinctionMode
    connections_affected: int
    messages_corrupted: int
    duration_ms: int
    details: dict = field(default_factory=dict)


class WebSocketExtinction:
    """
    Simulates total WebSocket infrastructure collapse.
    Tests system resilience against connection storms, zombie connections, and message chaos.
    """

    def __init__(self) -> None:
        self._connections: dict[str, WebSocketConnection] = {}
        self._extinction_events: list[ExtinctionEvent] = []
        self._zombie_connections: list[str] = []
        self._message_buffer: list[dict[str, Any]] = []
        self._sequence_numbers: dict[str, int] = {}
        self._active_extinction: bool = False

    def register_connection(self, connection_id: str, endpoint: str) -> None:
        """Register a WebSocket connection for tracking."""
        self._connections[connection_id] = WebSocketConnection(
            connection_id=connection_id,
            endpoint=endpoint,
            alive=True,
            message_count=0,
            last_message_time=time.time(),
            zombie=False,
            desync_level=0.0,
        )
        self._sequence_numbers[connection_id] = 0

    def get_connection_status(self, connection_id: str) -> Optional[WebSocketConnection]:
        """Get current status of a connection."""
        return self._connections.get(connection_id)

    def get_all_connections(self) -> dict[str, dict[str, Any]]:
        """Get status of all tracked connections."""
        return {
            cid: {
                "alive": conn.alive,
                "message_count": conn.message_count,
                "last_message_time": conn.last_message_time,
                "zombie": conn.zombie,
                "desync_level": conn.desync_level,
                "endpoint": conn.endpoint,
            }
            for cid, conn in self._connections.items()
        }

    async def close_all_connections(
        self,
        mode: ExtinctionMode = ExtinctionMode.HARD_DISCONNECT,
        duration_ms: int = 30000,
        force: bool = True,
    ) -> dict[str, Any]:
        """
        Forcefully close all WebSocket connections.
        
        Args:
            mode: Type of disconnect to simulate
            duration_ms: How long the extinction event lasts
            force: If True, hard close; if False, graceful with delays
            
        Returns:
            Summary of connection closure
        """
        self._active_extinction = True
        start_time = time.time()
        connection_ids = list(self._connections.keys())

        if not connection_ids:
            connection_ids = [f"conn_{i}" for i in range(100)]

        results: dict[str, Any] = {
            "mode": mode.value,
            "connections_closed": 0,
            "connections_alive": 0,
            "duration_ms": 0,
        }

        async def close_connection(connection_id: str) -> None:
            conn = self._connections.get(connection_id)
            if conn:
                if force:
                    conn.alive = False
                    conn.zombie = True
                else:
                    await asyncio.sleep(random.uniform(0.1, 1.0))
                    conn.alive = False

        tasks = [close_connection(cid) for cid in connection_ids]
        await asyncio.gather(*tasks, return_exceptions=True)

        results["connections_closed"] = len([c for c in self._connections.values() if not c.alive])
        results["connections_alive"] = len([c for c in self._connections.values() if c.alive])
        results["duration_ms"] = int((time.time() - start_time) * 1000)

        event = ExtinctionEvent(
            timestamp=start_time,
            mode=mode,
            connections_affected=len(connection_ids),
            messages_corrupted=0,
            duration_ms=duration_ms,
            details={
                "force": force,
                "connections_closed": results["connections_closed"],
            },
        )
        self._extinction_events.append(event)

        return results

    async def corrupt_message_order(
        self,
        corruption_rate: float = 0.3,
        duration_ms: int = 20000,
    ) -> dict[str, Any]:
        """
        Corrupt the ordering of messages across connections.
        
        Args:
            corruption_rate: Percentage of messages to reorder (0.0-1.0)
            duration_ms: How long to corrupt message ordering
            
        Returns:
            Message ordering corruption results
        """
        start_time = time.time()
        messages_processed = 0
        messages_reordered = 0

        async def ordering_corruption_loop() -> None:
            nonlocal messages_processed, messages_reordered
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                messages_processed += 1
                if random.random() < corruption_rate:
                    messages_reordered += 1
                    conn_id = random.choice(list(self._connections.keys())) if self._connections else "default"
                    seq = self._sequence_numbers.get(conn_id, 0)
                    self._sequence_numbers[conn_id] = max(0, seq - random.randint(1, 10))
                await asyncio.sleep(0.001)

        await ordering_corruption_loop()

        event = ExtinctionEvent(
            timestamp=start_time,
            mode=ExtinctionMode.ORDER_DESTRUCTION,
            connections_affected=len(self._connections),
            messages_corrupted=messages_reordered,
            duration_ms=duration_ms,
            details={
                "corruption_rate": corruption_rate,
                "messages_processed": messages_processed,
                "messages_reordered": messages_reordered,
            },
        )
        self._extinction_events.append(event)

        return {
            "corruption_rate": corruption_rate,
            "messages_processed": messages_processed,
            "messages_reordered": messages_reordered,
            "duration_ms": duration_ms,
        }

    async def create_zombie_swarms(
        self,
        zombie_count: int = 50,
        duration_ms: int = 25000,
    ) -> dict[str, Any]:
        """
        Create swarms of zombie connections that appear alive but don't respond.
        
        Args:
            zombie_count: Number of zombie connections to create
            duration_ms: How long zombies persist
            
        Returns:
            Zombie swarm creation results
        """
        start_time = time.time()
        zombie_ids: list[str] = []

        for i in range(zombie_count):
            zombie_id = f"zombie_{start_time}_{i}"
            self.register_connection(zombie_id, f"/zombie/endpoint/{i}")
            conn = self._connections[zombie_id]
            conn.alive = True
            conn.zombie = True
            self._zombie_connections.append(zombie_id)
            zombie_ids.append(zombie_id)

        async def zombie_heartbeat() -> None:
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                for zid in zombie_ids:
                    conn = self._connections.get(zid)
                    if conn:
                        conn.last_message_time = time.time()
                        conn.desync_level = min(1.0, conn.desync_level + 0.01)
                await asyncio.sleep(1.0)

        await zombie_heartbeat()

        event = ExtinctionEvent(
            timestamp=start_time,
            mode=ExtinctionMode.ZOMBIE_SWARM,
            connections_affected=zombie_count,
            messages_corrupted=0,
            duration_ms=duration_ms,
            details={
                "zombie_count": zombie_count,
                "zombie_ids": zombie_ids[:10],
            },
        )
        self._extinction_events.append(event)

        return {
            "zombie_count": zombie_count,
            "zombie_ids": zombie_ids,
            "total_zombies": len(self._zombie_connections),
            "duration_ms": duration_ms,
        }

    async def trigger_desync(
        self,
        desync_probability: float = 0.5,
        duration_ms: int = 20000,
    ) -> dict[str, Any]:
        """
        Trigger desynchronization between client and server WebSocket states.
        
        Args:
            desync_probability: Likelihood of desync per message (0.0-1.0)
            duration_ms: How long desync persists
            
        Returns:
            Desync event results
        """
        start_time = time.time()
        desync_events = 0
        total_messages = 0

        async def desync_loop() -> None:
            nonlocal desync_events, total_messages
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                total_messages += 1
                if random.random() < desync_probability:
                    desync_events += 1
                    conn_id = random.choice(list(self._connections.keys())) if self._connections else "default"
                    conn = self._connections.get(conn_id)
                    if conn:
                        conn.desync_level = min(1.0, conn.desync_level + 0.1)
                await asyncio.sleep(0.005)

        await desync_loop()

        event = ExtinctionEvent(
            timestamp=start_time,
            mode=ExtinctionMode.DESYNC_APOCALYPSE,
            connections_affected=len(self._connections),
            messages_corrupted=desync_events,
            duration_ms=duration_ms,
            details={
                "desync_probability": desync_probability,
                "total_messages": total_messages,
                "desync_events": desync_events,
            },
        )
        self._extinction_events.append(event)

        return {
            "desync_probability": desync_probability,
            "total_messages": total_messages,
            "desync_events": desync_events,
            "connections_desynced": len([c for c in self._connections.values() if c.desync_level > 0.5]),
            "duration_ms": duration_ms,
        }

    async def trigger_reconnect_storm(
        self,
        connection_count: int = 100,
        burst_size: int = 20,
        duration_ms: int = 30000,
    ) -> dict[str, Any]:
        """
        Trigger a storm of reconnection attempts.
        
        Args:
            connection_count: Total connections to cycle
            burst_size: Number of simultaneous reconnection attempts
            duration_ms: How long the storm lasts
            
        Returns:
            Reconnection storm results
        """
        start_time = time.time()
        reconnect_attempts = 0
        burst_count = 0

        async def reconnect_burst() -> None:
            nonlocal reconnect_attempts, burst_count
            end_time = start_time + (duration_ms / 1000)
            while time.time() < end_time:
                burst_count += 1
                tasks = []
                for i in range(burst_size):
                    conn_id = f"reconnect_{burst_count}_{i}"
                    tasks.append(self._simulate_reconnect(conn_id))
                results = await asyncio.gather(*tasks, return_exceptions=True)
                reconnect_attempts += sum(1 for r in results if r is True)
                await asyncio.sleep(random.uniform(0.1, 0.5))

        await reconnect_burst()

        event = ExtinctionEvent(
            timestamp=start_time,
            mode=ExtinctionMode.RECONNECT_STORM,
            connections_affected=connection_count,
            messages_corrupted=0,
            duration_ms=duration_ms,
            details={
                "connection_count": connection_count,
                "burst_size": burst_size,
                "burst_count": burst_count,
                "reconnect_attempts": reconnect_attempts,
            },
        )
        self._extinction_events.append(event)

        return {
            "connection_count": connection_count,
            "burst_size": burst_size,
            "burst_count": burst_count,
            "reconnect_attempts": reconnect_attempts,
            "duration_ms": duration_ms,
        }

    async def _simulate_reconnect(self, connection_id: str) -> bool:
        """Simulate a single reconnection attempt."""
        await asyncio.sleep(random.uniform(0.01, 0.1))
        return random.random() < 0.3

    def restore_connections(self) -> dict[str, Any]:
        """Restore all connections to healthy state."""
        for conn in self._connections.values():
            conn.alive = True
            conn.zombie = False
            conn.desync_level = 0.0

        self._zombie_connections.clear()
        self._active_extinction = False

        return {
            "connections_restored": len(self._connections),
            "zombies_cleared": True,
            "restored_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_extinction_stats(self) -> dict[str, Any]:
        """Get comprehensive WebSocket extinction statistics."""
        return {
            "active_extinction": self._active_extinction,
            "total_connections": len(self._connections),
            "connections_alive": sum(1 for c in self._connections.values() if c.alive),
            "connections_dead": sum(1 for c in self._connections.values() if not c.alive),
            "zombie_connections": len(self._zombie_connections),
            "total_desynced": sum(1 for c in self._connections.values() if c.desync_level > 0.5),
            "extinction_events": len(self._extinction_events),
            "recent_events": [
                {
                    "timestamp": e.timestamp,
                    "mode": e.mode.value,
                    "connections_affected": e.connections_affected,
                    "messages_corrupted": e.messages_corrupted,
                }
                for e in self._extinction_events[-10:]
            ],
        }

    def export_extinction_log(self) -> list[dict[str, Any]]:
        """Export full extinction event log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "connections_affected": e.connections_affected,
                "messages_corrupted": e.messages_corrupted,
                "duration_ms": e.duration_ms,
                "details": e.details,
            }
            for e in self._extinction_events
        ]


_websocket_extinction: Optional[WebSocketExtinction] = None


def get_websocket_extinction() -> WebSocketExtinction:
    global _websocket_extinction
    if _websocket_extinction is None:
        _websocket_extinction = WebSocketExtinction()
    return _websocket_extinction
