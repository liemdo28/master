"""Control Center API — REST endpoints for the UI dashboard."""
from __future__ import annotations

import asyncio
import json
import logging
import threading
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any
from urllib.parse import urlparse, parse_qs

from tester_qa.core.event_bus import EventBus, EventType
from tester_qa.core.orchestrator import Orchestrator
from tester_qa.server.ws import (
    EventBroadcaster,
    EventStream,
    IncidentStream,
    TelemetryStream,
    WarRoomWebSocketServer,
)
from tester_qa.incidents import IncidentRegistry, Severity
from tester_qa.evidence import EvidenceEngine
from tester_qa.browser.playwright_runner import PlaywrightRunner
from tester_qa.projects.project_indexer import ProjectIndexer
from tester_qa.reporting.report_engine import ReportEngine
from tester_qa.auth.auth_profiles import AuthProfileManager
from tester_qa.warroom.war_room import WarRoom, OperationalStatus
from tester_qa.runtime_monitor import RuntimeMonitor
from tester_qa.browser_warfare.browser_warfare_orchestrator import (
    BrowserWarfareOrchestrator,
    SCENARIOS as BW_SCENARIOS,
)


# ─────────────────────────────────────────────────────────────────────────────
# Task Queue — background execution
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Task:
    task_id: str
    task_type: str
    project_id: str
    status: str  # queued | running | completed | failed
    started_at: float = 0.0
    completed_at: float = 0.0
    result: dict | None = None
    error: str | None = None

    def to_dict(self) -> dict:
        d = asdict(self)
        return d


