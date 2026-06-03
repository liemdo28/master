"""Trace Rebuilder Module - Reconstructs execution traces from logs."""

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set


class EventType(Enum):
    """Types of events in an execution trace."""
    FUNCTION_CALL = "function_call"
    FUNCTION_RETURN = "function_return"
    EXCEPTION = "exception"
    NETWORK_REQUEST = "network_request"
    NETWORK_RESPONSE = "network_response"
    DATABASE_QUERY = "database_query"
    DATABASE_RESULT = "database_result"
    FILE_OPEN = "file_open"
    FILE_CLOSE = "file_close"
    MEMORY_ALLOC = "memory_alloc"
    THREAD_START = "thread_start"
    THREAD_END = "thread_end"
    CUSTOM = "custom"


@dataclass
class TraceEvent:
    """A single event in an execution trace."""
    timestamp: datetime
    source: str
    event_type: EventType
    data: Dict[str, Any]
    correlation_id: Optional[str] = None
    parent_id: Optional[str] = None
    event_id: Optional[str] = None
    duration_ms: Optional[float] = None
    tags: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Export event as dictionary."""
        return {
            "event_id": self.event_id,
            "timestamp": self.timestamp.isoformat(),
            "source": self.source,
            "event_type": self.event_type.value,
            "data": self.data,
            "correlation_id": self.correlation_id,
            "parent_id": self.parent_id,
            "duration_ms": self.duration_ms,
            "tags": self.tags,
        }


@dataclass
class ExecutionTrace:
    """Complete reconstructed execution trace."""
    trace_id: str
    events: List[TraceEvent]
    start_time: datetime
    end_time: datetime
    correlation_chains: Dict[str, List[str]] = field(default_factory=dict)
    causation_chains: List[List[str]] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Export trace as dictionary."""
        return {
            "trace_id": self.trace_id,
            "events": [e.to_dict() for e in self.events],
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "correlation_chains": self.correlation_chains,
            "causation_chains": self.causation_chains,
            "metadata": self.metadata,
        }


