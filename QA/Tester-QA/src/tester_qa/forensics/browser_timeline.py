"""Browser Timeline - Reconstruct browser session and UI corruption."""
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Optional


class RenderState(Enum):
    PENDING = "pending"
    RENDERING = "rendering"
    COMPLETE = "complete"
    FAILED = "failed"


class UICorruptionType(Enum):
    DOM_MISMATCH = "dom_mismatch"
    STALE_ELEMENT = "stale_element"
    STYLE_LEAK = "style_leak"
    HIDDEN_OVERLAY = "hidden_overlay"


@dataclass
class BrowserEvent:
    timestamp: datetime
    event_type: str
    url: str
    data: dict[str, Any]


@dataclass
class RenderFailure:
    timestamp: datetime
    url: str
    error_message: str
    stack_trace: str
    severity: float


@dataclass
class UICorruption:
    corruption_type: UICorruptionType
    timestamp: datetime
    element_selector: str
    description: str
    severity: float


@dataclass
class BrowserSession:
    session_id: str
    start_time: datetime
    end_time: datetime
    url: str
    events: list[BrowserEvent] = field(default_factory=list)
    render_failures: list[RenderFailure] = field(default_factory=list)
    ui_corruptions: list[UICorruption] = field(default_factory=list)


class BrowserTimeline:
    """Reconstruct browser sessions and map UI corruption."""

    def __init__(self):
        self.sessions: list[BrowserSession] = []
        self.current_session: Optional[BrowserSession] = None

    def reconstruct_browser_session(
        self, events: list[BrowserEvent], session_id: str
    ) -> BrowserSession:
        """Reconstruct a browser session from events."""
        if not events:
            start_time = datetime.now()
            end_time = datetime.now()
        else:
            start_time = min(e.timestamp for e in events)
            end_time = max(e.timestamp for e in events)

        session = BrowserSession(
            session_id=session_id,
            start_time=start_time,
            end_time=end_time,
            url=events[0].url if events else "",
            events=events,
        )

        for event in events:
            if event.event_type == "render_failure":
                session.render_failures.append(
                    RenderFailure(
                        timestamp=event.timestamp,
                        url=event.url,
                        error_message=event.data.get("error", ""),
                        stack_trace=event.data.get("stack", ""),
                        severity=event.data.get("severity", 1.0),
                    )
                )
            elif event.event_type == "ui_corruption":
                session.ui_corruptions.append(
                    UICorruption(
                        corruption_type=UICorruptionType(
                            event.data.get("corruption_type", "dom_mismatch")
                        ),
                        timestamp=event.timestamp,
                        element_selector=event.data.get("selector", ""),
                        description=event.data.get("description", ""),
                        severity=event.data.get("severity", 1.0),
                    )
                )

        self.sessions.append(session)
        self.current_session = session
        return session

    def find_render_failure(
        self, min_severity: float = 1.0
    ) -> list[RenderFailure]:
        """Find render failures above severity threshold."""
        if not self.current_session:
            return []
        return [
            rf
            for rf in self.current_session.render_failures
            if rf.severity >= min_severity
        ]

    def map_ui_corruption(
        self, corruption_type: Optional[UICorruptionType] = None
    ) -> list[UICorruption]:
        """Map UI corruptions, optionally filtered by type."""
        if not self.current_session:
            return []
        corruptions = self.current_session.ui_corruptions
        if corruption_type:
            corruptions = [c for c in corruptions if c.corruption_type == corruption_type]
        return corruptions
