from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any


class Severity(str, Enum):
    OBSERVATIONAL = "observational"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class TestCategory(str, Enum):
    FUNCTIONAL = "functional"
    STRESS = "stress"
    CONCURRENCY = "concurrency"
    CHAOS = "chaos"
    MEMORY = "memory"
    WEBSOCKET = "websocket"
    QUEUE = "queue"
    PROVIDER = "provider"
    SESSION = "session"
    VISUAL = "visual"


@dataclass(frozen=True)
class Evidence:
    source: str
    detail: str
    metric: str | None = None
    evidence_id: str | None = None
    path: str | None = None


class EvidenceType(str, Enum):
    LOG = "log"
    TRACE = "trace"
    SCREENSHOT = "screenshot"
    METRIC = "metric"
    RUNTIME_STATE = "runtime_state"
    INCIDENT = "incident"


class IncidentState(str, Enum):
    DETECTED = "Detected"
    OBSERVED = "Observed"
    ESCALATED = "Escalated"
    INVESTIGATING = "Investigating"
    MITIGATED = "Mitigated"
    RESOLVED = "Resolved"
    VALIDATED = "Validated"
    CLOSED = "Closed"


@dataclass(frozen=True)
class CommandResult:
    success: bool
    exit_code: int
    duration_ms: int
    stdout: str
    stderr: str
    command: str
    timed_out: bool = False
    attempts: int = 1

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "exit_code": self.exit_code,
            "duration_ms": self.duration_ms,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "command": self.command,
            "timed_out": self.timed_out,
            "attempts": self.attempts,
        }


@dataclass(frozen=True)
class EvidenceRecord:
    evidence_id: str
    incident_id: str | None
    evidence_type: EvidenceType
    path: Path
    created_at: datetime
    description: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)

    def markdown_link(self) -> str:
        return f"[{self.evidence_id}]({self.path})"

    def to_dict(self) -> dict[str, Any]:
        return {
            "evidence_id": self.evidence_id,
            "incident_id": self.incident_id,
            "evidence_type": self.evidence_type.value,
            "path": str(self.path),
            "created_at": self.created_at.isoformat(),
            "description": self.description,
            "metadata": self.metadata,
        }


@dataclass(frozen=True)
class Recommendation:
    action: str
    owner: str = "Engineering"
    priority: Severity = Severity.MEDIUM


@dataclass(frozen=True)
class IncidentReport:
    title: str
    severity: Severity
    summary: str
    evidence: list[Evidence] = field(default_factory=list)
    root_cause: str = "Unknown pending investigation."
    systemic_impact: str = "Pending blast-radius assessment."
    reproduction: list[str] = field(default_factory=list)
    fix_strategy: list[str] = field(default_factory=list)
    validation: list[str] = field(default_factory=list)
    prevention: list[str] = field(default_factory=list)
    long_term_refactor: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class RootCauseSchema:
    trigger: str
    blast_radius: str
    affected_modules: list[str]
    reproduction: list[str]
    mitigation: list[str]
    prevention: list[str]
    long_term_refactor: list[str]

    def to_dict(self) -> dict[str, Any]:
        return {
            "trigger": self.trigger,
            "blast_radius": self.blast_radius,
            "affected_modules": self.affected_modules,
            "reproduction": self.reproduction,
            "mitigation": self.mitigation,
            "prevention": self.prevention,
            "long_term_refactor": self.long_term_refactor,
        }


@dataclass(frozen=True)
class IncidentTimelineEvent:
    state: IncidentState
    note: str
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "state": self.state.value,
            "note": self.note,
            "created_at": self.created_at.isoformat(),
        }


@dataclass(frozen=True)
class EnterpriseIncident:
    incident_id: str
    title: str
    severity: Severity
    state: IncidentState
    summary: str
    root_cause: RootCauseSchema
    evidence_ids: list[str] = field(default_factory=list)
    timeline: list[IncidentTimelineEvent] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "title": self.title,
            "severity": self.severity.value,
            "state": self.state.value,
            "summary": self.summary,
            "root_cause": self.root_cause.to_dict(),
            "evidence_ids": self.evidence_ids,
            "timeline": [event.to_dict() for event in self.timeline],
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass(frozen=True)
class TestCase:
    name: str
    category: TestCategory
    objective: str
    signal: str
    expected: str


@dataclass(frozen=True)
class TestPlan:
    system: str
    scope: str
    cases: list[TestCase]
    bottlenecks: list[str] = field(default_factory=list)
    recommendations: list[Recommendation] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class KnowledgeEntry:
    title: str
    body: str
    tags: list[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class RuntimeSnapshot:
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    process_count: int
    websocket_count: int = 0
    queue_depth: int = 0
    provider_latency_ms: int = 0
    retry_storms: int = 0
    stuck_workers: int = 0
    failed_executions: int = 0
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict[str, Any]:
        return {
            "cpu_percent": self.cpu_percent,
            "memory_percent": self.memory_percent,
            "disk_percent": self.disk_percent,
            "process_count": self.process_count,
            "websocket_count": self.websocket_count,
            "queue_depth": self.queue_depth,
            "provider_latency_ms": self.provider_latency_ms,
            "retry_storms": self.retry_storms,
            "stuck_workers": self.stuck_workers,
            "failed_executions": self.failed_executions,
            "created_at": self.created_at.isoformat(),
        }


@dataclass(frozen=True)
class RuntimeAnomaly:
    name: str
    severity: Severity
    detail: str
    metric: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "severity": self.severity.value,
            "detail": self.detail,
            "metric": self.metric,
        }
