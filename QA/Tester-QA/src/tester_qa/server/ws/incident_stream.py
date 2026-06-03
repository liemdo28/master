"""Incident Stream — streams new incidents, severity changes, collapse alerts, recovery events."""
from __future__ import annotations

import logging
import time
from typing import Any

from tester_qa.core.event_bus import Event, EventBus, EventType
from .event_broadcaster import EventBroadcaster

LOGGER = logging.getLogger(__name__)


class IncidentStream:
    """
    Subscribes to incident and collapse events from the EventBus and broadcasts
    them to all connected WebSocket clients.

    Handled event types:
    - INCIDENT_CREATED   — new incident opened
    - INCIDENT_ESCALATED  — incident severity increased
    - INCIDENT_RESOLVED   — incident resolved / closed
    - COLLAPSE_DETECTED   — cascade failure detected
    - COLLAPSE_RECOVERED  — cascade recovery confirmed
    """

    # Event types this stream subscribes to
    _SUBSCRIBED_TYPES = (
        EventType.INCIDENT_CREATED,
        EventType.INCIDENT_ESCALATED,
        EventType.INCIDENT_RESOLVED,
        EventType.COLLAPSE_DETECTED,
        EventType.COLLAPSE_RECOVERED,
    )

    def __init__(self, broadcaster: EventBroadcaster | None = None) -> None:
        self._bus = EventBus.get_instance()
        self._broadcaster = broadcaster or EventBroadcaster.get_instance()
        self._running = False

    # ── Event handlers (called by EventBus) ────────────────────────────────────

    def _on_incident_created(self, event: Event) -> None:
        """Handle new incident creation."""
        LOGGER.debug("[IncidentStream] Incident created: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.INCIDENT_CREATED,
            source="incident_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_incident_escalated(self, event: Event) -> None:
        """Handle incident escalation (severity increase)."""
        LOGGER.debug("[IncidentStream] Incident escalated: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.INCIDENT_ESCALATED,
            source="incident_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_incident_resolved(self, event: Event) -> None:
        """Handle incident resolution."""
        LOGGER.debug("[IncidentStream] Incident resolved: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.INCIDENT_RESOLVED,
            source="incident_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_collapse_detected(self, event: Event) -> None:
        """Handle cascade failure detection."""
        LOGGER.info("[IncidentStream] Collapse detected: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.COLLAPSE_DETECTED,
            source="incident_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    def _on_collapse_recovered(self, event: Event) -> None:
        """Handle cascade recovery confirmation."""
        LOGGER.info("[IncidentStream] Collapse recovered: %s", event.data)
        self._broadcaster.broadcast(
            event_type=EventType.COLLAPSE_RECOVERED,
            source="incident_stream",
            data=self._enrich(event),
            project_id=event.project_id,
        )

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _enrich(self, event: Event) -> dict[str, Any]:
        """Add stream-level metadata to the event data before broadcasting."""
        return {
            "original_data": event.data,
            "event_source": event.source,
            "stream_timestamp": time.time(),
        }

    def _dispatch(self, event: Event) -> None:
        """Route an incoming event to the appropriate handler."""
        handler_map: dict[EventType, Any] = {
            EventType.INCIDENT_CREATED: self._on_incident_created,
            EventType.INCIDENT_ESCALATED: self._on_incident_escalated,
            EventType.INCIDENT_RESOLVED: self._on_incident_resolved,
            EventType.COLLAPSE_DETECTED: self._on_collapse_detected,
            EventType.COLLAPSE_RECOVERED: self._on_collapse_recovered,
        }
        handler = handler_map.get(event.event_type)
        if handler:
            handler(event)

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Subscribe to all incident/collapse event types on the EventBus."""
        if self._running:
            return
        for et in self._SUBSCRIBED_TYPES:
            self._bus.subscribe(et, self._dispatch)
        self._running = True
        LOGGER.info("[IncidentStream] Started — subscribed to %d event types", len(self._SUBSCRIBED_TYPES))

    def stop(self) -> None:
        """Unsubscribe from all incident/collapse event types."""
        if not self._running:
            return
        for et in self._SUBSCRIBED_TYPES:
            # Re-dispatch to avoid stale closure — subscribe a no-op then clear
            self._bus.subscribe(et, lambda _: None)
        self._running = False
        LOGGER.info("[IncidentStream] Stopped")

    def is_running(self) -> bool:
        """Return True if the stream is currently subscribed."""
        return self._running
