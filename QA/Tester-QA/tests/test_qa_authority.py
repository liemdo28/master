import unittest
from pathlib import Path

from tester_qa.knowledge import KnowledgeStore
from tester_qa.models import KnowledgeEntry, Severity
from tester_qa.qa_authority import QAAuditAuthority


class QAAuditAuthorityTests(unittest.TestCase):
    def test_incident_report_has_enterprise_sections(self) -> None:
        authority = QAAuditAuthority()
        report = authority.create_incident_report("Queue overload", Severity.HIGH)
        rendered = authority.render_incident(report)

        self.assertIn("## Root Cause", rendered)
        self.assertIn("## Systemic Impact", rendered)
        self.assertIn("## Long-Term Refactor", rendered)
        self.assertIn("HIGH", rendered)

    def test_test_plan_covers_operational_failure_modes(self) -> None:
        authority = QAAuditAuthority()
        plan = authority.create_test_plan("agent-coding")
        categories = {case.category.value for case in plan.cases}

        self.assertIn("concurrency", categories)
        self.assertIn("provider", categories)
        self.assertIn("websocket", categories)
        self.assertIn("visual", categories)

    def test_knowledge_store_round_trip(self) -> None:
        from tempfile import TemporaryDirectory

        with TemporaryDirectory() as tmp_dir:
            store = KnowledgeStore(Path(tmp_dir) / "memory.jsonl")
            store.append(KnowledgeEntry(title="Finding", body="Root cause captured.", tags=["incident"]))

            entries = store.list_entries()

        self.assertEqual(len(entries), 1)
        self.assertEqual(entries[0].title, "Finding")
        self.assertEqual(entries[0].tags, ["incident"])


if __name__ == "__main__":
    unittest.main()
