"""Advanced screenshot capture with annotations for evidence collection.

Provides full-page screenshots, element screenshots, auto-capture on failure,
and visual diff generation.
"""
from __future__ import annotations

import logging
import os
import shutil
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.evidence import EvidenceEngine
from tester_qa.models import EvidenceType

LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal event types
# ---------------------------------------------------------------------------
class ScreenshotEvents:
    FAILURE_CAPTURED = "SCREENSHOT_FAILURE_CAPTURED"
    COMPARISON_CREATED = "SCREENSHOT_COMPARISON_CREATED"


# ---------------------------------------------------------------------------
# Annotation helpers
# ---------------------------------------------------------------------------
try:
    from PIL import Image, ImageDraw, ImageFont
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False  # type: ignore[assignment]
    Image = None  # type: ignore[misc]
    ImageDraw = None  # type: ignore[misc]
    ImageFont = None  # type: ignore[misc]


# ---------------------------------------------------------------------------
# Internal EventBus stub
# ---------------------------------------------------------------------------
class _StubEventBus:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Any]] = {}

    def on(self, event: str, handler: Any) -> None:
        self._handlers.setdefault(event, []).append(handler)

    def emit(self, event: str, **kwargs: Any) -> None:
        for handler in self._handlers.get(event, []):
            try:
                handler(**kwargs)
            except Exception as exc:  # pragma: no cover
                LOGGER.debug("EventBus handler error for %s: %s", event, exc)


_event_bus: _StubEventBus | None = None


def _get_event_bus() -> _StubEventBus:
    global _event_bus
    if _event_bus is None:
        _event_bus = _StubEventBus()
    return _event_bus


def set_event_bus(bus: Any) -> None:
    global _event_bus
    _event_bus = bus


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------
@dataclass
class CaptureResult:
    """Result of a screenshot capture operation."""
    path: Path
    label: str
    width: int
    height: int
    full_page: bool
    annotated: bool
    timestamp: str


@dataclass
class ComparisonResult:
    """Result of a visual diff comparison."""
    before_path: Path
    after_path: Path
    diff_path: Path
    identical: bool
    diff_pixel_count: int
    diff_ratio: float


