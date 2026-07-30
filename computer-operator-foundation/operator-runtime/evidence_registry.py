"""
Evidence Registry — stores and indexes all operator evidence artifacts.
"""
import json
import time
import uuid
from pathlib import Path
from typing import Optional

EVIDENCE_DIR = Path(__file__).parent / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

EVIDENCE_TYPES = {
    "screenshot",
    "execution_log",
    "html_snapshot",
    "download_file",
    "telemetry_json",
    "crawl_summary",
}

# In-memory evidence store
_evidence: list[dict] = []


def register_evidence(
    evidence_type: str,
    source_run_id: str,
    source_task_id: str,
    file_path: Optional[str] = None,
    content: Optional[dict] = None,
    description: str = "",
) -> dict:
    """Register a new evidence record."""
    if evidence_type not in EVIDENCE_TYPES:
        raise ValueError(f"Unknown evidence type: {evidence_type}. Must be one of: {EVIDENCE_TYPES}")

    ev_id = f"ev-{uuid.uuid4().hex[:10]}"
    record = {
        "evidence_id": ev_id,
        "type": evidence_type,
        "run_id": source_run_id,
        "task_id": source_task_id,
        "file_path": file_path,
        "content": content,
        "description": description,
        "registered_at": time.time(),
        "registered_iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    _evidence.append(record)

    # Persist the evidence record
    ev_file = EVIDENCE_DIR / f"{ev_id}.json"
    ev_file.write_text(json.dumps(record, indent=2, default=str), encoding="utf-8")

    return record


def get_evidence(ev_id: str) -> Optional[dict]:
    for e in _evidence:
        if e["evidence_id"] == ev_id:
            return e
    return None


def get_evidence_by_run(run_id: str) -> list[dict]:
    return [e for e in _evidence if e["run_id"] == run_id]


def get_evidence_by_task(task_id: str) -> list[dict]:
    return [e for e in _evidence if e["task_id"] == task_id]


def get_all_evidence() -> list[dict]:
    return list(_evidence)


def get_evidence_summary() -> dict:
    """Get summary stats of all evidence."""
    by_type = {}
    for e in _evidence:
        t = e["type"]
        by_type[t] = by_type.get(t, 0) + 1
    return {
        "total": len(_evidence),
        "by_type": by_type,
        "latest": _evidence[-1] if _evidence else None,
    }
