"""
WebSocket Chaos Warfare Engine
Simulates reconnect storms, stale state, duplicate messages, race conditions,
connection floods, delayed/dropped packets, half-open connections, zombie sockets.
"""
import asyncio
import random
import time
import json
import uuid
from typing import Any, Callable, Optional, Protocol
from dataclasses import dataclass, field
from enum import Enum
from collections import deque


class ChaosMode(Enum):
    RECONNECT_STORM = "reconnect_storm"
    STALE_STATE = "stale_state"
    DUPLICATE_MESSAGES = "duplicate_messages"
    RACE_CONDITION = "race_condition"
    CONNECTION_FLOOD = "connection_flood"
    DELAYED_PACKETS = "delayed_packets"
    DROPPED_PACKETS = "dropped_packets"
    HALF_OPEN = "half_open"
    ZOMBIE_SOCKET = "zombie_socket"
    MESSAGE_REORDERING = "message_reordering"
    SILENT_DISCONNECT = "silent_disconnect"


@dataclass
class WebSocketChaosConfig:
    mode: ChaosMode
    probability: float = 1.0
    intensity: float = 1.0  # 0.0-1.0, affects severity
    delay_ms: int = 0
    duration_ms: int = 10000
    max_connections: int = 100
    message_delay_ms: int = 1000
    drop_rate: float = 0.3  # 30% packet drop
    duplicate_count: int = 3


@dataclass
class ChaosEvent:
    timestamp: float
    mode: ChaosMode
    client_id: str
    details: dict = field(default_factory=dict)


