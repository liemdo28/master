"""Browser Warfare Orchestrator — coordinates all browser destruction modules.

Orchestrates memory bombs, hydration breakers, async deadlocks, render floods,
infinite navigation, and websocket swarms against a target URL using Playwright.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.browser_warfare.browser_memory_bomb import (
    BrowserMemoryBomb,
    BrowserMemoryBombConfig,
    BrowserMemoryBombResult,
)
from tester_qa.browser_warfare.hydration_breaker import (
    HydrationBreaker,
    HydrationBreakerConfig,
    HydrationBreakerResult,
)
from tester_qa.browser_warfare.async_deadlock import (
    AsyncDeadlock,
    AsyncDeadlockConfig,
    AsyncDeadlockResult,
)
from tester_qa.browser_warfare.render_flood import (
    RenderFlood,
    RenderFloodConfig,
    RenderFloodResult,
)
from tester_qa.browser_warfare.infinite_navigation import (
    InfiniteNavigation,
    InfiniteNavigationConfig,
    InfiniteNavigationResult,
)
from tester_qa.browser_warfare.websocket_swarm import (
    WebSocketSwarm,
    WebSocketSwarmConfig,
    WebSocketSwarmResult,
)

from tester_qa.browser_warfare.recovery import (
    WarfareRecoveryValidator,
)
from tester_qa.browser_warfare.forensics import (
    WarfareTimeline,
    WarfareReconstructor,
)

LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class BrowserWarfareScenario:
    id: str
    label: str
    modules: list[str]
    danger: str  # low | medium | high | extreme
    description: str


# Predefined scenarios
SCENARIOS: dict[str, BrowserWarfareScenario] = {
    "memory_bomb": BrowserWarfareScenario(
        id="memory_bomb",
        label="Memory Bomb",
        modules=["memory"],
        danger="high",
        description="Aggressive JS heap allocation + closure leaks + DOM floods",
    ),
    "hydration_breaker": BrowserWarfareScenario(
        id="hydration_breaker",
        label="Hydration Breaker",
        modules=["hydration"],
        danger="high",
        description="SSR hydration contract violations + state corruptions",
    ),
    "async_deadlock": BrowserWarfareScenario(
        id="async_deadlock",
        label="Async Deadlock",
        modules=["async"],
        danger="high",
        description="Promise chain deadlocks + unhandled rejection bombs",
    ),
    "render_flood": BrowserWarfareScenario(
        id="render_flood",
        label="Render Flood",
        modules=["render"],
        danger="medium",
        description="DOM render queue flooding + style recalculation storms",
    ),
    "infinite_navigation": BrowserWarfareScenario(
        id="infinite_navigation",
        label="Infinite Navigation",
        modules=["navigation"],
        danger="medium",
        description="Route loops + history explosion + navigation memory leaks",
    ),
    "websocket_apocalypse": BrowserWarfareScenario(
        id="websocket_apocalypse",
        label="WebSocket Apocalypse",
        modules=["websocket"],
        danger="extreme",
        description="WebSocket swarm + reconnect storm + message flood + state corruption",
    ),
    "total_browser_warfare": BrowserWarfareScenario(
        id="total_browser_warfare",
        label="TOTAL Browser Warfare",
        modules=["memory", "hydration", "async", "render", "navigation", "websocket"],
        danger="extreme",
        description="All browser warfare modules simultaneously",
    ),
}


@dataclass
class BrowserWarfareResult:
    scenario: str
    url: str
    started_at: str
    completed_at: str = ""
    success: bool = True
    modules_executed: list[str] = field(default_factory=list)
    memory: dict[str, Any] = field(default_factory=dict)
    hydration: dict[str, Any] = field(default_factory=dict)
    async_deadlock: dict[str, Any] = field(default_factory=dict)
    render_flood: dict[str, Any] = field(default_factory=dict)
    navigation: dict[str, Any] = field(default_factory=dict)
    websocket: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    screenshot_path: str = ""
    console_errors: list[str] = field(default_factory=list)
    # Recovery & forensics fields
    recovery_score: float = 0.0
    recovery_report: dict[str, Any] = field(default_factory=dict)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    forensic_report: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "scenario": self.scenario,
            "url": self.url,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "success": self.success,
            "modules_executed": self.modules_executed,
            "memory": self.memory,
            "hydration": self.hydration,
            "async_deadlock": self.async_deadlock,
            "render_flood": self.render_flood,
            "navigation": self.navigation,
            "websocket": self.websocket,
            "errors": self.errors,
            "screenshot_path": self.screenshot_path,
            "console_errors": self.console_errors,
            "recovery_score": round(self.recovery_score, 2),
            "recovery_report": self.recovery_report,
            "timeline": self.timeline,
            "forensic_report": self.forensic_report,
        }


class BrowserWarfareOrchestrator:
    """Orchestrates browser warfare modules against a target URL via Playwright."""

    def __init__(
        self,
        evidence_root: Path | str = "evidence",
        timeout_seconds: int = 30,
        recovery_window_secs: float = 5.0,
        enable_forensics: bool = True,
        enable_recovery: bool = True,
    ) -> None:
        self.evidence_root = Path(evidence_root)
        self.timeout_seconds = timeout_seconds
        self.recovery_window_secs = recovery_window_secs
        self.enable_forensics = enable_forensics
        self.enable_recovery = enable_recovery
        self._console_errors: list[str] = []
        self._recovery_validator = WarfareRecoveryValidator(
            recovery_window_secs=recovery_window_secs,
        )
        self._reconstructor = WarfareReconstructor()

    def execute_scenario(
        self,
        scenario_id: str,
        url: str,
        ws_url: str = "",
    ) -> BrowserWarfareResult:
        """Execute a browser warfare scenario against the target URL."""
        scenario = SCENARIOS.get(scenario_id)
        if not scenario:
            return BrowserWarfareResult(
                scenario=scenario_id,
                url=url,
                started_at=datetime.now(timezone.utc).isoformat(),
                completed_at=datetime.now(timezone.utc).isoformat(),
                success=False,
                errors=[f"Unknown scenario: {scenario_id}"],
            )

        result = BrowserWarfareResult(
            scenario=scenario_id,
            url=url,
            started_at=datetime.now(timezone.utc).isoformat(),
        )

        # Initialise timeline for this session
        timeline = WarfareTimeline(session_id=f"{scenario_id}-{int(time.time())}")
        timeline.add_event(
            event_type="warfare_start",
            phase="before",
            data={"url": url, "scenario": scenario_id, "modules": scenario.modules},
        )

        # Capture pre-warfare baseline
        before_metrics: dict[str, Any] = {}

        try:
            page = self._launch_browser(url)
            try:
                # Capture before-metrics before warfare
                before_metrics = self._capture_page_metrics(page)

                for module in scenario.modules:
                    # Snapshot before this module
                    timeline.add_snapshot(f"before_{module}", self._capture_page_metrics(page))

                    self._execute_module(
                        page, module, url, ws_url, result, timeline
                    )

                    # Snapshot after this module
                    timeline.add_snapshot(f"after_{module}", self._capture_page_metrics(page))

                    time.sleep(1)  # Cooldown between modules

                # Capture post-warfare screenshot
                result.screenshot_path = self._capture_screenshot(page, scenario_id)

                # ── Recovery validation ──────────────────────────────────────────
                if self.enable_recovery:
                    self._run_recovery_validation(page, result, before_metrics, timeline)

                # ── Timeline finalisation ───────────────────────────────────────
                timeline.add_event(
                    event_type="snapshot",
                    phase="after",
                    data={"label": "post_warfare", "metrics": self._capture_page_metrics(page)},
                )

                # ── Forensic reconstruction ──────────────────────────────────────
                if self.enable_forensics:
                    forensic = self._run_forensic_reconstruction(result, timeline)
                    result.forensic_report = forensic.to_dict()

                result.timeline = timeline.build()

            finally:
                self._close_browser(page)

        except Exception as e:
            LOGGER.exception("[BrowserWarfare] Scenario failed: %s", e)
            result.errors.append(str(e))
            result.success = False
            timeline.add_collapse_event(
                collapse_type="orchestrator_error",
                evidence={"error": str(e)},
            )

        result.completed_at = datetime.now(timezone.utc).isoformat()
        return result

    def _launch_browser(self, url: str):
        """Launch Playwright browser and navigate to URL."""
        from playwright.sync_api import sync_playwright

        playwright = sync_playwright().start()
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Capture console errors
        self._console_errors = []
        page.on(
            "console",
            lambda msg: self._console_errors.append(f"[{msg.type}] {msg.text}")
            if msg.type == "error"
            else None,
        )

        page.goto(url, wait_until="domcontentloaded", timeout=self.timeout_seconds * 1000)
        return page

    def _close_browser(self, page) -> None:
        """Close the browser cleanly."""
        try:
            page.context.browser.close()
        except Exception:
            pass

    def _execute_module(
        self,
        page,
        module: str,
        url: str,
        ws_url: str,
        result: BrowserWarfareResult,
        timeline: WarfareTimeline,
    ) -> None:
        """Execute a single browser warfare module."""
        try:
            if module == "memory":
                result.modules_executed.append("memory")
                result.memory = self._run_memory_bomb(page)
                timeline.add_event(
                    event_type="memory_bomb",
                    phase="during",
                    data=result.memory,
                )
            elif module == "hydration":
                result.modules_executed.append("hydration")
                result.hydration = self._run_hydration_breaker(page)
                timeline.add_event(
                    event_type="hydration_break",
                    phase="during",
                    data=result.hydration,
                )
            elif module == "async":
                result.modules_executed.append("async")
                result.async_deadlock = self._run_async_deadlock(page)
                timeline.add_event(
                    event_type="async_deadlock",
                    phase="during",
                    data=result.async_deadlock,
                )
            elif module == "render":
                result.modules_executed.append("render")
                result.render_flood = self._run_render_flood(page)
                timeline.add_event(
                    event_type="render_flood",
                    phase="during",
                    data=result.render_flood,
                )
            elif module == "navigation":
                result.modules_executed.append("navigation")
                result.navigation = self._run_infinite_navigation(page)
                timeline.add_event(
                    event_type="navigation_loop",
                    phase="during",
                    data=result.navigation,
                )
            elif module == "websocket":
                result.modules_executed.append("websocket")
                result.websocket = self._run_websocket_swarm(page, ws_url or url.replace("http", "ws"))
                timeline.add_event(
                    event_type="websocket_flood",
                    phase="during",
                    data=result.websocket,
                )
        except Exception as e:
            LOGGER.warning("[BrowserWarfare] Module %s failed: %s", module, e)
            result.errors.append(f"{module}: {e}")

    # ─── Module executors ─────────────────────────────────────────────────────

    def _run_memory_bomb(self, page) -> dict[str, Any]:
        bomb = BrowserMemoryBomb(BrowserMemoryBombConfig(
            allocation_bytes=50_000_000,
            closure_leaks=200,
            dom_node_flood=5000,
        ))
        r1 = bomb.allocate_js_heap(page)
        r2 = bomb.leak_closures(page)
        r3 = bomb.dom_node_flood(page)
        return {
            "bytes_allocated": r1.bytes_allocated,
            "estimated_heap_growth_mb": r1.estimated_heap_growth_mb,
            "closures_leaked": r2.closures_leaked,
            "dom_nodes_flooded": r3.dom_nodes_flooded,
            "estimated_mb": r3.estimated_heap_growth_mb,
        }

    def _run_hydration_breaker(self, page) -> dict[str, Any]:
        breaker = HydrationBreaker(HydrationBreakerConfig(
            mismatched_attributes=100,
            extra_server_nodes=500,
            removed_client_nodes=200,
            corrupt_state_keys=25,
        ))
        r = breaker.break_hydration(page)
        return {
            "mismatched_nodes": r.mismatched_nodes,
            "extra_nodes_inserted": r.extra_nodes_inserted,
            "nodes_removed": r.nodes_removed,
            "state_corruptions": r.state_corruptions,
        }

    def _run_async_deadlock(self, page) -> dict[str, Any]:
        deadlock = AsyncDeadlock(AsyncDeadlockConfig(
            chain_length=50,
            deadlock_depth=20,
            rejection_bombs=100,
        ))
        r1 = deadlock.create_promise_chain(page)
        r2 = deadlock.unhandled_rejection_bomb(page)
        return {
            "chains_created": r1.chains_created,
            "rejections_thrown": r2.rejections_thrown,
        }

    def _run_render_flood(self, page) -> dict[str, Any]:
        flood = RenderFlood(RenderFloodConfig(
            dom_nodes=2000,
            style_changes_per_frame=50,
            duration_ms=5000,
            throttle_ms=16.0,
        ))
        r = flood.flood_render_queue(page)
        return {
            "nodes_created": r.nodes_created,
            "style_bombs": r.style_bombs,
            "forced_reflows": r.forced_reflows,
            "estimated_frame_drops": r.estimated_frame_drops,
        }

    def _run_infinite_navigation(self, page) -> dict[str, Any]:
        nav = InfiniteNavigation(InfiniteNavigationConfig(
            max_iterations=1000,
            delay_ms=1,
            history_entries=500,
        ))
        r = nav.history_explosion(page)
        return {
            "history_entries_added": r.history_entries_added,
            "memory_leaks_detected": r.memory_leaks_detected,
        }

    def _run_websocket_swarm(self, page, ws_url: str) -> dict[str, Any]:
        # ── Inject WebSocket intelligence before the attack ───────────────────
        from tester_qa.browser_warfare.websocket import (
            WebSocketIntelligence, DesyncDetector, StaleSocketDetector,
            SocketPressure, ReconnectTracker,
        )

        ws_intel = WebSocketIntelligence()
        ws_intel.inject_tracer(page)

        desync = DesyncDetector()
        desync.inject(page)

        stale_detector = StaleSocketDetector()
        stale_detector.inject(page)

        pressure = SocketPressure()
        pressure.inject(page)

        reconnect_tracker = ReconnectTracker()
        reconnect_tracker.inject(page)

        # ── Launch the swarm ────────────────────────────────────────────────
        swarm = WebSocketSwarm(WebSocketSwarmConfig(
            connections=20,
            messages_per_connection=50,
            reconnect_interval_ms=100,
            corrupt_ratio=0.3,
            payload_size_bytes=1024,
        ))
        r = swarm.launch_swarm(page, ws_url)
        r2 = swarm.corrupt_websocket_state(page)

        # ── Collect post-attack intelligence ─────────────────────────────────
        ws_analysis = ws_intel.collect(page)
        desync_result = desync.detect(page)
        stale_sockets = stale_detector.scan(page)
        pressure_result = pressure.measure_pressure(page)
        reconnect_result = reconnect_tracker.track_reconnects(page)

        return {
            "connections_opened": r.connections_opened,
            "messages_sent": r.messages_sent,
            "corrupt_messages": r.corrupt_messages,
            "state_corruptions": getattr(r2, "state_corruptions", 0),
            # WebSocket Intelligence
            "ws_intel_total_sent": ws_analysis.total_sent,
            "ws_intel_total_received": ws_analysis.total_received,
            "ws_intel_corrupt_packets": ws_analysis.corrupt_packets,
            "ws_intel_reconnect_count": ws_analysis.reconnect_count,
            "ws_intel_desync_detected": ws_analysis.desync_detected,
            "ws_intel_stale_sockets": ws_analysis.stale_sockets,
            "ws_intel_summary": ws_analysis.summary,
            # Desync Detector
            "desync_detected": desync_result.get("desync_detected", False),
            "desync_structural_gap": desync_result.get("structural_gap", False),
            "desync_application_gaps": desync_result.get("application_gaps", 0),
            "desync_corruptions": desync_result.get("corruptions", 0),
            "desync_verdict": desync_result.get("verdict", "OK"),
            # Stale Socket Detector
            "stale_socket_count": len(stale_sockets),
            # Socket Pressure
            "socket_pressure_level": pressure_result.get("pressure_level", "unknown"),
            "socket_active_connections": pressure_result.get("active_connections", 0),
            "socket_message_rate": pressure_result.get("message_rate_per_sec", 0.0),
            "socket_memory_mb": pressure_result.get("memory_usage_mb", 0.0),
            # Reconnect Tracker
            "reconnect_storm_detected": reconnect_result.get("storm_detected", False),
            "reconnect_storm_count": reconnect_result.get("storm_count", 0),
            "reconnect_total": reconnect_result.get("reconnect_count", 0),
            "reconnect_verdict": reconnect_result.get("verdict", "OK"),
        }

    # ─── Recovery & forensics helpers ────────────────────────────────────────

    def _run_recovery_validation(
        self,
        page,
        result: BrowserWarfareResult,
        before_metrics: dict[str, Any],
        timeline: WarfareTimeline,
    ) -> None:
        """Run recovery validation and record results."""
        session_id = f"{result.scenario}-{int(time.time())}"
        try:
            report = self._recovery_validator.run_full_validation(
                page=page,
                session_id=session_id,
                before_metrics=before_metrics,
                console_errors=self._console_errors,
            )
            result.recovery_score = report.overall_score
            result.recovery_report = report.to_dict()

            # Add recovery event to timeline
            timeline.add_recovery_event(
                recovery_score=report.overall_score,
                details={
                    "memory_score": report.memory_score,
                    "dom_score": report.dom_score,
                    "state_score": report.state_score,
                    "recovered": report.recovered,
                },
            )

            # Add collapse event if recovery failed
            if not report.recovered:
                timeline.add_collapse_event(
                    collapse_type="browser_collapse",
                    evidence={
                        "recovery_score": report.overall_score,
                        "residual_issues": report.residual_issues,
                    },
                )

            LOGGER.info(
                "[BrowserWarfare] Recovery: score=%.1f recovered=%s",
                report.overall_score, report.recovered,
            )
        except Exception as e:
            LOGGER.warning("[BrowserWarfare] Recovery validation failed: %s", e)
            result.errors.append(f"recovery_error: {e}")

    def _run_forensic_reconstruction(
        self,
        result: BrowserWarfareResult,
        timeline: WarfareTimeline,
    ) -> WarfareReconstructor:
        """Build forensic reconstruction report."""
        evidence = {
            "url": result.url,
            "scenario": result.scenario,
            "started_at": result.started_at,
            "completed_at": result.completed_at,
            "module_results": {
                "memory": result.memory,
                "hydration": result.hydration,
                "async_deadlock": result.async_deadlock,
                "render_flood": result.render_flood,
                "navigation": result.navigation,
                "websocket": result.websocket,
            },
            "recovery_report": result.recovery_report,
            "timeline": timeline.build(),
        }
        return self._reconstructor.reconstruct(
            session_id=f"{result.scenario}-{int(time.time())}",
            evidence=evidence,
        )

    def capture_recovery_evidence(self, page) -> dict[str, Any]:
        """Capture current page state for forensic evidence.

        This helper can be called at any point during or after warfare
        to record a snapshot of the page's state.

        Returns:
            Dict containing memory metrics, DOM stats, and console state.
        """
        return self._capture_page_metrics(page)

    def _capture_page_metrics(self, page) -> dict[str, Any]:
        """Capture current page metrics for timeline snapshots."""
        metrics: dict[str, Any] = {"url": page.url, "timestamp": datetime.now(timezone.utc).isoformat()}
        try:
            mem = page.evaluate("""() => {
                if (performance.memory) {
                    return {
                        usedJSHeapSize: performance.memory.usedJSHeapSize,
                        totalJSHeapSize: performance.memory.totalJSHeapSize,
                        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                    };
                }
                return null;
            }""")
            if mem:
                metrics["memory"] = mem
        except Exception as e:
            LOGGER.debug("[BrowserWarfare] Memory capture failed: %s", e)

        try:
            dom_stats = page.evaluate("""() => {
                return {
                    total_nodes: document.querySelectorAll('*').length,
                    body_children: document.body ? document.body.children.length : 0,
                    iframes: document.querySelectorAll('iframe').length,
                };
            }""") or {}
            metrics["dom"] = dom_stats
        except Exception as e:
            LOGGER.debug("[BrowserWarfare] DOM capture failed: %s", e)

        metrics["console_errors"] = len(self._console_errors)
        return metrics


    def execute_swarm(self, config: "SwarmConfig") -> "SwarmResult":
        """Execute a distributed browser swarm attack using multiple browser instances.

        This is a thin wrapper around :class:`DistributedBrowserWarfare` that shares
        the same evidence root and timeout configuration.
        """
        from tester_qa.browser_warfare.distributed_browser_warfare import (
            DistributedBrowserWarfare,
        )
        swarm = DistributedBrowserWarfare(
            evidence_root=self.evidence_root,
            timeout_seconds=self.timeout_seconds,
        )
        return swarm.launch_swarm(config)

    def execute_targeted_swarm(
        self,
        url: str,
        scenario_id: str = "total_browser_warfare",
        browser_count: int = 10,
        ws_url: str = "",
    ) -> "SwarmResult":
        """Convenience: launch a swarm against a specific URL.

        Shorthand for constructing a :class:`SwarmConfig` and calling
        :meth:`execute_swarm`.
        """
        from tester_qa.browser_warfare.distributed_browser_warfare import (
            DistributedBrowserWarfare,
        )
        swarm = DistributedBrowserWarfare(
            evidence_root=self.evidence_root,
            timeout_seconds=self.timeout_seconds,
        )
        return swarm.launch_targeted_swarm(
            target_url=url,
            scenario_id=scenario_id,
            browser_count=browser_count,
            ws_url=ws_url,
        )

    # ─── Helpers ─────────────────────────────────────────────────────────────

    def _capture_screenshot(self, page, scenario_id: str) -> str:
        try:
            screenshot_dir = self.evidence_root / "screenshots"
            screenshot_dir.mkdir(parents=True, exist_ok=True)
            path = screenshot_dir / f"browser-warfare-{scenario_id}-{int(time.time())}.png"
            page.screenshot(path=str(path), full_page=True)
            return str(path)
        except Exception as e:
            LOGGER.warning("[BrowserWarfare] Screenshot failed: %s", e)
            return ""

    def list_scenarios(self) -> list[dict[str, str]]:
        return [
            {
                "id": s.id,
                "label": s.label,
                "danger": s.danger,
                "description": s.description,
                "modules": ", ".join(s.modules),
            }
            for s in SCENARIOS.values()
        ]


# Convenience singleton
_orchestrator: BrowserWarfareOrchestrator | None = None


def get_browser_warfare_orchestrator() -> BrowserWarfareOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = BrowserWarfareOrchestrator()
    return _orchestrator
