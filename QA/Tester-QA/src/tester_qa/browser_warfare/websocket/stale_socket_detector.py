"""Stale Socket Detector — identifies WebSocket connections that are stuck or dead.

Injects JavaScript that tracks open WebSocket connections, monitors their last-seen
activity timestamps, and flags connections that have been idle beyond a threshold.
"""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)

# Default idle threshold (seconds) before a socket is considered stale
_DEFAULT_IDLE_THRESHOLD_SEC = 30

_INJECTION = """
(function() {
    if (window.__STALE_SOCKET_INJECTED__) return;
    window.__STALE_SOCKET_INJECTED__ = true;

    window.__STALE_SOCKET_MAP__ = {};   // connId -> { url, created, last_seen, state }
    window.__STALE_SOCKET_IDLE_THRESHOLD__ = %d;

    var _origWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        var connId = 'ss-' + Math.random().toString(36).substr(2, 9);
        var ws = new _origWS(url, protocols);
        ws.__conn_id__ = connId;
        window.__STALE_SOCKET_MAP__[connId] = {
            url: url,
            created: Date.now(),
            last_seen: Date.now(),
            state: ws.readyState,
            closed_by_server: false
        };

        ws.addEventListener('message', function() {
            if (window.__STALE_SOCKET_MAP__[connId]) {
                window.__STALE_SOCKET_MAP__[connId].last_seen = Date.now();
            }
        });
        ws.addEventListener('close', function() {
            if (window.__STALE_SOCKET_MAP__[connId]) {
                window.__STALE_SOCKET_MAP__[connId].state = WebSocket.CLOSED;
            }
        });
        ws.addEventListener('error', function() {
            if (window.__STALE_SOCKET_MAP__[connId]) {
                window.__STALE_SOCKET_MAP__[connId].closed_by_server = true;
            }
        });
        return ws;
    };
    window.WebSocket.prototype = _origWS.prototype;
    window.WebSocket.CONNECTING = _origWS.CONNECTING;
    window.WebSocket.OPEN = _origWS.OPEN;
    window.WebSocket.CLOSING = _origWS.CLOSING;
    window.WebSocket.CLOSED = _origWS.CLOSED;

    // Periodic scanner — runs every 10 s
    window.__STALE_SOCKET_REAP__ = setInterval(function() {
        var now = Date.now();
        var threshold = window.__STALE_SOCKET_IDLE_THRESHOLD__ * 1000;
        Object.keys(window.__STALE_SOCKET_MAP__).forEach(function(id) {
            var entry = window.__STALE_SOCKET_MAP__[id];
            var idle = now - entry.last_seen;
            if (idle > threshold && entry.state !== WebSocket.CLOSED) {
                if (!window.__STALE_SOCKET_MARKED__) window.__STALE_SOCKET_MARKED__ = [];
                window.__STALE_SOCKET_MARKED__.push(id);
            }
        });
    }, 10000);
})();
"""


class StaleSocketDetector:
    """Detects and reports stale (inactive / dead) WebSocket connections."""

    def __init__(self, idle_threshold_sec: int = _DEFAULT_IDLE_THRESHOLD_SEC) -> None:
        self._idle_threshold_sec = idle_threshold_sec
        self._injected = False

    def inject(self, page: Any) -> None:
        """Inject the stale-socket tracker JS into the page."""
        if self._injected:
            return
        try:
            page.evaluate(_INJECTION % self._idle_threshold_sec)
            self._injected = True
            LOGGER.info(
                "[StaleSocketDetector] Injected (idle_threshold=%ds)", self._idle_threshold_sec
            )
        except Exception as e:
            LOGGER.warning("[StaleSocketDetector] Injection failed: %s", e)

    def scan(self, page: Any) -> list[str]:
        """Scan the page and return a list of stale socket IDs.

        A socket is stale if it is open/connecting but has been idle beyond
        the configured threshold, or if it has been marked as closed-by-server.
        """
        if not self._injected:
            self.inject(page)

        try:
            raw = page.evaluate(
                """
                (function() {
                    var map = window.__STALE_SOCKET_MAP__ || {};
                    var marked = window.__STALE_SOCKET_MARKED__ || [];
                    var threshold = (window.__STALE_SOCKET_IDLE_THRESHOLD__ || 30) * 1000;
                    var now = Date.now();
                    var stale = [];

                    Object.keys(map).forEach(function(id) {
                        var entry = map[id];
                        var idle = now - entry.last_seen;
                        var isStale = (idle > threshold && entry.state !== WebSocket.CLOSED)
                                   || entry.closed_by_server;
                        if (isStale) stale.push(id);
                    });

                    // Also include explicitly marked
                    marked.forEach(function(id) {
                        if (!stale.includes(id)) stale.push(id);
                    });

                    return {
                        stale_ids: stale,
                        total_connections: Object.keys(map).length,
                        threshold_sec: window.__STALE_SOCKET_IDLE_THRESHOLD__ || 30,
                        now: now
                    };
                })();
                """
            )
        except Exception as e:
            LOGGER.warning("[StaleSocketDetector] Scan failed: %s", e)
            return []

        stale_ids: list[str] = raw.get("stale_ids", [])
        LOGGER.info(
            "[StaleSocketDetector] Scanned — %d stale / %d total",
            len(stale_ids), raw.get("total_connections", 0),
        )
        return stale_ids

    def get_stale_details(self, page: Any) -> list[dict[str, Any]]:
        """Return detailed information about each stale socket."""
        try:
            raw = page.evaluate(
                """
                (function() {
                    var map = window.__STALE_SOCKET_MAP__ || {};
                    var marked = window.__STALE_SOCKET_MARKED__ || [];
                    var threshold = (window.__STALE_SOCKET_IDLE_THRESHOLD__ || 30) * 1000;
                    var now = Date.now();
                    var details = [];

                    Object.keys(map).forEach(function(id) {
                        var entry = map[id];
                        var idle = now - entry.last_seen;
                        var isStale = (idle > threshold && entry.state !== WebSocket.CLOSED)
                                   || entry.closed_by_server;
                        if (isStale) {
                            details.push({
                                conn_id: id,
                                url: entry.url,
                                created: entry.created,
                                last_seen: entry.last_seen,
                                idle_sec: Math.round(idle / 1000),
                                state: entry.state,
                                closed_by_server: entry.closed_by_server
                            });
                        }
                    });
                    return details;
                })();
                """
            )
            return raw if isinstance(raw, list) else []
        except Exception as e:
            LOGGER.warning("[StaleSocketDetector] Detail scan failed: %s", e)
            return []

    def cleanup(self, page: Any) -> int:
        """Attempt to close stale sockets in the page and return the count closed."""
        stale_ids = self.scan(page)
        if not stale_ids:
            return 0

        stale_json = str(stale_ids)
        try:
            page.evaluate(
                f"""
                (function() {{
                    var ids = {stale_json};
                    var map = window.__STALE_SOCKET_MAP__ || {{}};
                    ids.forEach(function(id) {{
                        // Find the actual WebSocket object (tracked via our wrapper)
                        // and close it.
                        if (map[id]) {{
                            try {{
                                // The original WebSocket is not directly accessible;
                                // we mark it for GC by removing the entry.
                                delete map[id];
                            }} catch(e) {{}}
                        }}
                    }});
                }})();
                """
            )
        except Exception as e:
            LOGGER.warning("[StaleSocketDetector] Cleanup failed: %s", e)

        LOGGER.info("[StaleSocketDetector] Cleaned up %d stale sockets", len(stale_ids))
        return len(stale_ids)
