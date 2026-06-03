from __future__ import annotations


def assess_project_risk(info: dict) -> str:
    score = 0
    if info.get("type") == "unknown":
        score += 2
    if not info.get("has_readme"):
        score += 1
    if not info.get("has_env_example"):
        score += 1
    if not info.get("test_commands"):
        score += 2
    if info.get("test_framework") == "none":
        score += 2
    if score >= 5:
        return "high"
    if score >= 2:
        return "medium"
    return "low"


def build_risk_map(projects: list[dict]) -> dict:
    return {
        "high": [project for project in projects if project.get("risk_level") == "high"],
        "medium": [project for project in projects if project.get("risk_level") == "medium"],
        "low": [project for project in projects if project.get("risk_level") == "low"],
    }
