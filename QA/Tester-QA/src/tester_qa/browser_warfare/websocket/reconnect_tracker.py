"""Reconnect Tracker — detects and quantifies WebSocket reconnect storm patterns.

Monitors connection lifecycle events (open, close, error) to identify when a large
number of reconnections occur in rapid succession — a "reconnect storm" — which
is a common failure mode under WebSocket warfare attacks.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any

LOGGER = logging.getLogger(__name__)

_INJECTION = """
(function() {
    if (window.__RECONNECT_TRACKER_INJECTED__) return;
    window.__RECONNECT_TRACKER_INJECTED__ = true;

    window.__RECONNECT_EVENTS__ = [];   // { ts, conn_id, event }
    window.__RECONNECT_STORM_THRESHOLD__ = 10;   // reconnects per window to flag storm
    window.__RECONNECT_STORM_WINDOW_MS__ = 5000;  // window size in ms

    var _origWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        var connId = 'rt-' + Math.random().toString(36).substr(2, 9);
        var ws = new _origWS(url, protocols);
        ws.__conn_id__ = connId;

        function logEvent(event) {
            window.__RECONNECT_EVENTS__.push({
                ts: Date.now(),
                conn_id: connId,
                url: url,
                event: event,
                readyState: ws.readyState
            });
            // Keep log bounded
            if (window.__RECONNECT_EVENTS__.length > 5000) {
                window.__RECONNECT_EVENTS__.splice(0, 1000);
            }
        }

        ws.addEventListener('open',    function() { logEvent('open'); });
        ws.addEventListener('close',   function() { logEvent('close'); });
        ws.addEventListener('error',    function() { logEvent('error'); });

        return ws;
    };
    window.WebSocket.prototype = _origWS.prototype;
    Object.keys(_origWS).forEach(function(k) {
        try { window.WebSocket[k] = _origWS[k]; } catch(e) {}
    });
})();
"""


@dataclass
class ReconnectStormEvent:
    """A detected reconnect storm window."""

    start_ts: float
    end_ts: float
    reconnect_count: int
    storm_events: list[dict[str, Any]] = field(default_factory=list)


class ReconnectTracker:
    """Tracks WebSocket reconnect events and identifies storm patterns."""

    def __init__(
        self,
        storm_threshold: int = 10,
        storm_window_ms: int = 5000,
    ) -> None:
        self._storm_threshold = storm_threshold
        self._storm_window_ms = storm_window_ms
        self._injected = False
        self._tracked_storms: list[ReconnectStormEvent] = []

    def inject(self, page: Any) -> None:
        """Inject the reconnect-tracker JavaScript into the page."""
        if self._injected:
            return
        try:
            page.evaluate(_INJECTION)
            self._injected = True
            LOGGER.info(
                "[ReconnectTracker] Injected (threshold=%d, window=%dms)",
                self._storm_threshold, self._storm_window_ms,
            )
        except Exception as e:
            LOGGER.warning("[ReconnectTracker] Injection failed: %s", e)

    def track_reconnects(self, page: Any) -> dict[str, Any]:
        """Collect reconnect event data and analyse for storm patterns.

        Returns a dict containing:
        - reconnect_count : total close+error events
        - open_count      : total successful open events
        - error_count     : total error events
        - storm_detected  : bool
        - storm_count     : number of distinct storm windows found
        - storms          : list of storm windows with details
        - storm_events    : all events in the current window
        """
        if not self._injected:
            self.inject(page)

        try:
            raw = page.evaluate(
                """
                (function() {
                    var events = window.__RECONNECT_EVENTS__ || [];
                    var now = Date.now();
                    var windowMs = window.__RECONNECT_STORM_WINDOW_MS__ || 5000;
                    var threshold = window.__RECONNECT_STORM_THRESHOLD__ || 10;

                    // Count close + error events in the storm window
                    var windowStart = now - windowMs;
                    var recent = events.filter(function(e) { return e.ts >= windowStart; });
                    var closes = recent.filter(function(e) { return e.event === 'close'; }).length;
                    var errors = recent.filter(function(e) { return e.event === 'error'; }).length;
                    var opens  = recent.filter(function(e) { return e.event === 'open'; }).length;

                    return {
                        all_events: events.slice(-500),   // last 500 events
                        recent_events: recent,
                        total_reconnects: closes + errors,
                        total_closes: closes,
                        total_errors: errors,
                        total_opens: opens,
                        storm_detected: (closes + errors) >= threshold,
                        threshold: threshold,
                        window_ms: windowMs
                    };
                })();
                """
            )
        except Exception as e:
            LOGGER.warning("[ReconnectTracker] Failed to track: %s", e)
            return self._empty_result()

        all_events: list[dict[str, Any]] = raw.get("all_events", [])
        recent_events: list[dict[str, Any]] = raw.get("recent_events", [])
        total_reconnects = raw.get("total_reconnects", 0)
        storm_detected: bool = raw.get("storm_detected", False)
        storm_count = self._analyse_storm_windows(recent_events)

        result = {
            "reconnect_count": total_reconnects,
            "close_count": raw.get("total_closes", 0),
            "error_count": raw.get("total_errors", 0),
            "open_count": raw.get("total_opens", 0),
            "storm_detected": storm_detected or storm_count > 0,
            "storm_count": storm_count,
            "storms": [self._storm_summary(s) for s in self._tracked_storms[-10:]],
            "recent_events": recent_events[-50:],  # cap for readability
            "threshold": self._storm_threshold,
            "window_ms": self._storm_window_ms,
            "verdict": "STORM" if (storm_detected or storm_count > 0) else "OK",
        }

        LOGGER.info(
            "[ReconnectTracker] reconnects=%d storm=%s storm_count=%d",
            total_reconnects, result["storm_detected"], storm_count,
        )
        return result

    def get_all_events(self, page: Any) -> list[dict[str, Any]]:
        """Return the full raw event log."""
        try:
            raw = page.evaluate("return window.__RECONNECT_EVENTS__ || [];")
            if isinstance(raw, list):
                return raw[-500:]
            return []
        except Exception as e:
            LOGGER.warning("[ReconnectTracker] Failed to get events: %s", e)
            return []

    def reset(self, page: Any) -> None:
        """Clear the event log in the page."""
        try:
            page.evaluate("window.__RECONNECT_EVENTS__ = [];")
            self._tracked_storms.clear()
        except Exception as e:
            LOGGER.warning("[ReconnectTracker] Reset failed: %s", e)

    # ─── Private helpers ────────────────────────────────────────────────────────

    def _analyse_storm_windows(self, events: list[dict[str, Any]]) -> int:
        """Detect distinct storm windows and store them."""
        if not events:
            return 0

        storm_events = [e for e in events if e.get("event") in ("close", "error")]
        if len(storm_events) < self._storm_threshold:
            return 0

        storm_count = 0
        window_start: float | None = None
        current_batch: list[dict[str, Any]] = []

        for event in sorted(storm_events, key=lambda e: e.get("ts", 0)):
            ts = event.get("ts", 0)
            if window_start is None:
                window_start = ts
                current_batch = [event]
            elif ts - window_start <= self._storm_window_ms:
                current_batch.append(event)
            else:
                if len(current_batch) >= self._storm_threshold:
                    self._tracked_storms.append(
                        ReconnectStormEvent(
                            start_ts=window_start,
                            end_ts=current_batch[-1].get("ts", window_start),
                            reconnect_count=len(current_batch),
                            storm_events=list(current_batch),
                        )
                    )
                    storm_count += 1
                window_start = ts
                current_batch = [event]

        # Flush final window
        if len(current_batch) >= self._storm_threshold:
            self._tracked_storms.append(
                ReconnectStormEvent(
                    start_ts=window_start or 0,
                    end_ts=current_batch[-1].get("ts", window_start or 0),
                    reconnect_count=len(current_batch),
                    storm_events=list(current_batch),
                )
            )
            storm_count += 1

        return storm_count

    @staticmethod
    def _storm_summary(storm: ReconnectStormEvent) -> dict[str, Any]:
        return {
            "start_ts": storm.start_ts,
            "end_ts": storm.end_ts,
            "duration_ms": storm.end_ts - storm.start_ts,
            "reconnect_count": storm.reconnect_count,
            "affected_connections": len(set(e.get("conn_id") for e in storm.storm_events)),
        }

    @staticmethod
    def _empty_result() -> dict[str, Any]:
        return {
            "reconnect_count": 0,
            "close_count": 0,
            "error_count": 0,
            "open_count": 0,
            "storm_detected": False,
            "storm_count": 0,
            "storms": [],
            "recent_events": [],
            "verdict": "OK",
        }
