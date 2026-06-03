from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


@dataclass(frozen=True)
class MemoryRecord:
    memory_id: str
    type: str
    project: str
    summary: str
    evidence: list[str] = field(default_factory=list)
    confidence: float = 0.8
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class MemoryStore:
    def __init__(self, path: Path | str = "knowledge/memory_v2.jsonl") -> None:
        self.path = Path(path)

    def write(self, memory_type: str, project: str, summary: str, evidence: list[str] | None = None, confidence: float = 0.8) -> MemoryRecord:
        if not 0 <= confidence <= 1:
            raise ValueError("confidence must be between 0 and 1")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        record = MemoryRecord(
            memory_id=f"MEM-{uuid4().hex[:12]}",
            type=memory_type,
            project=project,
            summary=summary,
            evidence=evidence or [],
            confidence=confidence,
        )
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record.to_dict(), ensure_ascii=False) + "\n")
        return record

    def read_all(self) -> list[MemoryRecord]:
        if not self.path.exists():
            return []
        records = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                records.append(MemoryRecord(**json.loads(line)))
        return records

    def search(self, query: str) -> list[MemoryRecord]:
        lowered = query.lower()
        return [record for record in self.read_all() if lowered in record.summary.lower() or lowered in record.project.lower()]
