"""OSS Registry — the 'HR system' for open source projects.

Each candidate gets a project_id, status, owner_division, and lifecycle
stage. Mi cannot use a project that is not registered here.

CTO Rule: No fabrication of project stats — github field is the only
accepted source of truth; everything else is Mi-evaluated.
"""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ---------------------------------------------------------------------------
# Registry file (persistent JSON)
# ---------------------------------------------------------------------------

REGISTRY_DIR = Path(__file__).resolve().parent
REGISTRY_FILE = REGISTRY_DIR / "oss_registry.json"
EVIDENCE_DIR = REGISTRY_DIR / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Allowed values (enforced by register_project)
# ---------------------------------------------------------------------------

LIFECYCLE_STAGES = [
    "DISCOVERY",
    "AUDIT",
    "ROI",
    "ARCHITECTURE_REVIEW",
    "PILOT",
    "PRODUCTION",
    "MAINTENANCE",
    "RETIRED",
]

DIVISIONS = [
    "Engineering",
    "Operator",
    "Finance",
    "Marketing",
    "IT",
    "Creative",
    "Unknown",
]

CATEGORIES = [
    "Engineering",
    "Operator",
    "Finance",
    "Marketing",
    "IT",
    "Creative",
]

LICENSE_RISKS = {
    "MIT": "LOW",
    "Apache-2.0": "LOW",
    "BSD-2-Clause": "LOW",
    "BSD-3-Clause": "LOW",
    "ISC": "LOW",
    "GPL-2.0": "MEDIUM",
    "GPL-3.0": "MEDIUM",
    "AGPL-3.0": "HIGH",
    "LGPL-2.1": "MEDIUM",
    "LGPL-3.0": "MEDIUM",
    "MPL-2.0": "LOW",
    "Unlicense": "LOW",
    "CC0-1.0": "LOW",
    "BSL-1.0": "MEDIUM",
    "BUSL-1.1": "HIGH",
    "SSPL-1.0": "HIGH",
    "Proprietary": "HIGH",
    "UNKNOWN": "UNKNOWN",
}

# ---------------------------------------------------------------------------
# In-memory + file-backed store
# ---------------------------------------------------------------------------

_registry: list[dict] = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_id() -> str:
    return f"OSS-{uuid.uuid4().hex[:10]}"


def _save() -> None:
    REGISTRY_FILE.write_text(
        json.dumps(_registry, indent=2, default=str), encoding="utf-8"
    )


def load_registry() -> None:
    """Load registry from disk into memory."""
    global _registry
    if REGISTRY_FILE.exists():
        _registry = json.loads(REGISTRY_FILE.read_text(encoding="utf-8"))
    else:
        _registry = []


def save_registry() -> None:
    """Persist registry to disk."""
    _save()


# ---------------------------------------------------------------------------
# Query helpers
# ---------------------------------------------------------------------------

def get_project(project_id: str) -> Optional[dict]:
    for p in _registry:
        if p["project_id"] == project_id:
            return p
    return None


def get_project_by_name(name: str) -> Optional[dict]:
    """Lookup by exact project name (case-insensitive)."""
    lower = name.lower()
    for p in _registry:
        if p["name"].lower() == lower:
            return p
    return None


def get_project_by_github(github: str) -> Optional[dict]:
    """Lookup by GitHub URL or owner/repo shorthand."""
    norm = github.rstrip("/").lower()
    for p in _registry:
        if p.get("github", "").rstrip("/").lower() == norm:
            return p
    return None


def list_all() -> list[dict]:
    return list(_registry)


def list_by_division(division: str) -> list[dict]:
    return [p for p in _registry if p["owner_division"] == division]


def list_by_stage(stage: str) -> list[dict]:
    return [p for p in _registry if p["lifecycle_stage"] == stage]


def list_by_status(status: str) -> list[dict]:
    return [p for p in _registry if p["status"] == status]


def count_by_division() -> dict:
    counts: dict[str, int] = {}
    for p in _registry:
        d = p["owner_division"]
        counts[d] = counts.get(d, 0) + 1
    return counts


def count_by_stage() -> dict:
    counts: dict[str, int] = {}
    for p in _registry:
        s = p["lifecycle_stage"]
        counts[s] = counts.get(s, 0) + 1
    return counts


def count_by_status() -> dict:
    counts: dict[str, int] = {}
    for p in _registry:
        s = p["status"]
        counts[s] = counts.get(s, 0) + 1
    return counts


# ---------------------------------------------------------------------------
# Mutation helpers
# ---------------------------------------------------------------------------

