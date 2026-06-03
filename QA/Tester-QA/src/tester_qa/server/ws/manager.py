"""
WebSocket Lifecycle Manager — centralized singleton that tracks all connected
clients, their channel subscriptions, heartbeat state, and provides broadcast
primitives used by the WebSocket server layer.
"""
from __future__ import annotations

import json
import threading
import time
from typing import Any

from tester_qa.core.event_bus import EventBus, EventType


class WSManager:
    """
    Singleton WebSocket connection manager.

    Tracks:
        - Connected clients by id (client_id → client metadata dict).
        - Per-client subscribed channels / rooms.
        - Heartbeat state for ping/liveness checks.

    Thread-safe via a single ``threading.Lock``.
    """

    _instance: "WSManager | None" = None
    _lock = threading.Lock()

    def __init__(self) -> None:
        # client_id → {"ws": Any, "channels": set[str], "connected_at": float, "last_ping": float}
        self._clients: dict[str, dict[str, Any]] = {}
        # channel_name → set of client_ids
        self._channels: dict[str, set[str]] = {}

        self._clients_lock = threading.Lock()
        self._start_time = time.time()
        self._bus = EventBus.get_instance()

    # ── Singleton ──────────────────────────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> "WSManager":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    # ── Client management ───────────────────────────────────────────────────────

    def add_client(self, client_id: str, ws: Any) -> None:
        """Register a new client connection."""
        with self._clients_lock:
            self._clients[client_id] = {
                "ws": ws,
                "channels": set(),
                "connected_at": time.time(),
                "last_ping": time.time(),
            }

    def remove_client(self, client_id: str) -> None:
        """Unregister a client and clean up all its channel memberships."""
        with self._clients_lock:
            client = self._clients.pop(client_id, None)

        if client:
            for channel in list(client.get("channels", [])):
                self.leave(client_id, channel)

    def get_client(self, client_id: str) -> dict[str, Any] | None:
        """Return the metadata dict for a client, or None."""
        with self._clients_lock:
            return self._clients.get(client_id)

    def get_clients(self) -> dict[str, dict[str, Any]]:
        """Return a shallow copy of all client metadata (read-only use)."""
        with self._clients_lock:
            return dict(self._clients)

    # ── Channel / room subscriptions ───────────────────────────────────────────

    def join(self, client_id: str, channel: str) -> None:
        """Subscribe *client_id* to *channel*."""
        with self._clients_lock:
            if client_id not in self._clients:
                return
            self._clients[client_id]["channels"].add(channel)
            if channel not in self._channels:
                self._channels[channel] = set()
            self._channels[channel].add(client_id)

    def leave(self, client_id: str, channel: str) -> None:
        """Unsubscribe *client_id* from *channel*."""
        with self._clients_lock:
            if client_id in self._clients:
                self._clients[client_id]["channels"].discard(channel)
            self._channels.get(channel, set()).discard(client_id)
            if not self._channels.get(channel):
                self._channels.pop(channel, None)

    def leave_all(self, client_id: str) -> None:
        """Remove *client_id* from every channel it is subscribed to."""
        with self._clients_lock:
            channels = self._clients.get(client_id, {}).get("channels", set()).copy()
        for ch in channels:
            self.leave(client_id, ch)

    # ── Broadcasting ────────────────────────────────────────────────────────────

    def broadcast(self, channel: str, payload: dict[str, Any]) -> int:
        """
        Send *payload* to every client subscribed to *channel*.
        Returns the number of clients the message was sent to.
        """
        with self._clients_lock:
            client_ids = list(self._channels.get(channel, set()))

        dead = []
        sent = 0
        msg = json.dumps(payload, ensure_ascii=False, default=str)

        for cid in client_ids:
            with self._clients_lock:
                client = self._clients.get(cid)

            if client is None:
                dead.append(cid)
                continue

            try:
                ws = client["ws"]
                if ws is not None:
                    ws.send_text(msg)
                    sent += 1
            except Exception:
                dead.append(cid)

        for cid in dead:
            self.remove_client(cid)

        return sent

    def broadcast_all(self, payload: dict[str, Any]) -> int:
        """
        Send *payload* to every connected client (global broadcast).
        Returns the number of clients the message was sent to.
        """
        with self._clients_lock:
            client_ids = list(self._clients.keys())

        dead = []
        sent = 0
        msg = json.dumps(payload, ensure_ascii=False, default=str)

        for cid in client_ids:
            with self._clients_lock:
                client = self._clients.get(cid)

            if client is None:
                dead.append(cid)
                continue

            try:
                ws = client["ws"]
                if ws is not None:
                    ws.send_text(msg)
                    sent += 1
            except Exception:
                dead.append(cid)

        for cid in dead:
            self.remove_client(cid)

        return sent

    def send_to(self, client_id: str, payload: dict[str, Any]) -> bool:
        """Send a payload to a specific client. Returns True if delivered."""
        with self._clients_lock:
            client = self._clients.get(client_id)

        if client is None:
            return False

        try:
            msg = json.dumps(payload, ensure_ascii=False, default=str)
            client["ws"].send_text(msg)
            return True
        except Exception:
            self.remove_client(client_id)
            return False

    # ── Heartbeat / ping ────────────────────────────────────────────────────────

    def ping(self) -> dict[str, list[str]]:
        """
        Send a ping frame to every client and update ``last_ping``.
        Returns a dict of ``{"stale": [client_ids]}`` — clients that are
        unresponsive and should be cleaned up.
        """
        stale: list[str] = []
        ping_payload = json.dumps(
            {"type": "system.ping", "timestamp": time.time()}, ensure_ascii=False, default=str
        )

        with self._clients_lock:
            client_ids = list(self._clients.keys())

        for cid in client_ids:
            with self._clients_lock:
                client = self._clients.get(cid)

            if client is None:
                stale.append(cid)
                continue

            try:
                ws = client["ws"]
                if ws is not None:
                    ws.send_text(ping_payload)
                    client["last_ping"] = time.time()
            except Exception:
                stale.append(cid)

        for cid in stale:
            self.remove_client(cid)

        return {"stale": stale}

    def touch_ping(self, client_id: str) -> None:
        """Record a pong response from *client_id* (called on client's pong)."""
        with self._clients_lock:
            if client_id in self._clients:
                self._clients[client_id]["last_ping"] = time.time()

    # ── Reconnect / stale cleanup ────────────────────────────────────────────────

    def cleanup_stale(self, max_age_seconds: float = 60.0) -> list[str]:
        """
        Remove clients whose ``last_ping`` is older than *max_age_seconds*.
        Called periodically or on reconnect scans.
        Returns the list of removed client IDs.
        """
        now = time.time()
        removed: list[str] = []

        with self._clients_lock:
            for cid, client in list(self._clients.items()):
                if now - client["last_ping"] > max_age_seconds:
                    removed.append(cid)

        for cid in removed:
            self.remove_client(cid)

        return removed

    # ── Metrics / stats ────────────────────────────────────────────────────────

    @property
    def total_clients(self) -> int:
        with self._clients_lock:
            return len(self._clients)

    @property
    def total_channels(self) -> int:
        with self._clients_lock:
            return len(self._channels)

    @property
    def uptime(self) -> float:
        return time.time() - self._start_time

    def get_stats(self) -> dict[str, Any]:
        """Return a snapshot of all manager metrics."""
        with self._clients_lock:
            channels_snapshot = {ch: set(ids) for ch, ids in self._channels.items()}
            clients_snapshot = {
                cid: {
                    "channels": list(c["channels"]),
                    "connected_at": c["connected_at"],
                    "last_ping": c["last_ping"],
                }
                for cid, c in self._clients.items()
            }

        return {
            "total_clients": len(self._clients),
            "total_channels": len(self._channels),
            "channels": channels_snapshot,
            "clients": clients_snapshot,
            "uptime_seconds": round(self.uptime, 2),
        }


# ── Global convenience accessor ───────────────────────────────────────────────

_manager: "WSManager | None" = None


def get_manager() -> WSManager:
    return WSManager.get_instance()