class WebSocketChaosEngine:
    """
    Injects chaos into WebSocket connections.
    """

    def __init__(self):
        self.active_chaos: dict[str, WebSocketChaosConfig] = {}
        self.chaos_log: list[ChaosEvent] = []
        self._chaos_count = 0
        self._message_buffer: dict[str, deque] = {}
        self._delayed_messages: dict[str, list] = {}
        self._stale_messages: dict[str, dict] = {}
        self._duplicate_tracker: dict[str, list] = {}

    def configure_chaos(self, endpoint: str, config: WebSocketChaosConfig):
        self.active_chaos[endpoint] = config
        self._message_buffer[endpoint] = deque(maxlen=1000)
        self._delayed_messages[endpoint] = []
        self._stale_messages[endpoint] = {}
        self._duplicate_tracker[endpoint] = []

    def clear_chaos(self, endpoint: str):
        self.active_chaos.pop(endpoint, None)

    def clear_all(self):
        self.active_chaos.clear()
        self.chaos_log.clear()

    async def inject_chaos(
        self,
        endpoint: str,
        message: Any,
        client_id: str = None
    ) -> Optional[Any]:
        """Inject chaos into a WebSocket message."""
        if endpoint not in self.active_chaos:
            return message

        self._chaos_count += 1
        config = self.active_chaos[endpoint]
        client_id = client_id or str(uuid.uuid4())

        if random.random() > config.probability:
            return message

        self.chaos_log.append(ChaosEvent(
            timestamp=time.time(),
            mode=config.mode,
            client_id=client_id,
            details={"intensity": config.intensity}
        ))

        if config.delay_ms > 0:
            await asyncio.sleep(config.delay_ms / 1000)

        mode = config.mode

        if mode == ChaosMode.STALE_STATE:
            # Inject old/stale data
            stale_data = {
                "type": "stale",
                "timestamp": time.time() - 3600,  # 1 hour old
                "data": message if isinstance(message, dict) else {"value": message},
                "stale": True
            }
            self._stale_messages[endpoint][client_id] = stale_data
            return stale_data

        elif mode == ChaosMode.DUPLICATE_MESSAGES:
            # Return multiple copies of the message
            duplicates = []
            for i in range(config.duplicate_count):
                dup = self._clone_message(message, seq=i)
                duplicates.append(dup)
            self._duplicate_tracker[endpoint].extend(duplicates)
            return duplicates

        elif mode == ChaosMode.DELAYED_PACKETS:
            # Queue message for delayed delivery
            delayed_item = {
                "message": message,
                "deliver_at": time.time() + (config.message_delay_ms / 1000),
                "client_id": client_id
            }
            self._delayed_messages[endpoint].append(delayed_item)
            return None  # Original message "lost"

        elif mode == ChaosMode.DROPPED_PACKETS:
            # Randomly drop packets
            if random.random() < config.drop_rate:
                return None  # Message dropped
            return message

        elif mode == ChaosMode.MESSAGE_REORDERING:
            # Buffer and reorder messages
            buf = self._message_buffer[endpoint]
            buf.append(message)
            if len(buf) > 5:
                # Reverse last 5 messages to simulate reordering
                reversed_chunk = list(buf)[-5:]
                reversed_chunk.reverse()
                for i, msg in enumerate(reversed_chunk):
                    buf[-(5 - i)] = msg
                return buf[-1]
            return message

        elif mode == ChaosMode.SILENT_DISCONNECT:
            # Don't return anything - simulates silent death
            return None

        else:
            return message

    async def trigger_reconnect_storm(
        self,
        endpoint: str,
        connect_func: Callable,
        disconnect_func: Callable = None
    ):
        """Simulate a reconnect storm - rapid connect/disconnect cycles."""
        if endpoint not in self.active_chaos:
            return

        config = self.active_chaos[endpoint]
        storm_count = int(config.max_connections * config.intensity)

        for i in range(storm_count):
            try:
                await connect_func()
                self.chaos_log.append(ChaosEvent(
                    timestamp=time.time(),
                    mode=ChaosMode.RECONNECT_STORM,
                    client_id=f"storm_client_{i}",
                    details={"attempt": i + 1, "total": storm_count}
                ))
                if disconnect_func:
                    await disconnect_func()
                await asyncio.sleep(0.01)  # Rapid reconnection
            except Exception as e:
                self.chaos_log.append(ChaosEvent(
                    timestamp=time.time(),
                    mode=ChaosMode.RECONNECT_STORM,
                    client_id=f"storm_client_{i}",
                    details={"error": str(e)}
                ))

    async def trigger_connection_flood(
        self,
        endpoint: str,
        connect_func: Callable,
        max_connections: int = None
    ):
        """Flood endpoint with connections to overwhelm it."""
        if endpoint not in self.active_chaos:
            return

        config = self.active_chaos[endpoint]
        max_conn = max_connections or config.max_connections
        connections = []

        for i in range(max_conn):
            try:
                conn = asyncio.create_task(connect_func())
                connections.append(conn)
                self.chaos_log.append(ChaosEvent(
                    timestamp=time.time(),
                    mode=ChaosMode.CONNECTION_FLOOD,
                    client_id=f"flood_client_{i}",
                    details={"active_connections": len(connections)}
                ))
            except Exception as e:
                pass

        # Wait for all connections
        results = await asyncio.gather(*connections, return_exceptions=True)
        return results

    async def create_half_open_connection(
        self,
        endpoint: str,
        connect_func: Callable
    ):
        """Create a half-open TCP connection (SYN sent, no SYN-ACK received)."""
        self.chaos_log.append(ChaosEvent(
            timestamp=time.time(),
            mode=ChaosMode.HALF_OPEN,
            client_id="half_open_client",
            details={"endpoint": endpoint}
        ))
        # In practice, this requires raw socket manipulation
        # For HTTP/WebSocket, we simulate by timing out the handshake
        try:
            await asyncio.wait_for(connect_func(), timeout=0.001)
        except asyncio.TimeoutError:
            pass  # Half-open - handshake never completed

    async def create_zombie_socket(
        self,
        endpoint: str,
        connect_func: Callable,
        send_func: Callable = None
    ):
        """Create a zombie socket - connected but unresponsive."""
        self.chaos_log.append(ChaosEvent(
            timestamp=time.time(),
            mode=ChaosMode.ZOMBIE_SOCKET,
            client_id="zombie_client",
            details={"endpoint": endpoint}
        ))
        try:
            conn = await connect_func()
            # Send initial data then go silent
            if send_func:
                await send_func(conn, {"type": "ping"})
            # Never respond - become a zombie
            cfg = self.active_chaos.get(endpoint)
            duration = cfg.duration_ms / 1000 if cfg else 10
            await asyncio.sleep(duration)
        except Exception:
            pass

    def _clone_message(self, message: Any, seq: int = 0) -> dict:
        """Clone a message with sequence number."""
        if isinstance(message, dict):
            result = message.copy()
            result["_chaos_clone"] = True
            result["_clone_seq"] = seq
            result["_original_id"] = message.get("id", str(uuid.uuid4()))
            return result
        return {"type": "clone", "value": message, "_clone_seq": seq}

    def get_chaos_stats(self) -> dict:
        """Return chaos statistics."""
        mode_counts = {}
        for event in self.chaos_log:
            mode = event.mode.value
            mode_counts[mode] = mode_counts.get(mode, 0) + 1

        return {
            "total_chaos_events": self._chaos_count,
            "active_chaos_count": len(self.active_chaos),
            "chaos_log_size": len(self.chaos_log),
            "mode_distribution": mode_counts,
            "buffer_sizes": {
                endpoint: len(buf)
                for endpoint, buf in self._message_buffer.items()
            },
            "pending_delayed": {
                endpoint: len(msgs)
                for endpoint, msgs in self._delayed_messages.items()
            }
        }

    def export_chaos_log(self) -> list[dict]:
        """Export the full chaos log."""
        return [
            {
                "timestamp": e.timestamp,
                "mode": e.mode.value,
                "client_id": e.client_id,
                "details": e.details,
            }
            for e in self.chaos_log
        ]


# Global singleton
_websocket_chaos_engine: Optional[WebSocketChaosEngine] = None


def get_websocket_chaos_engine() -> WebSocketChaosEngine:
    global _websocket_chaos_engine
    if _websocket_chaos_engine is None:
        _websocket_chaos_engine = WebSocketChaosEngine()
    return _websocket_chaos_engine
