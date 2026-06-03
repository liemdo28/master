"""Queue protection helpers for final hardening."""
from __future__ import annotations

from typing import Any


class QueueProtection:
    """Protect ingestion/execution queues from runaway backlog and retries."""

    def check_queue_depth(self, depth: int, threshold: int = 1000) -> dict[str, Any]:
        """Evaluate queue depth against a safety threshold."""
        exceeded = depth > threshold
        return {
            "ok": not exceeded,
            "depth": depth,
            "threshold": threshold,
            "exceeded": exceeded,
            "action": "pause_ingestion" if exceeded else "continue",
        }

    def enforce_retry_boundaries(self, retry_count: int, max_retries: int = 10) -> dict[str, Any]:
        """Evaluate retry count against a maximum retry boundary."""
        exceeded = retry_count > max_retries
        return {
            "ok": not exceeded,
            "retry_count": retry_count,
            "max_retries": max_retries,
            "exceeded": exceeded,
            "action": "dead_letter" if exceeded else "retry_allowed",
        }

    def should_pause_ingestion(self, metrics: dict[str, Any]) -> bool:
        """Return True when queue metrics indicate ingestion should pause."""
        depth = int(metrics.get("queue_depth", metrics.get("depth", 0)) or 0)
        threshold = int(metrics.get("threshold", metrics.get("queue_threshold", 1000)) or 1000)
        retry_count = int(metrics.get("retry_count", 0) or 0)
        max_retries = int(metrics.get("max_retries", 10) or 10)
        error_rate = float(metrics.get("error_rate", 0.0) or 0.0)
        max_error_rate = float(metrics.get("max_error_rate", 0.5) or 0.5)

        return (
            self.check_queue_depth(depth, threshold)["exceeded"]
            or self.enforce_retry_boundaries(retry_count, max_retries)["exceeded"]
            or error_rate > max_error_rate
        )
