from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


@dataclass(frozen=True)
class AuditRecord:
    action_id: str
    timestamp: str
    operator: str
    target: str
    action: str
    mode: str
    result: str
    evidence: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "action_id": self.action_id,
            "timestamp": self.timestamp,
            "operator": self.operator,
            "target": self.target,
            "action": self.action,
            "mode": self.mode,
            "result": self.result,
            "evidence": self.evidence,
        }


class AuditLog:
    def __init__(self, path: Path | str = "audit/audit_log.jsonl") -> None:
        self.path = Path(path)

    def record(
        self,
        operator: str,
        target: str,
        action: str,
        mode: str,
        result: str,
        evidence: list[str] | None = None,
    ) -> AuditRecord:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        record = AuditRecord(
            action_id=f"ACT-{uuid4().hex[:12]}",
            timestamp=datetime.now(timezone.utc).isoformat(),
            operator=operator,
            target=target,
            action=action,
            mode=mode,
            result=result,
            evidence=evidence or [],
        )
        with self.path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(record.to_dict(), ensure_ascii=False) + "\n")
        return record

    def list(self) -> list[AuditRecord]:
        if not self.path.exists():
            return []
        records = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            payload = json.loads(line)
            records.append(AuditRecord(**payload))
        return records
