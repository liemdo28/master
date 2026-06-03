"""Session Cluster — manages a cluster of browser sessions for distributed warfare."""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from threading import Lock
from typing import Any

LOGGER = logging.getLogger(__name__)


@dataclass
class BrowserSession:
    """Represents a single managed browser session in the cluster."""

    session_id: str
    browser_idx: int
    status: str = "idle"  # idle | running | done | crashed
    started_at: str = ""
    ended_at: str = ""
    scenario: str = ""
    url: str = ""
    error: str = ""
    result: dict[str, Any] = field(default_factory=dict)


class SessionCluster:
    """Manages a cluster of Playwright browser sessions for coordinated warfare attacks."""

    def __init__(self, size: int = 10) -> None:
        self.size = size
        self._sessions: list[BrowserSession] = []
        self._lock = Lock()
        self._playwright = None
        self._browsers: list[Any] = []
        self._pages: list[Any] = []
        self._closed = False

        # Pre-allocate session slots
        for idx in range(size):
            self._sessions.append(
                BrowserSession(
                    session_id=uuid.uuid4().hex[:8],
                    browser_idx=idx,
                )
            )

    def launch_all(self, scenario: str, url: str) -> list[dict]:
        """Launch all sessions in the cluster, running the given scenario.

        Each session gets its own browser context.  Returns a list of results.
        """
        results: list[dict] = []
        self._acquire_playwright()

        for session in self._sessions:
            session.status = "running"
            session.scenario = scenario
            session.url = url
            session.started_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

            try:
                browser = self._playwright.chromium.launch(headless=True)
                context = browser.new_context()
                page = context.new_page()
                self._browsers.append(browser)
                self._pages.append(page)

                page.goto(url, wait_until="domcontentloaded", timeout=30000)

                # Inject warfare payload based on scenario
                outcome = self._run_scenario(page, scenario)
                session.status = "done"
                session.result = outcome
                results.append(
                    {
                        "session_id": session.session_id,
                        "browser_idx": session.browser_idx,
                        "scenario": scenario,
                        "status": "done",
                        "result": outcome,
                    }
                )
            except Exception as e:
                LOGGER.exception("[SessionCluster] Session %s crashed: %s", session.session_id, e)
                session.status = "crashed"
                session.error = str(e)
                results.append(
                    {
                        "session_id": session.session_id,
                        "browser_idx": session.browser_idx,
                        "scenario": scenario,
                        "status": "crashed",
                        "error": str(e),
                    }
                )
            finally:
                session.ended_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        return results

    def kill_all(self) -> None:
        """Force-close all browser sessions in the cluster."""
        LOGGER.info("[SessionCluster] Killing all %d sessions", self.size)
        with self._lock:
            for browser in self._browsers:
                try:
                    browser.close()
                except Exception as e:
                    LOGGER.warning("[SessionCluster] Error closing browser: %s", e)
            self._browsers.clear()
            self._pages.clear()

            for session in self._sessions:
                if session.status == "running":
                    session.status = "killed"
                    session.ended_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    def get_health(self) -> dict[str, Any]:
        """Return health metrics for the entire cluster."""
        counts = {"idle": 0, "running": 0, "done": 0, "crashed": 0, "killed": 0}
        for s in self._sessions:
            counts[s.status] = counts.get(s.status, 0) + 1

        return {
            "size": self.size,
            "status_counts": counts,
            "healthy": counts["running"] > 0 or counts["done"] == self.size,
            "sessions": [
                {
                    "session_id": s.session_id,
                    "browser_idx": s.browser_idx,
                    "status": s.status,
                    "scenario": s.scenario,
                    "url": s.url,
                    "error": s.error,
                    "started_at": s.started_at,
                    "ended_at": s.ended_at,
                }
                for s in self._sessions
            ],
        }

    def get_session(self, browser_idx: int) -> BrowserSession | None:
        """Return a specific session by browser index."""
        if 0 <= browser_idx < self.size:
            return self._sessions[browser_idx]
        return None

    # ─── Private helpers ────────────────────────────────────────────────────────

    def _acquire_playwright(self) -> None:
        if self._playwright is None:
            from playwright.sync_api import sync_playwright
            self._playwright = sync_playwright().start()

    def _run_scenario(self, page: Any, scenario: str) -> dict[str, Any]:
        """Execute a simple warfare scenario inline via JS injection."""
        scenarios_js: dict[str, str] = {
            "memory_bomb": """
                (function() {
                    var leaks = [];
                    for (var i = 0; i < 100; i++) {
                        leaks.push(new Array(10000).fill('mem-leak-' + i));
                    }
                    window.__MEM_LEAKS__ = leaks;
                    var count = 0;
                    var container = document.createElement('div');
                    document.body.appendChild(container);
                    for (var i = 0; i < 5000; i++) {
                        var el = document.createElement('div');
                        el.textContent = 'MB ' + i + ' ' + new Array(100).join('X');
                        container.appendChild(el);
                        count++;
                    }
                    return { leaks: leaks.length, dom_nodes: count };
                })();
            """,
            "hydration_breaker": """
                (function() {
                    var corruptions = 0;
                    var container = document.createElement('div');
                    container.setAttribute('data-hydration', 'corrupted');
                    document.body.appendChild(container);
                    for (var i = 0; i < 100; i++) {
                        var el = document.createElement('span');
                        el.setAttribute('data-mismatch', 'true');
                        el.textContent = 'HC-' + i;
                        container.appendChild(el);
                        corruptions++;
                    }
                    window.__HYDRATION_CORRUPTIONS__ = corruptions;
                    return { corruptions: corruptions };
                })();
            """,
            "async_deadlock": """
                (function() {
                    var chains = 0;
                    for (var d = 0; d < 50; d++) {
                        (function(depth) {
                            var p = Promise.resolve(depth);
                            for (var k = 0; k < 30; k++) {
                                p = p.then(function(v) { return Promise.resolve(v - 1); });
                            }
                            chains++;
                        })(d);
                    }
                    window.__ASYNC_CHAINS__ = chains;
                    return { chains: chains };
                })();
            """,
            "render_flood": """
                (function() {
                    var reflows = 0;
                    var container = document.createElement('div');
                    document.body.appendChild(container);
                    for (var i = 0; i < 1000; i++) {
                        var el = document.createElement('div');
                        el.style.color = 'rgb(' + (i % 255) + ',' + (i % 200) + ',' + (i % 150) + ')';
                        el.textContent = 'RF-' + i;
                        container.appendChild(el);
                        reflows++;
                        if (i % 50 === 0) { document.body.offsetHeight; }
                    }
                    return { reflows: reflows };
                })();
            """,
            "websocket": """
                (function() {
                    var opened = 0;
                    var url = window.location.href.replace('http', 'ws') + '/ws';
                    for (var c = 0; c < 20; c++) {
                        try {
                            var ws = new WebSocket(url);
                            ws.onopen = function() { opened++; ws.close(); };
                            ws.onerror = function() {};
                        } catch(e) {}
                    }
                    window.__WS_OPENED__ = opened;
                    return { connections_attempted: 20, connections_opened: opened };
                })();
            """,
        }

        js = scenarios_js.get(scenario, "return {};")
        try:
            raw = page.evaluate(js)
            return {"scenario": scenario, "outcome": raw, "status": "ok"}
        except Exception as e:
            return {"scenario": scenario, "outcome": None, "status": "error", "error": str(e)}
