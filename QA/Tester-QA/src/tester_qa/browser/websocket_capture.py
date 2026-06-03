"""WebSocket packet capture during Playwright browser sessions.

Intercepts WebSocket frames (send/receive) on a Playwright page and records
them for later analysis, replay, or HAR export.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal event types (for use with EventBus integration)
# ---------------------------------------------------------------------------
class WebSocketEvents:
    DESYNC = "WEBSOCKET_DESYNC"
    FLOOD = "WEBSOCKET_FLOOD"


# ---------------------------------------------------------------------------
# Internal EventBus stub — allows safe standalone use without a real bus
# ---------------------------------------------------------------------------
class _StubEventBus:
    """Lightweight event emitter used when no EventBus is registered."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[Callable[..., None]]] = {}

    def on(self, event: str, handler: Callable[..., None]) -> None:
        self._handlers.setdefault(event, []).append(handler)

    def off(self, event: str, handler: Callable[..., None]) -> None:
        self._handlers.get(event, []).remove(handler)

    def emit(self, event: str, **kwargs: Any) -> None:
        for handler in self._handlers.get(event, []):
            try:
                handler(**kwargs)
            except Exception as exc:  # pragma: no cover
                LOGGER.debug("EventBus handler error for %s: %s", event, exc)


_event_bus: _StubEventBus | None = None


def _get_event_bus() -> _StubEventBus:
    global _event_bus
    if _event_bus is None:
        _event_bus = _StubEventBus()
    return _event_bus


def set_event_bus(bus: Any) -> None:
    """Inject an external EventBus instance (or compatible)."""
    global _event_bus
    _event_bus = bus


# ---------------------------------------------------------------------------
# Packet dataclass
# ---------------------------------------------------------------------------
@dataclass
class WebSocketPacket:
    """A single captured WebSocket frame."""
    direction: str          # "send" or "receive"
    url: str
    data: str
    size: int
    timestamp: str          # ISO-8601

    def to_dict(self) -> dict[str, Any]:
        return {
            "direction": self.direction,
            "url": self.url,
            "data": self.data,
            "size": self.size,
            "timestamp": self.timestamp,
        }


