"""WebSocket intelligence collector for browser warfare.

Captures, decorates, and analyses all WebSocket traffic in a browser page during
a warfare attack to build evidence of corruption, desync, and reconnect storms.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

LOGGER = logging.getLogger(__name__)

# Maximum packets to retain per analysis session to avoid unbounded memory growth
_MAX_PACKETS = 5000


@dataclass
class WSPacket:
    """A single captured WebSocket message."""

    timestamp: str
    direction: str  # "sent" | "received"
    size_bytes: int
    payload_preview: str
    is_corrupt: bool
    connection_id: str = ""
    sequence: int = 0


@dataclass
class WSAnalysis:
    """Aggregated WebSocket intelligence from a warfare session."""

    total_sent: int = 0
    total_received: int = 0
    corrupt_packets: int = 0
    reconnect_count: int = 0
    desync_detected: bool = False
    stale_sockets: int = 0
    packets: list[WSPacket] = field(default_factory=list)
    summary: dict[str, Any] = field(default_factory=dict)


class WebSocketIntelligence:
    """Injects a WebSocket interceptor into the page and collects traffic intelligence."""

    def __init__(self, max_packets: int = _MAX_PACKETS) -> None:
        self._max_packets = max_packets
        self._injected = False

    def inject_tracer(self, page: Any) -> None:
        """Inject JavaScript WebSocket interceptor into the page.

        Monkey-patches `WebSocket` to capture all outbound/inbound messages,
        detect corruption, and track connection lifecycle.
        """
        if self._injected:
            return

        js = """
        (function() {
            if (window.__WS_INTEL_INJECTED__) return;
            window.__WS_INTEL_INJECTED__ = true;

            // ── Packet log ────────────────────────────────────────────────────
            window.__WS_PACKETS__ = [];
            window.__WS_SEQ_COUNTER__ = 0;
            window.__WS_CORRUPT_COUNT__ = 0;
            window.__WS_RECONNECT_COUNT__ = 0;
            window.__WS_STALE_SOCKETS__ = [];

            // ── Capture original WebSocket ────────────────────────────────────
            var OriginalWS = window.WebSocket;
            var _activeSockets = new Map();

            window.WebSocket = function(url, protocols) {
                var connId = 'ws-' + Math.random().toString(36).substr(2, 9);
                var self = new OriginalWS(url, protocols);
                _activeSockets.set(connId, { url: url, readyState: self.readyState, created: Date.now() });
                self.__ws_conn_id__ = connId;

                // ── Intercept send ────────────────────────────────────────────
                var _origSend = self.send.bind(self);
                self.send = function(data) {
                    try {
                        var s = typeof data === 'string' ? data : JSON.stringify(data);
                        var size = new Blob([s]).size;
                        var preview = s.substring(0, 120);
                        var corrupt = false;
                        try { JSON.parse(s); } catch(e) { corrupt = true; }
                        window.__WS_PACKETS__.push({
                            timestamp: new Date().toISOString(),
                            direction: 'sent',
                            size_bytes: size,
                            payload_preview: preview,
                            is_corrupt: corrupt,
                            connection_id: connId,
                            sequence: ++window.__WS_SEQ_COUNTER__
                        });
                        if (corrupt) window.__WS_CORRUPT_COUNT__++;
                    } catch(e) {}
                    return _origSend(data);
                };

                // ── Intercept message ─────────────────────────────────────────
                self.addEventListener('message', function(ev) {
                    try {
                        var s = typeof ev.data === 'string' ? ev.data : JSON.stringify(ev.data);
                        var size = new Blob([s]).size;
                        var preview = s.substring(0, 120);
                        var corrupt = false;
                        try { JSON.parse(s); } catch(e) { corrupt = true; }
                        window.__WS_PACKETS__.push({
                            timestamp: new Date().toISOString(),
                            direction: 'received',
                            size_bytes: size,
                            payload_preview: preview,
                            is_corrupt: corrupt,
                            connection_id: connId,
                            sequence: ++window.__WS_SEQ_COUNTER__
                        });
                        if (corrupt) window.__WS_CORRUPT_COUNT__++;
                    } catch(e) {}
                });

                // ── Track stale sockets (no activity for 10 s) ───────────────
                var activityTimer = setInterval(function() {
                    try {
                        if (self.readyState === WebSocket.OPEN || self.readyState === WebSocket.CONNECTING) {
                            var age = (Date.now() - (_activeSockets.get(connId).created || 0)) / 1000;
                            if (age > 10 && self.readyState !== WebSocket.OPEN) {
                                if (!window.__WS_STALE_SOCKETS__.includes(connId)) {
                                    window.__WS_STALE_SOCKETS__.push(connId);
                                }
                            }
                        }
                    } catch(e) {}
                }, 5000);

                // ── Detect reconnect storm ─────────────────────────────────────
                self.addEventListener('close', function() {
                    window.__WS_RECONNECT_COUNT__++;
                    clearInterval(activityTimer);
                });
                self.addEventListener('error', function() {
                    window.__WS_RECONNECT_COUNT__++;
                });

                return self;
            };
            window.WebSocket.CONNECTING = OriginalWS.CONNECTING;
            window.WebSocket.OPEN = OriginalWS.OPEN;
            window.WebSocket.CLOSING = OriginalWS.CLOSING;
            window.WebSocket.CLOSED = OriginalWS.CLOSED;
            window.WebSocket.prototype = OriginalWS.prototype;
        })();
        """
        page.evaluate(js)
        self._injected = True
        LOGGER.info("[WS-Intelligence] WebSocket tracer injected")

    def collect(self, page: Any) -> WSAnalysis:
        """Collect and analyse WebSocket data from the page.

        Returns a ``WSAnalysis`` with aggregated traffic stats and up to
        ``max_packets`` captured messages.
        """
        analysis = WSAnalysis()

        try:
            raw = page.evaluate(
                """
                (function() {
                    var packets = (window.__WS_PACKETS__ || []).slice(-5000);
                    return {
                        packets: packets,
                        total_sent: packets.filter(function(p) { return p.direction === 'sent'; }).length,
                        total_received: packets.filter(function(p) { return p.direction === 'received'; }).length,
                        corrupt_count: window.__WS_CORRUPT_COUNT__ || 0,
                        reconnect_count: window.__WS_RECONNECT_COUNT__ || 0,
                        stale_sockets: window.__WS_STALE_SOCKETS__ || [],
                        seq_counter: window.__WS_SEQ_COUNTER__ || 0,
                    };
                })();
                """
            )
        except Exception as e:
            LOGGER.warning("[WS-Intelligence] Failed to collect data: %s", e)
            return analysis

        analysis.total_sent = raw.get("total_sent", 0)
        analysis.total_received = raw.get("total_received", 0)
        analysis.corrupt_packets = raw.get("corrupt_count", 0)
        analysis.reconnect_count = raw.get("reconnect_count", 0)
        analysis.stale_sockets = len(raw.get("stale_sockets", []))
        analysis.desync_detected = self._detect_desync(raw.get("packets", []))

        raw_packets = raw.get("packets", [])[: self._max_packets]
        for p in raw_packets:
            analysis.packets.append(
                WSPacket(
                    timestamp=p.get("timestamp", ""),
                    direction=p.get("direction", ""),
                    size_bytes=p.get("size_bytes", 0),
                    payload_preview=p.get("payload_preview", ""),
                    is_corrupt=p.get("is_corrupt", False),
                    connection_id=p.get("connection_id", ""),
                    sequence=p.get("sequence", 0),
                )
            )

        analysis.summary = {
            "injection_active": self._injected,
            "packets_captured": len(analysis.packets),
            "total_messages": analysis.total_sent + analysis.total_received,
            "corrupt_ratio": (
                round(analysis.corrupt_packets / max(analysis.total_sent + analysis.total_received, 1), 4)
                if (analysis.total_sent + analysis.total_received) > 0
                else 0.0
            ),
            "message_rate_per_sec": self._compute_message_rate(raw.get("packets", [])),
            "capture_time": datetime.now(timezone.utc).isoformat(),
        }

        LOGGER.info(
            "[WS-Intelligence] Collected %d sent / %d received, %d corrupt, %d reconnects",
            analysis.total_sent, analysis.total_received, analysis.corrupt_packets, analysis.reconnect_count,
        )
        return analysis

    # ─── Private helpers ────────────────────────────────────────────────────────

    def _detect_desync(self, packets: list[dict[str, Any]]) -> bool:
        """Detect sequence-number gaps indicating a desync event."""
        sequences = [p.get("sequence", 0) for p in packets if p.get("sequence", 0) > 0]
        if len(sequences) < 2:
            return False
        # Sort by sequence to check for gaps
        sorted_seq = sorted(sequences)
        for i in range(1, len(sorted_seq)):
            if sorted_seq[i] - sorted_seq[i - 1] > 1:
                return True
        return False

    def _compute_message_rate(self, packets: list[dict[str, Any]]) -> float:
        """Approximate messages-per-second rate."""
        if not packets:
            return 0.0
        try:
            timestamps = [datetime.fromisoformat(p["timestamp"].replace("Z", "+00:00")) for p in packets if p.get("timestamp")]
            if len(timestamps) < 2:
                return 0.0
            duration = (max(timestamps) - min(timestamps)).total_seconds()
            if duration <= 0:
                return 0.0
            return round(len(packets) / duration, 2)
        except Exception:
            return 0.0
