from __future__ import annotations

from tester_qa.browser.browser_pool import (
    BrowserPool,
    BrowserPoolEvents,
    PoolStats,
)
from tester_qa.browser.har_capture import HARCapture, HARCaptureEvents
from tester_qa.browser.playwright_runner import BrowserInspection, PlaywrightRunner
from tester_qa.browser.screenshot_engine import (
    CaptureResult,
    ComparisonResult,
    ScreenshotEngine,
    ScreenshotEvents,
)
from tester_qa.browser.websocket_capture import (
    WebSocketCapture,
    WebSocketEvents,
    WebSocketPacket,
)

__all__ = [
    # Playwright runner
    "BrowserInspection",
    "PlaywrightRunner",
    # Browser pool
    "BrowserPool",
    "BrowserPoolEvents",
    "PoolStats",
    # WebSocket capture
    "WebSocketCapture",
    "WebSocketEvents",
    "WebSocketPacket",
    # HAR capture
    "HARCapture",
    "HARCaptureEvents",
    # Screenshot engine
    "ScreenshotEngine",
    "ScreenshotEvents",
    "CaptureResult",
    "ComparisonResult",
]
