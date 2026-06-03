from __future__ import annotations

from pathlib import Path

from tester_qa.evidence import EvidenceEngine


class ScreenshotService:
    def __init__(self, evidence_engine: EvidenceEngine | None = None) -> None:
        self.evidence_engine = evidence_engine or EvidenceEngine()

    def capture_placeholder(self, output: Path | None = None) -> Path:
        record = self.evidence_engine.capture_screenshot_placeholder()
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(record.path.read_text(encoding="utf-8"), encoding="utf-8")
            return output
        return record.path