class TraceRebuilder:
    """Reconstructs execution traces from log entries."""

    def __init__(self) -> None:
        self._raw_logs: List[Dict[str, Any]] = []
        self._event_patterns: Dict[EventType, List[str]] = {
            EventType.FUNCTION_CALL: [
                r"^(?:\[([^\]]+)\])?\s*->\s*(\w+)\((.*)\)$",
                r"CALL\s+(\w+)\s+\((.*)\)",
                r"\[TRACE\]\s+(\w+)\(.*\)\s+-->\s+(\w+)",
            ],
            EventType.FUNCTION_RETURN: [
                r"^(?:\[([^\]]+)\])?\s*<-\s*(\w+)\s+(.*)$",
                r"RETURN\s+(\w+)\s+(.*)",
            ],
            EventType.EXCEPTION: [
                r"(?:Exception|Error|Traceback).*",
                r"ERROR:\s+(.*)",
            ],
            EventType.NETWORK_REQUEST: [
                r"(?:GET|POST|PUT|DELETE|PATCH)\s+(/\S+)",
                r"HTTP\s+(?:->|>>)\s+(\S+)",
            ],
            EventType.NETWORK_RESPONSE: [
                r"HTTP\s+(?:<<|<-)\s+(\d+)",
                r"RESPONSE:\s+(\d+)\s+(.*)",
            ],
            EventType.DATABASE_QUERY: [
                r"QUERY:\s+(SELECT|INSERT|UPDATE|DELETE)\s+(.*)",
                r"SQL\s+(?:>>|->)\s+(.*)",
            ],
        }
        self._correlation_patterns: List[str] = [
            r"corr(?:elation)?[_-]?id[:\s=]+([a-zA-Z0-9_-]+)",
            r"trace[_-]?id[:\s=]+([a-zA-Z0-9_-]+)",
            r"request[_-]?id[:\s=]+([a-zA-Z0-9_-]+)",
        ]

    def rebuild_trace(
        self,
        log_data: str,
        source_hint: Optional[str] = None,
    ) -> ExecutionTrace:
        """Rebuild an execution trace from raw log data.

        Args:
            log_data: Raw log entries, one per line.
            source_hint: Optional hint about log source (python, nodejs, etc.).

        Returns:
            Reconstructed ExecutionTrace.
        """
        self._raw_logs = []
        events: List[TraceEvent] = []
        event_counter = 0

        lines = log_data.strip().split("\n")
        for line in lines:
            if not line.strip():
                continue

            event = self._parse_log_line(line, source_hint)
            if event:
                event.event_id = f"evt-{event_counter:06d}"
                event_counter += 1
                events.append(event)
                self._raw_logs.append({"line": line, "event": event})

        if not events:
            return ExecutionTrace(
                trace_id=f"trace-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
                events=[],
                start_time=datetime.utcnow(),
                end_time=datetime.utcnow(),
            )

        correlation_chains = self.correlate_events(events)
        causation_chains = self.find_causation_chain(events)

        return ExecutionTrace(
            trace_id=f"trace-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            events=events,
            start_time=events[0].timestamp if events else datetime.utcnow(),
            end_time=events[-1].timestamp if events else datetime.utcnow(),
            correlation_chains=correlation_chains,
            causation_chains=causation_chains,
            metadata={"source_hint": source_hint, "total_events": len(events)},
        )

    def correlate_events(self, events: List[TraceEvent]) -> Dict[str, List[str]]:
        """Correlate events by shared identifiers.

        Args:
            events: List of parsed trace events.

        Returns:
            Dictionary mapping correlation IDs to lists of event IDs.
        """
        correlation_chains: Dict[str, List[str]] = {}

        for event in events:
            cid = self._extract_correlation_id(event)
            if cid:
                if cid not in correlation_chains:
                    correlation_chains[cid] = []
                if event.event_id:
                    correlation_chains[cid].append(event.event_id)

        for event in events:
            if event.correlation_id and event.event_id:
                cid = event.correlation_id
                if cid not in correlation_chains:
                    correlation_chains[cid] = []
                if event.event_id not in correlation_chains[cid]:
                    correlation_chains[cid].append(event.event_id)

        return correlation_chains

    def find_causation_chain(self, events: List[TraceEvent]) -> List[List[str]]:
        """Identify causal chains of events.

        Args:
            events: List of parsed trace events.

        Returns:
            List of causation chains, each chain being a list of event IDs.
        """
        chains: List[List[str]] = []
        current_chain: List[str] = []

        for event in events:
            if event.event_id:
                current_chain.append(event.event_id)

            if event.event_type == EventType.EXCEPTION:
                if current_chain:
                    chains.append(list(current_chain))
                current_chain = []

            if event.parent_id and current_chain:
                last = current_chain[-1] if current_chain else None
                if last and last != event.parent_id:
                    if event.parent_id in [e for e in current_chain]:
                        chain_start = current_chain.index(event.parent_id)
                        chains.append(list(current_chain[chain_start:]))
                        current_chain = current_chain[:chain_start]

        if current_chain:
            chains.append(current_chain)

        return chains

    def export_trace(self, trace: ExecutionTrace, format: str = "dict") -> Any:
        """Export a trace in the specified format.

        Args:
            trace: The ExecutionTrace to export.
            format: Output format - 'dict', 'text', or 'json'.

        Returns:
            Formatted trace data.
        """
        if format == "text":
            return self._format_trace_text(trace)
        elif format == "json":
            import json
            return json.dumps(trace.to_dict(), indent=2, default=str)
        return trace.to_dict()

    def _parse_log_line(
        self, line: str, source_hint: Optional[str] = None
    ) -> Optional[TraceEvent]:
        """Parse a single log line into a TraceEvent."""
        timestamp = self._extract_timestamp(line)
        correlation_id = self._extract_correlation_id_from_line(line)

        for event_type, patterns in self._event_patterns.items():
            for pattern in patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    data = self._build_event_data(event_type, match, line)
                    return TraceEvent(
                        timestamp=timestamp or datetime.utcnow(),
                        source=source_hint or "unknown",
                        event_type=event_type,
                        data=data,
                        correlation_id=correlation_id,
                    )

        return TraceEvent(
            timestamp=timestamp or datetime.utcnow(),
            source=source_hint or "unknown",
            event_type=EventType.CUSTOM,
            data={"raw": line},
            correlation_id=correlation_id,
        )

    def _extract_timestamp(self, line: str) -> Optional[datetime]:
        """Extract timestamp from a log line."""
        patterns = [
            r"(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)",
            r"(\d{2}/\w+/\d{4}:\d{2}:\d{2}:\d{2})",
            r"(\[\d{2}:\d{2}:\d{2}\])",
        ]
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                try:
                    ts_str = match.group(1).strip("[]")
                    for fmt in [
                        "%Y-%m-%dT%H:%M:%S.%fZ",
                        "%Y-%m-%dT%H:%M:%SZ",
                        "%Y-%m-%d %H:%M:%S.%f",
                        "%Y-%m-%d %H:%M:%S",
                        "%d/%b/%Y:%H:%M:%S",
                    ]:
                        try:
                            return datetime.strptime(ts_str, fmt)
                        except ValueError:
                            continue
                except (ValueError, IndexError):
                    pass
        return None

    def _extract_correlation_id(self, event: TraceEvent) -> Optional[str]:
        """Extract correlation ID from an event's data."""
        data_str = str(event.data)
        for pattern in self._correlation_patterns:
            match = re.search(pattern, data_str, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def _extract_correlation_id_from_line(self, line: str) -> Optional[str]:
        """Extract correlation ID directly from a log line."""
        for pattern in self._correlation_patterns:
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def _build_event_data(
        self, event_type: EventType, match: re.Match, line: str
    ) -> Dict[str, Any]:
        """Build event data dictionary from a regex match."""
        data: Dict[str, Any] = {}

        if event_type == EventType.FUNCTION_CALL:
            if len(match.groups()) >= 1:
                data["function"] = match.group(1)
            if len(match.groups()) >= 2:
                data["args"] = match.group(2)
        elif event_type == EventType.FUNCTION_RETURN:
            if len(match.groups()) >= 1:
                data["function"] = match.group(1)
            if len(match.groups()) >= 2:
                data["return_value"] = match.group(2)
        elif event_type == EventType.NETWORK_REQUEST:
            if match.groups():
                data["path"] = match.group(1)
        elif event_type == EventType.NETWORK_RESPONSE:
            if match.groups():
                data["status_code"] = match.group(1)
        elif event_type == EventType.DATABASE_QUERY:
            if len(match.groups()) >= 1:
                data["operation"] = match.group(1)
            if len(match.groups()) >= 2:
                data["query"] = match.group(2)
        elif event_type == EventType.EXCEPTION:
            data["message"] = match.group(0)

        data["raw_line"] = line.strip()
        return data

    def _format_trace_text(self, trace: ExecutionTrace) -> str:
        """Format a trace as human-readable text."""
        lines = [
            "=" * 60,
            "EXECUTION TRACE",
            "=" * 60,
            f"Trace ID:  {trace.trace_id}",
            f"Start:     {trace.start_time.isoformat()}",
            f"End:       {trace.end_time.isoformat()}",
            f"Events:    {len(trace.events)}",
            "",
            "EVENTS:",
        ]

        for event in trace.events:
            lines.append(
                f"  [{event.timestamp.isoformat()}] "
                f"[{event.event_type.value}] "
                f"{event.source}: {event.data.get('raw_line', str(event.data))}"
            )

        if trace.causation_chains:
            lines.extend(["", "CAUSATION CHAINS:"])
            for i, chain in enumerate(trace.causation_chains, 1):
                lines.append(f"  Chain {i}: {' -> '.join(chain)}")

        lines.append("=" * 60)
        return "\n".join(lines)