# ---------------------------------------------------------------------------
# ScreenshotEngine
# ---------------------------------------------------------------------------
class ScreenshotEngine:
    """Advanced screenshot capture with annotations and failure auto-capture.

    Usage::

        engine = ScreenshotEngine()
        with pool.acquire() as context:
            page = context.new_page()
            result = engine.capture(page, "homepage", Path("shot.png"))
            error_result = engine.capture_on_failure(page, "INC-001")
    """

    DEFAULT_OUTPUT_DIR = Path("evidence") / "screenshots"

    def __init__(
        self,
        evidence_engine: EvidenceEngine | None = None,
        output_dir: Path | str | None = None,
        annotate: bool = True,
    ) -> None:
        self._engine = evidence_engine or EvidenceEngine()
        self._output_dir = Path(output_dir or self.DEFAULT_OUTPUT_DIR)
        self._annotate = annotate
        self._js_error_listeners: list[tuple[Any, Any]] = []  # (page, handler)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    def capture(
        self,
        page: Any,
        label: str,
        path: Path | str | None = None,
        *,
        annotate: bool | None = None,
        full_page: bool = True,
        timeout: int = 30000,
    ) -> CaptureResult:
        """Take a full-page screenshot.

        Args:
            page: A playwright.sync_api.Page.
            label: Human-readable label for the screenshot (used in filename/annotation).
            path: Optional explicit output path. If omitted, one is auto-generated
                  inside ``evidence/screenshots/``.
            annotate: Whether to draw a timestamp watermark. Defaults to the
                      engine's ``annotate`` setting.
            full_page: Capture the entire scrollable page (default True).
            timeout: Screenshot timeout in milliseconds (default 30000).

        Returns:
            A ``CaptureResult`` describing the captured image.
        """
        use_annotate = annotate if annotate is not None else self._annotate
        dest = self._resolve_path(path, label)
        dest.parent.mkdir(parents=True, exist_ok=True)

        page.screenshot(
            path=str(dest),
            full_page=full_page,
            timeout=timeout,
        )

        if use_annotate:
            self._annotate_image(dest, label)

        width, height = self._image_dimensions(dest)
        return CaptureResult(
            path=dest,
            label=label,
            width=width,
            height=height,
            full_page=full_page,
            annotated=use_annotate,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def capture_element(
        self,
        page: Any,
        selector: str,
        label: str,
        path: Path | str | None = None,
        *,
        annotate: bool | None = None,
        timeout: int = 10000,
    ) -> CaptureResult:
        """Take a screenshot of a specific DOM element.

        Args:
            page: A playwright.sync_api.Page.
            selector: CSS or XPath selector for the target element.
            label: Human-readable label.
            path: Optional explicit output path.
            annotate: Whether to add the timestamp watermark.
            timeout: Element screenshot timeout in milliseconds.

        Returns:
            A ``CaptureResult``.
        """
        use_annotate = annotate if annotate is not None else self._annotate
        dest = self._resolve_path(path, label, suffix=f"_{selector.replace(' ', '_').replace('/', '_')}")
        dest.parent.mkdir(parents=True, exist_ok=True)

        element = page.locator(selector)
        element.screenshot(path=str(dest), timeout=timeout)

        if use_annotate:
            self._annotate_image(dest, label)

        width, height = self._image_dimensions(dest)
        return CaptureResult(
            path=dest,
            label=label,
            width=width,
            height=height,
            full_page=False,
            annotated=use_annotate,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    def capture_on_failure(
        self,
        page: Any,
        incident_id: str,
        output_dir: Path | str | None = None,
        *,
        console_error_selectors: list[str] | None = None,
    ) -> CaptureResult | None:
        """Auto-capture screenshot when JS errors are detected.

        Attaches a one-shot console error listener to ``page``. When any
        console error fires, a screenshot is immediately taken and the
        listener is removed. The screenshot is saved under
        ``evidence/screenshots/{incident_id}/``.

        Args:
            page: A playwright.sync_api.Page.
            incident_id: Incident identifier, used as the subdirectory name.
            output_dir: Override the screenshot output directory.
            console_error_selectors: Optional list of CSS selectors. Elements
                                     matching these selectors will have a red
                                     border drawn on the captured screenshot.

        Returns:
            A ``CaptureResult`` if an error was captured, otherwise ``None``.
        """
        dest_dir = Path(output_dir or self._output_dir) / incident_id
        dest_dir.mkdir(parents=True, exist_ok=True)

        timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        dest = dest_dir / f"failure-{timestamp_str}.png"

        captured_ref: dict[str, CaptureResult | None] = {"result": None}

        def on_console_error(msg: Any) -> None:
            if getattr(msg, "type", None) != "error":
                return
            if captured_ref["result"] is not None:
                return
            try:
                page.screenshot(path=str(dest), full_page=True)
                # Optionally draw red border around error elements
                if console_error_selectors:
                    for sel in console_error_selectors:
                        self._draw_border_on_element(page, sel, dest)
                self._annotate_image(dest, f"FAILURE: {getattr(msg, 'text', '')}")
                captured_ref["result"] = CaptureResult(
                    path=dest,
                    label=incident_id,
                    width=0,
                    height=0,
                    full_page=True,
                    annotated=True,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
                try:
                    captured_ref["result"].width, captured_ref["result"].height = self._image_dimensions(dest)
                except Exception:  # pragma: no cover
                    pass
                bus = _get_event_bus()
                bus.emit(
                    ScreenshotEvents.FAILURE_CAPTURED,
                    incident_id=incident_id,
                    path=str(dest),
                    error_text=str(getattr(msg, "text", "")),
                )
                LOGGER.info(
                    "Failure screenshot captured for incident %s at %s",
                    incident_id,
                    dest,
                )
            except Exception as exc:  # pragma: no cover
                LOGGER.warning("Failed to capture failure screenshot: %s", exc)

        def on_page_error(err: Any) -> None:
            if captured_ref["result"] is not None:
                return
            try:
                page.screenshot(path=str(dest), full_page=True)
                self._annotate_image(dest, f"PAGE_ERROR: {err}")
                captured_ref["result"] = CaptureResult(
                    path=dest,
                    label=incident_id,
                    width=0,
                    height=0,
                    full_page=True,
                    annotated=True,
                    timestamp=datetime.now(timezone.utc).isoformat(),
                )
                try:
                    captured_ref["result"].width, captured_ref["result"].height = self._image_dimensions(dest)
                except Exception:  # pragma: no cover
                    pass
                bus = _get_event_bus()
                bus.emit(
                    ScreenshotEvents.FAILURE_CAPTURED,
                    incident_id=incident_id,
                    path=str(dest),
                    error_text=str(err),
                )
            except Exception as exc:  # pragma: no cover
                LOGGER.warning("Failed to capture page-error screenshot: %s", exc)

        try:
            page.on("console", on_console_error)
            page.on("pageerror", on_page_error)
            self._js_error_listeners.append((page, on_console_error))
            self._js_error_listeners.append((page, on_page_error))
        except Exception as exc:  # pragma: no cover
            LOGGER.warning("Failed to attach failure listeners: %s", exc)

        return captured_ref["result"]

    def create_comparison(
        self,
        before_path: Path | str,
        after_path: Path | str,
        diff_path: Path | str,
    ) -> ComparisonResult:
        """Create a visual diff between two screenshots.

        Uses Pillow to compute per-pixel differences and generates a diff
        image with differing pixels highlighted in red.

        Args:
            before_path: Path to the "before" screenshot.
            after_path: Path to the "after" screenshot.
            diff_path: Destination for the diff image.

        Returns:
            A ``ComparisonResult`` describing the comparison.
        """
        before = Path(before_path)
        after = Path(after_path)
        diff = Path(diff_path)

        if not _PIL_AVAILABLE:
            raise ImportError(
                "Pillow is required for visual diff. Run: pip install pillow"
            )
        if not before.exists():
            raise FileNotFoundError(f"before_path does not exist: {before}")
        if not after.exists():
            raise FileNotFoundError(f"after_path does not exist: {after}")

        diff.parent.mkdir(parents=True, exist_ok=True)

        img_before = Image.open(before)
        img_after = Image.open(after)

        # Resize to match if dimensions differ
        if img_before.size != img_after.size:
            LOGGER.info(
                "Image dimensions differ (%s vs %s) — resizing after to before",
                img_before.size,
                img_after.size,
            )
            img_after = img_after.resize(img_before.size, Image.LANCZOS)

        # Compute diff
        diff_image = Image.new("RGB", img_before.size, (255, 255, 255))
        draw = ImageDraw.Draw(diff_image)

        total_pixels = img_before.size[0] * img_before.size[1]
        diff_pixels = 0
        pixel_diff_threshold = 10  # ignore minor anti-aliasing noise

        pixels_before = img_before.load()
        pixels_after = img_after.load()

        for y in range(img_before.size[1]):
            for x in range(img_before.size[0]):
                r1, g1, b1 = pixels_before[x, y][:3]
                r2, g2, b2 = pixels_after[x, y][:3]
                if abs(int(r1) - int(r2)) + abs(int(g1) - int(g2)) + abs(int(b1) - int(b2)) > pixel_diff_threshold:
                    diff_pixels += 1
                    # Highlight difference in red
                    draw.point((x, y), fill=(255, 0, 0))

        diff_image.save(diff)
        ratio = diff_pixels / total_pixels if total_pixels > 0 else 0.0
        identical = diff_pixels == 0

        bus = _get_event_bus()
        bus.emit(
            ScreenshotEvents.COMPARISON_CREATED,
            before=str(before),
            after=str(after),
            diff=str(diff),
            identical=identical,
            diff_ratio=ratio,
        )

        return ComparisonResult(
            before_path=before,
            after_path=after,
            diff_path=diff,
            identical=identical,
            diff_pixel_count=diff_pixels,
            diff_ratio=ratio,
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _resolve_path(
        self,
        path: Path | str | None,
        label: str,
        suffix: str = "",
    ) -> Path:
        if path:
            return Path(path)
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
        safe_label = label.replace(" ", "_").replace("/", "_")
        return self._output_dir / f"screenshot_{safe_label}{suffix}_{timestamp}.png"

    def _annotate_image(self, path: Path, label: str) -> None:
        """Draw a timestamp watermark on an image."""
        if not _PIL_AVAILABLE:
            LOGGER.debug("Pillow not available — skipping annotation")
            return
        try:
            img = Image.open(path)
            draw = ImageDraw.Draw(img)
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
            text = f"[{ts}] {label}"

            # Try a small font, fall back to default
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Monaco.ttf", 18)
            except Exception:  # pragma: no cover
                font = ImageFont.load_default()

            # Draw semi-transparent background box for readability
            bbox = draw.textbbox((0, 0), text, font=font)
            box_w = bbox[2] - bbox[0] + 10
            box_h = bbox[3] - bbox[1] + 6
            x, y = 10, img.height - box_h - 10
            draw.rectangle([x, y, x + box_w, y + box_h], fill=(0, 0, 0, 160))
            draw.text((x + 5, y + 2), text, fill=(255, 255, 255), font=font)
            img.save(path)
        except Exception as exc:  # pragma: no cover
            LOGGER.debug("Failed to annotate screenshot %s: %s", path, exc)

    def _draw_border_on_element(
        self,
        page: Any,
        selector: str,
        image_path: Path,
    ) -> None:
        """Draw a red border around an element in an existing screenshot."""
        if not _PIL_AVAILABLE:
            return
        try:
            box = page.locator(selector).bounding_box()
            if box is None:
                LOGGER.debug("Element %s not visible for border annotation", selector)
                return
            img = Image.open(image_path)
            draw = ImageDraw.Draw(img)
            x = int(box["x"])
            y = int(box["y"])
            w = int(box["width"])
            h = int(box["height"])
            draw.rectangle([x, y, x + w, y + h], outline=(255, 0, 0), width=3)
            img.save(image_path)
        except Exception as exc:  # pragma: no cover
            LOGGER.debug("Failed to draw element border on %s: %s", image_path, exc)

    @staticmethod
    def _image_dimensions(path: Path) -> tuple[int, int]:
        if _PIL_AVAILABLE:
            try:
                with Image.open(path) as img:
                    return img.size
            except Exception:  # pragma: no cover
                pass
        # Fallback via file size heuristics or return 0
        return 0, 0