class TaskQueue:
    """Background task queue with real execution."""

    def __init__(self) -> None:
        self._tasks: dict[str, Task] = {}
        self._lock = threading.Lock()

    def enqueue(self, task_type: str, project_id: str, payload: dict | None = None) -> str:
        task_id = f"task-{int(time.time() * 1000)}"
        task = Task(task_id=task_id, task_type=task_type, project_id=project_id, status="queued")
        with self._lock:
            self._tasks[task_id] = task
        # Run in background thread
        thread = threading.Thread(target=self._execute, args=(task, payload or {}), daemon=True)
        thread.start()
        return task_id

    def get(self, task_id: str) -> dict | None:
        with self._lock:
            task = self._tasks.get(task_id)
            return task.to_dict() if task else None

    def list(self) -> list[dict]:
        with self._lock:
            return [t.to_dict() for t in self._tasks.values()]

    def _execute(self, task: Task, payload: dict) -> None:
        task.status = "running"
        task.started_at = time.time()
        bus = EventBus.get_instance()

        try:
            if task.task_type == "full-qa":
                result = self._run_full_qa(task, payload)
            elif task.task_type == "stress-test":
                result = self._run_stress_test(task, payload)
            elif task.task_type == "browser-audit":
                result = self._run_browser_audit(task, payload)
            elif task.task_type == "chaos-test":
                result = self._run_chaos_test(task, payload)
            elif task.task_type == "security-audit":
                result = self._run_security_audit(task, payload)
            elif task.task_type == "runtime-audit":
                result = self._run_runtime_audit(task, payload)
            elif task.task_type == "browser-warfare":
                result = self._run_browser_warfare(task, payload)
            else:
                result = {"error": f"Unknown task type: {task.task_type}"}

            task.result = result
            task.status = "completed"
            bus.emit(EventType.REPORT_READY, "task_queue", {"task_id": task.task_id, "project": task.project_id}, task.project_id)

        except Exception as e:
            task.error = str(e)
            task.status = "failed"
            bus.emit(EventType.INCIDENT_CREATED, "task_queue", {"task_id": task.task_id, "error": str(e)}, task.project_id)

        task.completed_at = time.time()

    def _run_full_qa(self, task: Task, payload: dict) -> dict:
        """Run comprehensive QA suite."""
        project_id = task.project_id
        bus = EventBus.get_instance()
        bus.emit(EventType.CHAOS_STARTED, "task_queue", {"task": "full-qa", "project": project_id}, project_id)

        evidence_engine = EvidenceEngine()
        evidence_root = Path("evidence")

        # Run browser inspection
        results = {"browser": None, "runtime": None, "incidents": []}

        project_url = payload.get("url", "http://localhost:8000")
        try:
            runner = PlaywrightRunner(evidence_root=evidence_root, reports_root=Path("reports"))
            inspection = runner.inspect(project_url)
            results["browser"] = inspection.to_dict()
        except Exception as e:
            results["browser"] = {"error": str(e)}

        # Run runtime audit
        try:
            monitor = RuntimeMonitor(IncidentRegistry(evidence_root / "incidents"))
            snapshot = monitor.snapshot()
            anomalies = monitor.detect_anomalies(snapshot)
            incident_ids = monitor.generate_incidents(anomalies) if anomalies else []
            results["runtime"] = {
                "snapshot": snapshot.to_dict(),
                "anomalies": [a.to_dict() for a in anomalies],
                "incidents_created": incident_ids,
            }
        except Exception as e:
            results["runtime"] = {"error": str(e)}

        bus.emit(EventType.CHAOS_COMPLETED, "task_queue", {"task": "full-qa", "project": project_id, "results": results}, project_id)
        return results

    def _run_stress_test(self, task: Task, payload: dict) -> dict:
        """Run HTTP/WebSocket stress test."""
        from tester_qa.stress import HttpStressTester, WebsocketStressTester
        url = payload.get("url", "http://localhost:8000")
        stress_level = payload.get("stress_level", "medium")

        levels = {"low": (5, 2), "medium": (20, 5), "high": (50, 10), "extreme": (100, 20)}
        requests, concurrency = levels.get(stress_level, (20, 5))

        results = {}
        try:
            http_result = HttpStressTester().run(url, requests=requests, concurrency=concurrency, timeout_seconds=5)
            results["http"] = http_result
        except Exception as e:
            results["http"] = {"error": str(e)}

        try:
            ws_result = WebsocketStressTester().simulate_reconnect_storm(url, clients=min(10, concurrency), reconnects=3)
            results["websocket"] = ws_result
        except Exception as e:
            results["websocket"] = {"error": str(e)}

        # Auto-create incident if failures detected
        if results.get("http", {}).get("failed", 0) > 0:
            registry = IncidentRegistry(Path("evidence/incidents"))
            registry.create(
                title=f"Stress test failures: {task.project_id}",
                summary=f"HTTP failures: {results['http'].get('failed', 0)}, stress_level: {stress_level}",
                severity=Severity.HIGH,
            )

        return results

    def _run_browser_audit(self, task: Task, payload: dict) -> dict:
        """Run Playwright browser inspection with full evidence capture."""
        evidence_root = Path("evidence")
        reports_root = Path("reports")
        project_url = payload.get("url", "http://localhost:8000")

        try:
            runner = PlaywrightRunner(evidence_root=evidence_root, reports_root=reports_root)
            inspection = runner.inspect(project_url)

            # Auto-create incident for severe findings
            if inspection.findings or inspection.network_failures:
                registry = IncidentRegistry(evidence_root / "incidents")
                severity = Severity.CRITICAL if len(inspection.network_failures) > 5 else Severity.HIGH
                incident = registry.create(
                    title=f"Browser audit: {project_url} — {len(inspection.findings)} findings",
                    summary=f"Console errors: {len(inspection.console_errors)}, "
                            f"Network failures: {len(inspection.network_failures)}, "
                            f"Findings: {'; '.join(inspection.findings[:5])}",
                    severity=severity,
                )
                return {"inspection": inspection.to_dict(), "incident": incident.to_dict() if incident else None}

            return {"inspection": inspection.to_dict()}

        except Exception as e:
            return {"error": str(e)}

    def _run_chaos_test(self, task: Task, payload: dict) -> dict:
        """Run chaos engineering scenario."""
        scenario = payload.get("scenario", "provider_meltdown")
        from tester_qa.chaos import get_chaos_orchestrator

        bus = EventBus.get_instance()
        bus.emit(EventType.CHAOS_STARTED, "task_queue", {"scenario": scenario, "project": task.project_id}, task.project_id)

        try:
            orchestrator = get_chaos_orchestrator()
            result = asyncio.run(orchestrator.execute_scenario(scenario, task.project_id))
            return {
                "scenario": result.scenario,
                "events_generated": result.events_generated,
                "failures_detected": result.failures_detected,
                "systems_affected": result.systems_affected,
                "details": result.details,
            }
        except Exception as e:
            return {"error": str(e)}

    def _run_security_audit(self, task: Task, payload: dict) -> dict:
        """Run security audit suite."""
        from tester_qa.security import SecretScanner, EnvAuditor, DependencyRiskAnalyzer

        results: dict[str, Any] = {}
        path = payload.get("path", Path("."))

        try:
            scanner = SecretScanner()
            results["secrets"] = [f.to_dict() if hasattr(f, 'to_dict') else f for f in scanner.scan_directory(path)]
        except Exception as e:
            results["secrets"] = {"error": str(e)}

        try:
            env_path = path / ".env"
            if env_path.exists():
                auditor = EnvAuditor()
                results["env"] = [f.to_dict() if hasattr(f, 'to_dict') else f for f in auditor.audit_env_file(env_path)]
        except Exception as e:
            results["env"] = {"error": str(e)}

        try:
            pkg_path = path / "package.json"
            if pkg_path.exists():
                analyzer = DependencyRiskAnalyzer()
                results["deps"] = [f.to_dict() if hasattr(f, 'to_dict') else f for f in analyzer.analyze_package_json(pkg_path)]
        except Exception as e:
            results["deps"] = {"error": str(e)}

        # Auto-create incident for critical security findings
        critical = [r for r in results.get("secrets", []) if isinstance(r, dict) and r.get("severity") in ("critical", "high")]
        if critical:
            registry = IncidentRegistry(Path("evidence/incidents"))
            registry.create(
                title=f"Security audit: {len(critical)} critical findings",
                summary=f"Critical/high severity secrets: {len(critical)}",
                severity=Severity.CRITICAL,
            )

        return results

    def _run_runtime_audit(self, task: Task, payload: dict) -> dict:
        """Run runtime audit with auto-incident generation."""
        evidence_root = Path("evidence")
        registry = IncidentRegistry(evidence_root / "incidents")
        monitor = RuntimeMonitor(registry)

        # Parse runtime metrics from payload
        snapshot = monitor.snapshot(
            websocket_count=payload.get("websocket_count", 0),
            queue_depth=payload.get("queue_depth", 0),
            provider_latency_ms=payload.get("provider_latency_ms", 0),
            retry_storms=payload.get("retry_storms", 0),
            stuck_workers=payload.get("stuck_workers", 0),
            failed_executions=payload.get("failed_executions", 0),
        )

        anomalies = monitor.detect_anomalies(snapshot)
        incident_ids = monitor.generate_incidents(anomalies)

        return {
            "snapshot": snapshot.to_dict(),
            "anomalies": [a.to_dict() for a in anomalies],
            "incidents_created": incident_ids,
            "anomaly_count": len(anomalies),
        }

    def _run_browser_warfare(self, task: Task, payload: dict) -> dict:
        """Run browser warfare scenario against a target URL."""
        evidence_root = Path("evidence")
        scenario = payload.get("scenario", "memory_bomb")
        url = payload.get("url", "http://localhost:8000")
        ws_url = payload.get("ws_url", "")
        timeout = payload.get("timeout_seconds", 30)

        orchestrator = BrowserWarfareOrchestrator(
            evidence_root=evidence_root,
            timeout_seconds=timeout,
        )
        result = orchestrator.execute_scenario(scenario, url, ws_url)

        # Auto-create incident for extreme/high danger scenarios
        if scenario in ("total_browser_warfare", "websocket_apocalypse") or not result.success:
            registry = IncidentRegistry(evidence_root / "incidents")
            severity = Severity.CRITICAL if not result.success else Severity.HIGH
            registry.create(
                title=f"Browser warfare [{scenario}]: {len(result.errors)} errors",
                summary=f"Scenario: {scenario}, "
                        f"Modules executed: {len(result.modules_executed)}, "
                        f"Errors: {len(result.errors)}, "
                        f"Screenshot: {result.screenshot_path}",
                severity=severity,
            )

        return result.to_dict()


