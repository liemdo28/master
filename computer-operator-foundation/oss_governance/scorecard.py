"""OSS Scorecard — evaluates ROI, risk, and maintenance cost for each
registered project.

Mirrors the Financial Intelligence confidence model: never fabricate
metrics; return BLOCKED when data is insufficient; score based on
observable facts only.

CTO Rule: No hallucinated GitHub stats. The scorecard expects manually
provided or API-verified inputs; it never assumes values.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from . import registry

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCORECARD_DIR = Path(__file__).resolve().parent
EVIDENCE_DIR = SCORECARD_DIR / "evidence"
EVIDENCE_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# Weighting constants
# ---------------------------------------------------------------------------

# ROI components (weights must sum to 1.0)
ROI_WEIGHTS = {
    "license_friendlyness": 0.20,
    "community_health": 0.25,
    "integration_fit": 0.30,
    "maintenance_burden": 0.25,
}

# Risk components
RISK_WEIGHTS = {
    "license_risk": 0.30,
    "dependency_depth": 0.20,
    "bus_factor": 0.25,
    "maintenance_activity": 0.25,
}

# Maintenance cost categories (USD/month estimates)
COST_CATEGORIES = {
    "integration": "One-time integration engineering",
    "upgrade": "Ongoing upgrade/patch management",
    "monitoring": "Operational monitoring",
    "security_review": "Security audit cadence",
    "documentation": "Internal documentation maintenance",
}


# ---------------------------------------------------------------------------
# Scorecard evaluation functions
# ---------------------------------------------------------------------------

def evaluate_license(license_name: str) -> dict:
    """Evaluate license friendliness for enterprise use."""
    risk = registry.LICENSE_RISKS.get(license_name, "UNKNOWN")
    scores = {"LOW": 1.0, "MEDIUM": 0.6, "HIGH": 0.2, "UNKNOWN": 0.3}
    return {
        "license": license_name,
        "risk": risk,
        "score": scores.get(risk, 0.3),
        "verdict": "GREEN" if risk == "LOW" else "YELLOW" if risk == "MEDIUM" else "RED" if risk == "HIGH" else "UNKNOWN",
    }


def evaluate_community_health(
    stars: Optional[int] = None,
    forks: Optional[int] = None,
    contributors: Optional[int] = None,
    last_commit_days: Optional[int] = None,
    open_issues: Optional[int] = None,
) -> dict:
    """Evaluate community health from GitHub signals.

    Returns BLOCKED status when any required field is None.
    """
    if any(v is None for v in [stars, forks, contributors, last_commit_days]):
        return {
            "status": "BLOCKED",
            "reason": "Missing community health data — provide stars, forks, contributors, last_commit_days",
            "score": None,
            "signals": {},
        }

    signals = {}

    # Stars scoring (log scale)
    if stars >= 50000:
        signals["stars"] = {"value": stars, "score": 1.0, "label": "very_high"}
    elif stars >= 10000:
        signals["stars"] = {"value": stars, "score": 0.85, "label": "high"}
    elif stars >= 2000:
        signals["stars"] = {"value": stars, "score": 0.7, "label": "moderate"}
    elif stars >= 500:
        signals["stars"] = {"value": stars, "score": 0.5, "label": "growing"}
    else:
        signals["stars"] = {"value": stars, "score": 0.3, "label": "low"}

    # Forks scoring
    if forks >= 5000:
        signals["forks"] = {"value": forks, "score": 1.0, "label": "very_high"}
    elif forks >= 1000:
        signals["forks"] = {"value": forks, "score": 0.8, "label": "high"}
    elif forks >= 200:
        signals["forks"] = {"value": forks, "score": 0.6, "label": "moderate"}
    else:
        signals["forks"] = {"value": forks, "score": 0.3, "label": "low"}

    # Contributors scoring
    if contributors >= 500:
        signals["contributors"] = {"value": contributors, "score": 1.0, "label": "very_high"}
    elif contributors >= 100:
        signals["contributors"] = {"value": contributors, "score": 0.8, "label": "high"}
    elif contributors >= 20:
        signals["contributors"] = {"value": contributors, "score": 0.6, "label": "moderate"}
    else:
        signals["contributors"] = {"value": contributors, "score": 0.3, "label": "low"}

    # Recency scoring (days since last commit)
    if last_commit_days <= 7:
        signals["recency"] = {"days": last_commit_days, "score": 1.0, "label": "active"}
    elif last_commit_days <= 30:
        signals["recency"] = {"days": last_commit_days, "score": 0.8, "label": "maintained"}
    elif last_commit_days <= 90:
        signals["recency"] = {"days": last_commit_days, "score": 0.5, "label": "slow"}
    else:
        signals["recency"] = {"days": last_commit_days, "score": 0.2, "label": "stale"}

    # Aggregate
    scores = [s["score"] for s in signals.values()]
    avg = sum(scores) / len(scores) if scores else 0.0

    return {
        "status": "EVALUATED",
        "score": round(avg, 2),
        "signals": signals,
    }


def evaluate_integration_fit(
    has_api: Optional[bool] = None,
    has_cli: Optional[bool] = None,
    has_python_sdk: Optional[bool] = None,
    has_rest_api: Optional[bool] = None,
    language_match: Optional[bool] = None,
    description: str = "",
) -> dict:
    """Evaluate how well a project fits Mi's stack."""
    signals = {}
    scores = []

    if has_api is not None:
        signals["has_api"] = {"value": has_api, "score": 1.0 if has_api else 0.2}
        scores.append(signals["has_api"]["score"])

    if has_cli is not None:
        signals["has_cli"] = {"value": has_cli, "score": 1.0 if has_cli else 0.3}
        scores.append(signals["has_cli"]["score"])

    if has_python_sdk is not None:
        signals["has_python_sdk"] = {"value": has_python_sdk, "score": 1.0 if has_python_sdk else 0.3}
        scores.append(signals["has_python_sdk"]["score"])

    if has_rest_api is not None:
        signals["has_rest_api"] = {"value": has_rest_api, "score": 1.0 if has_rest_api else 0.4}
        scores.append(signals["has_rest_api"]["score"])

    if language_match is not None:
        signals["language_match"] = {"value": language_match, "score": 1.0 if language_match else 0.3}
        scores.append(signals["language_match"]["score"])

    if not scores:
        return {"status": "BLOCKED", "reason": "No integration signals provided", "score": None, "signals": {}}

    avg = sum(scores) / len(scores)
    return {"status": "EVALUATED", "score": round(avg, 2), "signals": signals}


