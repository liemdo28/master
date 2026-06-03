"""Advanced screenshot capture with metadata and animation support."""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

# JS to capture viewport + page dimensions at capture time
_DIMENSIONS_JS = """() => {
    return {
        viewport: {
            width: window.innerWidth,
            height: window.innerHeight,
        },
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        pixelRatio: window.devicePixelRatio || 1,
        url: window.location.href,
        title: document.title,
    };
}"""

# JS to capture console errors at capture time
_ERRORS_JS = """() => {
    return window.__tqa_console_errors__ || [];
}"""


class ScreenshotCapture:
    """Advanced screenshot capture with metadata annotation and animated GIF support."""

    def __init__(self, root: Path | str = "evidence") -> None:
        self.root = Path(root) / "screenshots"
        self.root.mkdir(parents=True, exist_ok=True)

    def capture(
        self,
        page: Any,
        label: str,
        metadata: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        """Capture a screenshot with rich metadata.

        Args:
            page: A live Playwright page object.
            label: Descriptive label for the screenshot (used in filename).
            metadata: Optional extra metadata to embed.

        Returns:
            Dict with screenshot path, dimensions, and metadata.
        """
        session_id = metadata.get("session_id", "unknown") if metadata else "unknown"
        timestamp = int(time.time() * 1000)
        filename = f"{session_id}-{label}-{timestamp}.png"
        path = self.root / filename

        try:
            # Capture page dimensions
            dimensions = page.evaluate(_DIMENSIONS_JS)
        except Exception:
            dimensions = {}

        try:
            # Capture screenshot
            page.screenshot(path=str(path), full_page=True)
            logger.debug("[ScreenshotCapture] Saved: %s", path)
        except Exception as e:
            logger.warning("[ScreenshotCapture] Screenshot failed: %s", e)
            return {"path": "", "error": str(e)}

        # Try capturing console errors
        try:
            console_errors = page.evaluate(_ERRORS_JS)
        except Exception:
            console_errors = []

        return {
            "path": str(path),
            "filename": filename,
            "label": label,
            "captured_at": datetime.now(timezone.utc).isoformat(),
            "dimensions": dimensions,
            "console_errors": console_errors,
            "metadata": metadata or {},
        }

    def capture_animated(
        self,
        page: Any,
        duration_seconds: float = 5.0,
        interval_seconds: float = 0.5,
    ) -> list[dict[str, Any]]:
        """Capture a series of screenshots over a period to form an animation sequence.

        Args:
            page: A live Playwright page object.
            duration_seconds: Total duration to capture over.
            interval_seconds: Time between consecutive screenshots.

        Returns:
            List of capture dicts, one per frame.
        """
        frames: list[dict[str, Any]] = []
        start = time.time()
        frame_num = 0

        try:
            import playwright  # noqa: F401
        except ImportError:
            logger.warning("[ScreenshotCapture] Playwright not available — skipping animation")
            return frames

        deadline = start + duration_seconds
        while time.time() < deadline:
            elapsed = round(time.time() - start, 2)
            frame_label = f"frame-{frame_num:04d}-{elapsed:.1f}s"
            try:
                result = self.capture(
                    page,
                    label=frame_label,
                    metadata={"frame": frame_num, "elapsed": elapsed},
                )
                if result.get("path"):
                    frames.append(result)
                    logger.debug("[ScreenshotCapture] Frame %d captured (%.1fs)", frame_num, elapsed)
            except Exception as e:
                logger.warning("[ScreenshotCapture] Frame %d failed: %s", frame_num, e)

            frame_num += 1
            time.sleep(interval_seconds)

        logger.info(
            "[ScreenshotCapture] Animated capture complete — %d frames over %.1fs",
            len(frames),
            duration_seconds,
        )
        return frames

    def cleanup_old(self, max_age_hours: int = 24) -> int:
        """Remove screenshots older than max_age_hours.

        Returns:
            Number of files removed.
        """
        removed = 0
        cutoff = time.time() - (max_age_hours * 3600)
        for path in self.root.glob("*.png"):
            if path.stat().st_mtime < cutoff:
                try:
                    path.unlink()
                    removed += 1
                except Exception as e:
                    logger.debug("[ScreenshotCapture] Failed to remove %s: %s", path, e)
        if removed:
            logger.info("[ScreenshotCapture] Cleaned up %d old screenshots", removed)
        return removed
