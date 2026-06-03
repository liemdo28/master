"""WebSocket trace — intercepts and logs WebSocket messages during warfare."""
from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# JS injected into the page to intercept WebSocket construction and message traffic
_WEBSOCKET_TRACER_JS = """() => {
    if (window.__tqa_ws_tracer_active__) return;
    window.__tqa_ws_tracer_active__ = true;
    window.__tqa_ws_trace__ = [];

    const _origWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        const ws = protocols !== undefined
            ? new _origWebSocket(url, protocols)
            : new _origWebSocket(url);
        const connId = window.__tqa_ws_trace__.length + '-' + Date.now();
        window.__tqa_ws_trace__.push({
            connId,
            event: 'open',
            url,
            timestamp: Date.now(),
        });
        ws.addEventListener('open', function() {
            window.__tqa_ws_trace__.push({
                connId,
                event: 'open',
                timestamp: Date.now(),
            });
        });
        ws.addEventListener('message', function(e) {
            const data = typeof e.data === 'string' ? e.data : '[binary blob]';
            window.__tqa_ws_trace__.push({
                connId,
                event: 'message',
                direction: 'received',
                data: data.slice(0, 500),
                timestamp: Date.now(),
            });
        });
        ws.addEventListener('error', function(e) {
            window.__tqa_ws_trace__.push({
                connId,
                event: 'error',
                timestamp: Date.now(),
            });
        });
        ws.addEventListener('close', function(e) {
            window.__tqa_ws_trace__.push({
                connId,
                event: 'close',
                code: e.code,
                reason: e.reason || '',
                timestamp: Date.now(),
            });
        });
        return ws;
    };
    window.WebSocket.prototype = _origWebSocket.prototype;
    window.WebSocket.OPEN = _origWebSocket.OPEN;
    window.WebSocket.CLOSING = _origWebSocket.CLOSING;
    window.WebSocket.CLOSED = _origWebSocket.CLOSED;
}"""

_RETRIEVE_TRACE_JS = """() => {
    return window.__tqa_ws_trace__ || [];
}"""


class WebSocketTrace:
    """Intercepts and logs WebSocket messages via JS injection."""

    def __init__(self) -> None:
        self._page: Any = None

    def inject_tracer(self, page: Any) -> None:
        """Inject WebSocket interception code into the page.

        Args:
            page: A live Playwright page object.
        """
        self._page = page
        try:
            page.evaluate(_WEBSOCKET_TRACER_JS)
            logger.debug("[WebSocketTrace] Tracer injected into page")
        except Exception as e:
            logger.warning("[WebSocketTrace] Injection failed: %s", e)

    def get_trace(self) -> list[dict[str, Any]]:
        """Retrieve all intercepted WebSocket events.

        Returns:
            List of WebSocket event dicts with connId, event, direction, data, etc.
        """
        if self._page is None:
            return []
        try:
            return self._page.evaluate(_RETRIEVE_TRACE_JS)
        except Exception as e:
            logger.warning("[WebSocketTrace] Trace retrieval failed: %s", e)
            return []

    def connection_count(self) -> int:
        """Return the number of unique WebSocket connections observed."""
        trace = self.get_trace()
        return len({entry.get("connId") for entry in trace})

    def message_count(self) -> int:
        """Return the total number of messages observed."""
        trace = self.get_trace()
        return sum(1 for e in trace if e.get("event") == "message")

    def clear_trace(self) -> None:
        """Clear the in-page trace buffer (best-effort)."""
        if self._page is None:
            return
        try:
            self._page.evaluate("""() => { window.__tqa_ws_trace__ = []; }""")
        except Exception as e:
            logger.debug("[WebSocketTrace] clear_trace warning: %s", e)
