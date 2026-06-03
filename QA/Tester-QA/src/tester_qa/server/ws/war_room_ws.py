"""
War Room WebSocket Server — serves realtime events to the React dashboard.
Uses Python's websockets library alongside the HTTP server.
"""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from typing import Any

import websockets
from websockets.server import WebSocketServerProtocol

from .event_broadcaster import get_broadcaster

LOGGER = logging.getLogger(__name__)


class WarRoomWebSocketServer:
    """
    Async WebSocket server that bridges the EventBus to browser clients.

    Supports:
    - /ws/warroom — full war room events (all event types)
    - /ws/telemetry — telemetry-only stream (metrics, runtime)
    - /ws/incidents — incident-only stream
    - /ws/chaos — chaos-engine-only stream
    """

    FILTERS = {
        "/ws/warroom": [],       # all events
        "/ws/telemetry": ["runtime", "metrics", "provider"],
        "/ws/incidents": ["incident"],
        "/ws/chaos": ["chaos", "collapse"],
    }

    def __init__(self, host: str = "0.0.0.0", port: int = 7702) -> None:
        self.host = host
        self.port = port
        self._server: websockets.WebSocketServer | None = None
        self._running = False
        self._thread: threading.Thread | None = None
        self._broadcasters: dict[str, Any] = {}  # path -> broadcaster
        self._clients: dict[WebSocketServerProtocol, str] = {}  # ws -> path
        self._client_lock = threading.Lock()

        for path in self.FILTERS:
            self._broadcasters[path] = get_broadcaster()

    async def _handle_client(self, ws: WebSocketServerProtocol, path: str) -> None:
        """Handle a single WebSocket client connection."""
        filters = self.FILTERS.get(path, [])
        broadcaster = self._broadcasters.get(path, get_broadcaster())
        client_id = broadcaster.add_client(ws, filters)

        with self._client_lock:
            self._clients[ws] = path

        LOGGER.info(f"[WS] Client connected: {client_id} on {path} (total: {broadcaster.client_count()})")

        try:
            async for message in ws:
                try:
                    cmd = json.loads(message)
                    await self._handle_command(ws, cmd, broadcaster)
                except json.JSONDecodeError:
                    await ws.send(json.dumps({"type": "error", "data": {"message": "Invalid JSON"}}))
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            broadcaster.remove_client(client_id)
            with self._client_lock:
                self._clients.pop(ws, None)
            LOGGER.info(f"[WS] Client disconnected: {client_id}")

    async def _handle_command(self, ws: WebSocketServerProtocol, cmd: dict, broadcaster: Any) -> None:
        """Handle client commands sent over WebSocket."""
        action = cmd.get("action", "")
        if action == "ping":
            await ws.send(json.dumps({
                "type": "pong",
                "source": "server",
                "data": {"time": time.time()},
                "timestamp": time.time(),
            }))
        elif action == "subscribe":
            filters = cmd.get("filters", [])
            # Dynamic filter subscription — just acknowledge
            await ws.send(json.dumps({
                "type": "system.subscribed",
                "source": "server",
                "data": {"filters": filters},
                "timestamp": time.time(),
            }))
        elif action == "snapshot":
            # Client requests full war room snapshot
            from tester_qa.warroom.war_room import WarRoom
            wr = WarRoom()
            snap = wr.capture_snapshot()
            await ws.send(json.dumps({
                "type": "snapshot.full",
                "source": "server",
                "data": snap.to_dict(),
                "timestamp": time.time(),
            }))
        elif action == "history":
            count = cmd.get("count", 50)
            events = broadcaster.get_recent_events(count)
            await ws.send(json.dumps({
                "type": "history.events",
                "source": "server",
                "data": {"events": events, "count": len(events)},
                "timestamp": time.time(),
            }))
        else:
            await ws.send(json.dumps({
                "type": "error",
                "source": "server",
                "data": {"message": f"Unknown action: {action}"},
                "timestamp": time.time(),
            }))

    async def _router(self, ws: WebSocketServerProtocol, path: str) -> None:
        """Route incoming connections to appropriate handlers."""
        await self._handle_client(ws, path)

    async def start_async(self) -> None:
        """Start the async WebSocket server."""
        async with websockets.serve(self._router, self.host, self.port, process_request=self._process_request):
            LOGGER.info(f"[WS] War Room WebSocket server running on ws://{self.host}:{self.port}")
            LOGGER.info(f"[WS] Endpoints: {list(self.FILTERS.keys())}")
            self._running = True
            await asyncio.Future()  # run forever

    def _process_request(self, path: str, request_headers: dict) -> websockets.ORIGIN_CONSTANT | None:
        """Validate the request path and return None to accept, or raise to reject."""
        if path not in self.FILTERS and not path.startswith("/ws/"):
            raise websockets.exceptions.InvalidURI(f"Unknown path: {path}")
        return None

    def start(self) -> None:
        """Start WebSocket server in a background thread."""
        if self._running:
            return
        self._thread = threading.Thread(target=self._run_async, daemon=True)
        self._thread.start()
        LOGGER.info(f"[WS] WebSocket server thread started on {self.host}:{self.port}")

    def _run_async(self) -> None:
        """Run the async event loop in a thread."""
        try:
            asyncio.run(self.start_async())
        except Exception as e:
            LOGGER.error(f"[WS] Server error: {e}")

    def stop(self) -> None:
        """Stop the WebSocket server."""
        self._running = False
        if self._server:
            self._server.close()

    def get_stats(self) -> dict:
        """Get server statistics."""
        total = 0
        per_path: dict[str, int] = {}
        for path in self.FILTERS:
            bc = self._broadcasters.get(path, get_broadcaster())
            count = bc.client_count()
            per_path[path] = count
            total += count
        return {
            "running": self._running,
            "total_clients": total,
            "per_endpoint": per_path,
            "port": self.port,
        }


def run_ws_server(host: str = "0.0.0.0", port: int = 7702) -> None:
    """Convenience: run the WS server standalone."""
    server = WarRoomWebSocketServer(host=host, port=port)
    server.start()
    print(f"[Tester-QA] WS Server running on ws://{host}:{port}")
    print(f"[Tester-QA] Connect: ws://localhost:{port}/ws/warroom")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        server.stop()