def register_project(
    name: str,
    github: str,
    owner_division: str,
    category: str,
    description: str = "",
    license: str = "UNKNOWN",
    lifecycle_stage: str = "DISCOVERY",
    status: str = "ACTIVE",
) -> dict:
    """Register a new OSS project. Returns the created record.

    Raises ValueError on duplicates (name or github) or invalid enum values.
    """
    if owner_division not in DIVISIONS:
        raise ValueError(
            f"Invalid division '{owner_division}'. "
            f"Allowed: {DIVISIONS}"
        )
    if category not in CATEGORIES:
        raise ValueError(
            f"Invalid category '{category}'. Allowed: {CATEGORIES}"
        )
    if lifecycle_stage not in LIFECYCLE_STAGES:
        raise ValueError(
            f"Invalid lifecycle_stage '{lifecycle_stage}'. "
            f"Allowed: {LIFECYCLE_STAGES}"
        )

    # Dedupe
    existing_name = get_project_by_name(name)
    if existing_name:
        raise ValueError(f"Duplicate name: '{name}' already registered as {existing_name['project_id']}")
    existing_github = get_project_by_github(github)
    if existing_github:
        raise ValueError(f"Duplicate GitHub: '{github}' already registered as {existing_github['project_id']}")

    project_id = _gen_id()
    now_ts = time.time()
    project = {
        "project_id": project_id,
        "name": name,
        "github": github,
        "owner_division": owner_division,
        "category": category,
        "description": description,
        "license": license,
        "license_risk": LICENSE_RISKS.get(license, "UNKNOWN"),
        "lifecycle_stage": lifecycle_stage,
        "status": status,
        "roi": None,
        "maintenance_cost": None,
        "risk": None,
        "scorecard": None,
        "created_at": now_ts,
        "created_iso": _now_iso(),
        "updated_at": now_ts,
        "updated_iso": _now_iso(),
        "stage_history": [
            {"stage": lifecycle_stage, "timestamp": now_ts, "iso": _now_iso()}
        ],
    }
    _registry.append(project)
    _save()

    # Write evidence
    evidence_file = EVIDENCE_DIR / f"{project_id}_registered.json"
    evidence_file.write_text(json.dumps(project, indent=2, default=str), encoding="utf-8")

    return project


def update_lifecycle_stage(project_id: str, new_stage: str) -> dict:
    """Advance a project's lifecycle stage. Validates stage sequence."""
    if new_stage not in LIFECYCLE_STAGES:
        raise ValueError(f"Invalid stage '{new_stage}'. Allowed: {LIFECYCLE_STAGES}")

    project = get_project(project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    current = project["lifecycle_stage"]
    current_idx = LIFECYCLE_STAGES.index(current)
    new_idx = LIFECYCLE_STAGES.index(new_stage)

    # Allow forward movement and one-step-back (for pilot→architecture review)
    if new_idx > current_idx + 1:
        raise ValueError(
            f"Cannot jump from {current} to {new_stage}. "
            f"Max one step forward at a time."
        )

    now_ts = time.time()
    project["lifecycle_stage"] = new_stage
    project["updated_at"] = now_ts
    project["updated_iso"] = _now_iso()
    project["stage_history"].append(
        {"stage": new_stage, "timestamp": now_ts, "iso": _now_iso()}
    )
    _save()

    evidence_file = EVIDENCE_DIR / f"{project_id}_stage_change.json"
    evidence_file.write_text(json.dumps(project, indent=2, default=str), encoding="utf-8")

    return project


def retire_project(project_id: str, reason: str = "") -> dict:
    """Move a project to RETIRED stage and set status = INACTIVE."""
    project = get_project(project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    now_ts = time.time()
    project["lifecycle_stage"] = "RETIRED"
    project["status"] = "INACTIVE"
    project["retired_reason"] = reason
    project["retired_at"] = now_ts
    project["retired_iso"] = _now_iso()
    project["updated_at"] = now_ts
    project["updated_iso"] = _now_iso()
    project["stage_history"].append(
        {"stage": "RETIRED", "timestamp": now_ts, "iso": _now_iso()}
    )
    _save()

    evidence_file = EVIDENCE_DIR / f"{project_id}_retired.json"
    evidence_file.write_text(json.dumps(project, indent=2, default=str), encoding="utf-8")

    return project


def update_scorecard_ref(project_id: str, roi: dict, risk: dict,
                         maintenance_cost: dict) -> dict:
    """Link scorecard results to a registry entry."""
    project = get_project(project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    now_ts = time.time()
    project["roi"] = roi
    project["risk"] = risk
    project["maintenance_cost"] = maintenance_cost
    project["updated_at"] = now_ts
    project["updated_iso"] = _now_iso()
    _save()
    return project


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

def get_registry_summary() -> dict:
    """Executive summary of all registered projects."""
    return {
        "total": len(_registry),
        "by_division": count_by_division(),
        "by_stage": count_by_stage(),
        "by_status": count_by_status(),
        "ts": _now_iso(),
    }
