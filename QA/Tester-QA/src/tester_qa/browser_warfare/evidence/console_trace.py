"""Console trace — captures all browser console output during warfare execution."""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class ConsoleTrace:
    """Real-time console listener that collects all console messages during execution."""

    def __init__(self) -> None:
        self._enabled: bool = False
        self._trace: list[dict[str, Any]] = []
        self._page: Any = None
        self._handler: Any = None

    def start_trace(self, page: Any) -> None:
        """Begin intercepting console messages from a Playwright page.

        Args:
            page: A live Playwright page object.
        """
        self._trace = []
        self._page = page
        self._enabled = True

        def handler(msg: Any) -> None:
            self._trace.append(
                {
                    "type": msg.type,
                    "text": msg.text,
                    "location": {
                        "url": msg.location.get("url", ""),
                        "line": msg.location.get("lineNumber", 0),
                        "column": msg.location.get("columnNumber", 0),
                    },
                }
            )

        self._handler = handler
        self._page.on("console", handler)
        logger.debug("[ConsoleTrace] Trace started on page")

    def stop_trace(self) -> None:
        """Stop intercepting console messages."""
        if self._page and self._handler:
            try:
                self._page.remove_listener("console", self._handler)
            except Exception as e:
                logger.debug("[ConsoleTrace] remove_listener warning: %s", e)
        self._enabled = False
        logger.debug("[ConsoleTrace] Trace stopped — %d messages captured", len(self._trace))

    def get_trace(self) -> list[dict[str, Any]]:
        """Return all captured console messages."""
        return list(self._trace)

    def clear_trace(self) -> None:
        """Clear the captured trace."""
        self._trace = []

    def error_count(self) -> int:
        """Return the number of error-level messages."""
        return sum(1 for m in self._trace if m["type"] == "error")

    def warn_count(self) -> int:
        """Return the number of warning-level messages."""
        return sum(1 for m in self._trace if m["type"] == "warning")

    def __enter__(self) -> "ConsoleTrace":
        return self

    def __exit__(self, *_: Any) -> None:
        self.stop_trace()
