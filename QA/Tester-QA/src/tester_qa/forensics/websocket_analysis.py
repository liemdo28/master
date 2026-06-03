"""WebSocket Analysis Module - Analyzes WebSocket failures and disconnections."""

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class DisconnectReason(Enum):
    """Possible reasons for WebSocket disconnection."""
    CLIENT_CLOSE = "client_close"
    SERVER_CLOSE = "server_close"
    TIMEOUT = "timeout"
    NETWORK_ERROR = "network_error"
    PROTOCOL_ERROR = "protocol_error"
    AUTH_FAILURE = "auth_failure"
    HEARTBEAT_FAILURE = "heartbeat_failure"
    RECONNECT_LOOP = "reconnect_loop"
    UNKNOWN = "unknown"


class DesyncType(Enum):
    """Types of message desynchronization."""
    SEQUENCE_GAP = "sequence_gap"
    DUPLICATE_MESSAGE = "duplicate_message"
    OUT_OF_ORDER = "out_of_order"
    TIMESTAMP_ANOMALY = "timestamp_anomaly"
    PAYLOAD_MISMATCH = "payload_mismatch"


@dataclass
class WebSocketMessage:
    """A single WebSocket message."""
    message_id: str
    timestamp: datetime
    direction: str
    sequence_number: Optional[int]
    payload_size: int
    message_type: Optional[str] = None
    payload_preview: Optional[str] = None
    correlation_id: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Export message as dictionary."""
        return {
            "message_id": self.message_id,
            "timestamp": self.timestamp.isoformat(),
            "direction": self.direction,
            "sequence_number": self.sequence_number,
            "payload_size": self.payload_size,
            "message_type": self.message_type,
            "payload_preview": self.payload_preview,
            "correlation_id": self.correlation_id,
            "metadata": self.metadata,
        }


@dataclass
class DisconnectEvent:
    """A WebSocket disconnection event."""
    event_id: str
    timestamp: datetime
    reason: DisconnectReason
    duration_seconds: float
    messages_sent: int
    messages_received: int
    last_sequence_sent: Optional[int]
    last_sequence_received: Optional[int]
    error_message: Optional[str]
    recovery_attempted: bool

    def to_dict(self) -> Dict[str, Any]:
        """Export disconnect event as dictionary."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "reason": self.reason.value,
            "duration_seconds": self.duration_seconds,
            "messages_sent": self.messages_sent,
            "messages_received": self.messages_received,
            "last_sequence_sent": self.last_sequence_sent,
            "last_sequence_received": self.last_sequence_received,
            "error_message": self.error_message,
            "recovery_attempted": self.recovery_attempted,
        }


