import json
import tempfile
import unittest
from pathlib import Path

from tester_qa.evidence import EvidenceEngine
from tester_qa.incidents import IncidentRegistry, classify_severity
from tester_qa.models import EvidenceType, IncidentState, Severity
from tester_qa.runtime_monitor import RuntimeMonitor


class EvidenceIncidentMonitorTests(unittest.TestCase):
    def test_evidence_engine_creates_required_structure_and_records(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            engine = EvidenceEngine(Path(tmp) / "evidence")
            record = engine.capture_text(EvidenceType.LOG, "stack trace", incident_id="INC-2026-000001")

            self.assertTrue(record.path.exists())
            self.assertIn("INC-2026-000001", record.evidence_id)
            self.assertIn("logs", str(record.path))
            self.assertIn(record.evidence_id, engine.markdown_attachment(record))

    def test_incident_registry_generates_ids_and_transitions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry = IncidentRegistry(Path(tmp) / "incidents")
            incident = registry.create("Provider outage", "Provider latency exceeded SLO.", Severity.HIGH)
            updated = registry.transition(incident.incident_id, IncidentState.INVESTIGATING, "Assigned to runtime team.")

            self.assertEqual(incident.incident_id, "INC-2026-000001")
            self.assertEqual(updated.state, IncidentState.INVESTIGATING)
            self.assertEqual(len(registry.list()), 1)

    def test_malformed_incident_id_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry = IncidentRegistry(Path(tmp) / "incidents")
            with self.assertRaises(ValueError):
                registry.get("bad-id")

    def test_runtime_monitor_detects_and_generates_incidents(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            registry = IncidentRegistry(Path(tmp) / "incidents")
            monitor = RuntimeMonitor(registry)
            snapshot = monitor.snapshot(queue_depth=150, retry_storms=2, failed_executions=3)
            anomalies = monitor.detect_anomalies(snapshot)
            incident_ids = monitor.generate_incidents(anomalies)

            self.assertGreaterEqual(len(anomalies), 3)
            self.assertEqual(len(incident_ids), len(anomalies))
            saved = json.loads((Path(tmp) / "incidents" / f"{incident_ids[0]}.json").read_text())
            self.assertEqual(saved["incident_id"], incident_ids[0])

    def test_severity_classifier_handles_failure_modes(self) -> None:
        self.assertEqual(classify_severity(retry_storms=5), Severity.CRITICAL)
        self.assertEqual(classify_severity(timed_out=True), Severity.HIGH)
        self.assertEqual(classify_severity(failed_executions=1), Severity.MEDIUM)
        self.assertEqual(classify_severity(), Severity.OBSERVATIONAL)


if __name__ == "__main__":
    unittest.main()
