"""
Refresh Storm — simulate browser F5 refresh attacks.
Detects: server degradation under rapid refresh load, cache invalidation storms.
"""
from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from typing import Any
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

from tester_qa.core.event_bus import EventBus, EventType

LOGGER = logging.getLogger(__name__)

# Safety boundaries
MAX_CLIENTS = 500
MAX_DURATION_SECONDS = 120
MIN_INTERVAL_MS = 50


@dataclass
class RefreshResult:
    total_refreshes: int = 0
    successful: int = 0
    errors: int = 0
    server_errors_5xx: int = 0
    client_errors_4xx: int = 0
    timeouts: int = 0
    avg_response_time_ms: float = 0.0
    max_response_time_ms: float = 0.0
    min_response_time_ms: float = float("inf")
    cache_hits: int = 0
    cache_misses: int = 0
    duration_seconds: float = 0.0
    error_details: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "total_refreshes": self.total_refreshes,
            "successful": self.successful,
            "errors": self.errors,
            "server_errors_5xx": self.server_errors_5xx,
            "client_errors_4xx": self.client_errors_4xx,
            "timeouts": self.timeouts,
            "avg_response_time_ms": round(self.avg_response_time_ms, 2),
            "max_response_time_ms": round(self.max_response_time_ms, 2),
            "min_response_time_ms": round(self.min_response_time_ms, 2) if self.min_response_time_ms != float("inf") else 0.0,
            "cache_hits": self.cache_hits,
            "cache_misses": self.cache_misses,
            "duration_seconds": round(self.duration_seconds, 2),
            "error_details": self.error_details[:20],
        }


class RefreshStorm:
    """
    Simulate browser refresh storms (F5 attacks).

    Detects:
    - Server degradation under refresh load
    - Cache invalidation storms
    - 5xx error spikes
    - Response time degradation
    """

    def __init__(self) -> None:
        self._bus = EventBus.get_instance()
        self._running = False
        self._result = RefreshResult()
        self._response_times: list[float] = []

    def storm(
        self,
        url: str,
        clients: int = 50,
        refresh_interval_ms: int = 100,
        duration_seconds: float = 30.0,
        timeout_seconds: float = 10.0,
    ) -> RefreshResult:
        """
        Launch a refresh storm against a URL.

        Args:
            url: Target URL to refresh
            clients: Number of concurrent clients
            refresh_interval_ms: Milliseconds between refreshes per client
            duration_seconds: Total storm duration
            timeout_seconds: HTTP request timeout
        """
        clients = min(clients, MAX_CLIENTS)
        refresh_interval_ms = max(refresh_interval_ms, MIN_INTERVAL_MS)
        duration_seconds = min(duration_seconds, MAX_DURATION_SECONDS)

        self._running = True
        self._result = RefreshResult()
        self._response_times = []

        start = time.time()

        self._bus.emit(
            EventType.RUNTIME_SPIKE,
            "stress.refresh_storm",
            {"url": url, "clients": clients, "interval_ms": refresh_interval_ms},
        )

        with ThreadPoolExecutor(max_workers=clients) as executor:
            futures = []
            for i in range(clients):
                future = executor.submit(
                    self._client_loop, url, i, refresh_interval_ms, duration_seconds, timeout_seconds
                )
                futures.append(future)

            # Wait for all clients to finish
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    if len(self._result.error_details) < 20:
                        self._result.error_details.append(f"Client error: {e}")

        self._result.duration_seconds = time.time() - start
        self._running = False

        # Calculate averages
        if self._response_times:
            self._result.avg_response_time_ms = sum(self._response_times) / len(self._response_times)
            self._result.max_response_time_ms = max(self._response_times)
            self._result.min_response_time_ms = min(self._response_times)

        # Emit degradation event if error rate is high
        if self._result.total_refreshes > 0:
            error_rate = self._result.errors / self._result.total_refreshes
            if error_rate > 0.1:
                self._bus.emit(
                    EventType.RUNTIME_DEGRADED,
                    "stress.refresh_storm",
                    {
                        "error_rate": round(error_rate, 4),
                        "5xx_count": self._result.server_errors_5xx,
                        "avg_response_ms": self._result.avg_response_time_ms,
                    },
                )

        return self._result

    def _client_loop(
        self,
        url: str,
        client_id: int,
        interval_ms: int,
        duration: float,
        timeout: float,
    ) -> None:
        """Single client performing rapid refreshes."""
        end_time = time.time() + duration
        interval_sec = interval_ms / 1000.0

        while time.time() < end_time and self._running:
            self._do_refresh(url, client_id, timeout)
            time.sleep(interval_sec)

    def _do_refresh(self, url: str, client_id: int, timeout: float) -> None:
        """Perform a single HTTP GET (simulating browser refresh)."""
        self._result.total_refreshes += 1

        try:
            req = Request(url, headers={
                "User-Agent": f"Tester-QA/RefreshStorm client-{client_id}",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
            })

            start = time.time()
            response = urlopen(req, timeout=timeout)
            elapsed_ms = (time.time() - start) * 1000
            self._response_times.append(elapsed_ms)

            status = response.status
            headers = dict(response.headers)

            if status >= 200 and status < 400:
                self._result.successful += 1

            # Detect cache behavior
            cache_header = headers.get("X-Cache", headers.get("x-cache", ""))
            if "HIT" in cache_header.upper():
                self._result.cache_hits += 1
            else:
                self._result.cache_misses += 1

            response.close()

        except HTTPError as e:
            elapsed_ms = (time.time() - start) * 1000 if 'start' in dir() else 0
            self._response_times.append(elapsed_ms)
            self._result.errors += 1

            if e.code >= 500:
                self._result.server_errors_5xx += 1
            elif e.code >= 400:
                self._result.client_errors_4xx += 1

            if len(self._result.error_details) < 20:
                self._result.error_details.append(f"HTTP {e.code}: {url}")

        except URLError as e:
            self._result.errors += 1
            if "timed out" in str(e.reason).lower():
                self._result.timeouts += 1
            if len(self._result.error_details) < 20:
                self._result.error_details.append(f"URLError: {e.reason}")

        except Exception as e:
            self._result.errors += 1
            if len(self._result.error_details) < 20:
                self._result.error_details.append(f"{type(e).__name__}: {e}")

    def stop(self) -> None:
        """Halt the refresh storm."""
        self._running = False

    def get_results(self) -> dict[str, Any]:
        """Get storm results."""
        return self._result.to_dict()
