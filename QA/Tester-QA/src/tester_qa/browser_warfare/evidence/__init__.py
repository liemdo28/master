"""Evidence engine for browser warfare — captures before/during/after state."""

from tester_qa.browser_warfare.evidence.evidence_collector import (
    WarfareEvidencePhase,
    WarfareEvidenceCollector,
)
from tester_qa.browser_warfare.evidence.console_trace import ConsoleTrace
from tester_qa.browser_warfare.evidence.dom_snapshot import DomSnapshot
from tester_qa.browser_warfare.evidence.websocket_trace import WebSocketTrace
from tester_qa.browser_warfare.evidence.render_trace import RenderTrace
from tester_qa.browser_warfare.evidence.screenshot_capture import ScreenshotCapture

__all__ = [
    "WarfareEvidencePhase",
    "WarfareEvidenceCollector",
    "ConsoleTrace",
    "DomSnapshot",
    "WebSocketTrace",
    "RenderTrace",
    "ScreenshotCapture",
]
