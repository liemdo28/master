"""Browser pool manager for reusing Playwright browser contexts.

Provides a thread-safe pool of pre-warmed browser contexts to avoid the
overhead of launching a new browser per test.
"""
from __future__ import annotations

import logging
import threading
from contextlib import contextmanager
from dataclasses import dataclass
from typing import TYPE_CHECKING, Generator

if TYPE_CHECKING:
    from playwright.sync_api import Browser, BrowserContext, Playwright

LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal event types (for use with EventBus integration)
# ---------------------------------------------------------------------------
class BrowserPoolEvents:
    CONTEXT_ACQUIRED = "BROWSER_POOL_CONTEXT_ACQUIRED"
    CONTEXT_RELEASED = "BROWSER_POOL_CONTEXT_RELEASED"
    POOL_EXHAUSTED = "BROWSER_POOL_EXHAUSTED"
    POOL_CLOSED = "BROWSER_POOL_CLOSED"


# ---------------------------------------------------------------------------
# Stats dataclass
# ---------------------------------------------------------------------------
@dataclass
class PoolStats:
    """Snapshot of the browser pool's current state."""
    active_count: int
    idle_count: int
    total_count: int


# ---------------------------------------------------------------------------
# Attempt import playwright — handle both playwright and playwright_sync
# ---------------------------------------------------------------------------
try:
    from playwright.sync_api import sync_playwright as _get_playwright
except ImportError:
    _get_playwright = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# BrowserPool
# ---------------------------------------------------------------------------
class BrowserPool:
    """Thread-safe pool of reusable Playwright browser contexts.

    Args:
        size: Maximum number of idle contexts to keep warm (default 4).
        headless: Whether to launch browsers in headless mode (default True).
        browser_type: Which browser to launch — "chromium", "firefox", or "webkit".
        **launch_kwargs: Additional arguments passed to browser.launch().

    Example::

        pool = BrowserPool(size=4)
        with pool.acquire() as context:
            page = context.new_page()
            page.goto("https://example.com")
        pool.close_all()
    """

    def __init__(
        self,
        size: int = 4,
        headless: bool = True,
        browser_type: str = "chromium",
        **launch_kwargs: bool | list[str] | None,
    ) -> None:
        if size < 1:
            raise ValueError(f"Pool size must be >= 1, got {size}")
        self._size = size
        self._headless = headless
        self._browser_type = browser_type
        self._launch_kwargs = launch_kwargs

        self._playwright: Playwright | None = None  # type: ignore[assignment]
        self._browser: Browser | None = None
        self._idle: list[BrowserContext] = []  # type: ignore[assignment]
        self._active: set[BrowserContext] = set()
        self._lock = threading.Lock()
        self._closed = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------
    @contextmanager
    def acquire(self) -> Generator[BrowserContext, None, None]:  # type: ignore[type-arg]
        """Acquire an available browser context (blocking if pool is empty).

        Returns a context manager — the context is automatically returned
        to the pool when the ``with`` block exits.

        Raises:
            RuntimeError: If the pool has been closed.
            ImportError: If the playwright library is not installed.
        """
        if self._closed:
            raise RuntimeError("BrowserPool has been closed")
        context = self._do_acquire()
        try:
            yield context
        finally:
            self.release(context)

    def release(self, context: BrowserContext) -> None:  # type: ignore[type-arg]
        """Return a context to the pool.

        If the pool is already at capacity the context is closed instead.
        Idempotent — safe to call multiple times on the same context.
        """
        with self._lock:
            if context not in self._active:
                return
            self._active.discard(context)
            if len(self._idle) < self._size:
                try:
                    context.clear_cookies()
                except Exception as exc:  # pragma: no cover
                    LOGGER.debug("Failed to clear cookies on release: %s", exc)
                self._idle.append(context)
                LOGGER.debug(
                    "Context released — active=%d idle=%d",
                    len(self._active),
                    len(self._idle),
                )
            else:
                try:
                    context.close()
                except Exception as exc:  # pragma: no cover
                    LOGGER.debug("Failed to close surplus context: %s", exc)

    def close_all(self) -> None:
        """Close all browser contexts and shut down the Playwright runtime."""
        with self._lock:
            if self._closed:
                return
            self._closed = True
            for ctx in list(self._idle) + list(self._active):
                try:
                    ctx.close()
                except Exception as exc:  # pragma: no cover
                    LOGGER.debug("Error closing context during close_all: %s", exc)
            self._idle.clear()
            self._active.clear()
            if self._browser is not None:
                try:
                    self._browser.close()
                except Exception as exc:  # pragma: no cover
                    LOGGER.debug("Error closing browser during close_all: %s", exc)
                self._browser = None
            if self._playwright is not None:
                try:
                    self._playwright.stop()
                except Exception as exc:  # pragma: no cover
                    LOGGER.debug("Error stopping playwright during close_all: %s", exc)
                self._playwright = None

    def get_stats(self) -> PoolStats:
        """Return a snapshot of the pool's current state."""
        with self._lock:
            return PoolStats(
                active_count=len(self._active),
                idle_count=len(self._idle),
                total_count=len(self._active) + len(self._idle),
            )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _ensure_initialised(self) -> None:
        if self._playwright is not None:
            return
        if _get_playwright is None:
            raise ImportError(
                "playwright is not installed. Run: pip install playwright && playwright install"
            )
        self._playwright = _get_playwright()
        browser_launcher = getattr(self._playwright, self._browser_type)
        self._browser = browser_launcher.launch(headless=self._headless, **self._launch_kwargs)
        # Pre-warm the pool
        for _ in range(self._size):
            try:
                self._idle.append(self._browser.new_context())
            except Exception as exc:  # pragma: no cover
                LOGGER.warning("Failed to pre-warm context: %s", exc)
                break

    def _do_acquire(self) -> BrowserContext:  # type: ignore[type-arg]
        with self._lock:
            if self._idle:
                ctx = self._idle.pop()
                self._active.add(ctx)
                return ctx
        # Need to create a new context outside the lock
        self._ensure_initialised()
        with self._lock:
            # Double-check after initialising
            if self._idle:
                ctx = self._idle.pop()
                self._active.add(ctx)
                return ctx
            # Pool not full yet — create a new context
            ctx = self._browser.new_context()  # type: ignore[union-attr]
            self._active.add(ctx)
            return ctx