@dataclass
class DesyncEvent:
    """A message desynchronization event."""
    event_id: str
    timestamp: datetime
    desync_type: DesyncType
    expected_sequence: Optional[int]
    actual_sequence: Optional[int]
    affected_message_ids: List[str]
    severity: str
    description: str

    def to_dict(self) -> Dict[str, Any]:
        """Export desync event as dictionary."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "desync_type": self.desync_type.value,
            "expected_sequence": self.expected_sequence,
            "actual_sequence": self.actual_sequence,
            "affected_message_ids": self.affected_message_ids,
            "severity": self.severity,
            "description": self.description,
        }


@dataclass
class WebSocketAnalysisResult:
    """Complete WebSocket analysis result."""
    analysis_id: str
    timestamp: datetime
    total_messages: int
    total_disconnects: int
    total_desyncs: int
    disconnects: List[DisconnectEvent]
    desyncs: List[DesyncEvent]
    message_loss_events: List[Dict[str, Any]]
    summary: Dict[str, Any]
    recommendations: List[str]

    def to_dict(self) -> Dict[str, Any]:
        """Export analysis result as dictionary."""
        return {
            "analysis_id": self.analysis_id,
            "timestamp": self.timestamp.isoformat(),
            "total_messages": self.total_messages,
            "total_disconnects": self.total_disconnects,
            "total_desyncs": self.total_desyncs,
            "disconnects": [d.to_dict() for d in self.disconnects],
            "desyncs": [d.to_dict() for d in self.desyncs],
            "message_loss_events": self.message_loss_events,
            "summary": self.summary,
            "recommendations": self.recommendations,
        }


class WebSocketAnalyzer:
    """Analyzes WebSocket failures, disconnects, and desynchronization."""

    def __init__(self) -> None:
        self._messages: List[WebSocketMessage] = []
        self._disconnects: List[DisconnectEvent] = []
        self._desyncs: List[DesyncEvent] = []
        self._message_loss: List[Dict[str, Any]] = []
        self._message_counter: int = 0
        self._disconnect_counter: int = 0
        self._desync_counter: int = 0

    def add_message(
        self,
        direction: str,
        payload_size: int,
        sequence_number: Optional[int] = None,
        message_type: Optional[str] = None,
        payload_preview: Optional[str] = None,
        correlation_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> WebSocketMessage:
        """Add a WebSocket message to the analysis.

        Args:
            direction: 'send' or 'receive'.
            payload_size: Size of the message payload in bytes.
            sequence_number: Optional sequence number for ordering.
            message_type: Optional message type identifier.
            payload_preview: Optional truncated payload preview.
            correlation_id: Optional correlation ID.
            metadata: Optional additional metadata.

        Returns:
            The created WebSocketMessage.
        """
        self._message_counter += 1
        message = WebSocketMessage(
            message_id=f"ws-msg-{self._message_counter:06d}",
            timestamp=datetime.utcnow(),
            direction=direction,
            sequence_number=sequence_number,
            payload_size=payload_size,
            message_type=message_type,
            payload_preview=payload_preview,
            correlation_id=correlation_id,
            metadata=metadata or {},
        )
        self._messages.append(message)
        return message

    def add_disconnect(
        self,
        reason: DisconnectReason,
        duration_seconds: float,
        messages_sent: int = 0,
        messages_received: int = 0,
        last_sequence_sent: Optional[int] = None,
        last_sequence_received: Optional[int] = None,
        error_message: Optional[str] = None,
        recovery_attempted: bool = False,
    ) -> DisconnectEvent:
        """Record a WebSocket disconnection event.

        Args:
            reason: The reason for disconnection.
            duration_seconds: How long the connection lasted.
            messages_sent: Number of messages sent before disconnect.
            messages_received: Number of messages received before disconnect.
            last_sequence_sent: Last sequence number sent.
            last_sequence_received: Last sequence number received.
            error_message: Optional error message.
            recovery_attempted: Whether recovery was attempted.

        Returns:
            The created DisconnectEvent.
        """
        self._disconnect_counter += 1
        event = DisconnectEvent(
            event_id=f"ws-disc-{self._disconnect_counter:06d}",
            timestamp=datetime.utcnow(),
            reason=reason,
            duration_seconds=duration_seconds,
            messages_sent=messages_sent,
            messages_received=messages_received,
            last_sequence_sent=last_sequence_sent,
            last_sequence_received=last_sequence_received,
            error_message=error_message,
            recovery_attempted=recovery_attempted,
        )
        self._disconnects.append(event)
        return event

    def analyze_disconnects(self) -> List[DisconnectEvent]:
        """Analyze recorded disconnections.

        Returns:
            List of disconnect events with analysis annotations.
        """
        if not self._disconnects:
            return []

        analyzed: List[DisconnectEvent] = []

        for disc in self._disconnects:
            severity = "info"
            if disc.reason == DisconnectReason.NETWORK_ERROR:
                severity = "high"
            elif disc.reason == DisconnectReason.TIMEOUT:
                severity = "medium"
            elif disc.reason == DisconnectReason.HEARTBEAT_FAILURE:
                severity = "medium"

            if disc.duration_seconds < 5:
                severity = "low"
            elif disc.duration_seconds > 3600:
                severity = "info"

            disc.metadata["severity"] = severity
            analyzed.append(disc)

        return analyzed

    def detect_desync(self) -> List[DesyncEvent]:
        """Detect message desynchronization issues.

        Returns:
            List of detected desync events.
        """
        self._desyncs = []

        sent_messages = [m for m in self._messages if m.direction == "send"]
        received_messages = [m for m in self._messages if m.direction == "receive"]

        self._detect_sequence_gaps(sent_messages, "send")
        self._detect_sequence_gaps(received_messages, "receive")
        self._detect_duplicate_messages(sent_messages)
        self._detect_duplicate_messages(received_messages)
        self._detect_out_of_order(sent_messages)
        self._detect_out_of_order(received_messages)

        return self._desyncs

    def find_message_loss(
        self,
        expected_sequence: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Find events where messages may have been lost.

        Args:
            expected_sequence: Expected sequence count if known.

        Returns:
            List of potential message loss events.
        """
        self._message_loss = []

        sent_messages = sorted(
            [m for m in self._messages if m.direction == "send" and m.sequence_number is not None],
            key=lambda m: m.sequence_number,
        )
        received_messages = sorted(
            [m for m in self._messages if m.direction == "receive" and m.sequence_number is not None],
            key=lambda m: m.sequence_number,
        )

        for msg_list, direction in [(sent_messages, "send"), (received_messages, "receive")]:
            if len(msg_list) < 2:
                continue

            for i in range(len(msg_list) - 1):
                current = msg_list[i]
                next_msg = msg_list[i + 1]
                gap = next_msg.sequence_number - current.sequence_number

                if gap > 1:
                    loss_count = gap - 1
                    loss_event = {
                        "type": "sequence_gap",
                        "direction": direction,
                        "expected_sequence": current.sequence_number + 1,
                        "actual_sequence": next_msg.sequence_number,
                        "gap_size": gap,
                        "missing_count": loss_count,
                        "between_messages": [current.message_id, next_msg.message_id],
                        "timestamp": datetime.utcnow().isoformat(),
                        "severity": "high" if gap > 3 else "medium",
                    }
                    self._message_loss.append(loss_event)

        if expected_sequence is not None:
            if sent_messages:
                max_sent = sent_messages[-1].sequence_number or 0
                if max_sent < expected_sequence:
                    self._message_loss.append({
                        "type": "total_message_loss",
                        "direction": "send",
                        "expected_sequence": expected_sequence,
                        "actual_max_sequence": max_sent,
                        "missing_count": expected_sequence - max_sent,
                        "severity": "high",
                    })

        return self._message_loss

    def run_full_analysis(
        self,
        expected_sequence: Optional[int] = None,
    ) -> WebSocketAnalysisResult:
        """Run a complete WebSocket analysis.

        Args:
            expected_sequence: Optional expected total sequence count.

        Returns:
            Complete WebSocketAnalysisResult.
        """
        disconnects = self.analyze_disconnects()
        desyncs = self.detect_desync()
        message_loss = self.find_message_loss(expected_sequence)

        recommendations: List[str] = []
        if len(disconnects) > 5:
            recommendations.append(
                f"Frequent disconnections detected ({len(disconnects)} events). "
                "Investigate network stability and implement exponential backoff."
            )
        if desyncs:
            recommendations.append(
                f"Message desynchronization detected ({len(desyncs)} events). "
                "Implement sequence number validation and replay buffer."
            )
        if message_loss:
            recommendations.append(
                f"Potential message loss detected ({len(message_loss)} events). "
                "Review network conditions and implement message acknowledgment."
            )
        if not recommendations:
            recommendations.append("No significant WebSocket issues detected.")

        summary = self._generate_summary(disconnects, desyncs, message_loss)

        return WebSocketAnalysisResult(
            analysis_id=f"ws-an-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            timestamp=datetime.utcnow(),
            total_messages=len(self._messages),
            total_disconnects=len(disconnects),
            total_desyncs=len(desyncs),
            disconnects=disconnects,
            desyncs=desyncs,
            message_loss_events=message_loss,
            summary=summary,
            recommendations=recommendations,
        )

    def get_messages(self) -> List[WebSocketMessage]:
        """Return all collected messages."""
        return self._messages.copy()

    def clear(self) -> None:
        """Clear all collected data."""
        self._messages = []
        self._disconnects = []
        self._desyncs = []
        self._message_loss = []
        self._message_counter = 0
        self._disconnect_counter = 0
        self._desync_counter = 0

    def export_analysis(self, result: WebSocketAnalysisResult, format: str = "dict") -> Any:
        """Export analysis result in the specified format.

        Args:
            result: The WebSocketAnalysisResult to export.
            format: Output format - 'dict', 'text', or 'json'.

        Returns:
            Formatted analysis data.
        """
        if format == "text":
            return self._format_analysis_text(result)
        elif format == "json":
            import json
            return json.dumps(result.to_dict(), indent=2, default=str)
        return result.to_dict()

    def _detect_sequence_gaps(
        self, messages: List[WebSocketMessage], direction: str
    ) -> None:
        """Detect gaps in message sequences."""
        if len(messages) < 2:
            return

        for i in range(len(messages) - 1):
            current = messages[i]
            next_msg = messages[i + 1]
            if current.sequence_number is not None and next_msg.sequence_number is not None:
                gap = next_msg.sequence_number - current.sequence_number
                if gap > 1:
                    self._desync_counter += 1
                    self._desyncs.append(DesyncEvent(
                        event_id=f"ws-dsync-{self._desync_counter:06d}",
                        timestamp=next_msg.timestamp,
                        desync_type=DesyncType.SEQUENCE_GAP,
                        expected_sequence=current.sequence_number + 1,
                        actual_sequence=next_msg.sequence_number,
                        affected_message_ids=[current.message_id, next_msg.message_id],
                        severity="medium",
                        description=f"Gap of {gap - 1} messages between {current.message_id} and {next_msg.message_id}",
                    ))

    def _detect_duplicate_messages(self, messages: List[WebSocketMessage]) -> None:
        """Detect duplicate messages."""
        seen_sequences: Set[int] = set()

        for msg in messages:
            if msg.sequence_number is not None:
                if msg.sequence_number in seen_sequences:
                    self._desync_counter += 1
                    self._desyncs.append(DesyncEvent(
                        event_id=f"ws-dsync-{self._desync_counter:06d}",
                        timestamp=msg.timestamp,
                        desync_type=DesyncType.DUPLICATE_MESSAGE,
                        expected_sequence=msg.sequence_number,
                        actual_sequence=msg.sequence_number,
                        affected_message_ids=[msg.message_id],
                        severity="low",
                        description=f"Duplicate message with sequence {msg.sequence_number}",
                    ))
                seen_sequences.add(msg.sequence_number)

    def _detect_out_of_order(self, messages: List[WebSocketMessage]) -> None:
        """Detect out-of-order messages."""
        if len(messages) < 2:
            return

        for i in range(len(messages) - 1):
            current = messages[i]
            next_msg = messages[i + 1]
            if current.sequence_number is not None and next_msg.sequence_number is not None:
                if next_msg.sequence_number < current.sequence_number:
                    self._desync_counter += 1
                    self._desyncs.append(DesyncEvent(
                        event_id=f"ws-dsync-{self._desync_counter:06d}",
                        timestamp=next_msg.timestamp,
                        desync_type=DesyncType.OUT_OF_ORDER,
                        expected_sequence=current.sequence_number + 1,
                        actual_sequence=next_msg.sequence_number,
                        affected_message_ids=[current.message_id, next_msg.message_id],
                        severity="medium",
                        description=f"Message {next_msg.message_id} arrived out of order",
                    ))

    def _generate_summary(
        self,
        disconnects: List[DisconnectEvent],
        desyncs: List[DesyncEvent],
        message_loss: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """Generate analysis summary."""
        if not disconnects:
            avg_duration = 0.0
        else:
            avg_duration = sum(d.duration_seconds for d in disconnects) / len(disconnects)

        disconnect_reasons: Dict[str, int] = {}
        for d in disconnects:
            reason = d.reason.value
            disconnect_reasons[reason] = disconnect_reasons.get(reason, 0) + 1

        desync_types: Dict[str, int] = {}
        for ds in desyncs:
            dt = ds.desync_type.value
            desync_types[dt] = desync_types.get(dt, 0) + 1

        return {
            "total_messages": len(self._messages),
            "total_disconnects": len(disconnects),
            "avg_disconnect_duration_seconds": round(avg_duration, 2),
            "disconnect_reasons": disconnect_reasons,
            "total_desyncs": len(desyncs),
            "desync_types": desync_types,
            "total_message_loss_events": len(message_loss),
            "reconnect_rate": len([d for d in disconnects if d.recovery_attempted]) / max(len(disconnects), 1),
        }

    def _format_analysis_text(self, result: WebSocketAnalysisResult) -> str:
        """Format analysis result as human-readable text."""
        lines = [
            "=" * 60,
            "WEBSOCKET ANALYSIS REPORT",
            "=" * 60,
            f"Analysis ID: {result.analysis_id}",
            f"Timestamp:   {result.timestamp.isoformat()}",
            f"Total Messages: {result.total_messages}",
            f"Total Disconnects: {result.total_disconnects}",
            f"Total Desyncs: {result.total_desyncs}",
        ]

        if result.summary.get("disconnect_reasons"):
            lines.extend(["", "DISCONNECT ANALYSIS:"])
            for reason, count in result.summary["disconnect_reasons"].items():
                lines.append(f"  {reason}: {count}")

        if result.desyncs:
            lines.extend(["", "DESYNC EVENTS:"])
            for ds in result.desyncs[:5]:
                lines.extend([
                    f"  [{ds.severity.upper()}] {ds.desync_type.value}",
                    f"    {ds.description}",
                ])

        if result.message_loss_events:
            lines.extend(["", "MESSAGE LOSS EVENTS:"])
            for loss in result.message_loss_events[:5]:
                lines.append(f"  - {loss.get('type', 'unknown')}: missing {loss.get('missing_count', 0)} messages")

        if result.recommendations:
            lines.extend(["", "RECOMMENDATIONS:"])
            for i, rec in enumerate(result.recommendations, 1):
                lines.append(f"  {i}. {rec}")

        lines.append("=" * 60)
        return "".join(lines)
