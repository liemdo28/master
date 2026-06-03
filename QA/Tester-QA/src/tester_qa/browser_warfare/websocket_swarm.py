"""WebSocket Swarm module — floods the browser with websocket chaos."""
from __future__ import annotations

import base64
import json
import random
import time
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class WebSocketSwarmConfig:
    connections: int = 50
    messages_per_connection: int = 100
    reconnect_interval_ms: int = 100
    corrupt_ratio: float = 0.3
    payload_size_bytes: int = 4096


@dataclass
class WebSocketSwarmResult:
    connections_opened: int = 0
    messages_sent: int = 0
    reconnects_triggered: int = 0
    corrupt_messages: int = 0
    details: dict[str, Any] = field(default_factory=dict)


class WebSocketSwarm:
    """Launches a swarm of WebSocket connections and messages to overwhelm the browser."""

    def __init__(self, config: WebSocketSwarmConfig | None = None) -> None:
        self.config = config or WebSocketSwarmConfig()

    def launch_swarm(self, page: Any, url: str) -> WebSocketSwarmResult:
        """Launch a swarm of WebSocket connections from the browser."""
        result = WebSocketSwarmResult()
        js = f"""
        (function() {{
            var url = '{url}';
            var connections = {self.config.connections};
            var msgsPerConn = {self.config.messages_per_connection};
            var corruptRatio = {self.config.corrupt_ratio};
            var payloadSize = {self.config.payload_size_bytes};
            var opened = 0;
            var sent = 0;
            var corrupted = 0;

            function makePayload(size) {{
                var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                var result = '';
                for (var i = 0; i < size; i++) {{
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }}
                return result;
            }}

            for (var c = 0; c < connections; c++) {{
                try {{
                    var ws = new WebSocket(url);
                    ws.onopen = function() {{
                        opened++;
                        for (var m = 0; m < msgsPerConn; m++) {{
                            var isCorrupt = Math.random() < corruptRatio;
                            var payload = makePayload(payloadSize);
                            if (isCorrupt) {{
                                ws.send('{{"corrupted": true, "data": "' + payload + '"}}');
                                corrupted++;
                            }} else {{
                                ws.send('{{"msg": "' + payload + '"}}');
                            }}
                            sent++;
                        }}
                        setTimeout(function() {{ ws.close(); }}, 50);
                    }};
                    ws.onerror = function() {{}};
                }} catch(e) {{}}
            }}
            window.__WS_SWARM_RESULT__ = {{opened: opened, sent: sent, corrupted: corrupted}};
        }})();
        """
        page.evaluate(js)
        time.sleep(2)
        raw = page.evaluate("return window.__WS_SWARM_RESULT__;")
        if raw:
            result.connections_opened = raw.get("opened", 0)
            result.messages_sent = raw.get("sent", 0)
            result.corrupt_messages = raw.get("corrupted", 0)
        result.details = {
            "config": {
                "connections": self.config.connections,
                "messages_per_connection": self.config.messages_per_connection,
                "corrupt_ratio": self.config.corrupt_ratio,
            },
            "url": url,
        }
        return result

    def trigger_reconnect_storm(self, page: Any, url: str) -> WebSocketSwarmResult:
        """Trigger a reconnect storm by repeatedly closing and reopening connections."""
        result = WebSocketSwarmResult()
        result.reconnects_triggered = self.config.connections * 5
        js = f"""
        (function() {{
            var url = '{url}';
            var storm = {self.config.connections * 5};
            for (var i = 0; i < storm; i++) {{
                (function(index) {{
                    try {{
                        var ws = new WebSocket(url);
                        ws.onopen = function() {{
                            setTimeout(function() {{
                                ws.close();
                            }}, 10);
                        }};
                        ws.onerror = function() {{}};
                    }} catch(e) {{}}
                }})(i);
            }}
        }})();
        """
        page.evaluate(js)
        result.details = {
            "strategy": "reconnect_storm",
            " reconnects_planned": storm,
            "url": url,
        }
        return result

    def flood_with_messages(self, page: Any, url: str) -> WebSocketSwarmResult:
        """Flood a single WebSocket connection with a massive message backlog."""
        result = WebSocketSwarmResult()
        total = self.config.connections * self.config.messages_per_connection
        payload = "X" * self.config.payload_size_bytes
        js = f"""
        (function() {{
            var url = '{url}';
            var total = {total};
            var payload = '{payload}';
            var sent = 0;
            var corrupted = 0;
            try {{
                var ws = new WebSocket(url);
                ws.onopen = function() {{
                    for (var i = 0; i < total; i++) {{
                        if (i % 3 === 0) {{
                            ws.send('{{"corrupt": true, "seq": ' + i + '}}');
                            corrupted++;
                        }} else {{
                            ws.send('{{"seq": ' + i + ', "data": "' + payload + '"}}');
                        }}
                        sent++;
                    }}
                    setTimeout(function() {{ ws.close(); }}, 100);
                }};
                ws.onerror = function() {{}};
            }} catch(e) {{}}
            window.__WS_FLOOD_RESULT__ = {{sent: sent, corrupted: corrupted}};
        }})();
        """
        page.evaluate(js)
        time.sleep(2)
        raw = page.evaluate("return window.__WS_FLOOD_RESULT__;")
        if raw:
            result.messages_sent = raw.get("sent", 0)
            result.corrupt_messages = raw.get("corrupted", 0)
        result.details = {
            "strategy": "flood_with_messages",
            "total_messages": total,
        }
        return result

    def corrupt_websocket_state(self, page: Any) -> WebSocketSwarmResult:
        """Corrupt the internal WebSocket state objects in the browser."""
        result = WebSocketSwarmResult()
        page.evaluate(
            """
            (function() {
                window.__WS_INTERNAL_STATE__ = {
                    readyState: WebSocket.CONNECTING,
                    protocol: 'corrupted-protocol',
                    url: 'ws://corrupted.invalid/path'
                };
                window.__WS_MESSAGE_BUFFER__ = [];
                for (var i = 0; i < 1000; i++) {
                    window.__WS_MESSAGE_BUFFER__.push({
                        id: i,
                        data: 'CORRUPTED_MESSAGE_DATA_' + i,
                        timestamp: null
                    });
                }
                window.__WS_RECONNECT_COUNT__ = 9999;
                window.__WS_ERROR_STACK__ = 'Corrupted WebSocket state injected';
            })();
            """
        )
        result.state_corruptions = 4
        result.details = {
            "strategy": "corrupt_websocket_state",
        }
        return result
