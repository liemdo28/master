import http.server
import socketserver
import tempfile
import threading
import unittest
from pathlib import Path

from tester_qa.browser_ops import BrowserOps
from tester_qa.evidence import EvidenceEngine
from tester_qa.incidents import IncidentRegistry


class BrowserOpsTests(unittest.TestCase):
    def test_browser_dashboard_success_against_local_server(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text("<html><body>ready</body></html>", encoding="utf-8")
            with _serve_directory(root) as url:
                result = BrowserOps(EvidenceEngine(root / "evidence"), IncidentRegistry(root / "incidents")).validate_dashboard(url)

            self.assertTrue(result.success)
            self.assertEqual(result.status_code, 200)
            self.assertIsNotNone(result.screenshot_path)

    def test_browser_failure_creates_incident_and_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = BrowserOps(EvidenceEngine(root / "evidence"), IncidentRegistry(root / "incidents"), timeout_seconds=1).validate_dashboard(
                "http://127.0.0.1:9"
            )

            self.assertFalse(result.success)
            self.assertIsNotNone(result.incident_id)
            self.assertTrue((root / "incidents" / f"{result.incident_id}.json").exists())

    def test_websocket_contract_validation_rejects_malformed_url(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            result = BrowserOps(EvidenceEngine(root / "evidence"), IncidentRegistry(root / "incidents")).validate_websocket_contract(
                "http://localhost:3000"
            )

            self.assertFalse(result.success)
            self.assertIsNotNone(result.incident_id)


class _serve_directory:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.httpd: socketserver.TCPServer | None = None
        self.thread: threading.Thread | None = None

    def __enter__(self) -> str:
        handler = lambda *args, **kwargs: http.server.SimpleHTTPRequestHandler(*args, directory=str(self.root), **kwargs)
        self.httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
        port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
        self.thread.start()
        return f"http://127.0.0.1:{port}/"

    def __exit__(self, exc_type, exc, tb) -> None:
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        if self.thread:
            self.thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
