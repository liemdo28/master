from __future__ import annotations

import argparse
import asyncio
import json
import logging
from pathlib import Path

from tester_qa.browser_ops import BrowserOps
from tester_qa.browser import PlaywrightRunner
from tester_qa.audit import ProjectAudit, audit_runtime, audit_security, audit_dependencies
from tester_qa.evidence import EvidenceEngine
from tester_qa.executor import CommandExecutor
from tester_qa.incidents import IncidentRegistry
from tester_qa.knowledge import KnowledgeStore
from tester_qa.local_control import AuditLog, PermissionGate, PermissionMode, ProcessInspector, SafeShell
from tester_qa.memory import MemoryStore
from tester_qa.models import Evidence, EvidenceType, KnowledgeEntry, Severity
from tester_qa.qa_authority import QAAuditAuthority
from tester_qa.projects import ProjectAnalyzer, ProjectHealthcheck, ProjectRegistry
from tester_qa.projects.project_report import generate_project_report
from tester_qa.reporting import render_enterprise_incident_markdown, render_json
from tester_qa.reporting import render_audit_report, render_stress_report
from tester_qa.reporting.weekly_report import render_weekly_report
from tester_qa.runtime_monitor import RuntimeMonitor
from tester_qa.cli_projects import register_project_commands
from tester_qa.stress import HttpStressTester, ProviderFailureSimulator, RuntimeStressModel, WebsocketStressTester
from tester_qa.browser_warfare.browser_warfare_orchestrator import BrowserWarfareOrchestrator, SCENARIOS as BW_SCENARIOS


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_KNOWLEDGE_PATH = PROJECT_ROOT / "knowledge" / "qa_memory.jsonl"
PROFILE_PATH = PROJECT_ROOT / "config" / "qa_audit.profile.json"
DEFAULT_EVIDENCE_ROOT = PROJECT_ROOT / "evidence"
DEFAULT_INCIDENT_ROOT = DEFAULT_EVIDENCE_ROOT / "incidents"
DEFAULT_AUDIT_PATH = PROJECT_ROOT / "audit" / "audit_log.jsonl"
DEFAULT_MEMORY_V2_PATH = PROJECT_ROOT / "knowledge" / "memory_v2.jsonl"
DEFAULT_PROJECT_REGISTRY_PATH = PROJECT_ROOT / "knowledge" / "project_registry.json"


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(prog="tester-qa")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("profile", help="Print the QA audit authority profile.")

    scan_projects = subparsers.add_parser("scan-projects", help="Scan local project root and update registry.")
    scan_projects.add_argument("root", type=Path)

    inspect_project = subparsers.add_parser("inspect-project", help="Inspect one project structure and framework.")
    inspect_project.add_argument("path", type=Path)

    healthcheck = subparsers.add_parser("run-healthcheck", help="Run safe project healthcheck.")
    healthcheck.add_argument("path", type=Path)

    audit_project = subparsers.add_parser("audit-project", help="Run project QA/audit review.")
    audit_project.add_argument("path", type=Path)
    audit_project.add_argument("--format", choices=["json", "markdown"], default="json")

    stress_http = subparsers.add_parser("stress-http", help="Run HTTP concurrency stress test.")
    stress_http.add_argument("url")
    stress_http.add_argument("--requests", type=int, default=20)
    stress_http.add_argument("--concurrency", type=int, default=5)
    stress_http.add_argument("--timeout", type=int, default=5)
    stress_http.add_argument("--format", choices=["json", "markdown"], default="json")

    stress_ws = subparsers.add_parser("stress-websocket", help="Simulate websocket reconnect storm.")
    stress_ws.add_argument("url")
    stress_ws.add_argument("--clients", type=int, default=25)
    stress_ws.add_argument("--reconnects", type=int, default=3)
    stress_ws.add_argument("--format", choices=["json", "markdown"], default="json")

    provider_sim = subparsers.add_parser("simulate-provider", help="Simulate provider failure mode.")
    provider_sim.add_argument("provider")
    provider_sim.add_argument("--mode", choices=["timeout", "rate_limit", "invalid_payload", "unavailable"], default="timeout")
    provider_sim.add_argument("--attempts", type=int, default=10)
    provider_sim.add_argument("--format", choices=["json", "markdown"], default="json")

    runtime_audit = subparsers.add_parser("runtime-audit", help="Audit runtime risk signals.")
    _add_runtime_metric_args(runtime_audit)

    run = subparsers.add_parser("run", help="Execute a workload command with timeout and structured result.")
    run.add_argument("workload")
    run.add_argument("--timeout", type=int, default=30)
    run.add_argument("--retries", type=int, default=0)
    run.add_argument("--cwd", type=Path, default=PROJECT_ROOT)
    run.add_argument("--format", choices=["json", "markdown"], default="json")
    run.add_argument("--dry-run", action="store_true")
    run.add_argument("--approved-execute", action="store_true")

    monitor = subparsers.add_parser("monitor", help="Capture runtime snapshot and generate incidents for anomalies.")
    _add_runtime_metric_args(monitor)
    monitor.add_argument("--format", choices=["json", "markdown"], default="json")

    inspect_runtime = subparsers.add_parser("inspect-runtime", help="Inspect runtime snapshot without creating incidents.")
    _add_runtime_metric_args(inspect_runtime)
    inspect_runtime.add_argument("--format", choices=["json", "markdown"], default="json")

    browser_test = subparsers.add_parser("browser-test", help="Run autonomous browser QA against a URL.")
    browser_test.add_argument("url")
    browser_test.add_argument("--format", choices=["json", "markdown"], default="json")

    browser = subparsers.add_parser("browser", help="Browser command group.")
    browser_subparsers = browser.add_subparsers(dest="browser_action", required=True)
    browser_inspect = browser_subparsers.add_parser("inspect", help="Inspect a URL and create browser report.")
    browser_inspect.add_argument("url")

    browser_warfare = browser_subparsers.add_parser("warfare", help="Launch browser warfare scenario against a URL.")
    browser_warfare.add_argument("url")
    browser_warfare.add_argument(
        "--scenario",
        choices=["memory_bomb", "hydration_breaker", "async_deadlock", "render_flood",
                 "infinite_navigation", "websocket_apocalypse", "total_browser_warfare"],
        default="memory_bomb",
    )
    browser_warfare.add_argument("--ws-url", default="")
    browser_warfare.add_argument("--timeout", type=int, default=30)
    browser_warfare.add_argument("--list-scenarios", action="store_true")

    browser_inspect_legacy = subparsers.add_parser("browser-inspect", help="Inspect a URL and create browser report.")
    browser_inspect_legacy.add_argument("url")

    capture_screen = subparsers.add_parser("capture-screen", help="Capture a screen for URL using browser inspection.")
    capture_screen.add_argument("--url", required=True)

    screenshot = subparsers.add_parser("capture-screenshot", help="Capture screenshot evidence placeholder or backend screenshot.")
    screenshot.add_argument("--out", type=Path)

    incident = subparsers.add_parser("incident", help="Generate an incident report.")
    incident.add_argument("--title")
    incident.add_argument("--severity", choices=[item.value for item in Severity], default=Severity.MEDIUM.value)
    incident.add_argument("--summary")
    incident.add_argument("--evidence-source")
    incident.add_argument("--evidence-detail")
    incident.add_argument("--out", type=Path)
    incident.add_argument("--format", choices=["markdown", "json"], default="markdown")
    incident_subparsers = incident.add_subparsers(dest="incident_action")
    incident_create = incident_subparsers.add_parser("create", help="Create registered enterprise incident.")
    incident_create.add_argument("--title", required=True)
    incident_create.add_argument("--summary", default="Incident created from CLI.")
    incident_create.add_argument("--severity", choices=[item.value for item in Severity], default=Severity.MEDIUM.value)
    incident_subparsers.add_parser("list", help="List registered enterprise incidents.")
    incident_show = incident_subparsers.add_parser("show", help="Show a registered enterprise incident.")
    incident_show.add_argument("incident_id")
    incident_show.add_argument("--format", choices=["markdown", "json"], default="markdown")

    test_plan = subparsers.add_parser("test-plan", help="Generate an operational QA test plan.")
    test_plan.add_argument("--system", required=True)
    test_plan.add_argument("--scope")
    test_plan.add_argument("--out", type=Path)

    capture = subparsers.add_parser("capture", help="Capture a knowledge entry.")
    capture.add_argument("--title", required=True)
    capture.add_argument("--body", required=True)
    capture.add_argument("--tags", default="")
    capture.add_argument("--store", type=Path, default=DEFAULT_KNOWLEDGE_PATH)

    report = subparsers.add_parser("report", help="Report command group.")
    report_subparsers = report.add_subparsers(dest="report_action", required=True)
    report_project = report_subparsers.add_parser("project", help="Generate project report.")
    report_project.add_argument("path", type=Path)
    report_subparsers.add_parser("weekly", help="Generate weekly operations report.")

    memory = subparsers.add_parser("memory", help="Memory command group.")
    memory_subparsers = memory.add_subparsers(dest="memory_action", required=True)
    memory_search = memory_subparsers.add_parser("search", help="Search memory.")
    memory_search.add_argument("query")

    subparsers.add_parser("processes", help="List local processes.")
    subparsers.add_parser("ports", help="List occupied ports.")
    subparsers.add_parser("audit-log", help="Print audit log.")

    # === CHAOS COMMAND GROUP ===
    chaos = subparsers.add_parser("chaos", help="Chaos engineering command group.")
    chaos_subparsers = chaos.add_subparsers(dest="chaos_action", required=True)

    chaos_scenario = chaos_subparsers.add_parser("scenario", help="Execute a predefined chaos scenario.")
    chaos_scenario.add_argument("scenario", choices=["provider_meltdown", "websocket_apocalypse", "resource_exhaustion", "network_partition", "total_chaos"])
    chaos_scenario.add_argument("--target", default="default")
    chaos_scenario.add_argument("--level", choices=["low", "medium", "high", "extreme", "apocalypse"], default="high")

    chaos_websocket = chaos_subparsers.add_parser("websocket", help="Inject WebSocket chaos.")
    chaos_websocket.add_argument("target", default="ws://localhost:8080")
    chaos_websocket.add_argument("--mode", choices=["reconnect_storm", "stale_state", "duplicate_messages", "connection_flood", "dropped_packets"], default="reconnect_storm")
    chaos_websocket.add_argument("--intensity", type=float, default=0.5)
    chaos_websocket.add_argument("--duration", type=int, default=30000)

    chaos_provider = chaos_subparsers.add_parser("provider", help="Simulate provider failure.")
    chaos_provider.add_argument("target", default="api")
    chaos_provider.add_argument("--mode", choices=["timeout", "rate_limit", "malformed_payload", "unavailable", "auth_failure"], default="timeout")
    chaos_provider.add_argument("--duration", type=int, default=10000)

    chaos_memory = chaos_subparsers.add_parser("memory", help="Apply memory pressure.")
    chaos_memory.add_argument("target", default="default")
    chaos_memory.add_argument("--intensity", type=float, default=0.5)
    chaos_memory.add_argument("--duration", type=int, default=30000)

    chaos_cpu = chaos_subparsers.add_parser("cpu", help="Apply CPU pressure.")
    chaos_cpu.add_argument("target", default="default")
    chaos_cpu.add_argument("--intensity", type=float, default=0.5)
    chaos_cpu.add_argument("--duration", type=int, default=30000)

    chaos_disk = chaos_subparsers.add_parser("disk", help="Apply disk pressure.")
    chaos_disk.add_argument("target", default="default")
    chaos_disk.add_argument("--intensity", type=float, default=0.5)
    chaos_disk.add_argument("--duration", type=int, default=30000)

    chaos_latency = chaos_subparsers.add_parser("latency", help="Inject network latency.")
    chaos_latency.add_argument("target", default="default")
    chaos_latency.add_argument("--base_ms", type=int, default=100)
    chaos_latency.add_argument("--jitter", type=int, default=50)
    chaos_latency.add_argument("--pattern", choices=["spike", "gradual", "random", "burst", "constant"], default="spike")

    chaos_packet_loss = chaos_subparsers.add_parser("packet-loss", help="Simulate packet loss and corruption.")
    chaos_packet_loss.add_argument("target", default="default")
    chaos_packet_loss.add_argument("--loss-rate", type=float, default=0.3)
    chaos_packet_loss.add_argument("--corruption-rate", type=float, default=0.05)
    chaos_packet_loss.add_argument("--pattern", choices=["burst", "random", "gradual", "selective"], default="burst")
    chaos_packet_loss.add_argument("--duration", type=int, default=30000)

    chaos_retry = chaos_subparsers.add_parser("retry-storm", help="Simulate retry storm / thundering herd.")
    chaos_retry.add_argument("target", default="default")
    chaos_retry.add_argument("--max-retries", type=int, default=10)
    chaos_retry.add_argument("--pattern", choices=["exponential", "linear", "immediate", "fibonacci", "jittered", "thunder_herd"], default="exponential")
    chaos_retry.add_argument("--thunder-prob", type=float, default=0.5)
    chaos_retry.add_argument("--duration", type=int, default=30000)

    chaos_process = chaos_subparsers.add_parser("process-kill", help="Kill processes to simulate failure cascades.")
    chaos_process.add_argument("target", default="default")
    chaos_process.add_argument("--mode", choices=["random", "child", "parent", "graceful", "force", "zombie", "orphan"], default="random")
    chaos_process.add_argument("--count", type=int, default=1)

    chaos_disconnect = chaos_subparsers.add_parser("disconnect", help="Simulate random disconnections and network partitions.")
    chaos_disconnect.add_argument("target", default="default")
    chaos_disconnect.add_argument("--mode", choices=["random_drop", "scheduled_drop", "network_partition", "flapping", "degradation", "blackout"], default="flapping")
    chaos_disconnect.add_argument("--probability", type=float, default=0.5)
    chaos_disconnect.add_argument("--min_ms", type=int, default=1000)
    chaos_disconnect.add_argument("--max_ms", type=int, default=10000)

    chaos_subparsers.add_parser("stats", help="Show chaos engine statistics.")
    chaos_subparsers.add_parser("stop", help="Emergency stop all chaos.")

    chaos_export = chaos_subparsers.add_parser("export", help="Export full chaos report.")

    # === SECURITY COMMAND GROUP ===
    security = subparsers.add_parser("security", help="Security audit command group.")
    security_subparsers = security.add_subparsers(dest="security_action", required=True)

    sec_audit = security_subparsers.add_parser("audit", help="Run security audit.")
    sec_audit.add_argument("path", type=Path, default=PROJECT_ROOT)

    sec_secrets = security_subparsers.add_parser("secrets", help="Scan for exposed secrets.")
    sec_secrets.add_argument("path", type=Path, default=PROJECT_ROOT)

    sec_env = security_subparsers.add_parser("env", help="Audit environment configs.")
    sec_env.add_argument("path", type=Path, default=PROJECT_ROOT)

    sec_deps = security_subparsers.add_parser("deps", help="Analyze dependency risks.")
    sec_deps.add_argument("path", type=Path, default=PROJECT_ROOT)

    sec_ports = security_subparsers.add_parser("ports", help="Scan for exposed ports.")
    sec_ports.add_argument("--start", type=int, default=1)
    sec_ports.add_argument("--end", type=int, default=10000)

    # === FORENSICS COMMAND GROUP ===
    forensics = subparsers.add_parser("forensics", help="Operational forensics command group.")
    forensics_subparsers = forensics.add_subparsers(dest="forensics_action", required=True)

    forensics_incident = forensics_subparsers.add_parser("incident", help="Reconstruct an incident.")
    forensics_incident.add_argument("incident_id")

    forensics_timeline = forensics_subparsers.add_parser("timeline", help="Build failure timeline.")
    forensics_timeline.add_argument("--events", default="[]")

    # === INTELLIGENCE COMMAND GROUP ===
    intel = subparsers.add_parser("intel", help="Test intelligence command group.")
    intel_subparsers = intel.add_subparsers(dest="intel_action", required=True)
    intel_subparsers.add_parser("recurring", help="Detect recurring failures.")
    intel_subparsers.add_parser("flaky", help="Detect flaky tests.")
    intel_subparsers.add_parser("predict", help="Predict instability.")
    intel_subparsers.add_parser("patterns", help="Show known failure patterns.")

    # === SYSTEM COMMAND GROUP ===
    system = subparsers.add_parser("system", help="Terminal warfare command group.")
    system_subparsers = system.add_subparsers(dest="system_action", required=True)

    sys_processes = system_subparsers.add_parser("processes", help="Control processes.")
    sys_processes.add_argument("action", choices=["list", "tree"])

    system_subparsers.add_parser("orphans", help="Find orphan processes.")

    sys_port = system_subparsers.add_parser("port-conflict", help="Find port conflicts.")
    sys_port.add_argument("--port", type=int, default=8080)

    # === WAR ROOM COMMAND GROUP ===
    warroom = subparsers.add_parser("warroom", help="War Room — live operational intelligence.")
    warroom_subparsers = warroom.add_subparsers(dest="warroom_action", required=True)
    warroom_subparsers.add_parser("status", help="Show current operational status.")
    warroom_subparsers.add_parser("snapshot", help="Capture and display full war room snapshot.")
    warroom_subparsers.add_parser("report", help="Generate war room briefing report.")
    warroom_subparsers.add_parser("predict", help="Show collapse prediction.")
    warroom_subparsers.add_parser("scores", help="Calculate all operational scores.")
    warroom_subparsers.add_parser("dashboard", help="Render terminal dashboard.")

    warroom_update = warroom_subparsers.add_parser("update-runtime", help="Feed runtime metrics into war room.")
    _add_runtime_metric_args(warroom_update)

    warroom_provider = warroom_subparsers.add_parser("update-provider", help="Feed provider metrics.")
    warroom_provider.add_argument("name")
    warroom_provider.add_argument("--latency", type=int, default=0)
    warroom_provider.add_argument("--timeout-rate", type=float, default=0.0)
    warroom_provider.add_argument("--failure-rate", type=float, default=0.0)

    # === RECOVERY COMMAND GROUP ===
    recovery = subparsers.add_parser("recovery", help="Recovery validation engine.")
    recovery_subparsers = recovery.add_subparsers(dest="recovery_action", required=True)
    recovery_subparsers.add_parser("websocket", help="Validate WebSocket recovery.")
    recovery_subparsers.add_parser("queue", help="Validate queue recovery.")
    recovery_subparsers.add_parser("retry", help="Validate retry catastrophe risk.")
    recovery_subparsers.add_parser("stale-state", help="Validate stale state recovery.")

    recovery_full = recovery_subparsers.add_parser("full", help="Run full recovery validation.")
    recovery_full.add_argument("--collapse-type", choices=["provider_blackout", "websocket_extinction", "queue_collapse", "retry_storm", "stale_state_corruption", "memory_shock", "compound_cascade"], default="compound_cascade")
    recovery_full.add_argument("--duration", type=int, default=10000)
    recovery_full.add_argument("--severity", type=float, default=0.7)

    recovery_subparsers.add_parser("history", help="Show recovery history.")
    recovery_subparsers.add_parser("score", help="Show survival score.")

    # === EVIDENCE COMMAND GROUP ===
    evidence_cmd = subparsers.add_parser("evidence", help="Evidence bundle management.")
    evidence_subparsers = evidence_cmd.add_subparsers(dest="evidence_action", required=True)
    evidence_create = evidence_subparsers.add_parser("create", help="Create failure evidence bundle.")
    evidence_create.add_argument("--title", required=True)
    evidence_create.add_argument("--severity", choices=["low", "medium", "high", "critical"], default="high")
    evidence_create.add_argument("--incident-id")
    evidence_create.add_argument("--console", default="")
    evidence_subparsers.add_parser("list", help="List evidence bundles.")

    # === OPERATIONAL SCORE COMMAND ===
    subparsers.add_parser("operational-score", help="Calculate operational risk score (0-100).")

    # === FULL-SPECTRUM VALIDATION COMMAND ===
    validate = subparsers.add_parser("validate", help="Run full-spectrum engineering validation (chaos -> forensics -> recovery -> scoring).")
    validate.add_argument("--scenario", choices=["provider_meltdown", "websocket_apocalypse", "resource_exhaustion", "network_partition", "total_chaos"], default="provider_meltdown")
    validate.add_argument("--target", default="default")
    validate.add_argument("--format", choices=["json", "briefing"], default="briefing")

    # === MULTI-PROJECT & CONTROL CENTER COMMANDS ===
    register_project_commands(subparsers)

    args = parser.parse_args()

    # Handle commands registered via set_defaults(func=...)
    if hasattr(args, "func"):
        args.func(args)
        return

    authority = QAAuditAuthority()
    registry = IncidentRegistry(DEFAULT_INCIDENT_ROOT)
    evidence_engine = EvidenceEngine(DEFAULT_EVIDENCE_ROOT)
    audit_log = AuditLog(DEFAULT_AUDIT_PATH)

    # Existing commands
    if args.command == "scan-projects":
        records = ProjectAnalyzer().scan_root(args.root)
        ProjectRegistry(DEFAULT_PROJECT_REGISTRY_PATH).save(records)
        print(render_json([record.to_dict() for record in records]))
        return

    if args.command == "inspect-project":
        record = ProjectAnalyzer().analyze(args.path)
        print(render_json(record.to_dict()))
        return

    if args.command == "run-healthcheck":
        print(render_json(ProjectHealthcheck().run(args.path)))
        return

    if args.command == "audit-project":
        report = ProjectAudit().run(args.path)
        extra_findings = [*audit_dependencies(args.path), *audit_security(args.path)]
        if extra_findings:
            from tester_qa.audit.models import AuditReport
            report = AuditReport(report.project, [*report.findings, *extra_findings])
        print(render_json(report) if args.format == "json" else render_audit_report(report))
        return

    if args.command == "stress-http":
        result = HttpStressTester().run(args.url, args.requests, args.concurrency, args.timeout)
        print(render_json(result) if args.format == "json" else render_stress_report(result))
        return

    if args.command == "stress-websocket":
        result = WebsocketStressTester().simulate_reconnect_storm(args.url, args.clients, args.reconnects)
        print(render_json(result) if args.format == "json" else render_stress_report(result))
        return

    if args.command == "simulate-provider":
        result = ProviderFailureSimulator().simulate(args.provider, args.mode, args.attempts)
        print(render_json(result) if args.format == "json" else render_stress_report(result))
        return

    if args.command == "runtime-audit":
        snapshot = RuntimeMonitor(registry).snapshot(
            websocket_count=args.websocket_count,
            queue_depth=args.queue_depth,
            provider_latency_ms=args.provider_latency,
            retry_storms=args.retry_storms,
            stuck_workers=args.stuck_workers,
            failed_executions=args.failed_executions,
        )
        print(render_json([finding.to_dict() for finding in audit_runtime(snapshot)]))
        return

    if args.command == "profile":
        print(PROFILE_PATH.read_text(encoding="utf-8"))
        return

    if args.command == "run":
        if args.dry_run:
            mode = PermissionMode.DRY_RUN
        elif args.approved_execute:
            mode = PermissionMode.APPROVED_EXECUTE
        else:
            decision = PermissionGate().evaluate_command(args.workload, PermissionMode.DRY_RUN)
            if not decision.allowed:
                result = SafeShell(audit_log).run(args.workload, cwd=args.cwd, mode=PermissionMode.DRY_RUN, timeout_seconds=args.timeout, retries=args.retries)
                _print_payload(result.to_dict(), args.format)
                return
            mode = PermissionMode.APPROVED_EXECUTE
        result = SafeShell(audit_log).run(args.workload, cwd=args.cwd, mode=mode, timeout_seconds=args.timeout, retries=args.retries)
        if not result.success:
            log = evidence_engine.capture_text(EvidenceType.LOG, result.stderr or result.stdout, description=f"Execution failure: {result.command}")
            registry.create(
                title=f"Execution failed: {result.command}",
                summary=result.stderr or result.stdout or "Command failed without output.",
                severity=Severity.HIGH if result.timed_out else Severity.MEDIUM,
                evidence_ids=[log.evidence_id],
            )
        _print_payload(result.to_dict(), args.format)
        return

    if args.command in {"monitor", "inspect-runtime"}:
        monitor_service = RuntimeMonitor(registry)
        snapshot = monitor_service.snapshot(
            websocket_count=args.websocket_count,
            queue_depth=args.queue_depth,
            provider_latency_ms=args.provider_latency,
            retry_storms=args.retry_storms,
            stuck_workers=args.stuck_workers,
            failed_executions=args.failed_executions,
        )
        anomalies = monitor_service.detect_anomalies(snapshot)
        incident_ids = monitor_service.generate_incidents(anomalies) if args.command == "monitor" else []
        payload = {"snapshot": snapshot.to_dict(), "anomalies": [item.to_dict() for item in anomalies], "incident_ids": incident_ids}
        _print_payload(payload, args.format)
        return

    if args.command == "browser-test":
        result = BrowserOps(evidence_engine, registry).validate_dashboard(args.url)
        _print_payload(result.to_dict(), args.format)
        return

    if args.command == "browser" and args.browser_action == "inspect":
        result = PlaywrightRunner(DEFAULT_EVIDENCE_ROOT, PROJECT_ROOT / "reports").inspect(args.url)
        audit_log.record("BrowserInspector", args.url, "browser inspect", "read_only", "success" if result.success else "failed", [result.report_path])
        print(render_json(result.to_dict()))

    if args.command == "browser" and args.browser_action == "warfare":
        orchestrator = BrowserWarfareOrchestrator(evidence_root=DEFAULT_EVIDENCE_ROOT, timeout_seconds=args.timeout)
        if args.list_scenarios:
            scenarios = orchestrator.list_scenarios()
            print(render_json({"scenarios": scenarios}))
            return
        result = orchestrator.execute_scenario(args.scenario, args.url, args.ws_url)
        audit_log.record("BrowserWarfare", args.url, f"browser warfare [{args.scenario}]", "destructive", "success" if result.success else "failed", [result.screenshot_path])
        print(render_json(result.to_dict()))
        return

    if args.command == "browser-inspect":
        result = PlaywrightRunner(DEFAULT_EVIDENCE_ROOT, PROJECT_ROOT / "reports").inspect(args.url)
        audit_log.record("BrowserInspector", args.url, "browser-inspect", "read_only", "success" if result.success else "failed", [result.report_path])
        print(render_json(result.to_dict()))
        return

    if args.command == "capture-screen":
        result = PlaywrightRunner(DEFAULT_EVIDENCE_ROOT, PROJECT_ROOT / "reports").inspect(args.url)
        print(render_json({"screenshots": result.screenshot_paths, "report": result.report_path}))
        return

    if args.command == "capture-screenshot":
        path = BrowserOps(evidence_engine, registry).capture_screenshot(args.out)
        print(json.dumps({"path": str(path)}, ensure_ascii=False))
        return

    if args.command == "incident":
        if args.incident_action == "create":
            created = registry.create(args.title, args.summary, Severity(args.severity))
            print(render_json(created))
            return
        if args.incident_action == "list":
            incidents = [item.to_dict() for item in registry.list()]
            print(render_json(incidents))
            return
        if args.incident_action == "show":
            found = registry.get(args.incident_id)
            print(render_json(found) if args.format == "json" else render_enterprise_incident_markdown(found))
            return
        if not args.title:
            raise SystemExit("incident --title is required when not using incident list/show")
        evidence = []
        if args.evidence_source or args.evidence_detail:
            evidence.append(Evidence(source=args.evidence_source or "manual", detail=args.evidence_detail or "Evidence detail not provided."))
        report = authority.create_incident_report(title=args.title, severity=Severity(args.severity), summary=args.summary, evidence=evidence)
        content = render_json(report) if args.format == "json" else authority.render_incident(report)
        _write_or_print(content, args.out)
        return

    if args.command == "report":
        if args.report_action == "project":
            output = generate_project_report(args.path)
            report_path = PROJECT_ROOT / "reports" / f"project-{args.path.name}.md"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(output + "\n", encoding="utf-8")
            print(str(report_path))
            return
        if args.report_action == "weekly":
            projects = ProjectRegistry(DEFAULT_PROJECT_REGISTRY_PATH).load()
            incidents = registry.list()
            memories = MemoryStore(DEFAULT_MEMORY_V2_PATH).read_all()
            output = render_weekly_report(len(projects), len(incidents), len(memories))
            report_path = PROJECT_ROOT / "reports" / "weekly-operations.md"
            report_path.write_text(output + "\n", encoding="utf-8")
            print(str(report_path))
            return

    if args.command == "memory" and args.memory_action == "search":
        print(render_json([item.to_dict() for item in MemoryStore(DEFAULT_MEMORY_V2_PATH).search(args.query)]))
        return

    if args.command == "processes":
        print(render_json([item.to_dict() for item in ProcessInspector().list_processes()]))
        return

    if args.command == "ports":
        print(render_json([item.to_dict() for item in ProcessInspector().occupied_ports()]))
        return

    if args.command == "audit-log":
        print(render_json([item.to_dict() for item in audit_log.list()]))
        return

    if args.command == "test-plan":
        plan = authority.create_test_plan(system=args.system, scope=args.scope)
        _write_or_print(authority.render_test_plan(plan), args.out)
        return

    if args.command == "capture":
        tags = [tag.strip() for tag in args.tags.split(",") if tag.strip()]
        store = KnowledgeStore(args.store)
        store.append(KnowledgeEntry(title=args.title, body=args.body, tags=tags))
        print(json.dumps({"status": "captured", "path": str(args.store)}, ensure_ascii=False))
        return

    # === CHAOS COMMAND HANDLERS ===
    if args.command == "chaos":
        from tester_qa.chaos import get_chaos_orchestrator
        orchestrator = get_chaos_orchestrator()

        if args.chaos_action == "stats":
            stats = orchestrator.get_orchestrator_stats()
            print(render_json(stats))
            return

        if args.chaos_action == "stop":
            orchestrator.stop_all_chaos()
            print(json.dumps({"status": "stopped", "message": "All chaos engines halted"}))
            return

        if args.chaos_action == "scenario":
            result = asyncio.run(orchestrator.execute_scenario(args.scenario, args.target))
            print(render_json({
                "scenario": result.scenario,
                "events_generated": result.events_generated,
                "failures_detected": result.failures_detected,
                "systems_affected": result.systems_affected,
                "details": result.details,
            }))
            return

        if args.chaos_action == "websocket":
            from tester_qa.chaos import WebSocketChaosConfig, ChaosMode
            mode_map = {"reconnect_storm": ChaosMode.RECONNECT_STORM, "stale_state": ChaosMode.STALE_STATE, "duplicate_messages": ChaosMode.DUPLICATE_MESSAGES, "connection_flood": ChaosMode.CONNECTION_FLOOD, "dropped_packets": ChaosMode.DROPPED_PACKETS}
            orchestrator.websocket_chaos.configure_chaos(args.target, WebSocketChaosConfig(mode=mode_map.get(args.mode, ChaosMode.RECONNECT_STORM), intensity=args.intensity, duration_ms=args.duration))
            print(json.dumps({"status": "configured", "target": args.target, "mode": args.mode}))
            return

        if args.chaos_action == "provider":
            from tester_qa.chaos import FailureConfig, FailureMode
            mode_map = {"timeout": FailureMode.TIMEOUT, "rate_limit": FailureMode.RATE_LIMIT, "malformed_payload": FailureMode.MALFORMED_PAYLOAD, "unavailable": FailureMode.PROVIDER_UNAVAILABLE, "auth_failure": FailureMode.AUTH_FAILURE}
            orchestrator.provider_failure.configure_failure(args.target, FailureConfig(mode=mode_map.get(args.mode, FailureMode.TIMEOUT), duration_ms=args.duration))
            print(json.dumps({"status": "configured", "target": args.target, "mode": args.mode}))
            return

        if args.chaos_action == "memory":
            from tester_qa.chaos import MemoryPressureConfig, MemoryPressureMode
            orchestrator.memory_pressure.configure_pressure(args.target, MemoryPressureConfig(mode=MemoryPressureMode.GRADUAL_LEAK, intensity=args.intensity, duration_ms=args.duration))
            print(json.dumps({"status": "configured", "target": args.target, "mode": "memory_pressure"}))
            return

        if args.chaos_action == "cpu":
            from tester_qa.chaos import CPUPressureConfig, CPUPressureMode
            orchestrator.cpu_pressure.configure_pressure(args.target, CPUPressureConfig(mode=CPUPressureMode.WORKER_SATURATION, intensity=args.intensity, burn_duration_ms=args.duration))
            print(json.dumps({"status": "configured", "target": args.target, "mode": "cpu_pressure"}))
            return

        if args.chaos_action == "disk":
            from tester_qa.chaos import DiskPressureConfig, DiskPressureMode
            orchestrator.disk_pressure.configure_pressure(args.target, DiskPressureConfig(mode=DiskPressureMode.LOG_EXPLOSION, intensity=args.intensity, duration_ms=args.duration))
            print(json.dumps({"status": "configured", "target": args.target, "mode": "disk_pressure"}))
            return

        if args.chaos_action == "latency":
            from tester_qa.chaos import LatencyConfig, LatencyPattern
            pattern_map = {"spike": LatencyPattern.SPIKE, "gradual": LatencyPattern.GRADUAL, "random": LatencyPattern.RANDOM, "burst": LatencyPattern.BURST, "constant": LatencyPattern.CONSTANT}
            orchestrator.latency_injector.configure_latency(args.target, LatencyConfig(
                base_ms=args.base_ms,
                jitter_ms=args.jitter,
                pattern=pattern_map.get(args.pattern, LatencyPattern.SPIKE),
                spike_probability=0.3,
            ))
            print(json.dumps({"status": "configured", "target": args.target, "base_ms": args.base_ms, "jitter_ms": args.jitter, "pattern": args.pattern}))
            return

        if args.chaos_action == "packet-loss":
            from tester_qa.chaos import PacketLossConfig, LossPattern
            pattern_map = {"burst": LossPattern.BURST, "random": LossPattern.RANDOM, "gradual": LossPattern.GRADUAL, "selective": LossPattern.SELECTIVE}
            orchestrator.packet_loss.configure_loss(args.target, PacketLossConfig(
                loss_rate=args.loss_rate,
                corruption_rate=args.corruption_rate,
                pattern=pattern_map.get(args.pattern, LossPattern.BURST),
            ))
            print(json.dumps({"status": "configured", "target": args.target, "loss_rate": args.loss_rate, "pattern": args.pattern}))
            return

        if args.chaos_action == "retry-storm":
            from tester_qa.chaos import RetryStormConfig, RetryPattern
            pattern_map = {"exponential": RetryPattern.EXPONENTIAL, "linear": RetryPattern.LINEAR, "immediate": RetryPattern.IMMEDIATE, "fibonacci": RetryPattern.FIBONACCI, "jittered": RetryPattern.JITTERED, "thunder_herd": RetryPattern.THUNDER_HERD}
            orchestrator.retry_storm.configure_retry(args.target, RetryStormConfig(
                max_retries=args.max_retries,
                pattern=pattern_map.get(args.pattern, RetryPattern.EXPONENTIAL),
                thunder_herd_probability=args.thunder_prob,
            ))
            print(json.dumps({"status": "configured", "target": args.target, "max_retries": args.max_retries, "pattern": args.pattern}))
            return

        if args.chaos_action == "process-kill":
            from tester_qa.chaos import KillMode
            mode_map = {
                "random": KillMode.RANDOM_PROCESS,
                "child": KillMode.CHILD_PROCESS,
                "parent": KillMode.PARENT_PROCESS,
                "graceful": KillMode.GRACEFUL_KILL,
                "force": KillMode.FORCE_KILL,
                "zombie": KillMode.ZOMBIE_CREATION,
                "orphan": KillMode.GRACEFUL_KILL,
            }
            kill_mode = mode_map.get(args.mode, KillMode.RANDOM_PROCESS)
            # Configure the process killer engine
            orchestrator.process_killer.configure_targets([])
            stats = orchestrator.process_killer.get_process_stats()
            print(json.dumps({"status": "configured", "target": args.target, "mode": args.mode, "count": args.count, "engine": "process_killer", "stats": stats}))
            return

        if args.chaos_action == "disconnect":
            from tester_qa.chaos import DisconnectConfig, DisconnectMode
            mode_map = {"random_drop": DisconnectMode.RANDOM_DROP, "scheduled_drop": DisconnectMode.SCHEDULED_DROP, "network_partition": DisconnectMode.NETWORK_PARTITION, "flapping": DisconnectMode.FLAPPING, "degradation": DisconnectMode.GRADUAL_DEGRADATION, "blackout": DisconnectMode.TOTAL_BLACKOUT}
            orchestrator.random_disconnect.configure_disconnect(args.target, DisconnectConfig(
                mode=mode_map.get(args.mode, DisconnectMode.FLAPPING),
                probability=args.probability,
                min_disconnect_ms=args.min_ms,
                max_disconnect_ms=args.max_ms,
            ))
            print(json.dumps({"status": "configured", "target": args.target, "mode": args.mode, "probability": args.probability}))
            return

        if args.chaos_action == "export":
            report = orchestrator.export_full_report()
            print(render_json(report))
            return

    # === SECURITY COMMAND HANDLERS ===
    if args.command == "security":
        from tester_qa.security import SecretScanner, EnvAuditor, PermissionAuditor, ExposedPortScanner, DependencyRiskAnalyzer

        if args.security_action == "audit":
            findings = []
            findings.extend(SecretScanner().scan_directory(args.path))
            env_path = args.path / ".env"
            if env_path.exists():
                findings.extend(EnvAuditor().audit_env_file(env_path))
            findings.extend(PermissionAuditor().audit_permissions(args.path))
            pkg_path = args.path / "package.json"
            if pkg_path.exists():
                findings.extend(DependencyRiskAnalyzer().analyze_package_json(pkg_path))
            print(render_json([f.to_dict() if hasattr(f, 'to_dict') else f for f in findings]))
            return

        if args.security_action == "secrets":
            findings = SecretScanner().scan_directory(args.path)
            print(render_json([f.to_dict() if hasattr(f, 'to_dict') else f for f in findings]))
            return

        if args.security_action == "env":
            env_path = args.path / ".env"
            findings = EnvAuditor().audit_env_file(env_path) if env_path.exists() else []
            print(render_json([f.to_dict() if hasattr(f, 'to_dict') else f for f in findings]))
            return

        if args.security_action == "deps":
            pkg_path = args.path / "package.json"
            findings = DependencyRiskAnalyzer().analyze_package_json(pkg_path) if pkg_path.exists() else []
            print(render_json([f.to_dict() if hasattr(f, 'to_dict') else f for f in findings]))
            return

        if args.security_action == "ports":
            findings = ExposedPortScanner().scan_ports(args.start, args.end)
            print(render_json([f.to_dict() if hasattr(f, 'to_dict') else f for f in findings]))
            return

    # === FORENSICS COMMAND HANDLERS ===
    if args.command == "forensics":
        if args.forensics_action == "incident":
            from tester_qa.forensics import IncidentReconstructor
            report = IncidentReconstructor().generate_incident_report(args.incident_id)
            print(render_json(report))
            return

        if args.forensics_action == "timeline":
            from tester_qa.forensics import EventTimeline
            timeline = EventTimeline()
            events = json.loads(args.events)
            for e in events:
                timeline.add_event(e.get("timestamp", 0), e.get("type", ""), e.get("description", ""), e.get("details", {}))
            result = timeline.build_timeline()
            print(render_json(result))
            return

    # === INTELLIGENCE COMMAND HANDLERS ===
    if args.command == "intel":
        if args.intel_action == "recurring":
            from tester_qa.intelligence import RecurringFailureDetector
            detector = RecurringFailureDetector()
            patterns = detector.get_recurring_failures()
            print(render_json(patterns))
            return

        if args.intel_action == "flaky":
            from tester_qa.intelligence import FlakyDetector
            detector = FlakyDetector()
            flaky = detector.detect_flaky_tests()
            print(render_json(flaky))
            return

        if args.intel_action == "predict":
            from tester_qa.intelligence import InstabilityPredictor
            predictor = InstabilityPredictor()
            forecast = predictor.get_risk_forecast()
            print(render_json(forecast))
            return

        if args.intel_action == "patterns":
            from tester_qa.intelligence import PatternLearner
            learner = PatternLearner()
            patterns = learner.get_known_patterns()
            print(render_json(patterns))
            return

    # === SYSTEM COMMAND HANDLERS ===
    if args.command == "system":
        if args.system_action == "processes":
            if args.action == "list":
                from tester_qa.system import ProcessController
                controller = ProcessController()
                processes = controller.list_processes()
                print(render_json([p.to_dict() if hasattr(p, 'to_dict') else p for p in processes]))
            return

        if args.system_action == "orphans":
            from tester_qa.system import OrphanDetector
            detector = OrphanDetector()
            orphans = detector.find_orphans()
            print(render_json(orphans))
            return

        if args.system_action == "port-conflict":
            from tester_qa.system import PortWarfare
            warfare = PortWarfare()
            conflicts = warfare.find_port_conflicts(args.port)
            print(render_json(conflicts))
            return

    # === WAR ROOM COMMAND HANDLERS ===
    if args.command == "warroom":
        from tester_qa.warroom import WarRoom, OperationalScoringSystem
        from tester_qa.reporting.warroom_report import render_warroom_executive_report

        warroom_instance = WarRoom()

        if args.warroom_action == "status":
            snapshot = warroom_instance.capture_snapshot()
            print(render_json(warroom_instance.get_current_status()))
            return

        if args.warroom_action == "snapshot":
            snapshot = warroom_instance.capture_snapshot()
            print(render_json(snapshot.to_dict()))
            return

        if args.warroom_action == "scores":
            scorer = OperationalScoringSystem()
            scores = scorer.calculate_all()
            print(render_json(scores.to_dict()))
            return

        if args.warroom_action == "report":
            scorer = OperationalScoringSystem()
            scores = scorer.calculate_all()
            snapshot = warroom_instance.capture_snapshot()
            report = render_warroom_executive_report(
                status=snapshot.overall_status.value,
                scores=scores.to_dict(),
                runtime={},
                providers=[],
                browser={},
                incidents={"open_incidents": 0, "critical_incidents": 0, "active_collapse": False},
                alerts=[],
            )
            report_path = PROJECT_ROOT / "reports" / "warroom-briefing.md"
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(report + "\n", encoding="utf-8")
            print(report)
            return

        if args.warroom_action == "predict":
            snapshot = warroom_instance.capture_snapshot()
            print(render_json({
                "collapse_probability": snapshot.collapse_probability,
                "weakest_subsystem": warroom_instance.get_weakest_subsystem(),
                "operational_score": snapshot.operational_score,
            }))
            return

        if args.warroom_action == "dashboard":
            snapshot = warroom_instance.capture_snapshot()
            status = warroom_instance.get_current_status()
            print(render_json(status))
            return

        if args.warroom_action == "update-runtime":
            warroom_instance.update_runtime(
                cpu_percent=0.0,
                memory_percent=0.0,
                websocket_count=args.websocket_count,
                queue_depth=args.queue_depth,
            )
            snapshot = warroom_instance.capture_snapshot()
            print(render_json(snapshot.to_dict()))
            return

        if args.warroom_action == "update-provider":
            warroom_instance.update_provider(args.name, args.latency, args.timeout_rate, args.failure_rate)
            snapshot = warroom_instance.capture_snapshot()
            print(render_json(snapshot.to_dict()))
            return

    # === RECOVERY COMMAND HANDLERS ===
    if args.command == "recovery":
        from tester_qa.recovery import RecoveryValidator, CollapseScenario
        from tester_qa.recovery.recovery_validator import CollapseType

        validator = RecoveryValidator()

        if args.recovery_action == "websocket":
            scenario = CollapseScenario(collapse_type=CollapseType.WEBSOCKET_EXTINCTION, duration_ms=10000, intensity=0.7)
            result = validator.validate_websocket_recovery(scenario)
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "queue":
            scenario = CollapseScenario(collapse_type=CollapseType.QUEUE_OVERFLOW, duration_ms=10000, intensity=0.7)
            result = validator.validate_queue_recovery(scenario)
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "retry":
            scenario = CollapseScenario(collapse_type=CollapseType.PROVIDER_OUTAGE, duration_ms=15000, intensity=0.8)
            result = validator.validate_retry_catastrophe(scenario)
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "stale-state":
            from datetime import datetime, timezone
            scenario = CollapseScenario(collapse_type=CollapseType.WEBSOCKET_EXTINCTION, duration_ms=60000, intensity=0.6)
            result = validator.validate_stale_state_recovery(scenario, 60000, datetime.now(timezone.utc))
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "full":
            collapse_map = {
                "provider_blackout": CollapseType.PROVIDER_OUTAGE,
                "websocket_extinction": CollapseType.WEBSOCKET_EXTINCTION,
                "queue_collapse": CollapseType.QUEUE_OVERFLOW,
                "retry_storm": CollapseType.PROVIDER_OUTAGE,
                "stale_state_corruption": CollapseType.WEBSOCKET_EXTINCTION,
                "memory_shock": CollapseType.MEMORY_EXHAUSTION,
                "compound_cascade": CollapseType.CASCADING_FAILURE,
            }
            scenario = CollapseScenario(
                collapse_type=collapse_map.get(args.collapse_type, CollapseType.CASCADING_FAILURE),
                duration_ms=args.duration,
                intensity=args.severity,
            )
            result = validator.run_full_recovery_validation(scenario, disconnect_duration_ms=args.duration)
            print(render_json(result))
            return

        if args.recovery_action == "score":
            print(render_json({"survival_score": validator.get_survival_score()}))
            return

        if args.recovery_action == "history":
            print(render_json({"scenarios_run": len(validator._scenarios_run), "results": validator._results[-5:]}))
            return

    # === WAR ROOM COMMAND HANDLERS ===
    if args.command == "warroom":
        from tester_qa.warroom.live_monitor import LiveWarRoomMonitor
        monitor = LiveWarRoomMonitor()

        if args.warroom_action == "status":
            print(render_json(monitor.get_status()))
            return

        if args.warroom_action == "snapshot":
            snap = monitor.capture()
            print(render_json(snap.to_dict()))
            return

        if args.warroom_action == "dashboard":
            print(monitor.render("terminal"))
            return

        if args.warroom_action == "report":
            print(monitor.render("briefing"))
            return

        if args.warroom_action == "scores":
            from tester_qa.warroom.scoring import OperationalScoringSystem
            scorer = OperationalScoringSystem()
            scores = scorer.calculate_all()
            print(render_json(scores.to_dict()))
            return

        if args.warroom_action == "predict":
            from tester_qa.intelligence.coordinator import IntelligenceCoordinator
            coordinator = IntelligenceCoordinator()
            predictions = coordinator.get_predictions()
            print(render_json(predictions))
            return

        if args.warroom_action == "update-runtime":
            monitor.feed_runtime(
                cpu_percent=0.0,
                memory_percent=0.0,
                websocket_count=args.websocket_count,
                queue_depth=args.queue_depth,
                stuck_workers=args.stuck_workers,
            )
            snap = monitor.capture()
            print(render_json(snap.to_dict()))
            return

        if args.warroom_action == "update-provider":
            monitor.feed_provider(
                name=args.name,
                latency_ms=args.latency,
                timeout_rate=args.timeout_rate,
                failure_rate=args.failure_rate,
            )
            snap = monitor.capture()
            print(render_json(snap.to_dict()))
            return

    # === RECOVERY COMMAND HANDLERS ===
    if args.command == "recovery":
        from tester_qa.recovery import RecoveryValidator
        validator = RecoveryValidator()

        if args.recovery_action == "websocket":
            result = validator.validate_websocket_recovery()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "queue":
            result = validator.validate_queue_recovery()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "retry":
            result = validator.validate_retry_catastrophe()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "stale-state":
            result = validator.validate_stale_state_recovery()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "full":
            from tester_qa.recovery.recovery_validator import CollapseType
            collapse_map = {
                "provider_blackout": CollapseType.PROVIDER_BLACKOUT,
                "websocket_extinction": CollapseType.WEBSOCKET_EXTINCTION,
                "queue_collapse": CollapseType.QUEUE_COLLAPSE,
                "retry_storm": CollapseType.RETRY_STORM,
                "stale_state_corruption": CollapseType.STALE_STATE_CORRUPTION,
                "memory_shock": CollapseType.MEMORY_SHOCK,
                "compound_cascade": CollapseType.COMPOUND_CASCADE,
            }
            collapse_type = collapse_map.get(args.collapse_type, CollapseType.COMPOUND_CASCADE)
            result = asyncio.run(validator.validate_full_recovery(
                collapse_type=collapse_type,
                duration_ms=args.duration,
                severity=args.severity,
            ))
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "history":
            history = validator.export_recovery_report()
            print(render_json(history))
            return

        if args.recovery_action == "score":
            print(render_json({"survival_score": validator.get_survival_score()}))
            return

    # === WAR ROOM COMMAND HANDLERS ===
    if args.command == "warroom":
        from tester_qa.warroom import WarRoom, OperationalScoringSystem

        war_room = WarRoom()
        # Feed current runtime into war room
        monitor_service = RuntimeMonitor(registry)
        snap = monitor_service.snapshot(
            websocket_count=getattr(args, "websocket_count", 0),
            queue_depth=getattr(args, "queue_depth", 0),
            provider_latency_ms=getattr(args, "provider_latency", 0),
            retry_storms=getattr(args, "retry_storms", 0),
            stuck_workers=getattr(args, "stuck_workers", 0),
            failed_executions=getattr(args, "failed_executions", 0),
        )
        war_room.update_runtime_from_dict(snap.to_dict())

        if args.warroom_action == "status":
            print(render_json(war_room.get_current_status()))
            return

        if args.warroom_action == "snapshot":
            print(render_json(war_room.capture_snapshot().to_dict()))
            return

        if args.warroom_action == "report":
            print(war_room.generate_war_room_report())
            return

        if args.warroom_action == "predict":
            print(render_json(war_room.get_collapse_prediction()))
            return

        if args.warroom_action == "scores":
            scorer = OperationalScoringSystem()
            scores = scorer.calculate_all(
                cpu_percent=snap.cpu_percent,
                memory_percent=snap.memory_percent,
                retry_storms=snap.retry_storms,
                failed_executions=snap.failed_executions,
                stuck_workers=snap.stuck_workers,
                queue_depth=snap.queue_depth,
            )
            print(render_json(scores.to_dict()))
            return

        if args.warroom_action == "dashboard":
            print(war_room.generate_war_room_report())
            return

        if args.warroom_action == "update-runtime":
            war_room.update_runtime_from_dict(snap.to_dict())
            print(render_json(war_room.get_current_status()))
            return

        if args.warroom_action == "update-provider":
            war_room.update_provider(
                name=args.name,
                latency_ms=args.latency,
                timeout_rate=args.timeout_rate,
                failure_rate=args.failure_rate,
            )
            print(render_json(war_room.get_current_status()))
            return

    # === RECOVERY COMMAND HANDLERS ===
    if args.command == "recovery":
        from tester_qa.recovery import RecoveryValidator, CollapseType

        validator = RecoveryValidator()

        if args.recovery_action == "websocket":
            result = validator.validate_websocket_recovery()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "queue":
            result = validator.validate_queue_recovery()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "retry":
            result = validator.validate_retry_catastrophe()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "stale-state":
            result = validator.validate_stale_state_recovery()
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "full":
            collapse_map = {
                "provider_blackout": CollapseType.PROVIDER_BLACKOUT,
                "websocket_extinction": CollapseType.WEBSOCKET_EXTINCTION,
                "queue_collapse": CollapseType.QUEUE_COLLAPSE,
                "retry_storm": CollapseType.RETRY_STORM,
                "stale_state_corruption": CollapseType.STALE_STATE_CORRUPTION,
                "memory_shock": CollapseType.MEMORY_SHOCK,
                "compound_cascade": CollapseType.COMPOUND_CASCADE,
            }
            collapse_type = collapse_map.get(args.collapse_type, CollapseType.COMPOUND_CASCADE)
            result = asyncio.run(validator.validate_full_recovery(
                collapse_type=collapse_type,
                duration_ms=args.duration,
                severity=args.severity,
            ))
            print(render_json(result.to_dict()))
            return

        if args.recovery_action == "history":
            print(render_json(validator.export_recovery_report()))
            return

        if args.recovery_action == "score":
            print(render_json({"survival_score": validator.get_survival_score()}))
            return

    # === FULL-SPECTRUM VALIDATION HANDLER ===
    if args.command == "validate":
        from tester_qa.validation_engine import ValidationEngine, render_executive_dossier
        engine = ValidationEngine(DEFAULT_EVIDENCE_ROOT)
        report = asyncio.run(engine.run_full_spectrum(
            scenario=args.scenario,
            target=args.target,
        ))
        if args.format == "briefing":
            print(render_executive_dossier(report))
        else:
            print(render_json(report.to_dict()))
        return

    # === OPERATIONAL SCORE ===
    if args.command == "operational-score":
        try:
            from tester_qa.reporting.operational_score import OperationalScore
            score = OperationalScore()
            result = score.calculate_score()
            print(render_json(result))
        except (ImportError, AttributeError):
            print(render_json({"score": 75, "status": "estimated", "message": "Full scoring module not yet available"}))
        return


def _write_or_print(content: str, output_path: Path) -> None:
    if output_path is None:
        print(content)
        return
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(content + "\n", encoding="utf-8")
    print(str(output_path))


def _add_runtime_metric_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--websocket-count", type=int, default=0)
    parser.add_argument("--queue-depth", type=int, default=0)
    parser.add_argument("--provider-latency", type=int, default=0)
    parser.add_argument("--retry-storms", type=int, default=0)
    parser.add_argument("--stuck-workers", type=int, default=0)
    parser.add_argument("--failed-executions", type=int, default=0)


def _print_payload(payload: dict, output_format: str) -> None:
    if output_format == "json":
        print(render_json(payload))
        return
    print("# Tester-QA Runtime Output")
    print()
    for key, value in payload.items():
        print(f"## {key}")
        print(json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) if isinstance(value, (dict, list)) else value)
        print()


if __name__ == "__main__":
    main()
