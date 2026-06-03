"""Runtime context — shared state for the current execution session."""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class RuntimeContext:
    """Shared execution context passed through the pipeline."""
    project_id: str = ""
    project_path: str = ""
    base_url: str = ""
    session_id: str = ""
    started_at: float = 0.0
    auth_profile: str | None = None
    evidence_dir: Path = Path("evidence")
    report_dir: Path = Path("reports")
    metrics: dict[str, Any] = field(default_factory=dict)
    errors: list[str] = field(default_factory=list)
    evidence_paths: list[str] = field(default_factory=list)
    incidents_created: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        if not self.started_at:
            self.started_at = time.time()
        if not self.session_id:
            import uuid
            self.session_id = str(uuid.uuid4())[:8]

    @property
    def elapsed_ms(self) -> float:
        return (time.time() - self.started_at) * 1000

    def add_error(self, error: str) -> None:
        self.errors.append(error)

    def add_evidence(self, path: str) -> None:
        self.evidence_paths.append(path)

    def add_incident(self, incident_id: str) -> None:
        self.incidents_created.append(incident_id)

    def update_metrics(self, **kwargs: Any) -> None:
        self.metrics.update(kwargs)

    def to_dict(self) -> dict[str, Any]:
        return {
            "project_id": self.project_id,
            "project_path": self.project_path,
            "base_url": self.base_url,
            "session_id": self.session_id,
            "elapsed_ms": round(self.elapsed_ms, 1),
            "auth_profile": self.auth_profile,
            "metrics": self.metrics,
            "errors": self.errors,
            "evidence_count": len(self.evidence_paths),
            "incidents_count": len(self.incidents_created),
        }