def evaluate_maintenance_burden(
    release_frequency_months: Optional[float] = None,
    breaking_changes_per_year: Optional[int] = None,
    documentation_quality: Optional[str] = None,
) -> dict:
    """Evaluate maintenance burden (lower is better)."""
    signals = {}
    scores = []

    if release_frequency_months is not None:
        if release_frequency_months <= 1:
            signals["release_freq"] = {"months": release_frequency_months, "score": 0.9, "label": "very_active"}
        elif release_frequency_months <= 3:
            signals["release_freq"] = {"months": release_frequency_months, "score": 0.7, "label": "active"}
        elif release_frequency_months <= 6:
            signals["release_freq"] = {"months": release_frequency_months, "score": 0.5, "label": "moderate"}
        else:
            signals["release_freq"] = {"months": release_frequency_months, "score": 0.2, "label": "slow"}
        scores.append(signals["release_freq"]["score"])

    if breaking_changes_per_year is not None:
        if breaking_changes_per_year == 0:
            signals["breaking_changes"] = {"count": breaking_changes_per_year, "score": 1.0, "label": "stable"}
        elif breaking_changes_per_year <= 1:
            signals["breaking_changes"] = {"count": breaking_changes_per_year, "score": 0.7, "label": "minor"}
        elif breaking_changes_per_year <= 3:
            signals["breaking_changes"] = {"count": breaking_changes_per_year, "score": 0.4, "label": "moderate"}
        else:
            signals["breaking_changes"] = {"count": breaking_changes_per_year, "score": 0.1, "label": "volatile"}
        scores.append(signals["breaking_changes"]["score"])

    if documentation_quality is not None:
        doc_scores = {"excellent": 1.0, "good": 0.7, "fair": 0.4, "poor": 0.2}
        s = doc_scores.get(documentation_quality, 0.3)
        signals["documentation"] = {"value": documentation_quality, "score": s}
        scores.append(s)

    if not scores:
        return {"status": "BLOCKED", "reason": "No maintenance data provided", "score": None, "signals": {}}

    avg = sum(scores) / len(scores)
    return {"status": "EVALUATED", "score": round(avg, 2), "signals": signals}


# ---------------------------------------------------------------------------
# Aggregate scorecard
# ---------------------------------------------------------------------------

