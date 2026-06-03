from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from tester_qa.models import Severity


@dataclass(frozen=True)
class ProjectRecord:
    name: str
    path: str
    type: str
    status: str = "active"
    entrypoints: list[str] = field(default_factory=list)
    test_commands: list[str] = field(default_factory=list)
    dev_commands: list[str] = field(default_factory=list)
    risk_level: str = Severity.MEDIUM.value

    def to_dict(self) -> dict:
        return self.__dict__.copy()


class ProjectRegistry:
    def __init__(self, path: Path | str = "knowledge/project_registry.json") -> None:
        self.path = Path(path)

    def save(self, records: list[ProjectRecord]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps([record.to_dict() for record in records], indent=2, ensure_ascii=False), encoding="utf-8")

    def load(self) -> list[ProjectRecord]:
        if not self.path.exists():
            return []
        return [ProjectRecord(**item) for item in json.loads(self.path.read_text(encoding="utf-8"))]