# Global instances
_task_queue = TaskQueue()
_war_room = WarRoom()
_event_bus = EventBus.get_instance()


# ─────────────────────────────────────────────────────────────────────────────
# HTTP Handler
# ─────────────────────────────────────────────────────────────────────────────

class ControlCenterHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the Control Center API."""

    indexer = ProjectIndexer()
    report_engine = ReportEngine()
    auth_manager = AuthProfileManager()

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        routes: dict[str, Any] = {
            "/api/projects": self._handle_list_projects,
            "/api/reports": self._handle_list_reports,
            "/api/incidents": self._handle_list_incidents,
            "/api/runtime": self._handle_runtime_status,
            "/api/evidence": self._handle_list_evidence,
            "/api/health": self._handle_health,
            "/api/auth/profiles": self._handle_list_auth_profiles,
            "/api/warroom": self._handle_warroom,
            "/api/warroom/snapshot": self._handle_warroom_snapshot,
            "/api/events": self._handle_events,
            "/api/tasks": self._handle_list_tasks,
            "/api/event-types": self._handle_event_types,
            "/api/browser-warfare/scenarios": self._handle_list_bw_scenarios,
        }

        handler = routes.get(path)
        if handler:
            handler(params)
        else:
            self._json_response(404, {"error": "Not found", "path": path})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body: dict = {}
        if content_length > 0:
            try:
                body = json.loads(self.rfile.read(content_length))
            except json.JSONDecodeError:
                body = {}

        routes: dict[str, Any] = {
            "/api/scan-projects": self._handle_scan_projects,
            "/api/run-qa": self._handle_run_qa,
            "/api/run-stress": self._handle_run_stress,
            "/api/run-browser-audit": self._handle_run_browser_audit,
            "/api/run-chaos": self._handle_run_chaos,
            "/api/run-security-audit": self._handle_run_security_audit,
            "/api/run-runtime-audit": self._handle_run_runtime_audit,
            "/api/save-auth-session": self._handle_save_auth_session,
            "/api/register-project": self._handle_register_project,
            "/api/remove-project": self._handle_remove_project,
            "/api/warroom/update-runtime": self._handle_warroom_update_runtime,
            "/api/warroom/update-provider": self._handle_warroom_update_provider,
            "/api/warroom/feed-metrics": self._handle_warroom_feed_metrics,
            "/api/tasks": self._handle_get_task,
            "/api/run-browser-warfare": self._handle_run_browser_warfare,
        }

        handler = routes.get(path)
        if handler:
            handler(body)
        else:
            self._json_response(404, {"error": "Not found", "path": path})

    # ── GET Handlers ──────────────────────────────────────────────────────────

    def _handle_health(self, params: dict) -> None:
        evidence_root = Path("evidence")
        incidents_dir = evidence_root / "incidents"
        incident_count = len(list(incidents_dir.glob("*.json"))) if incidents_dir.exists() else 0
        broadcaster = EventBroadcaster.get_instance()
        self._json_response(200, {
            "status": "operational",
            "version": "2.1.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "components": {
                "project_indexer": "ready",
                "report_engine": "ready",
                "auth_manager": "ready",
                "war_room": "ready",
                "task_queue": "ready",
                "event_bus": "ready",
                "websocket": "ready",
            },
            "stats": {
                "incidents": incident_count,
                "active_incidents": len(_war_room._active_incidents),
                "operational_score": _war_room._operational_score,
                "collapse_probability": _war_room._collapse_probability,
            },
            "websocket": broadcaster.get_stats(),
        })

    def _handle_list_projects(self, params: dict) -> None:
        projects = self.indexer.list_projects()
        self._json_response(200, {"projects": projects, "count": len(projects)})

    def _handle_list_reports(self, params: dict) -> None:
        project_id = params.get("project", [None])[0]
        reports = self.report_engine.list_reports(project_id)
        self._json_response(200, {"reports": reports, "count": len(reports)})

    def _handle_list_incidents(self, params: dict) -> None:
        evidence_root = Path("evidence")
        incidents_dir = evidence_root / "incidents"
        incidents: list[dict] = []
        if incidents_dir.exists():
            for f in sorted(incidents_dir.glob("*.json"), reverse=True):
                try:
                    incidents.append(json.loads(f.read_text(encoding="utf-8")))
                except (json.JSONDecodeError, OSError):
                    incidents.append({"file": f.name, "error": "parse_failed"})
        self._json_response(200, {"incidents": incidents, "count": len(incidents)})

    def _handle_runtime_status(self, params: dict) -> None:
        projects = self.indexer.list_projects()
        runtimes: list[dict] = []
        for project in projects:
            for rt in project.get("runtimes", []):
                rt = dict(rt)
                rt["project"] = project.get("name", project.get("id", "unknown"))
                runtimes.append(rt)
        self._json_response(200, {"runtimes": runtimes, "count": len(runtimes)})

    def _handle_list_evidence(self, params: dict) -> None:
        evidence_dir = Path("evidence")
        evidence: dict[str, list[str]] = {}
        if evidence_dir.exists():
            for category_dir in evidence_dir.iterdir():
                if category_dir.is_dir() and not category_dir.name.startswith("."):
                    files = [f.name for f in category_dir.iterdir() if f.is_file() and f.name != ".gitkeep"]
                    if files:
                        evidence[category_dir.name] = sorted(files, reverse=True)
        self._json_response(200, {"evidence": evidence})

    def _handle_list_auth_profiles(self, params: dict) -> None:
        project_id = params.get("project", [None])[0]
        profiles = self.auth_manager.list_profiles(project_id)
        self._json_response(200, {
            "profiles": [p.to_dict() for p in profiles],
            "count": len(profiles),
        })

    def _handle_warroom(self, params: dict) -> None:
        """Get war room current status."""
        status = _war_room.get_current_status()
        status["warroom_report"] = _war_room.generate_war_room_report()
        status["active_incidents"] = [i.to_dict() for i in _war_room._active_incidents]
        self._json_response(200, status)

    def _handle_warroom_snapshot(self, params: dict) -> None:
        """Get war room full snapshot."""
        snapshot = _war_room.capture_snapshot()
        self._json_response(200, snapshot.to_dict())

    def _handle_events(self, params: dict) -> None:
        """Get recent events from the event bus."""
        limit = int(params.get("limit", ["50"])[0])
        seconds = float(params.get("seconds", ["60"])[0])
        events = _event_bus.get_recent(seconds=seconds)
        history = _event_bus.get_history(limit=limit)
        self._json_response(200, {
            "recent": events,
            "history": history,
            "total_in_history": len(_event_bus._history),
        })

    def _handle_list_tasks(self, params: dict) -> None:
        tasks = _task_queue.list()
        self._json_response(200, {"tasks": tasks, "count": len(tasks)})

    def _handle_event_types(self, params: dict) -> None:
        types = [e.value for e in EventType]
        self._json_response(200, {"event_types": types})

    def _handle_list_bw_scenarios(self, params: dict) -> None:
        """List available browser warfare scenarios."""
        orchestrator = BrowserWarfareOrchestrator()
        scenarios = orchestrator.list_scenarios()
        self._json_response(200, {"scenarios": scenarios, "count": len(scenarios)})

    # ── POST Handlers ──────────────────────────────────────────────────────────

    def _handle_scan_projects(self, body: dict) -> None:
        path = body.get("path", ".")
        try:
            results = self.indexer.index_and_save(path)
            self._json_response(200, {
                "status": "scanned",
                "projects_found": len(results),
                "projects": results,
            })
        except Exception as e:
            self._json_response(500, {"error": str(e)})

    def _handle_run_qa(self, body: dict) -> None:
        project_id = body.get("project_id", "unknown")
        url = body.get("url", "http://localhost:8000")
        task_id = _task_queue.enqueue("full-qa", project_id, {"url": url})
        self._json_response(202, {
            "status": "queued",
            "task": "full-qa",
            "task_id": task_id,
            "project": project_id,
        })

    def _handle_run_stress(self, body: dict) -> None:
        project_id = body.get("project_id", "unknown")
        url = body.get("url", "http://localhost:8000")
        stress_level = body.get("stress_level", "medium")
        task_id = _task_queue.enqueue("stress-test", project_id, {"url": url, "stress_level": stress_level})
        self._json_response(202, {
            "status": "queued",
            "task": "stress-test",
            "task_id": task_id,
            "project": project_id,
            "stress_level": stress_level,
        })

    def _handle_run_browser_audit(self, body: dict) -> None:
        project_id = body.get("project_id", "unknown")
        url = body.get("url", "http://localhost:8000")
        task_id = _task_queue.enqueue("browser-audit", project_id, {"url": url})
        self._json_response(202, {
            "status": "queued",
            "task": "browser-audit",
            "task_id": task_id,
            "project": project_id,
        })

    def _handle_run_chaos(self, body: dict) -> None:
        project_id = body.get("project_id", "unknown")
        scenario = body.get("scenario", "provider_meltdown")
        task_id = _task_queue.enqueue("chaos-test", project_id, {"scenario": scenario})
        self._json_response(202, {
            "status": "queued",
            "task": "chaos-test",
            "task_id": task_id,
            "project": project_id,
            "scenario": scenario,
        })

    def _handle_run_security_audit(self, body: dict) -> None:
        project_id = body.get("project_id", "unknown")
        path = Path(body.get("path", "."))
        task_id = _task_queue.enqueue("security-audit", project_id, {"path": path})
        self._json_response(202, {
            "status": "queued",
            "task": "security-audit",
            "task_id": task_id,
            "project": project_id,
        })

    def _handle_run_runtime_audit(self, body: dict) -> None:
        project_id = body.get("project_id", "unknown")
        task_id = _task_queue.enqueue("runtime-audit", project_id, body)
        self._json_response(202, {
            "status": "queued",
            "task": "runtime-audit",
            "task_id": task_id,
            "project": project_id,
        })

    def _handle_save_auth_session(self, body: dict) -> None:
        project_id = body.get("project_id")
        if not project_id:
            self._json_response(400, {"error": "project_id required"})
            return
        self._json_response(200, {
            "status": "session_saved",
            "project": project_id,
            "message": "Auth session captured. Use manual login flow to populate.",
        })

    def _handle_register_project(self, body: dict) -> None:
        project_id = body.get("id") or body.get("project_id")
        path = body.get("path")
        if not project_id or not path:
            self._json_response(400, {"error": "id and path required"})
            return
        tags = body.get("tags", [])
        entry = self.indexer.register_project(project_id, path, tags=tags)
        self._json_response(201, {"status": "registered", "project": entry})

    def _handle_remove_project(self, body: dict) -> None:
        project_id = body.get("id") or body.get("project_id")
        if not project_id:
            self._json_response(400, {"error": "id required"})
            return
        removed = self.indexer.remove_project(project_id)
        if removed:
            self._json_response(200, {"status": "removed", "project_id": project_id})
        else:
            self._json_response(404, {"error": "project not found"})

    def _handle_warroom_update_runtime(self, body: dict) -> None:
        """Feed runtime metrics into the war room."""
        _war_room.update_runtime_from_dict(body)
        snapshot = _war_room.capture_snapshot()
        self._json_response(200, snapshot.to_dict())

    def _handle_warroom_update_provider(self, body: dict) -> None:
        """Feed provider metrics into the war room."""
        name = body.get("name", "default")
        latency = int(body.get("latency_ms", 0))
        timeout_rate = float(body.get("timeout_rate", 0.0))
        failure_rate = float(body.get("failure_rate", 0.0))
        _war_room.update_provider(name, latency, timeout_rate, failure_rate)
        snapshot = _war_room.capture_snapshot()
        self._json_response(200, snapshot.to_dict())

    def _handle_warroom_feed_metrics(self, body: dict) -> None:
        """Feed combined metrics into war room."""
        if "runtime" in body:
            _war_room.update_runtime_from_dict(body["runtime"])
        if "browser" in body:
            _war_room.update_browser_from_dict(body["browser"])
        for provider in body.get("providers", []):
            _war_room.update_provider(
                name=provider.get("name", "unknown"),
                latency_ms=int(provider.get("latency_ms", 0)),
                timeout_rate=float(provider.get("timeout_rate", 0.0)),
                failure_rate=float(provider.get("failure_rate", 0.0)),
            )
        snapshot = _war_room.capture_snapshot()
        self._json_response(200, snapshot.to_dict())

    def _handle_get_task(self, body: dict) -> None:
        task_id = body.get("task_id")
        if not task_id:
            self._json_response(400, {"error": "task_id required"})
            return
        task = _task_queue.get(task_id)
        if task:
            self._json_response(200, task)
        else:
            self._json_response(404, {"error": "task not found"})

    def _handle_run_browser_warfare(self, body: dict) -> None:
        """Queue a browser warfare scenario against a target URL."""
        project_id = body.get("project_id", "unknown")
        scenario = body.get("scenario", "memory_bomb")
        url = body.get("url", "http://localhost:8000")
        ws_url = body.get("ws_url", "")
        task_id = _task_queue.enqueue(
            "browser-warfare",
            project_id,
            {"scenario": scenario, "url": url, "ws_url": ws_url},
        )
        self._json_response(202, {
            "status": "queued",
            "task": "browser-warfare",
            "task_id": task_id,
            "project": project_id,
            "scenario": scenario,
            "url": url,
        })

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _json_response(self, status: int, data: Any) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode("utf-8"))

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight."""
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        """Suppress default logging."""
        pass


