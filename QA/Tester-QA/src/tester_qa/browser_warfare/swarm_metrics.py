"""Swarm metrics and collapse point detection for distributed browser warfare."""
from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from threading import Lock
from typing import Any

LOGGER = logging.getLogger(__name__)


@dataclass
class BrowserMetrics:
    """Metrics collected for a single browser in the swarm."""

    browser_id: str = ""
    timestamp: float = 0.0
    memory_mb: float = 0.0
    dom_nodes: int = 0
    js_heap_used_mb: float = 0.0
    js_heap_total_mb: float = 0.0
    event_listeners: int = 0
    ws_connections: int = 0
    fps: float = 0.0
    status: str = "unknown"  # healthy | stressed | crashing | dead
    extra: dict[str, Any] = field(default_factory=dict)


class SwarmMetrics:
    """Collects and analyses metrics from a distributed browser swarm to detect collapse."""

    def __init__(self, collapse_threshold_pct: float = 0.8) -> None:
        self._metrics: dict[str, list[BrowserMetrics]] = defaultdict(list)
        self._lock = Lock()
        self._collapse_threshold_pct = collapse_threshold_pct
        self._tracked_browsers: set[str] = set()
        self._start_time: float = time.time()

    def track(self, browser_id: str, metrics: dict[str, Any]) -> None:
        """Record metrics for a browser at the current timestamp."""
        entry = BrowserMetrics(
            browser_id=browser_id,
            timestamp=time.time(),
            memory_mb=metrics.get("memory_mb", 0.0),
            dom_nodes=metrics.get("dom_nodes", 0),
            js_heap_used_mb=metrics.get("js_heap_used_mb", 0.0),
            js_heap_total_mb=metrics.get("js_heap_total_mb", 0.0),
            event_listeners=metrics.get("event_listeners", 0),
            ws_connections=metrics.get("ws_connections", 0),
            fps=metrics.get("fps", 0.0),
            status=metrics.get("status", "unknown"),
            extra=metrics.get("extra", {}),
        )
        with self._lock:
            self._metrics[browser_id].append(entry)
            self._tracked_browsers.add(browser_id)

    def track_from_page(self, browser_id: str, page: Any) -> None:
        """Convenience: snapshot metrics directly from a Playwright page object."""
        try:
            raw = page.evaluate(
                """
                (function() {
                    var mem = performance.memory || {};
                    return {
                        memory_mb: (mem.usedJSHeapSize || 0) / (1024 * 1024),
                        js_heap_used_mb: (mem.usedJSHeapSize || 0) / (1024 * 1024),
                        js_heap_total_mb: (mem.totalJSHeapSize || 0) / (1024 * 1024),
                        dom_nodes: document.querySelectorAll('*').length,
                        event_listeners: window.__EVENT_LISTENER_COUNT__ || 0,
                        ws_connections: window.__WS_CONNECTION_COUNT__ || 0,
                        fps: window.__FPS__ || 0,
                    };
                })();
                """
            )
            raw["status"] = self._classify_browser_status(raw)
            self.track(browser_id, raw)
        except Exception as e:
            LOGGER.warning("[SwarmMetrics] Failed to snapshot page for %s: %s", browser_id, e)

    def get_collapse_threshold(self) -> dict[str, Any]:
        """Return the estimated collapse thresholds based on collected metrics."""
        with self._lock:
            if not self._metrics:
                return {
                    "max_browsers_before_collapse": 10,
                    "max_ws_before_collapse": 100,
                    "max_memory_mb_per_browser": 500,
                    "collapse_likelihood": 0.0,
                    "healthy_browsers": 0,
                    "stressed_browsers": 0,
                    "crashing_browsers": 0,
                    "dead_browsers": 0,
                }

            statuses = self._compute_status_counts()
            total = sum(statuses.values())
            healthy = statuses.get("healthy", 0)
            stressed = statuses.get("stressed", 0)
            crashing = statuses.get("crashing", 0)
            dead = statuses.get("dead", 0)

            # Collapse likelihood: grows as more browsers enter stressed/crashing/dead
            ratio = 1.0 - (healthy / max(total, 1))
            collapse_likelihood = min(ratio, 1.0)

            # Estimate max browsers before collapse using the failure ratio
            if healthy == total:
                max_browsers = 50
            else:
                failure_ratio = (crashing + dead) / max(total, 1)
                max_browsers = max(1, int(healthy / max(failure_ratio, 0.01)))

            avg_heap = self._avg_heap_usage()
            max_memory = max(500.0, avg_heap * 2)

            return {
                "max_browsers_before_collapse": max_browsers,
                "max_ws_before_collapse": int(max_browsers * 10),
                "max_memory_mb_per_browser": round(max_memory, 1),
                "collapse_likelihood": round(collapse_likelihood, 3),
                "healthy_browsers": healthy,
                "stressed_browsers": stressed,
                "crashing_browsers": crashing,
                "dead_browsers": dead,
                "total_tracked": total,
                "avg_js_heap_used_mb": round(avg_heap, 2),
                "uptime_seconds": round(time.time() - self._start_time, 1),
            }

    def get_browser_survival_score(self) -> float:
        """Return an overall survival score (0.0 = all dead, 1.0 = all healthy)."""
        with self._lock:
            if not self._metrics:
                return 0.0

            statuses = self._compute_status_counts()
            total = sum(statuses.values())
            if total == 0:
                return 0.0

            # Weighted score: healthy=1.0, stressed=0.6, crashing=0.2, dead=0.0
            score = (
                statuses.get("healthy", 0) * 1.0
                + statuses.get("stressed", 0) * 0.6
                + statuses.get("crashing", 0) * 0.2
                + statuses.get("dead", 0) * 0.0
            )
            return round(score / total, 3)

    def get_browser_history(self, browser_id: str) -> list[dict[str, Any]]:
        """Return the full metric history for a specific browser."""
        with self._lock:
            return [
                {
                    "timestamp": m.timestamp,
                    "memory_mb": m.memory_mb,
                    "dom_nodes": m.dom_nodes,
                    "js_heap_used_mb": m.js_heap_used_mb,
                    "js_heap_total_mb": m.js_heap_total_mb,
                    "fps": m.fps,
                    "ws_connections": m.ws_connections,
                    "status": m.status,
                    "extra": m.extra,
                }
                for m in self._metrics.get(browser_id, [])
            ]

    def reset(self) -> None:
        """Clear all collected metrics."""
        with self._lock:
            self._metrics.clear()
            self._tracked_browsers.clear()
            self._start_time = time.time()

    # ─── Private helpers ────────────────────────────────────────────────────────

    def _classify_browser_status(self, raw: dict[str, Any]) -> str:
        """Classify browser health based on raw metrics."""
        heap_mb = raw.get("js_heap_used_mb", 0.0)
        dom_nodes = raw.get("dom_nodes", 0)
        fps = raw.get("fps", 60.0)
        ws = raw.get("ws_connections", 0)

        if fps < 5 or dom_nodes > 100_000 or heap_mb > 800:
            return "crashing"
        elif fps < 20 or dom_nodes > 50_000 or heap_mb > 400 or ws > 50:
            return "stressed"
        elif fps < 40 or dom_nodes > 20_000 or heap_mb > 200:
            return "stressed"
        return "healthy"

    def _compute_status_counts(self) -> dict[str, int]:
        """Aggregate the latest status of each browser."""
        counts: dict[str, int] = defaultdict(int)
        for browser_id, entries in self._metrics.items():
            if entries:
                latest = entries[-1]
                counts[latest.status] += 1
        return counts

    def _avg_heap_usage(self) -> float:
        """Average JS heap usage across the latest samples from all browsers."""
        total = 0.0
        n = 0
        for entries in self._metrics.values():
            if entries:
                total += entries[-1].js_heap_used_mb
                n += 1
        return total / max(n, 1)
