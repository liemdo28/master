from __future__ import annotations

import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from tester_qa.stress.models import StressResult


class HttpStressTester:
    def run(self, url: str, requests: int = 20, concurrency: int = 5, timeout_seconds: int = 5) -> StressResult:
        started = time.monotonic()
        latencies: list[int] = []
        errors: list[str] = []
        success = 0

        def one() -> tuple[bool, int, str]:
            item_started = time.monotonic()
            try:
                with urllib.request.urlopen(url, timeout=timeout_seconds) as response:
                    response.read()
                    latency = int((time.monotonic() - item_started) * 1000)
                    return response.status < 500, latency, "" if response.status < 500 else f"HTTP {response.status}"
            except (urllib.error.URLError, TimeoutError) as exc:
                return False, int((time.monotonic() - item_started) * 1000), str(exc)

        with ThreadPoolExecutor(max_workers=max(1, concurrency)) as pool:
            futures = [pool.submit(one) for _ in range(max(0, requests))]
            for future in as_completed(futures):
                ok, latency, error = future.result()
                latencies.append(latency)
                if ok:
                    success += 1
                elif error:
                    errors.append(error)
        duration_ms = int((time.monotonic() - started) * 1000)
        return StressResult(url, "http_concurrency", requests, success, requests - success, duration_ms, latencies, errors[:20])