def _start_websocket_subsystem() -> WarRoomWebSocketServer:
    """Boot the entire WebSocket realtime subsystem."""
    # 1. Register broadcaster with EventBus — all bus.emit() now reaches WS clients
    broadcaster = EventBroadcaster.get_instance()
    broadcaster.start()

    # 2. Start specialized event stream handlers
    try:
        EventStream().start()
    except Exception as e:
        logging.warning(f"[WS] EventStream failed to start: {e}")
    try:
        IncidentStream().start()
    except Exception as e:
        logging.warning(f"[WS] IncidentStream failed to start: {e}")
    try:
        TelemetryStream().start()
    except Exception as e:
        logging.warning(f"[WS] TelemetryStream failed to start: {e}")

    # 3. Start the WebSocket server (runs in background thread)
    ws_server = WarRoomWebSocketServer(host="0.0.0.0", port=7702)
    ws_server.start()
    return ws_server


def start_server(host: str = "0.0.0.0", port: int = 7700) -> None:
    """Start the Control Center API server with full WebSocket realtime subsystem."""
    # Boot WebSocket / EventBus pipeline first
    ws_server = _start_websocket_subsystem()
    print(f"[Tester-QA] WebSocket server running on ws://{host}:7702")
    print(f"[Tester-QA]   /ws/warroom  — all events")
    print(f"[Tester-QA]   /ws/telemetry — metrics only")
    print(f"[Tester-QA]   /ws/incidents — incident events")
    print(f"[Tester-QA]   /ws/chaos    — chaos events")

    # HTTP API server
    server = HTTPServer((host, port), ControlCenterHandler)
    print(f"[Tester-QA] Control Center API running on http://{host}:{port}")
    print(f"[Tester-QA]   War Room: http://localhost:{port}/api/warroom")
    print(f"[Tester-QA]   Events:   http://localhost:{port}/api/events")
    print(f"[Tester-QA]   Health:   http://localhost:{port}/api/health")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Tester-QA] Shutting down...")
        ws_server.stop()
        EventBroadcaster.get_instance().stop()
        print("[Tester-QA] Server stopped.")
        server.shutdown()


if __name__ == "__main__":
    start_server()
