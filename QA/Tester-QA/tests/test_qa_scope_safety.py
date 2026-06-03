import json
import tempfile
import unittest
from pathlib import Path

from tester_qa.browser.playwright_runner import PlaywrightRunner
from tester_qa.local_control import AuditLog, PermissionGate, PermissionMode, ProcessInspector, SafeShell
from tester_qa.memory import MemoryStore
from tester_qa.projects import ProjectAnalyzer, ProjectHealthcheck
from tester_qa.projects.project_report import generate_project_report
from tester_qa.server import route_manifest


class QAAuditScopeTests(unittest.TestCase):
    def test_project_scanner_detects_node_react_playwright(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "package.json").write_text(
                json.dumps(
                    {
                        "scripts": {"dev": "vite", "test": "vitest"},
                        "dependencies": {"@vitejs/plugin-react": "latest"},
                        "devDependencies": {"playwright": "latest"},
                    }
                ),
                encoding="utf-8",
            )
            (root / "vite.config.ts").write_text("export default {}", encoding="utf-8")
            (root / "README.md").write_text("# App", encoding="utf-8")
            (root / ".env.example").write_text("PORT=3000", encoding="utf-8")

            record = ProjectAnalyzer().analyze(root)
            health = ProjectHealthcheck().run(root)

            self.assertEqual(record.type, "node")
            self.assertIn("npm run dev", record.dev_commands)
            self.assertTrue(health["can_run"])
            self.assertTrue(health["can_test"])

    def test_memory_write_read_search(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = MemoryStore(Path(tmp) / "memory.jsonl")
            store.write("operational", "agent-coding", "websocket desync requires replay evidence", confidence=0.92)

            results = store.search("websocket")

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].type, "operational")
            self.assertEqual(results[0].confidence, 0.92)

    def test_audit_log_records_action(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            audit = AuditLog(Path(tmp) / "audit.jsonl")
            audit.record("tester", "/tmp/project", "inspect", "read_only", "success", ["evd"])

            records = audit.list()

            self.assertEqual(len(records), 1)
            self.assertEqual(records[0].evidence, ["evd"])

    def test_permission_gate_blocks_dangerous_command_by_default(self) -> None:
        decision = PermissionGate().evaluate_command("rm -rf /tmp/example", PermissionMode.DRY_RUN)

        self.assertFalse(decision.allowed)
        self.assertTrue(decision.approval_required)
        self.assertIn("Blocked dangerous command", decision.reason)

    def test_safe_shell_dry_run_does_not_execute(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "should_not_exist"
            result = SafeShell(AuditLog(Path(tmp) / "audit.jsonl")).run(f"touch {target}", mode=PermissionMode.DRY_RUN)

            self.assertTrue(result.success)
            self.assertFalse(target.exists())
            self.assertIn("DRY RUN", result.stdout)

    def test_safe_shell_blocks_dangerous_command_even_in_dry_run(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = SafeShell(AuditLog(Path(tmp) / "audit.jsonl")).run("rm -rf /tmp/example", mode=PermissionMode.DRY_RUN)

            self.assertFalse(result.success)
            self.assertIn("ACTION REQUIRES APPROVAL", result.stderr)

    def test_browser_inspection_generates_report_and_evidence_on_failure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = PlaywrightRunner(root / "evidence", root / "reports", timeout_seconds=1).inspect("http://127.0.0.1:9")

            self.assertFalse(result.success)
            self.assertTrue(Path(result.report_path).exists())
            self.assertTrue(result.screenshot_paths)
            self.assertTrue((root / "evidence" / "network").exists())
            self.assertTrue((root / "evidence" / "console").exists())

    def test_project_report_generation(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "pyproject.toml").write_text("[project]\nname='demo'\n", encoding="utf-8")
            report = generate_project_report(root)

            self.assertIn("# Project Report", report)
            self.assertIn("# Decision Required", report)

    def test_process_surfaces_are_structured(self) -> None:
        inspector = ProcessInspector()
        self.assertIsInstance(inspector.list_processes(), list)
        self.assertIsInstance(inspector.occupied_ports(), list)

    def test_server_route_manifest_is_dashboard_ready(self) -> None:
        routes = route_manifest()
        paths = {route["path"] for route in routes}

        self.assertIn("/projects", paths)
        self.assertIn("/browser/inspect", paths)
        self.assertIn("/incident/create", paths)


if __name__ == "__main__":
    unittest.main()
