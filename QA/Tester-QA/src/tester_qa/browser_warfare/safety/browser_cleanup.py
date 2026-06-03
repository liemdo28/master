"""Browser resource cleanup after warfare execution."""
from __future__ import annotations

import gc
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Tracks pages/contexts opened by this module
_active_pages: list[Any] = []
_active_contexts: list[Any] = []
_active_browsers: list[Any] = []


def _register_page(page: Any) -> None:
    _active_pages.append(page)


def _register_context(context: Any) -> None:
    _active_contexts.append(context)


def _register_browser(browser: Any) -> None:
    _active_browsers.append(browser)


class BrowserCleanup:
    """Handles cleanup of Playwright browser resources after warfare execution."""

    def cleanup_all(self) -> dict[str, int]:
        """Close all registered Playwright pages, contexts, and browsers.

        Returns:
            Dict with counts of items cleaned up.
        """
        counts = {"pages": 0, "contexts": 0, "browsers": 0}

        for page in list(_active_pages):
            try:
                page.close()
                counts["pages"] += 1
            except Exception as e:
                logger.debug("[BrowserCleanup] Page close error: %s", e)
            finally:
                if page in _active_pages:
                    _active_pages.remove(page)

        for context in list(_active_contexts):
            try:
                context.close()
                counts["contexts"] += 1
            except Exception as e:
                logger.debug("[BrowserCleanup] Context close error: %s", e)
            finally:
                if context in _active_contexts:
                    _active_contexts.remove(context)

        for browser in list(_active_browsers):
            try:
                browser.close()
                counts["browsers"] += 1
            except Exception as e:
                logger.debug("[BrowserCleanup] Browser close error: %s", e)
            finally:
                if browser in _active_browsers:
                    _active_browsers.remove(browser)

        logger.info(
            "[BrowserCleanup] Cleaned up: %d pages, %d contexts, %d browsers",
            counts["pages"],
            counts["contexts"],
            counts["browsers"],
        )
        return counts

    def cleanup_page(self, page: Any) -> None:
        """Close a single Playwright page."""
        try:
            page.close()
            logger.debug("[BrowserCleanup] Page closed")
        except Exception as e:
            logger.debug("[BrowserCleanup] Page close error: %s", e)

    def force_gc(self) -> None:
        """Force garbage collection to release JS heap pressure."""
        collected = gc.collect()
        logger.debug("[BrowserCleanup] GC collected %d objects", collected)