# ---------------------------------------------------------------------------
# WebSocketCapture
# ---------------------------------------------------------------------------
class WebSocketCapture:
    """Intercept and record WebSocket frames on a Playwright page.

    Usage::

        capturer = WebSocketCapture()
        capturer.start_capture(page)
        # ... interact with page ...
        packets = capturer.get_packets()
        har = capturer.export_packets()
        capturer.stop_capture()
    """

    # Threshold for flood detection (frames per second)
    FLOOD_THRESHOLD_FPS = 100

    def __init__(self, flood_threshold: int | None = None) -> None:
        self._flood_threshold = flood_threshold or self.FLOOD_THRESHOLD_FPS
        self._started = False
        self._packets: list[WebSocketPacket] = []
        self._handlers: list[Any] = []  # Playwright route/handler handles

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def start_capture(self, page: Any) -> None:
        """Attach WebSocket interceptors to a Playwright page.

        Registers handlers on the page to capture all WebSocket frames
        (both sent and received) from this point forward.

        Args:
            page: A playwright.sync_api.Page or playwright.async_api.Page.

        Raises:
            RuntimeError: If capture is already running.
        """
        if self._started:
            raise RuntimeError("WebSocketCapture is already running")

        if not hasattr(page, "on"):
            raise TypeError("Expected a Playwright Page object with .on()")

        bus = _get_event_bus()
        self._packets.clear()
        self._started = True

        def on_websocket(ws: Any) -> None:
            ws_url = getattr(ws, "url", "?")
            first_frame_time: float | None = None
            frame_count = 0
            recent_timestamps: list[float] = []

            def _record_send(data: str) -> None:
                nonlocal frame_count, first_frame_time
                now = datetime.now(timezone.utc)
                ts = now.isoformat()
                size = len(data.encode("utf-8")) if isinstance(data, str) else len(data)
                self._packets.append(WebSocketPacket(
                    direction="send",
                    url=ws_url,
                    data=data,
                    size=size,
                    timestamp=ts,
                ))
                frame_count += 1
                if first_frame_time is None:
                    first_frame_time = now.timestamp()
                recent_timestamps.append(now.timestamp())
                # Trim to last 5 seconds of timestamps for flood detection
                cutoff = now.timestamp() - 5
                recent_timestamps = [t for t in recent_timestamps if t > cutoff]
                fps = len(recent_timestamps) / 5.0
                if fps > self._flood_threshold:
                    try:
                        bus.emit(WebSocketEvents.FLOOD, url=ws_url, fps=fps, frame_count=frame_count)
                    except Exception as exc:  # pragma: no cover
                        LOGGER.debug("EventBus FLOOD emit error: %s", exc)
                    LOGGER.warning(
                        "WebSocket flood detected on %s — %.1f frames/sec",
                        ws_url,
                        fps,
                    )

            def _record_receive(data: str) -> None:
                now = datetime.now(timezone.utc)
                ts = now.isoformat()
                size = len(data.encode("utf-8")) if isinstance(data, str) else len(data)
                self._packets.append(WebSocketPacket(
                    direction="receive",
                    url=ws_url,
                    data=data,
                    size=size,
                    timestamp=ts,
                ))

            def _on_close() -> None:
                # Basic desync heuristic: if we recorded sends with no receives
                # or vice versa for a long-running connection, flag it.
                sends = [p for p in self._packets if p.url == ws_url and p.direction == "send"]
                receives = [p for p in self._packets if p.url == ws_url and p.direction == "receive"]
                if len(sends) > 0 and len(receives) == 0:
                    try:
                        bus.emit(
                            WebSocketEvents.DESYNC,
                            url=ws_url,
                            sends=len(sends),
                            receives=len(receives),
                        )
                    except Exception as exc:  # pragma: no cover
                        LOGGER.debug("EventBus DESYNC emit error: %s", exc)
                    LOGGER.warning(
                        "WebSocket desync on %s — %d sent, %d received",
                        ws_url,
                        len(sends),
                        len(receives),
                    )

            # Playwright's WS API differs slightly between sync/async
            for method in ["on_send", "send"]:
                handler = getattr(ws, method, None)
                if callable(handler):
                    try:
                        handler(_record_send)
                    except TypeError:
                        pass  # API mismatch — skip

            for method in ["on_receive", "receive"]:
                handler = getattr(ws, method, None)
                if callable(handler):
                    try:
                        handler(_record_receive)
                    except TypeError:
                        pass

            # Listen for close
            close_handler = getattr(ws, "on_close", None)
            if callable(close_handler):
                try:
                    close_handler(_on_close)
                except TypeError:
                    pass

        # Register the top-level WS handler
        try:
            page.on("websocket", on_websocket)
            self._handlers.append(("websocket", on_websocket))
        except Exception as exc:  # pragma: no cover
            LOGGER.warning("Failed to register WebSocket interceptor: %s", exc)
            self._started = False
            raise

    def stop_capture(self) -> None:
        """Detach interceptors and stop capturing frames."""
        if not self._started:
            return
        self._started = False
        self._handlers.clear()
        LOGGER.debug("WebSocket capture stopped — captured %d frames", len(self._packets))

    def get_packets(self) -> list[dict[str, Any]]:
        """Return captured packets as plain dicts.

        Returns:
            List of packets, each containing:
            ``direction``, ``url``, ``data``, ``size``, ``timestamp``.
        """
        return [p.to_dict() for p in self._packets]

    def export_packets(self) -> dict[str, Any]:
        """Return captured packets in a HAR-like structure.

        Returns:
            A dict with the top-level key ``log`` containing
            ``creator``, ``version``, ``entries``, and ``comment``.
        """
        entries = []
        for pkt in self._packets:
            entries.append({
                "startedDateTime": pkt.timestamp,
                "time": 0,
                "request": {
                    "method": "GET",
                    "url": pkt.url,
                    "httpVersion": "HTTP/1.1",
                    "headers": [],
                    "queryString": [],
                    "cookies": [],
                    "headersSize": -1,
                    "bodySize": pkt.size,
                    "postData": {
                        "mimeType": "application/octet-stream",
                        "text": pkt.data,
                    } if pkt.direction == "send" else {},
                },
                "response": {
                    "status": 0,
                    "statusText": "",
                    "httpVersion": "HTTP/1.1",
                    "headers": [],
                    "cookies": [],
                    "content": {
                        "size": pkt.size,
                        "mimeType": "application/octet-stream",
                        "text": pkt.data,
                    } if pkt.direction == "receive" else {},
                    "redirectURL": "",
                    "headersSize": -1,
                    "bodySize": pkt.size,
                },
                "cache": {},
                "timings": {"send": -1, "wait": -1, "receive": -1},
                "pageref": "page",
                "comment": f"WebSocket frame — {pkt.direction}",
            })

        return {
            "log": {
                "version": "1.2",
                "creator": {
                    "name": "tester_qa",
                    "version": "1.0.0",
                },
                "browser": {
                    "name": "tester_qa",
                    "version": "1.0.0",
                },
                "entries": entries,
                "comment": (
                    f"WebSocket capture — {len(entries)} frames. "
                    f"Generated by tester_qa.browser.websocket_capture."
                ),
            }
        }
