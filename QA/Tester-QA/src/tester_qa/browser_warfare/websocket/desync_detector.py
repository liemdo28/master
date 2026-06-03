"""WebSocket desync detector — detects message sequence gaps and protocol corruption.

Injects a JavaScript interceptor that assigns monotonically increasing sequence numbers
to all outbound WebSocket messages.  After collection it scans for missing sequences
to report desync events.
"""
from __future__ import annotations

import logging
from typing import Any

LOGGER = logging.getLogger(__name__)

_SEQUENCED_INJECTION = """
(function() {
    if (window.__DESYNC_INJECTED__) return;
    window.__DESYNC_INJECTED__ = true;

    window.__DESYNC_SEQUENCES__ = [];
    window.__DESYNC_NEXT_EXPECTED__ = 1;
    window.__DESYNC_GAPS__ = [];
    window.__DESYNC_CORRUPTIONS__ = 0;

    var _origWS = window.WebSocket;
    window.WebSocket = function(url, protocols) {
        var ws = new _origWS(url, protocols);
        var _origSend = ws.send.bind(ws);
        ws.send = function(data) {
            var seq = ++window.__DESYNC_NEXT_EXPECTED__;
            window.__DESYNC_SEQUENCES__.push(seq);
            _origSend(data);
        };
        // Detect received sequence anomalies by checking if a JSON message
        // has a missing seq field (application-layer protocol assumption)
        ws.addEventListener('message', function(ev) {
            try {
                var parsed = JSON.parse(ev.data);
                if (parsed && typeof parsed.seq === 'number') {
                    var expected = window.__DESYNC_NEXT_EXPECTED__;
                    if (parsed.seq !== expected && parsed.seq < expected - 1) {
                        window.__DESYNC_GAPS__.push({
                            expected: expected,
                            received: parsed.seq,
                            gap: expected - parsed.seq
                        });
                    }
                }
            } catch(e) {
                // Non-JSON messages count as potential corruptions
                window.__DESYNC_CORRUPTIONS__++;
            }
        });
        return ws;
    };
    window.WebSocket.prototype = _origWS.prototype;
    window.WebSocket.CONNECTING = _origWS.CONNECTING;
    window.WebSocket.OPEN = _origWS.OPEN;
    window.WebSocket.CLOSING = _origWS.CLOSING;
    window.WebSocket.CLOSED = _origWS.CLOSED;
})();
"""


class DesyncDetector:
    """Detects WebSocket message desynchronisation by monitoring sequence gaps."""

    def inject(self, page: Any) -> None:
        """Inject the desync-tracker JavaScript into the page."""
        try:
            page.evaluate(_SEQUENCED_INJECTION)
            LOGGER.info("[DesyncDetector] Desync tracer injected")
        except Exception as e:
            LOGGER.warning("[DesyncDetector] Injection failed: %s", e)

    def detect(self, page: Any) -> dict[str, Any]:
        """Detect desync events in the current page.

        Returns a dict with detected gaps, corruption count, and an overall verdict.
        """
        try:
            raw = page.evaluate(
                """
                (function() {
                    var seqs = window.__DESYNC_SEQUENCES__ || [];
                    var gaps = window.__DESYNC_GAPS__ || [];
                    var corruptions = window.__DESYNC_CORRUPTIONS__ || 0;
                    var next = window.__DESYNC_NEXT_EXPECTED__ || 0;
                    return { sequences: seqs, gaps: gaps, corruptions: corruptions, next_expected: next };
                })();
                """
            )
        except Exception as e:
            LOGGER.warning("[DesyncDetector] Failed to collect: %s", e)
            return {"desync_detected": False, "error": str(e), "gaps": [], "corruptions": 0}

        gaps: list[dict[str, Any]] = raw.get("gaps", [])
        corruptions: int = raw.get("corruptions", 0)
        sequences: list[int] = raw.get("sequences", [])

        # Structural gap: check if any outbound sequence numbers are missing
        structural_gap = False
        if len(sequences) > 1:
            sorted_seq = sorted(sequences)
            for i in range(1, len(sorted_seq)):
                if sorted_seq[i] - sorted_seq[i - 1] > 1:
                    structural_gap = True
                    break

        desync_detected = structural_gap or len(gaps) > 0 or corruptions > 0

        LOGGER.info(
            "[DesyncDetector] Desync=%s | structural_gap=%s | app_gaps=%d | corruptions=%d",
            desync_detected, structural_gap, len(gaps), corruptions,
        )

        return {
            "desync_detected": desync_detected,
            "structural_gap": structural_gap,
            "application_gaps": len(gaps),
            "corruptions": corruptions,
            "gaps": gaps[:100],  # cap to avoid huge payloads
            "total_sequences_sent": len(sequences),
            "next_expected_sequence": raw.get("next_expected", 0),
            "verdict": "DESYNC" if desync_detected else "OK",
        }

    def reset(self, page: Any) -> None:
        """Clear desync state in the page."""
        try:
            page.evaluate(
                """
                (function() {
                    if (window.__DESYNC_SEQUENCES__) window.__DESYNC_SEQUENCES__.length = 0;
                    if (window.__DESYNC_GAPS__) window.__DESYNC_GAPS__.length = 0;
                    window.__DESYNC_NEXT_EXPECTED__ = 1;
                    window.__DESYNC_CORRUPTIONS__ = 0;
                })();
                """
            )
        except Exception as e:
            LOGGER.warning("[DesyncDetector] Reset failed: %s", e)
