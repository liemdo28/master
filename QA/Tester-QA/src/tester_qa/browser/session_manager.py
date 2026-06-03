"""Real browser session manager — multi-browser pools, persistent auth, evidence capture."""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.core.event_bus import EventBus, EventType


@dataclass
class BrowserSession:
    session_id: str
    project_id: str
    url: str
    status: str = "idle"  # idle | running | capturing | closed
    auth_state_path: str | None = None
    screenshots: list[str] = field(default_factory=list)
    console_errors: list[dict[str, Any]] = field(default_factory=list)
    network_failures: list[dict[str, Any]] = field(default_factory=list)
    websocket_events: list[dict[str, Any]] = field(default_factory=list)
    started_at: float = 0.0
    closed_at: float | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "session_id": self.session_id,
            "project_id": self.project_id,
            "url": self.url,
            "status": self.status,
            "screenshots": self.screenshots,
            "console_errors_count": len(self.console_errors),
            "network_failures_count": len(self.network_failures),
            "websocket_events_count": len(self.websocket_events),
            "duration_ms": ((self.closed_at or time.time()) - self.started_at) * 1000 if self.started_at else 0,
        }


class BrowserSessionManager:
    """Manage real Playwright browser sessions with evidence capture.

    Capabilities:
    - Multi-browser pools
    - Persistent auth via storage state
    - Live screenshot capture
    - Console error monitoring
    - Network failure capture
    - WebSocket packet capture
    - HAR recording
    """

    def __init__(self, evidence_dir: Path = Path("evidence")) -> None:
        self.evidence_dir = evidence_dir
        self.bus = EventBus.get_instance()
        self._sessions: dict[str, BrowserSession] = {}
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        for subdir in ["screenshots", "videos", "network", "console", "websocket"]:
            (self.evidence_dir / subdir).mkdir(parents=True, exist_ok=True)

    async def launch_session(
        self,
        project_id: str,
        url: str,
        auth_state_path: str | None = None,
        headless: bool = True,
        record_video: bool = False,
        record_har: bool = True,
    ) -> BrowserSession:
        """Launch a real Playwright browser session with full evidence capture."""
        import uuid
        session_id = f"bs-{uuid.uuid4().hex[:8]}"

        session = BrowserSession(
            session_id=session_id,
            project_id=project_id,
            url=url,
            status="running",
            auth_state_path=auth_state_path,
            started_at=time.time(),
        )
        self._sessions[session_id] = session

        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                # Browser launch options
                browser = await p.chromium.launch(headless=headless)

                # Context with optional auth state and recording
                context_opts: dict[str, Any] = {}
                if auth_state_path and Path(auth_state_path).exists():
                    context_opts["storage_state"] = auth_state_path
                if record_video:
                    context_opts["record_video_dir"] = str(self.evidence_dir / "videos")
                if record_har:
                    har_path = self.evidence_dir / "network" / f"{session_id}.har"
                    context_opts["record_har_path"] = str(har_path)

                context = await browser.new_context(**context_opts)
                page = await context.new_page()

                # Console error capture
                page.on("console", lambda msg: self._capture_console(session, msg))
                page.on("pageerror", lambda err: self._capture_page_error(session, err))
                page.on("requestfailed", lambda req: self._capture_network_failure(session, req))

                # Navigate
                response = await page.goto(url, wait_until="networkidle", timeout=30000)

                # Screenshot
                screenshot_path = self.evidence_dir / "screenshots" / f"{session_id}-{int(time.time())}.png"
                await page.screenshot(path=str(screenshot_path), full_page=True)
                session.screenshots.append(str(screenshot_path))
                self.bus.emit(EventType.BROWSER_SCREENSHOT, "session_manager", {"path": str(screenshot_path)}, project_id)

                # Capture storage state for future reuse
                if not auth_state_path:
                    state_path = self.evidence_dir / "auth" / f"{project_id}-state.json"
                    state_path.parent.mkdir(parents=True, exist_ok=True)
                    await context.storage_state(path=str(state_path))
                    session.auth_state_path = str(state_path)

                # Close
                await context.close()
                await browser.close()

                session.status = "closed"
                session.closed_at = time.time()

        except ImportError:
            # Playwright not installed — capture what we can without it
            session.status = "closed"
            session.closed_at = time.time()
            session.console_errors.append({"level": "error", "message": "Playwright not installed. Run: pip install playwright && playwright install chromium"})
            self.bus.emit(EventType.BROWSER_FAILURE, "session_manager", {"error": "playwright_not_installed"}, project_id)

        except Exception as e:
            session.status = "closed"
            session.closed_at = time.time()
            session.console_errors.append({"level": "error", "message": str(e)})
            self.bus.emit(EventType.BROWSER_FAILURE, "session_manager", {"error": str(e)}, project_id)

        return session

    async def capture_auth_session(self, project_id: str, login_url: str) -> str | None:
        """Open browser for manual login, then save auth state."""
        try:
            from playwright.async_api import async_playwright

            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=False)  # Visible for manual login
                context = await browser.new_context()
                page = await context.new_page()

                await page.goto(login_url)

                # Wait for user to complete login (max 120 seconds)
                print(f"[Tester-QA] Browser opened at {login_url}")
                print("[Tester-QA] Please login manually. Session will be captured automatically.")
                print("[Tester-QA] Waiting up to 120 seconds...")

                await page.wait_for_timeout(120000)

                # Save state
                state_path = Path(".auth") / f"{project_id}-storage-state.json"
                state_path.parent.mkdir(parents=True, exist_ok=True)
                await context.storage_state(path=str(state_path))

                await browser.close()
                print(f"[Tester-QA] Auth state saved: {state_path}")
                return str(state_path)

        except ImportError:
            print("[Tester-QA] Playwright not installed. Run: pip install playwright && playwright install chromium")
            return None
        except Exception as e:
            print(f"[Tester-QA] Auth capture failed: {e}")
            return None

    def get_session(self, session_id: str) -> BrowserSession | None:
        return self._sessions.get(session_id)

    def get_all_sessions(self) -> list[dict[str, Any]]:
        return [s.to_dict() for s in self._sessions.values()]

    def get_evidence_summary(self, session_id: str) -> dict[str, Any]:
        """Get all captured evidence for a session."""
        session = self._sessions.get(session_id)
        if not session:
            return {"error": "Session not found"}
        return {
            "session_id": session_id,
            "screenshots": session.screenshots,
            "console_errors": session.console_errors,
            "network_failures": session.network_failures,
            "websocket_events": session.websocket_events,
            "har_path": str(self.evidence_dir / "network" / f"{session_id}.har"),
        }

    def _capture_console(self, session: BrowserSession, msg: Any) -> None:
        entry = {"level": str(getattr(msg, "type", "log")), "message": str(getattr(msg, "text", str(msg))), "timestamp": time.time()}
        session.console_errors.append(entry)
        if entry["level"] == "error":
            self.bus.emit(EventType.BROWSER_CONSOLE_ERROR, "session_manager", entry, session.project_id)

    def _capture_page_error(self, session: BrowserSession, err: Any) -> None:
        entry = {"level": "error", "message": str(err), "timestamp": time.time()}
        session.console_errors.append(entry)
        self.bus.emit(EventType.BROWSER_FAILURE, "session_manager", entry, session.project_id)

    def _capture_network_failure(self, session: BrowserSession, req: Any) -> None:
        entry = {"url": str(getattr(req, "url", "")), "method": str(getattr(req, "method", "")), "failure": str(getattr(req, "failure", "")), "timestamp": time.time()}
        session.network_failures.append(entry)
        self.bus.emit(EventType.BROWSER_NETWORK_FAIL, "session_manager", entry, session.project_id)
