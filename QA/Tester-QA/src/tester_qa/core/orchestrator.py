"""Central orchestrator — connects all modules into a unified execution pipeline."""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from tester_qa.core.event_bus import EventBus, EventType
from tester_qa.core.runtime_context import RuntimeContext


class Orchestrator:
    """Central execution orchestrator — the brain of Tester-QA.

    Connects: Browser → Runtime → Evidence → Incidents → Reports → Intelligence
    """

    def __init__(self, project_root: Path | None = None) -> None:
        self.bus = EventBus.get_instance()
        self.project_root = project_root or Path.cwd()
        self._active_contexts: dict[str, RuntimeContext] = {}

    def create_context(self, project_id: str, base_url: str = "", auth_profile: str | None = None) -> RuntimeContext:
        """Create a new execution context for a test run."""
        ctx = RuntimeContext(
            project_id=project_id,
            base_url=base_url,
            auth_profile=auth_profile,
            evidence_dir=self.project_root / "evidence",
            report_dir=self.project_root / "reports",
        )
        self._active_contexts[ctx.session_id] = ctx
        return ctx

    async def run_browser_audit(self, ctx: RuntimeContext) -> dict[str, Any]:
        """Execute browser audit pipeline."""
        self.bus.emit(EventType.CHAOS_STARTED, "orchestrator", {"task": "browser_audit", "project": ctx.project_id}, ctx.project_id)

        results: dict[str, Any] = {"screenshots": [], "console_errors": [], "network_failures": [], "websocket_events": []}

        try:
            # Attempt real Playwright inspection
            from tester_qa.browser.playwright_runner import PlaywrightRunner
            runner = PlaywrightRunner(ctx.evidence_dir, ctx.report_dir)
            if ctx.base_url:
                report = runner.inspect(ctx.base_url)
                results["success"] = report.success
                results["screenshots"] = report.screenshot_paths
                results["report_path"] = report.report_path
                for path in report.screenshot_paths:
                    ctx.add_evidence(path)
                self.bus.emit(EventType.BROWSER_SCREENSHOT, "browser_audit", {"paths": report.screenshot_paths}, ctx.project_id)
        except Exception as e:
            ctx.add_error(f"Browser audit failed: {e}")
            self.bus.emit(EventType.BROWSER_FAILURE, "browser_audit", {"error": str(e)}, ctx.project_id)
            results["success"] = False
            results["error"] = str(e)

        return results

    async def run_runtime_audit(self, ctx: RuntimeContext) -> dict[str, Any]:
        """Execute runtime monitoring and anomaly detection."""
        self.bus.emit(EventType.METRICS_UPDATE, "orchestrator", {"task": "runtime_audit"}, ctx.project_id)

        import psutil
        cpu = psutil.cpu_percent(interval=1) if hasattr(psutil, "cpu_percent") else 0
        memory = psutil.virtual_memory().percent if hasattr(psutil, "virtual_memory") else 0

        ctx.update_metrics(cpu_percent=cpu, memory_percent=memory)

        # Check for anomalies
        if cpu > 80:
            self.bus.emit(EventType.RUNTIME_SPIKE, "runtime_audit", {"cpu": cpu}, ctx.project_id)
        if memory > 85:
            self.bus.emit(EventType.RUNTIME_CRITICAL, "runtime_audit", {"memory": memory}, ctx.project_id)

        return {"cpu_percent": cpu, "memory_percent": memory, "status": "healthy" if cpu < 80 and memory < 85 else "degraded"}

    async def run_security_audit(self, ctx: RuntimeContext) -> dict[str, Any]:
        """Execute security scanning pipeline."""
        from tester_qa.security import SecretScanner, EnvAuditor
        findings: list[dict] = []

        project_path = Path(ctx.project_path) if ctx.project_path else self.project_root
        scanner = SecretScanner()
        secrets = scanner.scan_directory(project_path)
        findings.extend([f.to_dict() if hasattr(f, "to_dict") else f for f in secrets])

        env_path = project_path / ".env"
        if env_path.exists():
            env_findings = EnvAuditor().audit_env_file(env_path)
            findings.extend([f.to_dict() if hasattr(f, "to_dict") else f for f in env_findings])

        return {"findings": findings, "total": len(findings)}

    async def run_chaos_test(self, ctx: RuntimeContext, scenario: str = "provider_meltdown") -> dict[str, Any]:
        """Execute chaos engineering scenario."""
        self.bus.emit(EventType.CHAOS_STARTED, "orchestrator", {"scenario": scenario}, ctx.project_id)

        from tester_qa.chaos_ai.chaos_director import ChaosDirector
        director = ChaosDirector()
        campaign = director.run_full_campaign()

        self.bus.emit(EventType.CHAOS_COMPLETED, "orchestrator", {"rounds": campaign["total_rounds"]}, ctx.project_id)

        if campaign.get("collapse_at_round"):
            self.bus.emit(EventType.COLLAPSE_DETECTED, "chaos", {"round": campaign["collapse_at_round"]}, ctx.project_id)

        return campaign

    async def run_full_validation(self, ctx: RuntimeContext) -> dict[str, Any]:
        """Execute full validation pipeline: browser → runtime → security → chaos → report."""
        start = time.time()
        results: dict[str, Any] = {"session_id": ctx.session_id, "project_id": ctx.project_id}

        # Step 1: Runtime audit
        results["runtime"] = await self.run_runtime_audit(ctx)

        # Step 2: Security audit
        try:
            results["security"] = await self.run_security_audit(ctx)
        except Exception as e:
            results["security"] = {"error": str(e)}

        # Step 3: Browser audit (if URL available)
        if ctx.base_url:
            results["browser"] = await self.run_browser_audit(ctx)

        # Step 4: Chaos test
        results["chaos"] = await self.run_chaos_test(ctx)

        # Step 5: Generate report
        results["elapsed_ms"] = round((time.time() - start) * 1000, 1)
        results["context"] = ctx.to_dict()

        # Emit completion
        self.bus.emit(EventType.REPORT_READY, "orchestrator", {"session": ctx.session_id}, ctx.project_id)

        return results

    def get_active_sessions(self) -> list[dict[str, Any]]:
        """Get all active execution contexts."""
        return [ctx.to_dict() for ctx in self._active_contexts.values()]

    def get_event_stream(self, seconds: float = 60.0) -> list[dict[str, Any]]:
        """Get recent events for streaming to UI."""
        return self.bus.get_recent(seconds)
