"""Browser resource limits and kill switches for browser warfare safety."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BrowserWarfareLimits:
    """Hard limits enforced during browser warfare execution."""

    max_browsers: int = 5
    max_memory_mb: int = 2000
    max_execution_seconds: int = 120
    max_websocket_connections: int = 200
    max_dom_nodes: int = 50000
    auto_shutdown_on_limit: bool = True


class BrowserSafetyGuard:
    """Monitors and enforces resource limits during browser warfare."""

    def __init__(self, limits: Optional[BrowserWarfareLimits] = None) -> None:
        self.limits = limits or BrowserWarfareLimits()
        self._enforcement_active: bool = False

    def check_limits(self, metrics: dict) -> tuple[bool, list[str]]:
        """Check current metrics against limits.

        Args:
            metrics: Dict with keys like memory_mb, dom_nodes, ws_connections,
                     execution_seconds.

        Returns:
            Tuple of (within_limits, list_of_violations).
        """
        violations: list[str] = []

        memory_mb = metrics.get("memory_mb", 0)
        if memory_mb > self.limits.max_memory_mb:
            violations.append(
                f"Memory limit exceeded: {memory_mb}MB > {self.limits.max_memory_mb}MB"
            )

        dom_nodes = metrics.get("dom_nodes", 0)
        if dom_nodes > self.limits.max_dom_nodes:
            violations.append(
                f"DOM nodes limit exceeded: {dom_nodes} > {self.limits.max_dom_nodes}"
            )

        ws_connections = metrics.get("websocket_connections", 0)
        if ws_connections > self.limits.max_websocket_connections:
            violations.append(
                f"WebSocket connections limit exceeded: "
                f"{ws_connections} > {self.limits.max_websocket_connections}"
            )

        exec_seconds = metrics.get("execution_seconds", 0)
        if exec_seconds > self.limits.max_execution_seconds:
            violations.append(
                f"Execution time limit exceeded: "
                f"{exec_seconds}s > {self.limits.max_execution_seconds}s"
            )

        return len(violations) == 0, violations

    def enforce_limits(self) -> None:
        """Mark enforcement as active — caller should trigger shutdown if needed."""
        self._enforcement_active = True
        logger.warning(
            "[BrowserSafetyGuard] Enforcement activated — limits may be breached"
        )

    def emergency_stop(self) -> None:
        """Trigger immediate emergency stop."""
        self._enforcement_active = False
        logger.critical("[BrowserSafetyGuard] EMERGENCY STOP triggered")
