"""Event Stream — streams generic bus events: chaos state, task lifecycle, report lifecycle."""
from __future__ import annotations

import logging
import time
from typing import Any

from tester_qa.core.event_bus import Event, EventBus, EventType
from .event_broadcaster import EventBroadcaster

LOGGER = logging.getLogger(__name__)


class EventStream:
    """
    Subscribes to generic / high-level events from the EventBus and broadcasts
    them to all connected WebSocket clients.

    Handled event types:
    - CHAOS_STARTED     — chaos engineering experiment began
    - CHAOS_ESCALATED  — chaos experiment escalated
    - CHAOS_COMPLETED  — chaos experiment finished
    - REPORT_READY     — a test report became available
    """

    _SUBSCRIBED_TYPES = (
        EventType.CHAOS_STARTED,
        EventType.CHAOS_ESCALATED,
        EventType.CHAOS_COMPLETED,
        EventType.REPORT_READY,
    )

    def __init__(self, broadcaster: EventBroadcaster | None = None) -> None:
        self._bus = EventBus.get_instance()
        self._broadcaster = broadcaster or EventBroadcaster.get_instance()
        self._running = False

    # ── Per-event-type handlers ───────────────────────────────────────────────

    def _on_chaos_started(self, event: Event) -> None:
        """Handle chaos experiment start."""
        LOGGER.info("[EventStream] Chaos started: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.CHAOS_STARTED,
            source="event_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_chaos_escalated(self, event: Event) -> None:
        """Handle chaos experiment escalation."""
        LOGGER.warning("[EventStream] Chaos escalated: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.CHAOS_ESCALATED,
            source="event_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_chaos_completed(self, event: Event) -> None:
        """Handle chaos experiment completion."""
        LOGGER.info("[EventStream] Chaos completed: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.CHAOS_COMPLETED,
            source="event_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_report_ready(self, event: Event) -> None:
        """Handle report availability."""
        LOGGER.info("[EventStream] Report ready: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.REPORT_READY,
            source="event_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _enrich(self, event: Event) -> dict[str, Any]:
        """Add stream-level metadata before broadcasting."""
        return {
            "original_data": event.data,
            "event_source": event.source,
            "stream_timestamp": time.time(),
        }

    def _dispatch(self, event: Event) -> None:
        """Route an incoming event to the appropriate handler."""
        handler_map: dict[EventType, Any] = {
            EventType.CHAOS_STARTED: self._on_chaos_started,
            EventType.CHAOS_ESCALATED: self._on_chaos_escalated,
            EventType.CHAOS_COMPLETED: self._on_chaos_completed,
            EventType.REPORT_READY: self._on_report_ready,
        }
        handler = handler_map.get(event.event_type)
        if handler:
            handler(event)

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Subscribe to all event types on the EventBus."""
        if self._running:
            return
        for et in self._SUBSCRIBED_TYPES:
            self._bus.subscribe(et, self._dispatch)
        self._running = True
        LOGGER.info("[EventStream] Started — subscribed to %d event types", len(self._SUBSCRIBED_TYPES))

    def stop(self) -> None:
        """Unsubscribe from all event types."""
        if not self._running:
            return
        # Remove handlers by subscribing no-ops (EventBus has no explicit unsubscribe per handler)
        for et in self._SUBSCRIBED_TYPES:
            self._bus.subscribe(et, lambda _: None)
        self._running = False
        LOGGER.info("[EventStream] Stopped")

    def is_running(self) -> bool:
        """Return True if the stream is currently subscribed."""
        return self._running
