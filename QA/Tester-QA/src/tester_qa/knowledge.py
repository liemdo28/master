from __future__ import annotations

import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path

from tester_qa.models import KnowledgeEntry


class KnowledgeStore:
    def __init__(self, path: Path) -> None:
        self.path = path

    def append(self, entry: KnowledgeEntry) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = asdict(entry)
        payload["created_at"] = entry.created_at.isoformat()
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(payload, ensure_ascii=False) + "\n")

    def list_entries(self) -> list[KnowledgeEntry]:
        if not self.path.exists():
            return []

        entries: list[KnowledgeEntry] = []
        with self.path.open("r", encoding="utf-8") as handle:
            for line in handle:
                if not line.strip():
                    continue
                payload = json.loads(line)
                entries.append(
                    KnowledgeEntry(
                        title=payload["title"],
                        body=payload["body"],
                        tags=list(payload.get("tags", [])),
                        created_at=datetime.fromisoformat(payload["created_at"]),
                    )
                )
        return entries
