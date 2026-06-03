"""Socket Pressure — measures WebSocket load and connection health metrics.

Collects real-time metrics about WebSocket connections: active connection count,
message rate, memory footprint of the socket buffers, and per-socket readiness.
"""
from __future__ import annotations

import logging
import time
from typing import Any

LOGGER = logging.getLogger(__name__)

_INJECTION = """
(function() {
    if (window.__SOCKET_PRESSURE_INJECTED__) return;
    window.__SOCKET_PRESSURE_INJECTED__ = true;

    window.__SOCKET_PRESSURE_HISTORY__ = [];
    window.__SOCKET_PRESSURE_INTERVAL__ = null;

    var _origWS = window.WebSocket;
    window.__SOCKET_PRESSURE_ACTIVE__ = [];

    window.WebSocket = function(url, protocols) {
        var connId = 'sp-' + Math.random().toString(36).substr(2, 9);
        var ws = new _origWS(url, protocols);
        ws.__conn_id__ = connId;
        var entry = {
            connId: connId,
            url: url,
            created: Date.now(),
            messages_sent: 0,
            messages_received: 0,
            bytes_sent: 0,
            bytes_received: 0,
            readyState: ws.readyState
        };

        var _origSend = ws.send.bind(ws);
        ws.send = function(data) {
            entry.bytes_sent += new Blob([String(data)]).size;
            entry.messages_sent++;
            return _origSend(data);
        };

        ws.addEventListener('message', function(ev) {
            entry.bytes_received += new Blob([String(ev.data)]).size;
            entry.messages_received++;
        });

        ws.addEventListener('close', function() { entry.readyState = WebSocket.CLOSED; });
        ws.addEventListener('error', function() { entry.readyState = WebSocket.CLOSED; });

        window.__SOCKET_PRESSURE_ACTIVE__.push(entry);
        return ws;
    };
    window.WebSocket.prototype = _origWS.prototype;
    Object.keys(_origWS).forEach(function(k) {
        try { window.WebSocket[k] = _origWS[k]; } catch(e) {}
    });

    // Periodic sampler
    window.__SOCKET_PRESSURE_INTERVAL__ = setInterval(function() {
        var total = window.__SOCKET_PRESSURE_ACTIVE__.length;
        var active = window.__SOCKET_PRESSURE_ACTIVE__.filter(function(e) {
            return e.readyState === WebSocket.OPEN || e.readyState === WebSocket.CONNECTING;
        }).length;
        var closed = total - active;

        // Rough JS heap as proxy for buffer memory
        var mem = (performance.memory || {}).usedJSHeapSize || 0;

        var sample = {
            ts: Date.now(),
            total_connections: total,
            active_connections: active,
            closed_connections: closed,
            memory_bytes: mem,
            memory_mb: mem / (1024 * 1024),
            active: window.__SOCKET_PRESSURE_ACTIVE__.map(function(e) {
                return {
                    connId: e.connId,
                    url: e.url,
                    messages_sent: e.messages_sent,
                    messages_received: e.messages_received,
                    bytes_sent: e.bytes_sent,
                    bytes_received: e.bytes_received,
                    readyState: e.readyState
                };
            })
        };
        window.__SOCKET_PRESSURE_HISTORY__.push(sample);
        if (window.__SOCKET_PRESSURE_HISTORY__.length > 200) {
            window.__SOCKET_PRESSURE_HISTORY__.shift();
        }
    }, 1000);
})();
"""


