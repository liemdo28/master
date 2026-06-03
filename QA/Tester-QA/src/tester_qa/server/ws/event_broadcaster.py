"""
Event Broadcaster — subscribes to the EventBus and pushes events to all WebSocket clients.
This is the real-time engine that replaces polling.
"""
from __future__ import annotations

import asyncio
import json
import threading
import time
from typing import Any

from tester_qa.core.event_bus import EventBus, Event, EventType


class EventBroadcaster:
    """
    Singleton broadcaster that subscribes to the EventBus and distributes
    events to all connected WebSocket clients in real time.
    """

    _instance: EventBroadcaster | None = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        self._clients: dict[str, Any] = {}  # ws -> filters
        self._client_lock = threading.Lock()
        self._sequence = 0
        self._bus = EventBus.get_instance()
        self._running = False
        self._listener_task: asyncio.Task | None = None
        self._event_buffer: list[dict] = []
        self._buffer_max = 500

    @classmethod
    def get_instance(cls) -> EventBroadcaster:
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ── Lifecycle ───────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the broadcaster: register with the EventBus."""
        if self._running:
            return
        self.register_with_event_bus()
        self._running = True

    def stop(self) -> None:
        """Stop the broadcaster: unregister from the EventBus."""
        if not self._running:
            return
        self._bus.unsubscribe_all()
        self._running = False

    # ── EventBus integration ────────────────────────────────────────────────────

    def register_with_event_bus(self) -> None:
        """Subscribe to all events from the EventBus."""
        self._bus.subscribe_all(self.handle_event)

    def handle_event(self, event: Event) -> None:
        """Receive an Event from the bus and broadcast it to WebSocket clients."""
        self.broadcast(
            event_type=event.event_type,
            source=getattr(event, "source", "unknown"),
            data=getattr(event, "data", None),
            project_id=getattr(event, "project_id", None),
        )

    # ── Client management ───────────────────────────────────────────────────────

    def add_client(self, ws: Any, filters: list[str] | None = None) -> str:
        """Register a new WebSocket client. Returns client_id."""
        client_id = f"ws-{int(time.time() * 1000)}-{len(self._clients)}"
        with self._client_lock:
            self._clients[client_id] = {"ws": ws, "filters": filters or [], "connected_at": time.time()}
        # Send recent events as welcome payload
        self._send_recent_events(ws)
        return client_id

    def remove_client(self, client_id: str) -> None:
        with self._client_lock:
            self._clients.pop(client_id, None)

    def client_count(self) -> int:
        with self._client_lock:
            return len(self._clients)

    # ── Event filtering ─────────────────────────────────────────────────────────

    def _should_broadcast(self, client_filters: list[str], event_type: EventType) -> bool:
        """Check if event should reach this client."""
        if not client_filters:
            return True  # no filter = receive all
        type_str = event_type.value
        return any(f in type_str or type_str in f for f in client_filters)

    # ── Broadcasting ───────────────────────────────────────────────────────────

    def broadcast(self, event_type: EventType, source: str, data: dict | None = None, project_id: str | None = None) -> None:
        """Called by EventBus subscribers. Pushes event to all eligible clients."""
        with self._client_lock:
            clients = list(self._clients.items())

        if not clients:
            return

        self._sequence += 1
        payload = {
            "seq": self._sequence,
            "type": event_type.value,
            "source": source,
            "data": data or {},
            "project_id": project_id,
            "timestamp": time.time(),
        }

        # Buffer for replay
        self._event_buffer.append(payload)
        if len(self._event_buffer) > self._buffer_max:
            self._event_buffer = self._event_buffer[-self._buffer_max:]

        dead_clients = []
        for client_id, client in clients:
            if not self._should_broadcast(client["filters"], event_type):
                continue
            try:
                ws = client["ws"]
                if ws:
                    msg = json.dumps(payload, ensure_ascii=False, default=str)
                    # Try to send synchronously first
                    try:
                        ws.send_text(msg)
                    except (AttributeError, TypeError):
                        # asyncio WebSocket — schedule async send
                        asyncio.get_event_loop().call_soon_threadsafe(
                            lambda w=ws, m=msg: self._async_send(w, m)
                        )
            except Exception:
                dead_clients.append(client_id)

        # Clean up dead clients
        for cid in dead_clients:
            self.remove_client(cid)

    def _async_send(self, ws: Any, msg: str) -> None:
        """Send to asyncio WebSocket from main thread."""
        try:
            import websockets
            asyncio.create_task(ws.send(msg))
        except Exception:
            pass

    def _send_recent_events(self, ws: Any) -> None:
        """Send recent event buffer as initial state to new client."""
        try:
            welcome = {
                "seq": 0,
                "type": "system.connected",
                "source": "broadcaster",
                "data": {
                    "message": "Connected to Tester-QA War Room",
                    "buffer_size": len(self._event_buffer),
                    "uptime": self._sequence,
                },
                "timestamp": time.time(),
            }
            msg = json.dumps(welcome, ensure_ascii=False, default=str)
            ws.send_text(msg)

            # Send recent events
            for event in self._event_buffer[-50:]:
                ws.send_text(json.dumps(event, ensure_ascii=False, default=str))
        except Exception:
            pass

    # ── Event stream snapshot ───────────────────────────────────────────────────

    def get_recent_events(self, count: int = 50) -> list[dict]:
        """Get recent events from buffer."""
        return self._event_buffer[-count:]

    def get_stats(self) -> dict:
        """Get broadcaster statistics."""
        with self._client_lock:
            return {
                "client_count": len(self._clients),
                "sequence": self._sequence,
                "buffer_size": len(self._event_buffer),
            }


# Global singleton
_broadcaster: EventBroadcaster | None = None


def get_broadcaster() -> EventBroadcaster:
    return EventBroadcaster.get_instance()
