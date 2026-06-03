from __future__ import annotations

import time

from tester_qa.stress.models import StressResult


class WebsocketStressTester:
    def simulate_reconnect_storm(self, url: str, clients: int = 25, reconnects: int = 3) -> StressResult:
        started = time.monotonic()
        total = max(0, clients) * max(0, reconnects)
        errors = []
        if not (url.startswith("ws://") or url.startswith("wss://")):
            errors.append("Invalid websocket URL. Expected ws:// or wss://.")
            return StressResult(url, "websocket_reconnect_storm", total, 0, total, int((time.monotonic() - started) * 1000), [], errors)
        return StressResult(url, "websocket_reconnect_storm_simulation", total, total, 0, int((time.monotonic() - started) * 1000), [0] * total, [])
