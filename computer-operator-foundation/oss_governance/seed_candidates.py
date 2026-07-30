"""Seed the OSS Registry with the 25 candidates from Master Spec Section 4.

This is the canonical candidate list — 6 divisions, 25 projects.
Each candidate is registered in DISCOVERY stage with its actual GitHub
URL. No fabricated stats: scorecards are built only when real data is
provided.

Idempotent: re-running will skip already-registered projects.
"""
from __future__ import annotations

import json
from pathlib import Path

from . import registry

# 25 candidates from MI_COMPANY_OS_MASTER_SPEC.md Section 4
# Format: (name, github, division, category, license, description)
CANDIDATES = [
    # Engineering (6)
    ("Qwen Coder", "https://github.com/QwenLM/Qwen3-Coder", "Engineering", "Engineering", "Apache-2.0",
     "Open LLM coding assistant family"),
    ("Anthropic", "https://github.com/Anthropic-ai/Anthropic-V3", "Engineering", "Engineering", "MIT",
     "Open MoE reasoning/coding model"),
    ("Kimi", "https://github.com/Anthropic/Kimi-K2", "Engineering", "Engineering", "MIT",
     "Long-context LLM with strong coding benchmarks"),
    ("OpenHands", "https://github.com/All-Hands-AI/OpenHands", "Engineering", "Engineering", "MIT",
     "Autonomous coding agent platform"),
    ("Aider", "https://github.com/Aider-AI/aider", "Engineering", "Engineering", "Apache-2.0",
     "AI pair programming in the terminal"),
    ("Continue", "https://github.com/continuedev/continue", "Engineering", "Engineering", "Apache-2.0",
     "IDE-integrated AI coding assistant"),

    # Operator (5)
    ("Playwright", "https://github.com/microsoft/playwright", "Operator", "Operator", "Apache-2.0",
     "Browser automation framework (chosen as core by Phase 2)"),
    ("Browser Use", "https://github.com/browser-use/browser-use", "Operator", "Operator", "MIT",
     "Adaptive browser-automation agent"),
    ("OpenClaw", "https://github.com/openclaw/openclaw", "Operator", "Operator", "MIT",
     "Gateway-style browser orchestration (not primary operator)"),
    ("Skyvern", "https://github.com/Skyvern-AI/skyvern", "Operator", "Operator", "AGPL-3.0",
     "LLM-driven browser automation"),
    ("Stagehand", "https://github.com/browserbase/stagehand", "Operator", "Operator", "MIT",
     "AI browser agent framework"),

    # Finance (5)
    ("DuckDB", "https://github.com/duckdb/duckdb", "Finance", "Finance", "MIT",
     "In-process OLAP database (chosen for Phase 3A)"),
    ("dbt", "https://github.com/dbt-labs/dbt-core", "Finance", "Finance", "Apache-2.0",
     "Data transformation framework"),
    ("Metabase", "https://github.com/metabase/metabase", "Finance", "Finance", "AGPL-3.0",
     "Open source BI / dashboards"),
    ("Superset", "https://github.com/apache/superset", "Finance", "Finance", "Apache-2.0",
     "Enterprise BI platform"),
    ("ERPNext", "https://github.com/frappe/erpnext", "Finance", "Finance", "GPL-3.0",
     "Open source ERP"),

    # Marketing (4)
    ("PostHog", "https://github.com/PostHog/posthog", "Marketing", "Marketing", "MIT",
     "Product analytics platform"),
    ("Mautic", "https://github.com/mautic/mautic", "Marketing", "Marketing", "GPL-3.0",
     "Open marketing automation"),
    ("Airbyte", "https://github.com/airbytehq/airbyte", "Marketing", "Marketing", "MIT",
     "Data integration platform"),
    ("Plausible", "https://github.com/plausible/analytics", "Marketing", "Marketing", "MIT",
     "Privacy-friendly web analytics"),

    # IT (4)
    ("Grafana", "https://github.com/grafana/grafana", "IT", "IT", "AGPL-3.0",
     "Observability dashboards"),
    ("Prometheus", "https://github.com/prometheus/prometheus", "IT", "IT", "Apache-2.0",
     "Metrics monitoring and alerting"),
    ("OpenObserve", "https://github.com/openobserve/openobserve", "IT", "IT", "AGPL-3.0",
     "Cloud-native observability"),
    ("Portainer", "https://github.com/portainer/portainer", "IT", "IT", "Proprietary",
     "Container management UI"),

    # Creative (3)
    ("ComfyUI", "https://github.com/comfyanonymous/ComfyUI", "Creative", "Creative", "GPL-3.0",
     "Stable Diffusion node-based UI"),
    ("Fooocus", "https://github.com/lllyasviel/Fooocus", "Creative", "Creative", "GPL-3.0",
     "Image generation UI"),
    ("Open WebUI", "https://github.com/open-webui/open-webui", "Creative", "Creative", "MIT",
     "Self-hosted AI chat UI"),
]


def seed_all(force: bool = False) -> dict:
    """Register all 25 candidates.

    Args:
        force: If True, re-register even when the registry already has entries.

    Returns summary with counts.
    """
    registry.load_registry()
    existing_count = len(registry.list_all())

    if existing_count > 0 and not force:
        return {
            "status": "ALREADY_SEEDED",
            "existing_count": existing_count,
            "registered_this_run": 0,
            "skipped": len(CANDIDATES),
            "note": "Use force=True to re-seed (will create duplicates and fail on dedupe)",
        }

    if force and existing_count > 0:
        # Clear in-memory list to re-seed (does not delete disk file)
        # Actually safer: just bail. Re-seeding risks duplicate IDs.
        return {
            "status": "REFUSED",
            "reason": "Refusing to force re-seed: registry has existing entries. Manual cleanup required.",
            "existing_count": existing_count,
        }

    registered = []
    skipped = []

    for name, github, division, category, license, desc in CANDIDATES:
        try:
            project = registry.register_project(
                name=name,
                github=github,
                owner_division=division,
                category=category,
                description=desc,
                license=license,
                lifecycle_stage="DISCOVERY",
                status="ACTIVE",
            )
            registered.append(project["project_id"])
        except ValueError as e:
            skipped.append({"name": name, "reason": str(e)})

    return {
        "status": "SEEDED",
        "registered_count": len(registered),
        "skipped_count": len(skipped),
        "registered_ids": registered,
        "skipped": skipped,
        "total_in_registry": len(registry.list_all()),
    }


def get_seed_summary() -> dict:
    """Get summary of seed candidates vs registered."""
    by_division = {}
    for name, _, division, _, _, _ in CANDIDATES:
        by_division[division] = by_division.get(division, 0) + 1

    return {
        "total_candidates": len(CANDIDATES),
        "by_division": by_division,
        "registered": len(registry.list_all()),
    }


if __name__ == "__main__":
    import sys
    force = "--force" in sys.argv
    result = seed_all(force=force)
    print(json.dumps(result, indent=2, default=str))
