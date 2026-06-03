from __future__ import annotations

import json
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from tester_qa.models import EvidenceRecord, EvidenceType


LOGGER = logging.getLogger(__name__)


class EvidenceEngine:
    def __init__(self, root: Path | str = "evidence") -> None:
        self.root = Path(root)
        self.directories = {
            EvidenceType.SCREENSHOT: self.root / "screenshots",
            EvidenceType.LOG: self.root / "logs",
            EvidenceType.TRACE: self.root / "traces",
            EvidenceType.METRIC: self.root / "metrics",
            EvidenceType.RUNTIME_STATE: self.root / "metrics",
            EvidenceType.INCIDENT: self.root / "incidents",
        }
        self._ensure_structure()

    def capture_text(
        self,
        evidence_type: EvidenceType,
        content: str,
        incident_id: str | None = None,
        description: str = "",
        extension: str = "txt",
    ) -> EvidenceRecord:
        evidence_id = self._new_id(evidence_type, incident_id)
        path = self.directories[evidence_type] / f"{evidence_id}.{extension}"
        path.write_text(content, encoding="utf-8")
        return self._record(evidence_id, evidence_type, path, incident_id, description)

    def capture_json(
        self,
        evidence_type: EvidenceType,
        payload: dict,
        incident_id: str | None = None,
        description: str = "",
    ) -> EvidenceRecord:
        return self.capture_text(
            evidence_type=evidence_type,
            content=json.dumps(payload, indent=2, ensure_ascii=False, sort_keys=True),
            incident_id=incident_id,
            description=description,
            extension="json",
        )

    def capture_file(
        self,
        source: Path | str,
        evidence_type: EvidenceType,
        incident_id: str | None = None,
        description: str = "",
    ) -> EvidenceRecord:
        source_path = Path(source)
        if not source_path.exists():
            raise FileNotFoundError(source_path)
        evidence_id = self._new_id(evidence_type, incident_id)
        destination = self.directories[evidence_type] / f"{evidence_id}{source_path.suffix}"
        shutil.copy2(source_path, destination)
        return self._record(evidence_id, evidence_type, destination, incident_id, description)

    def capture_screenshot_placeholder(
        self,
        incident_id: str | None = None,
        description: str = "Screenshot placeholder captured without browser backend.",
    ) -> EvidenceRecord:
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540">'
            '<rect width="100%" height="100%" fill="#111827"/>'
            '<text x="48" y="96" fill="#f9fafb" font-family="Arial" font-size="32">'
            "Tester-QA screenshot placeholder</text></svg>"
        )
        return self.capture_text(
            EvidenceType.SCREENSHOT,
            svg,
            incident_id=incident_id,
            description=description,
            extension="svg",
        )

    def markdown_attachment(self, record: EvidenceRecord) -> str:
        return f"- {record.evidence_type.value}: [{record.evidence_id}]({record.path})"

    def _ensure_structure(self) -> None:
        for directory in set(self.directories.values()):
            directory.mkdir(parents=True, exist_ok=True)

    def _new_id(self, evidence_type: EvidenceType, incident_id: str | None) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        prefix = incident_id or "GLOBAL"
        return f"EVD-{prefix}-{evidence_type.value}-{timestamp}-{uuid4().hex[:8]}"

    def _record(
        self,
        evidence_id: str,
        evidence_type: EvidenceType,
        path: Path,
        incident_id: str | None,
        description: str,
    ) -> EvidenceRecord:
        record = EvidenceRecord(
            evidence_id=evidence_id,
            incident_id=incident_id,
            evidence_type=evidence_type,
            path=path,
            created_at=datetime.now(timezone.utc),
            description=description,
        )
        LOGGER.info("captured evidence", extra=record.to_dict())
        return record