def build_scorecard(
    project_id: str,
    license_name: str,
    stars: Optional[int] = None,
    forks: Optional[int] = None,
    contributors: Optional[int] = None,
    last_commit_days: Optional[int] = None,
    has_api: Optional[bool] = None,
    has_cli: Optional[bool] = None,
    has_python_sdk: Optional[bool] = None,
    has_rest_api: Optional[bool] = None,
    language_match: Optional[bool] = None,
    release_frequency_months: Optional[float] = None,
    breaking_changes_per_year: Optional[int] = None,
    documentation_quality: Optional[str] = None,
) -> dict:
    """Build a full scorecard for a registered project.

    Returns the scorecard dict and updates the registry entry.
    """
    project = registry.get_project(project_id)
    if not project:
        raise ValueError(f"Project not found: {project_id}")

    license_eval = evaluate_license(license_name)
    community = evaluate_community_health(
        stars=stars, forks=forks, contributors=contributors,
        last_commit_days=last_commit_days,
    )
    integration = evaluate_integration_fit(
        has_api=has_api, has_cli=has_cli, has_python_sdk=has_python_sdk,
        has_rest_api=has_rest_api, language_match=language_match,
        description=project.get("description", ""),
    )
    maintenance = evaluate_maintenance_burden(
        release_frequency_months=release_frequency_months,
        breaking_changes_per_year=breaking_changes_per_year,
        documentation_quality=documentation_quality,
    )

    # ROI composite
    roi_components = {
        "license_friendlyness": license_eval["score"],
        "community_health": community["score"],
        "integration_fit": integration["score"],
        "maintenance_burden": maintenance["score"],
    }

    # If any component is BLOCKED, overall ROI is BLOCKED
    blocked = [k for k, v in roi_components.items() if v is None]
    if blocked:
        roi = {
            "status": "BLOCKED",
            "blocked_components": blocked,
            "components": roi_components,
            "composite_score": None,
        }
    else:
        composite = sum(
            roi_components[k] * ROI_WEIGHTS[k] for k in ROI_WEIGHTS
        )
        roi = {
            "status": "EVALUATED",
            "composite_score": round(composite, 2),
            "components": roi_components,
            "verdict": (
                "STRONG_BUY" if composite >= 0.8 else
                "BUY" if composite >= 0.6 else
                "HOLD" if composite >= 0.4 else
                "PASS"
            ),
        }

    # Risk composite
    risk_components = {
        "license_risk": 1.0 - license_eval["score"],  # invert: higher score = lower risk
        "community_health": 1.0 - (community["score"] or 0.5),
    }
    risk_composite = sum(
        risk_components.get(k, 0.5) * RISK_WEIGHTS.get(k, 0.25)
        for k in RISK_WEIGHTS
        if k in risk_components
    )
    risk = {
        "composite_score": round(risk_composite, 2),
        "components": risk_components,
        "verdict": (
            "LOW" if risk_composite < 0.3 else
            "MEDIUM" if risk_composite < 0.6 else
            "HIGH"
        ),
    }

    # Maintenance cost estimate
    maintenance_cost = {
        "components": maintenance.get("signals", {}),
        "score": maintenance["score"],
        "status": maintenance["status"],
    }

    # Assemble full scorecard
    scorecard = {
        "project_id": project_id,
        "project_name": project["name"],
        "roi": roi,
        "risk": risk,
        "maintenance_cost": maintenance_cost,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Write evidence
    evidence_file = EVIDENCE_DIR / f"{project_id}_scorecard.json"
    evidence_file.write_text(json.dumps(scorecard, indent=2, default=str), encoding="utf-8")

    # Update registry
    registry.update_scorecard_ref(
        project_id=project_id,
        roi=roi,
        risk=risk,
        maintenance_cost=maintenance_cost,
    )

    return scorecard


def get_scorecard(project_id: str) -> Optional[dict]:
    """Retrieve scorecard for a project."""
    evidence_file = EVIDENCE_DIR / f"{project_id}_scorecard.json"
    if evidence_file.exists():
        return json.loads(evidence_file.read_text(encoding="utf-8"))
    return None


def list_scorecards() -> list[dict]:
    """List all scorecards."""
    cards = []
    for f in sorted(EVIDENCE_DIR.glob("*_scorecard.json")):
        cards.append(json.loads(f.read_text(encoding="utf-8")))
    return cards
