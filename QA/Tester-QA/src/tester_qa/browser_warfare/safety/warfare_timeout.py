"""Timeout enforcement for warfare executions."""
from __future__ import annotations

import logging
import time
from typing import Optional

logger = logging.getLogger(__name__)


class WarfareTimeout:
    """Tracks and enforces per-task execution timeouts."""

    def __init__(self, max_seconds: int = 120) -> None:
        self.max_seconds = max_seconds
        self._task_start: dict[str, float] = {}

    def start(self, task_id: str) -> None:
        """Start tracking a task by ID."""
        self._task_start[task_id] = time.monotonic()
        logger.debug("[WarfareTimeout] Started task %s (max %.0fs)", task_id, self.max_seconds)

    def check(self, task_id: str) -> bool:
        """Check if a task is still within its time limit.

        Args:
            task_id: The task identifier.

        Returns:
            True if the task is still valid (within time limit),
            False if it has exceeded the limit.
        """
        started_at = self._task_start.get(task_id)
        if started_at is None:
            logger.warning("[WarfareTimeout] Unknown task %s — treating as expired", task_id)
            return False

        elapsed = time.monotonic() - started_at
        if elapsed > self.max_seconds:
            logger.warning(
                "[WarfareTimeout] Task %s expired (%.1fs > %.0fs)",
                task_id,
                elapsed,
                self.max_seconds,
            )
            return False
        return True

    def terminate(self, task_id: str) -> None:
        """Remove a task from tracking (e.g., after normal completion)."""
        self._task_start.pop(task_id, None)
        logger.debug("[WarfareTimeout] Terminated task %s", task_id)

    def elapsed(self, task_id: str) -> Optional[float]:
        """Return seconds elapsed for a task, or None if not tracked."""
        started_at = self._task_start.get(task_id)
        if started_at is None:
            return None
        return time.monotonic() - started_at
