"""Emergency shutdown for runaway browser warfare."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class EmergencyShutdown:
    """Handles emergency shutdown of runaway browser warfare sessions."""

    def __init__(self) -> None:
        self._active: bool = False
        self._history: list[dict[str, Any]] = []
        self._triggered_at: float = 0.0
        self._reason: str = ""

    def trigger(self, reason: str) -> dict[str, Any]:
        """Trigger an emergency shutdown and record it.

        Args:
            reason: Human-readable reason for the shutdown.

        Returns:
            Shutdown event dict with timestamp and reason.
        """
        self._active = True
        self._triggered_at = time.time()
        self._reason = reason

        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "reason": reason,
            "active": True,
        }
        self._history.append(event)
        logger.critical("[EmergencyShutdown] TRIGGERED: %s", reason)
        return event

    def is_active(self) -> bool:
        """Return True if a shutdown is currently active."""
        return self._active

    def get_shutdown_history(self) -> list[dict[str, Any]]:
        """Return the full history of shutdown events."""
        return list(self._history)

    def reset(self) -> None:
        """Reset the active flag (for testing/internal use)."""
        self._active = False
        self._reason = ""
        self._triggered_at = 0.0
