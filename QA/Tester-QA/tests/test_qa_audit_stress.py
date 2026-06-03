import http.server
import tempfile
import threading
import unittest
from pathlib import Path
from socketserver import TCPServer

from tester_qa.audit import ProjectAudit, audit_runtime, audit_security
from tester_qa.metrics import stability_score
from tester_qa.models import RuntimeSnapshot, Severity
from tester_qa.stress import HttpStressTester, ProviderFailureSimulator, RuntimeStressModel, WebsocketStressTester
from tester_qa.validators import detect_state_mismatch


class QAAuditStressTests(unittest.TestCase):
    def test_project_audit_flags_missing_test_command(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "pyproject.toml").write_text("[project]\nname='demo'\n", encoding="utf-8")
            report = ProjectAudit().run(root)

            self.assertEqual(report.risk_level, Severity.HIGH)
            self.assertTrue(any("test" in finding.title.lower() for finding in report.findings))

    def test_security_audit_flags_raw_env(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / ".env").write_text("API_KEY=secret", encoding="utf-8")
            findings = audit_security(root)

            self.assertTrue(any(finding.severity == Severity.HIGH for finding in findings))

    def test_runtime_audit_detects_retry_storm(self) -> None:
        findings = audit_runtime(
            RuntimeSnapshot(cpu_percent=1, memory_percent=1, disk_percent=1, process_count=1, retry_storms=2)
        )

        self.assertTrue(any(finding.severity == Severity.CRITICAL for finding in findings))

    def test_http_stress_success_against_local_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text("ok", encoding="utf-8")
            with _serve(root) as url:
                result = HttpStressTester().run(url, requests=4, concurrency=2)

            self.assertEqual(result.total, 4)
            self.assertEqual(result.failed, 0)
            self.assertGreaterEqual(result.success, 1)

    def test_websocket_stress_rejects_bad_url(self) -> None:
        result = WebsocketStressTester().simulate_reconnect_storm("http://localhost:3000")

        self.assertGreater(result.failed, 0)
        self.assertIn("Invalid websocket URL", result.errors[0])

    def test_provider_simulation_models_failure(self) -> None:
        result = ProviderFailureSimulator().simulate("openai", "rate_limit", attempts=3)

        self.assertEqual(result.failed, 3)
        self.assertEqual(result.errors, ["rate_limit", "rate_limit", "rate_limit"])

    def test_runtime_stress_queue_overflow(self) -> None:
        result = RuntimeStressModel().simulate_queue_overflow("queue", 250)

        self.assertGreater(result.failed, 0)

    def test_state_consistency_validator(self) -> None:
        mismatches = detect_state_mismatch({"status": "ready"}, {"status": "loading"})

        self.assertEqual(len(mismatches), 1)

    def test_stability_score_penalizes_failures(self) -> None:
        self.assertLess(stability_score(10, 5, 100), stability_score(10, 0, 100))


class _serve:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.httpd: TCPServer | None = None
        self.thread: threading.Thread | None = None

    def __enter__(self) -> str:
        handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(*args, directory=str(self.root), **kwargs)
        self.httpd = TCPServer(("127.0.0.1", 0), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return f"http://127.0.0.1:{self.httpd.server_address[1]}/"

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        if self.thread:
            self.thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
