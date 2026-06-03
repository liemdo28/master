from __future__ import annotations

import json
import logging
import re
from dataclasses import replace
from datetime import datetime, timezone
from pathlib import Path

from tester_qa.models import EnterpriseIncident, IncidentState, IncidentTimelineEvent, RootCauseSchema, Severity


LOGGER = logging.getLogger(__name__)
INCIDENT_ID_PATTERN = re.compile(r"^INC-(\d{4})-(\d{6})$")


class IncidentRegistry:
    def __init__(self, root: Path | str = "evidence/incidents") -> None:
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def create(
        self,
        title: str,
        summary: str,
        severity: Severity = Severity.MEDIUM,
        root_cause: RootCauseSchema | None = None,
        evidence_ids: list[str] | None = None,
    ) -> EnterpriseIncident:
        now = datetime.now(timezone.utc)
        incident = EnterpriseIncident(
            incident_id=self.next_id(now.year),
            title=title,
            severity=severity,
            state=IncidentState.DETECTED,
            summary=summary,
            root_cause=root_cause or default_root_cause(),
            evidence_ids=evidence_ids or [],
            timeline=[IncidentTimelineEvent(IncidentState.DETECTED, "Incident detected and registered.", now)],
            created_at=now,
            updated_at=now,
        )
        self.save(incident)
        LOGGER.warning("created incident", extra={"incident_id": incident.incident_id, "severity": severity.value})
        return incident

    def save(self, incident: EnterpriseIncident) -> None:
        path = self._path(incident.incident_id)
        path.write_text(json.dumps(incident.to_dict(), indent=2, ensure_ascii=False, sort_keys=True), encoding="utf-8")

    def list(self) -> list[EnterpriseIncident]:
        return [self._load_file(path) for path in sorted(self.root.glob("INC-*.json"))]

    def get(self, incident_id: str) -> EnterpriseIncident:
        path = self._path(incident_id)
        if not path.exists():
            raise FileNotFoundError(f"Incident not found: {incident_id}")
        return self._load_file(path)

    def transition(self, incident_id: str, state: IncidentState, note: str) -> EnterpriseIncident:
        incident = self.get(incident_id)
        timeline = [*incident.timeline, IncidentTimelineEvent(state=state, note=note)]
        updated = replace(incident, state=state, timeline=timeline, updated_at=datetime.now(timezone.utc))
        self.save(updated)
        return updated

    def next_id(self, year: int | None = None) -> str:
        current_year = year or datetime.now(timezone.utc).year
        max_counter = 0
        for incident in self.root.glob(f"INC-{current_year}-*.json"):
            match = INCIDENT_ID_PATTERN.match(incident.stem)
            if match:
                max_counter = max(max_counter, int(match.group(2)))
        return f"INC-{current_year}-{max_counter + 1:06d}"

    def _path(self, incident_id: str) -> Path:
        if not INCIDENT_ID_PATTERN.match(incident_id):
            raise ValueError(f"invalid incident id: {incident_id}")
        return self.root / f"{incident_id}.json"

    def _load_file(self, path: Path) -> EnterpriseIncident:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return incident_from_dict(payload)


def classify_severity(
    *,
    failed_executions: int = 0,
    timed_out: bool = False,
    provider_latency_ms: int = 0,
    retry_storms: int = 0,
    user_blocking: bool = False,
) -> Severity:
    if user_blocking or retry_storms >= 5 or failed_executions >= 10:
        return Severity.CRITICAL
    if timed_out or provider_latency_ms >= 5000 or failed_executions >= 3:
        return Severity.HIGH
    if provider_latency_ms >= 2000 or failed_executions > 0:
        return Severity.MEDIUM
    return Severity.OBSERVATIONAL


def default_root_cause() -> RootCauseSchema:
    return RootCauseSchema(
        trigger="Unknown trigger pending evidence review.",
        blast_radius="Unknown until module ownership and runtime traces are mapped.",
        affected_modules=[],
        reproduction=[],
        mitigation=[],
        prevention=[],
        long_term_refactor=[],
    )


def incident_from_dict(payload: dict) -> EnterpriseIncident:
    root = payload["root_cause"]
    timeline = [
        IncidentTimelineEvent(
            state=IncidentState(item["state"]),
            note=item["note"],
            created_at=datetime.fromisoformat(item["created_at"]),
        )
        for item in payload.get("timeline", [])
    ]
    return EnterpriseIncident(
        incident_id=payload["incident_id"],
        title=payload["title"],
        severity=Severity(payload["severity"]),
        state=IncidentState(payload["state"]),
        summary=payload["summary"],
        root_cause=RootCauseSchema(
            trigger=root["trigger"],
            blast_radius=root["blast_radius"],
            affected_modules=list(root["affected_modules"]),
            reproduction=list(root["reproduction"]),
            mitigation=list(root["mitigation"]),
            prevention=list(root["prevention"]),
            long_term_refactor=list(root["long_term_refactor"]),
        ),
        evidence_ids=list(payload.get("evidence_ids", [])),
        timeline=timeline,
        created_at=datetime.fromisoformat(payload["created_at"]),
        updated_at=datetime.fromisoformat(payload["updated_at"]),
    )
