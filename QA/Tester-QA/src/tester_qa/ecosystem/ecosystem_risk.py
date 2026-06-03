"""Ecosystem-wide risk scoring and intelligence."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from tester_qa.ecosystem.dependency_graph import DependencyGraph
from tester_qa.ecosystem.runtime_topology import RuntimeTopology
from tester_qa.ecosystem.collapse_propagation import CollapsePropagation


class EcosystemRiskEngine:
    """Calculate comprehensive ecosystem risk across all projects."""

    def __init__(self, projects: list[dict[str, Any]]) -> None:
        self.projects = projects
        self.graph = DependencyGraph()
        self.topology = RuntimeTopology()
        self.graph.build_from_projects(projects)
        self.topology.build_from_projects(projects)
        self.propagation = CollapsePropagation(self.graph)

    def full_assessment(self) -> dict[str, Any]:
        """Run complete ecosystem risk assessment."""
        fragility = self.graph.get_fragility_score()
        resilience = self.propagation.get_ecosystem_resilience()
        shared = self.topology.detect_shared_resources()
        collapse_candidates = self.topology.get_collapse_candidates()
        critical_paths = self.graph.get_critical_paths()

        # Calculate composite score
        scores = {
            "fragility_index": fragility["fragility_index"],
            "resilience_score": resilience["resilience_score"],
            "shared_resource_risk": self._shared_resource_risk(shared),
            "spof_count": len(fragility["single_points_of_failure"]),
            "critical_path_count": len(critical_paths),
        }

        # Overall ecosystem health (0-100, higher = healthier)
        overall = self._calculate_overall_score(scores)

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "overall_ecosystem_health": overall,
            "scores": scores,
            "fragility": fragility,
            "resilience": resilience,
            "shared_resources": shared,
            "collapse_candidates": collapse_candidates,
            "critical_paths": critical_paths,
            "recommendations": self._generate_recommendations(scores, fragility, collapse_candidates),
        }

    def get_project_risk_ranking(self) -> list[dict[str, Any]]:
        """Rank projects by their risk to the ecosystem."""
        rankings: list[dict[str, Any]] = []
        for project in self.projects:
            pid = project.get("name") or project.get("id", "unknown")
            blast_radius = len(self.graph.get_blast_radius(pid))
            dependents = len(self.graph.get_dependents(pid))
            dependencies = len(self.graph.get_dependencies(pid))

            risk_score = blast_radius * 3 + dependents * 2 + dependencies
            rankings.append({
                "project": pid,
                "risk_score": risk_score,
                "blast_radius": blast_radius,
                "dependents": dependents,
                "dependencies": dependencies,
                "project_risk_level": project.get("risk_level", "medium"),
            })

        return sorted(rankings, key=lambda x: x["risk_score"], reverse=True)

    def _shared_resource_risk(self, shared: dict[str, Any]) -> float:
        """Calculate risk from shared resources."""
        risk = 0.0
        risk += len(shared.get("shared_cache_users", [])) * 15
        risk += len(shared.get("shared_queue_users", [])) * 20
        risk += len(shared.get("shared_database_users", [])) * 25
        risk += len(shared.get("port_conflicts", {})) * 10
        return min(100.0, risk)

    def _calculate_overall_score(self, scores: dict[str, Any]) -> int:
        """Calculate overall ecosystem health score."""
        health = 100
        health -= int(scores["fragility_index"] * 0.3)
        health -= int((100 - scores["resilience_score"]) * 0.3)
        health -= int(scores["shared_resource_risk"] * 0.2)
        health -= scores["spof_count"] * 5
        health -= scores["critical_path_count"] * 3
        return max(0, min(100, health))

    def _generate_recommendations(self, scores: dict, fragility: dict, collapse_candidates: list) -> list[str]:
        """Generate actionable recommendations."""
        recs: list[str] = []
        if scores["fragility_index"] > 50:
            recs.append("HIGH FRAGILITY: Reduce critical cross-project dependencies")
        if scores["resilience_score"] < 50:
            recs.append("LOW RESILIENCE: Add circuit breakers and fallback mechanisms")
        if scores["spof_count"] > 0:
            spofs = fragility.get("single_points_of_failure", [])
            for spof in spofs[:3]:
                recs.append(f"SPOF: {spof['project']} affects {spof['blast_radius']} projects — add redundancy")
        if collapse_candidates:
            for candidate in collapse_candidates[:2]:
                recs.append(f"COLLAPSE RISK: {candidate['resource']} ({candidate['type']}) affects {len(candidate['affected_projects'])} projects")
        if scores["shared_resource_risk"] > 50:
            recs.append("SHARED RESOURCE RISK: Isolate shared databases/caches per service")
        return recs