class SocketPressure:
    """Measures WebSocket connection pressure and health within a browser page."""

    def __init__(self, sample_interval_sec: float = 1.0) -> None:
        self._sample_interval_sec = sample_interval_sec
        self._injected = False

    def inject(self, page: Any) -> None:
        """Inject the pressure-tracking JavaScript into the page."""
        if self._injected:
            return
        try:
            page.evaluate(_INJECTION)
            self._injected = True
            LOGGER.info("[SocketPressure] Pressure tracker injected")
        except Exception as e:
            LOGGER.warning("[SocketPressure] Injection failed: %s", e)

    def measure_pressure(self, page: Any) -> dict[str, Any]:
        """Measure current WebSocket load and return a pressure snapshot.

        Returns
        -------
        dict
            - connection_count : total tracked WebSocket objects
            - active_connections : currently OPEN or CONNECTING
            - closed_connections : closed sockets still in the tracking map
            - memory_usage_mb : estimated JS heap used
            - message_rate : approximate msgs/sec across all connections
            - bytes_sent_total : total bytes sent since injection
            - bytes_received_total : total bytes received
            - pressure_level : "low" | "medium" | "high" | "critical"
            - history_samples : number of recorded samples
        """
        if not self._injected:
            self.inject(page)

        try:
            raw = page.evaluate(
                """
                (function() {
                    var history = window.__SOCKET_PRESSURE_HISTORY__ || [];
                    var active = window.__SOCKET_PRESSURE_ACTIVE__ || [];
                    var mem = (performance.memory || {}).usedJSHeapSize || 0;
                    var now = Date.now();

                    var totalSent = 0, totalRcvd = 0;
                    active.forEach(function(e) {
                        totalSent += e.bytes_sent;
                        totalRcvd += e.bytes_received;
                    });

                    // Message rate: sum msgs from latest sample
                    var latest = history.length > 0 ? history[history.length - 1] : null;
                    var msgRate = 0;
                    if (latest && latest.ts) {
                        var prev = history.length > 1 ? history[history.length - 2] : null;
                        if (prev) {
                            var dt = (latest.ts - prev.ts) / 1000;
                            if (dt > 0) {
                                var lMsgs = latest.active.reduce(function(s, e) { return s + e.messages_sent + e.messages_received; }, 0);
                                var pMsgs = prev.active.reduce(function(s, e) { return s + e.messages_sent + e.messages_received; }, 0);
                                msgRate = Math.max(0, (lMsgs - pMsgs) / dt);
                            }
                        }
                    }

                    return {
                        connection_count: active.length,
                        active_connections: active.filter(function(e) {
                            return e.readyState === WebSocket.OPEN || e.readyState === WebSocket.CONNECTING;
                        }).length,
                        closed_connections: active.filter(function(e) {
                            return e.readyState === WebSocket.CLOSED || e.readyState === WebSocket.CLOSING;
                        }).length,
                        memory_usage_bytes: mem,
                        memory_usage_mb: mem / (1024 * 1024),
                        bytes_sent_total: totalSent,
                        bytes_received_total: totalRcvd,
                        message_rate_per_sec: msgRate,
                        history_samples: history.length,
                        latest_sample_ts: latest ? latest.ts : null
                    };
                })();
                """
            )
        except Exception as e:
            LOGGER.warning("[SocketPressure] Measurement failed: %s", e)
            return self._empty_result()

        conn_count = raw.get("connection_count", 0)
        msg_rate = raw.get("message_rate_per_sec", 0.0)
        mem_mb = raw.get("memory_usage_mb", 0.0)

        pressure_level = self._classify_pressure(conn_count, msg_rate, mem_mb)

        result = dict(raw)
        result["pressure_level"] = pressure_level
        result["pressure_description"] = self._pressure_description(pressure_level)

        LOGGER.info(
            "[SocketPressure] connections=%d msg_rate=%.1f mem=%.1fMB level=%s",
            conn_count, msg_rate, mem_mb, pressure_level,
        )
        return result

    def get_connection_details(self, page: Any) -> list[dict[str, Any]]:
        """Return per-connection details for all tracked WebSocket connections."""
        try:
            raw = page.evaluate(
                """
                (function() {
                    return window.__SOCKET_PRESSURE_ACTIVE__ || [];
                })();
                """
            )
            if isinstance(raw, list):
                return raw
            return []
        except Exception as e:
            LOGGER.warning("[SocketPressure] Failed to get connection details: %s", e)
            return []

    # ─── Private helpers ────────────────────────────────────────────────────────

    @staticmethod
    def _classify_pressure(connections: int, msg_rate: float, mem_mb: float) -> str:
        if connections > 100 or msg_rate > 1000 or mem_mb > 800:
            return "critical"
        elif connections > 50 or msg_rate > 500 or mem_mb > 400:
            return "high"
        elif connections > 20 or msg_rate > 100 or mem_mb > 200:
            return "medium"
        return "low"

    @staticmethod
    def _pressure_description(level: str) -> str:
        return {
            "low": "Normal WebSocket activity — no pressure detected.",
            "medium": "Elevated connection count or message rate — monitor closely.",
            "high": "High WebSocket pressure — connections or message rate are stressed.",
            "critical": "Critical WebSocket pressure — system near collapse threshold.",
        }.get(level, "Unknown pressure level.")

    @staticmethod
    def _empty_result() -> dict[str, Any]:
        return {
            "connection_count": 0,
            "active_connections": 0,
            "closed_connections": 0,
            "memory_usage_mb": 0.0,
            "bytes_sent_total": 0,
            "bytes_received_total": 0,
            "message_rate_per_sec": 0.0,
            "history_samples": 0,
            "pressure_level": "unknown",
            "pressure_description": "",
        }
