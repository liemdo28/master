from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass(frozen=True)
class RuntimeEvent:
    type: str
    payload: dict
    created_at: str = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> dict:
        return self.__dict__.copy()
