"""HAR (HTTP Archive) capture and export for Playwright browser sessions.

Exports network traffic recorded by Playwright into a HAR 1.2-compliant
JSON file, suitable for replay tools and API analysis.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.evidence import EvidenceEngine

LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal event types
# ---------------------------------------------------------------------------
class HARCaptureEvents:
    STARTED = "HAR_CAPTURE_STARTED"
    EXPORTED = "HAR_CAPTURE_EXPORTED"


# ---------------------------------------------------------------------------
# HARCapture
# ---------------------------------------------------------------------------
class HARCapture:
    """Record and export browser network traffic as a HAR 1.2 file.

    Usage::

        capturer = HARCapture()
        capturer.start(page)
        # ... interact with page ...
        capturer.stop_and_export(Path("output.har"))
    """

    def __init__(self, evidence_engine: EvidenceEngine | None = None) -> None:
        self._evidence_engine = evidence_engine or EvidenceEngine()
        self._active = False
        self._started_at: str | None = None
        self._entries: list[dict[str, Any]] = []
        self._handlers: list[tuple[Any, str, Any]] = []  # (page, event, handler)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def start(self, page: Any) -> None:
        """Enable network recording on a Playwright page.

        Args:
            page: A playwright.sync_api.Page or playwright.async_api.Page.

        Raises:
            RuntimeError: If capture is already running.
            TypeError: If ``page`` is not a Playwright Page.
        """
        if self._active:
            raise RuntimeError("HARCapture is already running")
        if not hasattr(page, "on"):
            raise TypeError("Expected a Playwright Page object with .on()")

        self._active = True
        self._started_at = datetime.now(timezone.utc).isoformat()
        self._entries.clear()

        def on_request(request: Any) -> None:
            try:
                self._entries.append(_request_entry(request, self._started_at))
            except Exception as exc:  # pragma: no cover
                LOGGER.debug("Failed to record request entry: %s", exc)

        def on_response(response: Any) -> None:
            try:
                _patch_response_entry(self._entries, response)
            except Exception as exc:  # pragma: no cover
                LOGGER.debug("Failed to patch response entry: %s", exc)

        def on_requestfinished(request: Any) -> None:
            try:
                _patch_timing_entry(self._entries, request)
            except Exception as exc:  # pragma: no cover
                LOGGER.debug("Failed to patch timing entry: %s", exc)

        try:
            page.on("request", on_request)
            page.on("response", on_response)
            page.on("requestfinished", on_requestfinished)
            self._handlers = [
                (page, "request", on_request),
                (page, "response", on_response),
                (page, "requestfinished", on_requestfinished),
            ]
        except Exception as exc:  # pragma: no cover
            self._active = False
            raise

        LOGGER.debug("HAR capture started at %s", self._started_at)

    def stop_and_export(self, path: Path | str) -> Path:
        """Stop recording and write a HAR 1.2 file.

        Args:
            path: Destination file path for the .har file.

        Returns:
            The resolved destination ``Path``.
        """
        if not self._active:
            LOGGER.warning("stop_and_export called but capture is not active")
        self._active = False

        for page, event, handler in self._handlers:
            try:
                page.off(event, handler)
            except Exception:  # pragma: no cover
                pass
        self._handlers.clear()

        har = self._build_har()
        dest = Path(path)
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(
            json.dumps(har, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )
        LOGGER.info("HAR exported to %s (%d entries)", dest, len(self._entries))
        return dest

    def get_entries(self) -> list[dict[str, Any]]:
        """Return captured entries as plain dicts."""
        return list(self._entries)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _build_har(self) -> dict[str, Any]:
        """Build a HAR 1.2-compatible JSON structure."""
        stopped_at = datetime.now(timezone.utc).isoformat()
        return {
            "log": {
                "version": "1.2",
                "creator": {
                    "name": "tester_qa",
                    "version": "1.0.0",
                },
                "browser": {
                    "name": "tester_qa",
                    "version": "1.0.0",
                },
                "pages": [
                    {
                        "startedDateTime": self._started_at or stopped_at,
                        "id": "page",
                        "title": "tester_qa HAR capture",
                        "pageTimings": {
                            "onContentLoad": -1,
                            "onLoad": -1,
                        },
                    }
                ],
                "entries": list(self._entries),
                "comment": (
                    f"Captured by tester_qa.browser.har_capture. "
                    f"{len(self._entries)} entries. "
                    f"Period: {self._started_at} → {stopped_at}."
                ),
            }
        }


# ---------------------------------------------------------------------------
# Entry builders (module-level helpers for reuse)
# ---------------------------------------------------------------------------
def _request_entry(request: Any, started_at: str | None) -> dict[str, Any]:
    """Build a HAR entry dict from a Playwright request."""
    url = getattr(request, "url", "")
    method = getattr(request, "method", "GET")
    headers: dict[str, str] = {}
    try:
        headers = dict(getattr(request, "headers", {}) or {})
    except Exception:  # pragma: no cover
        pass

    query_string = []
    try:
        parsed_url = getattr(request, "url", "")
        from urllib.parse import parse_qs, urlparse
        parsed = urlparse(parsed_url)
        query_string = [
            {"name": k, "value": v}
            for k, vals in parse_qs(parsed.query).items()
            for v in vals
        ]
    except Exception:  # pragma: no cover
        pass

    post_data: dict[str, Any] = {}
    try:
        body = getattr(request, "post_body", None) or getattr(request, "postData", None)
        if body:
            post_data = {
                "mimeType": headers.get("content-type", "application/octet-stream"),
                "text": body if isinstance(body, str) else str(body),
            }
    except Exception:  # pragma: no cover
        pass

    return {
        "startedDateTime": started_at or datetime.now(timezone.utc).isoformat(),
        "time": time.time(),
        "request": {
            "method": method,
            "url": url,
            "httpVersion": "HTTP/1.1",
            "cookies": [],
            "headers": [{"name": k, "value": str(v)} for k, v in headers.items()],
            "queryString": query_string,
            "postData": post_data,
            "headersSize": -1,
            "bodySize": len(post_data.get("text", "").encode("utf-8")) if post_data else -1,
        },
        "response": {
            "status": 0,
            "statusText": "",
            "httpVersion": "HTTP/1.1",
            "cookies": [],
            "headers": [],
            "content": {"size": -1, "mimeType": ""},
            "redirectURL": "",
            "headersSize": -1,
            "bodySize": -1,
        },
        "cache": {},
        "timings": {"blocked": -1, "dns": -1, "connect": -1, "send": 0, "wait": -1, "receive": -1},
        "pageref": "page",
    }


def _patch_response_entry(entries: list[dict[str, Any]], response: Any) -> None:
    """Patch a HAR entry with response metadata from a Playwright response."""
    url = getattr(response, "url", "")
    status = getattr(response, "status", 0)
    status_text = getattr(response, "status_text", "")
    headers: dict[str, str] = {}
    try:
        headers = dict(getattr(response, "headers", {}) or {})
    except Exception:  # pragma: no cover
        pass

    content_size = -1
    mime_type = ""
    try:
        content_size = int(getattr(response, "body_size", -1) or -1)
    except Exception:  # pragma: no cover
        pass
    try:
        mime_type = str(getattr(response, "headers", {}).get("content-type", ""))
    except Exception:  # pragma: no cover
        pass

    for entry in entries:
        if entry.get("request", {}).get("url") == url:
            entry["response"].update({
                "status": status,
                "statusText": status_text,
                "headers": [{"name": k, "value": str(v)} for k, v in headers.items()],
                "content": {
                    "size": content_size,
                    "mimeType": mime_type,
                },
                "redirectURL": headers.get("location", ""),
                "headersSize": -1,
                "bodySize": content_size,
            })
            break


def _patch_timing_entry(entries: list[dict[str, Any]], request: Any) -> None:
    """Patch a HAR entry's timing data from a Playwright requestfinished event."""
    url = getattr(request, "url", "")
    timings: dict[str, float] = {}
    try:
        timing = getattr(request, "timing", None)
        if timing:
            for key in ("blocked", "dns", "connect", "send", "wait", "receive"):
                val = getattr(timing, key, -1) or -1
                timings[key] = float(val) if val != -1 else -1
    except Exception:  # pragma: no cover
        pass

    for entry in entries:
        if entry.get("request", {}).get("url") == url:
            if timings:
                entry["timings"] = timings
            # Compute total time
            positive = [v for v in timings.values() if v > 0]
            if positive:
                entry["time"] = sum(positive)
            break
