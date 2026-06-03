"""WebSocket Timeline - Reconstruct WebSocket event sequences."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class MessageDirection(Enum):
    CLIENT_TO_SERVER = "client_to_server"
    SERVER_TO_CLIENT = "server_to_client"


class DesyncType(Enum):
    SEQUENCE_GAP = "sequence_gap"
    MISSING_ACK = "missing_ack"
    TIMEOUT = "timeout"
    DUPLICATE = "duplicate"


@dataclass
class WebSocketMessage:
    message_id: str
    direction: MessageDirection
    timestamp: datetime
    payload_size: int
    payload_type: str
    sequence_num: Optional[int] = None


@dataclass
class MessageFlow:
    request_id: str
    client_message: Optional[WebSocketMessage] = None
    server_message: Optional[WebSocketMessage] = None
    round_trip_ms: Optional[float] = None


@dataclass
class DesyncPoint:
    desync_type: DesyncType
    timestamp: datetime
    message_id: str
    description: str


class WebSocketTimeline:
    """Reconstruct WebSocket event sequences and find desyncs."""

    def __init__(self):
        self.messages: list[WebSocketMessage] = []
        self.desync_points: list[DesyncPoint] = []
        self.flows: list[MessageFlow] = []

    def reconstruct_websocket_events(
        self, raw_messages: list[dict[str, Any]]
    ) -> list[WebSocketMessage]:
        """Reconstruct WebSocket events from raw data."""
        self.messages = []
        for raw in raw_messages:
            direction = MessageDirection(raw.get("direction", "client_to_server"))
            msg = WebSocketMessage(
                message_id=raw.get("message_id", ""),
                direction=direction,
                timestamp=datetime.fromisoformat(raw.get("timestamp", datetime.now().isoformat())),
                payload_size=raw.get("payload_size", 0),
                payload_type=raw.get("payload_type", "unknown"),
                sequence_num=raw.get("sequence_num"),
            )
            self.messages.append(msg)
        return self.messages

    def find_desync_point(self) -> list[DesyncPoint]:
        """Find desynchronization points in WebSocket timeline."""
        self.desync_points = []
        if not self.messages:
            return self.desync_points

        client_msgs = [m for m in self.messages if m.direction == MessageDirection.CLIENT_TO_SERVER]
        server_msgs = [m for m in self.messages if m.direction == MessageDirection.SERVER_TO_CLIENT]

        if client_msgs and server_msgs:
            last_client = max(c.timestamp for c in client_msgs)
            last_server = max(s.timestamp for s in server_msgs)
            gap_ms = abs((last_client - last_server).total_seconds() * 1000)

            if gap_ms > 5000:
                self.desync_points.append(
                    DesyncPoint(
                        desync_type=DesyncType.TIMEOUT,
                        timestamp=max(last_client, last_server),
                        message_id="combined",
                        description=f"Server-client gap of {gap_ms:.2f}ms",
                    )
                )

        seen_sequences: set[int] = set()
        for msg in self.messages:
            if msg.sequence_num is not None:
                if msg.sequence_num in seen_sequences:
                    self.desync_points.append(
                        DesyncPoint(
                            desync_type=DesyncType.DUPLICATE,
                            timestamp=msg.timestamp,
                            message_id=msg.message_id,
                            description=f"Duplicate sequence number {msg.sequence_num}",
                        )
                    )
                else:
                    seen_sequences.add(msg.sequence_num)

        sorted_msgs = sorted(self.messages, key=lambda m: m.timestamp)
        expected_seq = 0
        for msg in sorted_msgs:
            if msg.sequence_num is not None:
                if msg.sequence_num > expected_seq + 1:
                    self.desync_points.append(
                        DesyncPoint(
                            desync_type=DesyncType.SEQUENCE_GAP,
                            timestamp=msg.timestamp,
                            message_id=msg.message_id,
                            description=f"Sequence gap: expected {expected_seq + 1}, got {msg.sequence_num}",
                        )
                    )
                expected_seq = max(expected_seq, msg.sequence_num)

        return self.desync_points

    def map_message_flow(
        self, client_request_ids: list[str]
    ) -> list[MessageFlow]:
        """Map message flow for given request IDs."""
        self.flows = []
        for rid in client_request_ids:
            flow = MessageFlow(request_id=rid)

            for msg in self.messages:
                payload = getattr(msg, "payload", {})
                if isinstance(payload, dict) and payload.get("request_id") == rid:
                    if msg.direction == MessageDirection.CLIENT_TO_SERVER:
                        flow.client_message = msg
                    elif msg.direction == MessageDirection.SERVER_TO_CLIENT:
                        flow.server_message = msg

            if flow.client_message and flow.server_message:
                flow.round_trip_ms = (
                    flow.server_message.timestamp - flow.client_message.timestamp
                ).total_seconds() * 1000

            self.flows.append(flow)

        return self.flows
