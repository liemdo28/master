"""Central event bus — all modules publish/subscribe through this."""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class EventType(str, Enum):
    # Runtime events
    RUNTIME_SPIKE = "runtime.spike"
    RUNTIME_HEALTHY = "runtime.healthy"
    RUNTIME_DEGRADED = "runtime.degraded"
    RUNTIME_CRITICAL = "runtime.critical"

    # WebSocket events
    WEBSOCKET_DESYNC = "websocket.desync"
    WEBSOCKET_FLOOD = "websocket.flood"
    WEBSOCKET_RECONNECT = "websocket.reconnect"
    WEBSOCKET_DEAD = "websocket.dead"

    # Browser events
    BROWSER_FAILURE = "browser.failure"
    BROWSER_SCREENSHOT = "browser.screenshot"
    BROWSER_CONSOLE_ERROR = "browser.console_error"
    BROWSER_NETWORK_FAIL = "browser.network_fail"

    # Provider events
    PROVIDER_TIMEOUT = "provider.timeout"
    PROVIDER_DEGRADED = "provider.degraded"
    PROVIDER_FAILOVER = "provider.failover"

    # Chaos events
    CHAOS_STARTED = "chaos.started"
    CHAOS_ESCALATED = "chaos.escalated"
    CHAOS_COMPLETED = "chaos.completed"

    # Incident events
    INCIDENT_CREATED = "incident.created"
    INCIDENT_ESCALATED = "incident.escalated"
    INCIDENT_RESOLVED = "incident.resolved"

    # Report events
    REPORT_READY = "report.ready"

    # Evidence events
    EVIDENCE_CAPTURED = "evidence.captured"

    # Collapse events
    COLLAPSE_DETECTED = "collapse.detected"
    COLLAPSE_PROPAGATING = "collapse.propagating"
    COLLAPSE_RECOVERED = "collapse.recovered"

    # Telemetry
    METRICS_UPDATE = "metrics.update"


@dataclass
class Event:
    event_type: EventType
    source: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = 0.0
    project_id: str | None = None

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = time.time()

    def to_dict(self) -> dict[str, Any]:
        return {
            "type": self.event_type.value,
            "source": self.source,
            "data": self.data,
            "timestamp": self.timestamp,
            "project_id": self.project_id,
        }


# Type alias for event handlers
EventHandler = Callable[[Event], None]
AsyncEventHandler = Callable[[Event], Any]


class EventBus:
    """Central event bus for inter-module communication."""

    _instance: EventBus | None = None

    def __init__(self) -> None:
        self._handlers: dict[EventType, list[EventHandler]] = {}
        self._async_handlers: dict[EventType, list[AsyncEventHandler]] = {}
        self._history: list[Event] = []
        self._max_history: int = 1000
        self._global_handlers: list[EventHandler] = []

    @classmethod
    def get_instance(cls) -> EventBus:
        """Get singleton event bus instance."""
        if cls._instance is None:
            cls._instance = EventBus()
        return cls._instance

    def subscribe(self, event_type: EventType, handler: EventHandler) -> None:
        """Subscribe to a specific event type."""
        self._handlers.setdefault(event_type, []).append(handler)

    def subscribe_async(self, event_type: EventType, handler: AsyncEventHandler) -> None:
        """Subscribe async handler to a specific event type."""
        self._async_handlers.setdefault(event_type, []).append(handler)

    def subscribe_all(self, handler: EventHandler) -> None:
        """Subscribe to ALL events (for logging, telemetry)."""
        self._global_handlers.append(handler)

    def publish(self, event: Event) -> None:
        """Publish an event synchronously."""
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        # Notify global handlers
        for handler in self._global_handlers:
            try:
                handler(event)
            except Exception:
                pass

        # Notify specific handlers
        for handler in self._handlers.get(event.event_type, []):
            try:
                handler(event)
            except Exception:
                pass

    async def publish_async(self, event: Event) -> None:
        """Publish an event and await async handlers."""
        self.publish(event)  # Also trigger sync handlers

        for handler in self._async_handlers.get(event.event_type, []):
            try:
                await handler(event)
            except Exception:
                pass

    def emit(self, event_type: EventType, source: str, data: dict[str, Any] | None = None, project_id: str | None = None) -> Event:
        """Convenience method to create and publish an event."""
        event = Event(event_type=event_type, source=source, data=data or {}, project_id=project_id)
        self.publish(event)
        return event

    def get_history(self, event_type: EventType | None = None, limit: int = 50) -> list[dict[str, Any]]:
        """Get event history, optionally filtered by type."""
        events = self._history
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return [e.to_dict() for e in events[-limit:]]

    def get_recent(self, seconds: float = 60.0) -> list[dict[str, Any]]:
        """Get events from the last N seconds."""
        cutoff = time.time() - seconds
        return [e.to_dict() for e in self._history if e.timestamp > cutoff]

    def clear_history(self) -> None:
        """Clear event history."""
        self._history.clear()

    def unsubscribe_all(self) -> None:
        """Remove all subscriptions."""
        self._handlers.clear()
        self._async_handlers.clear()
        self._global_handlers.clear()
